use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Manager;

#[derive(Serialize, Deserialize, Default, Clone, Debug)]
pub struct CachedGame {
    pub name: Option<String>,
    pub achievements_total: Option<usize>,
    pub rarity: Option<HashMap<String, f64>>,
    pub hidden: Option<Vec<String>>,
    pub last_updated: u64,
}

#[derive(Serialize, Deserialize, Default, Clone, Debug)]
pub struct AppCache {
    pub games: HashMap<String, CachedGame>,
}

pub struct CacheManager;

impl CacheManager {
    fn get_cache_path(app_handle: &AppHandle) -> Result<PathBuf> {
        let app_dir = app_handle
            .path()
            .app_data_dir()
            .map_err(|e| anyhow::anyhow!("Failed to get app data directory: {}", e))?;

        if !app_dir.exists() {
            fs::create_dir_all(&app_dir)?;
        }

        Ok(app_dir.join("cache.json"))
    }

    pub fn load(app_handle: &AppHandle) -> Result<AppCache> {
        let path = Self::get_cache_path(app_handle)?;
        if !path.exists() {
            return Ok(AppCache::default());
        }

        let content = fs::read_to_string(path)?;
        let cache = serde_json::from_str(&content).unwrap_or_default();
        Ok(cache)
    }

    pub fn save(app_handle: &AppHandle, cache: &AppCache) -> Result<()> {
        let path = Self::get_cache_path(app_handle)?;
        let content = serde_json::to_string_pretty(cache)?;
        fs::write(path, content)?;
        Ok(())
    }

    fn is_cache_enabled(app_handle: &AppHandle) -> bool {
        let user_data_path = match app_handle.path().app_data_dir() {
            Ok(p) => p,
            Err(_) => return true,
        };
        let settings_path = user_data_path.join("settings.json");
        if settings_path.exists() {
            if let Ok(content) = fs::read_to_string(settings_path) {
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                    return json
                        .get("enableCache")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(true);
                }
            }
        }
        true
    }

    const MAX_CACHE_SIZE: u64 = 128 * 1024 * 1024; // 128 MB

    pub fn update_game(
        app_handle: &AppHandle,
        game_id: String,
        name: Option<String>,
        achievements_total: Option<usize>,
        rarity: Option<HashMap<String, f64>>,
        hidden: Option<Vec<String>>,
    ) -> Result<()> {
        if !Self::is_cache_enabled(app_handle) {
            return Ok(());
        }

        let mut cache = Self::load(app_handle)?;
        let entry = cache.games.entry(game_id).or_insert(CachedGame {
            name: None,
            achievements_total: None,
            rarity: None,
            hidden: None,
            last_updated: 0,
        });

        if let Some(n) = name {
            entry.name = Some(n);
        }
        if let Some(t) = achievements_total {
            entry.achievements_total = Some(t);
        }
        if let Some(r) = rarity {
            entry.rarity = Some(r);
        }
        if let Some(h) = hidden {
            entry.hidden = Some(h);
        }

        use std::time::{SystemTime, UNIX_EPOCH};
        entry.last_updated = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        // Check cache size and evict if necessary
        let content = serde_json::to_string(&cache)?;
        if content.len() as u64 > Self::MAX_CACHE_SIZE {
            log::info!(
                "Cache size exceeded ({} bytes), evicting old entries...",
                content.len()
            );

            // Convert to Vec for sorting
            let mut entries: Vec<(String, CachedGame)> =
                std::mem::take(&mut cache.games).into_iter().collect();

            // Sort by last_updated (oldest first)
            entries.sort_by(|a, b| a.1.last_updated.cmp(&b.1.last_updated));

            // A simple heuristic: remove oldest 20% of entries if over limit
            let remove_count = (entries.len() as f64 * 0.2).ceil() as usize;

            if remove_count > 0 && entries.len() > remove_count {
                cache.games = entries.into_iter().skip(remove_count).collect();
            } else {
                cache.games = entries.into_iter().collect();
            }
        }

        Self::save(app_handle, &cache)
    }

    pub fn get_game(app_handle: &AppHandle, game_id: &str) -> Option<CachedGame> {
        if !Self::is_cache_enabled(app_handle) {
            return None;
        }

        let cache = Self::load(app_handle).ok()?;
        cache.games.get(game_id).cloned()
    }

    pub fn get_cache_size(app_handle: &AppHandle) -> Result<u64> {
        let path = Self::get_cache_path(app_handle)?;
        if !path.exists() {
            return Ok(0);
        }
        let metadata = fs::metadata(path)?;
        Ok(metadata.len())
    }

    pub fn clear_cache(app_handle: &AppHandle) -> Result<()> {
        let path = Self::get_cache_path(app_handle)?;
        if path.exists() {
            fs::remove_file(path)?;
        }
        Ok(())
    }
}
