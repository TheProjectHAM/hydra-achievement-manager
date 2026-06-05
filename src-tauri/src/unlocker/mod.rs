use crate::models::{AchievementEntry, Cracker, DirectoryDetectionPreset, Timestamp, TimeFormat, UnlockMode, UnlockOptions};
use crate::parser::{expand_path, detect_cracker_from_path, AchievementParser};
use anyhow::{Context, Result};
use chrono::{Datelike, NaiveDateTime, Timelike};
use rand::Rng;
use serde_json::{Map, Value};
use std::fs;
use std::path::Path;

pub struct AchievementWriter;

impl AchievementWriter {
    /// Converte Timestamp para Unix timestamp
    pub fn timestamp_to_unix(timestamp: &Timestamp) -> i64 {
        let day: u32 = timestamp.day.parse().unwrap_or(1);
        let month: u32 = timestamp.month.parse().unwrap_or(1);
        let year: i32 = timestamp.year.parse().unwrap_or(2024);
        let minute: u32 = timestamp.minute.parse().unwrap_or(0);

        let mut hour: u32 = timestamp.hour.parse().unwrap_or(0);

        // Converte 12h para 24h se necessário
        if let Some(ampm) = &timestamp.ampm {
            if ampm == "PM" && hour != 12 {
                hour += 12;
            } else if ampm == "AM" && hour == 12 {
                hour = 0;
            }
        }

        // Cria NaiveDateTime
        if let Some(dt) = NaiveDateTime::new(
            chrono::NaiveDate::from_ymd_opt(year, month, day).unwrap_or_default(),
            chrono::NaiveTime::from_hms_opt(hour, minute, 0).unwrap_or_default(),
        )
        .and_local_timezone(chrono::Local)
        .single()
        {
            dt.timestamp()
        } else {
            0
        }
    }

    // ── Writers por formato ─────────────────────────────────────────────

    /// Escreve arquivo INI no formato padrão (CODEX, RUNE, RLE, SmartSteamEmu).
    ///
    /// Formato:
    /// ```ini
    /// [AchievementName]
    /// Achieved=1
    /// UnlockTime=1234567890
    /// ```
    pub fn write_default_ini<P: AsRef<Path>>(
        file_path: P,
        achievements: &[AchievementEntry],
    ) -> Result<()> {
        let file_path = file_path.as_ref();
        Self::ensure_parent_dir(file_path)?;

        let mut content = String::new();
        for ach in achievements {
            content.push_str(&format!("[{}]\n", ach.name));
            content.push_str(&format!("Achieved={}\n", if ach.achieved { "1" } else { "0" }));
            content.push_str(&format!("UnlockTime={}\n", ach.unlock_time));
            content.push('\n');
        }

        fs::write(file_path, content)
            .with_context(|| format!("Failed to write INI file: {}", file_path.display()))?;
        log::info!("INI file written: {}", file_path.display());
        Ok(())
    }

    /// Escreve arquivo INI no formato OnlineFix.
    ///
    /// Formato:
    /// ```ini
    /// [AchievementName]
    /// achieved=true
    /// timestamp=1234567890
    /// ```
    pub fn write_online_fix_ini<P: AsRef<Path>>(
        file_path: P,
        achievements: &[AchievementEntry],
    ) -> Result<()> {
        let file_path = file_path.as_ref();
        Self::ensure_parent_dir(file_path)?;

        let mut content = String::new();
        for ach in achievements {
            content.push_str(&format!("[{}]\n", ach.name));
            content.push_str(&format!(
                "achieved={}\n",
                if ach.achieved { "true" } else { "false" }
            ));
            content.push_str(&format!("timestamp={}\n", ach.unlock_time));
            content.push('\n');
        }

        fs::write(file_path, content)
            .with_context(|| format!("Failed to write OnlineFix file: {}", file_path.display()))?;
        log::info!("OnlineFix file written: {}", file_path.display());
        Ok(())
    }

