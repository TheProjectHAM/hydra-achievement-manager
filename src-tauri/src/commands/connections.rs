use crate::integrations::hydra::{get_hydra_profile, HydraConnectionProfile};
use crate::integrations::steam::{get_steam_profile, SteamConnectionProfile};

#[tauri::command]
pub async fn get_hydra_connection_profile() -> Result<Option<HydraConnectionProfile>, String> {
    get_hydra_profile()
}

#[tauri::command]
pub async fn get_steam_connection_profile() -> Result<Option<SteamConnectionProfile>, String> {
    get_steam_profile()
}
