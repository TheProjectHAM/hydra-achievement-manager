use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SteamSubAccount {
    pub steam_id64: String,
    pub account_id: u64,
    pub account_name: Option<String>,
    pub persona_name: String,
    pub profile_url: String,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SteamConnectionProfile {
    pub steam_id64: String,
    pub account_id: u64,
    pub account_name: Option<String>,
    pub persona_name: String,
    pub steam3_id: String,
    pub steam2_id: String,
    pub profile_url: String,
    pub avatar_hash: Option<String>,
    pub avatar_url: Option<String>,
    pub local_avatar_path: Option<String>,
    pub sub_accounts: Vec<SteamSubAccount>,
}
