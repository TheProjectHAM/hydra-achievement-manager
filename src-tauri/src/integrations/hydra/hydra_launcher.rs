use super::hydra_level_db::{read_all_kv_pairs};
use super::hydra_types::HydraConnectionProfile;
use serde_json::Value;
use std::path::PathBuf;

pub fn get_hydra_profile(custom_path: Option<&str>) -> Result<Option<HydraConnectionProfile>, String> {
    log::info!("[Hydra Profile] get_hydra_profile called. custom_path={:?}", custom_path);

    let db_path = hydra_db_path(custom_path)
        .ok_or_else(|| "Could not resolve Hydra database path".to_string())?;

    log::info!("[Hydra Profile] Database path resolved to: {}", db_path.display());

    if !db_path.exists() {
        log::warn!("[Hydra Profile] Database path does not exist: {}", db_path.display());
        return Ok(None);
    }

    let pairs = read_all_kv_pairs(&db_path)?;
    log::info!("[Hydra Profile] Read {} key-value pairs from database", pairs.len());

    let auth_count = pairs.keys().filter(|k| k.as_slice() == b"auth" || k.as_slice() == b"user").count();
    log::info!("[Hydra Profile] Found {} 'auth'/'user' keys", auth_count);

    for (key, value) in &pairs {
        if key == b"auth" || key == b"user" {
            log::info!("[Hydra Profile] Trying to parse key: {:?}", String::from_utf8_lossy(key));
            if let Ok(v) = serde_json::from_slice::<Value>(value) {
                if let Some(profile) = find_profile_value(&v) {
                    if let Ok(p) = serde_json::from_value::<HydraConnectionProfile>(profile.clone()) {
                        log::info!("[Hydra Profile] Profile found via '{}' key: displayName={}", String::from_utf8_lossy(key), p.display_name);
                        return Ok(Some(p));
                    } else {
                        log::warn!("[Hydra Profile] Found profile value but failed to deserialize into HydraConnectionProfile");
                    }
                }
            } else {
                log::warn!("[Hydra Profile] Failed to parse JSON for key: {:?}", String::from_utf8_lossy(key));
            }
        }
    }

    log::info!("[Hydra Profile] No profile found in 'auth'/'user' keys, trying all entries...");

    for (_, value) in &pairs {
        if let Ok(v) = serde_json::from_slice::<Value>(value) {
            if let Some(profile) = find_profile_value(&v) {
                if let Ok(p) = serde_json::from_value::<HydraConnectionProfile>(profile.clone()) {
                    log::info!("[Hydra Profile] Profile found in fallback scan: displayName={}", p.display_name);
                    return Ok(Some(p));
                }
            }
        }
    }

    log::warn!("[Hydra Profile] No profile found in any key-value pair");
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
