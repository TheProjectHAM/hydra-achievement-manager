use crate::models::{DirectoryConfig, DirectoryDetectionPreset};
use crate::wine::Wine;
use std::path::{Path, PathBuf};

/// Constrói as configurações de diretórios padrão baseado na documentação oficial do Hydra.
///
/// No Windows, usa as variáveis de sistema reais (%APPDATA%, %DOCUMENTS%, etc.).
/// No Linux, usa o Wine prefix para resolver os caminhos equivalentes.
pub fn build_default_directory_configs(wine_prefix_path: Option<&str>) -> Vec<DirectoryConfig> {
    if cfg!(target_os = "windows") {
        build_windows_directories()
    } else {
        build_linux_directories(wine_prefix_path)
    }
}

/// Constrói os diretórios padrão para Windows.
///
/// Usa as variáveis de sistema reais:
/// - `%APPDATA%` → `C:\Users\<user>\AppData\Roaming`
/// - `%DOCUMENTS%` → `C:\Users\<user>\Documents`
/// - `%LOCALAPPDATA%` → `C:\Users\<user>\AppData\Local`
/// - `C:\Users\Public\Documents`
/// - `C:\ProgramData`
fn build_windows_directories() -> Vec<DirectoryConfig> {
    // Resolve variáveis de sistema no Windows
    let app_data = std::env::var("APPDATA")
        .unwrap_or_else(|_| format!("C:/Users/{}/AppData/Roaming", get_windows_username()));
    let documents = dirs::document_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| format!("C:/Users/{}/Documents", get_windows_username()));
    let local_app_data = std::env::var("LOCALAPPDATA")
        .unwrap_or_else(|_| format!("C:/Users/{}/AppData/Local", get_windows_username()));
    let public_documents = "C:/Users/Public/Documents".to_string();
    let program_data = "C:/ProgramData".to_string();

    let mut configs = Vec::new();

    // CODEX: <publicDocuments>/Steam/CODEX, <appData>/Steam/CODEX
    configs.push(make_config(
        &format!("{}/Steam/CODEX", public_documents),
        "CODEX (Public)",
        true,
    ));
    configs.push(make_config(
        &format!("{}/Steam/CODEX", app_data),
        "CODEX (AppData)",
        true,
    ));

    // RUNE: <publicDocuments>/Steam/RUNE
    configs.push(make_config(
        &format!("{}/Steam/RUNE", public_documents),
        "RUNE",
        true,
    ));

    // OnlineFix: <publicDocuments>/OnlineFix
    configs.push(make_config(
        &format!("{}/OnlineFix", public_documents),
        "OnlineFix",
        true,
    ));

    // Goldberg: <appData>/Goldberg SteamEmu Saves, <appData>/GSE Saves
    configs.push(make_config(
        &format!("{}/Goldberg SteamEmu Saves", app_data),
        "Goldberg",
        true,
    ));
    configs.push(make_config(
        &format!("{}/GSE Saves", app_data),
        "Goldberg (GSE)",
        true,
    ));

    // EMPRESS: <appData>/EMPRESS/remote
    configs.push(make_config(
        &format!("{}/EMPRESS/remote", app_data),
        "EMPRESS",
        true,
    ));

    // RLD!: <programData>/RLD!, <programData>/Steam/Player, <programData>/Steam/RLD!, <programData>/Steam/dodi
    configs.push(make_config(&format!("{}/RLD!", program_data), "RLD!", true));
    configs.push(make_config(
        &format!("{}/Steam/Player", program_data),
        "RLD! (Player)",
        true,
    ));
    configs.push(make_config(
        &format!("{}/Steam/RLD!", program_data),
        "RLD! (Steam)",
        true,
    ));
    configs.push(make_config(
        &format!("{}/Steam/dodi", program_data),
        "RLD! (dodi)",
        true,
    ));

    // SKIDROW: <documents>/SKIDROW, <documents>/Player, <localAppData>/SKIDROW
    configs.push(make_config(
        &format!("{}/SKIDROW", documents),
        "SKIDROW (Documents)",
        true,
    ));
    configs.push(make_config(
        &format!("{}/Player", documents),
        "SKIDROW (Player)",
        true,
    ));
    configs.push(make_config(
        &format!("{}/SKIDROW", local_app_data),
        "SKIDROW (Local)",
        true,
    ));

    // CreamAPI: <appData>/CreamAPI
    configs.push(make_config(
        &format!("{}/CreamAPI", app_data),
        "CreamAPI",
        true,
    ));

    // SmartSteamEmu: <appData>/SmartSteamEmu
    configs.push(make_config(
        &format!("{}/SmartSteamEmu", app_data),
        "SmartSteamEmu",
        true,
    ));

    // RLE: <appData>/RLE
    configs.push(make_config(&format!("{}/RLE", app_data), "RLE", true));

    // Razor1911: <appData>/.1911
    configs.push(make_config(
        &format!("{}/.1911", app_data),
        "Razor1911",
        true,
    ));

    // EMPRESS (Public): <publicDocuments>/EMPRESS
    configs.push(make_config(
        &format!("{}/EMPRESS", public_documents),
        "EMPRESS (Public)",
        true,
    ));

    configs
}

