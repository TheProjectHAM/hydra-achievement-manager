use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

pub fn settings_path(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let user_data_path = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app_data_dir: {}", e))?;

    Ok(user_data_path.join("settings.json"))
}

pub fn load_settings_value(app_handle: &AppHandle) -> Result<Value, String> {
    let path = settings_path(app_handle)?;

    if !path.exists() {
        return Ok(serde_json::json!({}));
    }

    let settings_data = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str::<Value>(&settings_data).map_err(|e| e.to_string())
}

pub fn load_settings_or_default(app_handle: &AppHandle) -> Value {
    load_settings_value(app_handle).unwrap_or_else(|_| serde_json::json!({}))
}

pub fn save_settings_value(app_handle: &AppHandle, settings: &Value) -> Result<(), String> {
    let path = settings_path(app_handle)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let settings_json = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    fs::write(&path, settings_json).map_err(|e| e.to_string())
}

pub fn merge_settings(app_handle: &AppHandle, patch: &Value) -> Result<(), String> {
    let mut final_settings = load_settings_or_default(app_handle);

    if let (Some(existing_obj), Some(new_obj)) = (final_settings.as_object_mut(), patch.as_object()) {
        for (key, value) in new_obj {
            existing_obj.insert(key.clone(), value.clone());
        }
    } else {
        final_settings = patch.clone();
    }

    save_settings_value(app_handle, &final_settings)
}
