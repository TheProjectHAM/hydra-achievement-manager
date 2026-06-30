use super::steam_library;
use super::steam_types::{SteamAchievementData, SteamGame};
use super::steamworks_client::SteamworksClient;
use anyhow::Result;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

pub struct SteamMonitor {
    steamworks: Arc<Mutex<SteamworksClient>>,
    running: Arc<Mutex<bool>>,
    app_handle: Option<tauri::AppHandle>,
}

impl SteamMonitor {
    pub fn new() -> Self {
        Self {
            steamworks: Arc::new(Mutex::new(SteamworksClient::new())),
            running: Arc::new(Mutex::new(false)),
            app_handle: None,
        }
    }

    pub fn set_app_handle(&mut self, app_handle: tauri::AppHandle) {
        self.app_handle = Some(app_handle);
    }

    pub fn initialize(&self) -> Result<()> {
        let mut steamworks = self
            .steamworks
            .lock()
            .map_err(|error| anyhow::anyhow!("Lock error: {}", error))?;
        steamworks.initialize()
    }

    pub fn switch_app_id(&self, app_id: u32) -> Result<()> {
        let mut steamworks = self
            .steamworks
            .lock()
            .map_err(|error| anyhow::anyhow!("Lock error: {}", error))?;
        steamworks.switch_app_id(app_id)
    }

    pub fn is_enabled(&self) -> bool {
        self.steamworks
            .lock()
            .map(|steamworks| steamworks.is_enabled())
            .unwrap_or(false)
    }

    pub fn get_last_init_error(&self) -> Option<String> {
        self.steamworks
            .lock()
            .ok()
            .and_then(|steamworks| steamworks.get_last_init_error())
    }

    pub fn start_monitoring(&self) -> Result<()> {
        if !self.is_enabled() {
            return Err(anyhow::anyhow!("Steam integration not initialized"));
        }

        let mut running = self
            .running
            .lock()
            .map_err(|error| anyhow::anyhow!("Lock error: {}", error))?;
        if *running {
            return Ok(());
        }
        *running = true;
        drop(running);

        let steamworks = Arc::clone(&self.steamworks);
        let running = Arc::clone(&self.running);

        thread::spawn(move || loop {
            match running.lock() {
                Ok(running_guard) => {
                    if !*running_guard {
                        break;
                    }
                }
                Err(error) => {
                    log::warn!("Steam monitoring state lock poisoned: {}", error);
                    break;
                }
            }

            if let Ok(steamworks_guard) = steamworks.lock() {
                steamworks_guard.run_callbacks();
            }

            thread::sleep(Duration::from_millis(100));
        });

        Ok(())
    }

    pub fn stop_monitoring(&self) {
        if let Ok(mut running) = self.running.lock() {
            *running = false;
        }
    }

    pub fn shutdown(&self) -> Result<()> {
        self.stop_monitoring();
        let mut steamworks = self
            .steamworks
            .lock()
            .map_err(|error| anyhow::anyhow!("Lock error: {}", error))?;
        steamworks.shutdown();
        Ok(())
    }

    pub fn get_steam_games(&self) -> Result<Vec<SteamGame>> {
        steam_library::get_owned_games()
    }

    pub fn get_user_info(&self) -> Result<(String, String)> {
        let steamworks = self
            .steamworks
            .lock()
            .map_err(|error| anyhow::anyhow!("Lock error: {}", error))?;
        steamworks.get_user_info()
    }

    pub fn set_achievement(&self, achievement_name: &str, unlocked: bool) -> Result<()> {
        let steamworks = self
            .steamworks
            .lock()
            .map_err(|error| anyhow::anyhow!("Lock error: {}", error))?;
        steamworks.set_achievement(achievement_name, unlocked)
    }

    pub fn get_game_achievements(&self, app_id: u32) -> Result<Vec<SteamAchievementData>> {
        self.switch_app_id(app_id)?;
        let steamworks = self
            .steamworks
            .lock()
            .map_err(|error| anyhow::anyhow!("Lock error: {}", error))?;
        steamworks.get_game_achievements()
    }

    pub fn get_achievement_status(&self, achievement_name: &str) -> Result<bool> {
        let steamworks = self
            .steamworks
            .lock()
            .map_err(|error| anyhow::anyhow!("Lock error: {}", error))?;
        steamworks.get_achievement_status(achievement_name)
    }

    pub fn detect_installed_games(&self) -> Result<Vec<PathBuf>> {
        steam_library::detect_installed_games()
    }

    pub fn get_steam_library_folders(&self) -> Result<Vec<PathBuf>> {
        steam_library::get_library_folders()
    }
}

impl Default for SteamMonitor {
    fn default() -> Self {
        Self::new()
    }
}
