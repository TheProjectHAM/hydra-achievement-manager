use crate::models::{AchievementEntry, Timestamp, TimeFormat, UnlockMode, UnlockOptions};
use crate::parser::expand_path;
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

    /// Escreve arquivo de achievements
    pub fn write_achievement_file<P: AsRef<Path>>(
        file_path: P,
        achievements: &[AchievementEntry],
    ) -> Result<()> {
        let file_path = file_path.as_ref();
        
        // Cria diretório pai se não existir
        if let Some(parent) = file_path.parent() {
            fs::create_dir_all(parent)
                .with_context(|| format!("Failed to create directory: {}", parent.display()))?;
        }

        let mut content = String::new();

        for ach in achievements {
            content.push_str(&format!("[{}]\n", ach.name));
            content.push_str(&format!("Achieved={}\n", if ach.achieved { "1" } else { "0" }));
            content.push_str(&format!("UnlockTime={}\n", ach.unlock_time));
            content.push('\n');
        }

        fs::write(file_path, content)
            .with_context(|| format!("Failed to write file: {}", file_path.display()))?;

        log::info!("Achievement file written: {}", file_path.display());
        Ok(())
    }

    /// Escreve arquivo achievements.json do GSE preservando campos extras existentes.
    pub fn write_gse_achievement_file<P: AsRef<Path>>(
        file_path: P,
        achievements: &[AchievementEntry],
    ) -> Result<()> {
        let file_path = file_path.as_ref();

        if let Some(parent) = file_path.parent() {
            fs::create_dir_all(parent)
                .with_context(|| format!("Failed to create directory: {}", parent.display()))?;
        }

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
            .with_context(|| format!("Failed to write file: {}", file_path.display()))?;

        log::info!("GSE achievement file written: {}", file_path.display());
        Ok(())
    }

    /// Deleta arquivo antigo se existir
    pub fn delete_old_file<P: AsRef<Path>>(file_path: P) -> Result<()> {
        let file_path = file_path.as_ref();
        if file_path.exists() {
            fs::remove_file(file_path)
                .with_context(|| format!("Failed to delete file: {}", file_path.display()))?;
            log::info!("Old achievement file deleted: {}", file_path.display());
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

    /// Realiza o unlock de achievements
    pub fn unlock_achievements(options: &UnlockOptions) -> Result<()> {
        let achievement_entries = Self::process_achievements(options);

        let expanded_path = expand_path(&options.selected_path);
        let game_dir = expanded_path.join(&options.game_id);
        let ini_path = game_dir.join("achievements.ini");
        let json_path = game_dir.join("achievements.json");

        let is_gse_path = expanded_path
            .to_string_lossy()
            .to_lowercase()
            .contains("gse saves");

        if json_path.exists() || is_gse_path {
            AchievementWriter::write_gse_achievement_file(&json_path, &achievement_entries)?;
        } else {
            // Deleta arquivo antigo INI e escreve novo
            AchievementWriter::delete_old_file(&ini_path)?;
            AchievementWriter::write_achievement_file(&ini_path, &achievement_entries)?;
        }

        Ok(())
    }
}
