import React, { createContext, useContext, useEffect, useState, useMemo, useRef } from 'react';
import { GameAchievements } from '../types';
import { useTheme } from './ThemeContext';
import {
  onAchievementsUpdate,
  requestAchievements,
  getGameNames,
  getGameAchievements,
  getAchievementsForGameSource,
  onSteamGamesUpdate,
  getSteamGames,
  isSteamAvailable,
  onAchievementsUpdated
} from '../tauri-api';

interface RecentGame {
  gameId: string;
  name: string;
  directory: string;
  achievementsCurrent: number;
  achievementsTotal: number;
  achievementsTotalFromAPI: number | null;
  lastModified: Date | number;
  source?: string;
}

interface DuplicateGameInfo {
  gameId: string;
  gameName: string;
  directories: Array<{ path: string; name: string; game: GameAchievements }>;
}

interface MonitoredAchievementsContextType {
  games: any[];
  recentGames: RecentGame[];
  duplicateGames: DuplicateGameInfo[];
  gameNames: Record<string, string>;
  isLoading: boolean;
  isDirectorySelectionOpen: boolean;
  selectedDuplicateGame: DuplicateGameInfo | null;
  openDirectorySelection: (gameId: string) => void;
  closeDirectorySelection: () => void;
  selectDirectory: (directoryPath: string, onGameSelected?: (game: GameAchievements) => void) => void;
  manuallyUpdateGame: (
    gameId: string,
    achievements: { name: string, completed: boolean }[],
    updateSteamStats?: boolean
  ) => void;
  forceRefresh: () => Promise<void>;
}

const MonitoredAchievementsContext = createContext<MonitoredAchievementsContextType>({
  games: [],
  recentGames: [],
  duplicateGames: [],
  gameNames: {},
  isLoading: true,
  isDirectorySelectionOpen: false,
  selectedDuplicateGame: null,
  openDirectorySelection: () => { },
  closeDirectorySelection: () => { },
  selectDirectory: () => { },
  manuallyUpdateGame: () => { },
  forceRefresh: async () => { },
});

export const useMonitoredAchievements = () => useContext(MonitoredAchievementsContext);

