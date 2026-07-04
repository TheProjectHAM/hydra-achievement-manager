use crate::models::{DirectoryConfig, GameAchievements};
use crate::parser::AchievementParser;
use anyhow::Result;
use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::mpsc::{channel, Receiver, Sender};
use std::thread;
use tauri::Emitter;

/// Todos os nomes de arquivo de conquista que devem ser monitorados.
///
/// Conforme documentação do Hydra, inclui:
/// - `achievements.ini` / `Achievements.ini` (CODEX, RUNE, RLE, SmartSteamEmu, RLD!, OnlineFix)
/// - `achievements.json` (Goldberg, EMPRESS)
/// - `achiev.ini` (SKIDROW)
/// - `achievement` (Razor1911)
/// - `user_stats.ini` (user_stats)
/// - `CreamAPI.Achievements.cfg` (CreamAPI)
const ACHIEVEMENT_FILE_PATTERNS: &[&str] = &[
    "achievements.ini",
    "Achievements.ini",
    "achievements.json",
    "achiev.ini",
    "achievement",
    "user_stats.ini",
    "CreamAPI.Achievements.cfg",
];

pub struct AchievementMonitor {
    directories: Vec<DirectoryConfig>,
    watcher: Option<RecommendedWatcher>,
    app_handle: Option<tauri::AppHandle>,
    /// Cache de mtime por arquivo para detectar mudanças.
    file_mtimes: HashMap<String, u64>,
}

impl AchievementMonitor {
    /// Cria um novo monitor
    pub fn new(configs: Vec<DirectoryConfig>) -> Self {
        Self {
            directories: configs,
            watcher: None,
            app_handle: None,
            file_mtimes: HashMap::new(),
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
                    match rx.recv_timeout(std::time::Duration::from_millis(100)) {
                        Ok(Ok(event)) => {
                            if event.paths.iter().any(|p| Self::is_achievement_file(p)) {
                                last_event_time = std::time::Instant::now();
                                pending_update = true;
                            }
                        }
                        Ok(Err(e)) => log::error!("System Watcher error: {:?}", e),
                        Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                            if pending_update && last_event_time.elapsed() >= debounce_duration {
                                log::info!(
                                    "Debounce period finished. Refreshing achievement data..."
                                );

                                let enabled_directories: Vec<DirectoryConfig> =
                                    directories.iter().filter(|d| d.enabled).cloned().collect();

                                let games = AchievementParser::parse_directory_configs(
                                    &enabled_directories,
                                );
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
        self.file_mtimes.clear();
    }

    /// Obtém achievements atuais
    pub fn get_current_achievements(&self) -> Vec<GameAchievements> {
        let configs: Vec<DirectoryConfig> = self
            .directories
            .iter()
            .filter(|d| d.enabled)
            .cloned()
            .collect();
        AchievementParser::parse_directory_configs(&configs)
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

    /// Verifica se um arquivo é um arquivo de conquista baseado no nome.
    ///
    /// Suporta todos os padrões de arquivo documentados:
    /// - `achievements.ini` / `Achievements.ini`
    /// - `achievements.json`
    /// - `achiev.ini`
    /// - `achievement`
    /// - `user_stats.ini`
    /// - `CreamAPI.Achievements.cfg`
    fn is_achievement_file(path: &std::path::Path) -> bool {
        if let Some(filename) = path.file_name().and_then(|n| n.to_str()) {
            ACHIEVEMENT_FILE_PATTERNS
                .iter()
                .any(|pattern| filename.eq_ignore_ascii_case(pattern))
        } else {
            false
        }
    }

    /// Compara o mtime de um arquivo com o cache para detectar mudanças.
    ///
    /// Retorna `true` se o arquivo mudou desde a última verificação.
    pub fn has_file_changed(&mut self, file_path: &str) -> bool {
        let current_mtime = std::fs::metadata(file_path)
            .ok()
            .and_then(|m| m.modified().ok())
            .and_then(|t| {
                t.duration_since(std::time::UNIX_EPOCH)
                    .ok()
                    .map(|d| d.as_secs())
            })
            .unwrap_or(0);

        let previous_mtime = self.file_mtimes.get(file_path).copied().unwrap_or(0);

        self.file_mtimes
            .insert(file_path.to_string(), current_mtime);

        current_mtime != previous_mtime
    }
}

impl Drop for AchievementMonitor {
    fn drop(&mut self) {
        log::info!("[AchievementMonitor] Drop: stopping file watcher");
        self.watcher = None;
        self.file_mtimes.clear();
    }
}
