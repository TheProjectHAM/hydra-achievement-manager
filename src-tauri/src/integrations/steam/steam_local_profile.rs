use super::steam_profile_types::{SteamConnectionProfile, SteamSubAccount};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

const STEAM_ID64_BASE: u64 = 76_561_197_960_265_728;

#[derive(Debug, Clone)]
struct LoginUser {
    steam_id64: String,
    account_name: Option<String>,
    persona_name: Option<String>,
    most_recent: bool,
}

pub fn get_steam_profile() -> Result<Option<SteamConnectionProfile>, String> {
    let Some(steam_path) = steam_install_path() else {
        return Ok(None);
    };

    let loginusers_path = steam_path.join("config").join("loginusers.vdf");
    if !loginusers_path.exists() {
        return Ok(None);
    }

    let loginusers = fs::read_to_string(&loginusers_path)
        .map_err(|e| format!("Failed to read Steam loginusers.vdf: {}", e))?;

    let all_users = parse_loginusers(&loginusers);
    if all_users.is_empty() {
        return Ok(None);
    };

    let primary_idx = all_users.iter().position(|u| u.most_recent).unwrap_or(0);

    let user = &all_users[primary_idx];
    let steam_id64 = user.steam_id64.clone();
    let account_id = steam_id64_to_account_id(&steam_id64)?;
    let localconfig_path = steam_path
        .join("userdata")
        .join(account_id.to_string())
        .join("config")
        .join("localconfig.vdf");

    let localconfig = fs::read_to_string(&localconfig_path).ok();
    let avatar_hash = localconfig
        .as_deref()
        .and_then(|text| find_vdf_value_near_account(text, &account_id.to_string(), "avatar"))
        .or_else(|| {
            localconfig
                .as_deref()
                .and_then(|text| find_vdf_value(text, "avatar"))
        });

    let persona_name = localconfig
        .as_deref()
        .and_then(|text| find_vdf_value_near_account(text, &account_id.to_string(), "name"))
        .or_else(|| {
            localconfig
                .as_deref()
                .and_then(|text| find_vdf_value(text, "PersonaName"))
        })
        .or(user.persona_name.clone())
        .unwrap_or_else(|| {
            user.account_name
                .clone()
                .unwrap_or_else(|| "Steam Profile".to_string())
        });

    let local_avatar_path = steam_path
        .join("config")
        .join("avatarcache")
        .join(format!("{}.png", steam_id64));

    let avatar_url = avatar_hash
        .as_ref()
        .map(|hash| format!("https://avatars.akamai.steamstatic.com/{}_full.jpg", hash));

    let sub_accounts: Vec<SteamSubAccount> = all_users
        .iter()
        .enumerate()
        .filter(|(i, _)| *i != primary_idx)
        .map(|(_, u)| {
            let acc_id = steam_id64_to_account_id(&u.steam_id64).unwrap_or(0);

            let sub_persona = u
                .persona_name
                .clone()
                .or_else(|| u.account_name.clone())
                .unwrap_or_else(|| "Steam Account".to_string());

            let sub_localconfig_path = steam_path
                .join("userdata")
                .join(acc_id.to_string())
                .join("config")
                .join("localconfig.vdf");
            let sub_localconfig = fs::read_to_string(&sub_localconfig_path).ok();
            let sub_avatar_hash = sub_localconfig
                .as_deref()
                .and_then(|text| find_vdf_value(text, "avatar"));
            let sub_avatar_url = sub_avatar_hash
                .map(|hash| format!("https://avatars.akamai.steamstatic.com/{}_full.jpg", hash));

            SteamSubAccount {
                steam_id64: u.steam_id64.clone(),
                account_id: acc_id,
                account_name: u.account_name.clone(),
                persona_name: sub_persona,
                profile_url: format!("https://steamcommunity.com/profiles/{}", u.steam_id64),
                avatar_url: sub_avatar_url,
            }
        })
        .collect();

    Ok(Some(SteamConnectionProfile {
        steam_id64: steam_id64.clone(),
        account_id,
        account_name: user.account_name.clone(),
        persona_name,
        steam3_id: format!("[U:1:{}]", account_id),
        steam2_id: account_id_to_steam2(account_id),
        profile_url: format!("https://steamcommunity.com/profiles/{}", steam_id64),
        avatar_hash,
        avatar_url,
        local_avatar_path: local_avatar_path
            .exists()
            .then(|| local_avatar_path.to_string_lossy().to_string()),
        sub_accounts,
    }))
}

