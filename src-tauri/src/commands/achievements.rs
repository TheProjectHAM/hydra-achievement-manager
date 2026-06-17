use super::language::{map_ui_language_to_hydra_lang, map_ui_language_to_steam_store_lang};
use super::settings::{load_settings, save_settings};
use crate::api::{HydraAPI, SteamAPI};
use crate::models::{DirectoryConfig, DirectoryDetectionPreset, UnlockOptions};
use crate::parser::AchievementParser;
use crate::unlocker::AchievementUnlocker;
use crate::utils::{AchievementExporter, CacheManager};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_dialog::DialogExt;

fn extract_xml_tag_value(line: &str, tag: &str) -> Option<String> {
    let open = format!("<{}>", tag);
    let close = format!("</{}>", tag);
    let start = line.find(&open)? + open.len();
    let end = line[start..].find(&close)? + start;
    Some(line[start..end].trim().to_string())
}

fn flush_current_steam_achievement(
    map: &mut HashMap<String, (i32, i64)>,
    current_name: &mut Option<String>,
    current_achieved: &mut Option<i32>,
    current_unlock_time: &mut Option<i64>,
) {
    if let (Some(name), Some(achieved), Some(unlock_time)) = (
        current_name.take(),
        current_achieved.take(),
        current_unlock_time.take(),
    ) {
        map.insert(name, (achieved, unlock_time));
    }
}

fn parse_steam_community_achievement_xml(xml_content: &str) -> HashMap<String, (i32, i64)> {
    let mut map = HashMap::new();
    let mut current_name: Option<String> = None;
    let mut current_achieved: Option<i32> = None;
    let mut current_unlock_time: Option<i64> = None;
    let mut in_achievement = false;

    for line in xml_content.lines() {
        let trimmed = line.trim();

        if trimmed.starts_with("<achievement") {
            in_achievement = true;
            current_name = None;
            current_achieved = None;
            current_unlock_time = None;
            continue;
        }

        if trimmed.starts_with("</achievement>") {
            flush_current_steam_achievement(
                &mut map,
                &mut current_name,
                &mut current_achieved,
                &mut current_unlock_time,
            );
            in_achievement = false;
            continue;
        }

        if !in_achievement {
            continue;
        }

        if let Some(name) = extract_xml_tag_value(trimmed, "apiname") {
            current_name = Some(name);
        }

        if let Some(achieved) = extract_xml_tag_value(trimmed, "achieved") {
            current_achieved = Some(achieved.parse().unwrap_or(0));
        }

        if let Some(unlock_time) = extract_xml_tag_value(trimmed, "unlocktime") {
            current_unlock_time = Some(unlock_time.parse().unwrap_or(0));
        }
    }

    flush_current_steam_achievement(
        &mut map,
        &mut current_name,
        &mut current_achieved,
        &mut current_unlock_time,
    );
    map
}

