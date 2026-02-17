use super::settings::{load_settings, save_settings};
use crate::utils::CacheManager;
use serde_json::Value;
use std::path::PathBuf;
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

#[cfg(target_os = "windows")]
fn find_windows_steam_dll() -> Option<PathBuf> {
    let exe_dir = std::env::current_exe().ok()?.parent()?.to_path_buf();
    let primary = exe_dir.join("steam_api64.dll");
    if primary.exists() {
        return Some(primary);
    }

    let legacy = exe_dir.join("steam_api64_windows_x64.dll");
    if legacy.exists() {
        return Some(legacy);
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

fn find_steam_runtime_library() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        return find_windows_steam_dll();
    }

    #[cfg(target_os = "linux")]
    {
        return find_linux_steam_runtime_library();
    }

    #[allow(unreachable_code)]
    None
}

#[cfg(target_os = "windows")]
fn add_dir_to_windows_path(dir: &std::path::Path) {
    if let Ok(path_var) = std::env::var("PATH") {
        let dir_s = dir.to_string_lossy().to_string();
        let already_in_path = path_var.split(';').any(|entry| entry.eq_ignore_ascii_case(&dir_s));
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

/// Verifica se o Steam está disponível
#[tauri::command]
pub async fn is_steam_available(
    state: tauri::State<'_, crate::AppState>,
    app_handle: AppHandle,
) -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        let settings = load_settings(app_handle.clone()).await.unwrap_or(serde_json::json!({}));
        let (_, manual_dll) = get_saved_steam_manual_paths(&settings);

        let mut dll_path = find_windows_steam_dll();
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
            log::info!("[Steam Integration] Steam DLL detected at: {}", path.display());
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
    let settings = load_settings(app_handle.clone()).await.unwrap_or(serde_json::json!({}));
    let (manual_vdf, manual_runtime_lib) = get_saved_steam_manual_paths(&settings);

    let mut runtime_lib_path = find_steam_runtime_library().map(|p| p.to_string_lossy().to_string());
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
            steam_monitor.get_steam_library_folders().map_err(|e| e.to_string())?
        } else {
            return Err("Steam monitor not initialized".to_string());
        }
    };

    let mut vdf_path: Option<String> = None;
    for folder in folders {
        let candidate = folder.join("steamapps").join("libraryfolders.vdf");
        if candidate.exists() {
            vdf_path = Some(candidate.to_string_lossy().to_string());
            break;
        }
    }
    if vdf_path.is_none() {
        if let Some(saved) = manual_vdf {
            let candidate = PathBuf::from(saved);
            if candidate.exists() {
                vdf_path = Some(candidate.to_string_lossy().to_string());
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
        Some(
            steam_init_error
                .unwrap_or_else(|| "Steamworks initialization failed (Steam client may not be running)".to_string()),
        )
    } else {
        Some("Steam integration unavailable".to_string())
    };

    Ok(serde_json::json!({
        "available": available,
        "runtimeLibPath": runtime_lib_path,
        "vdfPath": vdf_path,
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

    let _ = save_settings(serde_json::json!({ "steamId": user_id.clone() }), app_handle).await;

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
) -> Result<Vec<crate::steam_integration::SteamGame>, String> {
    let steam_lock = state.steam_monitor.lock().map_err(|e| e.to_string())?;
    if let Some(steam_monitor) = &*steam_lock {
        let mut games = steam_monitor.get_steam_games().map_err(|e| e.to_string())?;

        for game in &mut games {
            if let Some(cached) = CacheManager::get_game(&app_handle, &game.game_id) {
                if let Some(total) = cached.achievements_total {
                    game.achievements_total = total as u32;
                }
                if let Some(name) = cached.name {
                    game.name = name;
                }
            }
        }

        Ok(games)
    } else {
        Err("Steam monitor not initialized".to_string())
    }
}

/// Obtém conquistas de um jogo Steam
#[tauri::command]
pub async fn get_steam_game_achievements(
    app_id: u32,
    state: tauri::State<'_, crate::AppState>,
) -> Result<Vec<crate::steam_integration::SteamAchievementData>, String> {
    let steam_lock = state.steam_monitor.lock().map_err(|e| e.to_string())?;
    if let Some(steam_monitor) = &*steam_lock {
        steam_monitor.get_game_achievements(app_id).map_err(|e| e.to_string())
    } else {
        Err("Steam monitor not initialized".to_string())
    }
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
pub async fn detect_steam_games(state: tauri::State<'_, crate::AppState>) -> Result<Vec<String>, String> {
    let steam_lock = state.steam_monitor.lock().map_err(|e| e.to_string())?;
    if let Some(steam_monitor) = &*steam_lock {
        let paths = steam_monitor.detect_installed_games().map_err(|e| e.to_string())?;
        Ok(paths.into_iter().map(|p| p.to_string_lossy().to_string()).collect())
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
            steam_monitor.get_steam_library_folders().map_err(|e| e.to_string())?
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

    let settings = load_settings(app_handle).await.unwrap_or(serde_json::json!({}));
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
            steam_monitor.get_steam_library_folders().map_err(|e| e.to_string())?
        } else {
            return Err("Steam monitor not initialized".to_string());
        }
    };

    for folder in folders {
        let vdf_path = folder.join("steamapps").join("libraryfolders.vdf");
        if vdf_path.exists() {
            let last_modified = std::fs::metadata(&vdf_path)
                .ok()
                .and_then(|m| m.modified().ok())
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_secs() as i64);

            return Ok(serde_json::json!({
                "vdfPath": vdf_path.to_string_lossy().to_string(),
                "lastModified": last_modified
            }));
        }
    }

    let settings = load_settings(app_handle).await.unwrap_or(serde_json::json!({}));
    let (manual_vdf, _) = get_saved_steam_manual_paths(&settings);
    if let Some(saved_path) = manual_vdf {
        let candidate = PathBuf::from(saved_path);
        if candidate.exists() {
            let last_modified = std::fs::metadata(&candidate)
                .ok()
                .and_then(|m| m.modified().ok())
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_secs() as i64);
            return Ok(serde_json::json!({
                "vdfPath": candidate.to_string_lossy().to_string(),
                "lastModified": last_modified
            }));
        }
    }

    Ok(serde_json::json!({
        "vdfPath": null,
        "lastModified": null
    }))
}

/// Obtém o caminho da biblioteca Steam runtime detectada/salva.
#[tauri::command]
pub async fn get_steam_dll_path(app_handle: AppHandle) -> Result<Option<String>, String> {
    if let Some(auto_path) = find_steam_runtime_library() {
        return Ok(Some(auto_path.to_string_lossy().to_string()));
    }

    let settings = load_settings(app_handle).await.unwrap_or(serde_json::json!({}));
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
