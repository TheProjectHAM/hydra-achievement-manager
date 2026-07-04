use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

use crate::utils::secrets;

pub fn settings_path(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let user_data_path = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app_data_dir: {}", e))?;

    Ok(user_data_path.join("settings.json"))
}

pub fn load_settings_value(app_handle: &AppHandle) -> Result<Value, String> {
    let path = settings_path(app_handle)?;

    let raw_settings = if !path.exists() {
        serde_json::json!({})
    } else {
        let settings_data = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        serde_json::from_str::<Value>(&settings_data).map_err(|e| e.to_string())?
    };

    // Migrate any plaintext secrets to keyring on first load
    let mut settings = secrets::migrate_plaintext_secrets(&raw_settings, &path)?;

    // Inject secrets from keyring into the settings object
    secrets::inject_secrets(&mut settings)?;

    Ok(settings)
}

pub fn load_settings_or_default(app_handle: &AppHandle) -> Value {
    load_settings_value(app_handle).unwrap_or_else(|_| serde_json::json!({}))
}

pub fn save_settings_value(app_handle: &AppHandle, settings: &Value) -> Result<(), String> {
    let path = settings_path(app_handle)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    // Extract secrets and store them in the keyring
    let clean_settings = secrets::extract_and_store_secrets(settings)?;

    let settings_json = serde_json::to_string_pretty(&clean_settings).map_err(|e| e.to_string())?;
    fs::write(&path, settings_json).map_err(|e| e.to_string())
}

pub fn merge_settings(app_handle: &AppHandle, patch: &Value) -> Result<(), String> {
    let mut final_settings = load_settings_or_default(app_handle);

    if let (Some(existing_obj), Some(new_obj)) = (final_settings.as_object_mut(), patch.as_object())
    {
        for (key, value) in new_obj {
            existing_obj.insert(key.clone(), value.clone());
        }
    } else {
        final_settings = patch.clone();
    }

    save_settings_value(app_handle, &final_settings)
}
