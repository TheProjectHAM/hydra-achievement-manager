use crate::utils::settings::{load_settings_value, merge_settings};
use serde_json::Value;
use tauri::AppHandle;

/// Salva configurações
#[tauri::command]
pub async fn save_settings(settings: Value, app_handle: AppHandle) -> Result<(), String> {
    merge_settings(&app_handle, &settings)
}

/// Carrega configurações
#[tauri::command]
pub async fn load_settings(app_handle: AppHandle) -> Result<Value, String> {
    load_settings_value(&app_handle)
}
