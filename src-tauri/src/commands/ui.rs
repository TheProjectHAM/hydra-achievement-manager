use tauri_plugin_dialog::DialogExt;

/// Seleciona uma pasta usando dialog plugin v2
#[tauri::command]
pub async fn pick_folder(app_handle: tauri::AppHandle) -> Result<Option<String>, String> {
    let path = app_handle
        .dialog()
        .file()
        .set_title("Select directory to monitor")
        .blocking_pick_folder();

    Ok(path.and_then(|fp| fp.as_path().map(|p| p.to_string_lossy().to_string())))
}

/// Controles de janela
#[tauri::command]
pub async fn minimize_window(window: tauri::WebviewWindow) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn maximize_window(window: tauri::WebviewWindow) -> Result<(), String> {
    if window.is_maximized().map_err(|e| e.to_string())? {
        window.unmaximize().map_err(|e| e.to_string())
    } else {
        window.maximize().map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub async fn close_window(window: tauri::WebviewWindow) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_window_decorations(
    window: tauri::WebviewWindow,
    decorations: bool,
) -> Result<(), String> {
    window
        .set_decorations(decorations)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn open_devtools(window: tauri::WebviewWindow) {
    #[cfg(debug_assertions)]
    {
        window.open_devtools();
    }
    let _ = window;
}

#[tauri::command]
pub async fn get_window_decoration_info(
    window: tauri::WebviewWindow,
) -> Result<serde_json::Value, String> {
    let decorated = window.is_decorated().map_err(|e| e.to_string())?;
    let session_type = std::env::var("XDG_SESSION_TYPE").ok();
    let current_desktop = std::env::var("XDG_CURRENT_DESKTOP").ok();

    Ok(serde_json::json!({
        "decorated": decorated,
        "sessionType": session_type,
        "currentDesktop": current_desktop,
        "platform": std::env::consts::OS
    }))
}
