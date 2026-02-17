import React, { useState, useEffect, useMemo, useRef, useLayoutEffect, useCallback } from 'react';
import { SteamSearchResult, Achievement, AchievementStatus, Timestamp } from '../types';
import { TrophyIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, ExportIcon, LockIcon, SearchIcon } from '../components/Icons';
import TimestampSelector from '../components/TimestampSelector';
import GlobalTimestampManager, { UnlockMode } from '../components/GlobalTimestampManager';
import { useTheme } from '../contexts/ThemeContext';
import { useI18n } from '../contexts/I18nContext';
import { useMonitoredAchievements } from '../contexts/MonitoredAchievementsContext';
import UnlockModal from '../components/UnlockModal';
import { getGameAchievements } from '../tauri-api';

const AchievementCard: React.FC<{
  achievement: Achievement;
  status: AchievementStatus;
  onToggle: () => void;
  onTimestampChange: (field: keyof Timestamp, value: string) => void;
  onTimestampClear: () => void;
}> = ({ achievement, status, onToggle, onTimestampChange, onTimestampClear }) => {
  const isCompleted = status.completed;
  const { dateFormat, timeFormat, hideHiddenAchievements } = useTheme();
  const { t } = useI18n();

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

  const isHidden = hideHiddenAchievements && achievement.hidden && !isCompleted;
  const rarityColor = !achievement.percent ? 'bg-gray-500' :
    achievement.percent < 10 ? 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.4)]' :
      achievement.percent < 30 ? 'bg-purple-400' :
        'bg-blue-400';

  return (
    <div
      className={`group relative flex flex-col gap-4 p-4 rounded-md transition-all duration-300 cursor-pointer h-[155px] achievement-card overflow-hidden ${isCompleted
        ? 'shadow-xl'
        : 'hover:bg-[var(--hover-bg)]'
        }`}
      style={{ backgroundColor: 'var(--card-bg)', borderColor: 'transparent' }}
      onClick={onToggle}
    >
      {/* Hidden Overlay Effect */}
      {isHidden && (
        <div className="absolute inset-0 z-20 backdrop-blur-md bg-[var(--card-bg)]/80 flex flex-col items-center justify-center transition-opacity duration-300 opacity-100 group-hover:opacity-0" style={{ pointerEvents: 'none' }}>
          <LockIcon className="text-2xl mb-2 opacity-50" />
          <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{t('achievementsPage.hiddenAchievement')}</span>
        </div>
      )}

      {/* Rarity Bar (if steam) */}
      {achievement.percent !== undefined && achievement.percent > 0 && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-black/20">
          <div
            className={`h-full ${rarityColor}`}
            style={{ width: `${Math.max(5, achievement.percent)}%` }}
          />
        </div>
      )}
      {/* Top Right Checkbox Indicator - No Border */}
      <div
        className={`absolute top-3 right-3 w-5 h-5 rounded-sm flex items-center justify-center transition-all duration-300 z-10 ${isCompleted
          ? 'shadow-lg'
          : 'bg-[var(--hover-bg)]'
          }`}
        style={{ backgroundColor: isCompleted ? 'var(--text-main)' : 'transparent' }}
      >
        {isCompleted && <CheckIcon className="text-[10px] text-[var(--bg-color)] font-black" />}
      </div>

      <div className="flex items-start gap-4 w-full flex-grow pr-6">
        <div className="relative flex-shrink-0">
          <img
            src={achievement.icon}
            alt={achievement.displayName}
            className={`w-14 h-14 rounded-md object-cover ring-1 ring-white/10 shadow-lg transition-all duration-500 ${!isCompleted ? 'grayscale opacity-40 brightness-75' : ''}`}
          />
        </div>
        <div className="flex-grow min-w-0">
          <h3 className={`font-black text-xs uppercase tracking-tight transition-colors duration-300 ${isCompleted ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)]'} ${isHidden ? 'blur-sm group-hover:blur-0 transition-all' : ''}`}>
            {achievement.displayName}
          </h3>
          <p className={`text-[10px] font-bold leading-relaxed mt-1 line-clamp-2 uppercase tracking-wide transition-opacity duration-300 ${isCompleted ? 'opacity-80' : 'opacity-40'} ${isHidden ? 'blur-sm group-hover:blur-0 transition-all' : ''}`} style={{ color: 'var(--text-main)' }}>
            {achievement.description || t('achievementsPage.noDescription')}
          </p>

          {/* Rarity Text */}
          {achievement.percent !== undefined && achievement.percent > 0 && (
            <div className={`mt-2 text-[9px] font-black uppercase tracking-wider flex items-center gap-1 ${isHidden ? 'opacity-0 group-hover:opacity-60' : 'opacity-40'}`}>
              <span className={achievement.percent < 10 ? 'text-amber-400' : ''}>{achievement.percent.toFixed(1)}%</span>
              <span>Unlocks</span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-auto" onClick={e => e.stopPropagation()}>
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

      {/* Hover visual cue */}
      {/* Hover visual cue removed */}
    </div>
  );
};

