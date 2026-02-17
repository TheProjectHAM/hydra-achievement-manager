use serde_json::Value;
use std::fs;
use tauri::{AppHandle, Manager};

pub(crate) fn map_ui_language_to_steam_store_lang(language: &str) -> &'static str {
    match language {
        "en-US" => "english",
        "pt-BR" => "portuguese",
        "fr-FR" => "french",
        "it-IT" => "italian",
        "de-DE" => "german",
        "es-ES" => "spanish",
        "ru-RU" => "russian",
        "ja-JP" => "japanese",
        "zh-CN" => "schinese",
        "pl-PL" => "polish",
        "uk-UA" => "ukrainian",
        _ => "english",
    }
}

pub(crate) fn map_ui_language_to_hydra_lang(language: &str) -> &'static str {
    match language {
        "en-US" => "en",
        "es-ES" => "es",
        "ru-RU" => "ru",
        "pt-BR" => "pt",
        _ => "en",
    }
}

pub(crate) fn read_language_from_settings(app_handle: &AppHandle) -> String {
    let user_data_path = match app_handle.path().app_data_dir() {
        Ok(path) => path,
        Err(_) => return "en-US".to_string(),
    };
    let settings_path = user_data_path.join("settings.json");

    if settings_path.exists() {
        if let Ok(settings_data) = fs::read_to_string(settings_path) {
            if let Ok(settings) = serde_json::from_str::<Value>(&settings_data) {
                if let Some(lang) = settings.get("language").and_then(|v| v.as_str()) {
                    return lang.to_string();
                }
            }
        }
    }

    "en-US".to_string()
}
