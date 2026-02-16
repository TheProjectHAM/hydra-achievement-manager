use crate::api::{HydraAPI, SteamAPI};
use crate::models::*;
use crate::parser::AchievementParser;
use crate::unlocker::AchievementUnlocker;
use crate::utils::{AchievementExporter, CacheManager};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_dialog::DialogExt;

fn map_ui_language_to_steam_store_lang(language: &str) -> &'static str {
    match language {
        "en-US" => "english",
        "pt-BR" => "portuguese",
        "fr-FR" => "french",
        "it-IT" => "italian",
        "de-DE" => "german",
        "es-ES" => "spanish",
        "ru-RU" => "russian",
        "ja-JP" => "japanese",
        "zh-CN" => "schinese",
        "pl-PL" => "polish",
        "uk-UA" => "ukrainian",
        _ => "english",
    }
}

fn map_ui_language_to_hydra_lang(language: &str) -> &'static str {
    match language {
        "en-US" => "en",
        "es-ES" => "es",
        "ru-RU" => "ru",
        "pt-BR" => "pt",
        _ => "en",
    }
}

fn read_language_from_settings(app_handle: &AppHandle) -> String {
    let user_data_path = match app_handle.path().app_data_dir() {
        Ok(path) => path,
        Err(_) => return "en-US".to_string(),
    };
    let settings_path = user_data_path.join("settings.json");

    if settings_path.exists() {
        if let Ok(settings_data) = fs::read_to_string(settings_path) {
            if let Ok(settings) = serde_json::from_str::<Value>(&settings_data) {
                if let Some(lang) = settings.get("language").and_then(|v| v.as_str()) {
                    return lang.to_string();
                }
            }
        }
    }

    "en-US".to_string()
}

pub fn build_default_directory_configs(wine_prefix_path: Option<&str>) -> Vec<DirectoryConfig> {
    fn resolve_gse_user(users_roots: &[PathBuf]) -> String {
        let mut found_steamuser = false;

        for root in users_roots {
            if !root.exists() {
                continue;
            }

            if let Ok(entries) = fs::read_dir(root) {
                for entry in entries.flatten() {
                    let is_dir = entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false);
                    if !is_dir {
                        continue;
                    }

                    let username = entry.file_name().to_string_lossy().to_string();
                    let gse_dir = entry.path().join("AppData").join("Roaming").join("GSE Saves");
                    if !gse_dir.exists() {
                        continue;
                    }

                    if username.eq_ignore_ascii_case("steamuser") {
                        found_steamuser = true;
                    } else {
                        return username;
                    }
                }
            }
        }

        if found_steamuser {
            "steamuser".to_string()
        } else {
            "steamuser".to_string()
        }
    }

    if cfg!(target_os = "windows") {
        let gse_user = resolve_gse_user(&[
            Path::new("C:/users").to_path_buf(),
            Path::new("C:/Users").to_path_buf(),
        ]);
        let default_paths = vec![
            "C:/Users/Public/Documents/Steam/RUNE".to_string(),
            "C:/Users/Public/Documents/Steam/CODEX".to_string(),
            "C:/ProgramData/Steam/RLD!".to_string(),
            "C:/Users/Public/Documents/OnlineFix".to_string(),
            format!("C:/users/{}/AppData/Roaming/GSE Saves", gse_user),
        ];

        default_paths
            .into_iter()
            .map(|p| DirectoryConfig {
                name: p.split('/').last().unwrap_or("Unknown").to_string(),
                path: p,
                enabled: true,
                is_default: true,
            })
            .collect()
    } else {
        let prefix_raw = wine_prefix_path
            .map(|p| p.trim())
            .filter(|p| !p.is_empty())
            .unwrap_or("~/.wine");

        let expanded_prefix = crate::parser::expand_path(prefix_raw);
        let wine_drive_c = if expanded_prefix
            .file_name()
            .and_then(|n| n.to_str())
            == Some("drive_c")
        {
            expanded_prefix
        } else {
            expanded_prefix.join("drive_c")
        };

        let gse_user = resolve_gse_user(&[
            wine_drive_c.join("users"),
            wine_drive_c.join("Users"),
        ]);
        let default_paths = vec![
            "C:/Users/Public/Documents/Steam/RUNE".to_string(),
            "C:/Users/Public/Documents/Steam/CODEX".to_string(),
            "C:/ProgramData/Steam/RLD!".to_string(),
            "C:/Users/Public/Documents/OnlineFix".to_string(),
            format!("C:/users/{}/AppData/Roaming/GSE Saves", gse_user),
        ];

        default_paths
            .into_iter()
            .map(|p| {
                let name = p.split('/').last().unwrap_or("Unknown").to_string();
                let path_suffix = if p.starts_with("C:/") { &p[3..] } else { &p };
                let full_path = wine_drive_c.join(path_suffix).to_string_lossy().to_string();

                DirectoryConfig {
                    name,
                    path: full_path,
                    enabled: true,
                    is_default: true,
                }
            })
            .collect()
    }
}

/// Função interna para obter o nome de um jogo
async fn fetch_game_name_internal(game_id: &str, steam_store_language: &str) -> Result<String, String> {
    let base_url = std::env::var("STEAM_STORE_API_URL")
        .unwrap_or_else(|_| "https://store.steampowered.com/api".to_string());

    let url = format!(
        "{}/appdetails?appids={}&l={}",
        base_url, game_id, steam_store_language
    );

    let client = crate::utils::http::get_client()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("HTTP request failed for game {}: {}", game_id, e))?;

    let response_data: Value = response.json().await.map_err(|e| e.to_string())?;

    if let Some(game_data) = response_data.get(game_id) {
        if let Some(success) = game_data.get("success").and_then(|v| v.as_bool()) {
            if success {
                if let Some(name) = game_data
                    .get("data")
                    .and_then(|d| d.get("name"))
                    .and_then(|n| n.as_str())
                {
                    return Ok(name.to_string());
                }
            }
        }
    }

    Err("Game not found".to_string())
}