/// Obtém achievements de um jogo
#[tauri::command]
pub async fn get_game_achievements(
    game_id: String,
    language: Option<String>,
    state: tauri::State<'_, crate::AppState>,
    app_handle: AppHandle,
) -> Result<Value, String> {
    let user_data_path = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app_data_dir: {}", e))?;
    let settings_path = user_data_path.join("settings.json");

    let mut selected_api = "hydra".to_string();
    let mut steam_api_key = String::new();
    let mut steam_id = String::new();
    let mut settings_language: Option<String> = None;

    if settings_path.exists() {
        if let Ok(settings_data) = fs::read_to_string(&settings_path) {
            if let Ok(settings) = serde_json::from_str::<Value>(&settings_data) {
                if let Some(api) = settings.get("selectedApi").and_then(|v| v.as_str()) {
                    selected_api = api.to_string();
                }
                if let Some(key) = settings.get("steamApiKey").and_then(|v| v.as_str()) {
                    steam_api_key = key.to_string();
                }
                if let Some(id) = settings.get("steamId").and_then(|v| v.as_str()) {
                    steam_id = id.to_string();
                }
                if let Some(lang) = settings.get("language").and_then(|v| v.as_str()) {
                    settings_language = Some(lang.to_string());
                }
            }
        }
    }
    let language = language.or(settings_language).unwrap_or_else(|| "en-US".to_string());
    log::info!(
        "Getting achievements for game_id: {} using api: {}",
        game_id,
        selected_api
    );
    if selected_api == "steam" {
        log::info!("Steam Info: ID={}, KeyLength={}", steam_id, steam_api_key.len());
    }

    if steam_id.is_empty() {
        let resolved_id = {
            let steam_lock = state.steam_monitor.lock().map_err(|e| e.to_string())?;
            if let Some(steam_monitor) = &*steam_lock {
                let mut initialized_here = false;
                if !steam_monitor.is_enabled() {
                    let _ = steam_monitor.initialize();
                    initialized_here = true;
                }

                let id = if steam_monitor.is_enabled() {
                    steam_monitor.get_user_info().ok().map(|(id, _)| id)
                } else {
                    None
                };

                if initialized_here && steam_monitor.is_enabled() {
                    let _ = steam_monitor.shutdown();
                }

                id
            } else {
                None
            }
        };

        if let Some(id) = resolved_id {
            steam_id = id.clone();
            let _ = save_settings(serde_json::json!({ "steamId": id }), app_handle.clone()).await;
        }
    }

    let steam_language = map_ui_language_to_steam_store_lang(&language);
    let hydra_language = map_ui_language_to_hydra_lang(&language);

    let mut achievements_json = if selected_api == "steam" && !steam_api_key.is_empty() {
        let app_id: u32 = game_id
            .parse()
            .map_err(|e: std::num::ParseIntError| e.to_string())?;
        let mut schema_achievements = SteamAPI::get_game_achievements(app_id, &steam_api_key, steam_language)
            .await
            .map_err(|e| e.to_string())?;

        if !steam_id.is_empty() {
            if let Ok(player_achievements) =
                SteamAPI::get_player_achievements(app_id, &steam_api_key, &steam_id).await
            {
                let player_map: HashMap<String, i32> =
                    player_achievements.iter().map(|a| (a.apiname.clone(), a.achieved)).collect();

                let time_map: HashMap<String, i64> =
                    player_achievements.iter().map(|a| (a.apiname.clone(), a.unlocktime)).collect();

                for ach in &mut schema_achievements {
                    if let Some(achieved) = player_map.get(&ach.apiname) {
                        ach.achieved = *achieved;
                    }
                    if let Some(unlocktime) = time_map.get(&ach.apiname) {
                        ach.unlocktime = *unlocktime;
                    }
                }
            }
        }
        serde_json::to_value(schema_achievements).map_err(|e| e.to_string())?
    } else {
        let result = HydraAPI::get_game_achievements(&game_id, Some(hydra_language))
            .await
            .map_err(|e| e.to_string())?;

        let mut final_achievements = serde_json::to_value(result.achievements).map_err(|e| e.to_string())?;

        if let Ok(app_id) = game_id.parse::<u32>() {
            let mut steam_status_map: HashMap<String, (i32, i64)> = HashMap::new();

            if !steam_api_key.is_empty() && !steam_id.is_empty() {
                if let Ok(player_achievements) =
                    SteamAPI::get_player_achievements(app_id, &steam_api_key, &steam_id).await
                {
                    for ach in player_achievements {
                        steam_status_map.insert(ach.apiname, (ach.achieved, ach.unlocktime));
                    }
                }
            } else if !steam_id.is_empty() {
                let base_url =
                    std::env::var("STEAM_COMMUNITY_URL").unwrap_or_else(|_| "https://steamcommunity.com".to_string());

                let url = format!("{}/profiles/{}/stats/{}/?xml=1", base_url, steam_id, app_id);

                let xml_client = crate::utils::http::get_client().map_err(|e| format!("Failed to create HTTP client: {}", e))?;
                let response = xml_client.get(&url).send().await.map_err(|e| e.to_string())?;

                let xml_content: String = response.text().await.map_err(|e| e.to_string())?;
                steam_status_map = parse_steam_community_achievement_xml(&xml_content);
            }

            if !steam_status_map.is_empty() {
                if let Some(ach_array) = final_achievements.as_array_mut() {
                    for ach in ach_array {
                        if let Some(name) = ach.get("name").and_then(|v| v.as_str()) {
                            if let Some((achieved, unlocktime)) = steam_status_map.get(name) {
                                if let Some(obj) = ach.as_object_mut() {
                                    obj.insert("achieved".to_string(), serde_json::json!(*achieved > 0));
                                    obj.insert("unlockTime".to_string(), serde_json::json!(unlocktime));
                                }
                            }
                        }
                    }
                }
            }
        }

        final_achievements
    };

    let achievements_array = achievements_json
        .as_array_mut()
        .ok_or("Failed to convert achievements to array")?;

    let mut rarity_map = HashMap::new();
    let mut hidden_list = Vec::new();

    for ach in achievements_array.iter() {
        if let Some(name) = ach
            .get("apiname")
            .and_then(|v| v.as_str())
            .or_else(|| ach.get("name").and_then(|v| v.as_str()))
        {
            if let Some(percent) = ach.get("percent").and_then(|v| v.as_f64()) {
                rarity_map.insert(name.to_string(), percent);
            }
            if let Some(hidden) = ach.get("hidden").and_then(|v| v.as_bool()) {
                if hidden {
                    hidden_list.push(name.to_string());
                }
            }
        }
    }

    let _ = CacheManager::update_game(
        &app_handle,
        game_id.clone(),
        None,
        Some(achievements_array.len()),
        Some(rarity_map),
        Some(hidden_list),
    );

    if let Ok(steam_lock) = state.steam_monitor.lock() {
        if let Some(steam_monitor) = &*steam_lock {
            if steam_monitor.is_enabled() {
                if let Ok(_app_id) = game_id.parse::<u32>() {
                    for achievement in achievements_array.iter_mut() {
                        let name = achievement
                            .get("name")
                            .and_then(|v| v.as_str())
                            .or_else(|| achievement.get("apiname").and_then(|v| v.as_str()));

                        if let Some(name) = name {
                            if let Ok(unlocked) = steam_monitor.get_achievement_status(name) {
                                if let Some(obj) = achievement.as_object_mut() {
                                    if unlocked {
                                        obj.insert("achieved".to_string(), serde_json::json!(true));
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(serde_json::json!({
        "gameId": game_id,
        "achievements": achievements_array
    }))
}

#[cfg(test)]
mod tests {
    use super::parse_steam_community_achievement_xml;

    #[test]
    fn parses_steam_community_achievement_xml_blocks() {
        let xml = r#"
            <stats>
              <achievement>
                <apiname>FIRST_BLOOD</apiname>
                <achieved>1</achieved>
                <unlocktime>1710000000</unlocktime>
              </achievement>
              <achievement>
                <apiname>SECOND_WIND</apiname>
                <achieved>0</achieved>
                <unlocktime>0</unlocktime>
              </achievement>
            </stats>
        "#;

        let parsed = parse_steam_community_achievement_xml(xml);

        assert_eq!(parsed.get("FIRST_BLOOD"), Some(&(1, 1_710_000_000)));
        assert_eq!(parsed.get("SECOND_WIND"), Some(&(0, 0)));
    }
}

/// Recarrega achievements de um arquivo
#[tauri::command]
pub async fn reload_achievements(
    game_id: String,
    base_path: String,
    state: tauri::State<'_, crate::AppState>,
    app_handle: AppHandle,
) -> Result<Value, String> {
    let expanded_base_path = crate::parser::expand_path(&base_path);
    let preset = directory_preset_for_path(&state, &base_path).unwrap_or_default();
    let file_path = if preset == DirectoryDetectionPreset::Auto {
        let game_dir = expanded_base_path.join(&game_id);
        AchievementParser::find_achievement_file_in_game_dir(&game_dir, &game_id)
            .map(|(path, _)| path)
            .unwrap_or_else(|| game_dir.join("achievements.ini"))
    } else {
        AchievementParser::achievement_file_for_config(&expanded_base_path, &game_id, preset).0
    };

    let achievements = AchievementParser::parse_achievement_file_auto(&file_path).map_err(|e| e.to_string())?;

    let _ = CacheManager::update_game(&app_handle, game_id.clone(), None, Some(achievements.len()), None, None);

    Ok(serde_json::json!({
        "gameId": game_id,
        "achievements": achievements
    }))
}

/// Unlock achievements
#[tauri::command]
pub async fn unlock_achievements(
    options: UnlockOptions,
    state: tauri::State<'_, crate::AppState>,
    app_handle: AppHandle,
) -> Result<(), String> {
    log::info!(
        "Unlocking achievements for game {} (Path: {})",
        options.game_id,
        options.selected_path
    );

    if options.selected_path.starts_with("steam://") {
        if let Ok(steam_lock) = state.steam_monitor.lock() {
            if let Some(steam_monitor) = &*steam_lock {
                log::info!("Using Steam API for unlock (temporary session)");

                let unlock_result = (|| -> Result<(), String> {
                    steam_monitor.initialize().map_err(|e| e.to_string())?;
                    if !steam_monitor.is_enabled() {
                        return Err("Steam integration not available or Steam not running".into());
                    }

                    let app_id = options
                        .game_id
                        .parse::<u32>()
                        .map_err(|_| "Invalid Steam AppID".to_string())?;
                    steam_monitor.switch_app_id(app_id).map_err(|e| e.to_string())?;

                    for achievement in &options.achievements {
                        steam_monitor
                            .set_achievement(&achievement.name, achievement.completed)
                            .map_err(|e| e.to_string())?;
                    }

                    Ok(())
                })();

                if let Err(e) = steam_monitor.shutdown() {
                    log::warn!("Failed to close Steam session after unlock: {}", e);
                }

                unlock_result?;
                return Ok(());
            }
        }
        return Err("Steam integration not available or Steam not running".into());
    }

    let preset = directory_preset_for_path(&state, &options.selected_path).unwrap_or_default();
    AchievementUnlocker::unlock_achievements_with_preset(&options, preset).map_err(|e| e.to_string())?;

    if let Err(e) = refresh_monitor_after_local_unlock(&state, app_handle.clone()).await {
        log::warn!("Failed to refresh monitor after local unlock: {}", e);
    }

    app_handle.emit("achievements-updated", ()).map_err(|e| e.to_string())?;

    Ok(())
}

fn directory_preset_for_path(
    state: &tauri::State<'_, crate::AppState>,
    path: &str,
) -> Option<DirectoryDetectionPreset> {
    let monitor_lock = state.monitor.lock().ok()?;
    let monitor = monitor_lock.as_ref()?;
    monitor
        .get_directories()
        .into_iter()
        .find(|dir| dir.path == path)
        .map(|dir| dir.detection_preset)
}

async fn refresh_monitor_after_local_unlock(
    state: &tauri::State<'_, crate::AppState>,
    app_handle: AppHandle,
) -> Result<(), String> {
    if !cfg!(target_os = "linux") {
        return Ok(());
    }

    let settings = load_settings(app_handle.clone())
        .await
        .unwrap_or_else(|_| serde_json::json!({}));
    let saved_wine_prefix = settings
        .get("winePrefixPath")
        .and_then(|v| v.as_str())
        .map(|v| v.to_string());

    let current_games = {
        let mut monitor_lock = state.monitor.lock().map_err(|e| e.to_string())?;
        let monitor = monitor_lock
            .as_mut()
            .ok_or_else(|| "Monitor not initialized".to_string())?;

        let current = monitor.get_directories();
        let custom_dirs: Vec<DirectoryConfig> = current.iter().filter(|d| !d.is_default).cloned().collect();
        let default_enabled: std::collections::HashMap<String, bool> = current
            .iter()
            .filter(|d| d.is_default)
            .map(|d| (d.name.clone(), d.enabled))
            .collect();

        let mut next = super::directories::build_default_directory_configs(saved_wine_prefix.as_deref());
        for dir in &mut next {
            if let Some(enabled) = default_enabled.get(&dir.name) {
                dir.enabled = *enabled;
            }
        }

        next.extend(custom_dirs);
        next.sort_by(|a, b| a.path.cmp(&b.path));
        next.dedup_by(|a, b| a.path == b.path);

        monitor.set_directories(next.clone());
        monitor.restart_monitoring().map_err(|e| e.to_string())?;
        monitor.get_current_achievements()
    };

    app_handle
        .emit("achievements-update", current_games)
        .map_err(|e| e.to_string())?;

    Ok(())
}

static LAST_EXPORT_TIME: Mutex<Option<u64>> = Mutex::new(None);
const EXPORT_COOLDOWN: u64 = 2000;

/// Exporta achievements
#[tauri::command]
pub async fn export_achievements(game_id: String, app_handle: AppHandle) -> Result<serde_json::Value, String> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis() as u64;

    {
        let mut last_time = LAST_EXPORT_TIME.lock().map_err(|e| e.to_string())?;
        if let Some(last) = *last_time {
            if now - last < EXPORT_COOLDOWN {
                return Ok(serde_json::json!({
                    "success": false,
                    "message": "Export is on cooldown. Please wait."
                }));
            }
        }
        *last_time = Some(now);
    }

    let export_dir = app_handle
        .dialog()
        .file()
        .set_title("Select directory to export achievements")
        .blocking_pick_folder();

    let export_dir = match export_dir {
        Some(fp) => fp.as_path().map(|p| p.to_path_buf()),
        None => {
            return Ok(serde_json::json!({
                "success": false,
                "message": "Export cancelled"
            }));
        }
    };

    let export_dir = match export_dir {
        Some(p) => p,
        None => {
            return Ok(serde_json::json!({
                "success": false,
                "message": "Invalid export path"
            }));
        }
    };

    let mut language = "en-US".to_string();
    let settings = load_settings(app_handle.clone()).await.unwrap_or(serde_json::json!({}));
    if let Some(lang) = settings.get("language").and_then(|v| v.as_str()) {
        language = lang.to_string();
    }

    match AchievementExporter::export_achievements(&game_id, export_dir, &language, &app_handle).await {
        Ok(_) => Ok(serde_json::json!({
            "success": true
        })),
        Err(e) => Ok(serde_json::json!({
            "success": false,
            "message": e.to_string()
        })),
    }
}
