use super::language::{map_ui_language_to_hydra_lang, map_ui_language_to_steam_store_lang};
use super::settings::{load_settings, save_settings};
use crate::integrations::hydra::HydraApi;
use crate::integrations::steam::SteamWebApi;
use crate::integrations::steam::{SteamAchievementData, SteamGame};
use crate::utils::CacheManager;
use serde_json::Value;
use std::collections::HashMap;
use std::path::PathBuf;
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

#[cfg(target_os = "windows")]
fn find_windows_steam_dll(app_handle: Option<&AppHandle>) -> Option<PathBuf> {
    let exe_dir = std::env::current_exe().ok()?.parent()?.to_path_buf();
    let primary = exe_dir.join("steam_api64.dll");
    if primary.exists() {
        return Some(primary);
    }

    let legacy = exe_dir.join("steam_api64_windows_x64.dll");
    if legacy.exists() {
        return Some(legacy);
    }

    if let Some(app_handle) = app_handle {
        if let Ok(resource_dir) = tauri::Manager::path(app_handle).resource_dir() {
            let resource = resource_dir.join("steam_api64.dll");
            if resource.exists() {
                return Some(resource);
            }
        }
    }

    None
}

#[cfg(target_os = "linux")]
fn find_linux_steam_runtime_library() -> Option<PathBuf> {
    let mut candidates: Vec<PathBuf> = Vec::new();

    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            candidates.push(dir.join("libsteam_api.so"));
        }
    }

    if let Ok(ld_path) = std::env::var("LD_LIBRARY_PATH") {
        for dir in ld_path.split(':') {
            if dir.is_empty() {
                continue;
            }
            candidates.push(PathBuf::from(dir).join("libsteam_api.so"));
        }
    }

    candidates.push(PathBuf::from("/usr/lib/libsteam_api.so"));
    candidates.push(PathBuf::from("/usr/lib64/libsteam_api.so"));
    candidates.push(PathBuf::from("/usr/lib/x86_64-linux-gnu/libsteam_api.so"));
    candidates.push(PathBuf::from("/lib/x86_64-linux-gnu/libsteam_api.so"));
    candidates.push(PathBuf::from("/usr/local/lib/libsteam_api.so"));

    candidates.into_iter().find(|p| p.exists())
}

fn find_steam_runtime_library(app_handle: Option<&AppHandle>) -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        return find_windows_steam_dll(app_handle);
    }

    #[cfg(target_os = "linux")]
    {
        let _ = app_handle;
        return find_linux_steam_runtime_library();
    }

    #[allow(unreachable_code)]
    None
}

#[cfg(target_os = "windows")]
fn add_dir_to_windows_path(dir: &std::path::Path) {
    if let Ok(path_var) = std::env::var("PATH") {
        let dir_s = dir.to_string_lossy().to_string();
        let already_in_path = path_var
            .split(';')
            .any(|entry| entry.eq_ignore_ascii_case(&dir_s));
        if !already_in_path {
            std::env::set_var("PATH", format!("{};{}", dir_s, path_var));
            log::info!("[Steam Integration] Added '{}' to PATH", dir.display());
        }
    }
}

fn get_saved_steam_manual_paths(settings: &Value) -> (Option<String>, Option<String>) {
    let vdf = settings
        .get("steamManualVdfPath")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let dll = settings
        .get("steamManualDllPath")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    (vdf, dll)
}

fn steam_library_entries(folders: Vec<PathBuf>) -> Vec<Value> {
    folders
        .into_iter()
        .filter_map(|folder| {
            let vdf_path = folder.join("steamapps").join("libraryfolders.vdf");
            let last_modified = std::fs::metadata(&vdf_path)
                .ok()
                .and_then(|m| m.modified().ok())
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_secs() as i64);

            if folder.exists() {
                Some(serde_json::json!({
                    "path": folder.to_string_lossy().to_string(),
                    "vdfPath": if vdf_path.exists() { Some(vdf_path.to_string_lossy().to_string()) } else { None },
                    "lastModified": last_modified,
                }))
            } else {
                None
            }
        })
        .collect()
}

