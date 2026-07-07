use crate::integrations::hydra::HydraApi;
use crate::models::{HydraAchievement, SteamAchievement};
use anyhow::{Context, Result};
use reqwest::StatusCode;
use serde_json::Value;
use std::collections::HashMap;

pub struct SteamWebApi;

impl SteamWebApi {
    const STEAM_ID64_BASE: u64 = 76_561_197_960_265_728;

    pub fn normalize_steam_id(input: &str) -> Option<String> {
        let trimmed = input.trim();
        if trimmed.len() == 17 && trimmed.chars().all(|c| c.is_ascii_digit()) {
            return Some(trimmed.to_string());
        }

        if let Some(account_id) = trimmed
            .strip_prefix("[U:1:")
            .and_then(|value| value.strip_suffix(']'))
            .and_then(|value| value.parse::<u64>().ok())
        {
            return Some((Self::STEAM_ID64_BASE + account_id).to_string());
        }

        if trimmed.chars().all(|c| c.is_ascii_digit()) {
            if let Ok(account_id) = trimmed.parse::<u64>() {
                if account_id < Self::STEAM_ID64_BASE {
                    return Some((Self::STEAM_ID64_BASE + account_id).to_string());
                }
            }
        }

        None
    }

    pub fn is_player_achievements_forbidden(error: &anyhow::Error) -> bool {
        error
            .to_string()
            .contains("Steam player achievements request failed with status 403 Forbidden")
    }

    fn mask_steam_id(steam_id: &str) -> String {
        if steam_id.len() <= 8 {
            return "***".to_string();
        }
        format!("{}***{}", &steam_id[..4], &steam_id[steam_id.len() - 4..])
    }

    fn response_preview(body: &str) -> String {
        let normalized = body.split_whitespace().collect::<Vec<_>>().join(" ");
        normalized.chars().take(300).collect()
    }

    fn is_no_stats_response(body: &str) -> bool {
        serde_json::from_str::<Value>(body)
            .map(|value| Self::is_no_stats_value(&value))
            .unwrap_or_else(|_| body.contains("Requested app has no stats"))
    }

    fn is_no_stats_value(body: &Value) -> bool {
        body.get("playerstats")
            .and_then(|player_stats| player_stats.get("error"))
            .and_then(|error| error.as_str())
            .is_some_and(|error| error.eq_ignore_ascii_case("Requested app has no stats"))
    }

    async fn read_json_response(
        response: reqwest::Response,
        label: &str,
        app_id: u32,
    ) -> Result<Value> {
        let status = response.status();
        let content_type = response
            .headers()
            .get(reqwest::header::CONTENT_TYPE)
            .and_then(|value| value.to_str().ok())
            .unwrap_or("unknown")
            .to_string();
        let body_text = response
            .text()
            .await
            .with_context(|| format!("Failed to read {} response body", label))?;

        if !status.is_success() {
            return Err(anyhow::anyhow!(
                "{} request failed for app {} with status {} (content-type: {}, body: {})",
                label,
                app_id,
                status,
                content_type,
                Self::response_preview(&body_text)
            ));
        }

        serde_json::from_str::<Value>(&body_text).with_context(|| {
            format!(
                "Failed to parse {} response as JSON for app {} (status: {}, content-type: {}, body: {})",
                label,
                app_id,
                status,
                content_type,
                Self::response_preview(&body_text)
            )
        })
    }

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

        let response = client.get(&url).send().await.map_err(|e| {
            log::error!("Steam API Request Failed (reqwest): Error={:?}", e);
            anyhow::anyhow!("Network error: {}", e)
        })?;

        let body = Self::read_json_response(response, "Steam schema", app_id).await?;

        if !body.is_object() {
            log::warn!(
                "Steam schema response for app {} was not a JSON object",
                app_id
            );
        }

        let mut steam_achievements = Vec::new();
        let mut missing_name_count = 0usize;
        let mut missing_display_name_count = 0usize;
        let mut missing_description_count = 0usize;
        let mut missing_icon_count = 0usize;
        let mut missing_gray_icon_count = 0usize;

        let achievements_value = body
            .get("game")
            .and_then(|game| game.get("availableGameStats"))
            .and_then(|stats| stats.get("achievements"));

        let Some(achievements_value) = achievements_value else {
            log::info!(
                "Steam schema response for app {} did not expose achievement schema",
                app_id
            );

            return Ok(steam_achievements);
        };

        let Some(ach_array) = achievements_value.as_array() else {
            log::info!(
                "Steam schema response for app {} had achievements field, but it was not an array. Full payload: {}",
                app_id,
                body
            );
            return Ok(steam_achievements);
        };

