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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub installed: Option<bool>,
    #[serde(rename = "playtimeForever", skip_serializing_if = "Option::is_none")]
    pub playtime_forever: Option<u32>,
    #[serde(rename = "playtime2weeks", skip_serializing_if = "Option::is_none")]
    pub playtime_2weeks: Option<u32>,
    #[serde(rename = "rtimeLastPlayed", skip_serializing_if = "Option::is_none")]
    pub rtime_last_played: Option<u32>,
    #[serde(rename = "imgIconUrl", skip_serializing_if = "Option::is_none")]
    pub img_icon_url: Option<String>,
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