async fn enrich_steam_achievement_metadata(
    app_id: u32,
    achievements: &mut [SteamAchievementData],
    app_handle: AppHandle,
) {
    let settings = load_settings(app_handle)
        .await
        .unwrap_or_else(|_| serde_json::json!({}));
    let steam_api_key = settings
        .get("steamApiKey")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let steam_id = settings
        .get("steamId")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let language = settings
        .get("language")
        .and_then(|v| v.as_str())
        .unwrap_or("en-US");

    if !steam_api_key.is_empty() {
        match SteamWebApi::get_game_achievements(
            app_id,
            steam_api_key,
            map_ui_language_to_steam_store_lang(language),
        )
        .await
        {
            Ok(metadata) => {
                if metadata.is_empty() {
                    log::warn!(
                        "Steam metadata for app {} returned zero achievements; Hydra fallback will be attempted.",
                        app_id
                    );
                }

                let metadata_by_name: HashMap<_, _> = metadata
                    .into_iter()
                    .map(|ach| (ach.apiname.clone(), ach))
                    .collect();

                let mut matched = 0usize;
                let mut missing_meta = 0usize;

                for achievement in achievements.iter_mut() {
                    let achievement_key = if !achievement.apiname.is_empty() {
                        &achievement.apiname
                    } else {
                        &achievement.name
                    };

                    if let Some(meta) = metadata_by_name.get(achievement_key) {
                        matched += 1;
                        if let Some(display_name) = &meta.name {
                            if !display_name.trim().is_empty() {
                                achievement.display_name = display_name.clone();
                            }
                        }
                        if let Some(description) = &meta.description {
                            if !description.trim().is_empty() {
                                achievement.description = description.clone();
                            }
                        }
                        if let Some(icon) = &meta.icon {
                            if !icon.trim().is_empty() {
                                achievement.icon = icon.clone();
                            }
                        }
                        if let Some(icon_gray) = &meta.icongray {
                            if !icon_gray.trim().is_empty() {
                                achievement.icon_gray = icon_gray.clone();
                            }
                        }
                    } else {
                        missing_meta += 1;
                    }
                }

                if missing_meta > 0 {
                    log::warn!(
                        "Steam metadata for app {} was incomplete: {} achievements had no schema match; Hydra fallback will fill missing fields where possible.",
                        app_id,
                        missing_meta
                    );
                }
                if matched == 0 && !achievements.is_empty() {
                    log::warn!(
                        "Steam metadata for app {} did not match any achievements. Check if the achievement names use Steam apiname values; Hydra fallback will be attempted.",
                        app_id
                    );
                }

                if !steam_id.is_empty() {
                    match SteamWebApi::get_player_achievements(app_id, steam_api_key, steam_id)
                        .await
                    {
                        Ok(player_achievements) => {
                            let unlock_times: HashMap<_, _> = player_achievements
                                .into_iter()
                                .map(|ach| (ach.apiname, ach.unlocktime))
                                .collect();

                            let mut unlocked_count = 0usize;
                            for achievement in achievements.iter_mut() {
                                let achievement_key = if !achievement.apiname.is_empty() {
                                    &achievement.apiname
                                } else {
                                    &achievement.name
                                };

                                if let Some(unlock_time) = unlock_times.get(achievement_key) {
                                    if *unlock_time > 0 {
                                        achievement.unlock_time = *unlock_time as u32;
                                        unlocked_count += 1;
                                    }
                                }
                            }

                            log::debug!(
                                "Steam player status merge for app {} applied unlock times to {} achievements",
                                app_id,
                                unlocked_count
                            );
                        }
                        Err(error) => {
                            log::warn!(
                                "Steam player achievements for app {} could not be fetched: {}",
                                app_id,
                                error
                            );
                        }
                    }
                }
            }
            Err(error) => {
                log::warn!(
                    "Steam metadata fetch failed for app {}: {}. Hydra fallback will be attempted.",
                    app_id,
                    error
                );
            }
        }
    }

    match HydraApi::get_game_achievements(
        &app_id.to_string(),
        Some(map_ui_language_to_hydra_lang(language)),
    )
    .await
    {
        Ok(metadata) => {
            let metadata_by_name: HashMap<_, _> = metadata
                .achievements
                .into_iter()
                .map(|ach| (ach.name.clone(), ach))
                .collect();

            for achievement in achievements.iter_mut() {
                let metadata_key = if !achievement.apiname.is_empty() {
                    &achievement.apiname
                } else {
                    &achievement.name
                };

                if let Some(meta) = metadata_by_name.get(metadata_key) {
                    if achievement.display_name.trim().is_empty() {
                        achievement.display_name = meta.display_name.clone();
                    }
                    if achievement.description.trim().is_empty() {
                        achievement.description = meta.description.clone();
                    }
                    if achievement.icon.trim().is_empty() {
                        achievement.icon = meta.icon.clone();
                    }
                    if achievement.icon_gray.trim().is_empty() {
                        achievement.icon_gray = meta.icongray.clone();
                    }
                }
            }
        }
        Err(error) => {
            log::warn!(
                "Hydra metadata fallback failed for app {}: {}",
                app_id,
                error
            );
        }
    }
}

