import React, { useState, useEffect } from 'react';
import { SteamSearchResult } from '../types';
import { useMonitoredAchievements } from '../contexts/MonitoredAchievementsContext';
import { useTheme } from '../contexts/ThemeContext';
import { useI18n } from '../contexts/I18nContext';
import { GameAchievements } from '../types';
import { PlatinumIcon, GridViewIcon, ListViewIcon, SteamBrandIcon, SearchIcon } from '../components/Icons';
import { getGameAchievements } from '../tauri-api';

const LIST_VIEW_GRID_COLUMNS = '48px minmax(180px, 2fr) minmax(90px, 0.8fr) minmax(180px, 2.2fr) minmax(110px, 0.7fr) minmax(260px, 1.9fr)';

const MonitoredGameCard: React.FC<{
  game: GameAchievements;
  onGameSelect: (game: SteamSearchResult) => void;
}> = ({ game, onGameSelect }) => {
  const { t } = useI18n();
  const { gameNames } = useMonitoredAchievements();
  const gameId = game.gameId;
  const source = (game as any).source;
  const isSteam = source === 'steam' || source === 'both';
  const isBoth = source === 'both';
  const achievementsCurrent = isSteam ? (game as any).achievementsCurrent : game.achievements.filter(a => a.achieved).length;
  const gameName = gameNames[gameId] || (game as any).name || gameId;
  const [totalAchievements, setTotalAchievements] = useState<number | null>(isSteam ? (game as any).achievementsTotal : null);

  const steamCdnUrl = import.meta.env.VITE_STEAM_CDN_URL || 'https://cdn.akamai.steamstatic.com/steam/apps';
  const fallbackImages = [
    `${steamCdnUrl}/${gameId}/header.jpg`,
    `${steamCdnUrl}/${gameId}/library_hero.jpg`,
    `${steamCdnUrl}/${gameId}/capsule_616x353.jpg`,
    `${steamCdnUrl}/${gameId}/capsule_467x181.jpg`,
    `${steamCdnUrl}/${gameId}/capsule_231x87.jpg`,
    `${steamCdnUrl}/${gameId}/logo.png`,
    `${steamCdnUrl}/${gameId}/library_600x900.jpg`,
  ];

  const [imageIndex, setImageIndex] = useState(0);
  const [imageUrl, setImageUrl] = useState(fallbackImages[0]);
  const [isImageLoaded, setIsImageLoaded] = useState(false);

  useEffect(() => {
    setImageIndex(0);
    setImageUrl(fallbackImages[0]);
    setIsImageLoaded(false);
  }, [gameId]);

  useEffect(() => {
    if (totalAchievements !== null && totalAchievements !== 0) return;
    if (isSteam && (game as any).achievementsTotal) return;

    const fetchTotalAchievements = async () => {
      try {
        const gameAchievements = await getGameAchievements(gameId);
        if (gameAchievements && gameAchievements.achievements) {
          setTotalAchievements(gameAchievements.achievements.length);
        }
      } catch (error) {
        console.error('Error fetching total achievements:', error);
        setTotalAchievements(game.achievements.length);
      }
    };
    fetchTotalAchievements();
  }, [gameId, isSteam, (game as any).achievementsTotal]);

  const finalTotal = totalAchievements ?? game.achievements.length;
  const isCompleted = finalTotal > 0 && achievementsCurrent >= finalTotal;

  const handleImageError = () => {
    if (imageIndex < fallbackImages.length - 1) {
      const nextIndex = imageIndex + 1;
      setImageIndex(nextIndex);
      setImageUrl(fallbackImages[nextIndex]);
    } else {
      setIsImageLoaded(true); // Stop loading even if all fail
    }
  };

  useEffect(() => {
    // Safety timeout: if images take too long, just show the card (maybe with a fallback bg)
    const timer = setTimeout(() => {
      if (!isImageLoaded) setIsImageLoaded(true);
    }, 1200);
    return () => clearTimeout(timer);
  }, [isImageLoaded]);

  return (
    <div
      onClick={() => onGameSelect({ id: parseInt(gameId), name: gameName, achievementsTotal: finalTotal })}
      className="group relative aspect-[16/9] rounded-md overflow-hidden shadow-2xl cursor-pointer transition-[transform,shadow,opacity] duration-300 hover:scale-[1.01] active:scale-[0.99] border border-[var(--border-color)] will-change-transform transform-gpu"
      style={{ backgroundColor: 'var(--card-bg)', backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transformStyle: 'preserve-3d' }}
    >
      <div
        className={`absolute inset-0 bg-cover bg-center transition-opacity duration-500 ${isImageLoaded ? 'opacity-100' : 'opacity-80'}`}
        style={{ backgroundImage: `url(${imageUrl})`, backgroundColor: '#000' }}
      />
      <img src={imageUrl} onError={handleImageError} onLoad={() => setIsImageLoaded(true)} style={{ display: 'none' }} alt="" />

      {!isImageLoaded && (
        <div className="absolute inset-0 bg-black/20" />
      )}

      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>

      {/* COMPLETED Badge */}
      {isCompleted && (
        <div className="absolute top-3 right-3 z-10 transition-all duration-500 animate-fade-in">
          <span className="bg-gradient-to-r from-[#a9c9ff] via-[#c7dfff] to-[#a9c9ff] text-black px-2 py-0.5 rounded-[2px] text-[8px] font-black shadow-[0_0_10px_rgba(169,201,255,0.2)] flex items-center gap-1 animate-shimmer bg-[length:200%_100%]">
            <PlatinumIcon className="text-[10px]" />
            COMPLETED
          </span>
        </div>
      )}

      {/* Content wrapper */}
      <div className="relative flex flex-col justify-end h-full p-4 text-white transition-opacity duration-300">
        <div className="flex items-center justify-between mb-2 gap-3 min-w-0">
          <h3 className="font-black text-sm uppercase tracking-tight truncate min-w-0 leading-tight drop-shadow-md flex items-center gap-2">
            {isSteam && <SteamBrandIcon className="w-4 h-4 shrink-0 opacity-70" />}
            <span className="truncate">{gameName}</span>
          </h3>
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-gray-200 flex-shrink-0 drop-shadow-md">
            <span className={isCompleted ? 'text-[#a9c9ff]' : ''}>{achievementsCurrent}</span>
            <span className="opacity-30">/</span>
            <span>{finalTotal}</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ease-out fill-mode-forwards ${isCompleted
              ? 'bg-gradient-to-r from-[#a9c9ff] via-[#c7dfff] to-[#a9c9ff] shadow-[0_0_15px_rgba(169,201,255,0.2)] animate-shimmer bg-[length:200%_100%]'
              : 'bg-white/40 group-hover:bg-white/60'
              }`}
            style={{ width: finalTotal > 0 ? `${(achievementsCurrent / finalTotal) * 100}%` : '0%' }}
          ></div>
        </div>
      </div>

      <div className="absolute inset-0 rounded-md pointer-events-none transition-[box-shadow] duration-300 group-hover:ring-1 group-hover:ring-inset group-hover:ring-white/5"></div>
    </div>
  );
};

const MonitoredGameRow: React.FC<{
  game: GameAchievements;
  onGameSelect: (game: SteamSearchResult) => void;
}> = ({ game, onGameSelect }) => {
  const { duplicateGames, gameNames } = useMonitoredAchievements();
  const gameId = game.gameId;
  const source = (game as any).source;
  const isSteam = source === 'steam' || source === 'both';
  const isBoth = source === 'both';
  const achievementsCurrent = isSteam ? (game as any).achievementsCurrent : game.achievements.filter(a => a.achieved).length;
  const [totalAchievements, setTotalAchievements] = useState<number | null>(isSteam ? (game as any).achievementsTotal : null);

  const gameName = gameNames[gameId] || (game as any).name || gameId;
  const duplicates = duplicateGames.find(d => d.gameId === gameId);
  const otherDirsCount = (duplicates?.directories.length || 1) - 1;
  const allPaths = duplicates?.directories.map(d => d.path).join('\n') || game.directory;

  useEffect(() => {
    if (totalAchievements !== null && totalAchievements !== 0) return;
    if (isSteam && (game as any).achievementsTotal) return;

    const fetchData = async () => {
      try {
        const gameAchievements = await getGameAchievements(gameId);
        if (gameAchievements && gameAchievements.achievements) {
          setTotalAchievements(gameAchievements.achievements.length);
        }
      } catch (error) {
        console.error('Error fetching game data:', error);
        setTotalAchievements(game.achievements.length);
      }
    };
    fetchData();
  }, [gameId, isSteam, (game as any).achievementsTotal]);

  const finalTotal = totalAchievements ?? game.achievements.length;
  const isCompleted = finalTotal > 0 && achievementsCurrent >= finalTotal;

  return (
    <div
      onClick={() => onGameSelect({ id: parseInt(gameId), name: gameName, achievementsTotal: finalTotal })}
      className="group grid gap-6 items-center p-4 rounded-md transition-all duration-300 cursor-pointer border border-[var(--border-color)]"
      style={{ backgroundColor: 'var(--input-bg)', gridTemplateColumns: LIST_VIEW_GRID_COLUMNS }}
    >
      <div className="w-12 h-12 flex items-center justify-center">
        <img
          src={`${import.meta.env.VITE_STEAM_CDN_URL || 'https://cdn.akamai.steamstatic.com/steam/apps'}/${gameId}/logo.png`}
          alt=""
          className="w-full h-full object-contain filter drop-shadow-md"
          onError={(e) => {
            (e.target as HTMLImageElement).src = `${import.meta.env.VITE_STEAM_CDN_URL || 'https://cdn.akamai.steamstatic.com/steam/apps'}/${gameId}/capsule_184x69.jpg`;
          }}
        />
      </div>

      <div className="min-w-0">
        <h3 className="font-black text-xs uppercase tracking-widest truncate flex items-center gap-2" style={{ color: 'var(--text-main)' }}>
          <span className="truncate">{gameName}</span>
        </h3>
        <p className="text-[9px] font-bold opacity-30 uppercase tracking-widest mt-0.5" style={{ color: 'var(--text-main)' }}>AppID: {gameId}</p>
      </div>

      <div className="flex items-center justify-center">
        {isBoth ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-[var(--hover-bg)] border border-[var(--border-color)] w-24 justify-center">
            <SteamBrandIcon className="w-3.5 h-3.5 opacity-60" style={{ color: 'var(--text-main)' }} />
            <span className="text-[9px] font-black opacity-60 uppercase tracking-widest" style={{ color: 'var(--text-main)' }}>Both</span>
          </div>
        ) : isSteam ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-[var(--hover-bg)] border border-[var(--border-color)] w-24 justify-center">
            <SteamBrandIcon className="w-3.5 h-3.5 opacity-60" style={{ color: 'var(--text-main)' }} />
            <span className="text-[9px] font-black opacity-60 uppercase tracking-widest" style={{ color: 'var(--text-main)' }}>Steam</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-[var(--hover-bg)] border border-[var(--border-color)] w-24 justify-center">
            <span className="text-[9px] font-black opacity-60 uppercase tracking-widest" style={{ color: 'var(--text-main)' }}>Local</span>
          </div>
        )}
      </div>

      <div className="hidden lg:flex items-center justify-start gap-2 overflow-hidden" title={allPaths}>
        <span className="text-[10px] font-bold opacity-40 uppercase tracking-widest truncate" style={{ color: 'var(--text-main)' }}>{game.directory}</span>
        {otherDirsCount > 0 && (
          <span className="px-1.5 py-0.5 rounded-sm bg-[var(--hover-bg)] text-[9px] font-black opacity-50 whitespace-nowrap" style={{ color: 'var(--text-main)' }}>
            +{otherDirsCount}
          </span>
        )}
      </div>

      <div className="justify-self-center w-full max-w-[110px] text-center">
        {isCompleted ? (
          <span className="text-[9px] font-black text-[#a9c9ff] uppercase tracking-widest flex items-center justify-center gap-1">
            <PlatinumIcon className="text-sm" />
            100%
          </span>
        ) : (
          <span className="text-[9px] font-black opacity-30 uppercase tracking-widest" style={{ color: 'var(--text-main)' }}>
            {finalTotal > 0 ? Math.round((achievementsCurrent / finalTotal) * 100) : 0}%
          </span>
        )}
      </div>

      <div className="justify-self-end w-full max-w-[260px] pl-2 flex flex-col items-end gap-1.5">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-tighter">
          <span className={isCompleted ? 'text-[#a9c9ff]' : 'text-[var(--text-main)]'}>{achievementsCurrent}</span>
          <span className="opacity-20" style={{ color: 'var(--text-main)' }}>/</span>
          <span className="opacity-40" style={{ color: 'var(--text-main)' }}>{finalTotal}</span>
        </div>
        <div className="w-full bg-[var(--hover-bg)] h-1.5 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${isCompleted ? 'bg-gradient-to-r from-[#a9c9ff] via-[#c7dfff] to-[#a9c9ff] animate-shimmer bg-[length:200%_100%] shadow-[0_0_15px_rgba(169,201,255,0.3)]' : 'bg-[var(--text-muted)] opacity-20'}`}
            style={{ width: finalTotal > 0 ? `${(achievementsCurrent / finalTotal) * 100}%` : '0%' }}
          />
        </div>
      </div>
    </div>
  );
};

