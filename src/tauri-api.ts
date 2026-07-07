import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { open as openExternalUrl } from "@tauri-apps/plugin-shell";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import {
  RetroAchievementData,
  RetroAchievementsAwardRequest,
  RetroAchievementsAwardResponse,
  RetroAchievementsPatchDataProbe,
  RetroAchievementsGame,
  RetroAchievementsProfile,
  RetroAchievementsRuntimeLogin,
  RetroAchievementsWebSessionLogin,
  SteamAchievementData,
  SteamSearchResult,
} from "./types";

const inFlightAchievementRequests = new Map<string, Promise<any>>();
const inFlightSteamGameRequests = new Map<number, Promise<SteamAchievementData[]>>();
const inFlightRetroAchievementRequests = new Map<number, Promise<RetroAchievementData[]>>();

const mapUiLanguageToSteamStoreLanguage = (language?: string): string => {
  switch (language) {
    case "pt-BR":
      return "portuguese";
    case "fr-FR":
      return "french";
    case "it-IT":
      return "italian";
    case "de-DE":
      return "german";
    case "es-ES":
      return "spanish";
    case "ru-RU":
      return "russian";
    case "ja-JP":
      return "japanese";
    case "zh-CN":
      return "schinese";
    case "pl-PL":
      return "polish";
    case "uk-UA":
      return "ukrainian";
    case "en-US":
    default:
      return "english";
  }
};

const mapUiLanguageToHydraLanguage = (language?: string): string => {
  switch (language) {
    case "pt-BR":
      return "pt";
    case "es-ES":
      return "es";
    case "ru-RU":
      return "ru";
    case "en-US":
    default:
      return "en";
  }
};

// Window controls
export const minimizeWindow = () => invoke("minimize_window");
export const maximizeWindow = () => invoke("maximize_window");
export const closeWindow = () => invoke("close_window");

export const setWindowDecorations = (decorations: boolean) =>
  invoke<void>("set_window_decorations", { decorations });

// Achievements
export const requestAchievements = async () => {
  try {
    return await invoke<any[]>("request_achievements");
  } catch (error) {
    console.error("Failed to request achievements:", error);
    return [];
  }
};

export const getGameNameBackend = (gameId: string) =>
  invoke<string>("get_game_name", { gameId });

export const getGameNameFallback = async (game_id: string): Promise<string> => {
  try {
    const settings = await loadSettings();
    if (settings?.forceFrontendFetch) {
      console.log(
        `🌐 [FRONTEND] Force frontend fetch enabled - skipping backend for game name ${game_id}`,
      );
      throw new Error("Force frontend fetch enabled");
    }
    console.log(
      `🔧 [BACKEND] Attempting backend fetch for game name ${game_id}`,
    );
    return await getGameNameBackend(game_id);
  } catch (error) {
    console.warn(
      `⚠️ [FALLBACK] Backend failed for game name ${game_id}, using Tauri HTTP plugin:`,
      error,
    );
    const settings = await loadSettings().catch(() => null);
    const steamLanguage = mapUiLanguageToSteamStoreLanguage(settings?.language);
    const url = `https://store.steampowered.com/api/appdetails?appids=${game_id}&l=${steamLanguage}`;
    try {
      const response = await tauriFetch(url, {
        method: "GET",
      });

      if (response.ok) {
        const data = await response.json();
        if (data[game_id]?.success) {
          console.log(
            `✅ [FRONTEND] Successfully fetched game name ${game_id} via Tauri HTTP`,
          );
          return data[game_id].data.name;
        }
      }
    } catch (fError) {
      console.error(
        "❌ [FRONTEND] Frontend fallback failed for game name:",
        fError,
      );
    }
    return game_id;
  }
};

export const getGameName = getGameNameFallback;

export const getGameNamesBackend = (gameIds: string[]) =>
  invoke<Record<string, string>>("get_game_names", { gameIds });

export const getGameNamesFallback = async (
  game_ids: string[],
): Promise<Record<string, string>> => {
  try {
    const settings = await loadSettings();
    if (settings?.forceFrontendFetch) {
      console.log(
        `🌐 [FRONTEND] Force frontend fetch enabled - skipping backend for ${game_ids.length} game names`,
      );
      throw new Error("Force frontend fetch enabled");
    }
    console.log(
      `🔧 [BACKEND] Attempting backend fetch for ${game_ids.length} game names`,
    );
    return await getGameNamesBackend(game_ids);
  } catch (error) {
    console.warn(
      `⚠️ [FALLBACK] Backend failed for game names, using sequential frontend fetch for ${game_ids.length} games:`,
      error,
    );
    const results: Record<string, string> = {};
    for (const id of game_ids) {
      results[id] = await getGameNameFallback(id);
    }
    console.log(
      `✅ [FRONTEND] Successfully fetched ${game_ids.length} game names via proxy`,
    );
    return results;
  }
};