/// Verifica se o Steam está disponível
#[tauri::command]
pub async fn is_steam_available(
    state: tauri::State<'_, crate::AppState>,
    app_handle: AppHandle,
) -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        let settings = load_settings(app_handle.clone())
            .await
            .unwrap_or(serde_json::json!({}));
        let (_, manual_dll) = get_saved_steam_manual_paths(&settings);

        let mut dll_path = find_windows_steam_dll(Some(&app_handle));
        if dll_path.is_none() {
            if let Some(saved_path) = manual_dll {
                let candidate = PathBuf::from(saved_path);
                if candidate.exists() {
                    dll_path = Some(candidate);
                }
            }
        }

        if dll_path.is_none() {
            log::warn!("[Steam Integration] steam_api64.dll not found in app install folder (exe directory)");
            return Ok(false);
        }

        if let Some(path) = dll_path {
            log::info!(
                "[Steam Integration] Steam DLL detected at: {}",
                path.display()
            );
            if let Some(parent) = path.parent() {
                add_dir_to_windows_path(parent);
            }
        }
    }
    #[cfg(not(target_os = "windows"))]
    let _ = &app_handle;

    let steam_lock = state.steam_monitor.lock().map_err(|e| e.to_string())?;
    if let Some(steam_monitor) = &*steam_lock {
        let mut initialized_here = false;
        if !steam_monitor.is_enabled() {
            steam_monitor.initialize().map_err(|e| e.to_string())?;
            initialized_here = true;
        }
        let available = steam_monitor.is_enabled();
        if initialized_here && available {
            let _ = steam_monitor.shutdown();
        }
        return Ok(available);
    }
    Err("Steam monitor not initialized".to_string())
}