    /// Escreve arquivo JSON no formato Goldberg/EMPRESS.
    ///
    /// Formato:
    /// ```json
    /// {
    ///   "AchievementName": {
    ///     "earned": true,
    ///     "earned_time": 1234567890
    ///   }
    /// }
    /// ```
    ///
    /// Preserva campos extras existentes no arquivo.
    pub fn write_goldberg_json<P: AsRef<Path>>(
        file_path: P,
        achievements: &[AchievementEntry],
    ) -> Result<()> {
        let file_path = file_path.as_ref();
        Self::ensure_parent_dir(file_path)?;

        let mut root_obj: Map<String, Value> = if file_path.exists() {
            let content = fs::read_to_string(file_path)
                .with_context(|| format!("Failed to read file: {}", file_path.display()))?;
            serde_json::from_str(&content).unwrap_or_default()
        } else {
            Map::new()
        };

        for ach in achievements {
            let mut entry_obj = root_obj
                .get(&ach.name)
                .and_then(|v| v.as_object())
                .cloned()
                .unwrap_or_default();

            entry_obj.insert("earned".to_string(), Value::Bool(ach.achieved));
            entry_obj.insert(
                "earned_time".to_string(),
                Value::from(if ach.achieved { ach.unlock_time } else { 0 }),
            );

            root_obj.insert(ach.name.clone(), Value::Object(entry_obj));
        }

        let content = serde_json::to_string_pretty(&root_obj)
            .with_context(|| format!("Failed to serialize JSON: {}", file_path.display()))?;

        fs::write(file_path, content)
            .with_context(|| format!("Failed to write JSON file: {}", file_path.display()))?;
        log::info!("Goldberg JSON file written: {}", file_path.display());
        Ok(())
    }

    /// Escreve arquivo INI no formato RLD! (valores em hexadecimal uint32 LE).
    ///
    /// Formato:
    /// ```ini
    /// [AchievementName]
    /// State=01000000
    /// Time=60E3A458
    /// ```
    pub fn write_rld_ini<P: AsRef<Path>>(
        file_path: P,
        achievements: &[AchievementEntry],
    ) -> Result<()> {
        let file_path = file_path.as_ref();
        Self::ensure_parent_dir(file_path)?;

        let mut content = String::new();
        for ach in achievements {
            content.push_str(&format!("[{}]\n", ach.name));
            let state_hex = if ach.achieved {
                u32_to_hex_le(1)
            } else {
                u32_to_hex_le(0)
            };
            let time_hex = u32_to_hex_le(ach.unlock_time as u32);
            content.push_str(&format!("State={}\n", state_hex));
            content.push_str(&format!("Time={}\n", time_hex));
            content.push('\n');
        }

        fs::write(file_path, content)
            .with_context(|| format!("Failed to write RLD! file: {}", file_path.display()))?;
        log::info!("RLD! file written: {}", file_path.display());
        Ok(())
    }

    /// Escreve arquivo INI no formato SKIDROW.
    ///
    /// Formato (seção `[Achievements]`):
    /// ```ini
    /// [Achievements]
    /// AchievementName=1@1234567890@DisplayName
    /// ```
    pub fn write_skidrow_ini<P: AsRef<Path>>(
        file_path: P,
        achievements: &[AchievementEntry],
    ) -> Result<()> {
        let file_path = file_path.as_ref();
        Self::ensure_parent_dir(file_path)?;

        let mut content = String::from("[Achievements]\n");
        for ach in achievements {
            let flag = if ach.achieved { "1" } else { "0" };
            content.push_str(&format!("{}={}@{}@{}\n", ach.name, flag, ach.unlock_time, ach.name));
        }

        fs::write(file_path, content)
            .with_context(|| format!("Failed to write SKIDROW file: {}", file_path.display()))?;
        log::info!("SKIDROW file written: {}", file_path.display());
        Ok(())
    }

    /// Escreve arquivo INI no formato CreamAPI.
    ///
    /// Formato:
    /// ```ini
    /// [AchievementName]
    /// achieved=true
    /// unlocktime=1234567890
    /// ```
    pub fn write_cream_api_ini<P: AsRef<Path>>(
        file_path: P,
        achievements: &[AchievementEntry],
    ) -> Result<()> {
        let file_path = file_path.as_ref();
        Self::ensure_parent_dir(file_path)?;

        let mut content = String::new();
        for ach in achievements {
            content.push_str(&format!("[{}]\n", ach.name));
            content.push_str(&format!(
                "achieved={}\n",
                if ach.achieved { "true" } else { "false" }
            ));
            content.push_str(&format!("unlocktime={}\n", ach.unlock_time));
            content.push('\n');
        }

        fs::write(file_path, content)
            .with_context(|| format!("Failed to write CreamAPI file: {}", file_path.display()))?;
        log::info!("CreamAPI file written: {}", file_path.display());
        Ok(())
    }

