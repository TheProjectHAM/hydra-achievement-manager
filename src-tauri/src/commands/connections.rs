use crate::integrations::hydra::{get_hydra_profile, HydraConnectionProfile};
use crate::integrations::steam::{get_steam_profile, SteamConnectionProfile};
use crate::utils::settings::load_settings_or_default;
use tauri::AppHandle;

#[tauri::command]
pub async fn get_hydra_connection_profile(app_handle: AppHandle) -> Result<Option<HydraConnectionProfile>, String> {
    let settings = load_settings_or_default(&app_handle);
    let custom_path = settings
        .get("hydraDbPath")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    get_hydra_profile(custom_path.as_deref())
}

#[tauri::command]
pub async fn get_hydra_db_path(app_handle: AppHandle) -> Result<String, String> {
    let settings = load_settings_or_default(&app_handle);
    let custom_path = settings
        .get("hydraDbPath")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty());

    if let Some(path) = custom_path {
        return Ok(crate::parser::expand_path(path).to_string_lossy().to_string());
    }

    dirs::config_dir()
        .map(|dir| dir.join("hydralauncher").join("hydra-db").to_string_lossy().to_string())
        .ok_or_else(|| "Could not resolve Hydra database path".to_string())
}

#[tauri::command]
pub async fn get_steam_connection_profile() -> Result<Option<SteamConnectionProfile>, String> {
    get_steam_profile()
}
