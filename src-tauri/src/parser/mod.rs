use crate::models::{AchievementEntry, Cracker, DirectoryConfig, DirectoryDetectionPreset, GameAchievements};
use anyhow::{Context, Result};
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};

pub struct AchievementParser;

impl AchievementParser {
    // ── INI Parser customizado ──────────────────────────────────────────

    /// Faz o parse de um arquivo INI manualmente, sem biblioteca externa.
    ///
    /// - Remove BOM (0xFEFF) se presente
    /// - Ignora linhas começando com `###`
    /// - Seções: `[NomeSeção]`
    /// - Chaves: `chave=valor`
    fn parse_ini(content: &str) -> Vec<(String, Vec<(String, String)>)> {
        let content = content.trim_start_matches('\u{FEFF}'); // Remove BOM
        let mut sections: Vec<(String, Vec<(String, String)>)> = Vec::new();
        let mut current_section = String::new();
        let mut current_pairs: Vec<(String, String)> = Vec::new();

        for line in content.lines() {
            let line = line.trim();

            // Ignora linhas de comentário ###
            if line.starts_with("###") {
                continue;
            }

            // Seção
            if line.starts_with('[') && line.ends_with(']') {
                if !current_section.is_empty() {
                    sections.push((current_section.clone(), current_pairs.clone()));
                    current_pairs.clear();
                }
                current_section = line[1..line.len() - 1].to_string();
                continue;
            }

            // Chave=Valor
            if let Some((key, value)) = line.split_once('=') {
                current_pairs.push((key.trim().to_string(), value.trim().to_string()));
            }
        }

        // Adiciona a última seção
        if !current_section.is_empty() {
            sections.push((current_section, current_pairs));
        }

        sections
    }

    // �── Parser principal ────────────────────────────────────────────────

    /// Parse um arquivo de conquistas de acordo com o tipo de cracker.
    pub fn parse_achievement_file<P: AsRef<Path>>(
        file_path: P,
        cracker: Cracker,
    ) -> Result<Vec<AchievementEntry>> {
        let file_path = file_path.as_ref();

        match cracker {
            Cracker::Flt => return Self::parse_flt_directory(file_path),
            Cracker::Razor1911 => return Self::parse_razor1911(file_path),
            _ => {}
        }

        let content = fs::read_to_string(file_path)
            .with_context(|| format!("Failed to read achievement file: {}", file_path.display()))?;

        match cracker {
            Cracker::Codex | Cracker::Rune | Cracker::Rle | Cracker::SmartSteamEmu => {
                Self::process_default(&content)
            }
            Cracker::OnlineFix => Self::process_online_fix(&content),
            Cracker::Goldberg | Cracker::Empress => {
                Self::process_goldberg_json(&content, file_path)
            }
            Cracker::Rld => Self::process_rld(&content),
            Cracker::Skidrow => Self::process_skidrow(&content),
            Cracker::CreamApi => Self::process_cream_api(&content),
            Cracker::UserStats => Self::process_user_stats(&content),
            Cracker::ThreeDm => Self::process_3dm(&content),
            Cracker::SteamCache => Self::process_steam_cache(&content, file_path),
            _ => Self::process_default(&content),
        }
    }