    /// Escreve arquivo INI no formato user_stats.
    ///
    /// Formato (seção `[ACHIEVEMENTS]`):
    /// ```ini
    /// [ACHIEVEMENTS]
    /// "AchievementName" = "{unlocked = true, time = 1234567890}"
    /// ```
    pub fn write_user_stats_ini<P: AsRef<Path>>(
        file_path: P,
        achievements: &[AchievementEntry],
    ) -> Result<()> {
        let file_path = file_path.as_ref();
        Self::ensure_parent_dir(file_path)?;

        let mut content = String::from("[ACHIEVEMENTS]\n");
        for ach in achievements {
            let unlocked = if ach.achieved { "true" } else { "false" };
            content.push_str(&format!(
                "\"{}\" = \"{{unlocked = {}, time = {}}}\"\n",
                ach.name, unlocked, ach.unlock_time
            ));
        }

        fs::write(file_path, content)
            .with_context(|| format!("Failed to write user_stats file: {}", file_path.display()))?;
        log::info!("user_stats file written: {}", file_path.display());
        Ok(())
    }

    /// Escreve arquivo INI no formato 3DM.
    ///
    /// Formato (seções `[State]` e `[Time]`, valores em hex):
    /// ```ini
    /// [State]
    /// AchievementName=0101
    /// [Time]
    /// AchievementName=60E3A458
    /// ```
    pub fn write_3dm_ini<P: AsRef<Path>>(
        file_path: P,
        achievements: &[AchievementEntry],
    ) -> Result<()> {
        let file_path = file_path.as_ref();
        Self::ensure_parent_dir(file_path)?;

        let mut content = String::new();

        // Seção State
        content.push_str("[State]\n");
        for ach in achievements {
            let state = if ach.achieved { "0101" } else { "0000" };
            content.push_str(&format!("{}={}\n", ach.name, state));
        }

        // Seção Time
        content.push_str("\n[Time]\n");
        for ach in achievements {
            let time_hex = u32_to_hex_le(ach.unlock_time as u32);
            content.push_str(&format!("{}={}\n", ach.name, time_hex));
        }

        fs::write(file_path, content)
            .with_context(|| format!("Failed to write 3DM file: {}", file_path.display()))?;
        log::info!("3DM file written: {}", file_path.display());
        Ok(())
    }

    /// Escreve arquivo de texto plano no formato Razor1911.
    ///
    /// Formato: `<nome> <0|1> <unlockTime>` por linha.
    pub fn write_razor1911<P: AsRef<Path>>(
        file_path: P,
        achievements: &[AchievementEntry],
    ) -> Result<()> {
        let file_path = file_path.as_ref();
        Self::ensure_parent_dir(file_path)?;

        let mut content = String::new();
        for ach in achievements {
            let flag = if ach.achieved { "1" } else { "0" };
            content.push_str(&format!("{} {} {}\n", ach.name, flag, ach.unlock_time));
        }

        fs::write(file_path, content)
            .with_context(|| format!("Failed to write Razor1911 file: {}", file_path.display()))?;
        log::info!("Razor1911 file written: {}", file_path.display());
        Ok(())
    }

    /// Escreve conquistas FLT (baseado em diretório - cada arquivo = uma conquista).
    pub fn write_flt_directory<P: AsRef<Path>>(
        directory_path: P,
        achievements: &[AchievementEntry],
    ) -> Result<()> {
        let directory_path = directory_path.as_ref();
        fs::create_dir_all(directory_path)
            .with_context(|| format!("Failed to create FLT directory: {}", directory_path.display()))?;

        // Remove arquivos de conquistas que não estão mais desbloqueadas
        if let Ok(entries) = fs::read_dir(directory_path) {
            for entry in entries.flatten() {
                if entry.file_type().map(|ft| ft.is_file()).unwrap_or(false) {
                    let name = entry.file_name().to_string_lossy().to_string();
                    if !achievements.iter().any(|a| a.name == name && a.achieved) {
                        let _ = fs::remove_file(entry.path());
                    }
                }
            }
        }

        // Cria arquivos para conquistas desbloqueadas
        for ach in achievements {
            if ach.achieved {
                let file_path = directory_path.join(&ach.name);
                if !file_path.exists() {
                    fs::write(&file_path, "")
                        .with_context(|| format!("Failed to write FLT file: {}", file_path.display()))?;
                }
            }
        }

        log::info!("FLT directory written: {}", directory_path.display());
        Ok(())
    }

    // ── Writer genérico ─────────────────────────────────────────────────

