use crate::integrations::retro_achievements::{
    RetroAchievement, RetroAchievementsApi, RetroAchievementsAwardRequest,
    RetroAchievementsAwardResponseInner, RetroAchievementsCredentials, RetroAchievementsGame,
    RetroAchievementsPatchDataProbe, RetroAchievementsProfile, RetroAchievementsRuntimeLogin,
    RetroAchievementsSearchResult, RetroAchievementsWebSessionLogin,
};
use crate::utils::settings::load_settings_value;
use serde_json::Value;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use tauri::{AppHandle, Manager, Url, WebviewUrl, WebviewWindowBuilder, WindowEvent};
use tokio::time::{sleep, Duration};

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

fn is_retro_achievements_authenticated_url(url: &Url) -> bool {
    if url.host_str() != Some("retroachievements.org") {
        return false;
    }

    !matches!(url.path(), "/login" | "/createaccount.php" | "/createaccount")
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
pub async fn login_retro_achievements_web_session(
    app_handle: AppHandle,
) -> Result<RetroAchievementsWebSessionLogin, String> {
    #[cfg(not(any(target_os = "linux", target_os = "windows")))]
    {
        return Err(
            "RetroAchievements web login is only supported on Linux and Windows".to_string(),
        );
    }

    #[cfg(any(target_os = "linux", target_os = "windows"))]
    {
        const WINDOW_LABEL: &str = "retro-achievements-web-login";
        const LOGIN_URL: &str = "https://retroachievements.org/login";
        const COOKIE_URL: &str = "https://retroachievements.org/";

        if let Some(existing) = app_handle.get_webview_window(WINDOW_LABEL) {
            let _ = existing.close();
        }

        let login_url = Url::parse(LOGIN_URL).map_err(|error| error.to_string())?;
        let cookie_url = Url::parse(COOKIE_URL).map_err(|error| error.to_string())?;

        let window =
            WebviewWindowBuilder::new(&app_handle, WINDOW_LABEL, WebviewUrl::External(login_url))
                .title("RetroAchievements login")
                .inner_size(940.0, 720.0)
                .resizable(true)
                .center()
                .build()
                .map_err(|error| {
                    format!("Failed to open RetroAchievements login window: {error}")
                })?;

        let closed = Arc::new(AtomicBool::new(false));
        let closed_for_event = Arc::clone(&closed);
        window.on_window_event(move |event| {
            if matches!(
                event,
                WindowEvent::CloseRequested { .. } | WindowEvent::Destroyed
            ) {
                closed_for_event.store(true, Ordering::SeqCst);
            }
        });

        for _ in 0..180 {
            if closed.load(Ordering::SeqCst) {
                return Err(
                    "RetroAchievements login window was closed before login completed".to_string(),
                );
            }

            let cookies = window
                .cookies_for_url(cookie_url.clone())
                .map_err(|error| format!("Failed to read RetroAchievements cookies: {error}"))?;
            let is_authenticated_page = window
                .url()
                .map(|url| is_retro_achievements_authenticated_url(&url))
                .unwrap_or(false);

            let has_session = cookies
                .iter()
                .any(|cookie| cookie.name() == "retroachievements_session");
            let xsrf_token = cookies
                .iter()
                .find(|cookie| cookie.name() == "XSRF-TOKEN")
                .and_then(|cookie| urlencoding::decode(cookie.value()).ok())
                .map(|token| token.into_owned());

            if has_session && is_authenticated_page {
                let Some(xsrf_token) = xsrf_token else {
                    return Err(
                        "RetroAchievements login completed, but XSRF token was not found"
                            .to_string(),
                    );
                };

                let cookie_header = cookies
                    .iter()
                    .map(|cookie| format!("{}={}", cookie.name(), cookie.value()))
                    .collect::<Vec<_>>()
                    .join("; ");
                let cookie_count = cookies.len();

                let _ = window.close();

                return Ok(RetroAchievementsWebSessionLogin {
                    cookie: cookie_header,
                    xsrf_token,
                    cookie_count,
                });
            }

            sleep(Duration::from_millis(1000)).await;
        }

        let _ = window.close();
        Err("RetroAchievements login timed out. Complete the login in the opened window and try again.".to_string())
    }
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
pub async fn get_retro_achievements_library_games(
    app_handle: AppHandle,
) -> Result<Vec<RetroAchievementsGame>, String> {
    let Some(credentials) = load_credentials(&app_handle)? else {
        return Ok(Vec::new());
    };

    RetroAchievementsApi::get_library_games(&credentials)
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
