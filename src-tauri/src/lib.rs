// Módulos
pub mod api;
pub mod commands;
pub mod models;
pub mod monitor;
pub mod parser;
pub mod steam_integration;
pub mod steam_monitor;
pub mod unlocker;
pub mod utils;

use monitor::AchievementMonitor;
use std::sync::Mutex;
use steam_monitor::SteamMonitor;
use tauri::Manager;

// Estado global do monitor
pub struct AppState {
    pub monitor: Mutex<Option<AchievementMonitor>>,
    pub steam_monitor: Mutex<Option<SteamMonitor>>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .targets([
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir {
                        file_name: None,
                    }),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Webview),
                ])
                .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepAll)
                .level(log::LevelFilter::Info)
                .build(),
        )
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            log::info!("Application initializing...");

            // Adiciona o diretório de recursos e recursos/src ao caminho de busca de DLLs/Libs
            let resource_dir = app
                .path()
                .resource_dir()
                .unwrap_or_else(|_| std::env::current_dir().unwrap_or_default());
            let src_lib_path = resource_dir.join("src");

            #[cfg(target_os = "windows")]
            {
                if let Ok(path) = std::env::var("PATH") {
                    let new_path = format!(
                        "{};{};{}",
                        resource_dir.to_string_lossy(),
                        src_lib_path.to_string_lossy(),
                        path
                    );
                    std::env::set_var("PATH", new_path);
                    log::info!(
                        "Added {} and {} to PATH",
                        resource_dir.display(),
                        src_lib_path.display()
                    );
                }
            }
            #[cfg(not(target_os = "windows"))]
            {
                let current_ld = std::env::var("LD_LIBRARY_PATH").unwrap_or_default();
                let new_path = if current_ld.is_empty() {
                    format!(
                        "{}:{}",
                        resource_dir.to_string_lossy(),
                        src_lib_path.to_string_lossy()
                    )
                } else {
                    format!(
                        "{}:{}:{}",
                        resource_dir.to_string_lossy(),
                        src_lib_path.to_string_lossy(),
                        current_ld
                    )
                };
                std::env::set_var("LD_LIBRARY_PATH", new_path);
                log::info!(
                    "Added {} and {} to LD_LIBRARY_PATH",
                    resource_dir.display(),
                    src_lib_path.display()
                );
            }

            // Cleanup old logs (keep last 3 days)
            if let Ok(log_dir) = app.path().app_log_dir() {
                if let Ok(entries) = std::fs::read_dir(&log_dir) {
                    let now = std::time::SystemTime::now();
                    for entry in entries.flatten() {
                        if let Ok(metadata) = entry.metadata() {
                            if let Ok(modified) = metadata.modified() {
                                if let Ok(duration) = now.duration_since(modified) {
                                    if duration.as_secs() > 3 * 24 * 60 * 60 {
                                        let _ = std::fs::remove_file(entry.path());
                                        log::info!("Cleaned up old log file: {:?}", entry.path());
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Força o tamanho da janela na inicialização
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize {
                    width: 1366.0,
                    height: 768.0,
                }));
                let _ = window.center();
            }

            use crate::models::DirectoryConfig;

            // Carrega configurações
            let app_handle = app.handle().clone();
            let user_data_path = app_handle.path().app_data_dir().unwrap_or_default();
            let settings_path = user_data_path.join("settings.json");

            let mut loaded_settings: Option<serde_json::Value> = None;
            if settings_path.exists() {
                if let Ok(settings_data) = std::fs::read_to_string(&settings_path) {
                    loaded_settings = serde_json::from_str::<serde_json::Value>(&settings_data).ok();
                }
            }

            let saved_wine_prefix = loaded_settings
                .as_ref()
                .and_then(|s| s.get("winePrefixPath"))
                .and_then(|v| v.as_str())
                .map(|v| v.to_string());

            let mut monitored_configs: Vec<DirectoryConfig> =
                crate::commands::build_default_directory_configs(saved_wine_prefix.as_deref());

            if let Some(settings) = &loaded_settings {
                if let Some(configs_val) = settings.get("monitoredConfigs").and_then(|v| v.as_array())
                {
                    let saved_configs: Vec<DirectoryConfig> = configs_val
                        .iter()
                        .filter_map(|v| serde_json::from_value(v.clone()).ok())
                        .collect();

                    // Mescla configurações salvas com defaults (preservando o estado enabled das defaults)
                    for mut saved in saved_configs {
                        // Auto-fix legacy wine paths on Windows
                        if cfg!(target_os = "windows") && saved.path.contains(".wine/drive_c") {
                            if let Some(suffix_start) = saved.path.find("drive_c/") {
                                let suffix = &saved.path[suffix_start + 8..];
                                saved.path = format!("C:/{}", suffix);
                            }
                        }

                        if let Some(existing) = monitored_configs.iter_mut().find(|c| c.path == saved.path)
                        {
                            existing.enabled = saved.enabled;
                        } else if !saved.is_default {
                            monitored_configs.push(saved);
                        }
                    }
                }
            }

            // Cria monitor de achievements
            let mut monitor = AchievementMonitor::new(monitored_configs);
            monitor.set_app_handle(app.handle().clone());

            // Inicia monitoramento
            if let Err(e) = monitor.start_monitoring() {
                log::error!("Failed to start achievement monitoring: {}", e);
            }

            // Inicializa Steam monitor
            let mut steam_monitor = SteamMonitor::new();
            steam_monitor.set_app_handle(app.handle().clone());

            // Armazena monitor no estado da app
            app.manage(AppState {
                monitor: Mutex::new(Some(monitor)),
                steam_monitor: Mutex::new(Some(steam_monitor)),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::game_lookup::get_game_name,
            commands::game_lookup::get_game_names,
            commands::game_lookup::search_steam_games,
            commands::achievements::get_game_achievements,
            commands::achievements::reload_achievements,
            commands::monitoring::request_achievements,
            commands::achievements::unlock_achievements,
            commands::achievements::export_achievements,
            commands::backup::create_achievements_backup,
            commands::backup::preview_achievements_restore,
            commands::backup::apply_achievements_restore,
            commands::settings::save_settings,
            commands::settings::load_settings,
            commands::monitoring::get_monitored_directories,
            commands::monitoring::get_achievement_ini_last_modified,
            commands::monitoring::add_monitored_directory,
            commands::monitoring::remove_monitored_directory,
            commands::monitoring::toggle_monitored_directory,
            commands::monitoring::set_wine_prefix_path,
            commands::ui::pick_folder,
            commands::steam::pick_steam_vdf_file,
            commands::steam::pick_steam_dll_file,
            commands::ui::minimize_window,
            commands::ui::maximize_window,
            commands::ui::close_window,
            commands::steam::is_steam_available,
            commands::steam::get_steam_availability_details,
            commands::steam::get_steam_user_info,
            commands::steam::get_steam_games,
            commands::steam::get_steam_game_achievements,
            commands::steam::set_steam_achievement,
            commands::steam::detect_steam_games,
            commands::steam::get_steam_dll_path,
            commands::steam::get_steam_library_path,
            commands::steam::get_steam_library_info,
            commands::ui::open_devtools,
            commands::cache_system::get_cache_size,
            commands::cache_system::clear_cache,
            commands::cache_system::get_system_info,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
