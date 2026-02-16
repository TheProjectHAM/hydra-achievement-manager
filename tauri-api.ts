import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { open as openExternalUrl } from "@tauri-apps/plugin-shell";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

console.log("🚀 [TAURI-API] Module loaded with fallback support (Tauri v2)");

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

export const getGameAchievementsBackend = async (gameId: string) => {
  const settings = await loadSettings().catch(() => null);
  return invoke<any>("get_game_achievements", {
    gameId,
    language: settings?.language || "en-US",
  });
};

export const getGameAchievementsFallback = async (game_id: string) => {
  try {
    const settings = await loadSettings();
    if (settings?.forceFrontendFetch) {
      console.log(
        `🌐 [FRONTEND] Force frontend fetch enabled - skipping backend for achievements ${game_id}`,
      );
      throw new Error("Force frontend fetch enabled");
    }
    console.log(
      `🔧 [BACKEND] Attempting backend fetch for achievements ${game_id}`,
    );
    const result = await getGameAchievementsBackend(game_id);
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
};

export const getGameAchievements = getGameAchievementsFallback;

export const reloadAchievements = (gameId: string, basePath: string) =>
  invoke<any>("reload_achievements", { gameId, basePath });

export const unlockAchievements = (options: any) =>
  invoke<void>("unlock_achievements", { options });

export const exportAchievements = (gameId: string) =>
  invoke<any>("export_achievements", { gameId });

// Directories
export const getMonitoredDirectories = () =>
  invoke<any[]>("get_monitored_directories");
export const getAchievementIniLastModified = (gameId: string, path: string) =>
  invoke<number | null>("get_achievement_ini_last_modified", { gameId, path });

export const addMonitoredDirectory = (path: string) =>
  invoke<any[]>("add_monitored_directory", { path });

export const removeMonitoredDirectory = (path: string) =>
  invoke<any[]>("remove_monitored_directory", { path });

export const toggleMonitoredDirectory = (path: string) =>
  invoke<any[]>("toggle_monitored_directory", { path });
export const setWinePrefixPath = (path: string) =>
  invoke<any[]>("set_wine_prefix_path", { path });

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

// Steam Integration
export const isSteamAvailable = () => invoke<boolean>("is_steam_available");

export const getSteamUserInfo = () =>
  invoke<{ userId: string; userName: string }>("get_steam_user_info");

export const getSteamGames = () => invoke<any[]>("get_steam_games");

export const getSteamGameAchievements = (appId: number) =>
  invoke<any[]>("get_steam_game_achievements", { appId });

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
  getMonitoredDirectories,
  addMonitoredDirectory,
  removeMonitoredDirectory,
  toggleMonitoredDirectory,
  setWinePrefixPath,
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
  onSteamGamesUpdate,
  onAchievementsUpdated,
  platform:
    typeof window !== "undefined" && navigator.userAgent.includes("Windows")
      ? "win32"
      : "linux",
  getCacheSize: () => invoke<string>("get_cache_size"),
  clearCache: () => invoke<void>("clear_cache"),
};

// Inject as electronAPI to avoid breaking components that weren't migrated yet
if (typeof window !== "undefined") {
  (window as any).electronAPI = electronAPI;
}
