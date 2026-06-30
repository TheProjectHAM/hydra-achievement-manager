use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HydraConnectionProfile {
    pub id: String,
    pub display_name: String,
    pub profile_image_url: Option<String>,
    pub background_image_url: Option<String>,
    pub subscription: Option<HydraSubscription>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HydraSubscription {
    pub id: Option<String>,
    pub user_id: Option<u64>,
    pub status: Option<String>,
    pub expires_at: Option<String>,
    pub billing_cycle: Option<String>,
    pub payment_platform: Option<String>,
    pub plan: Option<HydraPlan>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HydraPlan {
    pub id: Option<String>,
    #[serde(rename = "type")]
    pub plan_type: Option<String>,
}
