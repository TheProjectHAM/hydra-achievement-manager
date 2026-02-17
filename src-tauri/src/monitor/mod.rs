use crate::models::{DirectoryConfig, GameAchievements};
use crate::parser::AchievementParser;
use anyhow::Result;
use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::PathBuf;
use std::sync::mpsc::{channel, Receiver, Sender};
use std::thread;
use tauri::Emitter;

pub struct AchievementMonitor {
    directories: Vec<DirectoryConfig>,
    watcher: Option<RecommendedWatcher>,
    app_handle: Option<tauri::AppHandle>,
}

impl AchievementMonitor {
    /// Cria um novo monitor
    pub fn new(configs: Vec<DirectoryConfig>) -> Self {
        Self {
            directories: configs,
            watcher: None,
            app_handle: None,
        }
    }

    /// Define o app handle para emitir eventos
    pub fn set_app_handle(&mut self, app_handle: tauri::AppHandle) {
        self.app_handle = Some(app_handle);
    }

    /// Inicia o monitoramento
    pub fn start_monitoring(&mut self) -> Result<()> {
        log::info!(
            "Starting achievement monitoring for {} directories...",
            self.directories.len()
        );

        let (tx, rx): (
            Sender<notify::Result<Event>>,
            Receiver<notify::Result<Event>>,
        ) = channel();

        let mut watcher = RecommendedWatcher::new(tx, Config::default())?;

        // Adiciona watchers para cada diretório ativado
        for dir in &self.directories {
            if !dir.enabled {
                log::info!("Skipping disabled directory: {}", dir.path);
                continue;
            }
            let path = PathBuf::from(&dir.path);
            if path.exists() {
                watcher.watch(&path, RecursiveMode::Recursive)?;
                log::info!("Monitoring active for {}: {}", dir.name, dir.path);
            } else {
                log::warn!("Monitoring FAILED - Directory does not exist: {}", dir.path);
            }
        }

        self.watcher = Some(watcher);

        // Spawn thread para processar eventos com debounce
        if let Some(app_handle) = self.app_handle.clone() {
            let directories = self.directories.clone();

            thread::spawn(move || {
                let mut last_event_time = std::time::Instant::now();
                let debounce_duration = std::time::Duration::from_millis(500);
                let mut pending_update = false;

                loop {
                    // Tenta receber eventos com timeout para implementar debounce
                    match rx.recv_timeout(std::time::Duration::from_millis(100)) {
                        Ok(Ok(event)) => {
                            if event.paths.iter().any(|p| {
                                matches!(
                                    p.file_name().and_then(|n| n.to_str()),
                                    Some("achievements.ini") | Some("achievements.json")
                                )
                            }) {
                                last_event_time = std::time::Instant::now();
                                pending_update = true;
                            }
                        }
                        Ok(Err(e)) => log::error!("System Watcher error: {:?}", e),
                        Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                            // Se passou o tempo de debounce e temos um update pendente
                            if pending_update && last_event_time.elapsed() >= debounce_duration {
                                log::info!(
                                    "Debounce period finished. Refreshing achievement data..."
                                );

                                let paths: Vec<String> = directories
                                    .iter()
                                    .filter(|d| d.enabled)
                                    .map(|d| d.path.clone())
                                    .collect();

                                let games = AchievementParser::parse_directories(&paths);
                                log::info!(
                                    "Refresh complete (debounced). Found {} games.",
                                    games.len()
                                );

                                if let Err(e) = app_handle.emit("achievements-update", games) {
                                    log::error!("Failed to emit update: {}", e);
                                }

                                pending_update = false;
                            }
                        }
                        Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => break,
                    }
                }
            });
        }

        // Emite achievements iniciais
        let initial_games = self.get_current_achievements();
        log::info!(
            "Initial scan complete. Total games found: {}",
            initial_games.len()
        );

        if let Some(app_handle) = &self.app_handle {
            if let Err(e) = app_handle.emit("achievements-update", initial_games) {
                log::error!("Failed to emit initial achievements: {}", e);
            }
        }

        Ok(())
    }

    /// Para o monitoramento
    pub fn stop_monitoring(&mut self) {
        log::info!("Stopping achievement monitoring...");
        self.watcher = None;
    }

    /// Obtém achievements atuais
    pub fn get_current_achievements(&self) -> Vec<GameAchievements> {
        let paths: Vec<String> = self
            .directories
            .iter()
            .filter(|d| d.enabled)
            .map(|d| d.path.clone())
            .collect();
        AchievementParser::parse_directories(&paths)
    }

    /// Obtém diretórios monitorados
    pub fn get_directories(&self) -> Vec<DirectoryConfig> {
        self.directories.clone()
    }

    /// Define novos diretórios
    pub fn set_directories(&mut self, configs: Vec<DirectoryConfig>) {
        self.directories = configs;
    }

    /// Reinicia o monitoramento
    pub fn restart_monitoring(&mut self) -> Result<()> {
        self.stop_monitoring();
        self.start_monitoring()
    }
}
