use super::steam_types::SteamGame;
use anyhow::Result;
use std::path::PathBuf;

pub fn detect_installed_games() -> Result<Vec<PathBuf>> {
    let mut game_paths = Vec::new();

    for steam_dir in get_library_folders()? {
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

pub fn get_owned_games() -> Result<Vec<SteamGame>> {
    let mut games = Vec::new();

    for folder in get_library_folders()? {
        let steamapps = folder.join("steamapps");
        if !steamapps.exists() {
            continue;
        }

        if let Ok(entries) = std::fs::read_dir(steamapps) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("acf") {
                    if let Ok(content) = std::fs::read_to_string(&path) {
                        if let (Some(appid), Some(name)) = (
                            parse_acf_value(&content, "appid"),
                            parse_acf_value(&content, "name"),
                        ) {
                            if games.iter().any(|g: &SteamGame| g.game_id == appid) {
                                continue;
                            }

                            let installdir =
                                parse_acf_value(&content, "installdir").unwrap_or_default();
                            let install_path = if installdir.is_empty() {
                                folder.join("steamapps").join("common")
                            } else {
                                folder.join("steamapps").join("common").join(installdir)
                            };

                            games.push(SteamGame {
                                game_id: appid,
                                name,
                                achievements_total: 0,
                                achievements_current: 0,
                                source: "steam".to_string(),
                                library_path: folder.to_string_lossy().to_string(),
                                install_path: install_path.to_string_lossy().to_string(),
                                installed: Some(true),
                                playtime_forever: None,
                                playtime_2weeks: None,
                                rtime_last_played: None,
                                img_icon_url: None,
                            });
                        }
                    }
                }
            }
        }
    }

    log::info!("Found {} Steam games via .acf files", games.len());
    Ok(games)
}

pub fn get_library_folders() -> Result<Vec<PathBuf>> {
    let mut folders = Vec::new();

    #[cfg(target_os = "linux")]
    {
        let possible_roots = vec![
            dirs::home_dir().map(|h| h.join(".steam/steam")),
            dirs::home_dir().map(|h| h.join(".local/share/Steam")),
            dirs::home_dir().map(|h| h.join(".var/app/com.valvesoftware.Steam/.steam/steam")),
        ];

        for root_opt in possible_roots {
            if let Some(root) = root_opt {
                if root.exists() {
                    push_unique(&mut folders, root.clone());
                    read_library_vdf(
                        &mut folders,
                        root.join("steamapps").join("libraryfolders.vdf"),
                    );
                }
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        let possible_roots = vec![
            PathBuf::from("C:\\Program Files (x86)\\Steam"),
            PathBuf::from("C:\\Program Files\\Steam"),
        ];

        for root in possible_roots {
            if root.exists() {
                push_unique(&mut folders, root.clone());
                read_library_vdf(
                    &mut folders,
                    root.join("steamapps").join("libraryfolders.vdf"),
                );
            }
        }
    }

    Ok(folders)
}

fn read_library_vdf(folders: &mut Vec<PathBuf>, library_vdf: PathBuf) {
    if !library_vdf.exists() {
        return;
    }

    if let Ok(content) = std::fs::read_to_string(&library_vdf) {
        for line in content.lines() {
            if line.contains("\"path\"") {
                if let Some(path_str) = line.split('"').nth(3) {
                    #[cfg(target_os = "windows")]
                    let path = PathBuf::from(path_str.replace("\\\\", "\\"));
                    #[cfg(not(target_os = "windows"))]
                    let path = PathBuf::from(path_str);

                    if path.exists() {
                        push_unique(folders, path);
                    }
                }
            }
        }
    }
}

fn push_unique(paths: &mut Vec<PathBuf>, path: PathBuf) {
    if !paths.contains(&path) {
        paths.push(path);
    }
}

fn parse_acf_value(content: &str, key: &str) -> Option<String> {
    let key_with_quotes = format!("\"{}\"", key);
    for line in content.lines() {
        let line = line.trim();
        if line
            .to_lowercase()
            .contains(&key_with_quotes.to_lowercase())
        {
            let parts: Vec<&str> = line.split('"').collect();
            if parts.len() >= 4 {
                return Some(parts[3].to_string());
            }
        }
    }
    None
}
