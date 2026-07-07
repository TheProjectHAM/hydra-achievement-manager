use super::retro_achievements_types::{
    RetroAchievement, RetroAchievementsAwardRequest, RetroAchievementsAwardResponseInner,
    RetroAchievementsCredentials, RetroAchievementsGame, RetroAchievementsPatchDataProbe,
    RetroAchievementsPatchMemAddrSample, RetroAchievementsProfile, RetroAchievementsRuntimeLogin,
    RetroAchievementsSearchResult,
};
use anyhow::{Context, Result};
use chrono::NaiveDateTime;
use md5::{Digest, Md5};
use serde_json::Value;
use std::collections::HashMap;

pub struct RetroAchievementsApi;

impl RetroAchievementsApi {
    const DEFAULT_BASE_URL: &'static str = "https://retroachievements.org/API";
    const DEFAULT_DOREQUEST_URL: &'static str = "https://retroachievements.org/dorequest.php";
    const DEFAULT_SITE_URL: &'static str = "https://retroachievements.org";
    const DEFAULT_MEDIA_URL: &'static str = "https://media.retroachievements.org";

    pub async fn runtime_login_with_password(
        username: &str,
        password: &str,
    ) -> Result<RetroAchievementsRuntimeLogin> {
        Self::runtime_login(username, "p", password).await
    }

    pub async fn runtime_login_with_token(
        username: &str,
        token: &str,
    ) -> Result<RetroAchievementsRuntimeLogin> {
        Self::runtime_login(username, "t", token).await
    }

    pub async fn probe_patch_data(
        username: &str,
        runtime_token: &str,
        game_id: u32,
    ) -> Result<RetroAchievementsPatchDataProbe> {
        let game_id_text = game_id.to_string();
        let body = Self::post_dorequest_json(
            &[
                ("r", "patch"),
                ("u", username),
                ("t", runtime_token),
                ("g", game_id_text.as_str()),
            ],
            "patch",
        )
        .await?;

        Self::ensure_success(&body, "patch")?;

        let achievements_value = body
            .get("PatchData")
            .and_then(|patch| patch.get("Achievements"))
            .or_else(|| body.get("Achievements"));

        let achievements: Vec<(&str, &Value)> = match achievements_value {
            Some(Value::Array(items)) => items
                .iter()
                .enumerate()
                .map(|(_index, item)| (item.get("ID").and_then(Value::as_str).unwrap_or(""), item))
                .map(|(id, item)| {
                    if id.is_empty() {
                        ("", item)
                    } else {
                        (id, item)
                    }
                })
                .collect(),
            Some(Value::Object(items)) => items.iter().map(|(id, item)| (id.as_str(), item)).collect(),
            _ => Vec::new(),
        };

        let mut mem_addr_count = 0;
        let mut trigger_like_count = 0;
        let mut md5_like_count = 0;
        let mut samples = Vec::new();

        for (index, (id, achievement)) in achievements.iter().enumerate() {
            let Some(mem_addr) = achievement
                .get("MemAddr")
                .or_else(|| achievement.get("memAddr"))
                .and_then(Value::as_str)
            else {
                continue;
            };

            mem_addr_count += 1;
            let is_md5_like = is_md5_like(mem_addr);
            if is_md5_like {
                md5_like_count += 1;
            } else {
                trigger_like_count += 1;
            }

            if samples.len() < 5 {
                let achievement_id = if id.is_empty() {
                    achievement
                        .get("ID")
                        .and_then(|value| value_to_u32(Some(value)))
                        .map(|id| id.to_string())
                        .unwrap_or_else(|| index.to_string())
                } else {
                    id.to_string()
                };

                samples.push(RetroAchievementsPatchMemAddrSample {
                    achievement_id,
                    length: mem_addr.len(),
                    value_class: if is_md5_like { "md5-like" } else { "trigger-like" }.to_string(),
                    preview: mem_addr.chars().take(120).collect(),
                });
            }
        }

        Ok(RetroAchievementsPatchDataProbe {
            game_id,
            achievement_count: achievements.len(),
            mem_addr_count,
            trigger_like_count,
            md5_like_count,
            samples,
        })
    }

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