/// Constrói os diretórios padrão para Linux (Wine).
///
/// Todos os paths são resolvidos dentro do Wine prefix:
/// - `appData` → `<prefix>/drive_c/users/<user>/AppData/Roaming`
/// - `documents` → `<prefix>/drive_c/users/<user>/Documents`
/// - `publicDocuments` → `<prefix>/drive_c/users/Public/Documents`
/// - `localAppData` → `<prefix>/drive_c/users/<user>/AppData/Local`
/// - `programData` → `<prefix>/drive_c/ProgramData`
///
/// Usa o prefix global (legado ou configurado). Prefixes per-game são
/// resolvidos dinamicamente via `find_achievement_files_for_game`.
fn build_linux_directories(wine_prefix_path: Option<&str>) -> Vec<DirectoryConfig> {
    let mut configs = Vec::new();

    // 1. Prefix global (legado ou configurado pelo usuário)
    let prefix_raw = wine_prefix_path
        .map(|p| p.trim())
        .filter(|p| !p.is_empty())
        .unwrap_or("~/.config/hydralauncher/wine-prefix");

    let expanded_prefix = crate::parser::expand_path(prefix_raw);
    configs.extend(build_wine_prefix_dirs(&expanded_prefix, "Wine"));

    // 2. Per-game prefixes: ~/.config/hydralauncher/wine-prefixes/<objectId>/
    let per_game_base = crate::parser::expand_path("~/.config/hydralauncher/wine-prefixes");
    if per_game_base.exists() {
        if let Ok(entries) = std::fs::read_dir(&per_game_base) {
            for entry in entries.flatten() {
                if !entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false) {
                    continue;
                }
                let object_id = entry.file_name().to_string_lossy().to_string();
                let game_prefix = entry.path();
                let label = format!("Wine ({})", object_id);
                configs.extend(build_wine_prefix_dirs(&game_prefix, &label));
            }
        }
    }

    configs
}