        for ach in ach_array {
            let apiname = ach
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            if apiname.is_empty() {
                missing_name_count += 1;
                log::warn!(
                    "Steam schema response for app {} included an achievement without `name`: {}",
                    app_id,
                    ach
                );
                continue;
            }

            let display_name = ach
                .get("displayName")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            if display_name.is_none() {
                missing_display_name_count += 1;
            }
            let description = ach
                .get("description")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            if description.is_none() {
                missing_description_count += 1;
            }
            let icon = ach
                .get("icon")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            if icon.is_none() {
                missing_icon_count += 1;
            }
            let icongray = ach
                .get("icongray")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            if icongray.is_none() {
                missing_gray_icon_count += 1;
            }

            steam_achievements.push(SteamAchievement {
                apiname,
                achieved: 0,
                unlocktime: 0,
                name: display_name,
                description,
                icon,
                icongray,
                percent: 0.0,
                hidden: ach.get("hidden").and_then(|v| v.as_i64()).unwrap_or(0) == 1,
            });
        }

        if missing_name_count > 0
            || missing_display_name_count > 0
            || missing_description_count > 0
            || missing_icon_count > 0
            || missing_gray_icon_count > 0
        {
            log::info!(
                "Steam schema response for app {} was partial: missing_name={}, missing_displayName={}, missing_description={}, missing_icon={}, missing_icongray={}",
                app_id,
                missing_name_count,
                missing_display_name_count,
                missing_description_count,
                missing_icon_count,
                missing_gray_icon_count
            );
        }

        if steam_achievements.is_empty() {
            log::info!(
                "Steam schema response for app {} returned zero valid achievements",
                app_id
            );
        }

        if let Ok(hydra_result) = HydraApi::get_game_achievements(
            &app_id.to_string(),
            Some(&Self::map_language(language)),
        )
        .await
        {
            let hydra_map: HashMap<String, HydraAchievement> = hydra_result
                .achievements
                .into_iter()
                .map(|ach| (ach.name.clone(), ach))
                .collect();

            for steam_ach in &mut steam_achievements {
                if steam_ach
                    .description
                    .as_ref()
                    .map_or(true, |d| d.trim().is_empty())
                {
                    if let Some(hydra_ach) = hydra_map.get(&steam_ach.apiname) {
                        steam_ach.description = Some(hydra_ach.description.clone());
                    }
                }
            }
        } else {
            log::debug!(
                "Hydra fallback for app {} was unavailable; continuing with Steam schema only",
                app_id
            );
        }

        if let Ok(percentages) = percentages_result {
            let percent_map: HashMap<String, f64> = percentages.into_iter().collect();
            for ach in &mut steam_achievements {
                if let Some(p) = percent_map.get(&ach.apiname) {
                    ach.percent = *p;
                }
            }
        } else {
            log::debug!(
                "Global achievement percentages for app {} were unavailable",
                app_id
            );
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
        let normalized_steam_id = Self::normalize_steam_id(steam_id)
            .ok_or_else(|| anyhow::anyhow!("Invalid SteamID for Steam Web API"))?;
        let base_url = std::env::var("STEAM_API_URL")
            .unwrap_or_else(|_| "https://api.steampowered.com".to_string());

        let url = format!(
            "{}/ISteamUserStats/GetPlayerAchievements/v1/?key={}&appid={}&steamid={}",
            base_url,
            api_key.trim(),
            app_id,
            normalized_steam_id
        );

        log::info!(
            "Fetching Steam player achievements for app {} and SteamID {}",
            app_id,
            Self::mask_steam_id(&normalized_steam_id)
        );

        let client = crate::utils::http::get_client()
            .map_err(|e| anyhow::anyhow!("Failed to create HTTP client: {}", e))?;

        let response = client
            .get(&url)
            .send()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to fetch player stats: {}", e))?;

        let status = response.status();
        if !status.is_success() {
            let content_type = response
                .headers()
                .get(reqwest::header::CONTENT_TYPE)
                .and_then(|value| value.to_str().ok())
                .unwrap_or("unknown")
                .to_string();
            let body_text = response
                .text()
                .await
                .context("Failed to read Steam player achievements error body")?;

            if Self::is_no_stats_response(&body_text) {
                log::info!(
                    "Steam player achievements for app {} are unavailable because the app exposes no stats through Steam Web API",
                    app_id
                );
                return Ok(Vec::new());
            }

            if status == StatusCode::FORBIDDEN {
                return Err(anyhow::anyhow!(
                    "Steam player achievements request failed with status 403 Forbidden. Check if the Steam profile and Game details are public, and if the Web API key is valid for this account"
                ));
            }

            return Err(anyhow::anyhow!(
                "Steam player achievements request failed for app {} with status {} (content-type: {}, body: {})",
                app_id,
                status,
                content_type,
                Self::response_preview(&body_text)
            ));
        }

        let body = Self::read_json_response(response, "Steam player achievements", app_id).await?;

        if Self::is_no_stats_value(&body) {
            log::info!(
                "Steam player achievements for app {} are unavailable because the app exposes no stats through Steam Web API",
                app_id
            );
            return Ok(Vec::new());
        }

        let mut achievements = Vec::new();

        if let Some(player_stats) = body.get("playerstats") {
            if player_stats.get("success").and_then(|v| v.as_bool()) == Some(false) {
                let message = player_stats
                    .get("error")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Steam returned success=false for player achievements");
                return Err(anyhow::anyhow!(message.to_string()));
            }

            if let Some(ach_array) = player_stats.get("achievements").and_then(|v| v.as_array()) {
                if ach_array.is_empty() {
                    log::info!(
                        "Steam player achievements response for app {} contained an empty achievements array",
                        app_id
                    );
                }

                for ach in ach_array {
                    achievements.push(SteamAchievement {
                        apiname: ach
                            .get("apiname")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string(),
                        achieved: ach
                            .get("achieved")
                            .and_then(|v| {
                                v.as_i64()
                                    .map(|value| value as i32)
                                    .or_else(|| v.as_bool().map(|value| i32::from(value)))
                                    .or_else(|| {
                                        v.as_str().and_then(|value| value.parse::<i32>().ok())
                                    })
                            })
                            .unwrap_or(0),
                        unlocktime: ach.get("unlocktime").and_then(|v| v.as_i64()).unwrap_or(0),
                        name: None,
                        description: None,
                        icon: None,
                        icongray: None,
                        percent: 0.0,
                        hidden: false,
                    });
                }
            } else {
                log::info!(
                    "Steam player achievements response for app {} did not include a playerstats.achievements array",
                    app_id
                );
            }
        } else {
            log::info!(
                "Steam player achievements response for app {} did not include playerstats",
                app_id
            );
        }

        Ok(achievements)
    }

