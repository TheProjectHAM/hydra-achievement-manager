use crate::models::ProtonInfo;
use std::fs;
use std::path::{Path, PathBuf};

/// Gerenciamento de Wine/Proton paths conforme documentação oficial do Hydra.
///
/// Responsável por resolver o Wine Prefix (equivalente ao $WINEPREFIX),
/// detectar versões do Proton instaladas, e validar a estrutura de um prefix.
pub struct Wine;

impl Wine {
    /// Retorna o path do prefix efetivo para um jogo.
    ///
    /// Lógica de resolução (prioridade):
    /// 1. Se `wine_prefix_path` foi fornecido explicitamente → usa ele
    /// 2. Se `object_id` foi fornecido → retorna `<user_data>/wine-prefixes/<object_id>`
    /// 3. Se existe o path legado → retorna o legado
    /// 4. Senão → None
    pub fn get_effective_prefix_path(
        wine_prefix_path: Option<&str>,
        object_id: Option<&str>,
        user_data_path: &Path,
    ) -> Option<PathBuf> {
        // 1. Prefixo explícito
        if let Some(explicit) = wine_prefix_path {
            let trimmed = explicit.trim();
            if !trimmed.is_empty() {
                let path = PathBuf::from(shellexpand_user(trimmed));
                if path.exists() {
                    return Some(path);
                }
            }
        }

        // 2. Prefixo por objectId
        if let Some(oid) = object_id {
            let per_game = user_data_path.join("wine-prefixes").join(oid);
            if per_game.exists() {
                return Some(per_game);
            }
        }

        // 3. Prefixo legado
        let legacy = user_data_path.join("wine-prefix");
        if legacy.exists() {
            return Some(legacy);
        }

        None
    }

    /// Retorna o path do prefix padrão para um objectId (mesmo que não exista ainda).
    pub fn get_default_prefix_path(object_id: &str, user_data_path: &Path) -> PathBuf {
        user_data_path.join("wine-prefixes").join(object_id)
    }

    /// Retorna o path do prefix legado.
    pub fn get_legacy_prefix_path(user_data_path: &Path) -> PathBuf {
        user_data_path.join("wine-prefix")
    }

    /// Valida se um diretório é um Wine prefix válido.
    ///
    /// Verifica a presença dos arquivos essenciais:
    /// - `system.reg` (arquivo)
    /// - `user.reg` (arquivo)
    /// - `userdef.reg` (arquivo)
    /// - `dosdevices` (diretório)
    /// - `drive_c` (diretório)
    pub fn validate_prefix(prefix_path: &Path) -> bool {
        if !prefix_path.exists() {
            return false;
        }

        let required_files = ["system.reg", "user.reg", "userdef.reg"];
        let required_dirs = ["dosdevices", "drive_c"];

        for f in &required_files {
            if !prefix_path.join(f).exists() {
                return false;
            }
        }
        for d in &required_dirs {
            if !prefix_path.join(d).is_dir() {
                return false;
            }
        }

        true
    }

    /// Resolve o nome de usuário usado pelo Hydra para paths dependentes
    /// de `appData`, `documents` e `localAppData` no Linux.
    ///
    /// Importante: o Hydra usa o nome do usuário Linux (`$HOME`), não o
    /// usuário real dentro do prefix Proton/Wine (`steamuser`). Isso é
    /// necessário para gerar paths que o Hydra Launcher realmente lê.
    pub fn resolve_wine_user(_prefix_path: &Path) -> String {
        dirs::home_dir()
            .and_then(|p| p.file_name().map(|n| n.to_string_lossy().to_string()))
            .filter(|name| !name.trim().is_empty())
            .unwrap_or_else(|| std::env::var("USER").unwrap_or_else(|_| "steamuser".to_string()))
    }

    // ── Caminhos base dentro do Wine prefix ──────────────────────────────

    /// `<prefix>/drive_c/users/<user>/AppData/Roaming`
    pub fn app_data(prefix_path: &Path) -> PathBuf {
        let user = Self::resolve_wine_user(prefix_path);
        prefix_path
            .join("drive_c")
            .join("users")
            .join(&user)
            .join("AppData")
            .join("Roaming")
    }

    /// `<prefix>/drive_c/users/<user>/AppData/Local`
    pub fn local_app_data(prefix_path: &Path) -> PathBuf {
        let user = Self::resolve_wine_user(prefix_path);
        prefix_path
            .join("drive_c")
            .join("users")
            .join(&user)
            .join("AppData")
            .join("Local")
    }

    /// `<prefix>/drive_c/users/<user>/Documents`
    pub fn documents(prefix_path: &Path) -> PathBuf {
        let user = Self::resolve_wine_user(prefix_path);
        prefix_path
            .join("drive_c")
            .join("users")
            .join(&user)
            .join("Documents")
    }