/// Retorna diagnóstico detalhado da integração Steam para exibir na UI.
#[tauri::command]
pub async fn get_steam_availability_details(
    state: tauri::State<'_, crate::AppState>,
    app_handle: AppHandle,
) -> Result<Value, String> {
    let settings = load_settings(app_handle.clone())
        .await
        .unwrap_or(serde_json::json!({}));
    let (manual_vdf, manual_runtime_lib) = get_saved_steam_manual_paths(&settings);

    let mut runtime_lib_path =
        find_steam_runtime_library(Some(&app_handle)).map(|p| p.to_string_lossy().to_string());
    if runtime_lib_path.is_none() {
        if let Some(saved) = manual_runtime_lib {
            let candidate = PathBuf::from(saved);
            if candidate.exists() {
                runtime_lib_path = Some(candidate.to_string_lossy().to_string());
            }
        }
    }

    #[cfg(target_os = "windows")]
    if let Some(path) = &runtime_lib_path {
        if let Some(parent) = PathBuf::from(path).parent() {
            add_dir_to_windows_path(parent);
        }
    }

    let folders = {
        let steam_lock = state.steam_monitor.lock().map_err(|e| e.to_string())?;
        if let Some(steam_monitor) = &*steam_lock {
            steam_monitor
                .get_steam_library_folders()
                .map_err(|e| e.to_string())?
        } else {
            return Err("Steam monitor not initialized".to_string());
        }
    };

    let mut libraries = steam_library_entries(folders);
    let mut vdf_path = libraries.iter().find_map(|library| {
        library
            .get("vdfPath")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
    });
    if vdf_path.is_none() {
        if let Some(saved) = manual_vdf {
            let candidate = PathBuf::from(saved);
            if candidate.exists() {
                vdf_path = Some(candidate.to_string_lossy().to_string());
                let library_path = candidate
                    .parent()
                    .and_then(|p| p.parent())
                    .map(|p| p.to_string_lossy().to_string());
                libraries.push(serde_json::json!({
                    "path": library_path,
                    "vdfPath": candidate.to_string_lossy().to_string(),
                    "lastModified": std::fs::metadata(&candidate)
                        .ok()
                        .and_then(|m| m.modified().ok())
                        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                        .map(|d| d.as_secs() as i64),
                    "manual": true,
                }));
            }
        }
    }

    let (steam_initialized, steam_init_error) = {
        let steam_lock = state.steam_monitor.lock().map_err(|e| e.to_string())?;
        if let Some(steam_monitor) = &*steam_lock {
            let mut initialized_here = false;
            if !steam_monitor.is_enabled() {
                steam_monitor.initialize().map_err(|e| e.to_string())?;
                initialized_here = true;
            }
            let enabled = steam_monitor.is_enabled();
            let last_error = steam_monitor.get_last_init_error();
            if initialized_here && enabled {
                let _ = steam_monitor.shutdown();
            }
            (enabled, last_error)
        } else {
            return Err("Steam monitor not initialized".to_string());
        }
    };

    let available = if cfg!(target_os = "windows") {
        runtime_lib_path.is_some() && steam_initialized
    } else {
        steam_initialized
    };

    let reason = if available {
        None
    } else if cfg!(target_os = "windows") && runtime_lib_path.is_none() {
        Some("Steam runtime library not found in install folder or configured path".to_string())
    } else if !steam_initialized {
        Some(steam_init_error.unwrap_or_else(|| {
            "Steamworks initialization failed (Steam client may not be running)".to_string()
        }))
    } else {
        Some("Steam integration unavailable".to_string())
    };

    Ok(serde_json::json!({
        "available": available,
        "runtimeLibPath": runtime_lib_path,
        "vdfPath": vdf_path,
        "libraries": libraries,
        "steamworksInitialized": steam_initialized,
        "reason": reason
    }))
}

/// Obtém informações do usuário Steam
#[tauri::command]
pub async fn get_steam_user_info(
    state: tauri::State<'_, crate::AppState>,
    app_handle: AppHandle,
) -> Result<serde_json::Value, String> {
    let (user_id, user_name) = {
        let steam_lock = state.steam_monitor.lock().map_err(|e| e.to_string())?;
        if let Some(steam_monitor) = &*steam_lock {
            let mut initialized_here = false;
            if !steam_monitor.is_enabled() {
                steam_monitor.initialize().map_err(|e| e.to_string())?;
                if !steam_monitor.is_enabled() {
                    return Err("Steam integration not available or Steam not running".to_string());
                }
                initialized_here = true;
            }

            let info = steam_monitor.get_user_info().map_err(|e| e.to_string())?;
            if initialized_here {
                let _ = steam_monitor.shutdown();
            }
            info
        } else {
            return Err("Steam monitor not initialized".to_string());
        }
    };

    let _ = save_settings(
        serde_json::json!({ "steamId": user_id.clone() }),
        app_handle,
    )
    .await;

    Ok(serde_json::json!({
        "userId": user_id,
        "userName": user_name
    }))
}