type SortKey = 'name' | 'path' | 'progress';

const GamesContent: React.FC<{ onGameSelect: (game: SteamSearchResult) => void }> = ({ onGameSelect }) => {
  const { games, gameNames } = useMonitoredAchievements();
  const { gamesViewMode, setGamesViewMode } = useTheme();
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState<'all' | 'steam' | 'local'>('all');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });

  const filteredAndSortedGames = React.useMemo(() => {
    let result = games.filter(game => {
      const name = (gameNames[game.gameId] || (game as any).name || '').toLowerCase();
      const query = searchQuery.toLowerCase();
      const matchesSearch = name.includes(query) || game.gameId.includes(query);

      const source = (game as any).source;
      const isSteam = source === 'steam' || source === 'both';
      const isLocal = source !== 'steam';
      const matchesPlatform =
        platformFilter === 'all' ||
        (platformFilter === 'steam' && isSteam) ||
        (platformFilter === 'local' && isLocal);

      return matchesSearch && matchesPlatform;
    });

    result.sort((a, b) => {
      let valA: any;
      let valB: any;

      switch (sortConfig.key) {
        case 'name':
          valA = (gameNames[a.gameId] || (a as any).name || a.gameId).toLowerCase();
          valB = (gameNames[b.gameId] || (b as any).name || b.gameId).toLowerCase();
          break;
        case 'path':
          valA = a.directory.toLowerCase();
          valB = b.directory.toLowerCase();
          break;
        case 'progress':
          valA = a.achievements.filter(acc => acc.achieved).length / (a.achievements.length || 1);
          valB = b.achievements.filter(acc => acc.achieved).length / (b.achievements.length || 1);
          break;
        default:
          return 0;
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [games, gameNames, searchQuery, sortConfig, platformFilter]);

  const handleSort = (key: SortKey) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortIndicator = ({ column }: { column: SortKey }) => {
    const isActive = sortConfig.key === column;
    return (
      <div className={`ml-2 flex flex-col transition-all duration-300 ${isActive ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-1 group-hover:opacity-30'}`}>
        <svg
          className={`w-2.5 h-2.5 transition-transform duration-300 ${sortConfig.direction === 'desc' && isActive ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <header className="flex-shrink-0 w-full mb-8 animate-fade-in flex items-center gap-4">
        <div className="relative group flex-1">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <SearchIcon className={`text-lg transition-colors duration-300 ${searchQuery ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)] group-focus-within:text-[var(--text-main)]'}`} />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`${t('sidebar.search')}...`}
            className="w-full h-12 border rounded-md pl-12 pr-4 text-sm font-medium tracking-normal placeholder:normal-case placeholder:tracking-normal outline-none transition-all shadow-inner"
            style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-main)' }}
          />
        </div>

        <div className="flex p-1 rounded-lg border h-12 shadow-inner" style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--border-color)' }}>
          <button
            onClick={() => setGamesViewMode('grid')}
            className={`w-10 h-full flex items-center justify-center rounded-md transition-all duration-300 ${gamesViewMode === 'grid'
              ? 'bg-[var(--text-main)] text-[var(--bg-color)] shadow-lg scale-95'
              : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--hover-bg)]'
              }`}
            title="Grade"
          >
            <GridViewIcon className="text-lg" />
          </button>
          <button
            onClick={() => setGamesViewMode('list')}
            className={`w-10 h-full flex items-center justify-center rounded-md transition-all duration-300 ${gamesViewMode === 'list'
              ? 'bg-[var(--text-main)] text-[var(--bg-color)] shadow-lg scale-95'
              : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--hover-bg)]'
              }`}
            title="Lista"
          >
            <ListViewIcon className="text-lg" />
          </button>
        </div>
      </header>

      <div className="flex-grow overflow-y-auto no-scrollbar pb-10 custom-scrollbar">
        {gamesViewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-8 px-2 py-5 overflow-visible">
            {filteredAndSortedGames.map(game => (
              <MonitoredGameCard
                key={game.gameId}
                game={game}
                onGameSelect={onGameSelect}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="grid gap-6 items-center py-3 text-[10px] font-black opacity-30 uppercase tracking-[0.2em] border-b sticky top-0 z-10" style={{ backgroundColor: 'var(--bg-color)', borderColor: 'var(--border-color)', color: 'var(--text-main)', gridTemplateColumns: LIST_VIEW_GRID_COLUMNS }}>
              <div className="w-12"></div>
              <button onClick={() => handleSort('name')} className="group flex items-center hover:opacity-100 transition-colors uppercase truncate text-left">
                Game <SortIndicator column="name" />
              </button>

              <div className="flex items-center justify-center">
                <button
                  onClick={() => {
                    const filters: ('all' | 'steam' | 'local')[] = ['all', 'steam', 'local'];
                    const next = filters[(filters.indexOf(platformFilter) + 1) % filters.length];
                    setPlatformFilter(next);
                  }}
                  className={`group flex items-center hover:opacity-100 transition-colors uppercase tracking-[0.2em] ${platformFilter !== 'all' ? 'text-[var(--text-main)] opacity-100' : ''}`}
                >
                  {platformFilter === 'all' ? 'All' : platformFilter}
                </button>
              </div>

              <button onClick={() => handleSort('path')} className="group hidden lg:flex items-center justify-start hover:opacity-100 transition-colors uppercase truncate">
                Path <SortIndicator column="path" />
              </button>
              <div className="justify-self-center w-full max-w-[110px] text-center">Status</div>
              <button onClick={() => handleSort('progress')} className="group justify-self-end w-full max-w-[260px] pl-2 flex items-center justify-end hover:opacity-100 transition-colors uppercase">
                Progress <SortIndicator column="progress" />
              </button>
            </div>
            <div className="space-y-1 mt-2">
              {filteredAndSortedGames.map(game => (
                <MonitoredGameRow
                  key={game.gameId}
                  game={game}
                  onGameSelect={onGameSelect}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GamesContent;
