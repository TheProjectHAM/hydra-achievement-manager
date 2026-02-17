use super::language::{map_ui_language_to_steam_store_lang, read_language_from_settings};
use crate::models::SteamGameSearchResult;
use crate::utils::CacheManager;
use serde_json::Value;
use std::collections::HashMap;
use tauri::AppHandle;

/// Função interna para obter o nome de um jogo
async fn fetch_game_name_internal(game_id: &str, steam_store_language: &str) -> Result<String, String> {
    let base_url =
        std::env::var("STEAM_STORE_API_URL").unwrap_or_else(|_| "https://store.steampowered.com/api".to_string());

    let url = format!("{}/appdetails?appids={}&l={}", base_url, game_id, steam_store_language);

    let client = crate::utils::http::get_client().map_err(|e| format!("Failed to create HTTP client: {}", e))?;

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
    if let Some(cached) = CacheManager::get_game(&app_handle, &game_id) {
        if let Some(name) = cached.name {
            return Ok(name);
        }
    }

    let language = read_language_from_settings(&app_handle);
    let steam_store_language = map_ui_language_to_steam_store_lang(&language);

    match fetch_game_name_internal(&game_id, steam_store_language).await {
        Ok(name) => {
            let _ =
                CacheManager::update_game(&app_handle, game_id.clone(), Some(name.clone()), None, None, None);
            Ok(name)
        }
        Err(_) => Ok(game_id),
    }
}

/// Obtém nomes de múltiplos jogos
#[tauri::command]
pub async fn get_game_names(game_ids: Vec<String>, app_handle: AppHandle) -> Result<HashMap<String, String>, String> {
    let mut names = HashMap::new();
    let mut missing_ids: Vec<String> = Vec::new();
    let language = read_language_from_settings(&app_handle);
    let steam_store_language = map_ui_language_to_steam_store_lang(&language);

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

    for game_id in missing_ids {
        match fetch_game_name_internal(&game_id, steam_store_language).await {
            Ok(name) => {
                let _ =
                    CacheManager::update_game(&app_handle, game_id.clone(), Some(name.clone()), None, None, None);
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
pub async fn search_steam_games(query: String, app_handle: AppHandle) -> Result<Vec<SteamGameSearchResult>, String> {
    let trimmed_query = query.trim();
    let mut results = Vec::new();
    let language = read_language_from_settings(&app_handle);
    let steam_store_language = map_ui_language_to_steam_store_lang(&language);

    if let Ok(app_id) = trimmed_query.parse::<u32>() {
        let base_url =
            std::env::var("STEAM_STORE_API_URL").unwrap_or_else(|_| "https://store.steampowered.com/api".to_string());

        let url = format!("{}/appdetails?appids={}&l={}", base_url, app_id, steam_store_language);

        let client = crate::utils::http::get_client().map_err(|e| format!("Failed to create HTTP client: {}", e))?;

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

    let base_url = std::env::var("STEAM_STORE_API_URL").unwrap_or_else(|_| "https://store.steampowered.com/api".to_string());

    let search_url = format!(
        "{}/storesearch/?term={}&l={}&cc=us&snr=1_4_4__12",
        base_url,
        urlencoding::encode(trimmed_query),
        steam_store_language
    );

    let search_client = crate::utils::http::get_client().map_err(|e| format!("Failed to create HTTP client: {}", e))?;

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
