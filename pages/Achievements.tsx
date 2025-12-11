import React, { useState, useEffect, useMemo, useRef, useLayoutEffect, useCallback } from 'react';
import { SteamSearchResult, Achievement, AchievementStatus, Timestamp } from '../types';
import { TrophyIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, ExportIcon, LockIcon, SearchIcon } from '../components/Icons';
import TimestampSelector from '../components/TimestampSelector';
import GlobalTimestampManager, { UnlockMode } from '../components/GlobalTimestampManager';
import { useTheme } from '../contexts/ThemeContext';
import { useI18n } from '../contexts/I18nContext';
import { useMonitoredAchievements } from '../contexts/MonitoredAchievementsContext';
import UnlockModal from '../components/UnlockModal';

const AchievementCard: React.FC<{
  achievement: Achievement;
  status: AchievementStatus;
  onToggle: () => void;
  onTimestampChange: (field: keyof Timestamp, value: string) => void;
  onTimestampClear: () => void;
}> = ({ achievement, status, onToggle, onTimestampChange, onTimestampClear }) => {
  const isCompleted = status.completed;
  const { dateFormat, timeFormat, theme } = useTheme();
  const { t } = useI18n();

  const cardClasses = `
      bg-white dark:bg-[#141415] rounded-lg p-4 flex flex-col gap-4 transition-all hover:bg-gray-50 dark:hover:bg-[#1a1a1b] relative cursor-pointer h-39 border border-gray-200 dark:border-white/5
      ${isCompleted ? 'opacity-100' : 'opacity-60 dark:opacity-50 hover:opacity-100'}
    `;

  const handleSetCurrentTimestamp = () => {
    if (!isCompleted) return;
    const now = new Date();
    onTimestampChange('day', String(now.getDate()).padStart(2, '0'));
    onTimestampChange('month', String(now.getMonth() + 1).padStart(2, '0'));
    onTimestampChange('year', String(now.getFullYear()));
    onTimestampChange('minute', String(now.getMinutes()).padStart(2, '0'));

    if (timeFormat === '12h') {
      const hour12 = now.getHours() % 12 || 12;
      onTimestampChange('hour', String(hour12).padStart(2, '0'));
      onTimestampChange('ampm', now.getHours() >= 12 ? 'PM' : 'AM');
    } else {
      onTimestampChange('hour', String(now.getHours()).padStart(2, '0'));
    }
  };

  return (
    <div className={`${cardClasses.trim()} achievement-card`} onClick={onToggle}>
      <div className="flex items-start gap-4 w-full flex-grow">
        <img src={achievement.icon} alt={achievement.displayName} className="w-16 h-16 rounded-md object-cover flex-shrink-0" />
        <div className="flex-grow min-w-0">
          <h3 className="font-bold text-gray-900 dark:text-white text-md">{achievement.displayName}</h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1 line-clamp-2">
            {achievement.description || t('achievementsPage.noDescription')}
          </p>
        </div>
        <div
          className={`absolute top-3 right-3 w-6 h-6 rounded-md flex items-center justify-center border transition-colors z-10 ${isCompleted
              ? theme === 'dark'
                ? 'bg-white border-white'
                : 'bg-black border-black'
              : theme === 'dark'
                ? 'bg-black/30 border-white/20 group-hover:border-white/50'
                : 'bg-gray-200 border-gray-300 group-hover:border-gray-400'
            }`}
          aria-label={t(isCompleted ? 'achievementsPage.markAsNotCompleted' : 'achievementsPage.markAsCompleted')}
          aria-pressed={isCompleted}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        >
          {isCompleted && <CheckIcon className={`text-base ${theme === 'dark' ? 'text-black' : 'text-white'}`} />}
        </div>
      </div>
      <TimestampSelector
        timestamp={status.timestamp}
        onChange={onTimestampChange}
        onClear={onTimestampClear}
        onSetCurrent={handleSetCurrentTimestamp}
        disabled={!isCompleted}
        dateFormat={dateFormat}
        timeFormat={timeFormat}
      />
    </div>
  );
};