    /// Detecta automaticamente o cracker pelo path do arquivo e faz o parse.
    pub fn parse_achievement_file_auto<P: AsRef<Path>>(
        file_path: P,
    ) -> Result<Vec<AchievementEntry>> {
        let file_path = file_path.as_ref();
        let path_str = file_path.to_string_lossy().to_lowercase();
        let filename = file_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_lowercase();

        let cracker = if path_str.contains("/codex/") || path_str.contains("\\codex\\") {
            Cracker::Codex
        } else if path_str.contains("/rune/") || path_str.contains("\\rune\\") {
            Cracker::Rune
        } else if path_str.contains("/onlinefix/") || path_str.contains("\\onlinefix\\") {
            Cracker::OnlineFix
        } else if path_str.contains("goldberg steamemu saves")
            || path_str.contains("gse saves")
            || path_str.contains("goldberg_steamemu")
        {
            Cracker::Goldberg
        } else if path_str.contains("/rld!") || path_str.contains("\\rld!") {
            Cracker::Rld
        } else if path_str.contains("/empress/") || path_str.contains("\\empress\\") {
            Cracker::Empress
        } else if path_str.contains("/skidrow/") || path_str.contains("\\skidrow\\") {
            Cracker::Skidrow
        } else if path_str.contains("/creamapi/") || path_str.contains("\\creamapi\\") {
            Cracker::CreamApi
        } else if path_str.contains("/smartsteamemu/") || path_str.contains("\\smartsteamemu\\") {
            Cracker::SmartSteamEmu
        } else if path_str.contains("/rle/") || path_str.contains("\\rle\\") {
            Cracker::Rle
        } else if path_str.contains("/.1911/") || path_str.contains("\\.1911\\") {
            Cracker::Razor1911
        } else if filename == "user_stats.ini" {
            Cracker::UserStats
        } else if path_str.contains("/3dmgame/") || path_str.contains("\\3dmgame\\") {
            Cracker::ThreeDm
        } else if path_str.contains("/flt/") || path_str.contains("\\flt\\") {
            Cracker::Flt
        } else if path_str.contains("librarycache") && filename.ends_with(".json") {
            Cracker::SteamCache
        } else {
            // Fallback: tenta detectar pelo formato do arquivo
            if filename.ends_with(".json") {
                Cracker::Goldberg
            } else {
                Cracker::Codex
            }
        };

        Self::parse_achievement_file(file_path, cracker)
    }

    // ── Parsers por cracker ─────────────────────────────────────────────

    /// Parser padrão: CODEX, RUNE, RLE, SmartSteamEmu
    ///
    /// Formato INI:
    /// ```ini
    /// [AchievementName]
    /// Achieved=1
    /// UnlockTime=1234567890
    /// ```
    fn process_default(content: &str) -> Result<Vec<AchievementEntry>> {
        let sections = Self::parse_ini(content);
        let mut achievements = Vec::new();

        for (name, pairs) in sections {
            let mut achieved = false;
            let mut unlock_time: i64 = 0;

            for (key, value) in &pairs {
                match key.as_str() {
                    "Achieved" => achieved = value == "1",
                    "UnlockTime" => unlock_time = value.parse().unwrap_or(0),
                    _ => {}
                }
            }

            achievements.push(AchievementEntry {
                name,
                achieved,
                unlock_time,
            });
        }

        Ok(achievements)
    }

    /// Parser OnlineFix
    ///
    /// Formato INI:
    /// ```ini
    /// [AchievementName]
    /// achieved=true
    /// timestamp=1234567890
    /// ```
    /// ou
    /// ```ini
    /// [AchievementName]
    /// Achieved=true
    /// TimeUnlocked=1234567890
    /// ```
    fn process_online_fix(content: &str) -> Result<Vec<AchievementEntry>> {
        let sections = Self::parse_ini(content);
        let mut achievements = Vec::new();

        for (name, pairs) in sections {
            let mut achieved = false;
            let mut unlock_time: i64 = 0;

            for (key, value) in &pairs {
                match key.as_str() {
                    "achieved" | "Achieved" => {
                        achieved = value.eq_ignore_ascii_case("true");
                    }
                    "timestamp" | "TimeUnlocked" => {
                        unlock_time = value.parse().unwrap_or(0);
                    }
                    _ => {}
                }
            }

            achievements.push(AchievementEntry {
                name,
                achieved,
                unlock_time,
            });
        }

        Ok(achievements)
    }

