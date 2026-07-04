use super::steam_types::SteamAchievementData;
use anyhow::Context;
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::path::PathBuf;
use std::thread;
use std::time::Duration;
use steamworks::Client;

pub struct SteamworksClient {
    client: Option<Client>,
    enabled: bool,
    last_init_error: Option<String>,
    current_app_id: Option<u32>,
}

impl SteamworksClient {
    pub fn new() -> Self {
        Self {
            client: None,
            enabled: false,
            last_init_error: None,
            current_app_id: None,
        }
    }

    pub fn initialize(&mut self) -> anyhow::Result<()> {
        if self.enabled {
            return Ok(());
        }

        let app_id = Self::resolve_appid_for_init();
        let _ = std::env::set_var("SteamAppId", &app_id);
        let _ = std::env::set_var("SteamGameId", &app_id);
        Self::ensure_steam_appid_file(&app_id);

        match catch_unwind(AssertUnwindSafe(Client::init)) {
            Ok(Ok(client)) => {
                self.client = Some(client);
                self.enabled = true;
                self.last_init_error = None;
                self.current_app_id = app_id.parse().ok();
                log::info!("Steam client initialized successfully");
                Ok(())
            }
            Ok(Err(error)) => {
                let message = format!("{:?}", error);
                log::warn!("Steam integration NOT available: {}", message);
                self.enabled = false;
                self.last_init_error = Some(message);
                Ok(())
            }
            Err(_) => {
                let message = "Steamworks initialization panicked".to_string();
                log::warn!("{}", message);
                self.enabled = false;
                self.last_init_error = Some(message);
                Ok(())
            }
        }
    }

    pub fn switch_app_id(&mut self, app_id: u32) -> anyhow::Result<()> {
        if self.enabled && self.current_app_id == Some(app_id) {
            return Ok(());
        }

        log::info!("Switching Steam AppID to {}", app_id);
        let _ = std::env::set_var("SteamAppId", app_id.to_string());
        let _ = std::env::set_var("SteamGameId", app_id.to_string());
        Self::ensure_steam_appid_file(&app_id.to_string());

        self.client = None;
        self.enabled = false;
        self.current_app_id = None;
        self.initialize()
    }

    pub fn is_enabled(&self) -> bool {
        self.enabled
    }

    pub fn get_last_init_error(&self) -> Option<String> {
        self.last_init_error.clone()
    }

    pub fn shutdown(&mut self) {
        self.client = None;
        self.enabled = false;
        self.last_init_error = None;
        self.current_app_id = None;

        let neutral_app_id = "480";
        let _ = std::env::set_var("SteamAppId", neutral_app_id);
        let _ = std::env::set_var("SteamGameId", neutral_app_id);
        Self::ensure_steam_appid_file(neutral_app_id);
        log::info!("Steam client session closed");
    }

    pub fn get_user_info(&self) -> anyhow::Result<(String, String)> {
        if !self.enabled {
            return Err(anyhow::anyhow!("Steam integration not enabled"));
        }

        let client = self
            .client
            .as_ref()
            .context("Steam client not initialized")?;

        catch_unwind(AssertUnwindSafe(|| {
            let friends = client.friends();
            let user_id = client.user().steam_id().raw().to_string();
            let user_name = friends.name();
            (user_id, user_name)
        }))
        .map_err(|_| anyhow::anyhow!("Steamworks panicked while reading user info"))
    }

    pub fn set_achievement(&self, achievement_name: &str, unlocked: bool) -> anyhow::Result<()> {
        if !self.enabled {
            return Err(anyhow::anyhow!("Steam integration not enabled"));
        }

        let client = self
            .client
            .as_ref()
            .context("Steam client not initialized")?;

        let changed = catch_unwind(AssertUnwindSafe(|| -> anyhow::Result<bool> {
            let user_stats = client.user_stats();
            let achievement = user_stats.achievement(achievement_name);
            let current_state = achievement
                .get()
                .map_err(|_| anyhow::anyhow!("Failed to read achievement state"))?;

            if current_state == unlocked {
                return Ok(false);
            }

            if unlocked {
                achievement
                    .set()
                    .map_err(|_| anyhow::anyhow!("Failed to set achievement"))?;
            } else {
                achievement
                    .clear()
                    .map_err(|_| anyhow::anyhow!("Failed to clear achievement"))?;
            }

            user_stats
                .store_stats()
                .map_err(|_| anyhow::anyhow!("Failed to store stats"))?;
            Ok(true)
        }))
        .map_err(|_| anyhow::anyhow!("Steamworks panicked while updating achievement"))??;

        if changed {
            Self::pump_callbacks(client, 5);
        }

        Ok(())
    }

