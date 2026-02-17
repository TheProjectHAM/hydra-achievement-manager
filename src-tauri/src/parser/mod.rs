use crate::models::{AchievementEntry, GameAchievements};
use anyhow::{Context, Result};
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};

pub struct AchievementParser;

impl AchievementParser {
    /// Parse um arquivo achievements.ini
    pub fn parse_achievement_file<P: AsRef<Path>>(file_path: P) -> Result<Vec<AchievementEntry>> {
        let file_path = file_path.as_ref();
        let content = fs::read_to_string(file_path)
            .with_context(|| {
                log::error!("Failed to read achievement file: {}", file_path.display());
                format!("Failed to read file: {}", file_path.display())
            })?;

        if file_path
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.eq_ignore_ascii_case("json"))
            .unwrap_or(false)
        {
            return Self::parse_gse_achievement_json(&content, file_path);
        }

        let mut achievements = Vec::new();
        let mut current_achievement: Option<AchievementEntry> = None;

        for line in content.lines() {
            let line = line.trim();

            // Nova seção de achievement
            if line.starts_with('[') && line.ends_with(']') {
                // Salva o achievement anterior se existir
                if let Some(ach) = current_achievement.take() {
                    achievements.push(ach);
                }

                // Cria novo achievement
                let name = line[1..line.len() - 1].to_string();
                current_achievement = Some(AchievementEntry {
                    name,
                    achieved: false,
                    unlock_time: 0,
                });
            } else if line.contains('=') {
                if let Some(ref mut ach) = current_achievement {
                    let parts: Vec<&str> = line.splitn(2, '=').collect();
                    if parts.len() == 2 {
                        let key = parts[0].trim();
                        let value = parts[1].trim();

                        match key {
                            "Achieved" => {
                                ach.achieved = value == "1";
                            }
                            "UnlockTime" => {
                                ach.unlock_time = value.parse().unwrap_or(0);
                            }
                            _ => {}
                        }
                    }
                }
            }
        }

        // Adiciona o último achievement
        if let Some(ach) = current_achievement {
            achievements.push(ach);
        }

        Ok(achievements)
    }

    fn parse_gse_achievement_json(file_content: &str, file_path: &Path) -> Result<Vec<AchievementEntry>> {
        let json: Value = serde_json::from_str(file_content)
            .with_context(|| format!("Failed to parse JSON: {}", file_path.display()))?;

        let object = json
            .as_object()
            .with_context(|| format!("Invalid GSE achievements JSON format: {}", file_path.display()))?;

        let mut achievements = Vec::new();

        for (name, payload) in object {
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

        Ok(achievements)
    }

    /// Parse um diretório de achievements
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
                    
                    // Verifica se é estrutura OnlineFix (ini em Stats) ou GSE (achievements.json)
                    let achievement_file = if directory_path
                        .file_name()
                        .and_then(|n| n.to_str())
                        == Some("OnlineFix")
                    {
                        let onlinefix_ini = entry.path().join("Stats").join("achievements.ini");
                        if onlinefix_ini.exists() { Some(onlinefix_ini) } else { None }
                    } else {
                        let ini_file = entry.path().join("achievements.ini");
                        let json_file = entry.path().join("achievements.json");
                        if ini_file.exists() {
                            Some(ini_file)
                        } else if json_file.exists() {
                            Some(json_file)
                        } else {
                            None
                        }
                    };

                    if let Some(achievement_file) = achievement_file {
                        log::info!("Processing game: {} (File: {})", game_id, achievement_file.display());
                        match Self::parse_achievement_file(&achievement_file) {
                            Ok(achievements) => {
                                if !achievements.is_empty() {
                                    log::info!("Found {} achievements for game {}", achievements.len(), game_id);
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

        log::info!("Scan finished for directory '{}'. Found {} valid entries.", directory_path.display(), games.len());
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
                    log::error!("Error parsing directory {}: {}", expanded_path.display(), e);
                }
            }
        }

        all_games
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