    /// Parser Goldberg/EMPRESS (JSON)
    ///
    /// Formato JSON (objeto):
    /// ```json
    /// {
    ///   "AchievementName": {
    ///     "earned": true,
    ///     "earned_time": 1234567890
    ///   }
    /// }
    /// ```
    /// Também suporta formato de array.
    fn process_goldberg_json(content: &str, file_path: &Path) -> Result<Vec<AchievementEntry>> {
        let json: Value = serde_json::from_str(content)
            .with_context(|| format!("Failed to parse JSON: {}", file_path.display()))?;

        let mut achievements = Vec::new();

        // Formato de objeto (mais comum)
        if let Some(obj) = json.as_object() {
            for (name, payload) in obj {
                if let Some(payload_obj) = payload.as_object() {
                    let achieved = payload_obj
                        .get("earned")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(false);
                    let unlock_time = payload_obj
                        .get("earned_time")
                        .and_then(|v| v.as_i64())
                        .unwrap_or(0);

                    achievements.push(AchievementEntry {
                        name: name.clone(),
                        achieved,
                        unlock_time,
                    });
                }
            }
            return Ok(achievements);
        }

        // Formato de array
        if let Some(arr) = json.as_array() {
            for item in arr {
                if let Some(obj) = item.as_object() {
                    let name = obj
                        .get("name")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();
                    let achieved = obj
                        .get("earned")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(false);
                    let unlock_time = obj
                        .get("earned_time")
                        .and_then(|v| v.as_i64())
                        .unwrap_or(0);

                    achievements.push(AchievementEntry {
                        name,
                        achieved,
                        unlock_time,
                    });
                }
            }
        }

        Ok(achievements)
    }

    /// Parser RLD!
    ///
    /// Formato INI com valores em hexadecimal:
    /// ```ini
    /// [AchievementName]
    /// State=01000000
    /// Time=60E3A458
    /// ```
    /// State e Time são uint32 little-endian em hex.
    fn process_rld(content: &str) -> Result<Vec<AchievementEntry>> {
        let sections = Self::parse_ini(content);
        let mut achievements = Vec::new();

        for (name, pairs) in sections {
            let mut achieved = false;
            let mut unlock_time: i64 = 0;

            for (key, value) in &pairs {
                match key.as_str() {
                    "State" => {
                        if let Ok(bytes) = Self::hex_to_u32_le(value) {
                            achieved = bytes == 1;
                        }
                    }
                    "Time" => {
                        if let Ok(bytes) = Self::hex_to_u32_le(value) {
                            unlock_time = bytes as i64;
                        }
                    }
                    _ => {}
                }
            }

            achievements.push(AchievementEntry {
                name,
                achieved,
                unlock_time,
            });
        }

        Ok(achievements)
    }

    /// Parser SKIDROW
    ///
    /// Formato INI com seção `[Achievements]`:
    /// ```ini
    /// [Achievements]
    /// AchievementName=1@1234567890@DisplayName
    /// ```
    fn process_skidrow(content: &str) -> Result<Vec<AchievementEntry>> {
        let sections = Self::parse_ini(content);
        let mut achievements = Vec::new();

        for (section_name, pairs) in sections {
            if section_name != "Achievements" {
                continue;
            }

            for (name, value) in pairs {
                let parts: Vec<&str> = value.split('@').collect();
                let achieved = parts.first().map(|s| *s == "1").unwrap_or(false);
                let unlock_time = parts
                    .get(1)
                    .and_then(|s| s.parse::<i64>().ok())
                    .unwrap_or(0);

                achievements.push(AchievementEntry {
                    name,
                    achieved,
                    unlock_time,
                });
            }
        }

        Ok(achievements)
    }

    /// Parser CreamAPI
    ///
    /// Formato INI:
    /// ```ini
    /// [AchievementName]
    /// achieved=true
    /// unlocktime=1234567890
    /// ```
    fn process_cream_api(content: &str) -> Result<Vec<AchievementEntry>> {
        let sections = Self::parse_ini(content);
        let mut achievements = Vec::new();

        for (name, pairs) in sections {
            let mut achieved = false;
            let mut unlock_time: i64 = 0;

            for (key, value) in &pairs {
                match key.as_str() {
                    "achieved" => achieved = value.eq_ignore_ascii_case("true"),
                    "unlocktime" => unlock_time = value.parse().unwrap_or(0),
                    _ => {}
                }
            }

            achievements.push(AchievementEntry {
                name,
                achieved,
                unlock_time,
            });
        }

        Ok(achievements)
    }

