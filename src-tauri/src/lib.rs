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

            let default_paths = vec![
                "C:/Users/Public/Documents/Steam/RUNE",
                "C:/Users/Public/Documents/Steam/CODEX",
                "C:/ProgramData/Steam/RLD!",
                "C:/Users/Public/Documents/OnlineFix",
            ];

            let mut monitored_configs: Vec<DirectoryConfig> = if cfg!(target_os = "windows") {
                default_paths
                    .into_iter()
                    .map(|p| {
                        let name = p.split('/').last().unwrap_or("Unknown").to_string();
                        DirectoryConfig {
                            name,
                            path: p.to_string(),
                            enabled: true,
                            is_default: true,
                        }
                    })
                    .collect()
            } else {
                let home_dir = dirs::home_dir().unwrap_or_default();
                let wine_prefix = home_dir.join(".wine/drive_c");
                default_paths
                    .into_iter()
                    .map(|p| {
                        let name = p.split('/').last().unwrap_or("Unknown").to_string();
                        let path_suffix = if p.starts_with("C:/") { &p[3..] } else { p };
                        let full_path = wine_prefix.join(path_suffix).to_string_lossy().to_string();

                        DirectoryConfig {
                            name,
                            path: full_path,
                            enabled: true,
                            is_default: true,
                        }
                    })
                    .collect()
            };

            if settings_path.exists() {
                if let Ok(settings_data) = std::fs::read_to_string(&settings_path) {
                    if let Ok(settings) = serde_json::from_str::<serde_json::Value>(&settings_data)
                    {
                        if let Some(configs_val) =
                            settings.get("monitoredConfigs").and_then(|v| v.as_array())
                        {
                            let saved_configs: Vec<DirectoryConfig> = configs_val
                                .iter()
                                .filter_map(|v| serde_json::from_value(v.clone()).ok())
                                .collect();

                            // Mescla configurações salvas com defaults (preservando o estado enabled das defaults)
                            for mut saved in saved_configs {
                                // Auto-fix legacy wine paths on Windows
                                if cfg!(target_os = "windows")
                                    && saved.path.contains(".wine/drive_c")
                                {
                                    if let Some(suffix_start) = saved.path.find("drive_c/") {
                                        let suffix = &saved.path[suffix_start + 8..];
                                        saved.path = format!("C:/{}", suffix);
                                    }
                                }

                                if let Some(existing) =
                                    monitored_configs.iter_mut().find(|c| c.path == saved.path)
                                {
                                    existing.enabled = saved.enabled;
                                } else if !saved.is_default {
                                    monitored_configs.push(saved);
                                }
                            }
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
            commands::get_game_name,
            commands::get_game_names,
            commands::search_steam_games,
            commands::get_game_achievements,
            commands::reload_achievements,
            commands::request_achievements,
            commands::unlock_achievements,
            commands::export_achievements,
            commands::save_settings,
            commands::load_settings,
            commands::get_monitored_directories,
            commands::get_achievement_ini_last_modified,
            commands::add_monitored_directory,
            commands::remove_monitored_directory,
            commands::toggle_monitored_directory,
            commands::pick_folder,
            commands::pick_steam_vdf_file,
            commands::pick_steam_dll_file,
            commands::minimize_window,
            commands::maximize_window,
            commands::close_window,
            // Steam integration commands
            commands::is_steam_available,
            commands::get_steam_availability_details,
            commands::get_steam_user_info,
            commands::get_steam_games,
            commands::get_steam_game_achievements,
            commands::set_steam_achievement,
            commands::detect_steam_games,
            commands::get_steam_dll_path,
            commands::get_steam_library_path,
            commands::get_steam_library_info,
            commands::open_devtools,
            commands::get_cache_size,
            commands::clear_cache,
            commands::get_system_info,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
