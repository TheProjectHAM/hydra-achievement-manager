use crate::models::DirectoryConfig;
use std::fs;
use std::path::{Path, PathBuf};

pub fn build_default_directory_configs(wine_prefix_path: Option<&str>) -> Vec<DirectoryConfig> {
    fn resolve_gse_user(users_roots: &[PathBuf]) -> String {
        let mut found_steamuser = false;

        for root in users_roots {
            if !root.exists() {
                continue;
            }

            if let Ok(entries) = fs::read_dir(root) {
                for entry in entries.flatten() {
                    let is_dir = entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false);
                    if !is_dir {
                        continue;
                    }

                    let username = entry.file_name().to_string_lossy().to_string();
                    let gse_dir = entry.path().join("AppData").join("Roaming").join("GSE Saves");
                    if !gse_dir.exists() {
                        continue;
                    }

                    if username.eq_ignore_ascii_case("steamuser") {
                        found_steamuser = true;
                    } else {
                        return username;
                    }
                }
            }
        }

        if found_steamuser {
            "steamuser".to_string()
        } else {
            "steamuser".to_string()
        }
    }

    if cfg!(target_os = "windows") {
        let gse_user = resolve_gse_user(&[
            Path::new("C:/users").to_path_buf(),
            Path::new("C:/Users").to_path_buf(),
        ]);
        let default_paths = vec![
            "C:/Users/Public/Documents/Steam/RUNE".to_string(),
            "C:/Users/Public/Documents/Steam/CODEX".to_string(),
            "C:/ProgramData/Steam/RLD!".to_string(),
            "C:/Users/Public/Documents/OnlineFix".to_string(),
            format!("C:/users/{}/AppData/Roaming/GSE Saves", gse_user),
        ];

        default_paths
            .into_iter()
            .map(|p| DirectoryConfig {
                name: p.split('/').last().unwrap_or("Unknown").to_string(),
                path: p,
                enabled: true,
                is_default: true,
            })
            .collect()
    } else {
        let prefix_raw = wine_prefix_path
            .map(|p| p.trim())
            .filter(|p| !p.is_empty())
            .unwrap_or("~/.wine");

        let expanded_prefix = crate::parser::expand_path(prefix_raw);
        let wine_drive_c = if expanded_prefix.file_name().and_then(|n| n.to_str()) == Some("drive_c") {
            expanded_prefix
        } else {
            expanded_prefix.join("drive_c")
        };

        let gse_user = resolve_gse_user(&[wine_drive_c.join("users"), wine_drive_c.join("Users")]);
        let default_paths = vec![
            "C:/Users/Public/Documents/Steam/RUNE".to_string(),
            "C:/Users/Public/Documents/Steam/CODEX".to_string(),
            "C:/ProgramData/Steam/RLD!".to_string(),
            "C:/Users/Public/Documents/OnlineFix".to_string(),
            format!("C:/users/{}/AppData/Roaming/GSE Saves", gse_user),
        ];

        default_paths
            .into_iter()
            .map(|p| {
                let name = p.split('/').last().unwrap_or("Unknown").to_string();
                let path_suffix = if p.starts_with("C:/") { &p[3..] } else { &p };
                let full_path = wine_drive_c.join(path_suffix).to_string_lossy().to_string();

                DirectoryConfig {
                    name,
                    path: full_path,
                    enabled: true,
                    is_default: true,
                }
            })
            .collect()
    }
}