/// Obtém jogos Steam do usuário
#[tauri::command]
pub async fn get_steam_games(
    state: tauri::State<'_, crate::AppState>,
    app_handle: AppHandle,
) -> Result<Vec<SteamGame>, String> {
    let mut games = {
        let steam_lock = state.steam_monitor.lock().map_err(|e| e.to_string())?;
        if let Some(steam_monitor) = &*steam_lock {
            steam_monitor.get_steam_games().map_err(|e| e.to_string())?
        } else {
            return Err("Steam monitor not initialized".to_string());
        }
    };

    let settings = load_settings(app_handle.clone())
        .await
        .unwrap_or_else(|_| serde_json::json!({}));
    let use_steam_api = matches!(
        settings
            .get("steamAchievementSource")
            .and_then(|v| v.as_str()),
        Some("steamapi") | Some("api")
    );
    let steam_api_key = settings
        .get("steamApiKey")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    let saved_steam_id = settings
        .get("steamId")
        .and_then(|v| v.as_str())
        .and_then(SteamWebApi::normalize_steam_id)
        .unwrap_or_default();

    let active_steam_id = if use_steam_api {
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

            id.and_then(|id| SteamWebApi::normalize_steam_id(&id))
        } else {
            None
        }
    } else {
        None
    };

    let mut steam_id = active_steam_id.unwrap_or_else(|| saved_steam_id.clone());

    if use_steam_api && steam_id.is_empty() {
        if let Ok(Some(profile)) = crate::integrations::steam::get_steam_profile() {
            steam_id =
                SteamWebApi::normalize_steam_id(&profile.steam_id64).unwrap_or(profile.steam_id64);
        }
    }

    if use_steam_api && !steam_id.is_empty() && steam_id != saved_steam_id {
        let _ = save_settings(
            serde_json::json!({ "steamId": steam_id.clone() }),
            app_handle.clone(),
        )
        .await;
    }

    for game in &mut games {
        if let Some(cached) = CacheManager::get_game(&app_handle, &game.game_id) {
            if let Some(total) = cached.achievements_total {
                game.achievements_total = total as u32;
            }
            if let Some(name) = cached.name {
                game.name = name;
            }
        }

        if use_steam_api && !steam_api_key.is_empty() && !steam_id.is_empty() {
            if let Ok(app_id) = game.game_id.parse::<u32>() {
                let player_result = match SteamWebApi::get_player_achievements(
                    app_id,
                    &steam_api_key,
                    &steam_id,
                )
                .await
                {
                    Ok(player_achievements) => Ok(player_achievements),
                    Err(error) => {
                        if SteamWebApi::is_player_achievements_forbidden(&error) {
                            log::info!(
                                "Steam Web API counters unavailable for app {} because player achievements are private/forbidden",
                                app_id
                            );
                        } else {
                            log::warn!(
                                "Steam Web API counters failed for app {} ({}).",
                                app_id,
                                error
                            );
                        }
                        Err(error)
                    }
                };

                match player_result {
                    Ok(player_achievements) => {
                        if !player_achievements.is_empty() {
                            let unlocked_count = player_achievements
                                .iter()
                                .filter(|achievement| achievement.achieved > 0)
                                .count() as u32;
                            log::info!(
                                "Steam Web API counters for app {}: {}/{} unlocked",
                                app_id,
                                unlocked_count,
                                player_achievements.len()
                            );
                            game.achievements_current = unlocked_count;
                            game.achievements_total = game
                                .achievements_total
                                .max(player_achievements.len() as u32);
                        }
                    }
                    Err(error) => {
                        if SteamWebApi::is_player_achievements_forbidden(&error) {
                            log::info!(
                                "Steam Web API did not return player counters for app {} due to forbidden/private player data",
                                app_id
                            );
                        } else {
                            log::warn!(
                                "Failed to fetch Steam Web API achievement counters for app {}: {}",
                                app_id,
                                error
                            );
                        }
                    }
                }
            }
        }
    }

    Ok(games)
}

