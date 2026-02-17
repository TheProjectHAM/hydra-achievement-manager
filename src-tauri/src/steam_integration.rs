use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use steamworks::{Client, ClientManager, SingleClient};

/// Representa um jogo Steam detectado
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteamGame {
    #[serde(rename = "gameId")]
    pub game_id: String,
    pub name: String,
    #[serde(rename = "achievementsTotal")]
    pub achievements_total: u32,
    #[serde(rename = "achievementsCurrent")]
    pub achievements_current: u32,
    pub source: String, // "steam"
}

/// Representa uma conquista Steam
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteamAchievementData {
    pub name: String,
    #[serde(rename = "displayName")]
    pub display_name: String,
    pub description: String,
    pub achieved: bool,
    #[serde(rename = "unlockTime")]
    pub unlock_time: u32,
    pub icon: String,
    #[serde(rename = "iconGray")]
    pub icon_gray: String,
}

/// Gerenciador de integração com Steam
pub struct SteamIntegration {
    client: Option<Arc<Mutex<Client<ClientManager>>>>,
    single_client: Option<Arc<Mutex<SingleClient<ClientManager>>>>,
    enabled: bool,
    last_init_error: Option<String>,
}

impl SteamIntegration {
    fn get_steam_appid_path() -> Result<PathBuf> {
        let exe = std::env::current_exe()?;
        let exe_dir = exe
            .parent()
            .ok_or_else(|| anyhow::anyhow!("Failed to resolve executable directory"))?;
        Ok(exe_dir.join("steam_appid.txt"))
    }

