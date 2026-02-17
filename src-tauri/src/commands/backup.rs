use crate::models::AchievementEntry;
use crate::parser::{expand_path, AchievementParser};
use crate::unlocker::AchievementWriter;
use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter, Manager, State};

fn default_backup_version() -> u32 {
    1
}

const B64_PREFIX: &str = "HAMB64:";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BackupFile {
    #[serde(default = "default_backup_version")]
    format_version: u32,
    created_at: String,
    app_version: String,
    games: Vec<BackupGameEntry>,
    #[serde(default)]
    settings: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BackupGameEntry {
    game_id: String,
    directory: String,
    file_format: String,
    last_modified: i64,
    achievements: Vec<AchievementEntry>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupResult {
    pub output_path: String,
    pub games_count: usize,
    pub has_settings: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RestorePreviewResult {
    pub backup_path: String,
    pub total_entries: usize,
    pub items: Vec<RestorePreviewItem>,
    pub settings: RestoreSettingsPreview,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RestorePreviewItem {
    pub index: usize,
    pub game_id: String,
    pub directory: String,
    pub file_format: String,
    pub backup_achievements: usize,
    pub existing_achievements: usize,
    pub overlapping_achievements: usize,
    pub changed_achievements: usize,
    pub unchanged_achievements: usize,
    pub new_achievements: usize,
    pub will_replace: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreSettingsPreview {
    pub included: bool,
    pub total_keys: usize,
    pub conflicting_keys: usize,
    pub missing_keys: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreApplyResult {
    pub backup_path: String,
    pub restored_entries: usize,
    pub skipped_entries: usize,
    pub restored_settings: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameConflictResolution {
    pub index: usize,
    pub strategy: String,
}

#[derive(Debug, Clone, Copy)]
enum ConflictStrategy {
    Backup,
    Current,
    Cancel,
}

#[derive(Debug, Clone, Copy)]
enum SettingsStrategy {
    Backup,
    Current,
    Merge,
}

#[tauri::command]
pub async fn create_achievements_backup(
    output_path: String,
    selected_game_ids: Option<Vec<String>>,
    include_settings: Option<bool>,
    state: State<'_, crate::AppState>,
    app_handle: AppHandle,
) -> Result<BackupResult, String> {
    let selected_set = selected_game_ids
        .unwrap_or_default()
        .into_iter()
        .collect::<HashSet<_>>();

    let monitor_lock = state.monitor.lock().map_err(|e| e.to_string())?;
    let monitor = monitor_lock
        .as_ref()
        .ok_or_else(|| "Monitor not initialized".to_string())?;

    let games = monitor.get_current_achievements();
    let filtered_games: Vec<_> = if selected_set.is_empty() {
        games
    } else {
        games
            .into_iter()
            .filter(|g| selected_set.contains(&g.game_id))
            .collect()
    };

    let should_include_settings = include_settings.unwrap_or(true);
    let settings_snapshot = if should_include_settings {
        read_current_settings(&app_handle)?
    } else {
        None
    };

    if filtered_games.is_empty() && settings_snapshot.is_none() {
        return Err("No games or settings available for backup".to_string());
    }

    let backup_games: Vec<BackupGameEntry> = filtered_games
        .into_iter()
        .map(|game| BackupGameEntry {
            file_format: detect_game_file_format(&game.directory, &game.game_id),
            game_id: game.game_id,
            directory: game.directory,
            last_modified: game.last_modified,
            achievements: game.achievements,
        })
        .collect();

    let backup = BackupFile {
        format_version: 2,
        created_at: chrono::Utc::now().to_rfc3339(),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        games: backup_games,
        settings: settings_snapshot,
    };

    let mut final_path = PathBuf::from(output_path);
    if final_path.extension().and_then(|e| e.to_str()) != Some("ham") {
        final_path.set_extension("ham");
    }

    if let Some(parent) = final_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let json = serde_json::to_string_pretty(&backup).map_err(|e| e.to_string())?;
    let encoded = encode_backup_content(&json);
    fs::write(&final_path, encoded).map_err(|e| e.to_string())?;

    Ok(BackupResult {
        output_path: final_path.to_string_lossy().to_string(),
        games_count: backup.games.len(),
        has_settings: backup.settings.is_some(),
    })
}

#[tauri::command]
pub async fn preview_achievements_restore(
    backup_path: String,
    app_handle: AppHandle,
) -> Result<RestorePreviewResult, String> {
    let backup = read_backup_file(&backup_path)?;

    let items = backup
        .games
        .iter()
        .enumerate()
        .map(|(index, item)| build_preview_item(index, item))
        .collect::<Result<Vec<_>, String>>()?;

    let settings_preview = build_settings_preview(&backup.settings, &app_handle)?;

    Ok(RestorePreviewResult {
        backup_path,
        total_entries: items.len(),
        items,
        settings: settings_preview,
    })
}

#[tauri::command]
pub async fn apply_achievements_restore(
    backup_path: String,
    selected_indices: Option<Vec<usize>>,
    game_conflict_resolutions: Option<Vec<GameConflictResolution>>,
    restore_settings: Option<bool>,
    settings_strategy: Option<String>,
    app_handle: AppHandle,
) -> Result<RestoreApplyResult, String> {
    let backup = read_backup_file(&backup_path)?;

    let selected_set = selected_indices
        .unwrap_or_default()
        .into_iter()
        .collect::<HashSet<_>>();

    let resolution_map = build_resolution_map(game_conflict_resolutions.unwrap_or_default())?;

    let mut restored_entries = 0usize;
    let mut skipped_entries = 0usize;

    for (index, item) in backup.games.iter().enumerate() {
        if !selected_set.is_empty() && !selected_set.contains(&index) {
            skipped_entries += 1;
            continue;
        }

        let strategy = resolution_map
            .get(&index)
            .copied()
            .unwrap_or(ConflictStrategy::Backup);

        let has_conflict = entry_has_conflict(item)?;
        if has_conflict && matches!(strategy, ConflictStrategy::Cancel) {
            return Err(format!(
                "Restore canceled due to conflict on game {} ({})",
                item.game_id, item.directory
            ));
        }

        if has_conflict && matches!(strategy, ConflictStrategy::Current) {
            skipped_entries += 1;
            continue;
        }

        restore_entry(item)?;
        restored_entries += 1;
    }

    let should_restore_settings = restore_settings.unwrap_or(false);
    let mut restored_settings = false;
    if should_restore_settings {
        if let Some(settings) = backup.settings.as_ref() {
            let strategy = parse_settings_strategy(settings_strategy.as_deref().unwrap_or("backup"))?;
            restored_settings = restore_settings_from_backup(settings, &app_handle, strategy)?;
        }
    }

    app_handle
        .emit("achievements-updated", ())
        .map_err(|e| e.to_string())?;

    Ok(RestoreApplyResult {
        backup_path,
        restored_entries,
        skipped_entries,
        restored_settings,
    })
}

fn read_backup_file(path: &str) -> Result<BackupFile, String> {
    let raw = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let decoded = decode_backup_content(&raw)?;
    let backup: BackupFile = serde_json::from_str(&decoded).map_err(|e| e.to_string())?;

    if backup.format_version != 1 && backup.format_version != 2 {
        return Err(format!(
            "Unsupported backup version: {}",
            backup.format_version
        ));
    }

    Ok(backup)
}

fn encode_backup_content(json: &str) -> String {
    format!("{}{}", B64_PREFIX, BASE64_STANDARD.encode(json.as_bytes()))
}

fn decode_backup_content(raw: &str) -> Result<String, String> {
    let trimmed = raw.trim();

    if let Some(payload) = trimmed.strip_prefix(B64_PREFIX) {
        let bytes = BASE64_STANDARD
            .decode(payload)
            .map_err(|e| format!("Invalid base64 backup payload: {}", e))?;
        return String::from_utf8(bytes)
            .map_err(|e| format!("Invalid UTF-8 in backup payload: {}", e));
    }

    // Compatibilidade com backups antigos em JSON puro.
    Ok(raw.to_string())
}

fn detect_game_file_format(directory: &str, game_id: &str) -> String {
    let game_dir = expand_path(directory).join(game_id);
    let json_path = game_dir.join("achievements.json");
    if json_path.exists() {
        return "json".to_string();
    }
    "ini".to_string()
}

fn read_existing_achievements(directory: &str, game_id: &str) -> Result<Vec<AchievementEntry>, String> {
    let game_dir = expand_path(directory).join(game_id);
    let ini_path = game_dir.join("achievements.ini");
    let json_path = game_dir.join("achievements.json");

    let target = if ini_path.exists() {
        Some(ini_path)
    } else if json_path.exists() {
        Some(json_path)
    } else {
        None
    };

    if let Some(path) = target {
        AchievementParser::parse_achievement_file(path).map_err(|e| e.to_string())
    } else {
        Ok(Vec::new())
    }
}

fn build_preview_item(index: usize, item: &BackupGameEntry) -> Result<RestorePreviewItem, String> {
    let existing = read_existing_achievements(&item.directory, &item.game_id)?;

    let existing_map: HashMap<&str, &AchievementEntry> =
        existing.iter().map(|a| (a.name.as_str(), a)).collect();

    let mut overlapping = 0usize;
    let mut changed = 0usize;
    let mut unchanged = 0usize;
    let mut new_count = 0usize;

    for ach in &item.achievements {
        if let Some(current) = existing_map.get(ach.name.as_str()) {
            overlapping += 1;
            if current.achieved != ach.achieved || current.unlock_time != ach.unlock_time {
                changed += 1;
            } else {
                unchanged += 1;
            }
        } else {
            new_count += 1;
        }
    }

    Ok(RestorePreviewItem {
        index,
        game_id: item.game_id.clone(),
        directory: item.directory.clone(),
        file_format: item.file_format.clone(),
        backup_achievements: item.achievements.len(),
        existing_achievements: existing.len(),
        overlapping_achievements: overlapping,
        changed_achievements: changed,
        unchanged_achievements: unchanged,
        new_achievements: new_count,
        will_replace: overlapping > 0,
    })
}

fn entry_has_conflict(item: &BackupGameEntry) -> Result<bool, String> {
    let existing = read_existing_achievements(&item.directory, &item.game_id)?;
    if existing.is_empty() {
        return Ok(false);
    }

    let existing_map: HashMap<&str, &AchievementEntry> =
        existing.iter().map(|a| (a.name.as_str(), a)).collect();

    for ach in &item.achievements {
        if let Some(current) = existing_map.get(ach.name.as_str()) {
            if current.achieved != ach.achieved || current.unlock_time != ach.unlock_time {
                return Ok(true);
            }
        }
    }

    Ok(false)
}

fn restore_entry(item: &BackupGameEntry) -> Result<(), String> {
    let expanded_base = expand_path(&item.directory);
    let game_dir = expanded_base.join(&item.game_id);
    let ini_path = game_dir.join("achievements.ini");
    let json_path = game_dir.join("achievements.json");

    let use_json = should_write_json(&expanded_base, &ini_path, &json_path, &item.file_format);

    if use_json {
        if ini_path.exists() {
            let _ = AchievementWriter::delete_old_file(&ini_path);
        }
        AchievementWriter::write_gse_achievement_file(&json_path, &item.achievements)
            .map_err(|e| e.to_string())?;
    } else {
        if json_path.exists() {
            let _ = AchievementWriter::delete_old_file(&json_path);
        }
        AchievementWriter::write_achievement_file(&ini_path, &item.achievements)
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

fn should_write_json(base_path: &Path, ini_path: &Path, json_path: &Path, backup_format: &str) -> bool {
    if json_path.exists() {
        return true;
    }

    if ini_path.exists() {
        return false;
    }

    if base_path
        .to_string_lossy()
        .to_lowercase()
        .contains("gse saves")
    {
        return true;
    }

    backup_format.eq_ignore_ascii_case("json")
}

fn settings_path(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let user_data_path = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app_data_dir: {}", e))?;
    Ok(user_data_path.join("settings.json"))
}

fn read_current_settings(app_handle: &AppHandle) -> Result<Option<Value>, String> {
    let path = settings_path(app_handle)?;
    if !path.exists() {
        return Ok(None);
    }

    let raw = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let parsed: Value = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
    Ok(Some(parsed))
}

fn write_settings(app_handle: &AppHandle, settings: &Value) -> Result<(), String> {
    let path = settings_path(app_handle)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let json = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())
}

fn build_settings_preview(
    backup_settings: &Option<Value>,
    app_handle: &AppHandle,
) -> Result<RestoreSettingsPreview, String> {
    let Some(backup_value) = backup_settings else {
        return Ok(RestoreSettingsPreview {
            included: false,
            total_keys: 0,
            conflicting_keys: 0,
            missing_keys: 0,
        });
    };

    let backup_obj = backup_value
        .as_object()
        .ok_or_else(|| "Invalid settings in backup".to_string())?;

    let current = read_current_settings(app_handle)?.unwrap_or_else(|| serde_json::json!({}));
    let current_obj = current.as_object().cloned().unwrap_or_default();

    let mut conflicting_keys = 0usize;
    let mut missing_keys = 0usize;

    for (k, v) in backup_obj {
        if let Some(curr_v) = current_obj.get(k) {
            if curr_v != v {
                conflicting_keys += 1;
            }
        } else {
            missing_keys += 1;
        }
    }

    Ok(RestoreSettingsPreview {
        included: true,
        total_keys: backup_obj.len(),
        conflicting_keys,
        missing_keys,
    })
}

fn build_resolution_map(items: Vec<GameConflictResolution>) -> Result<HashMap<usize, ConflictStrategy>, String> {
    let mut map = HashMap::new();
    for item in items {
        let strategy = parse_conflict_strategy(&item.strategy)?;
        map.insert(item.index, strategy);
    }
    Ok(map)
}

fn parse_conflict_strategy(value: &str) -> Result<ConflictStrategy, String> {
    match value.to_lowercase().as_str() {
        "backup" => Ok(ConflictStrategy::Backup),
        "current" => Ok(ConflictStrategy::Current),
        "cancel" => Ok(ConflictStrategy::Cancel),
        _ => Err(format!("Invalid conflict strategy: {}", value)),
    }
}

fn parse_settings_strategy(value: &str) -> Result<SettingsStrategy, String> {
    match value.to_lowercase().as_str() {
        "backup" => Ok(SettingsStrategy::Backup),
        "current" => Ok(SettingsStrategy::Current),
        "merge" => Ok(SettingsStrategy::Merge),
        _ => Err(format!("Invalid settings strategy: {}", value)),
    }
}

fn restore_settings_from_backup(
    backup_settings: &Value,
    app_handle: &AppHandle,
    strategy: SettingsStrategy,
) -> Result<bool, String> {
    let backup_obj = backup_settings
        .as_object()
        .ok_or_else(|| "Invalid settings in backup".to_string())?;

    match strategy {
        SettingsStrategy::Current => Ok(false),
        SettingsStrategy::Backup => {
            write_settings(app_handle, backup_settings)?;
            Ok(true)
        }
        SettingsStrategy::Merge => {
            let mut current = read_current_settings(app_handle)?.unwrap_or_else(|| serde_json::json!({}));
            let current_obj = current
                .as_object_mut()
                .ok_or_else(|| "Current settings format is invalid".to_string())?;

            for (k, v) in backup_obj {
                current_obj.entry(k.clone()).or_insert_with(|| v.clone());
            }

            write_settings(app_handle, &current)?;
            Ok(true)
        }
    }
}