/// Obtém o nome de um jogo pelo ID
#[tauri::command]
pub async fn get_game_name(game_id: String, app_handle: AppHandle) -> Result<String, String> {
    // Check cache first
    if let Some(cached) = CacheManager::get_game(&app_handle, &game_id) {
        if let Some(name) = cached.name {
            return Ok(name);
        }
    }

    let language = read_language_from_settings(&app_handle);
    let steam_store_language = map_ui_language_to_steam_store_lang(&language);

    match fetch_game_name_internal(&game_id, steam_store_language).await {
        Ok(name) => {
            // Update cache
            let _ = CacheManager::update_game(
                &app_handle,
                game_id.clone(),
                Some(name.clone()),
                None,
                None,
                None,
            );
            Ok(name)
        }
        Err(_) => Ok(game_id),
    }
}

/// Obtém nomes de múltiplos jogos
#[tauri::command]
pub async fn get_game_names(
    game_ids: Vec<String>,
    app_handle: AppHandle,
) -> Result<HashMap<String, String>, String> {
    let mut names = HashMap::new();
    let mut missing_ids: Vec<String> = Vec::new();
    let language = read_language_from_settings(&app_handle);
    let steam_store_language = map_ui_language_to_steam_store_lang(&language);

    // Load cache once to avoid repeated disk reads per game.
    let cache = CacheManager::load(&app_handle).unwrap_or_default();

    for game_id in game_ids {
        if let Some(cached) = cache.games.get(&game_id) {
            if let Some(name) = &cached.name {
                names.insert(game_id, name.clone());
                continue;
            }
        }

        missing_ids.push(game_id);
    }

    // Fetch only missing names (first run or cache miss).
    for game_id in missing_ids {
        match fetch_game_name_internal(&game_id, steam_store_language).await {
            Ok(name) => {
                let _ = CacheManager::update_game(
                    &app_handle,
                    game_id.clone(),
                    Some(name.clone()),
                    None,
                    None,
                    None,
                );
                names.insert(game_id, name);
            }
            Err(_) => {
                names.insert(game_id.clone(), game_id);
            }
        };
    }

    Ok(names)
}

/// Busca jogos Steam
#[tauri::command]
pub async fn search_steam_games(
    query: String,
    app_handle: AppHandle,
) -> Result<Vec<SteamGameSearchResult>, String> {
    let trimmed_query = query.trim();
    let mut results = Vec::new();
    let language = read_language_from_settings(&app_handle);
    let steam_store_language = map_ui_language_to_steam_store_lang(&language);

    // 1. Verifica se é um AppID numérico
    if let Ok(app_id) = trimmed_query.parse::<u32>() {
        let base_url = std::env::var("STEAM_STORE_API_URL")
            .unwrap_or_else(|_| "https://store.steampowered.com/api".to_string());

        let url = format!(
            "{}/appdetails?appids={}&l={}",
            base_url, app_id, steam_store_language
        );

        let client = crate::utils::http::get_client()
            .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

        let response = client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("HTTP request failed for appid {}: {}", app_id, e))?;

        let data: Value = response.json().await.map_err(|e| e.to_string())?;

        if let Some(game_data) = data.get(&app_id.to_string()) {
            if let Some(success) = game_data.get("success").and_then(|v| v.as_bool()) {
                if success {
                    if let Some(name) = game_data
                        .get("data")
                        .and_then(|d| d.get("name"))
                        .and_then(|n| n.as_str())
                    {
                        results.push(SteamGameSearchResult {
                            id: app_id,
                            name: name.to_string(),
                            achievements_total: 0,
                        });
                    }
                }
            }
        }
    }

    // 2. Busca padrão na loja
    let base_url = std::env::var("STEAM_STORE_API_URL")
        .unwrap_or_else(|_| "https://store.steampowered.com/api".to_string());

    let search_url = format!(
        "{}/storesearch/?term={}&l={}&cc=us&snr=1_4_4__12",
        base_url,
        urlencoding::encode(trimmed_query),
        steam_store_language
    );

    let search_client = crate::utils::http::get_client()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let response = search_client
        .get(&search_url)
        .send()
        .await
        .map_err(|e| format!("HTTP search request failed: {}", e))?;

    let data: Value = response.json().await.map_err(|e| e.to_string())?;

    if let Some(items) = data.get("items").and_then(|i| i.as_array()) {
        for item in items {
            if let Some(id) = item.get("id").and_then(|i| i.as_u64()) {
                if let Some(name) = item.get("name").and_then(|n| n.as_str()) {
                    // Evita duplicatas
                    if !results.iter().any(|r| r.id == id as u32) {
                        results.push(SteamGameSearchResult {
                            id: id as u32,
                            name: name.to_string(),
                            achievements_total: 0,
                        });
                    }
                }
            }
        }
    }

    Ok(results.into_iter().take(15).collect())
}

