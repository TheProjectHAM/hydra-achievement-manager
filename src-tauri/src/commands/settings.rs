use serde_json::Value;
use std::fs;
use tauri::{AppHandle, Manager};

/// Salva configurações
#[tauri::command]
pub async fn save_settings(settings: Value, app_handle: AppHandle) -> Result<(), String> {
    let user_data_path = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app_data_dir: {}", e))?;

    fs::create_dir_all(&user_data_path).map_err(|e| e.to_string())?;

    let settings_path = user_data_path.join("settings.json");

    // Carrega configurações existentes para merge
    let mut final_settings = if settings_path.exists() {
        let existing_data = fs::read_to_string(&settings_path).map_err(|e| e.to_string())?;
        serde_json::from_str::<Value>(&existing_data).unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    // Merge settings
    if let (Some(existing_obj), Some(new_obj)) = (final_settings.as_object_mut(), settings.as_object()) {
        for (k, v) in new_obj {
            existing_obj.insert(k.clone(), v.clone());
        }
    } else {
        final_settings = settings;
    }

    let settings_json = serde_json::to_string_pretty(&final_settings).map_err(|e| e.to_string())?;
    fs::write(&settings_path, settings_json).map_err(|e| e.to_string())?;

    Ok(())
}

/// Carrega configurações
#[tauri::command]
pub async fn load_settings(app_handle: AppHandle) -> Result<Value, String> {
    let user_data_path = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app_data_dir: {}", e))?;
    let settings_path = user_data_path.join("settings.json");

    if settings_path.exists() {
        let settings_data = fs::read_to_string(&settings_path).map_err(|e| e.to_string())?;
        let settings: Value = serde_json::from_str(&settings_data).map_err(|e| e.to_string())?;
        Ok(settings)
    } else {
        Ok(serde_json::json!({}))
    }
}
