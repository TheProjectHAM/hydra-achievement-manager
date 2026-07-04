use keyring::Entry;
use serde_json::Value;
use std::path::Path;

const SERVICE_NAME: &str = "com.project.ham";

/// All secret field names that should be stored in the OS keyring
/// instead of plaintext in settings.json.
pub const SECRET_FIELDS: &[&str] = &[
    "retroAchievementsApiKey",
    "retroAchievementsRuntimeToken",
    "retroAchievementsWebCookie",
    "retroAchievementsXsrfToken",
    "steamApiKey",
];

fn keyring_entry(key: &str) -> Result<Entry, String> {
    Entry::new(SERVICE_NAME, key).map_err(|e| format!("Keyring error: {e}"))
}

/// Get a secret value from the OS keyring.
pub fn get_secret(key: &str) -> Result<Option<String>, String> {
    match keyring_entry(key) {
        Ok(entry) => match entry.get_password() {
            Ok(value) => Ok(Some(value)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(format!("Failed to read '{key}' from keyring: {e}")),
        },
        Err(e) => Err(e),
    }
}

/// Store a secret value in the OS keyring.
pub fn set_secret(key: &str, value: &str) -> Result<(), String> {
    let entry = keyring_entry(key)?;
    entry
        .set_password(value)
        .map_err(|e| format!("Failed to store '{key}' in keyring: {e}"))
}

/// Delete a secret value from the OS keyring.
pub fn delete_secret(key: &str) -> Result<(), String> {
    match keyring_entry(key) {
        Ok(entry) => match entry.delete_credential() {
            Ok(()) => Ok(()),
            Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(format!("Failed to delete '{key}' from keyring: {e}")),
        },
        Err(e) => Err(e),
    }
}

/// Extract secret fields from a settings JSON object, store them in the keyring,
/// and return a new JSON object without those fields.
pub fn extract_and_store_secrets(settings: &Value) -> Result<Value, String> {
    let mut clean = settings.clone();
    if let Some(obj) = clean.as_object_mut() {
        for field in SECRET_FIELDS {
            if let Some(value) = obj.remove(*field) {
                if let Some(str_val) = value.as_str() {
                    if str_val.is_empty() {
                        let _ = delete_secret(field);
                    } else {
                        set_secret(field, str_val)?;
                    }
                }
            }
        }
    }
    Ok(clean)
}

/// Load secrets from the keyring and inject them into a settings JSON object.
pub fn inject_secrets(settings: &mut Value) -> Result<(), String> {
    if let Some(obj) = settings.as_object_mut() {
        for field in SECRET_FIELDS {
            match get_secret(field) {
                Ok(Some(value)) => {
                    obj.insert(field.to_string(), Value::String(value));
                }
                Ok(None) => {}
                Err(e) => {
                    log::warn!("[Secrets] Could not read '{field}': {e}");
                }
            }
        }
    }
    Ok(())
}

/// Migrate plaintext secrets from settings.json to the keyring.
/// Takes the settings_path so it can rewrite the cleaned file.
/// Returns the cleaned settings (without secret fields).
pub fn migrate_plaintext_secrets(
    settings: &Value,
    settings_path: &Path,
) -> Result<Value, String> {
    let mut migrated = false;
    let mut clean = settings.clone();

    if let Some(obj) = clean.as_object_mut() {
        for field in SECRET_FIELDS {
            if let Some(value) = obj.get(*field) {
                if let Some(str_val) = value.as_str() {
                    if !str_val.is_empty() {
                        // Check if keyring already has this value
                        if let Ok(Some(_)) = get_secret(field) {
                            // Already in keyring, just remove from settings
                            obj.remove(*field);
                            migrated = true;
                            continue;
                        }
                        // Store in keyring
                        set_secret(field, str_val)?;
                        obj.remove(*field);
                        migrated = true;
                        log::info!("[Secrets] Migrated '{field}' from settings.json to keyring");
                    }
                }
            }
        }
    }

    if migrated {
        // Save cleaned settings back to disk
        let settings_json = serde_json::to_string_pretty(&clean).map_err(|e| e.to_string())?;
        if let Some(parent) = settings_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        std::fs::write(settings_path, settings_json).map_err(|e| e.to_string())?;
    }

    Ok(clean)
}
