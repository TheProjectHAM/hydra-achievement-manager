import React, { useState, useEffect, useCallback } from 'react';
import TitleBar from './components/TitleBar';
import Sidebar from './components/Sidebar';
import { TABS } from './constants';
import { SteamSearchResult, Achievement, AchievementStatus, Timestamp, TimeFormat } from './types';
import SearchContent from './components/SearchContent';
import { UnlockMode } from './components/GlobalTimestampManager';
import SettingsContent from './components/SettingsContent';
import DirectorySelectionModal from './components/DirectorySelectionModal';
import { useTheme } from './contexts/ThemeContext';
import { useI18n } from './contexts/I18nContext';
import { useMonitoredAchievements } from './contexts/MonitoredAchievementsContext';
import GamesContent from './pages/Games';
import AchievementsContent from './pages/Achievements';
import ExportPage from './pages/Export';
import InitialWizard from './pages/InitialWizard';

type View = 'main' | 'export';

const MIN_SIDEBAR_WIDTH = 80;
const MAX_SIDEBAR_WIDTH = 500;
const SNAP_THRESHOLD = 120;

const App: React.FC = () => {
  const [activeTabId, setActiveTabId] = useState<string>('jogos');
  const [selectedGame, setSelectedGame] = useState<SteamSearchResult | null>(null);
  const [achievementStatus, setAchievementStatus] = useState<Record<number, Record<string, AchievementStatus>>>({});
  const [currentView, setCurrentView] = useState<View>('main');
  const [showWizard, setShowWizard] = useState(() => {
    // Checa se já foi configurado antes (exemplo: localStorage)
    return !localStorage.getItem('wizardCompleted');
  });
  
  const { timeFormat, sidebarWidth, setSidebarWidth } = useTheme();
  const { isDirectorySelectionOpen, selectedDuplicateGame, closeDirectorySelection, selectDirectory, duplicateGames, openDirectorySelection, gameNames } = useMonitoredAchievements();
  const [isResizing, setIsResizing] = useState(false);

  const isSidebarCollapsed = sidebarWidth <= MIN_SIDEBAR_WIDTH;

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
  
  const handleAchievementToggle = (gameId: number, achievementName:string) => {
    setAchievementStatus(prev => {
        const gameStatuses = prev[gameId] || {};
        const currentStatus = gameStatuses[achievementName];
        const newCompletedState = !currentStatus?.completed;

        return {
            ...prev,
            [gameId]: {
                ...gameStatuses,
                [achievementName]: {
                    ...(currentStatus || { timestamp: { day: '', month: '', year: '', hour: '', minute: '' } }),
                    completed: newCompletedState,
                },
            },
        };
    });
  };

  const handleTimestampChange = (gameId: number, achievementName: string, field: keyof Timestamp, value: string) => {
    setAchievementStatus(prev => {
        const gameStatuses = prev[gameId] || {};
        const currentStatus = gameStatuses[achievementName];

        if (!currentStatus) return prev;

        return {
            ...prev,
            [gameId]: {
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

  const handleTimestampClear = (gameId: number, achievementName: string) => {
    setAchievementStatus(prev => {
        const gameStatuses = prev[gameId] || {};
        const currentStatus = gameStatuses[achievementName];

        if (!currentStatus) return prev;

        return {
            ...prev,
            [gameId]: {
                ...gameStatuses,
                [achievementName]: {
                    ...currentStatus,
                    timestamp: { day: '', month: '', year: '', hour: '', minute: '' },
                },
            },
        };
    });
  };

  const handleAchievementStatusUpdate = (gameId: number, achievementName: string, status: AchievementStatus) => {
    setAchievementStatus(prev => ({
        ...prev,
        [gameId]: {
            ...(prev[gameId] || {}),
            [achievementName]: status,
        },
    }));
  };

  const handleGlobalUnlock = async (mode: UnlockMode, customTimestamp: Timestamp | null, path: string) => {
    if (!selectedGame) return;
    const gameId = selectedGame.id.toString();

    // Helper function to generate timestamp based on mode
    const generateTimestamp = (): Timestamp => {
      switch (mode) {
        case 'current': {
          const now = new Date();
          const timestamp: Timestamp = {
            day: String(now.getDate()).padStart(2, '0'),
            month: String(now.getMonth() + 1).padStart(2, '0'),
            year: String(now.getFullYear()),
            minute: String(now.getMinutes()).padStart(2, '0'),
            hour: '',
          };
          if (timeFormat === '12h') {
            const hour12 = now.getHours() % 12 || 12;
            timestamp.hour = String(hour12).padStart(2, '0');
            timestamp.ampm = now.getHours() >= 12 ? 'PM' : 'AM';
          } else {
            timestamp.hour = String(now.getHours()).padStart(2, '0');
          }
          return timestamp;
        }
        case 'custom':
          return customTimestamp || { day: '', month: '', year: '', hour: '', minute: '' };
        case 'random':
        default: {
          // Generate random date within last 30 days
          const now = new Date();
          const randomDays = Math.floor(Math.random() * 30);
          const randomDate = new Date(now.getTime() - randomDays * 24 * 60 * 60 * 1000);

          const timestamp: Timestamp = {
            day: String(randomDate.getDate()).padStart(2, '0'),
            month: String(randomDate.getMonth() + 1).padStart(2, '0'),
            year: String(randomDate.getFullYear()),
            minute: String(randomDate.getMinutes()).padStart(2, '0'),
            hour: '',
          };
          if (timeFormat === '12h') {
            const hour12 = randomDate.getHours() % 12 || 12;
            timestamp.hour = String(hour12).padStart(2, '0');
            timestamp.ampm = randomDate.getHours() >= 12 ? 'PM' : 'AM';
          } else {
            timestamp.hour = String(randomDate.getHours()).padStart(2, '0');
          }
          return timestamp;
        }
      }
    };

    // Prepare achievements data
    const gameStatuses = achievementStatus[selectedGame.id] || {};
    const achievements = Object.entries(gameStatuses)
      .filter(([, status]: [string, AchievementStatus]) => status.completed) // Only include completed achievements
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
      // Call the IPC to unlock achievements
      await (window as any).electronAPI.unlockAchievements({
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
        const result = await (window as any).electronAPI.reloadAchievements(gameId, path);

        // Convert parsed achievements to achievementStatus format
        const newAchievementStatus: Record<string, AchievementStatus> = {};

        result.achievements.forEach((ach: any) => {
          if (ach.achieved) {
            // Convert Unix timestamp to date components
            const unlockDate = new Date(ach.unlockTime * 1000);
            let hour = String(unlockDate.getHours()).padStart(2, '0');
            let ampm: 'AM' | 'PM' | undefined;

            if (timeFormat === '12h') {
              const hour24 = unlockDate.getHours();
              const hour12 = hour24 % 12 || 12;
              hour = String(hour12).padStart(2, '0');
              ampm = hour24 >= 12 ? 'PM' : 'AM';
            }

            const timestamp: Timestamp = {
              day: String(unlockDate.getDate()).padStart(2, '0'),
              month: String(unlockDate.getMonth() + 1).padStart(2, '0'),
              year: String(unlockDate.getFullYear()),
              hour: hour,
              minute: String(unlockDate.getMinutes()).padStart(2, '0'),
              ...(ampm && { ampm }),
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
          [selectedGame.id]: newAchievementStatus,
        }));

        console.log('Achievement status reloaded from saved file');
      } catch (error) {
        console.error('Error reloading achievements after unlock:', error);
      }
    } catch (error) {
      console.error('Error unlocking achievements:', error);
    }
  };


  const handleGameSelect = (game: SteamSearchResult) => {
    // Check if this game has duplicates
    const duplicate = duplicateGames.find(d => d.gameId === game.id.toString());
    if (duplicate) {
      // Show directory selection modal
      openDirectorySelection(game.id.toString());
    } else {
      // No duplicates, proceed normally
      setSelectedGame(game);
      setActiveTabId('conquistas');
      setCurrentView('main');
    }
  };

  const handleSetActiveTab = (id: string) => {
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
                  game={selectedGame}
                  achievementStatus={achievementStatus}
                  onAchievementToggle={handleAchievementToggle}
                  onTimestampChange={handleTimestampChange}
                  onTimestampClear={handleTimestampClear}
                  onGlobalUnlock={handleGlobalUnlock}
                  onExportStart={handleExportStart}
                  onAchievementStatusUpdate={handleAchievementStatusUpdate}
                />;
      case 'configuracoes':
        return <SettingsContent />;
      default:
        return null;
    }
  };

  const isLayoutManaged = ['pesquisar', 'conquistas', 'configuracoes'].includes(activeTabId);

  if (showWizard) {
    return (
      <InitialWizard onFinish={() => {
        setShowWizard(false);
        localStorage.setItem('wizardCompleted', 'true');
      }} />
    );
  }

  return (
    <div className="w-screen h-screen text-gray-900 dark:text-white font-sans overflow-hidden">
      <TitleBar />
      <div className="flex h-full pt-10 bg-gray-50 dark:bg-black bg-[radial-gradient(circle_at_1px_1px,#00000010_1px,transparent_0)] dark:bg-[radial-gradient(circle_at_1px_1px,#ffffff15_1px,transparent_0)] [background-size:24px_24px]">
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
          <div className={currentView === 'main' && isLayoutManaged ? 'h-full p-8' : (currentView === 'main' ? 'p-8' : 'h-full')}>
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
        isOpen={isDirectorySelectionOpen}
        onClose={closeDirectorySelection}
        onSelect={(directoryPath) => selectDirectory(directoryPath, (selectedGame) => {
          setSelectedGame({ id: parseInt(selectedGame.gameId), name: gameNames[selectedGame.gameId] || selectedGame.gameId, achievementsTotal: selectedGame.achievements.length });
          setActiveTabId('conquistas');
          setCurrentView('main');
        })}
        gameName={selectedDuplicateGame?.gameName || ''}
        directories={selectedDuplicateGame?.directories.map(d => ({
          path: d.path,
          name: d.name,
          achievementCount: d.game.achievements.length,
          lastModified: d.game.lastModified
        })) || []}
      />
    </div>
  );
};

export default App;