/// Obtém conquistas de um jogo Steam
#[tauri::command]
pub async fn get_steam_game_achievements(
    app_id: u32,
    state: tauri::State<'_, crate::AppState>,
    app_handle: AppHandle,
) -> Result<Vec<SteamAchievementData>, String> {
    let result = {
        let steam_lock = state.steam_monitor.lock().map_err(|e| e.to_string())?;
        if let Some(steam_monitor) = &*steam_lock {
            let result = (|| -> Result<Vec<SteamAchievementData>, String> {
                steam_monitor.initialize().map_err(|e| e.to_string())?;
                if !steam_monitor.is_enabled() {
                    return Err("Steam integration not available or Steam not running".to_string());
                }

                steam_monitor
                    .switch_app_id(app_id)
                    .map_err(|e| e.to_string())?;
                steam_monitor
                    .get_game_achievements(app_id)
                    .map_err(|e| e.to_string())
            })();

            let _ = steam_monitor.shutdown();
            result
        } else {
            Err("Steam monitor not initialized".to_string())
        }
    };

    let mut achievements = result?;
    enrich_steam_achievement_metadata(app_id, &mut achievements, app_handle).await;
    Ok(achievements)
}

/// Define o estado de uma conquista Steam
#[tauri::command]
pub async fn set_steam_achievement(
    achievement_name: String,
    unlocked: bool,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), String> {
    let steam_lock = state.steam_monitor.lock().map_err(|e| e.to_string())?;
    if let Some(steam_monitor) = &*steam_lock {
        steam_monitor
            .set_achievement(&achievement_name, unlocked)
            .map_err(|e| e.to_string())
    } else {
        Err("Steam monitor not initialized".to_string())
    }
}

/// Detecta jogos Steam instalados
#[tauri::command]
pub async fn detect_steam_games(
    state: tauri::State<'_, crate::AppState>,
) -> Result<Vec<String>, String> {
    let steam_lock = state.steam_monitor.lock().map_err(|e| e.to_string())?;
    if let Some(steam_monitor) = &*steam_lock {
        let paths = steam_monitor
            .detect_installed_games()
            .map_err(|e| e.to_string())?;
        Ok(paths
            .into_iter()
            .map(|p| p.to_string_lossy().to_string())
            .collect())
    } else {
        Err("Steam monitor not initialized".to_string())
    }
}

/// Detecta o caminho da biblioteca Steam (.dll ou .so)
#[tauri::command]
pub async fn get_steam_library_path(
    state: tauri::State<'_, crate::AppState>,
    app_handle: AppHandle,
) -> Result<Option<String>, String> {
    let folders = {
        let steam_lock = state.steam_monitor.lock().map_err(|e| e.to_string())?;
        if let Some(steam_monitor) = &*steam_lock {
            steam_monitor
                .get_steam_library_folders()
                .map_err(|e| e.to_string())?
        } else {
            return Err("Steam monitor not initialized".to_string());
        }
    };

    for folder in folders {
        let vdf_path = folder.join("steamapps").join("libraryfolders.vdf");
        if vdf_path.exists() {
            return Ok(Some(vdf_path.to_string_lossy().to_string()));
        }
    }

    let settings = load_settings(app_handle)
        .await
        .unwrap_or(serde_json::json!({}));
    let (manual_vdf, _) = get_saved_steam_manual_paths(&settings);
    if let Some(saved_path) = manual_vdf {
        let candidate = PathBuf::from(saved_path);
        if candidate.exists() {
            return Ok(Some(candidate.to_string_lossy().to_string()));
        }
    }

    Ok(None)
}

