use serde::{Deserialize, Serialize};

/// Todos os crackers/emuladores suportados conforme documentação oficial do Hydra
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Cracker {
    Codex,
    Rune,
    OnlineFix,
    Goldberg,
    Rld,
    Empress,
    Skidrow,
    CreamApi,
    SmartSteamEmu,
    Rle,
    Razor1911,
    UserStats,
    ThreeDm,
    Flt,
    SteamCache,
}

impl Cracker {
    /// Retorna todos os crackers suportados
    pub fn all() -> &'static [Cracker] {
        &[
            Cracker::Codex,
            Cracker::Rune,
            Cracker::OnlineFix,
            Cracker::Goldberg,
            Cracker::Rld,
            Cracker::Empress,
            Cracker::Skidrow,
            Cracker::CreamApi,
            Cracker::SmartSteamEmu,
            Cracker::Rle,
            Cracker::Razor1911,
            Cracker::UserStats,
            Cracker::ThreeDm,
            Cracker::Flt,
            Cracker::SteamCache,
        ]
    }

    /// Nome legível do cracker
    pub fn display_name(&self) -> &'static str {
        match self {
            Cracker::Codex => "CODEX",
            Cracker::Rune => "RUNE",
            Cracker::OnlineFix => "OnlineFix",
            Cracker::Goldberg => "Goldberg",
            Cracker::Rld => "RLD!",
            Cracker::Empress => "EMPRESS",
            Cracker::Skidrow => "SKIDROW",
            Cracker::CreamApi => "CreamAPI",
            Cracker::SmartSteamEmu => "SmartSteamEmu",
            Cracker::Rle => "RLE",
            Cracker::Razor1911 => "Razor1911",
            Cracker::UserStats => "user_stats",
            Cracker::ThreeDm => "3DM",
            Cracker::Flt => "FLT",
            Cracker::SteamCache => "Steam",
        }
    }
}

/// Representa um arquivo de conquista encontrado no disco
#[derive(Debug, Clone)]
pub struct AchievementFile {
    pub cracker: Cracker,
    pub file_path: String,
}

/// Informações sobre o Wine prefix para um jogo
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WinePrefixInfo {
    /// Path explícito do prefix (configurado pelo usuário)
    pub explicit_path: Option<String>,
    /// Object ID do jogo (usado para resolver o prefix padrão)
    pub object_id: Option<String>,
    /// Path do diretório de dados do Hydra (userData)
    pub user_data_path: String,
}

/// Representa uma entrada de achievement individual
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AchievementEntry {
    pub name: String,
    pub achieved: bool,
    #[serde(rename = "unlockTime")]
    pub unlock_time: i64,
}

/// Representa achievements de um jogo
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameAchievements {
    #[serde(rename = "gameId")]
    pub game_id: String,
    pub achievements: Vec<AchievementEntry>,
    #[serde(rename = "lastModified")]
    pub last_modified: i64,
    pub directory: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum DirectoryDetectionPreset {
    #[default]
    Auto,
    CodexIni,
    GoldbergJson,
    EmpressJson,
    OnlineFix,
    Skidrow,
    CreamApi,
    SmartSteamEmu,
    Razor1911,
}

/// Configuração de diretório para monitoramento
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirectoryConfig {
    pub path: String,
    pub name: String,
    pub enabled: bool,
    pub is_default: bool,
    #[serde(default, rename = "detectionPreset")]
    pub detection_preset: DirectoryDetectionPreset,
}

/// Achievement da API Hydra
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HydraAchievement {
    pub name: String,
    #[serde(rename = "displayName")]
    pub display_name: String,
    pub description: String,
    pub icon: String,
    pub icongray: String,
    pub hidden: bool,
}

/// Resposta da API Hydra
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HydraGameAchievements {
    #[serde(rename = "gameId")]
    pub game_id: String,
    pub achievements: Vec<HydraAchievement>,
}

/// Achievement da API Steam
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteamAchievement {
    pub apiname: String,
    pub achieved: i32,
    pub unlocktime: i64,
    pub name: Option<String>,
    pub description: Option<String>,
    pub icon: Option<String>,
    pub icongray: Option<String>,
    #[serde(default)]
    pub percent: f64,
    #[serde(default)]
    pub hidden: bool,
}

/// Timestamp para unlock
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Timestamp {
    pub day: String,
    pub month: String,
    pub year: String,
    pub hour: String,
    pub minute: String,
    pub ampm: Option<String>,
}

/// Modo de unlock
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum UnlockMode {
    Current,
    Random,
    Custom,
}

/// Formato de tempo
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TimeFormat {
    #[serde(rename = "12h")]
    TwelveHour,
    #[serde(rename = "24h")]
    TwentyFourHour,
}

/// Achievement para unlock
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AchievementToUnlock {
    pub name: String,
    pub completed: bool,
    pub timestamp: Timestamp,
}

/// Opções para unlock de achievements
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnlockOptions {
    #[serde(rename = "gameId")]
    pub game_id: String,
    #[serde(rename = "selectedPath")]
    pub selected_path: String,
    pub achievements: Vec<AchievementToUnlock>,
    pub mode: UnlockMode,
    #[serde(rename = "customTimestamp")]
    pub custom_timestamp: Option<Timestamp>,
    #[serde(rename = "timeFormat")]
    pub time_format: TimeFormat,
}

/// Resultado de busca de jogo Steam
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteamGameSearchResult {
    pub id: u32,
    pub name: String,
    #[serde(rename = "achievementsTotal")]
    pub achievements_total: u32,
}

/// Progresso de exportação
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportProgress {
    pub current: usize,
    pub total: usize,
    pub name: String,
    pub icon: String,
}

/// Informações de detecção de Proton
#[derive(Debug, Clone)]
pub struct ProtonInfo {
    pub path: String,
    pub version_name: String,
}