/// Constrói os diretórios de cracker dentro de um Wine prefix específico.
fn build_wine_prefix_dirs(prefix: &Path, label: &str) -> Vec<DirectoryConfig> {
    // Verifica se já termina em drive_c
    let wine_drive_c = if prefix.file_name().and_then(|n| n.to_str()) == Some("drive_c") {
        prefix.to_path_buf()
    } else {
        prefix.join("drive_c")
    };

    // Resolve o nome do usuário dentro do Wine prefix
    let wine_user = Wine::resolve_wine_user(prefix);

    // Caminhos base dentro do Wine prefix
    let app_data = wine_drive_c
        .join("users")
        .join(&wine_user)
        .join("AppData")
        .join("Roaming");
    let documents = wine_drive_c
        .join("users")
        .join(&wine_user)
        .join("Documents");
    let local_app_data = wine_drive_c
        .join("users")
        .join(&wine_user)
        .join("AppData")
        .join("Local");
    let public_documents = wine_drive_c.join("users").join("Public").join("Documents");
    let program_data = wine_drive_c.join("ProgramData");

    let mut configs = Vec::new();

    // CODEX
    configs.push(make_config(
        &format!("{}/Steam/CODEX", public_documents.display()),
        &format!("{} / CODEX (Public)", label),
        true,
    ));
    configs.push(make_config(
        &format!("{}/Steam/CODEX", app_data.display()),
        &format!("{} / CODEX", label),
        true,
    ));

    // RUNE
    configs.push(make_config(
        &format!("{}/Steam/RUNE", public_documents.display()),
        &format!("{} / RUNE", label),
        true,
    ));

    // OnlineFix
    configs.push(make_config(
        &format!("{}/OnlineFix", public_documents.display()),
        &format!("{} / OnlineFix", label),
        true,
    ));

    // Goldberg
    configs.push(make_config(
        &format!("{}/Goldberg SteamEmu Saves", app_data.display()),
        &format!("{} / Goldberg", label),
        true,
    ));
    configs.push(make_config(
        &format!("{}/GSE Saves", app_data.display()),
        &format!("{} / Goldberg (GSE)", label),
        true,
    ));

    // EMPRESS
    configs.push(make_config(
        &format!("{}/EMPRESS/remote", app_data.display()),
        &format!("{} / EMPRESS", label),
        true,
    ));

    // RLD!
    configs.push(make_config(
        &format!("{}/RLD!", program_data.display()),
        &format!("{} / RLD!", label),
        true,
    ));
    configs.push(make_config(
        &format!("{}/Steam/Player", program_data.display()),
        &format!("{} / RLD! (Player)", label),
        true,
    ));
    configs.push(make_config(
        &format!("{}/Steam/RLD!", program_data.display()),
        &format!("{} / RLD! (Steam)", label),
        true,
    ));
    configs.push(make_config(
        &format!("{}/Steam/dodi", program_data.display()),
        &format!("{} / RLD! (dodi)", label),
        true,
    ));

    // SKIDROW
    configs.push(make_config(
        &format!("{}/SKIDROW", documents.display()),
        &format!("{} / SKIDROW", label),
        true,
    ));
    configs.push(make_config(
        &format!("{}/Player", documents.display()),
        &format!("{} / SKIDROW (Player)", label),
        true,
    ));
    configs.push(make_config(
        &format!("{}/SKIDROW", local_app_data.display()),
        &format!("{} / SKIDROW (Local)", label),
        true,
    ));

    // CreamAPI
    configs.push(make_config(
        &format!("{}/CreamAPI", app_data.display()),
        &format!("{} / CreamAPI", label),
        true,
    ));

    // SmartSteamEmu
    configs.push(make_config(
        &format!("{}/SmartSteamEmu", app_data.display()),
        &format!("{} / SmartSteamEmu", label),
        true,
    ));

    // RLE
    configs.push(make_config(
        &format!("{}/RLE", app_data.display()),
        &format!("{} / RLE", label),
        true,
    ));

    // Razor1911
    configs.push(make_config(
        &format!("{}/.1911", app_data.display()),
        &format!("{} / Razor1911", label),
        true,
    ));

    // EMPRESS (Public)
    configs.push(make_config(
        &format!("{}/EMPRESS", public_documents.display()),
        &format!("{} / EMPRESS (Public)", label),
        true,
    ));

    configs
}

/// Constrói um DirectoryConfig
fn make_config(path: &str, name: &str, is_default: bool) -> DirectoryConfig {
    DirectoryConfig {
        path: path.to_string(),
        name: name.to_string(),
        enabled: true,
        is_default,
        detection_preset: DirectoryDetectionPreset::Auto,
    }
}

