use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteamGame {
    #[serde(rename = "gameId")]
    pub game_id: String,
    pub name: String,
    #[serde(rename = "achievementsTotal")]
    pub achievements_total: u32,
    #[serde(rename = "achievementsCurrent")]
    pub achievements_current: u32,
    pub source: String,
    #[serde(rename = "libraryPath")]
    pub library_path: String,
    #[serde(rename = "installPath")]
    pub install_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteamAchievementData {
    #[serde(default)]
    pub apiname: String,
    pub name: String,
    #[serde(rename = "displayName")]
    pub display_name: String,
    pub description: String,
    pub achieved: bool,
    #[serde(rename = "unlockTime")]
    pub unlock_time: u32,
    pub icon: String,
    #[serde(rename = "iconGray")]
    pub icon_gray: String,
}
