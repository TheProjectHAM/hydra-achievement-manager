use crate::steam_integration::{SteamGame, SteamIntegration};
use anyhow::Result;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::Emitter;

/// Monitor de conquistas Steam
pub struct SteamMonitor {
    steam: Arc<Mutex<SteamIntegration>>,
    app_handle: Option<tauri::AppHandle>,
    running: Arc<Mutex<bool>>,
}

impl SteamMonitor {
    /// Cria um novo monitor Steam
    pub fn new() -> Self {
        Self {
            steam: Arc::new(Mutex::new(SteamIntegration::new())),
            app_handle: None,
            running: Arc::new(Mutex::new(false)),
        }
    }

    /// Define o app handle para emitir eventos
    pub fn set_app_handle(&mut self, app_handle: tauri::AppHandle) {
        self.app_handle = Some(app_handle);
    }

    /// Inicializa o Steam
    pub fn initialize(&self) -> Result<()> {
        let mut steam = self
            .steam
            .lock()
            .map_err(|e| anyhow::anyhow!("Lock error: {}", e))?;
        steam.initialize()
    }

    /// Muda o AppID
    pub fn switch_app_id(&self, app_id: u32) -> Result<()> {
        let mut steam = self
            .steam
            .lock()
            .map_err(|e| anyhow::anyhow!("Lock error: {}", e))?;
        steam.switch_app_id(app_id)
    }

    /// Verifica se o Steam está habilitado
    pub fn is_enabled(&self) -> bool {
        if let Ok(steam) = self.steam.lock() {
            steam.is_enabled()
        } else {
            false
        }
    }

    pub fn get_last_init_error(&self) -> Option<String> {
        if let Ok(steam) = self.steam.lock() {
            steam.get_last_init_error()
        } else {
            Some("Lock error while reading Steam integration status".to_string())
        }
    }

    /// Inicia o monitoramento Steam
    pub fn start_monitoring(&self) -> Result<()> {
        if !self.is_enabled() {
            return Err(anyhow::anyhow!("Steam integration not initialized"));
        }

        let mut running = self
            .running
            .lock()
            .map_err(|e| anyhow::anyhow!("Lock error: {}", e))?;
        if *running {
            return Ok(());
        }
        *running = true;
        drop(running);

        log::info!("Starting Steam achievement monitoring...");

        let steam = Arc::clone(&self.steam);
        let running = Arc::clone(&self.running);
        let _app_handle = self.app_handle.clone();

        thread::spawn(move || {
            loop {
                // Verifica se deve continuar rodando
                {
                    let running_guard = running.lock().unwrap();
                    if !*running_guard {
                        break;
                    }
                }

                // Executa callbacks do Steam
                if let Ok(steam_guard) = steam.lock() {
                    steam_guard.run_callbacks();
                }

                // Aguarda um pouco antes do próximo ciclo
                thread::sleep(Duration::from_millis(100));
            }

            log::info!("Steam monitoring thread stopped");
        });

        // Emite jogos Steam iniciais
        if let Some(app_handle) = &self.app_handle {
            if let Ok(games) = self.get_steam_games() {
                if let Err(e) = app_handle.emit("steam-games-update", games) {
                    log::error!("Failed to emit Steam games: {}", e);
                }
            }
        }

        Ok(())
    }

    /// Para o monitoramento Steam
    pub fn stop_monitoring(&self) {
        log::info!("Stopping Steam achievement monitoring...");
        if let Ok(mut running) = self.running.lock() {
            *running = false;
        }
    }

    /// Encerra a integração Steam e libera a sessão.
    pub fn shutdown(&self) -> Result<()> {
        self.stop_monitoring();
        let mut steam = self
            .steam
            .lock()
            .map_err(|e| anyhow::anyhow!("Lock error: {}", e))?;
        steam.shutdown();
        Ok(())
    }

    /// Obtém jogos Steam com conquistas
    pub fn get_steam_games(&self) -> Result<Vec<SteamGame>> {
        let steam = self
            .steam
            .lock()
            .map_err(|e| anyhow::anyhow!("Lock error: {}", e))?;
        steam.get_owned_games()
    }

    /// Obtém informações do usuário Steam
    pub fn get_user_info(&self) -> Result<(String, String)> {
        let steam = self
            .steam
            .lock()
            .map_err(|e| anyhow::anyhow!("Lock error: {}", e))?;
        steam.get_user_info()
    }

    /// Define o estado de uma conquista
    pub fn set_achievement(&self, achievement_name: &str, unlocked: bool) -> Result<()> {
        let steam = self
            .steam
            .lock()
            .map_err(|e| anyhow::anyhow!("Lock error: {}", e))?;
        steam.set_achievement(achievement_name, unlocked)
    }

    /// Obtém conquistas de um jogo
    pub fn get_game_achievements(
        &self,
        app_id: u32,
    ) -> Result<Vec<crate::steam_integration::SteamAchievementData>> {
        let steam = self
            .steam
            .lock()
            .map_err(|e| anyhow::anyhow!("Lock error: {}", e))?;
        steam.get_game_achievements(app_id)
    }

    /// Obtém o estado de uma conquista
    pub fn get_achievement_status(&self, achievement_name: &str) -> Result<bool> {
        let steam = self
            .steam
            .lock()
            .map_err(|e| anyhow::anyhow!("Lock error: {}", e))?;
        steam.get_achievement_status(achievement_name)
    }

    /// Detecta jogos Steam instalados
    pub fn detect_installed_games(&self) -> Result<Vec<std::path::PathBuf>> {
        let steam = self
            .steam
            .lock()
            .map_err(|e| anyhow::anyhow!("Lock error: {}", e))?;
        steam.detect_installed_games()
    }

    /// Obtém diretórios de bibliotecas Steam detectados no sistema.
    pub fn get_steam_library_folders(&self) -> Result<Vec<std::path::PathBuf>> {
        let steam = self
            .steam
            .lock()
            .map_err(|e| anyhow::anyhow!("Lock error: {}", e))?;
        steam.get_steam_library_folders()
    }
}

impl Default for SteamMonitor {
    fn default() -> Self {
        Self::new()
    }
}