export const getGameNames = getGameNamesFallback;

export const searchSteamGamesBackend = (query: string) =>
  invoke<any[]>("search_steam_games", { query });

export const searchSteamGamesFallback = async (
  query: string,
): Promise<any[]> => {
  try {
    const settings = await loadSettings();
    if (settings?.forceFrontendFetch) {
      console.log(
        `🌐 [FRONTEND] Force frontend fetch enabled - skipping backend for search "${query}"`,
      );
      throw new Error("Force frontend fetch enabled");
    }
    console.log(`🔧 [BACKEND] Attempting backend search for "${query}"`);
    return await searchSteamGamesBackend(query);
  } catch (error) {
    console.warn(
      `⚠️ [FALLBACK] Backend search failed for "${query}", using Tauri HTTP plugin:`,
      error,
    );
    const settings = await loadSettings().catch(() => null);
    const steamLanguage = mapUiLanguageToSteamStoreLanguage(settings?.language);
    const searchUrl = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(query)}&l=${steamLanguage}&cc=us&snr=1_4_4__12`;

    try {
      const response = await tauriFetch(searchUrl, {
        method: "GET",
      });

      if (response.ok) {
        const data = await response.json();
        if (data.items) {
          console.log(
            `✅ [FRONTEND] Successfully searched "${query}" via Tauri HTTP - ${data.items.length} results`,
          );
          return data.items.map((item: any) => ({
            id: item.id,
            name: item.name,
            achievementsTotal: 0,
          }));
        }
      }
    } catch (fError) {
      console.error(
        "❌ [FRONTEND] Frontend fallback failed for search:",
        fError,
      );
    }
    return [];
  }
};

export const searchSteamGames = searchSteamGamesFallback;

export const searchRetroAchievementsGames = async (
  query: string,
): Promise<SteamSearchResult[]> => {
  const results = await invoke<any[]>("search_retro_achievements_games", { query });
  return results.map((game) => ({
    id: game.id,
    name: game.title,
    achievementsTotal: game.achievementsTotal || 0,
    source: "retroachievements",
    consoleName: game.consoleName,
    imageUrl: game.imageBoxArt || game.imageIcon || null,
    logoUrl: game.imageIcon || null,
  }));
};

export const getGameAchievementsBackend = async (
  gameId: string,
  options: { forceSteamApi?: boolean } = {},
) => {
  const settings = await loadSettings().catch(() => null);
  return invoke<any>("get_game_achievements", {
    gameId,
    language: settings?.language || "en-US",
    forceSteamApi: options.forceSteamApi || false,
  });
};

export const getGameAchievementsFallback = async (
  game_id: string,
  options: { forceSteamApi?: boolean } = {},
) => {
  const requestKey = `${game_id}:${options.forceSteamApi ? "steamapi" : "default"}`;
  const inFlightRequest = inFlightAchievementRequests.get(requestKey);
  if (inFlightRequest) {
    return inFlightRequest;
  }

  const request = (async () => {
    try {
      const settings = await loadSettings();
      if (settings?.forceFrontendFetch && !options.forceSteamApi) {
        console.log(
          `🌐 [FRONTEND] Force frontend fetch enabled - skipping backend for achievements ${game_id}`,
        );
        throw new Error("Force frontend fetch enabled");
      }
      console.log(
        `🔧 [BACKEND] Attempting backend fetch for achievements ${game_id}`,
      );
      const result = await getGameAchievementsBackend(game_id, options);
      return result;
    } catch (error) {
      console.warn(
        `⚠️ [FALLBACK] Backend failed for achievements ${game_id}, using Tauri HTTP plugin:`,
        error,
      );
      const settings = await loadSettings().catch(() => null);
      const hydraLanguage = mapUiLanguageToHydraLanguage(settings?.language);
      const hydraUrl = `https://hydra-api-us-east-1.losbroxas.org/games/achievements?shop=steam&objectId=${game_id}&language=${hydraLanguage}`;

    try {
      const response = await tauriFetch(hydraUrl, {
        method: "GET",
      });

      if (response.ok) {
        const data = await response.json();
        console.log(
          `✅ [FRONTEND] Successfully fetched achievements for ${game_id} via Tauri HTTP`,
        );
        return {
          gameId: game_id,
          achievements: data,
        };
      } else {
        throw new Error(`Request failed with status ${response.status}`);
      }
    } catch (fallbackError) {
      console.error(
        "❌ [FRONTEND] Frontend fallback also failed:",
        fallbackError,
      );
      throw error; // Re-throw original error if fallback fails
    }
    }
  })();

  inFlightAchievementRequests.set(requestKey, request);
  request.then(
    () => inFlightAchievementRequests.delete(requestKey),
    () => inFlightAchievementRequests.delete(requestKey),
  );
  return request;
};

