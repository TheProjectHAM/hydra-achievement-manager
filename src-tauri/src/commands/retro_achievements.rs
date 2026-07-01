use crate::integrations::retro_achievements::{
    RetroAchievement, RetroAchievementsApi, RetroAchievementsAwardRequest,
    RetroAchievementsAwardResponseInner, RetroAchievementsCredentials, RetroAchievementsGame,
    RetroAchievementsPatchDataProbe, RetroAchievementsProfile, RetroAchievementsRuntimeLogin,
    RetroAchievementsSearchResult,
};
use crate::utils::settings::load_settings_value;
use serde_json::Value;
use tauri::AppHandle;

fn credentials_from_settings(settings: &Value) -> Option<RetroAchievementsCredentials> {
    let username = settings
        .get("retroAchievementsUsername")
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim();
    let api_key = settings
        .get("retroAchievementsApiKey")
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim();

    if username.is_empty() || api_key.is_empty() {
        return None;
    }

    Some(RetroAchievementsCredentials {
        username: username.to_string(),
        api_key: api_key.to_string(),
    })
}

fn load_credentials(
    app_handle: &AppHandle,
) -> Result<Option<RetroAchievementsCredentials>, String> {
    let settings = load_settings_value(app_handle)?;
    Ok(credentials_from_settings(&settings))
}

#[tauri::command]
pub async fn get_retro_achievements_connection_profile(
    app_handle: AppHandle,
) -> Result<Option<RetroAchievementsProfile>, String> {
    let Some(credentials) = load_credentials(&app_handle)? else {
        return Ok(None);
    };

    RetroAchievementsApi::get_profile(&credentials)
        .await
        .map(Some)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn test_retro_achievements_connection(
    username: String,
    api_key: String,
) -> Result<RetroAchievementsProfile, String> {
    let credentials = RetroAchievementsCredentials { username, api_key };
    RetroAchievementsApi::get_profile(&credentials)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn login_retro_achievements_runtime_with_password(
    username: String,
    password: String,
) -> Result<RetroAchievementsRuntimeLogin, String> {
    RetroAchievementsApi::runtime_login_with_password(&username, &password)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn login_retro_achievements_runtime_with_token(
    username: String,
    token: String,
) -> Result<RetroAchievementsRuntimeLogin, String> {
    RetroAchievementsApi::runtime_login_with_token(&username, &token)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn probe_retro_achievements_patch_data(
    username: String,
    runtime_token: String,
    game_id: u32,
) -> Result<RetroAchievementsPatchDataProbe, String> {
    RetroAchievementsApi::probe_patch_data(&username, &runtime_token, game_id)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn search_retro_achievements_games(
    query: String,
    app_handle: AppHandle,
) -> Result<Vec<RetroAchievementsSearchResult>, String> {
    let credentials = load_credentials(&app_handle)?;
    RetroAchievementsApi::search_games(credentials.as_ref(), &query)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn get_retro_achievements_recent_games(
    app_handle: AppHandle,
) -> Result<Vec<RetroAchievementsGame>, String> {
    let Some(credentials) = load_credentials(&app_handle)? else {
        return Ok(Vec::new());
    };

    RetroAchievementsApi::get_recent_games(&credentials)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn get_retro_achievements_game_achievements(
    game_id: u32,
    app_handle: AppHandle,
) -> Result<Vec<RetroAchievement>, String> {
    let credentials = load_credentials(&app_handle)?;
    RetroAchievementsApi::get_game_achievements(credentials.as_ref(), game_id)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn award_retro_achievement(
    options: RetroAchievementsAwardRequest,
) -> Result<RetroAchievementsAwardResponseInner, String> {
    RetroAchievementsApi::award_achievement(&options)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn delete_retro_achievement_unlock(
    achievement_id: u32,
    app_handle: AppHandle,
) -> Result<Value, String> {
    let settings = load_settings_value(&app_handle)?;
    let cookie = settings
        .get("retroAchievementsWebCookie")
        .and_then(Value::as_str)
        .unwrap_or("");
    let xsrf_token = settings
        .get("retroAchievementsXsrfToken")
        .and_then(Value::as_str);

    RetroAchievementsApi::delete_achievement_unlock(achievement_id, cookie, xsrf_token)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn delete_retro_game_unlocks(
    game_id: u32,
    app_handle: AppHandle,
) -> Result<Value, String> {
    let settings = load_settings_value(&app_handle)?;
    let cookie = settings
        .get("retroAchievementsWebCookie")
        .and_then(Value::as_str)
        .unwrap_or("");
    let xsrf_token = settings
        .get("retroAchievementsXsrfToken")
        .and_then(Value::as_str);

    RetroAchievementsApi::delete_game_unlocks(game_id, cookie, xsrf_token)
        .await
        .map_err(|error| error.to_string())
}