interface AchievementsContentProps {
  game: SteamSearchResult | null;
  preferredSourcePath?: string | null;
  achievementStatus: Record<number, Record<string, AchievementStatus>>;
  onAchievementToggle: (gameId: number, achievementName: string, sourcePath?: string | null) => void;
  onTimestampChange: (gameId: number, achievementName: string, field: keyof Timestamp, value: string, sourcePath?: string | null) => void;
  onTimestampClear: (gameId: number, achievementName: string, sourcePath?: string | null) => void;
  onGlobalUnlock: (mode: UnlockMode, customTimestamp: Timestamp | null, path: string, allAchievements?: Achievement[]) => void;
  onExportStart: () => void;
  onAchievementStatusUpdate: (gameId: number, achievementName: string, status: AchievementStatus, sourcePath?: string | null) => void;
}

const AchievementsContent: React.FC<AchievementsContentProps> = ({
  game, preferredSourcePath, achievementStatus, onAchievementToggle, onTimestampChange, onTimestampClear, onGlobalUnlock, onExportStart, onAchievementStatusUpdate
}) => {
  const { t } = useI18n();
  const { games: monitoredGames } = useMonitoredAchievements();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortType, setSortType] = useState<'alphabetical' | 'unlockTime'>('alphabetical');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [unlockMode, setUnlockMode] = useState<UnlockMode>('current');
  const [customTimestamp, setCustomTimestamp] = useState<Timestamp>({ day: '', month: '', year: '', hour: '', minute: '' });
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false);
  const [gameAchievements, setGameAchievements] = useState<Achievement[]>([]);
  const [loadingAchievements, setLoadingAchievements] = useState(false);
  const { timeFormat } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const achievementsCacheRef = useRef<Record<string, Achievement[]>>({});
  const sourceStatusInitializedRef = useRef<Set<string>>(new Set());



  const hasSelected = game ? Object.values(achievementStatus[game.id] || {}).some((status: AchievementStatus) => status.completed) : false;

  const toggleAllAchievements = () => {
    if (!game) return;
    const allNames = gameAchievements.map(ach => ach.internalName);
    if (hasSelected) {
      allNames.forEach(name => {
        onAchievementStatusUpdate(game.id, name, {
          completed: false,
          timestamp: { day: '', month: '', year: '', hour: '', minute: '' }
        }, preferredSourcePath);
      });
    } else {
      allNames.forEach(name => {
        onAchievementStatusUpdate(game.id, name, {
          completed: true,
          timestamp: { day: '', month: '', year: '', hour: '', minute: '' }
        }, preferredSourcePath);
      });
    }
  };

  useEffect(() => {
    setSearchQuery('');
  }, [game]);

  useEffect(() => {
    const getSourceCacheKey = (gameId: number, sourcePath?: string | null) =>
      `${gameId}::${sourcePath || 'auto'}`;

    const fetchAchievements = async () => {
      if (!game) {
        setGameAchievements([]);
        return;
      }

      const sourceCacheKey = getSourceCacheKey(game.id, preferredSourcePath);
      const cachedAchievements = achievementsCacheRef.current[sourceCacheKey];
      if (cachedAchievements) {
        setGameAchievements(cachedAchievements);
        setLoadingAchievements(false);
      } else {
        setLoadingAchievements(true);
      }

      try {
        const result = await getGameAchievements(game.id.toString());
        let achievements: Achievement[] = [];
        if (result.achievements.length > 0 && result.achievements[0].apiname !== undefined) {
          achievements = result.achievements.map((ach: any) => ({
            internalName: ach.apiname,
            displayName: ach.name || ach.apiname,
            description: ach.description || '',
            icon: ach.icon || '',
            percent: ach.percent,
            hidden: ach.hidden
          }));
        } else {
          achievements = result.achievements.map((ach: any) => ({
            internalName: ach.name,
            displayName: ach.displayName,
            description: ach.description,
            icon: ach.icon,
          }));
        }
        setGameAchievements(achievements);
        achievementsCacheRef.current[sourceCacheKey] = achievements;

        const isSteamSourceSelected = !preferredSourcePath || preferredSourcePath.startsWith('steam://');
        const shouldUseSteamStatus = isSteamSourceSelected;
        const normalizePath = (p: string) =>
          p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
        const normalizedPreferredPath = preferredSourcePath ? normalizePath(preferredSourcePath) : null;

        const monitoredGame = isSteamSourceSelected
          ? null
          : monitoredGames.find((g) => {
            if (g.gameId !== game.id.toString()) return false;
            return normalizePath(g.directory) === normalizedPreferredPath;
          });

        // Apply source status only once per source key to avoid cross-source overwrites.
        if (!sourceStatusInitializedRef.current.has(sourceCacheKey) && shouldUseSteamStatus) {
          result.achievements.forEach((ach: any) => {
            const isUnlocked = ach.achieved === true || ach.achieved === 1;
            const internalName = ach.apiname || ach.name;

            if (isUnlocked && internalName) {
              const currentStatus = achievementStatus[game.id]?.[internalName];
              // Only update if not already set or modified locally
              // We want to trust the API if the local state is "empty/default"
              const isLocallySet = currentStatus && (
                currentStatus.completed !== false ||
                currentStatus.timestamp.day !== ''
              );

              if (!isLocallySet) {
                // Format timestamp if available
                let timestamp: Timestamp = { day: '', month: '', year: '', hour: '', minute: '' };

                if (ach.unlockTime) {
                  const unlockDate = new Date(ach.unlockTime * 1000);
                  if (!isNaN(unlockDate.getTime())) {
                    let hour = String(unlockDate.getHours()).padStart(2, '0');
                    let ampm: 'AM' | 'PM' | undefined;

                    if (timeFormat === '12h') {
                      const hour24 = unlockDate.getHours();
                      const hour12 = hour24 % 12 || 12;
                      hour = String(hour12).padStart(2, '0');
                      ampm = hour24 >= 12 ? 'PM' : 'AM';
                    }

                    timestamp = {
                      day: String(unlockDate.getDate()).padStart(2, '0'),
                      month: String(unlockDate.getMonth() + 1).padStart(2, '0'),
                      year: String(unlockDate.getFullYear()),
                      hour: hour,
                      minute: String(unlockDate.getMinutes()).padStart(2, '0'),
                      ...(ampm && { ampm }),
                    };
                  }
                } else {
                  // If no timestamp but unlocked, set to now
                  const now = new Date();
                  let hour = String(now.getHours()).padStart(2, '0');
                  let ampm: 'AM' | 'PM' | undefined;

                  if (timeFormat === '12h') {
                    const hour24 = now.getHours();
                    const hour12 = hour24 % 12 || 12;
                    hour = String(hour12).padStart(2, '0');
                    ampm = hour24 >= 12 ? 'PM' : 'AM';
                  }

                  timestamp = {
                    day: String(now.getDate()).padStart(2, '0'),
                    month: String(now.getMonth() + 1).padStart(2, '0'),
                    year: String(now.getFullYear()),
                    hour: hour,
                    minute: String(now.getMinutes()).padStart(2, '0'),
                    ...(ampm && { ampm }),
                  };
                }

                onAchievementStatusUpdate(game.id, internalName, {
                  completed: true,
                  timestamp: timestamp
                }, preferredSourcePath);
              }
            }
          });
        }

        if (!sourceStatusInitializedRef.current.has(sourceCacheKey) && monitoredGame) {
          const normalizeAchievementKey = (value: string) =>
            value
              .toLowerCase()
              .replace(/^achievement_/, '')
              .replace(/[^a-z0-9]/g, '');

          monitoredGame.achievements.forEach(monitoredAch => {
            if (monitoredAch.achieved) {
              let matchingAch = achievements.find(ach =>
                ach.internalName.toLowerCase() === monitoredAch.name.toLowerCase()
              );

              if (!matchingAch) {
                const prefixedName = `ACHIEVEMENT_${monitoredAch.name}`;
                matchingAch = achievements.find(ach =>
                  ach.internalName.toLowerCase() === prefixedName.toLowerCase()
                );
              }

              if (!matchingAch) {
                const monitoredKey = normalizeAchievementKey(monitoredAch.name || '');
                matchingAch = achievements.find(ach =>
                  normalizeAchievementKey(ach.internalName || '') === monitoredKey ||
                  normalizeAchievementKey(ach.displayName || '') === monitoredKey
                );
              }

              if (matchingAch) {
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
                  }, preferredSourcePath);
                }
              }
            }
          });
        }

        sourceStatusInitializedRef.current.add(sourceCacheKey);
      } catch (error) {
        console.error('Error fetching achievements:', error);
        setGameAchievements([]);
      } finally {
        setLoadingAchievements(false);
      }
    };

    fetchAchievements();
  }, [game, monitoredGames, timeFormat, preferredSourcePath]);

  const achievements = gameAchievements;

  const getTimestampValue = useCallback((ts: Timestamp) => {
    if (!ts.day || !ts.month || !ts.year) return 0;
    const year = parseInt(ts.year);
    const month = parseInt(ts.month) - 1;
    const day = parseInt(ts.day);
    const hour = parseInt(ts.hour || '0');
    const minute = parseInt(ts.minute || '0');

    let h24 = hour;
    if (ts.ampm === 'PM' && h24 < 12) h24 += 12;
    else if (ts.ampm === 'AM' && h24 === 12) h24 = 0;

    return new Date(year, month, day, h24, minute).getTime();
  }, []);

  const normalizeString = (str: string) => {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  };

  const filteredAchievements = useMemo(() => {
    let result = [...achievements];

    // Filter by search query
    if (searchQuery.trim()) {
      const normalizedQuery = normalizeString(searchQuery);
      result = result.filter(
        (ach) =>
          normalizeString(ach.displayName).includes(normalizedQuery) ||
          normalizeString(ach.description).includes(normalizedQuery)
      );
    }

    // Sort
    result.sort((a, b) => {
      if (sortType === 'alphabetical') {
        const valA = a.displayName.toLowerCase();
        const valB = b.displayName.toLowerCase();
        return sortDirection === 'asc'
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      } else {
        const statusA = achievementStatus[game.id]?.[a.internalName];
        const statusB = achievementStatus[game.id]?.[b.internalName];

        const timeA = statusA?.completed ? getTimestampValue(statusA.timestamp) : 0;
        const timeB = statusB?.completed ? getTimestampValue(statusB.timestamp) : 0;

        // If both are not unlocked, sort alphabetically as secondary
        if (timeA === 0 && timeB === 0) {
          return a.displayName.localeCompare(b.displayName);
        }

        // Unlocked first (or last depending on direction)
        if (sortDirection === 'desc') {
          return timeB - timeA;
        } else {
          // Unlocked last
          if (timeA === 0) return 1;
          if (timeB === 0) return -1;
          return timeA - timeB;
        }
      }
    });

    return result;
  }, [achievements, searchQuery, sortType, sortDirection, achievementStatus, game?.id, getTimestampValue]);



  const handleUnlockConfirm = (path: string) => {
    onGlobalUnlock(unlockMode, customTimestamp, path, gameAchievements);
    setIsUnlockModalOpen(false);
  };

  if (!game) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center select-none pointer-events-none">
        <TrophyIcon className="text-8xl mb-6 text-[var(--text-main)] opacity-15" />
        <h1 className="text-xl font-black tracking-wide text-[var(--text-main)] opacity-35">
          {t('achievementsPage.title')}
        </h1>
        <p className="text-[11px] font-bold tracking-wide mt-2 text-[var(--text-muted)] opacity-70">
          {t('achievementsPage.selectGamePrompt')}
        </p>
      </div>
    );
  }

  const defaultStatus: AchievementStatus = {
    completed: false,
    timestamp: { day: '', month: '', year: '', hour: '', minute: '' },
  };

  return (
    <>
      <UnlockModal
        isOpen={isUnlockModalOpen}
        onClose={() => setIsUnlockModalOpen(false)}
        onConfirm={handleUnlockConfirm}
        game={game}
        newAchievementCount={Object.values(achievementStatus[game.id] || {}).filter((status: AchievementStatus) => status.completed).length}
        unlockMode={unlockMode}
      />
      <div className="flex flex-col h-full gap-4">
        <header className="flex-shrink-0 flex flex-col sm:flex-row justify-between sm:items-end gap-6">
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-black uppercase tracking-tighter truncate leading-none" style={{ color: 'var(--text-main)' }} title={game.name}>
              {game.name}
            </h1>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative group w-full sm:w-64">
              <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
                <SearchIcon className={`text-base transition-colors duration-300 ${searchQuery ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)] group-focus-within:text-[var(--text-main)]'}`} />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('achievementsPage.searchPlaceholder')}
                className="w-full h-11 border rounded-md pl-11 pr-4 text-[11px] font-bold tracking-wider outline-none transition-all shadow-inner"
                style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-main)' }}
                aria-label={t('achievementsPage.searchPlaceholder')}
              />
            </div>

            <div className="flex p-1 rounded-md border h-11" style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--border-color)' }}>
              <button
                onClick={toggleAllAchievements}
                title={hasSelected ? t('achievementsPage.unselectAll') : t('achievementsPage.selectAll')}
                className={`px-3 flex items-center justify-center rounded-sm transition-all duration-300 ${hasSelected
                  ? 'bg-[var(--text-main)] text-[var(--bg-color)] shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
              >
                {hasSelected ? <LockIcon className="text-xl" /> : <CheckIcon className="text-xl" />}
              </button>

              <div className="w-[1px] my-1.5 mx-1 opacity-20" style={{ backgroundColor: 'var(--text-main)' }} />

              <button
                onClick={() => setSortType('alphabetical')}
                className={`px-3 flex items-center justify-center rounded-sm transition-all duration-300 ${sortType === 'alphabetical'
                  ? 'bg-[var(--text-main)] text-[var(--bg-color)] shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                title="A-Z"
              >
                <span className="text-[10px] font-black tracking-widest uppercase">A-Z</span>
              </button>
              <button
                onClick={() => setSortType('unlockTime')}
                className={`px-3 flex items-center justify-center rounded-sm transition-all duration-300 ${sortType === 'unlockTime'
                  ? 'bg-[var(--text-main)] text-[var(--bg-color)] shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                title="Time"
              >
                <span className="text-[10px] font-black tracking-widest uppercase">Time</span>
              </button>

              <div className="w-[1px] my-1.5 mx-1 opacity-20" style={{ backgroundColor: 'var(--text-main)' }} />

              <button
                onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
                className="px-3 flex items-center justify-center rounded-sm text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
                title={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
              >
                <div className={`transition-transform duration-300 ${sortDirection === 'desc' ? 'rotate-180' : ''}`}>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>
            </div>
          </div>
        </header>

        <div className="flex-grow overflow-y-auto custom-scrollbar min-h-0 pr-2" ref={containerRef}>
          {loadingAchievements ? (
            <div className="flex-grow flex items-center justify-center h-full">
              <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--text-muted)', borderTopColor: 'var(--text-main)' }}></div>
            </div>
          ) : achievements.length === 0 ? (
            <div className="flex-grow flex items-center justify-center h-full border rounded-md" style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
              <p className="text-[11px] font-bold tracking-wide opacity-70">{t('achievementsPage.noAchievements')}</p>
            </div>
          ) : filteredAchievements.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 p-1">
              {filteredAchievements.map((ach) => {
                const status = achievementStatus[game.id]?.[ach.internalName] ?? defaultStatus;
                return (
                  <AchievementCard
                    key={ach.internalName}
                    achievement={ach}
                    status={status}
                    onToggle={() => onAchievementToggle(game.id, ach.internalName, preferredSourcePath)}
                    onTimestampChange={(field, value) => onTimestampChange(game.id, ach.internalName, field, value, preferredSourcePath)}
                    onTimestampClear={() => onTimestampClear(game.id, ach.internalName, preferredSourcePath)}
                  />
                )
              })}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center select-none pointer-events-none">
              <SearchIcon className="text-7xl mb-5 text-[var(--text-main)] opacity-15" />
              <h2 className="text-lg font-black tracking-wide text-[var(--text-main)] opacity-35 leading-none">
                {t('achievementsPage.noResultsForQuery', { query: searchQuery })}
              </h2>
            </div>
          )}
        </div>

        {filteredAchievements.length > 0 && (
          <footer className="flex-shrink-0 flex flex-col md:flex-row justify-between items-center gap-4 mt-1.5 pt-3.5 border-t" style={{ borderColor: 'var(--border-color)' }}>
            <div className="w-full md:w-auto">
              <GlobalTimestampManager
                mode={unlockMode}
                setMode={setUnlockMode}
                timestamp={customTimestamp}
                setTimestamp={setCustomTimestamp}
              />
            </div>



            <div className="flex items-center gap-2 w-full md:w-auto">
              <button
                onClick={onExportStart}
                className="flex-1 md:flex-none h-11 px-6 rounded-md text-[10px] font-black uppercase tracking-[0.2em] border transition-all flex items-center justify-center gap-3"
                style={{ backgroundColor: 'var(--hover-bg)', borderColor: 'var(--border-color)', color: 'var(--text-main)' }}
              >
                <ExportIcon className="text-lg opacity-50" />
                <span>{t('globalTimestampManager.export')}</span>
              </button>
              <button
                onClick={() => setIsUnlockModalOpen(true)}
                className="flex-1 md:flex-none h-11 px-8 rounded-md text-[10px] font-black uppercase tracking-[0.2em] shadow-xl transition-all flex items-center justify-center gap-3"
                style={{ backgroundColor: 'var(--text-main)', color: 'var(--bg-color)' }}
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