export const getGameAchievements = getGameAchievementsFallback;

export const shouldUseSteamworksAchievements = async () => {
  const settings = await loadSettings().catch(() => null);
  return !["steamapi", "api"].includes(settings?.steamAchievementSource);
};

export const getSteamAchievementSource = async (): Promise<"steamworks" | "steamapi"> => {
  const settings = await loadSettings().catch(() => null);
  return ["steamapi", "api"].includes(settings?.steamAchievementSource)
    ? "steamapi"
    : "steamworks";
};

export const getAchievementsForGameSource = async (
  gameId: string | number,
  isSteamGame: boolean,
  isRetroAchievementsGame: boolean = false,
) => {
  if (isRetroAchievementsGame) {
    return { achievements: await getRetroAchievementsGameAchievements(Number(gameId)) };
  }

  if (isSteamGame && (await shouldUseSteamworksAchievements())) {
    return { achievements: await getSteamGameAchievements(Number(gameId)) };
  }

  if (isSteamGame) {
    return getGameAchievements(String(gameId), { forceSteamApi: true });
  }

  return getGameAchievements(String(gameId));
};

export const reloadAchievements = (gameId: string, basePath: string) =>
  invoke<any>("reload_achievements", { gameId, basePath });

export const unlockAchievements = (options: any) =>
  invoke<void>("unlock_achievements", { options });

export const exportAchievements = (gameId: string) =>
  invoke<any>("export_achievements", { gameId });

// Backup / Restore
export const createAchievementsBackup = (
  outputPath: string,
  selectedGameIds?: string[],
  includeSettings: boolean = true,
  steamEntries?: Array<{
    gameId: string;
    achievements: Array<{ name: string; achieved: boolean; unlockTime: number }>;
  }>,
) =>
  invoke<{ outputPath: string; gamesCount: number; hasSettings: boolean }>(
    "create_achievements_backup",
    {
      outputPath,
      selectedGameIds: selectedGameIds ?? null,
      includeSettings,
      steamEntries:
        steamEntries && steamEntries.length > 0
          ? steamEntries
          : null,
    },
  );

export const previewAchievementsRestore = (backupPath: string) =>
  invoke<{
    backupPath: string;
    totalEntries: number;
    items: Array<{
      index: number;
      gameId: string;
      directory: string;
      fileFormat: string;
      backupAchievements: number;
      existingAchievements: number;
      overlappingAchievements: number;
      changedAchievements: number;
      unchangedAchievements: number;
      newAchievements: number;
      willReplace: boolean;
      isSteamEntry: boolean;
      missingBasePath: boolean;
      steamUnavailable: boolean;
      steamGameNotDetected: boolean;
      restoreBlocked: boolean;
      restoreBlockReason?: string | null;
    }>;
    settings: {
      included: boolean;
      totalKeys: number;
      conflictingKeys: number;
      missingKeys: number;
    };
  }>("preview_achievements_restore", { backupPath });

export const applyAchievementsRestore = (
  backupPath: string,
  selectedIndices?: number[],
  gameConflictResolutions?: Array<{ index: number; strategy: "backup" | "current" | "cancel" }>,
  restoreSettings: boolean = false,
  settingsStrategy: "backup" | "current" | "merge" = "backup",
) =>
  invoke<{
    backupPath: string;
    restoredEntries: number;
    skippedEntries: number;
    restoredSettings: boolean;
  }>(
    "apply_achievements_restore",
    {
      backupPath,
      selectedIndices: selectedIndices && selectedIndices.length > 0 ? selectedIndices : null,
      gameConflictResolutions:
        gameConflictResolutions && gameConflictResolutions.length > 0
          ? gameConflictResolutions
          : null,
      restoreSettings,
      settingsStrategy,
    },
  );

// Directories
export const getMonitoredDirectories = () =>
  invoke<any[]>("get_monitored_directories");
export const getAchievementIniLastModified = (gameId: string, path: string) =>
  invoke<number | null>("get_achievement_ini_last_modified", { gameId, path });