    pub fn get_game_achievements(&self) -> anyhow::Result<Vec<SteamAchievementData>> {
        if !self.enabled {
            return Err(anyhow::anyhow!("Steam integration not enabled"));
        }

        let client = self
            .client
            .as_ref()
            .context("Steam client not initialized")?;

        catch_unwind(AssertUnwindSafe(|| -> anyhow::Result<Vec<SteamAchievementData>> {
            let user_stats = client.user_stats();
            let steam_id = client.user().steam_id().raw();
            user_stats.request_user_stats(steam_id);
            Self::pump_callbacks(client, 10);

            if user_stats.get_num_achievements().is_err() {
                return Ok(Vec::new());
            }

            let Some(achievement_names) = user_stats.get_achievement_names() else {
                return Ok(Vec::new());
            };

            let mut achievements = Vec::with_capacity(achievement_names.len());
            for name in achievement_names {
                let helper = user_stats.achievement(&name);
                let achieved = helper.get().unwrap_or(false);
                let display_name = helper
                    .get_achievement_display_attribute("name")
                    .unwrap_or("")
                    .to_string();
                let description = helper
                    .get_achievement_display_attribute("desc")
                    .unwrap_or("")
                    .to_string();
                let friendly_name = if display_name.trim().is_empty() {
                    name.clone()
                } else {
                    display_name.clone()
                };

                achievements.push(SteamAchievementData {
                    apiname: name,
                    name: friendly_name,
                    display_name,
                    description,
                    achieved,
                    unlock_time: 0,
                    icon: String::new(),
                    icon_gray: String::new(),
                });
            }

            Ok(achievements)
        }))
        .map_err(|_| anyhow::anyhow!("Steamworks panicked while reading achievements"))?
    }

    pub fn get_achievement_status(&self, achievement_name: &str) -> anyhow::Result<bool> {
        if !self.enabled {
            return Err(anyhow::anyhow!("Steam integration not enabled"));
        }

        let client = self
            .client
            .as_ref()
            .context("Steam client not initialized")?;

        catch_unwind(AssertUnwindSafe(|| {
            let user_stats = client.user_stats();
            let achievement = user_stats.achievement(achievement_name);
            achievement
                .get()
                .map_err(|_| anyhow::anyhow!("Failed to get achievement status"))
        }))
        .map_err(|_| anyhow::anyhow!("Steamworks panicked while reading achievement status"))?
    }

    pub fn run_callbacks(&self) {
        if !self.enabled {
            return;
        }

        if let Some(client) = &self.client {
            if catch_unwind(AssertUnwindSafe(|| client.run_callbacks())).is_err() {
                log::warn!("Steam callbacks panicked");
            }
        }
    }

    fn pump_callbacks(client: &Client, cycles: usize) {
        for _ in 0..cycles {
            if catch_unwind(AssertUnwindSafe(|| client.run_callbacks())).is_err() {
                log::warn!("Steam callbacks panicked while pumping callbacks");
                break;
            }
            thread::sleep(Duration::from_millis(100));
        }
    }

    fn resolve_appid_for_init() -> String {
        for key in ["SteamAppId", "SteamGameId"] {
            if let Ok(value) = std::env::var(key) {
                let trimmed = value.trim();
                if !trimmed.is_empty() {
                    return trimmed.to_string();
                }
            }
        }

        if let Ok(path) = Self::get_steam_appid_path() {
            if let Ok(content) = std::fs::read_to_string(path) {
                let trimmed = content.trim();
                if !trimmed.is_empty() {
                    return trimmed.to_string();
                }
            }
        }

        "480".to_string()
    }

    fn ensure_steam_appid_file(app_id: &str) {
        let Ok(path) = Self::get_steam_appid_path() else {
            return;
        };

        let needs_write = match std::fs::read_to_string(&path) {
            Ok(content) => content.trim() != app_id,
            Err(_) => true,
        };

        if needs_write {
            if let Err(error) = std::fs::write(&path, app_id) {
                log::warn!("Failed to write steam_appid.txt at {:?}: {}", path, error);
            }
        }
    }

    fn get_steam_appid_path() -> anyhow::Result<PathBuf> {
        let exe = std::env::current_exe()?;
        let exe_dir = exe
            .parent()
            .ok_or_else(|| anyhow::anyhow!("Failed to resolve executable directory"))?;
        Ok(exe_dir.join("steam_appid.txt"))
    }
}

impl Default for SteamworksClient {
    fn default() -> Self {
        Self::new()
    }
}

impl Drop for SteamworksClient {
    fn drop(&mut self) {
        if self.enabled {
            log::info!("[SteamworksClient] Drop: cleaning up Steam session");
            self.client = None;
            self.enabled = false;
            self.current_app_id = None;

            let neutral_app_id = "480";
            let _ = std::env::set_var("SteamAppId", neutral_app_id);
            let _ = std::env::set_var("SteamGameId", neutral_app_id);
            Self::ensure_steam_appid_file(neutral_app_id);
        }
    }
}
