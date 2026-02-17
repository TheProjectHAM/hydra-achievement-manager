use crate::api::hydra::HydraAPI;
use crate::models::{HydraAchievement, SteamAchievement};
use anyhow::{Context, Result};
use serde_json::Value;
use std::collections::HashMap;



pub struct SteamAPI;

impl SteamAPI {
    /// Busca achievements de um jogo usando a API Steam
    pub async fn get_game_achievements(
        app_id: u32,
        api_key: &str,
        language: &str,
    ) -> Result<Vec<SteamAchievement>> {
        let base_url = std::env::var("STEAM_API_URL")
            .unwrap_or_else(|_| "https://api.steampowered.com".to_string());

        let url = format!(
            "{}/ISteamUserStats/GetSchemaForGame/v2/?key={}&appid={}&l={}",
            base_url, api_key, app_id, language
        );

        // Fetch global percentages in parallel if possible, but for simplicity here we can fetch sequentially or use tokio::spawn
        let percentages_result = Self::get_global_achievement_percentages(app_id).await;


        log::info!("Fetching Steam achievements via reqwest for app {}", app_id);

        let client = crate::utils::http::get_client().map_err(|e| {
             log::error!("Failed to create HTTP client: {}", e);
             anyhow::anyhow!("Internal HTTP client error: {}", e)
        })?;

        let response = client.get(&url).send().await
            .map_err(|e| {
                log::error!("Steam API Request Failed (reqwest): Error={:?}", e);
                anyhow::anyhow!("Network error: {}", e)
            })?;

        let body: Value = response.json().await
            .context("Failed to parse Steam API response")?;

        // Extrai achievements do response
        let mut steam_achievements = Vec::new();

        if let Some(game) = body.get("game") {
            if let Some(stats) = game.get("availableGameStats") {
                if let Some(achievements) = stats.get("achievements") {
                    if let Some(ach_array) = achievements.as_array() {
                        for ach in ach_array {
                            steam_achievements.push(SteamAchievement {
                                apiname: ach
                                    .get("name")
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("")
                                    .to_string(),
                                achieved: 0,
                                unlocktime: 0,
                                name: ach
                                    .get("displayName")
                                    .and_then(|v| v.as_str())
                                    .map(|s| s.to_string()),
                                description: ach
                                    .get("description")
                                    .and_then(|v| v.as_str())
                                    .map(|s| s.to_string()),
                                icon: ach
                                    .get("icon")
                                    .and_then(|v| v.as_str())
                                    .map(|s| s.to_string()),
                                icongray: ach
                                    .get("icongray")
                                    .and_then(|v| v.as_str())
                                    .map(|s| s.to_string()),
                                percent: 0.0,
                                hidden: ach.get("hidden").and_then(|v| v.as_i64()).unwrap_or(0) == 1,
                            });
                        }
                    }
                }
            }
        }

        // Busca achievements da Hydra para fallback de descrições
        if let Ok(hydra_result) =
            HydraAPI::get_game_achievements(&app_id.to_string(), Some(&Self::map_language(language)))
                .await
        {
            let hydra_map: HashMap<String, HydraAchievement> = hydra_result
                .achievements
                .into_iter()
                .map(|ach| (ach.name.clone(), ach))
                .collect();

            // Preenche descrições vazias com dados da Hydra
            for steam_ach in &mut steam_achievements {
                if steam_ach.description.as_ref().map_or(true, |d| d.trim().is_empty()) {
                    if let Some(hydra_ach) = hydra_map.get(&steam_ach.apiname) {
                        steam_ach.description = Some(hydra_ach.description.clone());
                    }
                }
            }
        }



        // Apply percentages
        if let Ok(percentages) = percentages_result {
            let percent_map: HashMap<String, f64> = percentages.into_iter().collect();
            for ach in &mut steam_achievements {
                if let Some(p) = percent_map.get(&ach.apiname) {
                    ach.percent = *p;
                }
            }
        }

        Ok(steam_achievements)
    }

    /// Mapeia linguagem Steam para Hydra
    fn map_language(steam_lang: &str) -> String {
        match steam_lang.to_lowercase().as_str() {
            "english" => "en",
            "spanish" => "es",
            "russian" => "ru",
            "portuguese" | "brazilian" => "pt",
            _ => "en",
        }
        .to_string()
    }

    /// Busca status de achievements de um jogador usando a API Steam
    pub async fn get_player_achievements(
        app_id: u32,
        api_key: &str,
        steam_id: &str,
    ) -> Result<Vec<SteamAchievement>> {
        let base_url = std::env::var("STEAM_API_URL")
            .unwrap_or_else(|_| "https://api.steampowered.com".to_string());

        let url = format!(
            "{}/ISteamUserStats/GetPlayerAchievements/v1/?key={}&appid={}&steamid={}",
            base_url, api_key, app_id, steam_id
        );

        let client = crate::utils::http::get_client().map_err(|e| anyhow::anyhow!("Failed to create HTTP client: {}", e))?;

        let response = client.get(&url).send().await
            .map_err(|e| anyhow::anyhow!("Failed to fetch player stats: {}", e))?;

        let body: Value = response.json().await
            .context("Failed to parse player achievements response")?;

        let mut achievements = Vec::new();

        if let Some(player_stats) = body.get("playerstats") {
            if let Some(ach_array) = player_stats.get("achievements").and_then(|v| v.as_array()) {
                for ach in ach_array {
                    achievements.push(SteamAchievement {
                        apiname: ach.get("apiname").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                        achieved: ach.get("achieved").and_then(|v| v.as_i64()).unwrap_or(0) as i32,
                        unlocktime: ach.get("unlocktime").and_then(|v| v.as_i64()).unwrap_or(0),
                        name: None,
                        description: None,
                        icon: None,
                        icongray: None,
                        percent: 0.0,
                        hidden: false,
                    });
                }
            }
        }

        Ok(achievements)
    }

    /// Busca porcentagens globais de achievements
    pub async fn get_global_achievement_percentages(app_id: u32) -> Result<Vec<(String, f64)>> {
        let base_url = std::env::var("STEAM_API_URL")
            .unwrap_or_else(|_| "https://api.steampowered.com".to_string());

        let url = format!(
            "{}/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v0002/?gameid={}&format=json",
            base_url, app_id
        );

        let client = crate::utils::http::get_client()?;
        let response = client.get(&url).send().await
            .map_err(|e| anyhow::anyhow!("Failed to fetch global stats: {}", e))?;

        let body: Value = response.json().await
            .context("Failed to parse global stats response")?;

        let mut results = Vec::new();
        if let Some(root) = body.get("achievementpercentages") {
            if let Some(list) = root.get("achievements").and_then(|v| v.as_array()) {
                for item in list {
                    if let (Some(name), Some(percent)) = (
                        item.get("name").and_then(|n| n.as_str()),
                        item.get("percent").and_then(|p| p.as_f64())
                    ) {
                        results.push((name.to_string(), percent));
                    }
                }
            }
        }
        Ok(results)
    }
}
