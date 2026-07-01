import React, { useState, useEffect, useCallback } from 'react';
import TitleBar from './components/TitleBar';
import WindowResizeHandles from './components/WindowResizeHandles';
import Sidebar from './components/Sidebar';
import { TABS } from './constants';
import { SteamSearchResult, Achievement, AchievementStatus, Timestamp, TimeFormat } from './types';
import SearchContent from './components/SearchContent';
import { UnlockMode } from './components/GlobalTimestampManager';
import SettingsModal from './components/SettingsModal';
import DirectorySelectionModal from './components/DirectorySelectionModal';
import { useTheme } from './contexts/ThemeContext';
import { useI18n } from './contexts/I18nContext';
import { useMonitoredAchievements } from './contexts/MonitoredAchievementsContext';
import GamesContent from './pages/Games';
import AchievementsContent from './pages/Achievements';
import ExportPage from './pages/Export';
import InitialWizard from './pages/InitialWizard';
import { awardRetroAchievement, deleteRetroAchievementUnlock, unlockAchievements, reloadAchievements, getAchievementsForGameSource, getSteamLibraryInfo, getAchievementIniLastModified, loadSettings } from './tauri-api';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import packageJson from '../package.json';
import {
  convertTimestampTimeFormat,
  dateToTimestamp,
  emptyTimestamp,
  isTimestampEmpty,
  unixSecondsToTimestamp,
} from './formatters';

type View = 'main' | 'export';

const MIN_SIDEBAR_WIDTH = 80;
const MAX_SIDEBAR_WIDTH = 500;
const SNAP_THRESHOLD = 120;
const ACHIEVEMENT_STATUS_CACHE_KEY = 'achievement_status_cache_v1';
const UPDATES_URL =
  import.meta.env.VITE_UPDATES_URL ||
  "https://raw.githubusercontent.com/Levynsk/hydra-achievement-manager/refs/heads/main/updates.json";

interface UpdateEntry {
  version: string;
  subVersion?: string;
}