fn steam_install_path() -> Option<PathBuf> {
    let home = dirs::home_dir();

    #[cfg(target_os = "linux")]
    {
        let mut candidates = Vec::new();
        if let Some(home) = &home {
            candidates.push(home.join(".local/share/Steam"));
            candidates.push(home.join(".steam/steam"));
        }

        return candidates.into_iter().find(|path| path.exists());
    }

    #[cfg(target_os = "windows")]
    {
        let mut candidates = vec![PathBuf::from(r"C:\Program Files (x86)\Steam")];
        if let Some(home) = &home {
            candidates.push(home.join(r"AppData\Local\Steam"));
        }

        return candidates.into_iter().find(|path| path.exists());
    }

    #[allow(unreachable_code)]
    None
}

fn parse_loginusers(text: &str) -> Vec<LoginUser> {
    let mut users = Vec::new();
    let lines: Vec<&str> = text.lines().collect();
    let mut index = 0usize;

    while index < lines.len() {
        let line = lines[index].trim();
        let Some(steam_id64) = vdf_standalone_key(line) else {
            index += 1;
            continue;
        };

        if steam_id64.len() != 17 || !steam_id64.chars().all(|c| c.is_ascii_digit()) {
            index += 1;
            continue;
        }

        let mut values = HashMap::new();
        let mut depth = 0i32;
        index += 1;

        while index < lines.len() {
            let current = lines[index].trim();

            if current == "{" {
                depth += 1;
                index += 1;
                continue;
            }

            if current == "}" {
                depth -= 1;
                index += 1;
                if depth <= 0 {
                    break;
                }
                continue;
            }

            if let Some((key, value)) = vdf_key_value(current) {
                values.insert(key, value);
            }

            index += 1;
        }

        users.push(LoginUser {
            steam_id64,
            account_name: values.get("AccountName").cloned(),
            persona_name: values.get("PersonaName").cloned(),
            most_recent: values.get("MostRecent").is_some_and(|value| value == "1"),
        });
    }

    users
}

fn find_vdf_value(text: &str, wanted_key: &str) -> Option<String> {
    text.lines()
        .filter_map(|line| vdf_key_value(line.trim()))
        .find_map(|(key, value)| (key == wanted_key).then_some(value))
}

fn find_vdf_value_near_account(text: &str, account_id: &str, wanted_key: &str) -> Option<String> {
    let account_index = text.find(&format!("\"{}\"", account_id))?;
    let end = text.len().min(account_index + 4096);
    let end = text.floor_char_boundary(end);
    let slice = &text[account_index..end];
    find_vdf_value(slice, wanted_key)
}

fn vdf_standalone_key(line: &str) -> Option<String> {
    if !line.starts_with('"') || !line.ends_with('"') {
        return None;
    }

    Some(line.trim_matches('"').to_string())
}

fn vdf_key_value(line: &str) -> Option<(String, String)> {
    let mut values = Vec::new();
    let mut current = String::new();
    let mut in_string = false;
    let mut escaped = false;

    for character in line.chars() {
        if in_string {
            if escaped {
                current.push(character);
                escaped = false;
            } else if character == '\\' {
                escaped = true;
            } else if character == '"' {
                values.push(current.clone());
                current.clear();
                in_string = false;
            } else {
                current.push(character);
            }
        } else if character == '"' {
            in_string = true;
        }
    }

    if values.len() >= 2 {
        Some((values[0].clone(), values[1].clone()))
    } else {
        None
    }
}

fn steam_id64_to_account_id(steam_id64: &str) -> Result<u64, String> {
    let steam_id64 = steam_id64
        .parse::<u64>()
        .map_err(|e| format!("Invalid SteamID64: {}", e))?;

    steam_id64
        .checked_sub(STEAM_ID64_BASE)
        .ok_or_else(|| "SteamID64 is below expected base value".to_string())
}

fn account_id_to_steam2(account_id: u64) -> String {
    let y = account_id % 2;
    let z = (account_id - y) / 2;
    format!("STEAM_0:{}:{}", y, z)
}