    fn resolve_appid_for_init() -> String {
        if let Ok(v) = std::env::var("SteamAppId") {
            let trimmed = v.trim();
            if !trimmed.is_empty() {
                return trimmed.to_string();
            }
        }
        if let Ok(v) = std::env::var("SteamGameId") {
            let trimmed = v.trim();
            if !trimmed.is_empty() {
                return trimmed.to_string();
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

        // Fallback para evitar FailedGeneric("No appID found...")
        "480".to_string()
    }

    fn ensure_steam_appid_file(app_id: &str) {
        match Self::get_steam_appid_path() {
            Ok(path) => {
                let needs_write = match std::fs::read_to_string(&path) {
                    Ok(content) => content.trim() != app_id,
                    Err(_) => true,
                };
                if needs_write {
                    if let Err(e) = std::fs::write(&path, app_id) {
                        log::warn!("Failed to write steam_appid.txt at {:?}: {}", path, e);
                    } else {
                        log::info!("steam_appid.txt ensured at {:?}", path);
                    }
                }
            }
            Err(e) => log::warn!("Failed to resolve steam_appid.txt path: {}", e),
        }
    }

    /// Cria uma nova instância do gerenciador Steam
    pub fn new() -> Self {
        Self {
            client: None,
            single_client: None,
            enabled: false,
            last_init_error: None,
        }
    }

    /// Inicializa o cliente Steam
    pub fn initialize(&mut self) -> Result<()> {
        if self.enabled {
            return Ok(());
        }
        log::info!("Initializing Steam client...");

        let app_id = Self::resolve_appid_for_init();
        std::env::set_var("SteamAppId", &app_id);
        std::env::set_var("SteamGameId", &app_id);
        Self::ensure_steam_appid_file(&app_id);
        
        // Tentamos inicializar o cliente Steam.
        // O steamworks-rs pode entrar em pânico ou retornar erro se as DLLs não estiverem lá,
        // mas o catch_unwind não é prático aqui por causa de tipos não-unwind-safe.
        // A melhor abordagem é deixar o erro ser capturado pelo match.
        match Client::init() {
            Ok((client, single_client)) => {
                self.client = Some(Arc::new(Mutex::new(client)));
                self.single_client = Some(Arc::new(Mutex::new(single_client)));
                self.enabled = true;
                self.last_init_error = None;
                log::info!("Steam client initialized successfully");
                Ok(())
            }
            Err(e) => {
                log::warn!("Steam integration NOT available (expected if Steam is not running or libs are missing): {:?}", e);
                self.enabled = false;
                self.last_init_error = Some(format!("{:?}", e));
                // Não retornamos erro crítico para não impedir a aplicação de abrir
                Ok(())
            }
        }
    }

    /// Muda o AppID atual criando um novo cliente
    pub fn switch_app_id(&mut self, app_id: u32) -> Result<()> {
        log::info!("Switching Steam AppID to {}", app_id);
        
        // 1. Determina o caminho para o steam_appid.txt ao lado do executável
        let appid_path = Self::get_steam_appid_path()?;

        log::debug!("Writing AppID {} to {:?}", app_id, appid_path);
        let _ = std::fs::write(&appid_path, app_id.to_string());
        
        // 2. Define a variável de ambiente (garante que a DLL da Steam leia o ID correto)
        std::env::set_var("SteamAppId", app_id.to_string());
        std::env::set_var("SteamGameId", app_id.to_string());

        // 3. Limpa o cliente atual
        self.client = None;
        self.single_client = None;
        self.enabled = false;

        // 4. Inicializa novamente
        self.initialize()
    }

    /// Verifica se o Steam está disponível
    pub fn is_enabled(&self) -> bool {
        self.enabled
    }

    pub fn get_last_init_error(&self) -> Option<String> {
        self.last_init_error.clone()
    }

    /// Encerra a sessão Steam local e limpa os clientes em memória.
    pub fn shutdown(&mut self) {
        self.client = None;
        self.single_client = None;
        self.enabled = false;
        self.last_init_error = None;

        // Reset app context to neutral appid so we don't keep a specific game marked as running.
        let neutral_app_id = "480";
        std::env::set_var("SteamAppId", neutral_app_id);
        std::env::set_var("SteamGameId", neutral_app_id);
        Self::ensure_steam_appid_file(neutral_app_id);

        log::info!("Steam client session closed");
    }

    /// Obtém a lista de jogos Steam instalados via arquivos .acf
    pub fn get_owned_games(&self) -> Result<Vec<SteamGame>> {
        let mut games = Vec::new();
        let folders = self.get_steam_library_folders()?;

        for folder in folders {
            let steamapps = folder.join("steamapps");
            if !steamapps.exists() {
                continue;
            }

            if let Ok(entries) = std::fs::read_dir(steamapps) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("acf") {
                        if let Ok(content) = std::fs::read_to_string(&path) {
                            if let (Some(appid), Some(name)) = (self.parse_acf_value(&content, "appid"), self.parse_acf_value(&content, "name")) {
                                if !games.iter().any(|g: &SteamGame| g.game_id == appid) {
                                    games.push(SteamGame {
                                        game_id: appid,
                                        name,
                                        achievements_total: 0, 
                                        achievements_current: 0,
                                        source: "steam".to_string(),
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }

        log::info!("Found {} Steam games via .acf files", games.len());
        Ok(games)
    }

    /// Helper simples para extrair valores de arquivos .acf
    fn parse_acf_value(&self, content: &str, key: &str) -> Option<String> {
        let key_with_quotes = format!("\"{}\"", key);
        for line in content.lines() {
            let line = line.trim();
            if line.to_lowercase().contains(&key_with_quotes.to_lowercase()) {
                let parts: Vec<&str> = line.split('\"').collect();
                if parts.len() >= 4 {
                    return Some(parts[3].to_string());
                }
            }
        }
        None
    }

    /// Obtém conquistas de um jogo específico
    pub fn get_game_achievements(&self, _app_id: u32) -> Result<Vec<SteamAchievementData>> {
        if !self.enabled {
            return Err(anyhow::anyhow!("Steam integration not enabled"));
        }

        let client_lock = self.client.as_ref()
            .context("Steam client not initialized")?;
        
        let guard = client_lock.lock().map_err(|e| anyhow::anyhow!("Lock error: {}", e))?;
        let client = &*guard;

        let user_stats = client.user_stats();
        
        // Solicita estatísticas do usuário
        user_stats.request_current_stats();
        
        // Aguarda um pouco para as stats serem carregadas
        std::thread::sleep(std::time::Duration::from_millis(500));

        let achievements = Vec::new();

        // Nota: steamworks-rs não fornece uma maneira fácil de listar todas as conquistas
        // Precisamos conhecer os nomes das conquistas antecipadamente
        // Vamos usar a API web para isso
        
        drop(guard);
        
        Ok(achievements)
    }

    /// Define o estado de uma conquista
    pub fn set_achievement(&self, achievement_name: &str, unlocked: bool) -> Result<()> {
        if !self.enabled {
            return Err(anyhow::anyhow!("Steam integration not enabled"));
        }

        let client_lock = self.client.as_ref()
            .context("Steam client not initialized")?;
        
        let guard = client_lock.lock().map_err(|e| anyhow::anyhow!("Lock error: {}", e))?;
        let client = &*guard;

        let user_stats = client.user_stats();
        
        if unlocked {
            user_stats.achievement(achievement_name).set().map_err(|_| anyhow::anyhow!("Failed to set achievement"))?;
            log::info!("Achievement '{}' unlocked", achievement_name);
        } else {
            user_stats.achievement(achievement_name).clear().map_err(|_| anyhow::anyhow!("Failed to clear achievement"))?;
            log::info!("Achievement '{}' locked", achievement_name);
        }

        // Salva as mudanças
        user_stats.store_stats().map_err(|_| anyhow::anyhow!("Failed to store stats"))?;
        
        drop(guard);
        
        Ok(())
    }

    /// Obtém o estado de uma conquista
    pub fn get_achievement_status(&self, achievement_name: &str) -> Result<bool> {
        if !self.enabled {
            return Err(anyhow::anyhow!("Steam integration not enabled"));
        }

        let client_lock = self.client.as_ref()
            .context("Steam client not initialized")?;
        
        let guard = client_lock.lock().map_err(|e| anyhow::anyhow!("Lock error: {}", e))?;
        let client = &*guard;

        let user_stats = client.user_stats();
        let achievement = user_stats.achievement(achievement_name);
        let unlocked = achievement.get().map_err(|_| anyhow::anyhow!("Failed to get achievement status"))?;
        
        drop(guard);
        
        Ok(unlocked)
    }

    /// Executa callbacks do Steam
    pub fn run_callbacks(&self) {
        if !self.enabled {
            return;
        }

        if let Some(single_client_lock) = &self.single_client {
            if let Ok(guard) = single_client_lock.lock() {
                guard.run_callbacks();
            }
        }
    }

    /// Obtém informações do usuário Steam
    pub fn get_user_info(&self) -> Result<(String, String)> {
        if !self.enabled {
            return Err(anyhow::anyhow!("Steam integration not enabled"));
        }

        let client_lock = self.client.as_ref()
            .context("Steam client not initialized")?;
        
        let guard = client_lock.lock().map_err(|e| anyhow::anyhow!("Lock error: {}", e))?;
        let client = &*guard;

        let friends = client.friends();
        let user_id = client.user().steam_id().raw().to_string();
        let user_name = friends.name();
        
        drop(guard);
        
        Ok((user_id, user_name))
    }

    /// Detecta jogos Steam instalados localmente
    pub fn detect_installed_games(&self) -> Result<Vec<PathBuf>> {
        let mut game_paths = Vec::new();

        // Detecta diretórios de instalação do Steam
        let steam_dirs = self.get_steam_library_folders()?;

        for steam_dir in steam_dirs {
            let common_path = steam_dir.join("steamapps").join("common");
            if common_path.exists() {
                if let Ok(entries) = std::fs::read_dir(&common_path) {
                    for entry in entries.flatten() {
                        if entry.path().is_dir() {
                            game_paths.push(entry.path());
                        }
                    }
                }
            }
        }

        Ok(game_paths)
    }

    /// Obtém os diretórios das bibliotecas Steam
    pub fn get_steam_library_folders(&self) -> Result<Vec<PathBuf>> {
        let mut folders = Vec::new();

        #[cfg(target_os = "linux")]
        let possible_roots = vec![
            dirs::home_dir().map(|h| h.join(".steam/steam")),
            dirs::home_dir().map(|h| h.join(".local/share/Steam")),
            dirs::home_dir().map(|h| h.join(".var/app/com.valvesoftware.Steam/.steam/steam")),
        ];

        #[cfg(target_os = "linux")]
        for root_opt in possible_roots {
            if let Some(root) = root_opt {
                if root.exists() {
                    if !folders.contains(&root) {
                        folders.push(root.clone());
                    }

                    // Lê libraryfolders.vdf para encontrar outras bibliotecas
                    let library_vdf = root.join("steamapps").join("libraryfolders.vdf");
                    if library_vdf.exists() {
                        if let Ok(content) = std::fs::read_to_string(&library_vdf) {
                            for line in content.lines() {
                                if line.contains("\"path\"") {
                                    if let Some(path_str) = line.split('\"').nth(3) {
                                        let path = PathBuf::from(path_str);
                                        if path.exists() && !folders.contains(&path) {
                                            folders.push(path);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        #[cfg(target_os = "windows")]
        let possible_roots = vec![
            PathBuf::from("C:\\Program Files (x86)\\Steam"),
            PathBuf::from("C:\\Program Files\\Steam"),
        ];

        #[cfg(target_os = "windows")]
        for root in possible_roots {
            if root.exists() {
                if !folders.contains(&root) {
                    folders.push(root.clone());
                }

                // Lê libraryfolders.vdf para encontrar outras bibliotecas (D:, E:, etc.)
                let library_vdf = root.join("steamapps").join("libraryfolders.vdf");
                if library_vdf.exists() {
                    if let Ok(content) = std::fs::read_to_string(&library_vdf) {
                        for line in content.lines() {
                            if line.contains("\"path\"") {
                                if let Some(path_str) = line.split('\"').nth(3) {
                                    let normalized = path_str.replace("\\\\", "\\");
                                    let path = PathBuf::from(normalized);
                                    if path.exists() && !folders.contains(&path) {
                                        folders.push(path);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        Ok(folders)
    }
}

impl Default for SteamIntegration {
    fn default() -> Self {
        Self::new()
    }
}
