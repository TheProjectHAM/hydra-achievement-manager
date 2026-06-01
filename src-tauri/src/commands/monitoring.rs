use super::directories::build_default_directory_configs;
use super::settings::{load_settings, save_settings};
use crate::models::{DirectoryConfig, DirectoryDetectionPreset, GameAchievements};
use serde_json::Value;
use std::time::UNIX_EPOCH;
use tauri::AppHandle;

/// Obtém diretórios monitorados
#[tauri::command]
pub async fn get_monitored_directories(
    state: tauri::State<'_, crate::AppState>,
) -> Result<Vec<DirectoryConfig>, String> {
    let monitor_lock = state.monitor.lock().map_err(|e| e.to_string())?;
    if let Some(monitor) = &*monitor_lock {
        Ok(monitor.get_directories())
    } else {
        Err("Monitor not initialized".to_string())
    }
}

/// Obtém a última modificação real do arquivo de conquista para um jogo em um caminho.
#[tauri::command]
pub async fn get_achievement_ini_last_modified(
    game_id: String,
    path: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<Option<i64>, String> {
    if path.starts_with("steam://") {
        return Ok(None);
    }

    let preset = directory_preset_for_path(&state, &path).unwrap_or_default();
    let expanded = crate::parser::expand_path(&path);
    let target_path = if preset == DirectoryDetectionPreset::Auto {
        let game_dir = expanded.join(&game_id);
        match crate::parser::AchievementParser::find_achievement_file_in_game_dir(&game_dir, &game_id) {
            Some((path, _)) => path,
            None => return Ok(None),
        }
    } else {
        let (path, _) = crate::parser::AchievementParser::achievement_file_for_config(
            &expanded,
            &game_id,
            preset,
        );
        path
    };

    if !target_path.exists() {
        return Ok(None);
    }

    let modified = std::fs::metadata(&target_path)
        .map_err(|e| e.to_string())?
        .modified()
        .map_err(|e| e.to_string())?
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs() as i64;

    Ok(Some(modified))
}

/// Adiciona um diretório para monitoramento
#[tauri::command]
pub async fn add_monitored_directory(
    path: String,
    detection_preset: Option<DirectoryDetectionPreset>,
    state: tauri::State<'_, crate::AppState>,
    app_handle: AppHandle,
) -> Result<Vec<DirectoryConfig>, String> {
    use crate::parser::expand_path;
    let (configs, current_directories) = {
        let mut monitor_lock = state.monitor.lock().map_err(|e| e.to_string())?;
        if let Some(monitor) = &mut *monitor_lock {
            let mut configs = monitor.get_directories();
            let expanded = expand_path(&path);
            let normalized_path = expanded.to_string_lossy().to_string();
            let preset = detection_preset.unwrap_or_default();

            if let Some(existing) = configs.iter_mut().find(|c| c.path == normalized_path && !c.is_default) {
                existing.detection_preset = preset;
                monitor.set_directories(configs.clone());
                monitor.restart_monitoring().map_err(|e| e.to_string())?;
            } else if !configs.iter().any(|c| c.path == normalized_path) {
                configs.push(DirectoryConfig {
                    name: expanded
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("Unknown")
                        .to_string(),
                    path: normalized_path,
                    enabled: true,
                    is_default: false,
                    detection_preset: preset,
                });
                monitor.set_directories(configs.clone());
                monitor.restart_monitoring().map_err(|e| e.to_string())?;
            }
            (configs.clone(), monitor.get_directories())
        } else {
            return Err("Monitor not initialized".to_string());
        }
    };

    let mut settings = load_settings(app_handle.clone()).await.unwrap_or(serde_json::json!({}));
    settings["monitoredConfigs"] = serde_json::to_value(&configs).map_err(|e| e.to_string())?;
    let _ = save_settings(settings, app_handle).await;

    Ok(current_directories)
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

/// Ativa/desativa um diretório para monitoramento
#[tauri::command]
pub async fn toggle_monitored_directory(
    path: String,
    state: tauri::State<'_, crate::AppState>,
    app_handle: AppHandle,
) -> Result<Vec<DirectoryConfig>, String> {
    let (configs, current_directories) = {
        let mut monitor_lock = state.monitor.lock().map_err(|e| e.to_string())?;
        if let Some(monitor) = &mut *monitor_lock {
            let mut configs = monitor.get_directories();
            if let Some(config) = configs.iter_mut().find(|c| c.path == path) {
                config.enabled = !config.enabled;
                monitor.set_directories(configs.clone());
                monitor.restart_monitoring().map_err(|e| e.to_string())?;
            }
            (configs.clone(), monitor.get_directories())
        } else {
            return Err("Monitor not initialized".to_string());
        }
    };

    let mut settings = load_settings(app_handle.clone()).await.unwrap_or(serde_json::json!({}));
    settings["monitoredConfigs"] = serde_json::to_value(&configs).map_err(|e| e.to_string())?;
    let _ = save_settings(settings, app_handle).await;

    Ok(current_directories)
}

/// Solicita os achievements atuais
#[tauri::command]
pub async fn request_achievements(state: tauri::State<'_, crate::AppState>) -> Result<Vec<GameAchievements>, String> {
    let monitor_lock = state.monitor.lock().map_err(|e| e.to_string())?;
    if let Some(monitor) = &*monitor_lock {
        Ok(monitor.get_current_achievements())
    } else {
        Err("Monitor not initialized".to_string())
    }
}

/// Remove um diretório do monitoramento
#[tauri::command]
pub async fn remove_monitored_directory(
    path: String,
    state: tauri::State<'_, crate::AppState>,
    app_handle: AppHandle,
) -> Result<Vec<DirectoryConfig>, String> {
    let (configs, current_directories) = {
        let mut monitor_lock = state.monitor.lock().map_err(|e| e.to_string())?;
        if let Some(monitor) = &mut *monitor_lock {
            let mut configs = monitor.get_directories();
            if let Some(pos) = configs.iter().position(|c| c.path == path && !c.is_default) {
                configs.remove(pos);
                monitor.set_directories(configs.clone());
                monitor.restart_monitoring().map_err(|e| e.to_string())?;
            }
            (configs.clone(), monitor.get_directories())
        } else {
            return Err("Monitor not initialized".to_string());
        }
    };

    let mut settings = load_settings(app_handle.clone()).await.unwrap_or(serde_json::json!({}));
    settings["monitoredConfigs"] = serde_json::to_value(&configs).map_err(|e| e.to_string())?;
    let _ = save_settings(settings, app_handle).await;

    Ok(current_directories)
}

#[tauri::command]
pub async fn set_wine_prefix_path(
    path: String,
    state: tauri::State<'_, crate::AppState>,
    app_handle: AppHandle,
) -> Result<Vec<DirectoryConfig>, String> {
    if !cfg!(target_os = "linux") {
        return Err("Wine prefix path is only available on Linux".to_string());
    }

    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("Wine prefix path cannot be empty".to_string());
    }

    let updated_directories = {
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

        let mut next = build_default_directory_configs(Some(trimmed));
        for dir in &mut next {
            if let Some(enabled) = default_enabled.get(&dir.name) {
                dir.enabled = *enabled;
            }
        }

        next.extend(custom_dirs);
        monitor.set_directories(next.clone());
        monitor.restart_monitoring().map_err(|e| e.to_string())?;
        next
    };

    let mut settings = load_settings(app_handle.clone()).await.unwrap_or(serde_json::json!({}));
    settings["winePrefixPath"] = Value::String(trimmed.to_string());
    settings["monitoredConfigs"] = serde_json::to_value(&updated_directories).map_err(|e| e.to_string())?;
    save_settings(settings, app_handle).await?;

    Ok(updated_directories)
}

/// Retorna os diretórios de conquista para um jogo específico no Linux,
/// resolvendo o prefix Wine per-game automaticamente.
///
/// Sempre usa `~/.config/hydralauncher/wine-prefixes/<game_id>/`, mesmo que
/// ainda não exista, porque o unlock pode criar o arquivo de conquistas inicial.
#[tauri::command]
pub async fn get_game_wine_paths(game_id: String) -> Result<Vec<DirectoryConfig>, String> {
    if !cfg!(target_os = "linux") {
        return Ok(Vec::new());
    }

    use crate::commands::directories::{
        build_wine_prefix_dirs_for_game,
        find_existing_achievement_dirs_for_game_in_prefix,
    };

    let user_data = crate::parser::expand_path("~/.config/hydralauncher");

    // Prefix per-game padrão do Hydra. Para unlock, retornamos todos os
    // diretórios candidatos de cracker dentro do prefix do jogo atual, mesmo
    // que o prefix/arquivo ainda não exista, para permitir criar o export
    // correto no primeiro unlock.
    let per_game = user_data.join("wine-prefixes").join(&game_id);
    return Ok(sort_existing_dirs_first(
        build_wine_prefix_dirs_for_game(&per_game, &game_id),
        find_existing_achievement_dirs_for_game_in_prefix(
            &per_game,
            &game_id,
            &format!("Wine ({})", game_id),
        ),
    ));
}

fn sort_existing_dirs_first(
    mut candidates: Vec<DirectoryConfig>,
    existing: Vec<DirectoryConfig>,
) -> Vec<DirectoryConfig> {
    let existing_paths: std::collections::HashSet<String> =
        existing.into_iter().map(|d| d.path).collect();

    candidates.sort_by(|a, b| {
        let a_exists = existing_paths.contains(&a.path);
        let b_exists = existing_paths.contains(&b.path);
        b_exists.cmp(&a_exists).then_with(|| a.name.cmp(&b.name))
    });

    candidates
}