    /// Parser user_stats (diretório do executável)
    ///
    /// Formato INI com seção `[ACHIEVEMENTS]`:
    /// ```ini
    /// [ACHIEVEMENTS]
    /// "AchievementName" = "{unlocked = true, time = 1234567890}"
    /// ```
    fn process_user_stats(content: &str) -> Result<Vec<AchievementEntry>> {
        let sections = Self::parse_ini(content);
        let mut achievements = Vec::new();

        for (section_name, pairs) in sections {
            if section_name != "ACHIEVEMENTS" {
                continue;
            }

            for (name, value) in pairs {
                // Remove aspas do nome
                let clean_name = name.trim_matches('"').to_string();

                let achieved = value.contains("unlocked = true") || value.contains("unlocked=true");
                let time = Self::extract_time_from_braces(&value);

                achievements.push(AchievementEntry {
                    name: clean_name,
                    achieved,
                    unlock_time: time,
                });
            }
        }

        Ok(achievements)
    }

    /// Parser 3DM (diretório do executável)
    ///
    /// Formato INI com seções `[State]` e `[Time]`:
    /// ```ini
    /// [State]
    /// AchievementName=0101
    /// [Time]
    /// AchievementName=60E3A458
    /// ```
    /// Valores em hex. `0101` = desbloqueado.
    fn process_3dm(content: &str) -> Result<Vec<AchievementEntry>> {
        let sections = Self::parse_ini(content);
        let mut states: std::collections::HashMap<String, String> = std::collections::HashMap::new();
        let mut times: std::collections::HashMap<String, String> = std::collections::HashMap::new();

        for (section_name, pairs) in sections {
            match section_name.as_str() {
                "State" => {
                    for (name, value) in pairs {
                        states.insert(name, value);
                    }
                }
                "Time" => {
                    for (name, value) in pairs {
                        times.insert(name, value);
                    }
                }
                _ => {}
            }
        }

        let mut achievements = Vec::new();
        for (name, state_hex) in &states {
            let achieved = state_hex == "0101";
            let unlock_time = times
                .get(name)
                .and_then(|hex| Self::hex_to_u32_le(hex).ok())
                .map(|v| v as i64)
                .unwrap_or(0);

            achievements.push(AchievementEntry {
                name: name.clone(),
                achieved,
                unlock_time,
            });
        }

        Ok(achievements)
    }