    /// Escreve conquistas no formato apropriado baseado no path do arquivo.
    ///
    /// Detecta automaticamente o cracker pelo path e usa o writer correto.
    pub fn write_achievements<P: AsRef<Path>>(
        file_path: P,
        achievements: &[AchievementEntry],
        cracker: Cracker,
    ) -> Result<()> {
        match cracker {
            Cracker::Codex | Cracker::Rune | Cracker::Rle | Cracker::SmartSteamEmu => {
                Self::write_default_ini(file_path, achievements)
            }
            Cracker::OnlineFix => Self::write_online_fix_ini(file_path, achievements),
            Cracker::Goldberg | Cracker::Empress => {
                Self::write_goldberg_json(file_path, achievements)
            }
            Cracker::Rld => Self::write_rld_ini(file_path, achievements),
            Cracker::Skidrow => Self::write_skidrow_ini(file_path, achievements),
            Cracker::CreamApi => Self::write_cream_api_ini(file_path, achievements),
            Cracker::UserStats => Self::write_user_stats_ini(file_path, achievements),
            Cracker::ThreeDm => Self::write_3dm_ini(file_path, achievements),
            Cracker::Razor1911 => Self::write_razor1911(file_path, achievements),
            Cracker::Flt => Self::write_flt_directory(file_path, achievements),
            Cracker::SteamCache => {
                // Steam cache é read-only (gerenciado pelo cliente Steam)
                log::warn!("Cannot write to Steam cache (read-only)");
                Ok(())
            }
        }
    }

    // ── Utilitários ─────────────────────────────────────────────────────

    fn ensure_parent_dir<P: AsRef<Path>>(file_path: P) -> Result<()> {
        let file_path = file_path.as_ref();
        if let Some(parent) = file_path.parent() {
            fs::create_dir_all(parent)
                .with_context(|| format!("Failed to create directory: {}", parent.display()))?;
        }
        Ok(())
    }
}

pub struct AchievementUnlocker;

impl AchievementUnlocker {
    /// Processa achievements para unlock
    pub fn process_achievements(options: &UnlockOptions) -> Vec<AchievementEntry> {
        options
            .achievements
            .iter()
            .filter(|ach| ach.completed)
            .map(|ach| {
                let unlock_time = if !ach.timestamp.day.is_empty()
                    && !ach.timestamp.month.is_empty()
                    && !ach.timestamp.year.is_empty()
                    && !ach.timestamp.hour.is_empty()
                    && !ach.timestamp.minute.is_empty()
                {
                    AchievementWriter::timestamp_to_unix(&ach.timestamp)
                } else {
                    Self::get_global_timestamp(
                        &options.mode,
                        options.custom_timestamp.as_ref(),
                        &options.time_format,
                    )
                };

                AchievementEntry {
                    name: ach.name.clone(),
                    achieved: true,
                    unlock_time,
                }
            })
            .collect()
    }

    /// Obtém timestamp baseado no modo global
    fn get_global_timestamp(
        mode: &UnlockMode,
        custom_timestamp: Option<&Timestamp>,
        time_format: &TimeFormat,
    ) -> i64 {
        let timestamp = match mode {
            UnlockMode::Current => {
                let now = chrono::Local::now();
                Timestamp {
                    day: format!("{:02}", now.day()),
                    month: format!("{:02}", now.month()),
                    year: now.year().to_string(),
                    minute: format!("{:02}", now.minute()),
                    hour: match time_format {
                        TimeFormat::TwelveHour => {
                            let hour12 = now.hour() % 12;
                            let hour12 = if hour12 == 0 { 12 } else { hour12 };
                            format!("{:02}", hour12)
                        }
                        TimeFormat::TwentyFourHour => format!("{:02}", now.hour()),
                    },
                    ampm: match time_format {
                        TimeFormat::TwelveHour => {
                            Some(if now.hour() >= 12 { "PM" } else { "AM" }.to_string())
                        }
                        TimeFormat::TwentyFourHour => None,
                    },
                }
            }
            UnlockMode::Random => {
                let mut rng = rand::thread_rng();
                let now = chrono::Local::now();
                let past = now - chrono::Duration::days(365);
                let random_secs = rng.gen_range(past.timestamp()..now.timestamp());
                let random_date = chrono::DateTime::from_timestamp(random_secs, 0)
                    .unwrap_or_default()
                    .with_timezone(&chrono::Local);

                Timestamp {
                    day: format!("{:02}", random_date.day()),
                    month: format!("{:02}", random_date.month()),
                    year: random_date.year().to_string(),
                    minute: format!("{:02}", random_date.minute()),
                    hour: match time_format {
                        TimeFormat::TwelveHour => {
                            let hour12 = random_date.hour() % 12;
                            let hour12 = if hour12 == 0 { 12 } else { hour12 };
                            format!("{:02}", hour12)
                        }
                        TimeFormat::TwentyFourHour => format!("{:02}", random_date.hour()),
                    },
                    ampm: match time_format {
                        TimeFormat::TwelveHour => Some(
                            if random_date.hour() >= 12 {
                                "PM"
                            } else {
                                "AM"
                            }
                            .to_string(),
                        ),
                        TimeFormat::TwentyFourHour => None,
                    },
                }
            }
            UnlockMode::Custom => custom_timestamp.cloned().unwrap_or(Timestamp {
                day: String::new(),
                month: String::new(),
                year: String::new(),
                hour: String::new(),
                minute: String::new(),
                ampm: None,
            }),
        };

        AchievementWriter::timestamp_to_unix(&timestamp)
    }

