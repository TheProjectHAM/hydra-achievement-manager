use super::hydra_types::HydraConnectionProfile;
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};

pub fn get_hydra_profile(custom_path: Option<&str>) -> Result<Option<HydraConnectionProfile>, String> {
    let db_path =
        hydra_db_path(custom_path).ok_or_else(|| "Could not resolve Hydra database path".to_string())?;

    if !db_path.exists() {
        return Ok(None);
    }

    let mut files = hydra_data_files(&db_path)?;
    files.sort_by_key(|path| {
        fs::metadata(path)
            .and_then(|metadata| metadata.modified())
            .ok()
    });
    files.reverse();

    for file in files {
        let bytes = match fs::read(&file) {
            Ok(bytes) => bytes,
            Err(_) => continue,
        };

        if let Some(profile) = extract_profile_from_bytes(&bytes) {
            return Ok(Some(profile));
        }
    }

    Ok(None)
}

fn hydra_db_path(custom_path: Option<&str>) -> Option<PathBuf> {
    if let Some(path) = custom_path {
        let trimmed = path.trim();
        if !trimmed.is_empty() {
            return Some(crate::parser::expand_path(trimmed));
        }
    }
    dirs::config_dir().map(|dir| dir.join("hydralauncher").join("hydra-db"))
}

fn hydra_data_files(db_path: &Path) -> Result<Vec<PathBuf>, String> {
    let entries =
        fs::read_dir(db_path).map_err(|e| format!("Failed to read Hydra database: {}", e))?;

    Ok(entries
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| {
            matches!(
                path.extension().and_then(|extension| extension.to_str()),
                Some("log") | Some("ldb")
            )
        })
        .collect())
}

fn extract_profile_from_bytes(bytes: &[u8]) -> Option<HydraConnectionProfile> {
    let text = String::from_utf8_lossy(bytes);
    let mut search_from = 0;

    while let Some(relative_index) = text[search_from..].find("\"displayName\"") {
        let display_name_index = search_from + relative_index;
        search_from = display_name_index + "\"displayName\"".len();

        if !text[display_name_index..].contains("\"profileImageUrl\"") {
            continue;
        }

        let Some(json_start) = text[..display_name_index].rfind('{') else {
            continue;
        };

        let Some(json_end) = find_json_object_end(&text[json_start..]) else {
            continue;
        };

        let candidate = &text[json_start..json_start + json_end];
        if let Some(profile) = parse_profile_candidate(candidate) {
            return Some(profile);
        }
    }

    None
}

fn parse_profile_candidate(candidate: &str) -> Option<HydraConnectionProfile> {
    let value = serde_json::from_str::<Value>(candidate).ok()?;
    let profile_value = find_profile_value(&value)?;
    serde_json::from_value(profile_value.clone()).ok()
}

fn find_profile_value(value: &Value) -> Option<&Value> {
    match value {
        Value::Object(map) => {
            let has_profile_fields = map.contains_key("id")
                && map.contains_key("displayName")
                && map.contains_key("profileImageUrl");

            if has_profile_fields {
                return Some(value);
            }

            map.values().find_map(find_profile_value)
        }
        Value::Array(items) => items.iter().find_map(find_profile_value),
        _ => None,
    }
}

fn find_json_object_end(text: &str) -> Option<usize> {
    let mut depth = 0usize;
    let mut in_string = false;
    let mut escaped = false;

    for (index, character) in text.char_indices() {
        if in_string {
            if escaped {
                escaped = false;
            } else if character == '\\' {
                escaped = true;
            } else if character == '"' {
                in_string = false;
            }
            continue;
        }

        match character {
            '"' => in_string = true,
            '{' => depth += 1,
            '}' => {
                depth = depth.saturating_sub(1);
                if depth == 0 {
                    return Some(index + character.len_utf8());
                }
            }
            _ => {}
        }
    }

    None
}
