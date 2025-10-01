import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { GameAchievements } from '../utils/steam-achievements';

interface RecentGame {
  gameId: string;
  name: string;
  achievementsCurrent: number;
  achievementsTotal: number;
  achievementsTotalFromAPI: number | null;
  lastModified: Date;
}

interface DuplicateGameInfo {
  gameId: string;
  gameName: string;
  directories: Array<{ path: string; name: string; game: GameAchievements }>;
}

interface MonitoredAchievementsContextType {
  games: GameAchievements[];
  recentGames: RecentGame[];
  duplicateGames: DuplicateGameInfo[];
  gameNames: Record<string, string>;
  isDirectorySelectionOpen: boolean;
  selectedDuplicateGame: DuplicateGameInfo | null;
  openDirectorySelection: (gameId: string) => void;
  closeDirectorySelection: () => void;
  selectDirectory: (directoryPath: string, onGameSelected?: (game: GameAchievements) => void) => void;
}

const MonitoredAchievementsContext = createContext<MonitoredAchievementsContextType>({
  games: [],
  recentGames: [],
});

export const useMonitoredAchievements = () => useContext(MonitoredAchievementsContext);

export const MonitoredAchievementsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [allGames, setAllGames] = useState<GameAchievements[]>([]);
  const [games, setGames] = useState<GameAchievements[]>([]);
  const [gameNames, setGameNames] = useState<Record<string, string>>({});
  const [gameAchievementsFromAPI, setGameAchievementsFromAPI] = useState<Record<string, number>>({});
  const [duplicateGames, setDuplicateGames] = useState<DuplicateGameInfo[]>([]);
  const [isDirectorySelectionOpen, setIsDirectorySelectionOpen] = useState(false);
  const [selectedDuplicateGame, setSelectedDuplicateGame] = useState<DuplicateGameInfo | null>(null);

  const recentGames = useMemo(() => {
    const sorted = [...games].sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
    const top10 = sorted.slice(0, 10);
    return top10.map(game => ({
      gameId: game.gameId,
      name: gameNames[game.gameId] || game.gameId,
      achievementsCurrent: game.achievements.filter(a => a.achieved).length,
      achievementsTotal: game.achievements.length,
      achievementsTotalFromAPI: gameAchievementsFromAPI[game.gameId] || null,
      lastModified: game.lastModified,
    }));
  }, [games, gameNames, gameAchievementsFromAPI]);

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

    setGames(uniqueGames);
    setDuplicateGames(duplicates);
  }, [allGames, gameNames]);

  useEffect(() => {
    if ((window as any).electronAPI) {
      console.log('Setting up achievements listener');
      (window as any).electronAPI.onAchievementsUpdate((updatedGames: GameAchievements[]) => {
        console.log('Received achievements update:', updatedGames);
        setAllGames(updatedGames);
      });

      // Request initial achievements
      (window as any).electronAPI.requestAchievements();
    } else {
      console.log('electronAPI not available');
    }
  }, []);

  useEffect(() => {
    const fetchNames = async () => {
      if ((window as any).electronAPI && allGames.length > 0) {
        const gameIds = allGames.map(g => g.gameId);
        try {
          const names = await (window as any).electronAPI.getGameNames(gameIds);
          setGameNames(names);
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
      if ((window as any).electronAPI && games.length > 0) {
        const recentGameIds = recentGames.map(g => g.gameId);
        const achievementsToFetch: Record<string, number> = {};

        for (const gameId of recentGameIds) {
          if (!gameAchievementsFromAPI[gameId]) {
            try {
              const gameAchievements = await (window as any).electronAPI.getGameAchievements(gameId);
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
  }, [games, recentGames, gameAchievementsFromAPI]);

  const openDirectorySelection = (gameId: string) => {
    const duplicate = duplicateGames.find(d => d.gameId === gameId);
    if (duplicate) {
      setSelectedDuplicateGame(duplicate);
      setIsDirectorySelectionOpen(true);
    }
  };

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

  return (
    <MonitoredAchievementsContext.Provider value={{
      games,
      recentGames,
      duplicateGames,
      gameNames,
      isDirectorySelectionOpen,
      selectedDuplicateGame,
      openDirectorySelection,
      closeDirectorySelection,
      selectDirectory
    }}>
      {children}
    </MonitoredAchievementsContext.Provider>
  );
};