    /// Parser Razor1911 (texto plano)
    ///
    /// Formato: cada linha `<nome> <unlocked(0|1)> <unlockTime>` separado por espaços.
    fn parse_razor1911<P: AsRef<Path>>(file_path: P) -> Result<Vec<AchievementEntry>> {
        let file_path = file_path.as_ref();
        let content = fs::read_to_string(file_path)
            .with_context(|| format!("Failed to read Razor1911 file: {}", file_path.display()))?;

        let mut achievements = Vec::new();

        for line in content.lines() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }

            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 3 {
                let name = parts[0].to_string();
                let achieved = parts[1] == "1";
                let unlock_time = parts[2].parse().unwrap_or(0);

                achievements.push(AchievementEntry {
                    name,
                    achieved,
                    unlock_time,
                });
            }
        }

        Ok(achievements)
    }

    /// Parser FLT (diretório de stats)
    ///
    /// Cada arquivo no diretório = uma conquista desbloqueada.
    /// O nome do arquivo é o nome da conquista.
    fn parse_flt_directory<P: AsRef<Path>>(directory_path: P) -> Result<Vec<AchievementEntry>> {
        let directory_path = directory_path.as_ref();

        if !directory_path.exists() || !directory_path.is_dir() {
            return Ok(Vec::new());
        }

        let mut achievements = Vec::new();

        let entries = fs::read_dir(directory_path)
            .with_context(|| format!("Failed to read FLT directory: {}", directory_path.display()))?;

        for entry in entries.flatten() {
            if entry.file_type().map(|ft| ft.is_file()).unwrap_or(false) {
                let name = entry.file_name().to_string_lossy().to_string();
                achievements.push(AchievementEntry {
                    name,
                    achieved: true,
                    unlock_time: 0, // FLT não armazena timestamp
                });
            }
        }

        Ok(achievements)
    }

    /// Parser Steam Cache
    ///
    /// Formato JSON (array) do `librarycache/<objectId>.json`:
    /// ```json
    /// [
    ///   {
    ///     "strID": "AchievementName",
    ///     "bAchieved": true,
    ///     "rtUnlocked": 1234567890,
    ///     "vecHighlight": [...]
    ///   }
    /// ]
    /// ```
    fn process_steam_cache(content: &str, file_path: &Path) -> Result<Vec<AchievementEntry>> {
        let json: Value = serde_json::from_str(content)
            .with_context(|| format!("Failed to parse Steam cache JSON: {}", file_path.display()))?;

        let mut achievements = Vec::new();

        if let Some(arr) = json.as_array() {
            for item in arr {
                if let Some(obj) = item.as_object() {
                    let name = obj
                        .get("strID")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();
                    let achieved = obj
                        .get("bAchieved")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(false);
                    let unlock_time = obj
                        .get("rtUnlocked")
                        .and_then(|v| v.as_i64())
                        .unwrap_or(0);

                    // Ignora entradas sem nome
                    if !name.is_empty() {
                        achievements.push(AchievementEntry {
                            name,
                            achieved,
                            unlock_time,
                        });
                    }
                }
            }
        }

        Ok(achievements)
    }

    // ── Utilitários ─────────────────────────────────────────────────────

    /// Converte uma string hexadecimal para u32 little-endian.
    ///
    /// Exemplo: "60E3A458" → 0x58A4E360
    fn hex_to_u32_le(hex: &str) -> Result<u32> {
        let clean_hex = hex.trim().replace(' ', "");
        if clean_hex.len() != 8 {
            return Ok(0);
        }

        let bytes = u32::from_str_radix(&clean_hex, 16)
            .with_context(|| format!("Invalid hex value: {}", hex))?;

        // Converte de big-endian (como lido) para little-endian
        Ok(bytes.swap_bytes())
    }

    /// Extrai o time de dentro de chaves: `{unlocked = true, time = 1234567890}`
    fn extract_time_from_braces(value: &str) -> i64 {
        if let Some(start) = value.find("time") {
            let after_time = &value[start..];
            if let Some(eq_pos) = after_time.find('=') {
                let after_eq = &after_time[eq_pos + 1..];
                let time_str: String = after_eq
                    .chars()
                    .skip_while(|c| c.is_whitespace())
                    .take_while(|c| c.is_ascii_digit())
                    .collect();
                return time_str.parse().unwrap_or(0);
            }
        }
        0
    }

    // ── Descoberta de arquivos ──────────────────────────────────────────

    /// Encontra todos os arquivos de conquista em um diretório base,
    /// verificando todos os crackers suportados.
    pub fn find_achievement_files_in_dir(base_path: &Path) -> Vec<(Cracker, PathBuf)> {
        let mut found = Vec::new();

        for &cracker in Cracker::all() {
            let paths = Self::get_expected_filenames(cracker);
            for filename in paths {
                let full_path = base_path.join(filename);
                if full_path.exists() {
                    found.push((cracker, full_path));
                }
            }
        }

        found
    }

    /// Retorna os nomes de arquivo esperados para cada cracker.
    fn get_expected_filenames(cracker: Cracker) -> Vec<&'static str> {
        match cracker {
            Cracker::Codex | Cracker::Rune | Cracker::Rle | Cracker::SmartSteamEmu => {
                vec!["achievements.ini", "Achievements.ini"]
            }
            Cracker::OnlineFix => {
                vec!["Stats/Achievements.ini", "Achievements.ini", "achievements.ini"]
            }
            Cracker::Goldberg | Cracker::Empress => vec!["achievements.json"],
            Cracker::Rld => vec!["achievements.ini"],
            Cracker::Skidrow => vec!["SteamEmu/UserStats/achiev.ini"],
            Cracker::CreamApi => vec!["stats/CreamAPI.Achievements.cfg"],
            Cracker::UserStats | Cracker::ThreeDm | Cracker::Flt => vec![],
            Cracker::Razor1911 => vec!["achievement"],
            Cracker::SteamCache => vec![], // Buscado por path específico
        }
    }

    // ── Parse de diretórios (usado pelo monitor) ───────────────────────

    /// Parse um diretório de achievements, detectando automaticamente o formato.
    pub fn parse_directory<P: AsRef<Path>>(directory_path: P) -> Result<Vec<GameAchievements>> {
        let directory_path = directory_path.as_ref();
        let mut games = Vec::new();

        if !directory_path.exists() {
            log::warn!("Scan directory does not exist: {}", directory_path.display());
            return Ok(games);
        }
        log::info!("Scanning directory: {}", directory_path.display());

        let entries = fs::read_dir(directory_path)
            .with_context(|| format!("Failed to read directory: {}", directory_path.display()))?;

        for entry in entries.flatten() {
            if let Ok(metadata) = entry.metadata() {
                if metadata.is_dir() {
                    let game_id = entry.file_name().to_string_lossy().to_string();

                    // Tenta encontrar arquivo de conquista neste diretório
                    let achievement_file = Self::find_achievement_file_in_game_dir(&entry.path(), &game_id);

                    if let Some((achievement_file, cracker)) = achievement_file {
                        log::info!(
                            "Processing game: {} (File: {}, Format: {:?})",
                            game_id,
                            achievement_file.display(),
                            cracker
                        );
                        match Self::parse_achievement_file(&achievement_file, cracker) {
                            Ok(achievements) => {
                                if !achievements.is_empty() {
                                    log::info!(
                                        "Found {} achievements for game {}",
                                        achievements.len(),
                                        game_id
                                    );
                                    let last_modified = fs::metadata(&achievement_file)
                                        .ok()
                                        .and_then(|m| m.modified().ok())
                                        .and_then(|t| {
                                            t.duration_since(std::time::UNIX_EPOCH)
                                                .ok()
                                                .map(|d| d.as_secs() as i64)
                                        })
                                        .unwrap_or(0);

                                    games.push(GameAchievements {
                                        game_id,
                                        achievements,
                                        last_modified,
                                        directory: directory_path.to_string_lossy().to_string(),
                                    });
                                }
                            }
                            Err(e) => {
                                log::error!("Error parsing achievement file: {}", e);
                            }
                        }
                    }
                }
            }
        }

        log::info!(
            "Scan finished for directory '{}'. Found {} valid entries.",
            directory_path.display(),
            games.len()
        );
        Ok(games)
    }

    pub fn parse_directory_config(config: &DirectoryConfig) -> Result<Vec<GameAchievements>> {
        if config.detection_preset == DirectoryDetectionPreset::Auto {
            return Self::parse_directory(&config.path);
        }

        let directory_path = expand_path(&config.path);
        let mut games = Vec::new();

        if !directory_path.exists() {
            log::warn!("Scan directory does not exist: {}", directory_path.display());
            return Ok(games);
        }

        let entries = fs::read_dir(&directory_path)
            .with_context(|| format!("Failed to read directory: {}", directory_path.display()))?;

        for entry in entries.flatten() {
            if !entry.metadata().map(|m| m.is_dir()).unwrap_or(false) {
                continue;
            }

            let game_id = entry.file_name().to_string_lossy().to_string();
            let game_dir = entry.path();
            let (achievement_file, cracker) = Self::preset_achievement_file(
                &game_dir,
                &game_id,
                config.detection_preset,
            );

            if !achievement_file.exists() {
                continue;
            }

            match Self::parse_achievement_file(&achievement_file, cracker) {
                Ok(achievements) => {
                    if achievements.is_empty() {
                        continue;
                    }

                    let last_modified = fs::metadata(&achievement_file)
                        .ok()
                        .and_then(|m| m.modified().ok())
                        .and_then(|t| {
                            t.duration_since(std::time::UNIX_EPOCH)
                                .ok()
                                .map(|d| d.as_secs() as i64)
                        })
                        .unwrap_or(0);

                    games.push(GameAchievements {
                        game_id,
                        achievements,
                        last_modified,
                        directory: config.path.clone(),
                    });
                }
                Err(e) => log::error!("Error parsing configured achievement file: {}", e),
            }
        }

        Ok(games)
    }

    /// Parse múltiplos diretórios
    pub fn parse_directories(directory_paths: &[String]) -> Vec<GameAchievements> {
        let mut all_games = Vec::new();

        for dir_path in directory_paths {
            let expanded_path = expand_path(dir_path);

            match Self::parse_directory(&expanded_path) {
                Ok(games) => {
                    all_games.extend(games);
                }
                Err(e) => {
                    log::error!(
                        "Error parsing directory {}: {}",
                        expanded_path.display(),
                        e
                    );
                }
            }
        }

        all_games
    }

    pub fn parse_directory_configs(configs: &[DirectoryConfig]) -> Vec<GameAchievements> {
        let mut all_games = Vec::new();

        for config in configs {
            match Self::parse_directory_config(config) {
                Ok(games) => all_games.extend(games),
                Err(e) => log::error!("Error parsing directory {}: {}", config.path, e),
            }
        }

        all_games
    }

    pub fn achievement_file_for_config(
        base_path: &Path,
        game_id: &str,
        preset: DirectoryDetectionPreset,
    ) -> (PathBuf, Cracker) {
        let game_dir = base_path.join(game_id);
        if preset == DirectoryDetectionPreset::Auto {
            if let Some(existing) = Self::find_achievement_file_in_game_dir(&game_dir, game_id) {
                return existing;
            }
        }

        Self::preset_achievement_file(&game_dir, game_id, preset)
    }

    pub fn preset_achievement_file(
        game_dir: &Path,
        game_id: &str,
        preset: DirectoryDetectionPreset,
    ) -> (PathBuf, Cracker) {
        match preset {
            DirectoryDetectionPreset::Auto => {
                if let Some(existing) = Self::find_achievement_file_in_game_dir(game_dir, game_id) {
                    existing
                } else {
                    (game_dir.join("achievements.ini"), Cracker::Codex)
                }
            }
            DirectoryDetectionPreset::CodexIni => (game_dir.join("achievements.ini"), Cracker::Codex),
            DirectoryDetectionPreset::GoldbergJson => (game_dir.join("achievements.json"), Cracker::Goldberg),
            DirectoryDetectionPreset::EmpressJson => (
                game_dir.join("remote").join(game_id).join("achievements.json"),
                Cracker::Empress,
            ),
            DirectoryDetectionPreset::OnlineFix => (
                game_dir.join("Stats").join("Achievements.ini"),
                Cracker::OnlineFix,
            ),
            DirectoryDetectionPreset::Skidrow => (
                game_dir.join("SteamEmu").join("UserStats").join("achiev.ini"),
                Cracker::Skidrow,
            ),
            DirectoryDetectionPreset::CreamApi => (
                game_dir.join("stats").join("CreamAPI.Achievements.cfg"),
                Cracker::CreamApi,
            ),
            DirectoryDetectionPreset::SmartSteamEmu => (
                game_dir.join("User").join("Achievements.ini"),
                Cracker::SmartSteamEmu,
            ),
            DirectoryDetectionPreset::Razor1911 => (game_dir.join("achievement"), Cracker::Razor1911),
        }
    }

    /// Encontra o arquivo de conquista em um diretório de jogo.
    ///
    /// Tenta todos os nomes de arquivo conhecidos e retorna o primeiro que existe.
    pub fn find_achievement_file_in_game_dir(
        game_dir: &Path,
        game_id: &str,
    ) -> Option<(PathBuf, Cracker)> {
        // Padrões relativos ao diretório `<cracker>/<objectId>/` conforme Hydra.
        // O cracker é detectado pelo path completo, então `achievements.ini`
        // em RUNE/RLD!/CODEX é interpretado corretamente.
        let candidates = [
            "achievements.ini".to_string(),
            "Achievements.ini".to_string(),
            "achievements.json".to_string(),
            "Stats/Achievements.ini".to_string(),
            "stats/achievements.ini".to_string(),
            "remote/<objectId>/achievements.json".replace("<objectId>", game_id),
            "SteamEmu/UserStats/achiev.ini".to_string(),
            "stats/CreamAPI.Achievements.cfg".to_string(),
            "User/Achievements.ini".to_string(),
            "achievement".to_string(),
        ];

        for filename in candidates {
            let path = game_dir.join(filename);
            if path.exists() {
                return Some((path.clone(), detect_cracker_from_path(&path.to_string_lossy())));
            }
        }

        None
    }
}

