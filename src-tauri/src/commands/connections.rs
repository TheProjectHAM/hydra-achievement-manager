use crate::connections::{
    get_hydra_profile, get_steam_profile, HydraConnectionProfile, SteamConnectionProfile,
};

#[tauri::command]
pub async fn get_hydra_connection_profile() -> Result<Option<HydraConnectionProfile>, String> {
    get_hydra_profile()
}

#[tauri::command]
pub async fn get_steam_connection_profile() -> Result<Option<SteamConnectionProfile>, String> {
    get_steam_profile()
}