export const addMonitoredDirectory = (path: string, detectionPreset: string = "auto") =>
  invoke<any[]>("add_monitored_directory", { path, detectionPreset });

export const removeMonitoredDirectory = (path: string) =>
  invoke<any[]>("remove_monitored_directory", { path });

export const toggleMonitoredDirectory = (path: string) =>
  invoke<any[]>("toggle_monitored_directory", { path });
export const setWinePrefixPath = (path: string) =>
  invoke<any[]>("set_wine_prefix_path", { path });
export const getGameWinePaths = (gameId: string) =>
  invoke<any[]>("get_game_wine_paths", { gameId });

export const pickFolder = () => invoke<string | null>("pick_folder");
export const pickSteamVdfFile = () =>
  invoke<string | null>("pick_steam_vdf_file");
export const pickSteamDllFile = () =>
  invoke<string | null>("pick_steam_dll_file");

// Events
export const onAchievementsUpdate = (
  callback: (games: any[]) => void,
): Promise<UnlistenFn> => {
  return listen("achievements-update", (event) => {
    callback(event.payload as any[]);
  });
};

export const onExportProgress = (
  callback: (progress: any) => void,
): Promise<UnlistenFn> => {
  return listen("export-progress", (event) => {
    callback(event.payload);
  });
};

export const onAchievementsUpdated = (
  callback: () => void,
): Promise<UnlistenFn> => {
  return listen("achievements-updated", () => {
    callback();
  });
};

// Settings
export const saveSettings = (settings: any) =>
  invoke<void>("save_settings", { settings });

export const loadSettings = () => invoke<any>("load_settings");

// Connections
export interface HydraConnectionProfile {
  id: string;
  displayName: string;
  profileImageUrl?: string | null;
  backgroundImageUrl?: string | null;
  subscription?: {
    id?: string | null;
    userId?: number | null;
    status?: string | null;
    expiresAt?: string | null;
    billingCycle?: string | null;
    paymentPlatform?: string | null;
    plan?: {
      id?: string | null;
      type?: string | null;
    } | null;
  } | null;
}

export const getHydraConnectionProfile = () =>
  invoke<HydraConnectionProfile | null>("get_hydra_connection_profile");

export const getHydraDbPath = () =>
  invoke<string>("get_hydra_db_path");

export interface SteamConnectionProfile {
  steamId64: string;
  accountId: number;
  accountName?: string | null;
  personaName: string;
  steam3Id: string;
  steam2Id: string;
  profileUrl: string;
  avatarHash?: string | null;
  avatarUrl?: string | null;
  localAvatarPath?: string | null;
  subAccounts: SteamSubAccount[];
}

export interface SteamSubAccount {
  steamId64: string;
  accountId: number;
  accountName?: string | null;
  personaName: string;
  profileUrl: string;
  avatarUrl?: string | null;
}

export const getSteamConnectionProfile = () =>
  invoke<SteamConnectionProfile | null>("get_steam_connection_profile");

export const getRetroAchievementsConnectionProfile = () =>
  invoke<RetroAchievementsProfile | null>("get_retro_achievements_connection_profile");

export const testRetroAchievementsConnection = (username: string, apiKey: string) =>
  invoke<RetroAchievementsProfile>("test_retro_achievements_connection", { username, apiKey });

export const loginRetroAchievementsRuntimeWithPassword = (username: string, password: string) =>
  invoke<RetroAchievementsRuntimeLogin>("login_retro_achievements_runtime_with_password", { username, password });

export const loginRetroAchievementsRuntimeWithToken = (username: string, token: string) =>
  invoke<RetroAchievementsRuntimeLogin>("login_retro_achievements_runtime_with_token", { username, token });

export const loginRetroAchievementsWebSession = () =>
  invoke<RetroAchievementsWebSessionLogin>("login_retro_achievements_web_session");

export const probeRetroAchievementsPatchData = (username: string, runtimeToken: string, gameId: number) =>
  invoke<RetroAchievementsPatchDataProbe>("probe_retro_achievements_patch_data", { username, runtimeToken, gameId });

export const awardRetroAchievement = (options: RetroAchievementsAwardRequest) =>
  invoke<RetroAchievementsAwardResponse>("award_retro_achievement", { options });

export const deleteRetroAchievementUnlock = (achievementId: number) =>
  invoke<any>("delete_retro_achievement_unlock", { achievementId });

export const deleteRetroGameUnlocks = (gameId: number) =>
  invoke<any>("delete_retro_game_unlocks", { gameId });