export const MonitoredAchievementsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { hideSteamGamesWithoutAchievements } = useTheme();
  const [allGames, setAllGames] = useState<GameAchievements[]>([]);
  const [games, setGames] = useState<GameAchievements[]>([]);
  const [gameNames, setGameNames] = useState<Record<string, string>>({});
  const [gameAchievementsFromAPI, setGameAchievementsFromAPI] = useState<Record<string, number>>({});
  const [duplicateGames, setDuplicateGames] = useState<DuplicateGameInfo[]>([]);
  const [isDirectorySelectionOpen, setIsDirectorySelectionOpen] = useState(false);
  const [selectedDuplicateGame, setSelectedDuplicateGame] = useState<DuplicateGameInfo | null>(null);
  const [steamGames, setSteamGames] = useState<any[]>([]);
  const [steamGameAchievements, setSteamGameAchievements] = useState<Record<string, { current: number, total: number }>>({});
  const [isSteamLoaded, setIsSteamLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [steamIntegrationEnabled, setSteamIntegrationEnabled] = useState(false);
  const [steamAchievementSource, setSteamAchievementSource] = useState<'steamworks' | 'steamapi'>('steamworks');
  const steamUnlistenRef = useRef<(() => void) | null>(null);
  const isRefreshingLocalGamesRef = useRef(false);

  const getLocalAchievementCounts = (game: GameAchievements) => ({
    current: game.achievements.filter((a: any) => a.achieved).length,
    total: game.achievements.length,
  });

  const mergeSteamAndLocalCounts = (
    localCurrent: number,
    localTotal: number,
    steamCurrent?: number,
    steamTotal?: number,
  ) => ({
    current: Math.max(localCurrent, steamCurrent ?? 0),
    total: Math.max(localTotal, steamTotal ?? 0),
  });

  // Detect duplicates and filter unique games
  useEffect(() => {
    const gameMap = new Map<string, GameAchievements[]>();
    allGames.forEach(game => {
      if (!gameMap.has(game.gameId)) {
        gameMap.set(game.gameId, []);
      }
      gameMap.get(game.gameId)!.push(game);
    });

    const uniqueGames: GameAchievements[] = [];
    const duplicates: DuplicateGameInfo[] = [];

    gameMap.forEach((gameEntries, gameId) => {
      if (gameEntries.length === 1) {
        uniqueGames.push(gameEntries[0]);
      } else {
        const gameName = gameNames[gameId] || gameId;
        const dirInfo = gameEntries.map(game => ({
          path: game.directory,
          name: game.directory.split(/[/\\]/).pop() || game.directory,
          game,
        }));
        duplicates.push({
          gameId,
          gameName,
          directories: dirInfo,
        });
        // For now, add the most recent one to unique games
        const mostRecent = gameEntries.reduce((prev, current) =>
          prev.lastModified > current.lastModified ? prev : current
        );
        uniqueGames.push(mostRecent);
      }
    });

    console.log('[JS] Processing allGames, unique count:', uniqueGames.length);
    setGames(uniqueGames);
    setDuplicateGames(duplicates);
  }, [allGames, gameNames]);

  const setupListener = async () => {
    const unlisten = await onAchievementsUpdate((updatedGames: GameAchievements[]) => {
      setAllGames(prev => {
        if (isRefreshingLocalGamesRef.current && updatedGames.length === 0 && prev.length > 0) {
          console.log('[JS] Ignoring transient empty achievements update during active refresh');
          return prev;
        }

        const currJson = JSON.stringify(prev);
        const nextJson = JSON.stringify(updatedGames);
        if (currJson === nextJson) return prev;

        console.log('[JS] Received achievements update from Rust (content changed):', updatedGames.length, 'games');
        return updatedGames;
      });
    });
    return unlisten;
  };

  const fetchInitial = async () => {
    isRefreshingLocalGamesRef.current = true;
    try {
      const gamesResult = await requestAchievements();
      if (Array.isArray(gamesResult)) {
        console.log('[JS] Games received from confirmed request:', gamesResult.length);
        setAllGames(gamesResult);
      }
    } catch (error) {
      console.error('[JS] Failed to refresh local achievements; keeping previous games:', error);
    } finally {
      isRefreshingLocalGamesRef.current = false;
    }
  };

  const setupSteam = async () => {
    if (!steamIntegrationEnabled) {
      console.log('[Steam Integration] Disabled in settings');
      setIsSteamLoaded(false);
      setSteamGames([]);
      if (steamUnlistenRef.current) {
        steamUnlistenRef.current();
        steamUnlistenRef.current = null;
      }
      return null;
    }

    const available = await isSteamAvailable();
    if (available) {
      console.log('[Steam Integration] Enabled and available');
      const initialSteamGames = await getSteamGames();
      setSteamGames(initialSteamGames);
      setIsSteamLoaded(true);

      if (!steamUnlistenRef.current) {
        const unlisten = await onSteamGamesUpdate((updated: any[]) => {
          setSteamGames(updated);
        });
        steamUnlistenRef.current = unlisten;
      }
      return steamUnlistenRef.current;
    } else {
      console.log('[Steam Integration] Enabled but Steam not available');
      setIsSteamLoaded(false);
    }
    return null;
  };

  useEffect(() => {
    console.log('Setting up achievements listener');
    setIsLoading(true);
    const unlistenPromise = setupListener();
    
    Promise.all([fetchInitial(), setupSteam()]).then(() => {
      setIsLoading(false);
    });

    // Listen for manual achievement updates (from unlock command)
    const achievementsUnlistenPromise = onAchievementsUpdated(() => {
      console.log('[Achievements Update] Received update event, refreshing data...');
      if (steamIntegrationEnabled) {
        getSteamGames().then(updated => {
          setSteamGames(updated);
        });
      }
      fetchInitial();
    });

    return () => {
      unlistenPromise.then(u => u());
      achievementsUnlistenPromise.then(u => u());
      if (steamUnlistenRef.current) {
        steamUnlistenRef.current();
        steamUnlistenRef.current = null;
      }
    };
  }, [steamIntegrationEnabled]);

  // Retry Steam auto-connect when integration is enabled but Steam starts after app launch.
  useEffect(() => {
    if (!steamIntegrationEnabled || isSteamLoaded) return;

    const timer = setInterval(async () => {
      try {
        const available = await isSteamAvailable();
        if (!available) return;
        await setupSteam();
      } catch (error) {
        console.error('[Steam Integration] Auto-retry failed:', error);
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [steamIntegrationEnabled, isSteamLoaded]);

  useEffect(() => {
    const loadSteamIntegrationSetting = async () => {
      try {
        if ((window as any).electronAPI) {
          const loadedSettings = await (window as any).electronAPI.loadSettings();
          if (loadedSettings && loadedSettings.steamIntegrationEnabled !== undefined) {
            console.log('[Steam Integration] Loading setting:', loadedSettings.steamIntegrationEnabled);
            setSteamIntegrationEnabled(loadedSettings.steamIntegrationEnabled);
          }
          if (loadedSettings?.steamAchievementSource) {
            setSteamAchievementSource(loadedSettings.steamAchievementSource === 'api' ? 'steamapi' : loadedSettings.steamAchievementSource);
            setSteamGameAchievements({});
          }
        }
      } catch (error) {
        console.error('Error loading Steam integration setting:', error);
      }
    };

    loadSteamIntegrationSetting();

    const handleSettingsChange = () => {
      console.log('[Steam Integration] Settings changed, reloading...');
      loadSteamIntegrationSetting();
    };

    window.addEventListener('settings-saved', handleSettingsChange);

    return () => {
      window.removeEventListener('settings-saved', handleSettingsChange);
    };
  }, [steamIntegrationEnabled]);

  useEffect(() => {
    if (!steamIntegrationEnabled) {
      setSteamGames([]);
      setSteamGameAchievements({});
      setIsSteamLoaded(false);
    }
  }, [steamIntegrationEnabled]);

  useEffect(() => {
    const fetchNames = async () => {
      if (allGames.length > 0) {
        const missingIds = allGames
          .map(g => g.gameId)
          .filter(id => !gameNames[id]);

        if (missingIds.length === 0) return;

        try {
          const names = await getGameNames(missingIds);
          setGameNames(prev => ({ ...prev, ...names }));
        } catch (error) {
          console.error('Error fetching game names:', error);
        }
      }
    };

    fetchNames();
  }, [allGames]);

  // Fetch achievements from API for recent games
  useEffect(() => {
    const fetchAchievementsFromAPI = async () => {
      if (games.length > 0) {
        const recentGameIds = [...games]
          .sort((a, b) => {
            const timeA = typeof a.lastModified === 'number' ? a.lastModified * 1000 : new Date(a.lastModified).getTime();
            const timeB = typeof b.lastModified === 'number' ? b.lastModified * 1000 : new Date(b.lastModified).getTime();
            return timeB - timeA;
          })
          .slice(0, 10)
          .map(g => g.gameId);
        const achievementsToFetch: Record<string, number> = {};

        for (const gameId of recentGameIds) {
          if (!gameAchievementsFromAPI[gameId]) {
            try {
              const gameAchievements = await getGameAchievements(gameId);
              achievementsToFetch[gameId] = gameAchievements.achievements.length;
            } catch (error) {
              console.error(`Error fetching achievements for game ${gameId}:`, error);
              achievementsToFetch[gameId] = 0;
            }
          }
        }

        if (Object.keys(achievementsToFetch).length > 0) {
          setGameAchievementsFromAPI(prev => ({ ...prev, ...achievementsToFetch }));
        }
      }
    };

    fetchAchievementsFromAPI();
  }, [games, gameAchievementsFromAPI]);

  // Fetch achievements for Steam games separately
  useEffect(() => {
    const fetchSteamGameAchievements = async () => {
      if (steamGames.length > 0) {
        // Only fetch for games we haven't fetched yet
        const gamesToFetch = steamGames.filter(g => !steamGameAchievements[g.gameId]);

        if (gamesToFetch.length === 0) return;

        // Fetch in parallel
        await Promise.all(gamesToFetch.map(async (game) => {
          try {
            const gameAchievements = (await getAchievementsForGameSource(game.gameId, true)).achievements;
            const currentCount = gameAchievements.filter((a: any) => a.achieved).length;

            setSteamGameAchievements(prev => ({
              ...prev,
              [game.gameId]: {
                current: currentCount,
                total: gameAchievements.length
              }
            }));
          } catch (error) {
            console.error(`Error fetching Steam achievements for game ${game.gameId}:`, error);
          }
        }));
      }
    };

    fetchSteamGameAchievements();
  }, [steamGames, steamAchievementSource]); // No 'steamGameAchievements' dependency to avoid infinite loop if we update state inside

  const openDirectorySelection = (gameId: string) => {
    const duplicate = duplicateGames.find(d => d.gameId === gameId);
    if (duplicate) {
      setSelectedDuplicateGame(duplicate);
      setIsDirectorySelectionOpen(true);
    }
  };

  // Update selectedDuplicateGame when duplicateGames changes while modal is open
  useEffect(() => {
    if (isDirectorySelectionOpen && selectedDuplicateGame) {
      const updatedDuplicate = duplicateGames.find(d => d.gameId === selectedDuplicateGame.gameId);
      if (updatedDuplicate) {
        setSelectedDuplicateGame(updatedDuplicate);
      }
    }
  }, [duplicateGames, isDirectorySelectionOpen, selectedDuplicateGame]);

  const closeDirectorySelection = () => {
    setIsDirectorySelectionOpen(false);
    setSelectedDuplicateGame(null);
  };

  const selectDirectory = (directoryPath: string, onGameSelected?: (game: GameAchievements) => void) => {
    if (selectedDuplicateGame) {
      // Filter to keep only the selected directory's game
      const selectedGame = selectedDuplicateGame.directories.find(d => d.path === directoryPath)?.game;
      if (selectedGame) {
        // Remove all versions of this game and add only the selected one
        const filteredGames = games.filter(g => g.gameId !== selectedDuplicateGame.gameId);
        setGames([...filteredGames, selectedGame]);

        // Call the callback to handle navigation
        if (onGameSelected) {
          onGameSelected(selectedGame);
        }
      }
    }
    closeDirectorySelection();
  };

  const manuallyUpdateGame = (
    gameId: string,
    newStatuses: { name: string, completed: boolean }[],
    updateSteamStats: boolean = true
  ) => {
    console.log('[Context] Manually updating game', gameId, newStatuses.length);

    // Update Hydra games
    setAllGames(prev => {
      const gameIndex = prev.findIndex(g => g.gameId === gameId);
      if (gameIndex === -1) return prev; // Not found in allGames

      const updatedGame = { ...prev[gameIndex] };
      updatedGame.achievements = updatedGame.achievements.map(ach => {
        // Try to find status update by internal name or display name
        const status = newStatuses.find(s =>
          s.name.toLowerCase() === (ach.name || '').toLowerCase() ||
          s.name.toLowerCase() === ((ach as any).displayName || '').toLowerCase()
        );

        if (status) {
          return { ...ach, achieved: status.completed };
        }
        return ach;
      });

      const newGames = [...prev];
      newGames[gameIndex] = updatedGame;
      return newGames;
    });

    // Update Steam games stats if applicable
    const steamGame = steamGames.find(g => g.gameId === gameId);
    if (steamGame && updateSteamStats) {
      // Calculate new counts
      // This is tricky because we only have the *updates*, not the full state unless we assume newStatuses covers relevant ones
      // Use the 'steamGameAchievements' to get current total
      const currentStats = steamGameAchievements[gameId] || { current: 0, total: 0 };

      // We can't perfectly update Steam stats without full state, but we can try
      // For now, let's just trigger a re-fetch of steam stats specifically for this game
      // Or if we trust `newStatuses` represents 'unlocked' ones? No, it might be partial.

      // Best we can do is update the local cache if we had full list. 
      // In App.tsx, 'allAchievements' is passed. 

      // If we receive a comprehensive list, we can count.
      const unlockedCount = newStatuses.filter(s => s.completed).length;

      // Only update if we are sure we have the full picture, or just update blindly
      setSteamGameAchievements(prev => ({
        ...prev,
        [gameId]: {
          current: unlockedCount,
          total: currentStats.total > 0 ? currentStats.total : newStatuses.length
        }
      }));
    }
  };

  const mergedGames = useMemo(() => {
    // Cria um mapa dos jogos Hydra existentes
    const hydraIds = new Set(games.map(g => g.gameId));

    // Converte jogos Steam para o formato unificado
    const steamMapped = steamGames.map(sg => {
      const stats = steamGameAchievements[sg.gameId];
      return {
        gameId: sg.gameId,
        name: sg.name,
        achievements: [], // Vazio inicialmente
        lastModified: Date.now(),
        directory: 'steam://',
        source: 'steam',
        achievementsCurrent: stats ? Math.max(stats.current, sg.achievementsCurrent) : sg.achievementsCurrent,
        achievementsTotal: stats ? Math.max(stats.total, sg.achievementsTotal) : sg.achievementsTotal
      };
    });

    // Marca jogos que existem nas duas fontes como "both"
    const steamById = new Map(steamMapped.map((sg) => [sg.gameId, sg]));
    const mergedHydra = games.map((g) => {
      const steam = steamById.get(g.gameId);
      if (!steam) return g;
      const localCounts = getLocalAchievementCounts(g);
      const mergedCounts = mergeSteamAndLocalCounts(
        localCounts.current,
        localCounts.total,
        steam.achievementsCurrent,
        steam.achievementsTotal,
      );
      return {
        ...g,
        source: 'both',
        achievementsCurrent: mergedCounts.current,
        achievementsTotal: mergedCounts.total,
        steamAchievementsCurrent: steam.achievementsCurrent,
        steamAchievementsTotal: steam.achievementsTotal,
      };
    });

    // Steam-only games (not present in local/Hydra list)
    const uniqueSteam = steamMapped.filter(sg => !hydraIds.has(sg.gameId));

    const combined = [...mergedHydra, ...uniqueSteam];

    // Hide games with no unlockable achievements when the preference is enabled.
    return combined.filter((g: any) => {
      const source = g.source;
      const steamTotal = Number(g.achievementsTotal || 0);
      const localTotal = Array.isArray(g.achievements) ? g.achievements.length : 0;
      const hasAchievements = Math.max(steamTotal, localTotal) > 0;

      if (!hideSteamGamesWithoutAchievements) return true;
      if (source === 'steam') return steamTotal > 0;
      if (source === 'both') return hasAchievements;
      return localTotal > 0;
    });
  }, [games, steamGames, steamGameAchievements, isSteamLoaded, hideSteamGamesWithoutAchievements]);

  const recentGames = useMemo(() => {
    const sorted = [...mergedGames].sort((a: any, b: any) => {
      const timeA = typeof a.lastModified === 'number' ? a.lastModified * 1000 : new Date(a.lastModified).getTime();
      const timeB = typeof b.lastModified === 'number' ? b.lastModified * 1000 : new Date(b.lastModified).getTime();
      return timeB - timeA;
    });

    return sorted.slice(0, 10).map((game: any) => {
      const source = game.source;
      const isSteam = source === 'steam' || source === 'both';
      const localCounts = getLocalAchievementCounts(game);
      const achievementsCurrent = isSteam
        ? Math.max(localCounts.current, Number(game.achievementsCurrent || 0))
        : localCounts.current;
      const achievementsTotal = isSteam
        ? Math.max(localCounts.total, Number(game.achievementsTotal || 0))
        : localCounts.total;

      return {
        gameId: game.gameId,
        name: gameNames[game.gameId] || game.name || game.gameId,
        directory: game.directory || (source === 'steam' ? 'steam://' : ''),
        achievementsCurrent,
        achievementsTotal,
        achievementsTotalFromAPI: gameAchievementsFromAPI[game.gameId] || null,
        lastModified: game.lastModified,
        source,
      };
    });
  }, [mergedGames, gameNames, gameAchievementsFromAPI]);

  return (
    <MonitoredAchievementsContext.Provider value={{
      games: mergedGames,
      recentGames,
      duplicateGames,
      gameNames,
      isLoading,
      isDirectorySelectionOpen,
      selectedDuplicateGame,
      openDirectorySelection,
      closeDirectorySelection,
      selectDirectory,
      manuallyUpdateGame,
      forceRefresh: fetchInitial
    }}>
      {children}
    </MonitoredAchievementsContext.Provider>
  );
};
