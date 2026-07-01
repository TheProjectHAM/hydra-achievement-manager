use super::steam_types::SteamAchievementData;
use anyhow::{Context, Result};
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use steamworks::{Client, ClientManager, SingleClient};

pub struct SteamworksClient {
    client: Option<Arc<Mutex<Client<ClientManager>>>>,
    single_client: Option<Arc<Mutex<SingleClient<ClientManager>>>>,
    enabled: bool,
    last_init_error: Option<String>,
}

impl SteamworksClient {
    pub fn new() -> Self {
        Self {
            client: None,
            single_client: None,
            enabled: false,
            last_init_error: None,
        }
    }

    pub fn initialize(&mut self) -> Result<()> {
        if self.enabled {
            return Ok(());
        }

        let app_id = Self::resolve_appid_for_init();
        std::env::set_var("SteamAppId", &app_id);
        std::env::set_var("SteamGameId", &app_id);
        Self::ensure_steam_appid_file(&app_id);

        match catch_unwind(AssertUnwindSafe(Client::init)) {
            Ok(Ok((client, single_client))) => {
                self.client = Some(Arc::new(Mutex::new(client)));
                self.single_client = Some(Arc::new(Mutex::new(single_client)));
                self.enabled = true;
                self.last_init_error = None;
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

    pub fn switch_app_id(&mut self, app_id: u32) -> Result<()> {
        log::info!("Switching Steam AppID to {}", app_id);
        std::env::set_var("SteamAppId", app_id.to_string());
        std::env::set_var("SteamGameId", app_id.to_string());
        Self::ensure_steam_appid_file(&app_id.to_string());

        self.single_client = None;
        self.client = None;
        self.enabled = false;
        self.initialize()
    }

    pub fn is_enabled(&self) -> bool {
        self.enabled
    }

    pub fn get_last_init_error(&self) -> Option<String> {
        self.last_init_error.clone()
    }

    pub fn shutdown(&mut self) {
        self.single_client = None;
        self.client = None;
        self.enabled = false;
        self.last_init_error = None;

        let neutral_app_id = "480";
        std::env::set_var("SteamAppId", neutral_app_id);
        std::env::set_var("SteamGameId", neutral_app_id);
        Self::ensure_steam_appid_file(neutral_app_id);
        log::info!("Steam client session closed");
    }

    pub fn get_user_info(&self) -> Result<(String, String)> {
        if !self.enabled {
            return Err(anyhow::anyhow!("Steam integration not enabled"));
        }

        let client_lock = self
            .client
            .as_ref()
            .context("Steam client not initialized")?;
        let guard = client_lock
            .lock()
            .map_err(|error| anyhow::anyhow!("Lock error: {}", error))?;
        let client = &*guard;

        catch_unwind(AssertUnwindSafe(|| {
            let friends = client.friends();
            let user_id = client.user().steam_id().raw().to_string();
            let user_name = friends.name();
            (user_id, user_name)
        }))
        .map_err(|_| anyhow::anyhow!("Steamworks panicked while reading user info"))
    }

    pub fn set_achievement(&self, achievement_name: &str, unlocked: bool) -> Result<()> {
        if !self.enabled {
            return Err(anyhow::anyhow!("Steam integration not enabled"));
        }

        let client_lock = self
            .client
            .as_ref()
            .context("Steam client not initialized")?;
        let guard = client_lock
            .lock()
            .map_err(|error| anyhow::anyhow!("Lock error: {}", error))?;
        let client = &*guard;

        let changed = catch_unwind(AssertUnwindSafe(|| -> Result<bool> {
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
            Self::pump_callbacks(&self.single_client, 5);
        }

        Ok(())
    }

    pub fn get_game_achievements(&self) -> Result<Vec<SteamAchievementData>> {
        if !self.enabled {
            return Err(anyhow::anyhow!("Steam integration not enabled"));
        }

        let client_lock = self
            .client
            .as_ref()
            .context("Steam client not initialized")?;
        let guard = client_lock
            .lock()
            .map_err(|error| anyhow::anyhow!("Lock error: {}", error))?;
        let client = &*guard;

        catch_unwind(AssertUnwindSafe(|| -> Result<Vec<SteamAchievementData>> {
            let user_stats = client.user_stats();
            user_stats.request_current_stats();
            Self::pump_callbacks(&self.single_client, 10);

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

    pub fn get_achievement_status(&self, achievement_name: &str) -> Result<bool> {
        if !self.enabled {
            return Err(anyhow::anyhow!("Steam integration not enabled"));
        }

        let client_lock = self
            .client
            .as_ref()
            .context("Steam client not initialized")?;
        let guard = client_lock
            .lock()
            .map_err(|error| anyhow::anyhow!("Lock error: {}", error))?;
        let client = &*guard;

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

        if let Some(single_client_lock) = &self.single_client {
            if let Ok(guard) = single_client_lock.lock() {
                if catch_unwind(AssertUnwindSafe(|| guard.run_callbacks())).is_err() {
                    log::warn!("Steam callbacks panicked");
                }
            }
        }
    }

    fn pump_callbacks(
        single_client: &Option<Arc<Mutex<SingleClient<ClientManager>>>>,
        cycles: usize,
    ) {
        for _ in 0..cycles {
            if let Some(single_client_lock) = single_client {
                if let Ok(single_client) = single_client_lock.lock() {
                    if catch_unwind(AssertUnwindSafe(|| single_client.run_callbacks())).is_err() {
                        log::warn!("Steam callbacks panicked while pumping callbacks");
                        break;
                    }
                }
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

    fn get_steam_appid_path() -> Result<PathBuf> {
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