/// Obtém achievements de um jogo
#[tauri::command]
pub async fn get_game_achievements(
    game_id: String,
    language: Option<String>,
    state: tauri::State<'_, crate::AppState>,
    app_handle: AppHandle,
) -> Result<Value, String> {
    // Carrega configurações
    let user_data_path = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app_data_dir: {}", e))?;
    let settings_path = user_data_path.join("settings.json");

    let mut selected_api = "hydra".to_string();
    let mut steam_api_key = String::new();
    let mut steam_id = String::new();
    let mut settings_language: Option<String> = None;

    if settings_path.exists() {
        if let Ok(settings_data) = fs::read_to_string(&settings_path) {
            if let Ok(settings) = serde_json::from_str::<Value>(&settings_data) {
                if let Some(api) = settings.get("selectedApi").and_then(|v| v.as_str()) {
                    selected_api = api.to_string();
                }
                if let Some(key) = settings.get("steamApiKey").and_then(|v| v.as_str()) {
                    steam_api_key = key.to_string();
                }
                if let Some(id) = settings.get("steamId").and_then(|v| v.as_str()) {
                    steam_id = id.to_string();
                }
                if let Some(lang) = settings.get("language").and_then(|v| v.as_str()) {
                    settings_language = Some(lang.to_string());
                }
            }
        }
    }
    let language = language
        .or(settings_language)
        .unwrap_or_else(|| "en-US".to_string());
    log::info!(
        "Getting achievements for game_id: {} using api: {}",
        game_id,
        selected_api
    );
    if selected_api == "steam" {
        log::info!(
            "Steam Info: ID={}, KeyLength={}",
            steam_id,
            steam_api_key.len()
        );
    }

    // Se não tiver steam_id nas settings, tenta pegar do client local (sessão temporária)
    if steam_id.is_empty() {
        let resolved_id = {
            let steam_lock = state.steam_monitor.lock().map_err(|e| e.to_string())?;
            if let Some(steam_monitor) = &*steam_lock {
                let mut initialized_here = false;
                if !steam_monitor.is_enabled() {
                    let _ = steam_monitor.initialize();
                    initialized_here = true;
                }

                let id = if steam_monitor.is_enabled() {
                    steam_monitor.get_user_info().ok().map(|(id, _)| id)
                } else {
                    None
                };

                if initialized_here && steam_monitor.is_enabled() {
                    let _ = steam_monitor.shutdown();
                }

                id
            } else {
                None
            }
        };

        if let Some(id) = resolved_id {
            steam_id = id.clone();
            // Persist steamId for future requests (avoids resolving every time)
            let _ = save_settings(
                serde_json::json!({ "steamId": id }),
                app_handle.clone(),
            )
            .await;
        }
    }

    // Mapeia linguagens
    let steam_language = map_ui_language_to_steam_store_lang(&language);
    let hydra_language = map_ui_language_to_hydra_lang(&language);

    // Busca achievements
    let mut achievements_json = if selected_api == "steam" && !steam_api_key.is_empty() {
        let app_id: u32 = game_id
            .parse()
            .map_err(|e: std::num::ParseIntError| e.to_string())?;
        let mut schema_achievements =
            SteamAPI::get_game_achievements(app_id, &steam_api_key, steam_language)
                .await
                .map_err(|e| e.to_string())?;

        // Se tivermos steam_id, buscamos o status do jogador via Web API
        if !steam_id.is_empty() {
            if let Ok(player_achievements) =
                SteamAPI::get_player_achievements(app_id, &steam_api_key, &steam_id).await
            {
                let player_map: HashMap<String, i32> = player_achievements
                    .iter()
                    .map(|a| (a.apiname.clone(), a.achieved))
                    .collect();

                let time_map: HashMap<String, i64> = player_achievements
                    .iter()
                    .map(|a| (a.apiname.clone(), a.unlocktime))
                    .collect();

                for ach in schema_achievements.iter_mut() {
                    if let Some(achieved) = player_map.get(&ach.apiname) {
                        ach.achieved = *achieved;
                    }
                    if let Some(unlocktime) = time_map.get(&ach.apiname) {
                        ach.unlocktime = *unlocktime;
                    }
                }
            }
        }
        serde_json::to_value(schema_achievements).map_err(|e| e.to_string())?
    } else {
        // Usa API Hydra para definições
        let result = HydraAPI::get_game_achievements(&game_id, Some(hydra_language))
            .await
            .map_err(|e| e.to_string())?;

        let mut final_achievements =
            serde_json::to_value(result.achievements).map_err(|e| e.to_string())?;

        // Se for um jogo Steam (ID numérico), tenta buscar o status real na Steam
        if let Ok(app_id) = game_id.parse::<u32>() {
            let mut steam_status_map: HashMap<String, (i32, i64)> = HashMap::new();

            // 1. Tenta API Key se disponível
            if !steam_api_key.is_empty() && !steam_id.is_empty() {
                if let Ok(player_achievements) =
                    SteamAPI::get_player_achievements(app_id, &steam_api_key, &steam_id).await
                {
                    for ach in player_achievements {
                        steam_status_map.insert(ach.apiname, (ach.achieved, ach.unlocktime));
                    }
                }
            }
            // 2. Fallback: Parse XML público se não tiver API Key mas tiver ID
            else if !steam_id.is_empty() {
                let base_url = std::env::var("STEAM_COMMUNITY_URL")
                    .unwrap_or_else(|_| "https://steamcommunity.com".to_string());

                let url = format!("{}/profiles/{}/stats/{}/?xml=1", base_url, steam_id, app_id);

                let xml_client = crate::utils::http::get_client()
                    .map_err(|e| format!("Failed to create HTTP client: {}", e))?;
                let response = xml_client
                    .get(&url)
                    .send()
                    .await
                    .map_err(|e| e.to_string())?;

                let xml_content: String = response.text().await.map_err(|e| e.to_string())?;

                // Parse XML simples e manual para evitar dependency extra
                for _line in xml_content.lines() {
                    // Lógica de XML (não implementada)
                }
            }

            // Se conseguimos dados da Web API, aplicamos no resultado Hydra
            if !steam_status_map.is_empty() {
                if let Some(ach_array) = final_achievements.as_array_mut() {
                    for ach in ach_array {
                        if let Some(name) = ach.get("name").and_then(|v| v.as_str()) {
                            if let Some((achieved, unlocktime)) = steam_status_map.get(name) {
                                if let Some(obj) = ach.as_object_mut() {
                                    obj.insert(
                                        "achieved".to_string(),
                                        serde_json::json!(if *achieved > 0 { true } else { false }),
                                    );
                                    obj.insert(
                                        "unlockTime".to_string(),
                                        serde_json::json!(unlocktime),
                                    );
                                }
                            }
                        }
                    }
                }
            }
        }

        final_achievements
    };

    let achievements_array = achievements_json
        .as_array_mut()
        .ok_or("Failed to convert achievements to array")?;

    // Extract metadata for caching
    let mut rarity_map = HashMap::new();
    let mut hidden_list = Vec::new();

    for ach in achievements_array.iter() {
        if let Some(name) = ach
            .get("apiname")
            .and_then(|v| v.as_str())
            .or_else(|| ach.get("name").and_then(|v| v.as_str()))
        {
            if let Some(percent) = ach.get("percent").and_then(|v| v.as_f64()) {
                rarity_map.insert(name.to_string(), percent);
            }
            if let Some(hidden) = ach.get("hidden").and_then(|v| v.as_bool()) {
                if hidden {
                    hidden_list.push(name.to_string());
                }
            }
        }
    }

    // Update cache with all metadata
    let _ = CacheManager::update_game(
        &app_handle,
        game_id.clone(),
        None,
        Some(achievements_array.len()),
        Some(rarity_map),
        Some(hidden_list),
    );

    // Se o Steam LOCAL estiver disponível (client rodando), tenta atualizar o status local
    if let Ok(steam_lock) = state.steam_monitor.lock() {
        if let Some(steam_monitor) = &*steam_lock {
            if steam_monitor.is_enabled() {
                if let Ok(_app_id) = game_id.parse::<u32>() {
                    for achievement in achievements_array.iter_mut() {
                        let name = achievement
                            .get("name")
                            .and_then(|v| v.as_str())
                            .or_else(|| achievement.get("apiname").and_then(|v| v.as_str()));

                        if let Some(name) = name {
                            if let Ok(unlocked) = steam_monitor.get_achievement_status(name) {
                                if let Some(obj) = achievement.as_object_mut() {
                                    if unlocked {
                                        obj.insert("achieved".to_string(), serde_json::json!(true));
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(serde_json::json!({
        "gameId": game_id,
        "achievements": achievements_array
    }))
}

/// Recarrega achievements de um arquivo
#[tauri::command]
pub async fn reload_achievements(
    game_id: String,
    base_path: String,
    app_handle: AppHandle,
) -> Result<Value, String> {
    let expanded_base_path = crate::parser::expand_path(&base_path);
    let game_dir = expanded_base_path.join(&game_id);
    let ini_path = game_dir.join("achievements.ini");
    let json_path = game_dir.join("achievements.json");

    let file_path = if ini_path.exists() {
        ini_path
    } else if json_path.exists() {
        json_path
    } else {
        ini_path
    };

    let achievements =
        AchievementParser::parse_achievement_file(&file_path).map_err(|e| e.to_string())?;

    // Update cache with new count
    let _ = CacheManager::update_game(
        &app_handle,
        game_id.clone(),
        None,
        Some(achievements.len()),
        None,
        None,
    );

    Ok(serde_json::json!({
        "gameId": game_id,
        "achievements": achievements
    }))
}

/// Unlock achievements
#[tauri::command]
pub async fn unlock_achievements(
    options: UnlockOptions,
    state: tauri::State<'_, crate::AppState>,
    app_handle: AppHandle,
) -> Result<(), String> {
    log::info!(
        "Unlocking achievements for game {} (Path: {})",
        options.game_id,
        options.selected_path
    );

    // Se o caminho começar com steam://, usamos a API da Steam
    if options.selected_path.starts_with("steam://") {
        if let Ok(steam_lock) = state.steam_monitor.lock() {
            if let Some(steam_monitor) = &*steam_lock {
                log::info!("Using Steam API for unlock (temporary session)");

                let unlock_result = (|| -> Result<(), String> {
                    steam_monitor.initialize().map_err(|e| e.to_string())?;
                    if !steam_monitor.is_enabled() {
                        return Err("Steam integration not available or Steam not running".into());
                    }

                    let app_id = options
                        .game_id
                        .parse::<u32>()
                        .map_err(|_| "Invalid Steam AppID".to_string())?;
                    steam_monitor.switch_app_id(app_id).map_err(|e| e.to_string())?;

                    for achievement in &options.achievements {
                        steam_monitor
                            .set_achievement(&achievement.name, achievement.completed)
                            .map_err(|e| e.to_string())?;
                    }

                    Ok(())
                })();

                // Sempre tenta voltar para o AppID neutro (480) após o unlock.
                if let Err(e) = steam_monitor.switch_app_id(480) {
                    log::warn!("Failed to switch back to AppID 480 after unlock: {}", e);
                }

                // Sempre fecha a sessão após o desbloqueio.
                if let Err(e) = steam_monitor.shutdown() {
                    log::warn!("Failed to close Steam session after unlock: {}", e);
                }

                unlock_result?;
                app_handle
                    .emit("achievements-updated", ())
                    .map_err(|e| e.to_string())?;
                return Ok(());
            }
        }
        return Err("Steam integration not available or Steam not running".into());
    }

    // Caso contrário (jogo Hydra/Goldberg), usa a lógica original de arquivo .ini
    AchievementUnlocker::unlock_achievements(&options).map_err(|e| e.to_string())?;

    // Emite evento de atualização
    app_handle
        .emit("achievements-updated", ())
        .map_err(|e| e.to_string())?;

    Ok(())
}

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
    if let (Some(existing_obj), Some(new_obj)) =
        (final_settings.as_object_mut(), settings.as_object())
    {
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

// Estado global para cooldown de exportação
static LAST_EXPORT_TIME: Mutex<Option<u64>> = Mutex::new(None);
const EXPORT_COOLDOWN: u64 = 2000; // 2 segundos em ms

/// Exporta achievements
#[tauri::command]
pub async fn export_achievements(
    game_id: String,
    app_handle: AppHandle,
) -> Result<serde_json::Value, String> {
    // Verifica cooldown
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis() as u64;

    {
        let mut last_time = LAST_EXPORT_TIME.lock().map_err(|e| e.to_string())?;
        if let Some(last) = *last_time {
            if now - last < EXPORT_COOLDOWN {
                return Ok(serde_json::json!({
                    "success": false,
                    "message": "Export is on cooldown. Please wait."
                }));
            }
        }
        *last_time = Some(now);
    }

    // Seleciona diretório usando dialog plugin v2
    let export_dir = app_handle
        .dialog()
        .file()
        .set_title("Select directory to export achievements")
        .blocking_pick_folder();

    let export_dir = match export_dir {
        Some(fp) => fp.as_path().map(|p| p.to_path_buf()),
        None => {
            return Ok(serde_json::json!({
                "success": false,
                "message": "Export cancelled"
            }));
        }
    };

    let export_dir = match export_dir {
        Some(p) => p,
        None => {
            return Ok(serde_json::json!({
                "success": false,
                "message": "Invalid export path"
            }));
        }
    };

    // Carrega configurações para linguagem
    let user_data_path = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app_data_dir: {}", e))?;
    let settings_path = user_data_path.join("settings.json");

    let mut language = "en-US".to_string();
    if settings_path.exists() {
        if let Ok(settings_data) = fs::read_to_string(&settings_path) {
            if let Ok(settings) = serde_json::from_str::<Value>(&settings_data) {
                if let Some(lang) = settings.get("language").and_then(|v| v.as_str()) {
                    language = lang.to_string();
                }
            }
        }
    }

    // Exporta achievements
    match AchievementExporter::export_achievements(&game_id, export_dir, &language, &app_handle)
        .await
    {
        Ok(_) => Ok(serde_json::json!({
            "success": true
        })),
        Err(e) => Ok(serde_json::json!({
            "success": false,
            "message": e.to_string()
        })),
    }
}

/// Seleciona uma pasta usando dialog plugin v2
#[tauri::command]
pub async fn pick_folder(app_handle: AppHandle) -> Result<Option<String>, String> {
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
pub async fn open_devtools(window: tauri::WebviewWindow) {
    #[cfg(debug_assertions)]
    {
        window.open_devtools();
    }
    let _ = window;
}

/// Obtém diretórios monitorados
#[tauri::command]
pub async fn get_monitored_directories(
    state: tauri::State<'_, crate::AppState>,
) -> Result<Vec<DirectoryConfig>, String> {
    let monitor_lock = state.monitor.lock().map_err(|e| e.to_string())?;
    if let Some(monitor) = &*monitor_lock {
        Ok(monitor.get_directories())
    } else {
        Err("Monitor not initialized".to_string())
    }
}

/// Obtém a última modificação real do arquivo achievements.ini/achievements.json para um jogo em um caminho.
#[tauri::command]
pub async fn get_achievement_ini_last_modified(
    game_id: String,
    path: String,
) -> Result<Option<i64>, String> {
    if path.starts_with("steam://") {
        return Ok(None);
    }

    let expanded = crate::parser::expand_path(&path);
    let game_dir = expanded.join(game_id);
    let ini_path = game_dir.join("achievements.ini");
    let json_path = game_dir.join("achievements.json");
    let target_path = if ini_path.exists() { ini_path } else { json_path };

    if !target_path.exists() {
        return Ok(None);
    }

    let modified = std::fs::metadata(&target_path)
        .map_err(|e| e.to_string())?
        .modified()
        .map_err(|e| e.to_string())?
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs() as i64;

    Ok(Some(modified))
}

/// Adiciona um diretório para monitoramento
#[tauri::command]
pub async fn add_monitored_directory(
    path: String,
    state: tauri::State<'_, crate::AppState>,
    app_handle: AppHandle,
) -> Result<Vec<DirectoryConfig>, String> {
    use crate::parser::expand_path;
    let (configs, current_directories) = {
        let mut monitor_lock = state.monitor.lock().map_err(|e| e.to_string())?;
        if let Some(monitor) = &mut *monitor_lock {
            let mut configs = monitor.get_directories();
            if !configs.iter().any(|c| c.path == path) {
                let expanded = expand_path(&path);
                configs.push(DirectoryConfig {
                    name: expanded
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("Unknown")
                        .to_string(),
                    path: expanded.to_string_lossy().to_string(),
                    enabled: true,
                    is_default: false,
                });
                monitor.set_directories(configs.clone());
                monitor.restart_monitoring().map_err(|e| e.to_string())?;
            }
            (configs.clone(), monitor.get_directories())
        } else {
            return Err("Monitor not initialized".to_string());
        }
    };

    // Salva nas configurações fora do lock
    let mut settings = load_settings(app_handle.clone())
        .await
        .unwrap_or(serde_json::json!({}));
    settings["monitoredConfigs"] = serde_json::to_value(&configs).map_err(|e| e.to_string())?;
    let _ = save_settings(settings, app_handle).await;

    Ok(current_directories)
}

/// Ativa/desativa um diretório para monitoramento
#[tauri::command]
pub async fn toggle_monitored_directory(
    path: String,
    state: tauri::State<'_, crate::AppState>,
    app_handle: AppHandle,
) -> Result<Vec<DirectoryConfig>, String> {
    let (configs, current_directories) = {
        let mut monitor_lock = state.monitor.lock().map_err(|e| e.to_string())?;
        if let Some(monitor) = &mut *monitor_lock {
            let mut configs = monitor.get_directories();
            if let Some(config) = configs.iter_mut().find(|c| c.path == path) {
                config.enabled = !config.enabled;
                monitor.set_directories(configs.clone());
                monitor.restart_monitoring().map_err(|e| e.to_string())?;
            }
            (configs.clone(), monitor.get_directories())
        } else {
            return Err("Monitor not initialized".to_string());
        }
    };

    // Salva nas configurações fora do lock
    let mut settings = load_settings(app_handle.clone())
        .await
        .unwrap_or(serde_json::json!({}));
    settings["monitoredConfigs"] = serde_json::to_value(&configs).map_err(|e| e.to_string())?;
    let _ = save_settings(settings, app_handle).await;

    Ok(current_directories)
}

/// Solicita os achievements atuais
#[tauri::command]
pub async fn request_achievements(
    state: tauri::State<'_, crate::AppState>,
) -> Result<Vec<GameAchievements>, String> {
    let monitor_lock = state.monitor.lock().map_err(|e| e.to_string())?;
    if let Some(monitor) = &*monitor_lock {
        Ok(monitor.get_current_achievements())
    } else {
        Err("Monitor not initialized".to_string())
    }
}

/// Remove um diretório do monitoramento
#[tauri::command]
pub async fn remove_monitored_directory(
    path: String,
    state: tauri::State<'_, crate::AppState>,
    app_handle: AppHandle,
) -> Result<Vec<DirectoryConfig>, String> {
    let (configs, current_directories) = {
        let mut monitor_lock = state.monitor.lock().map_err(|e| e.to_string())?;
        if let Some(monitor) = &mut *monitor_lock {
            let mut configs = monitor.get_directories();
            // Somente permite remover se NÃO for default
            if let Some(pos) = configs.iter().position(|c| c.path == path && !c.is_default) {
                configs.remove(pos);
                monitor.set_directories(configs.clone());
                monitor.restart_monitoring().map_err(|e| e.to_string())?;
            }
            (configs.clone(), monitor.get_directories())
        } else {
            return Err("Monitor not initialized".to_string());
        }
    };

    // Salva nas configurações fora do lock
    let mut settings = load_settings(app_handle.clone())
        .await
        .unwrap_or(serde_json::json!({}));
    settings["monitoredConfigs"] = serde_json::to_value(&configs).map_err(|e| e.to_string())?;
    let _ = save_settings(settings, app_handle).await;

    Ok(current_directories)
}

#[tauri::command]
pub async fn set_wine_prefix_path(
    path: String,
    state: tauri::State<'_, crate::AppState>,
    app_handle: AppHandle,
) -> Result<Vec<DirectoryConfig>, String> {
    if !cfg!(target_os = "linux") {
        return Err("Wine prefix path is only available on Linux".to_string());
    }

    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("Wine prefix path cannot be empty".to_string());
    }

    let updated_directories = {
        let mut monitor_lock = state.monitor.lock().map_err(|e| e.to_string())?;
        let monitor = monitor_lock
            .as_mut()
            .ok_or_else(|| "Monitor not initialized".to_string())?;

        let current = monitor.get_directories();
        let custom_dirs: Vec<DirectoryConfig> =
            current.iter().filter(|d| !d.is_default).cloned().collect();

        let default_enabled: std::collections::HashMap<String, bool> = current
            .iter()
            .filter(|d| d.is_default)
            .map(|d| (d.name.clone(), d.enabled))
            .collect();

        let mut next = build_default_directory_configs(Some(trimmed));
        for dir in &mut next {
            if let Some(enabled) = default_enabled.get(&dir.name) {
                dir.enabled = *enabled;
            }
        }

        next.extend(custom_dirs);
        monitor.set_directories(next.clone());
        monitor.restart_monitoring().map_err(|e| e.to_string())?;
        next
    };

    let mut settings = load_settings(app_handle.clone())
        .await
        .unwrap_or(serde_json::json!({}));
    settings["winePrefixPath"] = Value::String(trimmed.to_string());
    settings["monitoredConfigs"] =
        serde_json::to_value(&updated_directories).map_err(|e| e.to_string())?;
    save_settings(settings, app_handle).await?;

    Ok(updated_directories)
}

// ==================== Steam Integration Commands ====================

#[cfg(target_os = "windows")]
fn find_windows_steam_dll() -> Option<PathBuf> {
    let exe_dir = std::env::current_exe().ok()?.parent()?.to_path_buf();
    let primary = exe_dir.join("steam_api64.dll");
    if primary.exists() {
        return Some(primary);
    }

    // Fallback para builds/instaladores legados que podem usar outro nome.
    let legacy = exe_dir.join("steam_api64_windows_x64.dll");
    if legacy.exists() {
        return Some(legacy);
    }

    None
}

#[cfg(target_os = "linux")]
fn find_linux_steam_runtime_library() -> Option<PathBuf> {
    let mut candidates: Vec<PathBuf> = Vec::new();

    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            candidates.push(dir.join("libsteam_api.so"));
        }
    }

    if let Ok(ld_path) = std::env::var("LD_LIBRARY_PATH") {
        for dir in ld_path.split(':') {
            if dir.is_empty() {
                continue;
            }
            candidates.push(PathBuf::from(dir).join("libsteam_api.so"));
        }
    }

    candidates.push(PathBuf::from("/usr/lib/libsteam_api.so"));
    candidates.push(PathBuf::from("/usr/lib64/libsteam_api.so"));
    candidates.push(PathBuf::from("/usr/lib/x86_64-linux-gnu/libsteam_api.so"));
    candidates.push(PathBuf::from("/lib/x86_64-linux-gnu/libsteam_api.so"));
    candidates.push(PathBuf::from("/usr/local/lib/libsteam_api.so"));

    candidates.into_iter().find(|p| p.exists())
}

fn find_steam_runtime_library() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        return find_windows_steam_dll();
    }

    #[cfg(target_os = "linux")]
    {
        return find_linux_steam_runtime_library();
    }

    #[allow(unreachable_code)]
    None
}

#[cfg(target_os = "windows")]
fn add_dir_to_windows_path(dir: &std::path::Path) {
    if let Ok(path_var) = std::env::var("PATH") {
        let dir_s = dir.to_string_lossy().to_string();
        let already_in_path = path_var
            .split(';')
            .any(|entry| entry.eq_ignore_ascii_case(&dir_s));
        if !already_in_path {
            std::env::set_var("PATH", format!("{};{}", dir_s, path_var));
            log::info!("[Steam Integration] Added '{}' to PATH", dir.display());
        }
    }
}

fn get_saved_steam_manual_paths(settings: &Value) -> (Option<String>, Option<String>) {
    let vdf = settings
        .get("steamManualVdfPath")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let dll = settings
        .get("steamManualDllPath")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    (vdf, dll)
}

/// Verifica se o Steam está disponível
#[tauri::command]
pub async fn is_steam_available(
    state: tauri::State<'_, crate::AppState>,
    app_handle: AppHandle,
) -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        let settings = load_settings(app_handle.clone())
            .await
            .unwrap_or(serde_json::json!({}));
        let (_, manual_dll) = get_saved_steam_manual_paths(&settings);

        let mut dll_path = find_windows_steam_dll();
        if dll_path.is_none() {
            if let Some(saved_path) = manual_dll {
                let candidate = PathBuf::from(saved_path);
                if candidate.exists() {
                    dll_path = Some(candidate);
                }
            }
        }

        if dll_path.is_none() {
            log::warn!(
                "[Steam Integration] steam_api64.dll not found in app install folder (exe directory)"
            );
            return Ok(false);
        }

        if let Some(path) = dll_path {
            log::info!("[Steam Integration] Steam DLL detected at: {}", path.display());
            if let Some(parent) = path.parent() {
                add_dir_to_windows_path(parent);
            }
        }
    }
    #[cfg(not(target_os = "windows"))]
    let _ = &app_handle;

    let steam_lock = state.steam_monitor.lock().map_err(|e| e.to_string())?;
    if let Some(steam_monitor) = &*steam_lock {
        let mut initialized_here = false;
        if !steam_monitor.is_enabled() {
            steam_monitor.initialize().map_err(|e| e.to_string())?;
            initialized_here = true;
        }
        let available = steam_monitor.is_enabled();
        if initialized_here && available {
            let _ = steam_monitor.shutdown();
        }
        return Ok(available);
    }
    Err("Steam monitor not initialized".to_string())
}

/// Retorna diagnóstico detalhado da integração Steam para exibir na UI.
#[tauri::command]
pub async fn get_steam_availability_details(
    state: tauri::State<'_, crate::AppState>,
    app_handle: AppHandle,
) -> Result<Value, String> {
    let settings = load_settings(app_handle.clone())
        .await
        .unwrap_or(serde_json::json!({}));
    let (manual_vdf, manual_runtime_lib) = get_saved_steam_manual_paths(&settings);

    let mut runtime_lib_path = find_steam_runtime_library().map(|p| p.to_string_lossy().to_string());
    if runtime_lib_path.is_none() {
        if let Some(saved) = manual_runtime_lib {
            let candidate = PathBuf::from(saved);
            if candidate.exists() {
                runtime_lib_path = Some(candidate.to_string_lossy().to_string());
            }
        }
    }

    #[cfg(target_os = "windows")]
    if let Some(path) = &runtime_lib_path {
        if let Some(parent) = PathBuf::from(path).parent() {
            add_dir_to_windows_path(parent);
        }
    }

    let folders = {
        let steam_lock = state.steam_monitor.lock().map_err(|e| e.to_string())?;
        if let Some(steam_monitor) = &*steam_lock {
            steam_monitor
                .get_steam_library_folders()
                .map_err(|e| e.to_string())?
        } else {
            return Err("Steam monitor not initialized".to_string());
        }
    };

    let mut vdf_path: Option<String> = None;
    for folder in folders {
        let candidate = folder.join("steamapps").join("libraryfolders.vdf");
        if candidate.exists() {
            vdf_path = Some(candidate.to_string_lossy().to_string());
            break;
        }
    }
    if vdf_path.is_none() {
        if let Some(saved) = manual_vdf {
            let candidate = PathBuf::from(saved);
            if candidate.exists() {
                vdf_path = Some(candidate.to_string_lossy().to_string());
            }
        }
    }

    let (steam_initialized, steam_init_error) = {
        let steam_lock = state.steam_monitor.lock().map_err(|e| e.to_string())?;
        if let Some(steam_monitor) = &*steam_lock {
            let mut initialized_here = false;
            if !steam_monitor.is_enabled() {
                steam_monitor.initialize().map_err(|e| e.to_string())?;
                initialized_here = true;
            }
            let enabled = steam_monitor.is_enabled();
            let last_error = steam_monitor.get_last_init_error();
            if initialized_here && enabled {
                let _ = steam_monitor.shutdown();
            }
            (enabled, last_error)
        } else {
            return Err("Steam monitor not initialized".to_string());
        }
    };

    let available = if cfg!(target_os = "windows") {
        runtime_lib_path.is_some() && steam_initialized
    } else {
        steam_initialized
    };

    let reason = if available {
        None
    } else if cfg!(target_os = "windows") && runtime_lib_path.is_none() {
        Some("Steam runtime library not found in install folder or configured path".to_string())
    } else if !steam_initialized {
        Some(
            steam_init_error
                .unwrap_or_else(|| "Steamworks initialization failed (Steam client may not be running)".to_string()),
        )
    } else {
        Some("Steam integration unavailable".to_string())
    };

    Ok(serde_json::json!({
        "available": available,
        "runtimeLibPath": runtime_lib_path,
        "vdfPath": vdf_path,
        "steamworksInitialized": steam_initialized,
        "reason": reason
    }))
}

/// Obtém informações do usuário Steam
#[tauri::command]
pub async fn get_steam_user_info(
    state: tauri::State<'_, crate::AppState>,
    app_handle: AppHandle,
) -> Result<serde_json::Value, String> {
    let (user_id, user_name) = {
        let steam_lock = state.steam_monitor.lock().map_err(|e| e.to_string())?;
        if let Some(steam_monitor) = &*steam_lock {
            let mut initialized_here = false;
            if !steam_monitor.is_enabled() {
                steam_monitor.initialize().map_err(|e| e.to_string())?;
                if !steam_monitor.is_enabled() {
                    return Err("Steam integration not available or Steam not running".to_string());
                }
                initialized_here = true;
            }

            let info = steam_monitor.get_user_info().map_err(|e| e.to_string())?;
            if initialized_here {
                let _ = steam_monitor.shutdown();
            }
            info
        } else {
            return Err("Steam monitor not initialized".to_string());
        }
    };

    let _ = save_settings(
        serde_json::json!({ "steamId": user_id.clone() }),
        app_handle,
    )
    .await;

    Ok(serde_json::json!({
        "userId": user_id,
        "userName": user_name
    }))
}

/// Obtém jogos Steam do usuário
#[tauri::command]
pub async fn get_steam_games(
    state: tauri::State<'_, crate::AppState>,
    app_handle: AppHandle,
) -> Result<Vec<crate::steam_integration::SteamGame>, String> {
    let steam_lock = state.steam_monitor.lock().map_err(|e| e.to_string())?;
    if let Some(steam_monitor) = &*steam_lock {
        // Lista jogos via manifestos locais da Steam, sem manter sessão Steamworks aberta.
        let mut games = steam_monitor.get_steam_games().map_err(|e| e.to_string())?;

        // Enrich with cache
        for game in games.iter_mut() {
            if let Some(cached) = CacheManager::get_game(&app_handle, &game.game_id) {
                if let Some(total) = cached.achievements_total {
                    game.achievements_total = total as u32;
                }
                if let Some(name) = cached.name {
                    game.name = name;
                }
            }
        }

        Ok(games)
    } else {
        Err("Steam monitor not initialized".to_string())
    }
}

/// Obtém conquistas de um jogo Steam
#[tauri::command]
pub async fn get_steam_game_achievements(
    app_id: u32,
    state: tauri::State<'_, crate::AppState>,
) -> Result<Vec<crate::steam_integration::SteamAchievementData>, String> {
    let steam_lock = state.steam_monitor.lock().map_err(|e| e.to_string())?;
    if let Some(steam_monitor) = &*steam_lock {
        steam_monitor
            .get_game_achievements(app_id)
            .map_err(|e| e.to_string())
    } else {
        Err("Steam monitor not initialized".to_string())
    }
}

/// Define o estado de uma conquista Steam
#[tauri::command]
pub async fn set_steam_achievement(
    achievement_name: String,
    unlocked: bool,
    state: tauri::State<'_, crate::AppState>,
) -> Result<(), String> {
    let steam_lock = state.steam_monitor.lock().map_err(|e| e.to_string())?;
    if let Some(steam_monitor) = &*steam_lock {
        steam_monitor
            .set_achievement(&achievement_name, unlocked)
            .map_err(|e| e.to_string())
    } else {
        Err("Steam monitor not initialized".to_string())
    }
}

/// Detecta jogos Steam instalados
#[tauri::command]
pub async fn detect_steam_games(
    state: tauri::State<'_, crate::AppState>,
) -> Result<Vec<String>, String> {
    let steam_lock = state.steam_monitor.lock().map_err(|e| e.to_string())?;
    if let Some(steam_monitor) = &*steam_lock {
        let paths = steam_monitor
            .detect_installed_games()
            .map_err(|e| e.to_string())?;
        Ok(paths
            .into_iter()
            .map(|p| p.to_string_lossy().to_string())
            .collect())
    } else {
        Err("Steam monitor not initialized".to_string())
    }
}

/// Detecta o caminho da biblioteca Steam (.dll ou .so)
#[tauri::command]
pub async fn get_steam_library_path(
    state: tauri::State<'_, crate::AppState>,
    app_handle: AppHandle,
) -> Result<Option<String>, String> {
    let folders = {
        let steam_lock = state.steam_monitor.lock().map_err(|e| e.to_string())?;
        if let Some(steam_monitor) = &*steam_lock {
            steam_monitor
                .get_steam_library_folders()
                .map_err(|e| e.to_string())?
        } else {
            return Err("Steam monitor not initialized".to_string());
        }
    };

    for folder in folders {
        let vdf_path = folder.join("steamapps").join("libraryfolders.vdf");
        if vdf_path.exists() {
            return Ok(Some(vdf_path.to_string_lossy().to_string()));
        }
    }

    // Fallback: caminho manual salvo nas settings
    let settings = load_settings(app_handle)
        .await
        .unwrap_or(serde_json::json!({}));
    let (manual_vdf, _) = get_saved_steam_manual_paths(&settings);
    if let Some(saved_path) = manual_vdf {
        let candidate = PathBuf::from(saved_path);
        if candidate.exists() {
            return Ok(Some(candidate.to_string_lossy().to_string()));
        }
    }

    Ok(None)
}

/// Obtém informações do libraryfolders.vdf da Steam detectado.
#[tauri::command]
pub async fn get_steam_library_info(
    state: tauri::State<'_, crate::AppState>,
    app_handle: AppHandle,
) -> Result<Value, String> {
    let folders = {
        let steam_lock = state.steam_monitor.lock().map_err(|e| e.to_string())?;
        if let Some(steam_monitor) = &*steam_lock {
            steam_monitor
                .get_steam_library_folders()
                .map_err(|e| e.to_string())?
        } else {
            return Err("Steam monitor not initialized".to_string());
        }
    };

    for folder in folders {
        let vdf_path = folder.join("steamapps").join("libraryfolders.vdf");
        if vdf_path.exists() {
            let last_modified = std::fs::metadata(&vdf_path)
                .ok()
                .and_then(|m| m.modified().ok())
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_secs() as i64);

            return Ok(serde_json::json!({
                "vdfPath": vdf_path.to_string_lossy().to_string(),
                "lastModified": last_modified
            }));
        }
    }

    // Fallback para caminho manual salvo
    let settings = load_settings(app_handle)
        .await
        .unwrap_or(serde_json::json!({}));
    let (manual_vdf, _) = get_saved_steam_manual_paths(&settings);
    if let Some(saved_path) = manual_vdf {
        let candidate = PathBuf::from(saved_path);
        if candidate.exists() {
            let last_modified = std::fs::metadata(&candidate)
                .ok()
                .and_then(|m| m.modified().ok())
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_secs() as i64);
            return Ok(serde_json::json!({
                "vdfPath": candidate.to_string_lossy().to_string(),
                "lastModified": last_modified
            }));
        }
    }

    Ok(serde_json::json!({
        "vdfPath": null,
        "lastModified": null
    }))
}

/// Obtém o caminho da biblioteca Steam runtime detectada/salva.
#[tauri::command]
pub async fn get_steam_dll_path(app_handle: AppHandle) -> Result<Option<String>, String> {
    if let Some(auto_path) = find_steam_runtime_library() {
        return Ok(Some(auto_path.to_string_lossy().to_string()));
    }

    let settings = load_settings(app_handle)
        .await
        .unwrap_or(serde_json::json!({}));
    let (_, manual_dll) = get_saved_steam_manual_paths(&settings);
    if let Some(saved_path) = manual_dll {
        let candidate = PathBuf::from(saved_path);
        if candidate.exists() {
            return Ok(Some(candidate.to_string_lossy().to_string()));
        }
    }

    Ok(None)
}

/// Seleciona manualmente o arquivo libraryfolders.vdf.
#[tauri::command]
pub async fn pick_steam_vdf_file(app_handle: AppHandle) -> Result<Option<String>, String> {
    let path = app_handle
        .dialog()
        .file()
        .set_title("Select Steam libraryfolders.vdf")
        .add_filter("VDF file", &["vdf"])
        .blocking_pick_file();

    Ok(path.and_then(|fp| fp.as_path().map(|p| p.to_string_lossy().to_string())))
}

/// Seleciona manualmente o arquivo da biblioteca Steam runtime.
#[tauri::command]
pub async fn pick_steam_dll_file(app_handle: AppHandle) -> Result<Option<String>, String> {
    #[cfg(target_os = "windows")]
    let path = app_handle
        .dialog()
        .file()
        .set_title("Select steam_api64.dll")
        .add_filter("DLL file", &["dll"])
        .blocking_pick_file();

    #[cfg(target_os = "linux")]
    let path = app_handle
        .dialog()
        .file()
        .set_title("Select libsteam_api.so")
        .add_filter("SO file", &["so"])
        .blocking_pick_file();

    #[cfg(not(any(target_os = "windows", target_os = "linux")))]
    let path = app_handle
        .dialog()
        .file()
        .set_title("Select Steam runtime library")
        .blocking_pick_file();

    Ok(path.and_then(|fp| fp.as_path().map(|p| p.to_string_lossy().to_string())))
}

/// Obtém o tamanho do cache
#[tauri::command]
pub async fn get_cache_size(app_handle: AppHandle) -> Result<String, String> {
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
pub async fn clear_cache(app_handle: AppHandle) -> Result<(), String> {
    CacheManager::clear_cache(&app_handle).map_err(|e| e.to_string())
}

/// Obtém informações do sistema
#[tauri::command]
pub async fn get_system_info() -> Result<serde_json::Value, String> {
    use sysinfo::System;

    let mut sys = System::new_all();

    // Refresh to ensure we have data
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
