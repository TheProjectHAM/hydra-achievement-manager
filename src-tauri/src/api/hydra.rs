use crate::models::{HydraAchievement, HydraGameAchievements};
use anyhow::{Context, Result};



pub struct HydraAPI;

impl HydraAPI {
    /// Busca achievements de um jogo usando a API Hydra
    pub async fn get_game_achievements(
        game_id: &str,
        language: Option<&str>,
    ) -> Result<HydraGameAchievements> {
        let base_url = std::env::var("HYDRA_API_URL")
            .unwrap_or_else(|_| "https://hydra-api-us-east-1.losbroxas.org".to_string());
            
        let url = format!(
            "{}/games/achievements?shop=steam&objectId={}",
            base_url, game_id
        );

        let final_url = if let Some(lang) = language {
            if ["en", "es", "ru", "pt"].contains(&lang) {
                format!("{}&language={}", url, lang)
            } else {
                url
            }
        } else {
            url
        };

        log::info!("Fetching Hydra achievements from: {}", final_url);

        let client = crate::utils::http::get_client().map_err(|e| {
             log::error!("Failed to create HTTP client: {}", e);
             anyhow::anyhow!("Internal HTTP client error: {}", e)
        })?;

        let response = client.get(&final_url).send().await
            .map_err(|e| {
                log::error!("Hydra API Request Failed (reqwest): Error={:?}", e);
                anyhow::anyhow!("Failed to fetch from Hydra API: {}", e)
            })?;

        let achievements: Vec<HydraAchievement> = response.json().await
            .context("Failed to parse Hydra API response")?;

        Ok(HydraGameAchievements {
            game_id: game_id.to_string(),
            achievements,
        })
    }

    /// Busca um achievement específico pelo nome
    pub fn get_achievement_by_name(
        game_achievements: &HydraGameAchievements,
        achievement_name: &str,
    ) -> Option<HydraAchievement> {
        game_achievements
            .achievements
            .iter()
            .find(|ach| ach.name == achievement_name)
            .cloned()
    }
}
