use crate::utils::CacheManager;

/// Obtém o tamanho do cache
#[tauri::command]
pub async fn get_cache_size(app_handle: tauri::AppHandle) -> Result<String, String> {
    match CacheManager::get_cache_size(&app_handle) {
        Ok(size) => {
            if size < 1024 {
                Ok(format!("{} B", size))
            } else if size < 1024 * 1024 {
                Ok(format!("{:.2} KB", size as f64 / 1024.0))
            } else {
                Ok(format!("{:.2} MB", size as f64 / (1024.0 * 1024.0)))
            }
        }
        Err(e) => Err(e.to_string()),
    }
}

/// Limpa o cache
#[tauri::command]
pub async fn clear_cache(app_handle: tauri::AppHandle) -> Result<(), String> {
    CacheManager::clear_cache(&app_handle).map_err(|e| e.to_string())
}

/// Obtém informações do sistema
#[tauri::command]
pub async fn get_system_info() -> Result<serde_json::Value, String> {
    use sysinfo::System;

    let mut sys = System::new_all();

    sys.refresh_all();

    let cpu_name = sys
        .cpus()
        .first()
        .map(|cpu| cpu.brand().to_string())
        .unwrap_or_else(|| "Unknown CPU".to_string());

    let total_memory = sys.total_memory();
    let memory_gb = total_memory as f64 / (1024.0 * 1024.0 * 1024.0);

    let os_info = format!(
        "{} {}",
        System::name().unwrap_or_default(),
        System::os_version().unwrap_or_default()
    );

    Ok(serde_json::json!({
        "cpu": cpu_name,
        "ram": format!("{:.1} GB", memory_gb),
        "os": os_info
    }))
}
