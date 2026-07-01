use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RetroAchievementsCredentials {
    pub username: String,
    pub api_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RetroAchievementsProfile {
    pub username: String,
    pub display_name: String,
    pub avatar_url: Option<String>,
    pub motto: Option<String>,
    pub points: u32,
    pub softcore_points: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RetroAchievementsSearchResult {
    pub id: u32,
    pub title: String,
    pub console_id: Option<u32>,
    pub console_name: Option<String>,
    pub image_icon: Option<String>,
    pub image_box_art: Option<String>,
    pub achievements_total: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RetroAchievementsGame {
    pub id: u32,
    pub title: String,
    pub console_id: Option<u32>,
    pub console_name: Option<String>,
    pub image_icon: Option<String>,
    pub image_box_art: Option<String>,
    pub achievements_total: u32,
    pub achievements_current: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RetroAchievement {
    pub id: String,
    pub title: String,
    pub description: String,
    pub badge_name: Option<String>,
    pub icon: String,
    pub icon_locked: String,
    pub points: u32,
    pub true_ratio: u32,
    pub display_order: u32,
    pub unlocked: bool,
    pub unlock_time: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RetroAchievementsRuntimeLogin {
    pub username: String,
    pub token: String,
    pub score: u32,
    pub softcore_score: u32,
    pub messages: u32,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RetroAchievementsPatchMemAddrSample {
    pub achievement_id: String,
    pub length: usize,
    pub value_class: String,
    pub preview: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RetroAchievementsPatchDataProbe {
    pub game_id: u32,
    pub achievement_count: usize,
    pub mem_addr_count: usize,
    pub trigger_like_count: usize,
    pub md5_like_count: usize,
    pub samples: Vec<RetroAchievementsPatchMemAddrSample>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RetroAchievementsAwardRequest {
    pub username: String,
    pub runtime_token: String,
    pub achievement_id: u32,
    pub hardcore: bool,
    pub game_hash: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RetroAchievementsAwardResponseInner {
    pub success: bool,
    pub error: Option<String>,
    pub score: Option<u32>,
    pub softcore_score: Option<u32>,
    pub achievement_id: Option<u32>,
    pub achievements_remaining: Option<u32>,
}