/// Obtém o nome do usuário Windows atual
fn get_windows_username() -> String {
    std::env::var("USERNAME")
        .or_else(|_| std::env::var("USER"))
        .unwrap_or_else(|_| "steamuser".to_string())
}

/// Resolve todos os paths de conquistas para um jogo específico.
///
/// Retorna uma lista de (cracker, path_completo) para todos os arquivos
/// de conquista que existem no disco.
pub fn find_achievement_files_for_game(
    object_id: &str,
    wine_prefix_path: Option<&str>,
    _executable_path: Option<&str>,
    steam_user_data_path: Option<&Path>,
    user_data_path: &Path,
) -> Vec<(crate::models::Cracker, PathBuf)> {
    let mut found = Vec::new();

    // Resolve o prefixo Wine efetivo
    let effective_prefix = if cfg!(target_os = "windows") {
        None
    } else {
        Wine::get_effective_prefix_path(wine_prefix_path, Some(object_id), user_data_path)
    };

    // IDs alternativos para o jogo
    let alt_ids = crate::parser::get_alternative_object_ids(object_id);

    for &cracker in crate::models::Cracker::all() {
        let cracker_paths = get_cracker_paths(cracker);

        for (base_var, file_pattern) in cracker_paths {
            for oid in &alt_ids {
                let base_path = resolve_base_path(&base_var, effective_prefix.as_deref());

                let full_path = if file_pattern.contains("<objectId>") {
                    base_path.join(file_pattern.replace("<objectId>", oid))
                } else {
                    base_path.join(&file_pattern)
                };

                if full_path.exists() {
                    found.push((cracker, full_path));
                }
            }
        }
    }

    // Busca no Steam userdata (cache)
    if let Some(steam_path) = steam_user_data_path {
        let cache_path = steam_path
            .join("config")
            .join("librarycache")
            .join(format!("{}.json", object_id));
        if cache_path.exists() {
            found.push((crate::models::Cracker::SteamCache, cache_path));
        }
    }

    found
}

/// Variável de base para paths
enum BasePathVar {
    AppData,
    Documents,
    PublicDocuments,
    LocalAppData,
    ProgramData,
}