/// Expande ~ para o diretório home
pub fn expand_path(path: &str) -> PathBuf {
    if path.starts_with("~/") {
        if let Some(home) = dirs::home_dir() {
            return home.join(&path[2..]);
        }
    }
    PathBuf::from(path)
}

/// Mapeia IDs alternativos para jogos específicos.
///
/// Para certos jogos, o objectId pode ter aliases.
/// Exemplo: Dishonored 205100 → [205100, 217980, 31292]
pub fn get_alternative_object_ids(object_id: &str) -> Vec<String> {
    let mut ids = vec![object_id.to_string()];

    // Dishonored
    if object_id == "205100" {
        ids.push("217980".to_string());
        ids.push("31292".to_string());
    }

    ids
}

/// Determina o tipo de arquivo de conquista pelo caminho do arquivo.
pub fn detect_cracker_from_path(file_path: &str) -> Cracker {
    let lower = file_path.to_lowercase();

    if lower.contains("/codex/") || lower.contains("\\codex\\") {
        Cracker::Codex
    } else if lower.contains("/rune/") || lower.contains("\\rune\\") {
        Cracker::Rune
    } else if lower.contains("/onlinefix/") || lower.contains("\\onlinefix\\") {
        Cracker::OnlineFix
    } else if lower.contains("goldberg steamemu saves") || lower.contains("gse saves") {
        Cracker::Goldberg
    } else if lower.contains("/rld!")
        || lower.contains("\\rld!")
        || lower.contains("/programdata/steam/player/")
        || lower.contains("\\programdata\\steam\\player\\")
        || lower.contains("/programdata/steam/dodi/")
        || lower.contains("\\programdata\\steam\\dodi\\")
    {
        Cracker::Rld
    } else if lower.contains("/empress/") || lower.contains("\\empress\\") {
        Cracker::Empress
    } else if lower.contains("/skidrow/") || lower.contains("\\skidrow\\") {
        Cracker::Skidrow
    } else if lower.contains("/creamapi/") || lower.contains("\\creamapi\\") {
        Cracker::CreamApi
    } else if lower.contains("/smartsteamemu/") || lower.contains("\\smartsteamemu\\") {
        Cracker::SmartSteamEmu
    } else if lower.contains("/rle/") || lower.contains("\\rle\\") {
        Cracker::Rle
    } else if lower.contains("/.1911/") || lower.contains("\\.1911\\") {
        Cracker::Razor1911
    } else if lower.contains("/3dmgame/") || lower.contains("\\3dmgame\\") {
        Cracker::ThreeDm
    } else if lower.contains("/flt/") || lower.contains("\\flt\\") {
        Cracker::Flt
    } else if lower.contains("librarycache") {
        Cracker::SteamCache
    } else {
        Cracker::Codex // Fallback
    }
}