    pub async fn get_library_games(
        credentials: &RetroAchievementsCredentials,
    ) -> Result<Vec<RetroAchievementsGame>> {
        let body = Self::get_json(
            "API_GetUserRecentlyPlayedGames.php",
            &[
                ("u", credentials.username.as_str()),
                ("c", "100"),
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
                    ("a", "1"),
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
            let unlock_time = achievement_unlock_time(achievement)
                .or_else(|| unlocks.get(id).copied())
                .unwrap_or(0);
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

    async fn runtime_login(
        username: &str,
        secret_param: &str,
        secret: &str,
    ) -> Result<RetroAchievementsRuntimeLogin> {
        let trimmed_username = username.trim();
        let trimmed_secret = secret.trim();
        if trimmed_username.is_empty() || trimmed_secret.is_empty() {
            return Err(anyhow::anyhow!("RetroAchievements username and secret are required"));
        }

        let body = Self::post_dorequest_json(
            &[
                ("r", "login2"),
                ("u", trimmed_username),
                (secret_param, trimmed_secret),
            ],
            "login2",
        )
        .await?;

        Self::ensure_success(&body, "login2")?;

        let token = body
            .get("Token")
            .and_then(Value::as_str)
            .ok_or_else(|| anyhow::anyhow!("RetroAchievements login did not return a token"))?;

        Ok(RetroAchievementsRuntimeLogin {
            username: body
                .get("User")
                .and_then(Value::as_str)
                .unwrap_or(trimmed_username)
                .to_string(),
            token: token.to_string(),
            score: value_to_u32(body.get("Score")).unwrap_or(0),
            softcore_score: value_to_u32(body.get("SoftcoreScore")).unwrap_or(0),
            messages: value_to_u32(body.get("Messages")).unwrap_or(0),
            avatar_url: body
                .get("AvatarUrl")
                .and_then(Value::as_str)
                .map(str::to_string),
        })
    }

    async fn post_dorequest_json(params: &[(&str, &str)], operation: &str) -> Result<Value> {
        let url = std::env::var("RETROACHIEVEMENTS_DOREQUEST_URL")
            .unwrap_or_else(|_| Self::DEFAULT_DOREQUEST_URL.to_string());
        let client = crate::utils::http::get_client()?;
        let response = client
            .post(&url)
            .header(reqwest::header::USER_AGENT, "ProjectHAM rcheevos-runtime")
            .header(reqwest::header::ACCEPT, "application/json, text/plain, */*")
            .form(params)
            .send()
            .await
            .with_context(|| format!("Failed to call RetroAchievements {}", operation))?;

        let status = response.status();
        let body = response
            .text()
            .await
            .context("Failed to read RetroAchievements response")?;
        if !status.is_success() {
            return Err(anyhow::anyhow!(
                "RetroAchievements {} failed with status {}: {}",
                operation,
                status,
                body.chars().take(240).collect::<String>()
            ));
        }

        serde_json::from_str(&body)
            .with_context(|| format!("Failed to parse RetroAchievements {} response", operation))
    }

    fn ensure_success(body: &Value, operation: &str) -> Result<()> {
        if body.get("Success").and_then(Value::as_bool).unwrap_or(false) {
            return Ok(());
        }

        let error = body
            .get("Error")
            .and_then(Value::as_str)
            .unwrap_or("Unknown RetroAchievements error");
        Err(anyhow::anyhow!(
            "RetroAchievements {} failed: {}",
            operation,
            error
        ))
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

    pub async fn award_achievement(
        request: &RetroAchievementsAwardRequest,
    ) -> Result<RetroAchievementsAwardResponseInner> {
        let achievement_id_text = request.achievement_id.to_string();
        let hardcore_text = if request.hardcore { "1" } else { "0" };

        let mut hasher = Md5::new();
        hasher.update(&achievement_id_text);
        hasher.update(request.username.as_bytes());
        hasher.update(hardcore_text.as_bytes());
        let digest = hasher.finalize();
        let signature = digest.iter().map(|b| format!("{:02x}", b)).collect::<String>();

        let mut params = vec![
            ("r", "awardachievement"),
            ("u", request.username.as_str()),
            ("t", request.runtime_token.as_str()),
            ("a", achievement_id_text.as_str()),
            ("h", hardcore_text),
            ("v", signature.as_str()),
        ];

        if let Some(ref game_hash) = request.game_hash {
            params.push(("m", game_hash.as_str()));
        }

        let body = Self::post_dorequest_json(&params, "awardachievement").await?;

        let success = body.get("Success").and_then(Value::as_bool).unwrap_or(false);
        let error = body.get("Error").and_then(Value::as_str).map(str::to_string);

        if !success {
            if let Some(ref msg) = error {
                if msg.contains("User already has") {
                    return Ok(RetroAchievementsAwardResponseInner {
                        success: true,
                        error: None,
                        score: value_to_u32(body.get("Score")),
                        softcore_score: value_to_u32(body.get("SoftcoreScore")),
                        achievement_id: value_to_u32(body.get("AchievementID")),
                        achievements_remaining: value_to_u32(body.get("AchievementsRemaining")),
                    });
                }
            }
            return Err(anyhow::anyhow!(
                "RetroAchievements awardachievement failed: {}",
                error.as_deref().unwrap_or("Unknown error")
            ));
        }

        Ok(RetroAchievementsAwardResponseInner {
            success: true,
            error: None,
            score: value_to_u32(body.get("Score")),
            softcore_score: value_to_u32(body.get("SoftcoreScore")),
            achievement_id: value_to_u32(body.get("AchievementID")),
            achievements_remaining: value_to_u32(body.get("AchievementsRemaining")),
        })
    }

    pub async fn delete_achievement_unlock(
        achievement_id: u32,
        web_cookie: &str,
        xsrf_token: Option<&str>,
    ) -> Result<Value> {
        Self::delete_internal_api(
            &format!("/internal-api/user/achievement/{}", achievement_id),
            web_cookie,
            xsrf_token,
        )
        .await
    }

    pub async fn delete_game_unlocks(
        game_id: u32,
        web_cookie: &str,
        xsrf_token: Option<&str>,
    ) -> Result<Value> {
        Self::delete_internal_api(
            &format!("/internal-api/user/game/{}", game_id),
            web_cookie,
            xsrf_token,
        )
        .await
    }

    async fn delete_internal_api(
        path: &str,
        web_cookie: &str,
        xsrf_token: Option<&str>,
    ) -> Result<Value> {
        let cookie = web_cookie.trim();
        if cookie.is_empty() {
            return Err(anyhow::anyhow!("RetroAchievements web cookie is required"));
        }

        let xsrf = xsrf_token
            .and_then(|token| (!token.trim().is_empty()).then(|| token.trim().to_string()))
            .or_else(|| extract_xsrf_token_from_cookie(cookie));

        let Some(xsrf) = xsrf else {
            return Err(anyhow::anyhow!("RetroAchievements XSRF token is required"));
        };

        let base_url = std::env::var("RETROACHIEVEMENTS_SITE_URL")
            .unwrap_or_else(|_| Self::DEFAULT_SITE_URL.to_string());
        let url = format!("{}{}", base_url.trim_end_matches('/'), path);
        let client = crate::utils::http::get_client()?;
        let response = client
            .delete(&url)
            .header(reqwest::header::USER_AGENT, "Mozilla/5.0")
            .header(reqwest::header::ACCEPT, "application/json, text/plain, */*")
            .header(reqwest::header::ORIGIN, base_url.trim_end_matches('/'))
            .header(reqwest::header::REFERER, format!("{}/settings", base_url.trim_end_matches('/')))
            .header(reqwest::header::COOKIE, cookie)
            .header("X-XSRF-TOKEN", xsrf)
            .send()
            .await
            .with_context(|| format!("Failed to call RetroAchievements {}", path))?;

        let status = response.status();
        let body = response
            .text()
            .await
            .context("Failed to read RetroAchievements response")?;

        if !status.is_success() {
            return Err(anyhow::anyhow!(
                "RetroAchievements delete failed with status {}: {}",
                status,
                body.chars().take(240).collect::<String>()
            ));
        }

        serde_json::from_str(&body).or_else(|_| Ok(serde_json::json!({ "success": true })))
    }
}

fn is_md5_like(value: &str) -> bool {
    value.len() == 32 && value.bytes().all(|byte| byte.is_ascii_hexdigit())
}

fn achievement_unlock_time(achievement: &Value) -> Option<i64> {
    [
        "DateEarned",
        "dateEarned",
        "DateEarnedHardcore",
        "dateEarnedHardcore",
    ]
    .iter()
    .find_map(|key| parse_ra_datetime(achievement.get(*key)?))
}

fn parse_ra_datetime(value: &Value) -> Option<i64> {
    if let Some(timestamp) = value_to_i64(Some(value)) {
        return (timestamp > 0).then_some(timestamp);
    }

    let text = value.as_str()?.trim();
    if text.is_empty() {
        return None;
    }

    NaiveDateTime::parse_from_str(text, "%Y-%m-%d %H:%M:%S")
        .ok()
        .map(|datetime| datetime.and_utc().timestamp())
}

fn extract_xsrf_token_from_cookie(cookie: &str) -> Option<String> {
    cookie.split(';').find_map(|part| {
        let trimmed = part.trim();
        let value = trimmed.strip_prefix("XSRF-TOKEN=")?;
        urlencoding::decode(value).ok().map(|decoded| decoded.into_owned())
    })
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