const App: React.FC = () => {
  const [activeTabId, setActiveTabId] = useState<string>('jogos');
  const [selectedGame, setSelectedGame] = useState<SteamSearchResult | null>(null);
  const [selectedGameSourcePath, setSelectedGameSourcePath] = useState<string | null>(null);
  const [achievementStatus, setAchievementStatus] = useState<Record<string, Record<string, AchievementStatus>>>({});
  const [currentView, setCurrentView] = useState<View>('main');
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [showWizard, setShowWizard] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { t } = useI18n();

  useEffect(() => {
    const checkWizardStatus = async () => {
      try {
        if ((window as any).electronAPI) {
          const settings = await (window as any).electronAPI.loadSettings();
          if (settings.wizardCompleted || localStorage.getItem('wizardCompleted')) {
            setShowWizard(false);
          }
        } else if (localStorage.getItem('wizardCompleted')) {
          setShowWizard(false);
        }
      } catch (error) {
        console.error('Error loading settings for wizard:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkWizardStatus();
  }, []);

  const getErrorMessage = (error: unknown): string => {
    if (typeof error === 'string') return error;
    if (error && typeof error === 'object' && 'message' in error) {
      const msg = (error as { message?: unknown }).message;
      return typeof msg === 'string' ? msg : String(msg ?? '');
    }
    return String(error ?? '');
  };

  const parseSemver = (version: string): [number, number, number] => {
    const [major = '0', minor = '0', patch = '0'] = version.split('.');
    return [Number(major) || 0, Number(minor) || 0, Number(patch) || 0];
  };

  const parseDateTag = (tag?: string): number => {
    if (!tag) return 0;
    const digits = tag.replace(/\D/g, '');
    return Number(digits) || 0;
  };

  const compareUpdates = (a: UpdateEntry, b: UpdateEntry): number => {
    const [aMaj, aMin, aPat] = parseSemver(a.version);
    const [bMaj, bMin, bPat] = parseSemver(b.version);
    if (aMaj !== bMaj) return aMaj - bMaj;
    if (aMin !== bMin) return aMin - bMin;
    if (aPat !== bPat) return aPat - bPat;
    return parseDateTag(a.subVersion) - parseDateTag(b.subVersion);
  };

  useEffect(() => {
    let cancelled = false;

    const checkForUpdatesOnStartup = async () => {
      try {
        const response = await tauriFetch(UPDATES_URL, { method: 'GET' });
        const data = await response.json() as { updates?: UpdateEntry[] };
        const updates = data?.updates || [];
        if (!updates.length || cancelled) return;

        const latest = [...updates].sort(compareUpdates).at(-1);
        if (!latest) return;

        const current: UpdateEntry = {
          version: packageJson.version,
          subVersion: (packageJson as any).versionDateTag || '',
        };

        if (compareUpdates(latest, current) > 0) {
          const latestLabel = `v${latest.version}${latest.subVersion ? ` ${latest.subVersion}` : ''}`;
          toast(t('settings.updates.updateAvailable'), {
            description: `${t('settings.updates.currentVersion').replace('{version}', latestLabel)}. ${t('settings.updates.description')}`,
            duration: 5000,
          });
        } else {
          toast(t('settings.updates.systemUpToDate'), {
            description: t('settings.updates.upToDate'),
            duration: 3200,
          });
        }
      } catch (error) {
        console.warn('Startup update check failed:', error);
      }
    };

    checkForUpdatesOnStartup();
    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ACHIEVEMENT_STATUS_CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        setAchievementStatus(parsed as Record<string, Record<string, AchievementStatus>>);
      }
    } catch (error) {
      console.warn('Failed to load achievement status cache:', error);
    }
  }, []);

  const { timeFormat, sidebarWidth, setSidebarWidth } = useTheme();
  const { games, closeDirectorySelection, selectDirectory, duplicateGames, openDirectorySelection, gameNames, manuallyUpdateGame, forceRefresh } = useMonitoredAchievements();
  const [isResizing, setIsResizing] = useState(false);
  const [isSourceSelectionOpen, setIsSourceSelectionOpen] = useState(false);
  const [sourceSelectionGame, setSourceSelectionGame] = useState<SteamSearchResult | null>(null);
  const [steamVdfPath, setSteamVdfPath] = useState<string | null>(null);
  const [sourceIniLastModifiedByPath, setSourceIniLastModifiedByPath] = useState<Record<string, Date | null>>({});

  const isSidebarCollapsed = sidebarWidth <= MIN_SIDEBAR_WIDTH;

  useEffect(() => {
    const loadSteamVdfPath = async () => {
      try {
        const info = await getSteamLibraryInfo();
        setSteamVdfPath(info?.vdfPath ?? null);
      } catch {
        setSteamVdfPath(null);
      }
    };
    loadSteamVdfPath();
  }, []);

  useEffect(() => {
    if (!isSourceSelectionOpen || !sourceSelectionGame) {
      setSourceIniLastModifiedByPath({});
      return;
    }

    const gameId = sourceSelectionGame.id.toString();
    const duplicate = duplicateGames.find(d => d.gameId === gameId);
    const mergedGame = games.find(g => g.gameId === gameId);
    const singleLocalPath =
      mergedGame &&
      (mergedGame as any).directory &&
      (mergedGame as any).directory !== 'steam://' &&
      !duplicate
        ? (mergedGame as any).directory as string
        : null;

    const localPaths = [
      ...(duplicate?.directories.map(d => d.path) || []),
      ...(singleLocalPath ? [singleLocalPath] : [])
    ];

    if (localPaths.length === 0) return;

    let cancelled = false;
    Promise.all(
      localPaths.map(async (path) => {
        try {
          const ts = await getAchievementIniLastModified(gameId, path);
          return [path, ts ? new Date(ts * 1000) : null] as const;
        } catch {
          return [path, null] as const;
        }
      })
    ).then((entries) => {
      if (cancelled) return;
      const map: Record<string, Date | null> = {};
      for (const [path, date] of entries) map[path] = date;
      setSourceIniLastModifiedByPath(map);
    });

    return () => {
      cancelled = true;
    };
  }, [isSourceSelectionOpen, sourceSelectionGame, duplicateGames, games]);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const handleResizing = useCallback((e: MouseEvent) => {
    if (isResizing) {
      const newWidth = e.clientX;
      const clampedWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(newWidth, MAX_SIDEBAR_WIDTH));
      setSidebarWidth(clampedWidth);
    }
  }, [isResizing, setSidebarWidth]);

  const handleResizeEnd = useCallback(() => {
    if (isResizing) {
      if (sidebarWidth < SNAP_THRESHOLD) {
        setSidebarWidth(MIN_SIDEBAR_WIDTH);
      }
      setIsResizing(false);
    }
  }, [isResizing, sidebarWidth, setSidebarWidth]);

  useEffect(() => {
    if (isResizing) {
      document.body.classList.add('resizing');
      window.addEventListener('mousemove', handleResizing);
      window.addEventListener('mouseup', handleResizeEnd);
    } else {
      document.body.classList.remove('resizing');
    }

    return () => {
      window.removeEventListener('mousemove', handleResizing);
      window.removeEventListener('mouseup', handleResizeEnd);
      document.body.classList.remove('resizing');
    };
  }, [isResizing, handleResizing, handleResizeEnd]);

  useEffect(() => {
    try {
      localStorage.setItem(ACHIEVEMENT_STATUS_CACHE_KEY, JSON.stringify(achievementStatus));
    } catch (error) {
      console.warn('Failed to save achievement status cache:', error);
    }
  }, [achievementStatus]);

  // Convert timestamps when time format changes
  useEffect(() => {
    setAchievementStatus(prev => {
      const updated = { ...prev };
      let hasChanges = false;

      // Iterate through all source buckets and achievements
      Object.entries(updated).forEach(([sourceKey, gameStatuses]) => {
        Object.entries(gameStatuses).forEach(([achievementName, status]) => {
          const timestamp = status.timestamp;

          if (isTimestampEmpty(timestamp)) {
            return;
          }

          if ((timeFormat === '12h' && !timestamp.ampm) || (timeFormat === '24h' && timestamp.ampm)) {
            const convertedTimestamp = convertTimestampTimeFormat(timestamp, timeFormat);
            if (convertedTimestamp === timestamp) return;
            hasChanges = true;
            updated[sourceKey][achievementName] = {
              ...status,
              timestamp: convertedTimestamp,
            };
          }
        });
      });

      return hasChanges ? updated : prev;
    });
  }, [timeFormat]);

  const getStatusSourceKey = useCallback((gameId: number | string, sourcePath?: string | null) => {
    return `${gameId}::${sourcePath || 'auto'}`;
  }, []);

  const handleAchievementToggle = async (gameId: number, achievementName: string, sourcePath?: string | null) => {
    const resolvedSourcePath = sourcePath !== undefined
      ? sourcePath
      : (selectedGame?.id === gameId ? selectedGameSourcePath : null);
    const sourceKey = getStatusSourceKey(gameId, resolvedSourcePath);
    const currentStatus = achievementStatus[sourceKey]?.[achievementName];

    if (resolvedSourcePath?.startsWith('retroachievements://') && currentStatus?.completed) {
      try {
        const achievementId = Number(achievementName);
        if (!Number.isFinite(achievementId) || achievementId <= 0) {
          throw new Error(`Invalid RetroAchievements achievement id: ${achievementName}`);
        }
        await deleteRetroAchievementUnlock(achievementId);
        toast.success('RetroAchievements unlock removed', {
          description: `Achievement ${achievementName} was reset on RetroAchievements.`,
          duration: 4000,
        });
      } catch (error) {
        console.error('Error deleting RetroAchievements unlock:', error);
        toast.error('RetroAchievements reset failed', {
          description: getErrorMessage(error),
          duration: 8000,
        });
        return;
      }
    }

    setAchievementStatus(prev => {
      const gameStatuses = prev[sourceKey] || {};
      const status = gameStatuses[achievementName];
      const newCompletedState = !status?.completed;

      return {
        ...prev,
        [sourceKey]: {
          ...gameStatuses,
          [achievementName]: {
            ...(status || { timestamp: emptyTimestamp() }),
            completed: newCompletedState,
          },
        },
      };
    });
  };

  const handleTimestampChange = (
    gameId: number,
    achievementName: string,
    field: keyof Timestamp,
    value: string,
    sourcePath?: string | null
  ) => {
    setAchievementStatus(prev => {
      const resolvedSourcePath = sourcePath !== undefined
        ? sourcePath
        : (selectedGame?.id === gameId ? selectedGameSourcePath : null);
      const sourceKey = getStatusSourceKey(gameId, resolvedSourcePath);
      const gameStatuses = prev[sourceKey] || {};
      const currentStatus = gameStatuses[achievementName];

      if (!currentStatus) return prev;

      return {
        ...prev,
        [sourceKey]: {
          ...gameStatuses,
          [achievementName]: {
            ...currentStatus,
            timestamp: {
              ...currentStatus.timestamp,
              [field]: value,
            },
          },
        },
      };
    });
  };

  const handleTimestampClear = (gameId: number, achievementName: string, sourcePath?: string | null) => {
    setAchievementStatus(prev => {
      const resolvedSourcePath = sourcePath !== undefined
        ? sourcePath
        : (selectedGame?.id === gameId ? selectedGameSourcePath : null);
      const sourceKey = getStatusSourceKey(gameId, resolvedSourcePath);
      const gameStatuses = prev[sourceKey] || {};
      const currentStatus = gameStatuses[achievementName];

      if (!currentStatus) return prev;

      return {
        ...prev,
        [sourceKey]: {
          ...gameStatuses,
          [achievementName]: {
            ...currentStatus,
            timestamp: emptyTimestamp(),
          },
        },
      };
    });
  };

  const handleAchievementStatusUpdate = (
    gameId: number,
    achievementName: string,
    status: AchievementStatus,
    sourcePath?: string | null
  ) => {
    const resolvedSourcePath = sourcePath !== undefined
      ? sourcePath
      : (selectedGame?.id === gameId ? selectedGameSourcePath : null);
    const sourceKey = getStatusSourceKey(gameId, resolvedSourcePath);
    setAchievementStatus(prev => ({
      ...prev,
      [sourceKey]: {
        ...(prev[sourceKey] || {}),
        [achievementName]: status,
      },
    }));
  };

  const resetGameAchievementStatus = (gameId: number, sourcePath?: string | null) => {
    setAchievementStatus(prev => {
      const next = { ...prev };
      if (sourcePath !== undefined) {
        delete next[getStatusSourceKey(gameId, sourcePath)];
        return next;
      }

      const prefix = `${gameId}::`;
      Object.keys(next).forEach((k) => {
        if (k.startsWith(prefix)) delete next[k];
      });
      return next;
    });
  };

  const handleGlobalUnlock = async (mode: UnlockMode, customTimestamp: Timestamp | null, path: string, allAchievements?: Achievement[]) => {
    if (!selectedGame) return;
    const gameId = selectedGame.id.toString();
    const isSteam = path.startsWith('steam://');
    const isRetroAchievements = path.startsWith('retroachievements://');
    const unlockSourcePath = isSteam ? 'steam://' : path;

    const generateTimestamp = (): Timestamp => {
      const date = mode === 'current' ? new Date() : (
        mode === 'custom' ? new Date() : // fallback
          new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000)
      );

      return dateToTimestamp(date, timeFormat);
    };

    // Prepare achievements data.
    // When a game has no existing achievements.ini, selections are often tracked under
    // the "auto" source key until a concrete path is chosen in the unlock modal.
    // Fallback order prevents empty unlock payloads in that first-write scenario.
    const statusCandidates = [
      getStatusSourceKey(selectedGame.id, unlockSourcePath),
      getStatusSourceKey(selectedGame.id, selectedGameSourcePath),
      getStatusSourceKey(selectedGame.id, null),
    ];
    const gameStatuses =
      statusCandidates
        .map((key) => achievementStatus[key])
        .find((bucket) => bucket && Object.keys(bucket).length > 0) || {};

    const achievements = (isSteam && allAchievements)
      ? allAchievements.flatMap(ach => {
        const status = gameStatuses[ach.internalName];
        if (!status) return [];
        const hasEmptyTimestamp = isTimestampEmpty(status.timestamp);

        return [{
          name: ach.internalName,
          completed: status.completed,
          timestamp: (status.completed && hasEmptyTimestamp) ? generateTimestamp() : status.timestamp,
        }];
      })
      : Object.entries(gameStatuses)
        .filter(([, status]: [string, AchievementStatus]) => status.completed) // Only include completed achievements for non-steam
        .map(([name, status]: [string, AchievementStatus]) => {
          const hasEmptyTimestamp = isTimestampEmpty(status.timestamp);

          return {
            name,
            completed: status.completed,
            timestamp: hasEmptyTimestamp ? generateTimestamp() : status.timestamp,
          };
        });
    const unlockedCount = achievements.filter((a) => a.completed).length;

    if (isRetroAchievements) {
      if (unlockedCount === 0) {
        toast.error('No RetroAchievements selected', {
          description: 'Select at least one locked achievement to unlock.',
          duration: 4000,
        });
        return;
      }

      try {
        const settings = await loadSettings();
        const username = String(settings?.retroAchievementsUsername || '').trim();
        const runtimeToken = String(settings?.retroAchievementsRuntimeToken || '').trim();

        if (!username || !runtimeToken) {
          toast.error(t('unlockToasts.retroRuntimeLoginRequiredTitle'), {
            description: t('unlockToasts.retroRuntimeLoginRequiredMessage'),
            duration: 6000,
          });
          return;
        }

        const unlocked: Array<{ name: string; completed: boolean }> = [];
        for (const achievement of achievements.filter((achievement) => achievement.completed)) {
          const achievementId = Number(achievement.name);
          if (!Number.isFinite(achievementId) || achievementId <= 0) {
            throw new Error(`Invalid RetroAchievements achievement id: ${achievement.name}`);
          }

          await awardRetroAchievement({
            username,
            runtimeToken,
            achievementId,
            hardcore: false,
            gameHash: null,
          });
          unlocked.push({ name: achievement.name, completed: true });
        }

        manuallyUpdateGame(gameId, unlocked, false);
        toast.success('RetroAchievements unlocked', {
          description: `Unlocked ${unlocked.length} achievement${unlocked.length === 1 ? '' : 's'} in softcore mode.`,
          duration: 4000,
        });

        const result = await getAchievementsForGameSource(gameId, false, true);
        const newAchievementStatus: Record<string, AchievementStatus> = {};
        result.achievements.forEach((ach: any) => {
          if (ach.unlocked) {
            const unlockTime = Number(ach.unlockTime ?? 0);
            newAchievementStatus[ach.id] = {
              completed: true,
              timestamp: unixSecondsToTimestamp(unlockTime, timeFormat),
            };
          }
        });

        setAchievementStatus(prev => ({
          ...prev,
          [getStatusSourceKey(selectedGame.id, unlockSourcePath)]: newAchievementStatus,
        }));
      } catch (error) {
        console.error('Error unlocking RetroAchievements:', error);
        toast.error('RetroAchievements unlock failed', {
          description: getErrorMessage(error),
          duration: 8000,
        });
      }
      return;
    }

    try {
      // Optimistic update: instantly update local state
      manuallyUpdateGame(
        gameId,
        achievements.map(a => ({ name: a.name, completed: a.completed })),
        isSteam
      );

      // Call the IPC to unlock achievements
      await unlockAchievements({
        gameId,
        selectedPath: path,
        achievements,
        mode,
        customTimestamp,
        timeFormat,
      });

      console.log('Achievements unlocked successfully');
      toast.success(t('unlockToasts.successTitle'), {
        description: t('unlockToasts.successMessage', { count: unlockedCount }),
        duration: 3000,
      });

      // Reload achievements data from the saved file or Steamworks.
      try {
        const result = isSteam
          ? await getAchievementsForGameSource(gameId, true)
          : await reloadAchievements(gameId, path);

        // Convert parsed achievements to achievementStatus format
        const newAchievementStatus: Record<string, AchievementStatus> = {};

        result.achievements.forEach((ach: any) => {
          if (ach.achieved) {
            const unlockTime = Number(ach.unlockTime ?? ach.unlocktime ?? 0);
            const timestamp = unixSecondsToTimestamp(unlockTime, timeFormat);

            newAchievementStatus[ach.apiname || ach.name] = {
              completed: true,
              timestamp: timestamp,
            };
          }
        });

        // Update the achievement status state
        setAchievementStatus(prev => ({
          ...prev,
          [getStatusSourceKey(selectedGame.id, unlockSourcePath)]: newAchievementStatus,
        }));

        console.log('Achievement status reloaded from saved file');
      } catch (error) {
        console.error('Error reloading achievements after unlock:', error);
      }
    } catch (error) {
      console.error('Error unlocking achievements:', error);
      const errorMessage = getErrorMessage(error);
      const looksLikeSteamError = isSteam || /steam/i.test(errorMessage);
      toast.error(
        looksLikeSteamError
          ? t('unlockToasts.steamErrorTitle')
          : t('unlockToasts.errorTitle'),
        {
          description: looksLikeSteamError
            ? t('unlockToasts.steamErrorMessage')
            : t('unlockToasts.errorMessage'),
          duration: 5000,
        }
      );
      // Revert optimistic update by refreshing from backend
      forceRefresh();
    }
  };


  const handleGameSelect = (game: SteamSearchResult) => {
    if ((game as any).source === 'retroachievements') {
      setSelectedGameSourcePath('retroachievements://');
      setSelectedGame(game);
      setActiveTabId('conquistas');
      setCurrentView('main');
      return;
    }

    const duplicate = duplicateGames.find(d => d.gameId === game.id.toString());
    const mergedGame = games.find(g => g.gameId === game.id.toString());
    const hasBothSources = (mergedGame as any)?.source === 'both';
    const isSteamOnly = (mergedGame as any)?.source === 'steam';
    const singleLocalPath =
      mergedGame &&
      (mergedGame as any).directory &&
      (mergedGame as any).directory !== 'steam://'
        ? String((mergedGame as any).directory)
        : null;

    if (duplicate || hasBothSources) {
      if (duplicate) {
        openDirectorySelection(game.id.toString());
      }
      setSourceSelectionGame(game);
      setIsSourceSelectionOpen(true);
    } else {
      // Preserve Steam source cache/status in-memory because Steam Web API can lag.
      if (!isSteamOnly) {
        resetGameAchievementStatus(game.id, singleLocalPath);
      }
      // Auto-select the only available source when modal is not required.
      // Steam-only -> steam:// ; Local-only -> concrete directory path.
      if (isSteamOnly) {
        setSelectedGameSourcePath('steam://');
      } else {
        setSelectedGameSourcePath(singleLocalPath);
      }
      setSelectedGame(game);
      setActiveTabId('conquistas');
      setCurrentView('main');
    }
  };

  const handleSourceSelection = (selectedPath: string) => {
    if (!sourceSelectionGame) return;

    const duplicate = duplicateGames.find(d => d.gameId === sourceSelectionGame.id.toString());
    const pickedSource = sourceSelectionDirectories.find(d => d.path === selectedPath)?.source;
    if (pickedSource === 'steam') {
      closeDirectorySelection();
      setIsSourceSelectionOpen(false);
      setSelectedGameSourcePath('steam://');
      setSelectedGame(sourceSelectionGame);
      setActiveTabId('conquistas');
      setCurrentView('main');
      return;
    }

    if (duplicate) {
      // Keep existing behavior for multiple local INIs.
      setIsSourceSelectionOpen(false);
      selectDirectory(selectedPath, (selectedGame) => {
        resetGameAchievementStatus(parseInt(selectedGame.gameId), selectedPath);
        setSelectedGameSourcePath(selectedPath);
        setSelectedGame({
          id: parseInt(selectedGame.gameId),
          name: gameNames[selectedGame.gameId] || selectedGame.gameId,
          achievementsTotal: selectedGame.achievements.length
        });
        setActiveTabId('conquistas');
        setCurrentView('main');
      });
      return;
    }

    // Single local source + steam
    setIsSourceSelectionOpen(false);
    resetGameAchievementStatus(sourceSelectionGame.id, selectedPath);
    setSelectedGameSourcePath(selectedPath);
    setSelectedGame(sourceSelectionGame);
    setActiveTabId('conquistas');
    setCurrentView('main');
  };

  const handleCloseSourceSelection = () => {
    setIsSourceSelectionOpen(false);
    setSourceSelectionGame(null);
    setSelectedGameSourcePath(null);
    closeDirectorySelection();
  };

  const selectedSourceGameMerged = sourceSelectionGame
    ? games.find(g => g.gameId === sourceSelectionGame.id.toString())
    : undefined;
  const selectedSourceDuplicate = sourceSelectionGame
    ? duplicateGames.find(d => d.gameId === sourceSelectionGame.id.toString())
    : undefined;
  const singleLocalPath =
    selectedSourceGameMerged &&
    (selectedSourceGameMerged as any).directory &&
    (selectedSourceGameMerged as any).directory !== 'steam://' &&
    !selectedSourceDuplicate
      ? (selectedSourceGameMerged as any).directory as string
      : null;
  const selectedSourceSteamUnlocked = Number(
    (selectedSourceGameMerged as any)?.steamAchievementsCurrent ??
    (selectedSourceGameMerged as any)?.achievementsCurrent ??
    0
  );
  const sourceSelectionDirectories = [
    ...((selectedSourceDuplicate?.directories || []).map(d => ({
      path: d.path,
      name: d.name,
      achievementCount: d.game.achievements.filter(a => a.achieved).length,
      lastModified: sourceIniLastModifiedByPath[d.path] ?? new Date(d.game.lastModified),
      source: 'local' as const
    }))),
    ...(singleLocalPath ? [{
      path: singleLocalPath,
      name: singleLocalPath.split(/[/\\]/).pop() || singleLocalPath,
      achievementCount: ((selectedSourceGameMerged as any)?.achievements || []).filter((a: any) => a.achieved).length,
      lastModified: sourceIniLastModifiedByPath[singleLocalPath] ?? new Date((selectedSourceGameMerged as any)?.lastModified || Date.now()),
      source: 'local' as const
    }] : []),
    ...(((selectedSourceGameMerged as any)?.source === 'both' ? [{
      path: steamVdfPath || 'libraryfolders.vdf',
      name: 'Steam',
      achievementCount: selectedSourceSteamUnlocked,
      lastModified: new Date(),
      source: 'steam' as const
    }] : []))
  ];

  const achievementStatusForView = React.useMemo(() => {
    if (!selectedGame) return {};
    const sourceKey = getStatusSourceKey(selectedGame.id, selectedGameSourcePath);
    return {
      [selectedGame.id]: achievementStatus[sourceKey] || {}
    };
  }, [selectedGame, selectedGameSourcePath, achievementStatus, getStatusSourceKey]);

  const handleSetActiveTab = (id: string) => {
    if (id === 'configuracoes') {
      setIsSettingsModalOpen(true);
      return;
    }
    if (id !== 'conquistas' && selectedGame) {
      // Keep selectedGame so user can go back
    }
    setActiveTabId(id);
  }

  const handleExportStart = () => {
    if (selectedGame) {
      setCurrentView('export');
    }
  };

  const handleExportFinish = () => {
    setCurrentView('main');
  };

  const renderContent = () => {
    switch (activeTabId) {
      case 'jogos':
        return <GamesContent onGameSelect={handleGameSelect} />;
      case 'pesquisar':
        return <SearchContent onGameSelect={handleGameSelect} />;
      case 'conquistas':
        return <AchievementsContent
          key={`${selectedGame?.id ?? 'none'}:${selectedGameSourcePath ?? 'auto'}`}
          game={selectedGame}
          preferredSourcePath={selectedGameSourcePath}
          achievementStatus={achievementStatusForView}
          onAchievementToggle={handleAchievementToggle}
          onTimestampChange={handleTimestampChange}
          onTimestampClear={handleTimestampClear}
          onGlobalUnlock={handleGlobalUnlock}
          onExportStart={handleExportStart}
          onAchievementStatusUpdate={handleAchievementStatusUpdate}
        />;
      default:
        return null;
    }
  };

  const isLayoutManaged = ['jogos', 'pesquisar', 'conquistas'].includes(activeTabId);

  if (isLoading) {
    return <div className="w-screen h-screen bg-background" />;
  }

  if (showWizard) {
    return (
      <>
        <InitialWizard onFinish={() => {
          setShowWizard(false);
          localStorage.setItem('wizardCompleted', 'true');
        }} />
        <Toaster />
      </>
    );
  }

  return (
    <div className="w-screen h-screen overflow-hidden text-foreground flex flex-col">
      <WindowResizeHandles />
      <TitleBar />
      <div
        className="flex flex-1 overflow-hidden bg-background"
        style={{
          backgroundImage: 'var(--bg-gradient, none)',
          backgroundAttachment: 'fixed',
          backgroundSize: 'cover'
        }}
      >
        {currentView === 'main' && (
          <Sidebar
            tabs={TABS}
            activeTab={activeTabId}
            setActiveTab={handleSetActiveTab}
            isCollapsed={isSidebarCollapsed}
            width={sidebarWidth}
            onResizeStart={handleResizeStart}
            onGameSelect={handleGameSelect}
            selectedGameId={selectedGame?.id}
          />
        )}
        <main
          className={`flex-1 transition-all duration-300 ${currentView === 'export' ? 'ml-0' : ''} ${currentView === 'export' || isLayoutManaged ? 'overflow-hidden' : 'overflow-y-auto'} ${activeTabId === 'jogos' ? 'no-scrollbar' : ''}`}
          style={{ marginLeft: currentView === 'main' ? sidebarWidth : 0 }}
        >
          <div className={currentView === 'main' && isLayoutManaged ? 'h-full px-8 py-4' : (currentView === 'main' ? 'px-8 py-4' : 'h-full')}>
            {currentView === 'export' && selectedGame ? (
              <ExportPage
                game={selectedGame}
                onFinish={handleExportFinish}
              />
            ) : (
              renderContent()
            )}
          </div>
        </main>
      </div>

      <DirectorySelectionModal
        isOpen={isSourceSelectionOpen}
        onClose={handleCloseSourceSelection}
        onSelect={handleSourceSelection}
        gameName={sourceSelectionGame?.name || selectedSourceDuplicate?.gameName || ''}
        directories={sourceSelectionDirectories}
      />
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        onNotifyToast={(toastData) => {
          if (toastData.type === 'success') {
            toast.success(toastData.title, { description: toastData.message, duration: toastData.durationMs || 3000 });
          } else {
            toast(toastData.title, { description: toastData.message, duration: toastData.durationMs || 3000 });
          }
        }}
      />
      <Toaster />
    </div>
  );
};

export default App;
