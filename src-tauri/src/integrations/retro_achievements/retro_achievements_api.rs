use super::retro_achievements_types::{
    RetroAchievement, RetroAchievementsCredentials, RetroAchievementsGame,
    RetroAchievementsProfile, RetroAchievementsSearchResult,
};
use anyhow::{Context, Result};
use serde_json::Value;
use std::collections::HashMap;

pub struct RetroAchievementsApi;

impl RetroAchievementsApi {
    const DEFAULT_BASE_URL: &'static str = "https://retroachievements.org/API";
    const DEFAULT_MEDIA_URL: &'static str = "https://media.retroachievements.org";

    pub async fn get_profile(
        credentials: &RetroAchievementsCredentials,
    ) -> Result<RetroAchievementsProfile> {
        let body = Self::get_json(
            "API_GetUserProfile.php",
            &[
                ("u", credentials.username.as_str()),
                ("z", credentials.username.as_str()),
                ("y", credentials.api_key.as_str()),
            ],
        )
        .await?;

        Ok(RetroAchievementsProfile {
            username: body
                .get("User")
                .or_else(|| body.get("UserName"))
                .and_then(Value::as_str)
                .unwrap_or(&credentials.username)
                .to_string(),
            display_name: body
                .get("DisplayName")
                .or_else(|| body.get("User"))
                .and_then(Value::as_str)
                .unwrap_or(&credentials.username)
                .to_string(),
            avatar_url: body
                .get("UserPic")
                .and_then(Value::as_str)
                .map(Self::media_url),
            motto: body
                .get("Motto")
                .and_then(Value::as_str)
                .map(str::to_string),
            points: value_to_u32(body.get("TotalPoints")).unwrap_or(0),
            softcore_points: value_to_u32(body.get("TotalSoftcorePoints")).unwrap_or(0),
        })
    }

    pub async fn search_games(
        credentials: Option<&RetroAchievementsCredentials>,
        query: &str,
    ) -> Result<Vec<RetroAchievementsSearchResult>> {
        let trimmed = query.trim();
        if trimmed.is_empty() {
            return Ok(Vec::new());
        }

        if let Ok(game_id) = trimmed.parse::<u32>() {
            if let Ok(game) = Self::get_game_summary(credentials, game_id).await {
                return Ok(vec![RetroAchievementsSearchResult {
                    id: game.id,
                    title: game.title,
                    console_id: game.console_id,
                    console_name: game.console_name,
                    image_icon: game.image_icon,
                    image_box_art: game.image_box_art,
                    achievements_total: game.achievements_total,
                }]);
            }
        }

        let mut results = Vec::new();
        let consoles = [1_u32, 2, 3, 4, 5, 7, 8, 12, 21, 24, 27, 41];
        let query_lower = trimmed.to_lowercase();

        for console_id in consoles {
            let mut params = vec![("i", console_id.to_string())];
            let auth;
            if let Some(credentials) = credentials {
                auth = vec![
                    ("z", credentials.username.clone()),
                    ("y", credentials.api_key.clone()),
                ];
                params.extend(auth.iter().map(|(k, v)| (*k, v.clone())));
            }

            let params_ref: Vec<(&str, &str)> =
                params.iter().map(|(k, v)| (*k, v.as_str())).collect();
            let Ok(body) = Self::get_json("API_GetGameList.php", &params_ref).await else {
                continue;
            };

            let Some(items) = body.as_array() else {
                continue;
            };

            for item in items {
                let title = item
                    .get("Title")
                    .or_else(|| item.get("GameTitle"))
                    .and_then(Value::as_str)
                    .unwrap_or("");
                if !title.to_lowercase().contains(&query_lower) {
                    continue;
                }

                let id = value_to_u32(item.get("ID").or_else(|| item.get("GameID"))).unwrap_or(0);
                if id == 0
                    || results
                        .iter()
                        .any(|game: &RetroAchievementsSearchResult| game.id == id)
                {
                    continue;
                }

                results.push(RetroAchievementsSearchResult {
                    id,
                    title: title.to_string(),
                    console_id: value_to_u32(item.get("ConsoleID")).or(Some(console_id)),
                    console_name: item
                        .get("ConsoleName")
                        .and_then(Value::as_str)
                        .map(str::to_string),
                    image_icon: item
                        .get("ImageIcon")
                        .and_then(Value::as_str)
                        .map(Self::media_url),
                    image_box_art: item
                        .get("ImageBoxArt")
                        .and_then(Value::as_str)
                        .map(Self::media_url),
                    achievements_total: value_to_u32(item.get("NumAchievements")).unwrap_or(0),
                });

                if results.len() >= 50 {
                    return Ok(results);
                }
            }
        }

        Ok(results)
    }