    /// Busca todos os jogos possuídos pelo jogador via Steam Web API
    pub async fn get_all_owned_games(
        api_key: &str,
        steam_id: &str,
    ) -> Result<Vec<super::steam_types::SteamGame>> {
        let normalized_steam_id = Self::normalize_steam_id(steam_id)
            .ok_or_else(|| anyhow::anyhow!("Invalid SteamID for Steam Web API"))?;
        let base_url = std::env::var("STEAM_API_URL")
            .unwrap_or_else(|_| "https://api.steampowered.com".to_string());

        let url = format!(
            "{}/IPlayerService/GetOwnedGames/v1/?key={}&steamid={}&include_appinfo=1&include_played_free_games=1&format=json",
            base_url,
            api_key.trim(),
            normalized_steam_id
        );

        log::info!(
            "Fetching all owned Steam games for SteamID {}",
            Self::mask_steam_id(&normalized_steam_id)
        );

        let client = crate::utils::http::get_client()
            .map_err(|e| anyhow::anyhow!("Failed to create HTTP client: {}", e))?;

        let response = client
            .get(&url)
            .send()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to fetch owned games: {}", e))?;

        let status = response.status();
        if !status.is_success() {
            let body_text = response
                .text()
                .await
                .context("Failed to read owned games error body")?;
            return Err(anyhow::anyhow!(
                "Steam owned games request failed with status {} (body: {})",
                status,
                Self::response_preview(&body_text)
            ));
        }

        let body: Value = response
            .json()
            .await
            .context("Failed to parse owned games response as JSON")?;

        let games_value = body
            .get("response")
            .and_then(|r| r.get("games"));

        let Some(games_array) = games_value.and_then(|g| g.as_array()) else {
            log::info!("Steam owned games response had no games array");
            return Ok(Vec::new());
        };

        let mut games = Vec::new();

        for game in games_array {
            let appid = game
                .get("appid")
                .and_then(|v| v.as_u64())
                .unwrap_or(0);
            if appid == 0 {
                continue;
            }

            let name = game
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            if name.is_empty() {
                continue;
            }

            let playtime_forever = game
                .get("playtime_forever")
                .and_then(|v| v.as_u64())
                .map(|v| v as u32);
            let playtime_2weeks = game
                .get("playtime_2weeks")
                .and_then(|v| v.as_u64())
                .map(|v| v as u32);
            let rtime_last_played = game
                .get("rtime_last_played")
                .and_then(|v| v.as_u64())
                .map(|v| v as u32);
            let img_icon_url = game
                .get("img_icon_url")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());

            games.push(super::steam_types::SteamGame {
                game_id: appid.to_string(),
                name,
                achievements_total: 0,
                achievements_current: 0,
                source: "steam".to_string(),
                library_path: String::new(),
                install_path: String::new(),
                installed: None,
                playtime_forever,
                playtime_2weeks,
                rtime_last_played,
                img_icon_url,
            });
        }

        log::info!(
            "Found {} owned Steam games via Steam Web API",
            games.len()
        );
        Ok(games)
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
        let response = client
            .get(&url)
            .send()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to fetch global stats: {}", e))?;

        let body =
            Self::read_json_response(response, "Steam global achievement percentages", app_id)
                .await?;

        let mut results = Vec::new();
        if let Some(root) = body.get("achievementpercentages") {
            if let Some(list) = root.get("achievements").and_then(|v| v.as_array()) {
                for item in list {
                    if let (Some(name), Some(percent)) = (
                        item.get("name").and_then(|n| n.as_str()),
                        item.get("percent").and_then(|p| p.as_f64()),
                    ) {
                        results.push((name.to_string(), percent));
                    }
                }
            }
        }
        Ok(results)
    }
}