    /// Realiza o unlock de achievements, detectando automaticamente o formato.
    pub fn unlock_achievements(options: &UnlockOptions) -> Result<()> {
        Self::unlock_achievements_with_preset(options, DirectoryDetectionPreset::Auto)
    }

    pub fn unlock_achievements_with_preset(
        options: &UnlockOptions,
        preset: DirectoryDetectionPreset,
    ) -> Result<()> {
        let achievement_entries = Self::process_achievements(options);

        let expanded_path = expand_path(&options.selected_path);
        let game_dir = expanded_path.join(&options.game_id);

        // Detecta qual arquivo existe e qual cracker usar
        let (file_path, cracker) = Self::detect_achievement_file(
            &game_dir,
            &expanded_path,
            &options.game_id,
            preset,
        );

        // Escreve no formato correto
        AchievementWriter::write_achievements(&file_path, &achievement_entries, cracker)?;

        log::info!(
            "Achievements unlocked for game {} at {} (format: {:?})",
            options.game_id,
            file_path.display(),
            cracker
        );

        Ok(())
    }

    /// Detecta o arquivo de conquista existente no diretório do jogo.
    ///
    /// Tenta encontrar o arquivo existente e determinar o cracker.
    /// Se não encontrar, assume Goldberg JSON como padrão.
    fn detect_achievement_file(
        game_dir: &Path,
        base_path: &Path,
        game_id: &str,
        preset: DirectoryDetectionPreset,
    ) -> (std::path::PathBuf, Cracker) {
        if preset != DirectoryDetectionPreset::Auto {
            return AchievementParser::preset_achievement_file(game_dir, game_id, preset);
        }

        // Tenta encontrar arquivo existente
        let candidates = [
            ("achievements.ini", Cracker::Codex),
            ("Achievements.ini", Cracker::Codex),
            ("achievements.json", Cracker::Goldberg),
            ("stats/Achievements.ini", Cracker::OnlineFix),
            ("Achievements.ini", Cracker::OnlineFix),
            ("SteamEmu/UserStats/achiev.ini", Cracker::Skidrow),
            ("stats/CreamAPI.Achievements.cfg", Cracker::CreamApi),
            ("User/Achievements.ini", Cracker::SmartSteamEmu),
            ("achievement", Cracker::Razor1911),
        ];

        for (filename, cracker) in &candidates {
            let path = game_dir.join(filename);
            if path.exists() {
                return (path, *cracker);
            }
        }

        // Tenta detectar pelo path base
        let base_str = base_path.to_string_lossy().to_lowercase();
        let detected_cracker = detect_cracker_from_path(&base_str);

        // Define o nome do arquivo baseado no cracker
        let filename = match detected_cracker {
            Cracker::Goldberg | Cracker::Empress => "achievements.json",
            Cracker::Skidrow => "SteamEmu/UserStats/achiev.ini",
            Cracker::CreamApi => "stats/CreamAPI.Achievements.cfg",
            Cracker::SmartSteamEmu => "User/Achievements.ini",
            Cracker::Razor1911 => "achievement",
            _ => "achievements.ini",
        };

        (game_dir.join(filename), detected_cracker)
    }
}

/// Converte u32 para string hexadecimal little-endian (8 chars).
fn u32_to_hex_le(value: u32) -> String {
    let swapped = value.swap_bytes();
    format!("{:08X}", swapped)
}