export const getRetroAchievementsRecentGames = () =>
  invoke<RetroAchievementsGame[]>("get_retro_achievements_recent_games");

export const getRetroAchievementsGameAchievements = (gameId: number) => {
  const inFlightRequest = inFlightRetroAchievementRequests.get(gameId);
  if (inFlightRequest) return inFlightRequest;

  const request = invoke<RetroAchievementData[]>("get_retro_achievements_game_achievements", { gameId });
  inFlightRetroAchievementRequests.set(gameId, request);
  request.then(
    () => inFlightRetroAchievementRequests.delete(gameId),
    () => inFlightRetroAchievementRequests.delete(gameId),
  );
  return request;
};

// Steam Integration
export const isSteamAvailable = () => invoke<boolean>("is_steam_available");

export const getSteamUserInfo = () =>
  invoke<{ userId: string; userName: string }>("get_steam_user_info");

let inFlightSteamGamesRequest: Promise<any[]> | null = null;
export const getSteamGames = () => {
  if (!inFlightSteamGamesRequest) {
    inFlightSteamGamesRequest = invoke<any[]>("get_steam_games");
    inFlightSteamGamesRequest.then(
      () => {
        inFlightSteamGamesRequest = null;
      },
      () => {
        inFlightSteamGamesRequest = null;
      },
    );
  }

  return inFlightSteamGamesRequest;
};

export const getSteamGameAchievements = (appId: number) => {
  const inFlightRequest = inFlightSteamGameRequests.get(appId);
  if (inFlightRequest) {
    return inFlightRequest;
  }

  const request = invoke<SteamAchievementData[]>("get_steam_game_achievements", { appId });
  inFlightSteamGameRequests.set(appId, request);
  request.then(
    () => inFlightSteamGameRequests.delete(appId),
    () => inFlightSteamGameRequests.delete(appId),
  );
  return request;
};

export const setSteamAchievement = (
  achievementName: string,
  unlocked: boolean,
) => invoke<void>("set_steam_achievement", { achievementName, unlocked });

export const detectSteamGames = () => invoke<string[]>("detect_steam_games");
export const getSteamDllPath = () => invoke<string | null>("get_steam_dll_path");
export const getSteamLibraryInfo = () =>
  invoke<{ vdfPath: string | null; lastModified: number | null }>(
    "get_steam_library_info",
  );

export const getAllSteamLibraryGames = () =>
  invoke<any[]>("get_all_steam_library_games");

export const onSteamGamesUpdate = (
  callback: (games: any[]) => void,
): Promise<UnlistenFn> => {
  return listen("steam-games-update", (event) => {
    callback(event.payload as any[]);
  });
};

// Utilities
export const openExternal = async (url: string) => {
  try {
    await openExternalUrl(url);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// Compatibility export
export const electronAPI = {
  minimize: minimizeWindow,
  maximize: maximizeWindow,
  close: closeWindow,
  requestAchievements,
  getGameName: getGameNameFallback,
  getGameNames: getGameNamesFallback,
  searchSteamGames: searchSteamGamesFallback,
  getGameAchievements: getGameAchievementsFallback,
  reloadAchievements,
  unlockAchievements,
  exportAchievements,
  createAchievementsBackup,
  previewAchievementsRestore,
  applyAchievementsRestore,
  getMonitoredDirectories,
  addMonitoredDirectory,
  removeMonitoredDirectory,
  toggleMonitoredDirectory,
  setWinePrefixPath,
  getGameWinePaths,
  pickFolder,
  pickSteamVdfFile,
  pickSteamDllFile,
  onAchievementsUpdate,
  onExportProgress,
  saveSettings,
  loadSettings,
  openExternal,
  // Steam integration
  isSteamAvailable,
  getSteamUserInfo,
  getSteamGames,
  getSteamGameAchievements,
  setSteamAchievement,
  detectSteamGames,
  getSteamDllPath,
  getSteamLibraryInfo,
  getAllSteamLibraryGames,
  onSteamGamesUpdate,
  onAchievementsUpdated,
  platform:
    typeof window !== "undefined" &&
    (/Windows|Win32|Win64|WOW64/.test(navigator.userAgent) ||
      navigator.platform.startsWith("Win"))
      ? "win32"
      : "linux",
  getCacheSize: () => invoke<string>("get_cache_size"),
  clearCache: () => invoke<void>("clear_cache"),
};

// Inject as electronAPI to avoid breaking components that weren't migrated yet
if (typeof window !== "undefined") {
  (window as any).electronAPI = electronAPI;
}