    /// `<prefix>/drive_c/users/Public/Documents`
    pub fn public_documents(prefix_path: &Path) -> PathBuf {
        prefix_path
            .join("drive_c")
            .join("users")
            .join("Public")
            .join("Documents")
    }

    /// `<prefix>/drive_c/ProgramData`
    pub fn program_data(prefix_path: &Path) -> PathBuf {
        prefix_path.join("drive_c").join("ProgramData")
    }
}

/// Gerenciamento do UMU (compatibility layer para rodar jogos Windows via Proton no Linux).
pub struct Umu;

impl Umu {
    /// Diretórios onde o Proton pode estar instalado.
    fn proton_search_paths() -> Vec<PathBuf> {
        let home = dirs::home_dir().unwrap_or_default();
        vec![
            // Steam Common
            home.join(".steam")
                .join("steam")
                .join("steamapps")
                .join("common"),
            // Compatibility Tools (user)
            home.join(".steam")
                .join("steam")
                .join("compatibilitytools.d"),
            // Compatibility Tools (system)
            PathBuf::from("/usr/share/steam/compatibilitytools.d"),
        ]
    }

    /// Detecta todas as versões do Proton instaladas.
    ///
    /// Busca em 3 locations:
    /// 1. `~/.steam/steam/steamapps/common/Proton*`
    /// 2. `~/.steam/steam/compatibilitytools.d/*`
    /// 3. `/usr/share/steam/compatibilitytools.d/*`
    ///
    /// Cada diretório é validado verificando a existência de:
    /// - `proton` (arquivo executável)
    /// - `toolmanifest.vdf`
    pub fn detect_proton_versions() -> Vec<ProtonInfo> {
        let mut versions = Vec::new();

        for search_path in Self::proton_search_paths() {
            if !search_path.exists() {
                continue;
            }

            let entries = match fs::read_dir(&search_path) {
                Ok(e) => e,
                Err(_) => continue,
            };

            for entry in entries.flatten() {
                if !entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false) {
                    continue;
                }

                let dir_path = entry.path();
                if Self::is_valid_proton_directory(&dir_path) {
                    let version_name = entry.file_name().to_string_lossy().to_string();
                    versions.push(ProtonInfo {
                        path: dir_path.to_string_lossy().to_string(),
                        version_name,
                    });
                }
            }
        }

        versions
    }

    /// Valida se um diretório contém uma instalação válida do Proton.
    ///
    /// Verifica a existência de:
    /// - `proton` (arquivo executável)
    /// - `toolmanifest.vdf`
    pub fn is_valid_proton_directory(directory_path: &Path) -> bool {
        let proton_file = directory_path.join("proton");
        let tool_manifest = directory_path.join("toolmanifest.vdf");
        proton_file.exists() && tool_manifest.exists()
    }

    /// Valida se um path do Proton é válido.
    pub fn is_valid_proton_path(proton_path: &str) -> bool {
        let path = Path::new(proton_path);
        Self::is_valid_proton_directory(path)
    }

    /// Resolve o path do Proton para lançamento.
    ///
    /// Prioridade:
    /// 1. Path específico do jogo (se válido)
    /// 2. Path padrão das preferências do usuário
    /// 3. None (deixa o UMU decidir)
    pub fn resolve_proton_path_for_launch(
        game_proton_path: Option<&str>,
        default_proton_path: Option<&str>,
    ) -> Option<String> {
        // 1. Path específico do jogo
        if let Some(gp) = game_proton_path {
            if Self::is_valid_proton_path(gp) {
                return Some(gp.to_string());
            }
        }

        // 2. Path padrão das preferências
        if let Some(dp) = default_proton_path {
            if Self::is_valid_proton_path(dp) {
                return Some(dp.to_string());
            }
        }

        // 3. None (deixa o UMU decidir)
        None
    }
}

/// Expande `~` para o diretório home do usuário.
pub fn expand_tilde(path: &str) -> PathBuf {
    if path.starts_with("~/") {
        if let Some(home) = dirs::home_dir() {
            return home.join(&path[2..]);
        }
    }
    if path == "~" {
        if let Some(home) = dirs::home_dir() {
            return home;
        }
    }
    PathBuf::from(path)
}

/// Expande `~` no estilo do shell.
fn shellexpand_user(path: &str) -> String {
    if path.starts_with("~/") {
        if let Some(home) = dirs::home_dir() {
            return format!("{}{}", home.display(), &path[1..]);
        }
    }
    path.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_prefix_nonexistent() {
        assert!(!Wine::validate_prefix(Path::new("/nonexistent/path")));
    }

    #[test]
    fn test_resolve_proton_path_for_launch_none() {
        let result = Umu::resolve_proton_path_for_launch(None, None);
        assert!(result.is_none());
    }

    #[test]
    fn test_expand_tilde() {
        let expanded = expand_tilde("~/test");
        assert!(!expanded.to_string_lossy().starts_with('~'));
    }
}
