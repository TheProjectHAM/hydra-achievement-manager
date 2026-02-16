import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import TitleBar from './components/TitleBar';
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
import { unlockAchievements, reloadAchievements, getSteamLibraryInfo, getAchievementIniLastModified } from './tauri-api';
import ToastContainer, { ToastItemData } from './components/ToastContainer';
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import packageJson from './package.json';

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
  const [toasts, setToasts] = useState<ToastItemData[]>([]);
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

  const closeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback((toast: Omit<ToastItemData, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
  }, []);

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
          pushToast({
            title: t('settings.updates.updateAvailable'),
            message: `${t('settings.updates.currentVersion').replace('{version}', latestLabel)}. ${t('settings.updates.description')}`,
            durationMs: 5000,
            type: 'update',
          });
        } else {
          pushToast({
            title: t('settings.updates.systemUpToDate'),
            message: t('settings.updates.upToDate'),
            durationMs: 3200,
            type: 'success',
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
  }, [pushToast, t]);

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

          // Skip empty timestamps
          if (!timestamp.day || !timestamp.month || !timestamp.year ||
            !timestamp.hour || !timestamp.minute) {
            return;
          }

          // Convert timestamps based on timeFormat
          if (timeFormat === '12h' && !timestamp.ampm) {
            hasChanges = true;
            const date = new Date(parseInt(timestamp.year), parseInt(timestamp.month) - 1, parseInt(timestamp.day), parseInt(timestamp.hour), parseInt(timestamp.minute));
            updated[sourceKey][achievementName] = {
              ...status,
              timestamp: {
                ...timestamp,
                hour: format(date, 'hh'),
                ampm: format(date, 'aa').toUpperCase() as 'AM' | 'PM',
              },
            };
          } else if (timeFormat === '24h' && timestamp.ampm) {
            hasChanges = true;
            let hour24 = parseInt(timestamp.hour);
            if (timestamp.ampm === 'PM' && hour24 < 12) hour24 += 12;
            else if (timestamp.ampm === 'AM' && hour24 === 12) hour24 = 0;

            const { ampm, ...timestampWithout } = timestamp;
            updated[sourceKey][achievementName] = {
              ...status,
              timestamp: {
                ...timestampWithout,
                hour: String(hour24).padStart(2, '0'),
              },
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

  const handleAchievementToggle = (gameId: number, achievementName: string, sourcePath?: string | null) => {
    setAchievementStatus(prev => {
      const resolvedSourcePath = sourcePath !== undefined
        ? sourcePath
        : (selectedGame?.id === gameId ? selectedGameSourcePath : null);
      const sourceKey = getStatusSourceKey(gameId, resolvedSourcePath);
      const gameStatuses = prev[sourceKey] || {};
      const currentStatus = gameStatuses[achievementName];
      const newCompletedState = !currentStatus?.completed;

      return {
        ...prev,
        [sourceKey]: {
          ...gameStatuses,
          [achievementName]: {
            ...(currentStatus || { timestamp: { day: '', month: '', year: '', hour: '', minute: '' } }),
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
            timestamp: { day: '', month: '', year: '', hour: '', minute: '' },
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
    const unlockSourcePath = isSteam ? 'steam://' : path;

    // Helper function to generate timestamp based on mode
    const generateTimestamp = (): Timestamp => {
      const date = mode === 'current' ? new Date() : (
        mode === 'custom' ? new Date() : // fallback
          new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000)
      );

      return {
        day: format(date, 'dd'),
        month: format(date, 'MM'),
        year: format(date, 'yyyy'),
        hour: format(date, timeFormat === '12h' ? 'hh' : 'HH'),
        minute: format(date, 'mm'),
        ...(timeFormat === '12h' && { ampm: format(date, 'aa').toUpperCase() as 'AM' | 'PM' })
      };
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
      ? allAchievements.map(ach => {
        const status = gameStatuses[ach.internalName] || { completed: false, timestamp: { day: '', month: '', year: '', hour: '', minute: '' } };
        const hasEmptyTimestamp = !status.timestamp.day && !status.timestamp.month &&
          !status.timestamp.year && !status.timestamp.hour && !status.timestamp.minute;

        return {
          name: ach.internalName,
          completed: status.completed,
          timestamp: (status.completed && hasEmptyTimestamp) ? generateTimestamp() : status.timestamp,
        };
      })
      : Object.entries(gameStatuses)
        .filter(([, status]: [string, AchievementStatus]) => status.completed) // Only include completed achievements for non-steam
        .map(([name, status]: [string, AchievementStatus]) => {
          // Check if timestamp is empty (all fields are empty strings)
          const hasEmptyTimestamp = !status.timestamp.day && !status.timestamp.month &&
            !status.timestamp.year && !status.timestamp.hour && !status.timestamp.minute;

          return {
            name,
            completed: status.completed,
            timestamp: hasEmptyTimestamp ? generateTimestamp() : status.timestamp,
          };
        });

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

      // Reload achievements data from the saved file
      try {
        const result = await reloadAchievements(gameId, path);

        // Convert parsed achievements to achievementStatus format
        const newAchievementStatus: Record<string, AchievementStatus> = {};

        result.achievements.forEach((ach: any) => {
          if (ach.achieved) {
            // Convert Unix timestamp to date components
            const unlockDate = new Date(ach.unlockTime * 1000);
            const timestamp: Timestamp = {
              day: format(unlockDate, 'dd'),
              month: format(unlockDate, 'MM'),
              year: format(unlockDate, 'yyyy'),
              hour: format(unlockDate, timeFormat === '12h' ? 'hh' : 'HH'),
              minute: format(unlockDate, 'mm'),
              ...(timeFormat === '12h' && { ampm: format(unlockDate, 'aa').toUpperCase() as 'AM' | 'PM' }),
            };

            newAchievementStatus[ach.name] = {
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
      // Revert optimistic update by refreshing from backend
      forceRefresh();
    }
  };


  const handleGameSelect = (game: SteamSearchResult) => {
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
      achievementCount: (selectedSourceGameMerged as any)?.achievementsCurrent || 0,
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
    return <div className="w-screen h-screen bg-[var(--bg-color)]" />;
  }

  if (showWizard) {
    return (
      <>
        <InitialWizard onFinish={() => {
          setShowWizard(false);
          localStorage.setItem('wizardCompleted', 'true');
        }} />
        <ToastContainer toasts={toasts} onClose={closeToast} />
      </>
    );
  }

  return (
    <div className="w-screen h-screen overflow-hidden text-[var(--text-main)] flex flex-col">
      <TitleBar />
      <div
        className="flex flex-1 overflow-hidden"
        style={{
          backgroundColor: 'var(--bg-color)',
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
      />
      <ToastContainer toasts={toasts} onClose={closeToast} />
    </div>
  );
};

export default App;