/// Retorna os paths de cada cracker como (variável_base, padrão_de_arquivo).
///
/// Conforme documentação oficial do Hydra:
/// - CODEX: `<publicDocuments>/Steam/CODEX/<objectId>/achievements.ini`, `<appData>/Steam/CODEX/<objectId>/achievements.ini`
/// - RUNE: `<publicDocuments>/Steam/RUNE/<objectId>/achievements.ini`
/// - OnlineFix: `<publicDocuments>/OnlineFix/<objectId>/Stats/Achievements.ini`, `<publicDocuments>/OnlineFix/<objectId>/Achievements.ini`
/// - Goldberg: `<appData>/Goldberg SteamEmu Saves/<objectId>/achievements.json`, `<appData>/GSE Saves/<objectId>/achievements.json`
/// - RLD!: `<programData>/RLD!/<objectId>/achievements.ini`, etc.
/// - EMPRESS: `<appData>/EMPRESS/remote/<objectId>/achievements.json`, `<publicDocuments>/EMPRESS/<objectId>/remote/<objectId>/achievements.json`
/// - SKIDROW: `<documents>/SKIDROW/<objectId>/SteamEmu/UserStats/achiev.ini`, etc.
/// - CreamAPI: `<appData>/CreamAPI/<objectId>/stats/CreamAPI.Achievements.cfg`
/// - SmartSteamEmu: `<appData>/SmartSteamEmu/<objectId>/User/Achievements.ini`
/// - RLE: `<appData>/RLE/<objectId>/achievements.ini`
/// - Razor1911: `<appData>/.1911/<objectId>/achievement`
fn get_cracker_paths(cracker: crate::models::Cracker) -> Vec<(BasePathVar, String)> {
    use crate::models::Cracker;

    match cracker {
        Cracker::Codex => vec![
            (
                BasePathVar::PublicDocuments,
                "Steam/CODEX/<objectId>/achievements.ini".into(),
            ),
            (
                BasePathVar::AppData,
                "Steam/CODEX/<objectId>/achievements.ini".into(),
            ),
        ],
        Cracker::Rune => vec![(
            BasePathVar::PublicDocuments,
            "Steam/RUNE/<objectId>/achievements.ini".into(),
        )],
        Cracker::OnlineFix => vec![
            (
                BasePathVar::PublicDocuments,
                "OnlineFix/<objectId>/Stats/Achievements.ini".into(),
            ),
            (
                BasePathVar::PublicDocuments,
                "OnlineFix/<objectId>/Achievements.ini".into(),
            ),
        ],
        Cracker::Goldberg => vec![
            (
                BasePathVar::AppData,
                "Goldberg SteamEmu Saves/<objectId>/achievements.json".into(),
            ),
            (
                BasePathVar::AppData,
                "GSE Saves/<objectId>/achievements.json".into(),
            ),
        ],
        Cracker::Rld => vec![
            (
                BasePathVar::ProgramData,
                "RLD!/<objectId>/achievements.ini".into(),
            ),
            (
                BasePathVar::ProgramData,
                "Steam/Player/<objectId>/stats/achievements.ini".into(),
            ),
            (
                BasePathVar::ProgramData,
                "Steam/RLD!/<objectId>/stats/achievements.ini".into(),
            ),
            (
                BasePathVar::ProgramData,
                "Steam/dodi/<objectId>/stats/achievements.ini".into(),
            ),
        ],
        Cracker::Empress => vec![
            (
                BasePathVar::AppData,
                "EMPRESS/remote/<objectId>/achievements.json".into(),
            ),
            (
                BasePathVar::PublicDocuments,
                "EMPRESS/<objectId>/remote/<objectId>/achievements.json".into(),
            ),
        ],
        Cracker::Skidrow => vec![
            (
                BasePathVar::Documents,
                "SKIDROW/<objectId>/SteamEmu/UserStats/achiev.ini".into(),
            ),
            (
                BasePathVar::Documents,
                "Player/<objectId>/SteamEmu/UserStats/achiev.ini".into(),
            ),
            (
                BasePathVar::LocalAppData,
                "SKIDROW/<objectId>/SteamEmu/UserStats/achiev.ini".into(),
            ),
        ],
        Cracker::CreamApi => vec![(
            BasePathVar::AppData,
            "CreamAPI/<objectId>/stats/CreamAPI.Achievements.cfg".into(),
        )],
        Cracker::SmartSteamEmu => vec![(
            BasePathVar::AppData,
            "SmartSteamEmu/<objectId>/User/Achievements.ini".into(),
        )],
        Cracker::Rle => vec![
            (
                BasePathVar::AppData,
                "RLE/<objectId>/achievements.ini".into(),
            ),
            (
                BasePathVar::AppData,
                "RLE/<objectId>/Achievements.ini".into(),
            ),
        ],
        Cracker::Razor1911 => vec![(BasePathVar::AppData, ".1911/<objectId>/achievement".into())],
        Cracker::Flt => {
            // Comentado no código original do Hydra - não é buscado automaticamente
            vec![
                // (BasePathVar::AppData, "FLT/stats".into()),
            ]
        }
        Cracker::UserStats | Cracker::ThreeDm | Cracker::SteamCache => {
            // Esses são buscados por paths relativos (executável ou Steam userdata)
            vec![]
        }
    }
}

/// Resolve o path base de acordo com a variável.
///
/// No Windows: usa as variáveis de sistema reais.
/// No Linux (Wine): usa os caminhos dentro do Wine prefix.
fn resolve_base_path(var: &BasePathVar, wine_prefix: Option<&Path>) -> PathBuf {
    if cfg!(target_os = "windows") {
        resolve_windows_base_path(var)
    } else if let Some(prefix) = wine_prefix {
        resolve_wine_base_path(var, prefix)
    } else {
        // Fallback: usa paths do sistema (não deveria acontecer em Linux)
        resolve_windows_base_path(var)
    }
}