/// Obtém informações do libraryfolders.vdf da Steam detectado.
#[tauri::command]
pub async fn get_steam_library_info(
    state: tauri::State<'_, crate::AppState>,
    app_handle: AppHandle,
) -> Result<Value, String> {
    let folders = {
        let steam_lock = state.steam_monitor.lock().map_err(|e| e.to_string())?;
        if let Some(steam_monitor) = &*steam_lock {
            steam_monitor
                .get_steam_library_folders()
                .map_err(|e| e.to_string())?
        } else {
            return Err("Steam monitor not initialized".to_string());
        }
    };

    let mut libraries = steam_library_entries(folders);
    let mut vdf_path = libraries.iter().find_map(|library| {
        library
            .get("vdfPath")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
    });
    let mut last_modified = libraries
        .iter()
        .find_map(|library| library.get("lastModified").and_then(|v| v.as_i64()));

    let settings = load_settings(app_handle)
        .await
        .unwrap_or(serde_json::json!({}));
    let (manual_vdf, _) = get_saved_steam_manual_paths(&settings);
    if vdf_path.is_none() {
        if let Some(saved_path) = manual_vdf {
            let candidate = PathBuf::from(saved_path);
            if candidate.exists() {
                last_modified = std::fs::metadata(&candidate)
                    .ok()
                    .and_then(|m| m.modified().ok())
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_secs() as i64);
                vdf_path = Some(candidate.to_string_lossy().to_string());
                let library_path = candidate
                    .parent()
                    .and_then(|p| p.parent())
                    .map(|p| p.to_string_lossy().to_string());
                libraries.push(serde_json::json!({
                    "path": library_path,
                    "vdfPath": candidate.to_string_lossy().to_string(),
                    "lastModified": last_modified,
                    "manual": true,
                }));
            }
        }
    }

    Ok(serde_json::json!({
        "vdfPath": vdf_path,
        "lastModified": last_modified,
        "libraries": libraries
    }))
}

/// Obtém o caminho da biblioteca Steam runtime detectada/salva.
#[tauri::command]
pub async fn get_steam_dll_path(app_handle: AppHandle) -> Result<Option<String>, String> {
    if let Some(auto_path) = find_steam_runtime_library(Some(&app_handle)) {
        return Ok(Some(auto_path.to_string_lossy().to_string()));
    }

    let settings = load_settings(app_handle)
        .await
        .unwrap_or(serde_json::json!({}));
    let (_, manual_dll) = get_saved_steam_manual_paths(&settings);
    if let Some(saved_path) = manual_dll {
        let candidate = PathBuf::from(saved_path);
        if candidate.exists() {
            return Ok(Some(candidate.to_string_lossy().to_string()));
        }
    }

    Ok(None)
}

/// Seleciona manualmente o arquivo libraryfolders.vdf.
#[tauri::command]
pub async fn pick_steam_vdf_file(app_handle: AppHandle) -> Result<Option<String>, String> {
    let path = app_handle
        .dialog()
        .file()
        .set_title("Select Steam libraryfolders.vdf")
        .add_filter("VDF file", &["vdf"])
        .blocking_pick_file();

    Ok(path.and_then(|fp| fp.as_path().map(|p| p.to_string_lossy().to_string())))
}

/// Seleciona manualmente o arquivo da biblioteca Steam runtime.
#[tauri::command]
pub async fn pick_steam_dll_file(app_handle: AppHandle) -> Result<Option<String>, String> {
    #[cfg(target_os = "windows")]
    let path = app_handle
        .dialog()
        .file()
        .set_title("Select steam_api64.dll")
        .add_filter("DLL file", &["dll"])
        .blocking_pick_file();

    #[cfg(target_os = "linux")]
    let path = app_handle
        .dialog()
        .file()
        .set_title("Select libsteam_api.so")
        .add_filter("SO file", &["so"])
        .blocking_pick_file();

    #[cfg(not(any(target_os = "windows", target_os = "linux")))]
    let path = app_handle
        .dialog()
        .file()
        .set_title("Select Steam runtime library")
        .blocking_pick_file();

    Ok(path.and_then(|fp| fp.as_path().map(|p| p.to_string_lossy().to_string())))
}
