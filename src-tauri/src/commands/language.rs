use crate::utils::settings::load_settings_or_default;
use tauri::AppHandle;

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
    load_settings_or_default(app_handle)
        .get("language")
        .and_then(|v| v.as_str())
        .unwrap_or("en-US")
        .to_string()
}