    pub async fn get_recent_games(
        credentials: &RetroAchievementsCredentials,
    ) -> Result<Vec<RetroAchievementsGame>> {
        let body = Self::get_json(
            "API_GetUserRecentlyPlayedGames.php",
            &[
                ("u", credentials.username.as_str()),
                ("c", "24"),
                ("z", credentials.username.as_str()),
                ("y", credentials.api_key.as_str()),
            ],
        )
        .await?;

        let Some(items) = body.as_array() else {
            return Ok(Vec::new());
        };

        Ok(items.iter().filter_map(Self::game_from_value).collect())
    }

    pub async fn get_game_summary(
        credentials: Option<&RetroAchievementsCredentials>,
        game_id: u32,
    ) -> Result<RetroAchievementsGame> {
        let body = if let Some(credentials) = credentials {
            Self::get_json(
                "API_GetGameInfoAndUserProgress.php",
                &[
                    ("u", credentials.username.as_str()),
                    ("g", &game_id.to_string()),
                    ("z", credentials.username.as_str()),
                    ("y", credentials.api_key.as_str()),
                ],
            )
            .await?
        } else {
            Self::get_json("API_GetGame.php", &[("i", &game_id.to_string())]).await?
        };

        Self::game_from_value(&body)
            .ok_or_else(|| anyhow::anyhow!("RetroAchievements game not found"))
    }

    pub async fn get_game_achievements(
        credentials: Option<&RetroAchievementsCredentials>,
        game_id: u32,
    ) -> Result<Vec<RetroAchievement>> {
        let body = if let Some(credentials) = credentials {
            Self::get_json(
                "API_GetGameInfoAndUserProgress.php",
                &[
                    ("u", credentials.username.as_str()),
                    ("g", &game_id.to_string()),
                    ("z", credentials.username.as_str()),
                    ("y", credentials.api_key.as_str()),
                ],
            )
            .await?
        } else {
            Self::get_json("API_GetGameExtended.php", &[("i", &game_id.to_string())]).await?
        };

        let unlocks = Self::unlock_map(&body);
        let Some(achievements) = body.get("Achievements").and_then(Value::as_object) else {
            return Ok(Vec::new());
        };

        let mut parsed = Vec::with_capacity(achievements.len());
        for (id, achievement) in achievements {
            let badge_name = achievement
                .get("BadgeName")
                .and_then(Value::as_str)
                .map(str::to_string);
            let unlock_time = unlocks.get(id).copied().unwrap_or(0);
            let badge = badge_name.as_deref().unwrap_or("");
            let icon = Self::badge_url(badge, false);
            let icon_locked = Self::badge_url(badge, true);

            parsed.push(RetroAchievement {
                id: id.clone(),
                title: achievement
                    .get("Title")
                    .and_then(Value::as_str)
                    .unwrap_or(id)
                    .to_string(),
                description: achievement
                    .get("Description")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .to_string(),
                badge_name,
                icon,
                icon_locked,
                points: value_to_u32(achievement.get("Points")).unwrap_or(0),
                true_ratio: value_to_u32(achievement.get("TrueRatio")).unwrap_or(0),
                display_order: value_to_u32(achievement.get("DisplayOrder")).unwrap_or(0),
                unlocked: unlock_time > 0,
                unlock_time,
            });
        }

        parsed.sort_by_key(|achievement| achievement.display_order);
        Ok(parsed)
    }