interface AchievementsContentProps {
  game: SteamSearchResult | null;
  achievementStatus: Record<number, Record<string, AchievementStatus>>;
  onAchievementToggle: (gameId: number, achievementName: string) => void;
  onTimestampChange: (gameId: number, achievementName: string, field: keyof Timestamp, value: string) => void;
  onTimestampClear: (gameId: number, achievementName: string) => void;
  onGlobalUnlock: (mode: UnlockMode, customTimestamp: Timestamp | null, path: string) => void;
  onExportStart: () => void;
  onAchievementStatusUpdate: (gameId: number, achievementName: string, status: AchievementStatus) => void;
}

const AchievementsContent: React.FC<AchievementsContentProps> = ({
  game, achievementStatus, onAchievementToggle, onTimestampChange, onTimestampClear, onGlobalUnlock, onExportStart, onAchievementStatusUpdate
}) => {
  const { t } = useI18n();
  const { games: monitoredGames } = useMonitoredAchievements();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [unlockMode, setUnlockMode] = useState<UnlockMode>('current');
  const [customTimestamp, setCustomTimestamp] = useState<Timestamp>({ day: '', month: '', year: '', hour: '', minute: '' });
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false);
  const [gameAchievements, setGameAchievements] = useState<Achievement[]>([]);
  const [loadingAchievements, setLoadingAchievements] = useState(false);
  const { timeFormat } = useTheme();
  const [achievementsPerPage, setAchievementsPerPage] = useState(12);
  const containerRef = useRef<HTMLDivElement>(null);

  const updatePerPage = useCallback(() => {
    if (!game || !containerRef.current) return;

    const container = containerRef.current;
    const containerHeight = container.clientHeight;
    if (containerHeight <= 0) return;

    const firstCard = container.querySelector('.achievement-card') as HTMLElement;
    if (!firstCard) return;

    const cardHeight = firstCard.offsetHeight;
    const gap = 16; // gap-4 = 1rem
    const rowHeight = cardHeight + gap;
    const availableRows = Math.floor((containerHeight + gap) / rowHeight);

    let cols = 1;
    if (window.matchMedia('(min-width: 768px)').matches) cols = 2;
    if (window.matchMedia('(min-width: 1280px)').matches) cols = 3;
    if (window.matchMedia('(min-width: 1536px)').matches) cols = 4;

    const newPerPage = availableRows * cols;
    setAchievementsPerPage(Math.max(newPerPage, 1));
  }, [game]);

  const hasSelected = game ? Object.values(achievementStatus[game.id] || {}).some((status: AchievementStatus) => status.completed) : false;

  const toggleAllAchievements = () => {
    if (!game) return;
    const allNames = gameAchievements.map(ach => ach.internalName);
    if (hasSelected) {
      // Unselect all
      allNames.forEach(name => {
        onAchievementStatusUpdate(game.id, name, {
          completed: false,
          timestamp: { day: '', month: '', year: '', hour: '', minute: '' }
        });
      });
    } else {
      // Select all
      allNames.forEach(name => {
        onAchievementStatusUpdate(game.id, name, {
          completed: true,
          timestamp: { day: '', month: '', year: '', hour: '', minute: '' }
        });
      });
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    setSearchQuery('');
  }, [game]);

  useEffect(() => {
    const fetchAchievements = async () => {
      if (!game) {
        setGameAchievements([]);
        return;
      }

      setLoadingAchievements(true);
      try {
        if ((window as any).electronAPI) {
          const result = await (window as any).electronAPI.getGameAchievements(game.id.toString());
          // Transform achievements based on API source
          let achievements: Achievement[] = [];
          if (result.achievements.length > 0 && result.achievements[0].apiname !== undefined) {
            // SteamAPI achievements
            achievements = result.achievements.map((ach: any) => ({
              internalName: ach.apiname,
              displayName: ach.name || ach.apiname,
              description: ach.description || '',
              icon: ach.icon || '',
            }));
          } else {
            // HydraAPI achievements
            achievements = result.achievements.map((ach: any) => ({
              internalName: ach.name,
              displayName: ach.displayName,
              description: ach.description,
              icon: ach.icon,
            }));
          }
          setGameAchievements(achievements);

          // Sync with monitored achievements - only for achievements that haven't been manually modified
          const monitoredGame = monitoredGames.find(g => g.gameId === game.id.toString());
          if (monitoredGame) {
            monitoredGame.achievements.forEach(monitoredAch => {
              if (monitoredAch.achieved) {
                // Find matching achievement by internal name (same as saved in .ini)
                let matchingAch = achievements.find(ach =>
                  ach.internalName.toLowerCase() === monitoredAch.name.toLowerCase()
                );

                // Fallback for existing .ini without prefix
                if (!matchingAch) {
                  const prefixedName = `ACHIEVEMENT_${monitoredAch.name}`;
                  matchingAch = achievements.find(ach =>
                    ach.internalName.toLowerCase() === prefixedName.toLowerCase()
                  );
                }

                if (matchingAch) {
                  // Only sync if this achievement hasn't been manually modified yet
                  const currentStatus = achievementStatus[game.id]?.[matchingAch.internalName];
                  const hasBeenModified = currentStatus && (
                    currentStatus.completed !== false ||
                    currentStatus.timestamp.day !== '' ||
                    currentStatus.timestamp.month !== '' ||
                    currentStatus.timestamp.year !== '' ||
                    currentStatus.timestamp.hour !== '' ||
                    currentStatus.timestamp.minute !== ''
                  );

                  if (!hasBeenModified) {
                    // Convert Unix timestamp to date components
                    const unlockDate = new Date(monitoredAch.unlockTime * 1000);
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

                    onAchievementStatusUpdate(game.id, matchingAch.internalName, {
                      completed: true,
                      timestamp: timestamp,
                    });
                  }
                }
              }
            });
          }
        } else {
          // Fallback for development without Electron
          setGameAchievements([]);
        }
      } catch (error) {
        console.error('Error fetching achievements:', error);
        setGameAchievements([]);
      } finally {
        setLoadingAchievements(false);
      }
    };

    fetchAchievements();
  }, [game, monitoredGames, timeFormat]);

  const achievements = gameAchievements;

  const filteredAchievements = useMemo(() => {
    if (!searchQuery.trim()) {
      return achievements;
    }
    const lowerQuery = searchQuery.toLowerCase();
    return achievements.filter(
      (ach) =>
        ach.displayName.toLowerCase().includes(lowerQuery) ||
        ach.description.toLowerCase().includes(lowerQuery)
    );
  }, [achievements, searchQuery]);

  const totalPages = Math.ceil(filteredAchievements.length / achievementsPerPage);
  const startIndex = (currentPage - 1) * achievementsPerPage;
  const currentAchievements = filteredAchievements.slice(startIndex, startIndex + achievementsPerPage);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  useLayoutEffect(() => {
    updatePerPage();

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(updatePerPage);
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [updatePerPage]);

  useEffect(() => {
    const handleResize = () => {
      requestAnimationFrame(updatePerPage);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updatePerPage]);

  const handleUnlockConfirm = (path: string) => {
    console.log(`Unlocking achievements to path: ${path}`);
    onGlobalUnlock(unlockMode, customTimestamp, path);
    setIsUnlockModalOpen(false);
  };

  if (!game) {
    return (
      <div className="text-center h-full flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold mb-2">{t('achievementsPage.title')}</h1>
        <p className="text-gray-500">{t('achievementsPage.selectGamePrompt')}</p>
      </div>
    );
  }

  const defaultStatus: AchievementStatus = {
    completed: false,
    timestamp: { day: '', month: '', year: '', hour: '', minute: '' },
  };

  const paginationButtonClasses = "flex items-center justify-center w-10 h-10 bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-[#1a1a1b] dark:text-gray-400 dark:hover:bg-[#232325] rounded-lg border border-gray-300 dark:border-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const actionButtonClasses = "flex items-center gap-2 h-10 px-4 text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-[#1a1a1b] dark:text-gray-400 dark:hover:bg-[#232325] transition-colors";

  return (
    <>
      <UnlockModal
        isOpen={isUnlockModalOpen}
        onClose={() => setIsUnlockModalOpen(false)}
        onConfirm={handleUnlockConfirm}
        game={game}
        newAchievementCount={Object.values(achievementStatus[game.id] || {}).filter((status: AchievementStatus) => status.completed).length}
      />
      <div className="flex flex-col h-full">
        <header className="flex-shrink-0 flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white truncate" title={game.name}>
              {t('achievementsPage.achievementsFor', { gameName: game.name })}
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {t('achievementsPage.achievementsCount', { count: filteredAchievements.length })}
            </p>
          </div>
          <div className="flex items-center gap-2 w-full">
            <button
              onClick={toggleAllAchievements}
              className="flex items-center justify-center gap-2 h-10 w-40 text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-[#1a1a1b] dark:text-gray-400 dark:hover:bg-[#232325] transition-colors rounded-lg"
            >
              {hasSelected ? t('achievementsPage.unselectAll') : t('achievementsPage.selectAll')}
            </button>
            <div className="relative flex-1 min-w-64">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <SearchIcon className="text-xl text-gray-500" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('achievementsPage.searchPlaceholder')}
                className="w-full bg-white dark:bg-[#17171a] border border-gray-300 dark:border-white/10 rounded-lg pl-10 pr-4 py-2 text-gray-900 dark:text-gray-300 placeholder-gray-500 dark:placeholder-gray-600 focus:outline-none focus:border-sky-500 dark:focus:border-gray-600 transition-colors"
                aria-label={t('achievementsPage.searchPlaceholder')}
              />
            </div>
          </div>
        </header>

        <div className="flex-grow overflow-y-auto min-h-0 pr-2" ref={containerRef}>
          {achievements.length === 0 ? (
            <div className="flex-grow flex items-center justify-center text-gray-500 h-full">
              <p>{t('achievementsPage.noAchievements')}</p>
            </div>
          ) : filteredAchievements.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
              {currentAchievements.map((ach) => {
                const status = achievementStatus[game.id]?.[ach.internalName] ?? defaultStatus;
                return (
                  <AchievementCard
                    key={ach.internalName}
                    achievement={ach}
                    status={status}
                    onToggle={() => onAchievementToggle(game.id, ach.internalName)}
                    onTimestampChange={(field, value) => onTimestampChange(game.id, ach.internalName, field, value)}
                    onTimestampClear={() => onTimestampClear(game.id, ach.internalName)}
                  />
                )
              })}
            </div>
          ) : (
            <div className="text-center h-full flex flex-col items-center justify-center -mt-16">
              <div className="inline-flex bg-gray-200 dark:bg-white/5 p-4 rounded-full mb-4 text-5xl text-gray-800 dark:text-white 
                              w-full max-w-[150px] aspect-square items-center justify-center">
                <SearchIcon />
              </div>
              <h2 className="text-xl font-bold mb-2">
                {t('achievementsPage.noResultsForQuery', { query: searchQuery })}
              </h2>
            </div>
          )}
        </div>

        {filteredAchievements.length > 0 && (
          <footer className="flex-shrink-0 relative mt-6 flex justify-between items-center">
            {/* Left Side: Timestamp Manager */}
            <GlobalTimestampManager
              mode={unlockMode}
              setMode={setUnlockMode}
              timestamp={customTimestamp}
              setTimestamp={setCustomTimestamp}
            />

            {/* Center: Pagination (Absolutely positioned) */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className={paginationButtonClasses}
                    aria-label="Previous Page"
                  >
                    <ChevronLeftIcon />
                  </button>
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 whitespace-nowrap px-3">
                    {t('achievementsPage.pagination', { currentPage, totalPages })}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className={paginationButtonClasses}
                    aria-label="Next Page"
                  >
                    <ChevronRightIcon />
                  </button>
                </div>
              )}
            </div>

            {/* Right Side: Action Buttons */}
            <div className="flex items-center rounded-lg overflow-hidden border border-gray-300 dark:border-white/20">
              <button
                onClick={onExportStart}
                className={`${actionButtonClasses} border-r border-gray-300 dark:border-white/20`}
                aria-label={t('globalTimestampManager.exportAchievements')}
              >
                <ExportIcon className="text-lg" />
                <span>{t('globalTimestampManager.export')}</span>
              </button>
              <button
                onClick={() => setIsUnlockModalOpen(true)}
                className={actionButtonClasses}
                aria-label={t('globalTimestampManager.unlockSelectedAchievements')}
              >
                <LockIcon className="text-lg" />
                <span>{t('globalTimestampManager.unlock')}</span>
              </button>
            </div>
          </footer>
        )}
      </div>
    </>
  );
};

export default AchievementsContent;