fn resolve_windows_base_path(var: &BasePathVar) -> PathBuf {
    match var {
        BasePathVar::AppData => {
            let path = std::env::var("APPDATA")
                .unwrap_or_else(|_| format!("C:/Users/{}/AppData/Roaming", get_windows_username()));
            PathBuf::from(path)
        }
        BasePathVar::Documents => dirs::document_dir().unwrap_or_else(|| {
            PathBuf::from(format!("C:/Users/{}/Documents", get_windows_username()))
        }),
        BasePathVar::PublicDocuments => PathBuf::from("C:/Users/Public/Documents"),
        BasePathVar::LocalAppData => {
            let path = std::env::var("LOCALAPPDATA")
                .unwrap_or_else(|_| format!("C:/Users/{}/AppData/Local", get_windows_username()));
            PathBuf::from(path)
        }
        BasePathVar::ProgramData => PathBuf::from("C:/ProgramData"),
    }
}

fn resolve_wine_base_path(var: &BasePathVar, prefix: &Path) -> PathBuf {
    match var {
        BasePathVar::AppData => Wine::app_data(prefix),
        BasePathVar::Documents => Wine::documents(prefix),
        BasePathVar::PublicDocuments => Wine::public_documents(prefix),
        BasePathVar::LocalAppData => Wine::local_app_data(prefix),
        BasePathVar::ProgramData => Wine::program_data(prefix),
    }
}

/// Constrói diretórios de cracker para um jogo específico dentro de um Wine prefix.
///
/// Usado pelo unlock modal para mostrar apenas os caminhos relevantes
/// ao jogo sendo desbloqueado.
pub fn build_wine_prefix_dirs_for_game(prefix: &Path, game_id: &str) -> Vec<DirectoryConfig> {
    build_wine_prefix_dirs(prefix, &format!("Wine ({})", game_id))
}

/// Retorna apenas os diretórios de cracker que já possuem arquivo de conquista
/// para o jogo informado dentro de um Wine prefix.
///
/// O monitor precisa conhecer todos os diretórios possíveis, mas o modal de
/// unlock deve mostrar somente destinos reais do jogo atual.
pub fn find_existing_achievement_dirs_for_game_in_prefix(
    prefix: &Path,
    game_id: &str,
    label: &str,
) -> Vec<DirectoryConfig> {
    let mut dirs = Vec::new();
    let mut seen = std::collections::HashSet::new();
    let alternative_ids = crate::parser::get_alternative_object_ids(game_id);

    for &cracker in crate::models::Cracker::all() {
        for (base_var, file_pattern) in get_cracker_paths(cracker) {
            let base_path = resolve_wine_base_path(&base_var, prefix);
            let monitored_dir = base_path.join(monitored_directory_suffix(&file_pattern));

            for object_id in &alternative_ids {
                let file_path = base_path.join(file_pattern.replace("<objectId>", object_id));
                if file_path.exists() {
                    let path = monitored_dir.to_string_lossy().to_string();
                    if seen.insert(path.clone()) {
                        dirs.push(DirectoryConfig {
                            path,
                            name: format!("{} / {}", label, cracker.display_name()),
                            enabled: true,
                            is_default: true,
                            detection_preset: DirectoryDetectionPreset::Auto,
                        });
                    }
                }
            }
        }
    }

    dirs
}

fn monitored_directory_suffix(file_pattern: &str) -> PathBuf {
    let prefix = file_pattern
        .split("<objectId>")
        .next()
        .unwrap_or("")
        .trim_end_matches('/')
        .trim_end_matches('\\');

    if prefix.is_empty() {
        PathBuf::new()
    } else {
        PathBuf::from(prefix)
    }
}