    fn game_from_value(value: &Value) -> Option<RetroAchievementsGame> {
        let id = value_to_u32(
            value
                .get("ID")
                .or_else(|| value.get("GameID"))
                .or_else(|| value.get("GameId")),
        )?;
        let title = value
            .get("Title")
            .or_else(|| value.get("GameTitle"))
            .and_then(Value::as_str)
            .unwrap_or(&id.to_string())
            .to_string();
        let total = value_to_u32(
            value
                .get("NumAchievements")
                .or_else(|| value.get("NumPossibleAchievements")),
        )
        .unwrap_or_else(|| {
            value
                .get("Achievements")
                .and_then(Value::as_object)
                .map(|items| items.len() as u32)
                .unwrap_or(0)
        });
        let current = value_to_u32(
            value
                .get("NumAchieved")
                .or_else(|| value.get("NumAwardedToUser")),
        )
        .unwrap_or(0);

        Some(RetroAchievementsGame {
            id,
            title,
            console_id: value_to_u32(value.get("ConsoleID")),
            console_name: value
                .get("ConsoleName")
                .and_then(Value::as_str)
                .map(str::to_string),
            image_icon: value
                .get("ImageIcon")
                .and_then(Value::as_str)
                .map(Self::media_url),
            image_box_art: value
                .get("ImageBoxArt")
                .and_then(Value::as_str)
                .map(Self::media_url),
            achievements_total: total,
            achievements_current: current,
        })
    }

    fn unlock_map(body: &Value) -> HashMap<String, i64> {
        let mut unlocks = HashMap::new();
        for key in ["Awarded", "AwardedHardcore"] {
            let Some(items) = body.get(key).and_then(Value::as_object) else {
                continue;
            };
            for (id, value) in items {
                let unlock_time = value_to_i64(Some(value)).unwrap_or(0);
                if unlock_time > 0 {
                    unlocks.insert(id.clone(), unlock_time);
                }
            }
        }
        unlocks
    }

    async fn get_json(endpoint: &str, params: &[(&str, &str)]) -> Result<Value> {
        let base_url = std::env::var("RETROACHIEVEMENTS_API_URL")
            .unwrap_or_else(|_| Self::DEFAULT_BASE_URL.to_string());
        let url = format!("{}/{}", base_url.trim_end_matches('/'), endpoint);
        let client = crate::utils::http::get_client()?;
        let response = client
            .get(&url)
            .query(params)
            .send()
            .await
            .with_context(|| format!("Failed to fetch RetroAchievements endpoint {}", endpoint))?;

        let status = response.status();
        let body = response
            .text()
            .await
            .context("Failed to read RetroAchievements response")?;
        if !status.is_success() {
            return Err(anyhow::anyhow!(
                "RetroAchievements request {} failed with status {}: {}",
                endpoint,
                status,
                body.chars().take(240).collect::<String>()
            ));
        }

        serde_json::from_str(&body).with_context(|| {
            format!(
                "Failed to parse RetroAchievements response for {}",
                endpoint
            )
        })
    }

    fn media_url(path: &str) -> String {
        if path.starts_with("http://") || path.starts_with("https://") {
            return path.to_string();
        }
        format!(
            "{}{}{}",
            Self::DEFAULT_MEDIA_URL,
            if path.starts_with('/') { "" } else { "/" },
            path
        )
    }

    fn badge_url(badge_name: &str, locked: bool) -> String {
        if badge_name.is_empty() {
            return String::new();
        }
        let suffix = if locked { "_lock" } else { "" };
        format!(
            "{}/Badge/{}{}.png",
            Self::DEFAULT_MEDIA_URL,
            badge_name,
            suffix
        )
    }
}

fn value_to_u32(value: Option<&Value>) -> Option<u32> {
    value.and_then(|value| {
        value
            .as_u64()
            .map(|number| number as u32)
            .or_else(|| value.as_str().and_then(|text| text.parse::<u32>().ok()))
    })
}

fn value_to_i64(value: Option<&Value>) -> Option<i64> {
    value.and_then(|value| {
        value
            .as_i64()
            .or_else(|| value.as_u64().map(|number| number as i64))
            .or_else(|| value.as_str().and_then(|text| text.parse::<i64>().ok()))
    })
}
