import React, { useState, useEffect } from 'react';
import { SteamSearchResult } from '../types';
import { useMonitoredAchievements } from '../contexts/MonitoredAchievementsContext';
import { useTheme } from '../contexts/ThemeContext';
import { useI18n } from '../contexts/I18nContext';
import { GameAchievements } from '../types';
import { PlatinumIcon, GridViewIcon, ListViewIcon, SteamBrandIcon, SearchIcon, WarningIcon, RetroAchievementsIcon } from '../components/Icons';
import { getGameAchievements, getRetroAchievementsRecentGames } from '../tauri-api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  getSteamBackgroundFallbackUrls,
  getSteamLogoFallbackUrl,
  getSteamLogoUrl,
  isSteamLogoFallbackUrl,
} from '@/lib/steam-assets';
import { getRetroAchievementsGameImage } from '@/lib/retro-achievements-assets';

const useGameProgress = (game: GameAchievements) => {
  const { gameNames } = useMonitoredAchievements();
  const gameId = game.gameId;
  const source = (game as any).source;
  const isSteam = source === 'steam' || source === 'both';
  const isRetroAchievements = source === 'retroachievements';
  const achievementsCurrent = isSteam || isRetroAchievements ? (game as any).achievementsCurrent : game.achievements.filter(a => a.achieved).length;
  const gameName = gameNames[gameId] || (game as any).name || gameId;
  const [totalAchievements, setTotalAchievements] = useState<number | null>((isSteam || isRetroAchievements) ? (game as any).achievementsTotal : null);

  const isNameReady = !!gameNames[gameId] || !!(game as any).name;
  const isTotalReady = totalAchievements !== null && totalAchievements !== 0;
  const isReady = isNameReady && (isTotalReady || (isSteam && (game as any).achievementsTotal));

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
  }, [game, gameId, isSteam, totalAchievements]);

  const finalTotal = totalAchievements ?? game.achievements.length;
  const isCompleted = finalTotal > 0 && achievementsCurrent >= finalTotal;
  const progressPercent = finalTotal > 0 ? Math.round((achievementsCurrent / finalTotal) * 100) : 0;
  const toSteamSearchResult = (): SteamSearchResult => ({
    id: parseInt(gameId),
    name: gameName,
    achievementsTotal: finalTotal,
    source: isRetroAchievements ? 'retroachievements' : undefined,
    consoleName: (game as any).consoleName,
    imageUrl: (game as any).imageUrl,
    logoUrl: (game as any).logoUrl,
  });

  return {
    gameId,
    source,
    isSteam,
    isRetroAchievements,
    achievementsCurrent,
    gameName,
    finalTotal,
    isCompleted,
    progressPercent,
    toSteamSearchResult,
    isReady,
  };
};

const MonitoredGameCard: React.FC<{
  game: GameAchievements;
  onGameSelect: (game: SteamSearchResult) => void;
}> = ({ game, onGameSelect }) => {
  const { t } = useI18n();
  const { gameId, isSteam, isRetroAchievements, achievementsCurrent, gameName, finalTotal, isCompleted, toSteamSearchResult, isReady } = useGameProgress(game);

  const fallbackImages = isRetroAchievements
    ? [getRetroAchievementsGameImage(game as any)]
    : getSteamBackgroundFallbackUrls(gameId);

  const [imageIndex, setImageIndex] = useState(0);
  const [imageUrl, setImageUrl] = useState(fallbackImages[0]);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [backgroundFailed, setBackgroundFailed] = useState(false);
  const [hoverLogoFailed, setHoverLogoFailed] = useState(false);

  useEffect(() => {
    setImageIndex(0);
    setImageUrl(fallbackImages[0]);
    setIsImageLoaded(false);
    setBackgroundFailed(false);
    setHoverLogoFailed(false);
  }, [gameId]);

  if (!isReady) {
    return (
      <div className="aspect-[16/9] rounded-md overflow-hidden">
        <Skeleton className="w-full h-full" />
      </div>
    );
  }

  const handleImageError = () => {
    if (imageIndex < fallbackImages.length - 1) {
      const nextIndex = imageIndex + 1;
      setImageIndex(nextIndex);
      setImageUrl(fallbackImages[nextIndex]);
    } else {
      setIsImageLoaded(true);
      setBackgroundFailed(true);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isImageLoaded) setIsImageLoaded(true);
    }, 1200);
    return () => clearTimeout(timer);
  }, [isImageLoaded]);

  return (
    <div
      onClick={() => onGameSelect(toSteamSearchResult())}
      className={`group monitored-game-card relative aspect-[16/9] rounded-md shadow-2xl cursor-pointer transition-all duration-300 border bg-card ${isCompleted ? 'completed-game-card' : 'border-border hover:border-foreground/30'}`}
    >
      <div
        className={`absolute inset-0 overflow-hidden rounded-md bg-cover bg-center transition-opacity duration-500 ${isImageLoaded ? 'opacity-100' : 'opacity-80'}`}
        style={{ backgroundImage: `url(${imageUrl})`, backgroundColor: '#000' }}
      />
      <img src={imageUrl} onError={handleImageError} onLoad={() => setIsImageLoaded(true)} style={{ display: 'none' }} alt="" />

      {!isImageLoaded && <div className="absolute inset-0 bg-black/20" />}

      {backgroundFailed && (
        <div className="absolute inset-0 flex items-center justify-center">
          <WarningIcon className="text-yellow-500/60 text-6xl" />
        </div>
      )}

      <div className="absolute inset-0 overflow-hidden rounded-md bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>

      {isCompleted && (
        <div className="absolute top-2.5 right-2.5 z-10 animate-fade-in">
          <span className="completed-game-badge inline-flex h-5 items-center gap-1 rounded-full border border-primary/30 bg-primary/90 px-2 text-[10px] font-semibold leading-none text-primary-foreground backdrop-blur-sm">
            <PlatinumIcon
              className="shrink-0 leading-none opacity-80"
              style={{ fontSize: 12, lineHeight: 1, fontVariationSettings: "'FILL' 1, 'wght' 300, 'GRAD' 0, 'opsz' 20" }}
            />
            <span>{t('gamesPage.completed')}</span>
          </span>
        </div>
      )}

      {isRetroAchievements ? null : hoverLogoFailed ? (
        <div className="absolute -top-2 -left-1 z-10 h-16 w-16 flex items-center justify-center opacity-0 drop-shadow-xl transition-opacity duration-300 group-hover:opacity-100">
          <WarningIcon className="text-yellow-500 text-5xl" />
        </div>
      ) : (
        <img
          src={getSteamLogoUrl(gameId)}
          alt=""
          className="absolute -top-1 left-3 z-10 h-16 w-16 object-contain opacity-0 drop-shadow-xl transition-opacity duration-300 group-hover:opacity-100"
          onError={(e) => {
            const img = e.target as HTMLImageElement;
            if (isSteamLogoFallbackUrl(img.src, gameId)) {
              setHoverLogoFailed(true);
            } else {
              img.src = getSteamLogoFallbackUrl(gameId);
            }
          }}
        />
      )}

      <div className="relative flex flex-col justify-end h-full p-4 text-white">
        <div className="flex items-center justify-between mb-2 gap-3 min-w-0">
          <h3 className="font-semibold text-sm truncate min-w-0 leading-tight drop-shadow-md flex items-center gap-2">
            {isSteam && <SteamBrandIcon className="w-4 h-4 shrink-0 opacity-70" />}
            {isRetroAchievements && <RetroAchievementsIcon className="w-4 h-4 shrink-0 opacity-70" />}
            <span className="truncate">{gameName}</span>
          </h3>
          <div className="flex items-center gap-1 rounded-full border border-white/10 bg-black/25 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-white shadow-[0_1px_2px_rgba(0,0,0,0.85)] backdrop-blur-[2px] flex-shrink-0">
            <span className={isCompleted ? 'text-primary' : 'text-white/95'}>{achievementsCurrent}</span>
            <span className="opacity-40">/</span>
            <span className="text-white/90">{finalTotal}</span>
          </div>
        </div>

        <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
          <div
            className={`game-card-progress-fill h-full transition-all duration-500 ease-out ${isCompleted
              ? 'bg-gradient-to-r from-primary via-primary/80 to-primary shadow-[0_0_15px_var(--primary)] animate-shimmer bg-[length:200%_100%]'
              : 'bg-white/40 group-hover:bg-white/60'
              }`}
            style={{ width: finalTotal > 0 ? `${(achievementsCurrent / finalTotal) * 100}%` : '0%' }}
          ></div>
        </div>
      </div>

      <div className="absolute inset-0 overflow-hidden rounded-md pointer-events-none transition-shadow duration-300 group-hover:ring-1 group-hover:ring-inset group-hover:ring-white/5"></div>
    </div>
  );
};

const MonitoredGameRow: React.FC<{
  game: GameAchievements;
  onGameSelect: (game: SteamSearchResult) => void;
}> = ({ game, onGameSelect }) => {
  const { t } = useI18n();
  const { duplicateGames } = useMonitoredAchievements();
  const { gameId, source, isSteam, isRetroAchievements, achievementsCurrent, gameName, finalTotal, isCompleted, progressPercent, toSteamSearchResult, isReady } = useGameProgress(game);
  const duplicates = duplicateGames.find(d => d.gameId === gameId);
  const otherDirsCount = (duplicates?.directories.length || 1) - 1;
  const allPaths = duplicates?.directories.map(d => d.path).join('\n') || game.directory;

  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    setLogoFailed(false);
  }, [gameId]);

  if (!isReady) {
    return (
      <TableRow>
        <TableCell><Skeleton className="w-10 h-10 rounded" /></TableCell>
        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
        <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-16 mx-auto" /></TableCell>
        <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
        <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
      </TableRow>
    );
  }

  const handleSelect = () => onGameSelect(toSteamSearchResult());

  return (
    <TableRow
      role="button"
      tabIndex={0}
      onClick={handleSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleSelect();
        }
      }}
      className="group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    >
      <TableCell className="w-[6%] p-2 sm:p-3">
        {isRetroAchievements ? (
          <img
            src={(game as any).logoUrl || (game as any).imageUrl || getRetroAchievementsGameImage(game as any)}
            alt=""
            className="h-12 w-12 object-cover rounded-md drop-shadow-md sm:h-14 sm:w-14"
          />
        ) : logoFailed ? (
          <div className="h-12 w-12 sm:h-14 sm:w-14 flex items-center justify-center">
            <WarningIcon className="text-yellow-500 text-4xl sm:text-5xl" />
          </div>
        ) : (
          <img
            src={getSteamLogoUrl(gameId)}
            alt=""
            className="h-12 w-12 object-contain drop-shadow-md sm:h-14 sm:w-14"
            onError={(e) => {
              const img = e.target as HTMLImageElement;
              if (isSteamLogoFallbackUrl(img.src, gameId)) {
                setLogoFailed(true);
              } else {
                img.src = getSteamLogoFallbackUrl(gameId);
              }
            }}
          />
        )}
      </TableCell>

      <TableCell className="w-[30%] min-w-0">
        <div className="min-w-0 space-y-1">
          <h3 className="flex items-center gap-2 truncate text-sm font-semibold text-foreground">
            {isSteam && <SteamBrandIcon className="h-4 w-4 shrink-0 opacity-60" />}
            {isRetroAchievements && <RetroAchievementsIcon className="h-4 w-4 shrink-0 opacity-60" />}
            <span className="truncate">{gameName}</span>
          </h3>
          <p className="text-[11px] font-medium text-muted-foreground">AppID: {gameId}</p>
        </div>
      </TableCell>

      <TableCell className="hidden w-[12%] text-center sm:table-cell">
        {source === 'both' ? (
          <Badge variant="secondary" className="h-6 px-2.5">
            <SteamBrandIcon className="h-3.5 w-3.5 opacity-60" />
            Both
          </Badge>
        ) : isRetroAchievements ? (
          <Badge variant="secondary" className="h-6 px-2.5">
            <RetroAchievementsIcon className="h-3.5 w-3.5 opacity-60" />
            RA
          </Badge>
        ) : isSteam ? (
          <Badge variant="secondary" className="h-6 px-2.5">
            <SteamBrandIcon className="h-3.5 w-3.5 opacity-60" />
            Steam
          </Badge>
        ) : (
          <Badge variant="secondary" className="h-6 px-2.5">
            Local
          </Badge>
        )}
      </TableCell>

      <TableCell className="hidden md:table-cell" title={allPaths}>
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-xs font-medium text-muted-foreground">{game.directory}</span>
          {otherDirsCount > 0 && (
            <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
              +{otherDirsCount}
            </Badge>
          )}
        </div>
      </TableCell>

      <TableCell className="w-[22%]">
        <div className="space-y-2">
          <div className="flex min-h-5 items-center justify-between gap-2 text-xs font-semibold">
            <div className="min-w-0">
              {isCompleted && (
                <Badge className="h-5 shrink-0 gap-1 px-2 text-[10px]">
                  <PlatinumIcon
                    className="shrink-0 leading-none opacity-80"
                    style={{ fontSize: 12, lineHeight: 1, fontVariationSettings: "'FILL' 1, 'wght' 300, 'GRAD' 0, 'opsz' 20" }}
                  />
                  {t('gamesPage.completed')}
                </Badge>
              )}
            </div>
            <span className="tabular-nums text-muted-foreground">
              <span className={isCompleted ? 'text-primary' : 'text-foreground'}>{achievementsCurrent}</span>
              <span className="mx-1 opacity-40">/</span>
              {finalTotal}
            </span>
          </div>
          <Progress
            value={progressPercent}
            aria-label={`Progresso de ${gameName}`}
            className={`w-full [&_[data-slot=progress-track]]:h-1.5 [&_[data-slot=progress-track]]:bg-muted/70 ${isCompleted ? '[&_[data-slot=progress-indicator]]:animate-shimmer [&_[data-slot=progress-indicator]]:bg-[length:200%_100%] [&_[data-slot=progress-indicator]]:bg-gradient-to-r [&_[data-slot=progress-indicator]]:from-primary [&_[data-slot=progress-indicator]]:via-primary/80 [&_[data-slot=progress-indicator]]:to-primary [&_[data-slot=progress-indicator]]:shadow-[0_0_15px_var(--primary)]' : '[&_[data-slot=progress-indicator]]:bg-muted-foreground/40 group-hover:[&_[data-slot=progress-indicator]]:bg-primary/70'}`}
          />
        </div>
      </TableCell>
    </TableRow>
  );
};

type SortKey = 'name' | 'path' | 'progress';

const GamesContent: React.FC<{ onGameSelect: (game: SteamSearchResult) => void }> = ({ onGameSelect }) => {
  const { games, gameNames } = useMonitoredAchievements();
  const { gamesViewMode, setGamesViewMode } = useTheme();
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState<'all' | 'steam' | 'retroachievements' | 'local'>('all');
  const [retroGames, setRetroGames] = useState<GameAchievements[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });

  const filteredAndSortedGames = React.useMemo(() => {
    const allGames = [...games, ...retroGames];
    let result = allGames.filter(game => {
      const name = (gameNames[game.gameId] || (game as any).name || '').toLowerCase();
      const query = searchQuery.toLowerCase();
      const matchesSearch = name.includes(query) || game.gameId.includes(query);

      const source = (game as any).source;
      const isSteam = source === 'steam' || source === 'both';
      const isRetroAchievements = source === 'retroachievements';
      const isLocal = source !== 'steam';
      const matchesPlatform =
        platformFilter === 'all' ||
        (platformFilter === 'steam' && isSteam) ||
        (platformFilter === 'retroachievements' && isRetroAchievements) ||
        (platformFilter === 'local' && isLocal && !isRetroAchievements);

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
          const currentA = Number((a as any).achievementsCurrent ?? a.achievements.filter(acc => acc.achieved).length);
          const totalA = Number((a as any).achievementsTotal ?? a.achievements.length) || 1;
          const currentB = Number((b as any).achievementsCurrent ?? b.achievements.filter(acc => acc.achieved).length);
          const totalB = Number((b as any).achievementsTotal ?? b.achievements.length) || 1;
          valA = currentA / totalA;
          valB = currentB / totalB;
          break;
        default:
          return 0;
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [games, retroGames, gameNames, searchQuery, sortConfig, platformFilter]);

  useEffect(() => {
    let cancelled = false;
    getRetroAchievementsRecentGames()
      .then((items) => {
        if (cancelled) return;
        setRetroGames(items.map((game) => ({
          gameId: String(game.id),
          name: game.title,
          achievements: [],
          lastModified: Date.now(),
          directory: 'retroachievements://',
          source: 'retroachievements',
          achievementsCurrent: game.achievementsCurrent,
          achievementsTotal: game.achievementsTotal,
          consoleName: game.consoleName,
          imageUrl: game.imageBoxArt,
          logoUrl: game.imageIcon,
        })));
      })
      .catch(() => setRetroGames([]));
    return () => {
      cancelled = true;
    };
  }, []);

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
      <header className="flex-shrink-0 w-full mb-4">
        <div className="relative group flex-1">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <SearchIcon className={`text-lg transition-colors duration-300 ${searchQuery ? 'text-foreground' : 'text-muted-foreground group-focus-within:text-foreground'}`} />
          </div>
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`${t('sidebar.search')}...`}
            className="w-full h-12 pl-12 pr-14 text-[0.95rem] font-semibold"
          />

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setGamesViewMode(gamesViewMode === 'grid' ? 'list' : 'grid')}
            className="absolute inset-y-1 right-2 h-auto w-10 rounded-md bg-transparent text-muted-foreground hover:bg-transparent hover:text-foreground"
            title={gamesViewMode === 'grid' ? 'Alternar para lista' : 'Alternar para grade'}
            aria-label={gamesViewMode === 'grid' ? 'Alternar para lista' : 'Alternar para grade'}
          >
            {gamesViewMode === 'grid' ? (
              <ListViewIcon className="text-lg" />
            ) : (
              <GridViewIcon className="text-lg" />
            )}
          </Button>
        </div>
      </header>

      <div className="flex-grow overflow-y-auto no-scrollbar pb-10 custom-scrollbar">
        {gamesViewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6 pt-2 pb-5 overflow-visible">
            {filteredAndSortedGames.map(game => (
              <MonitoredGameCard
                key={game.gameId}
                game={game}
                onGameSelect={onGameSelect}
              />
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card/50">
            <Table className="w-full table-fixed">
              <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[6%]" />
                  <TableHead className="w-[30%]">
                    <Button variant="ghost" onClick={() => handleSort('name')} className="group h-auto p-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground hover:bg-transparent hover:text-foreground">
                      Game <SortIndicator column="name" />
                    </Button>
                  </TableHead>
                  <TableHead className="hidden w-[12%] text-center sm:table-cell">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        const filters: ('all' | 'steam' | 'retroachievements' | 'local')[] = ['all', 'steam', 'retroachievements', 'local'];
                        const next = filters[(filters.indexOf(platformFilter) + 1) % filters.length];
                        setPlatformFilter(next);
                      }}
                      className={`group h-auto p-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground hover:bg-transparent hover:text-foreground ${platformFilter !== 'all' ? 'text-foreground' : ''}`}
                    >
                      {platformFilter === 'all' ? 'All' : platformFilter === 'retroachievements' ? 'RA' : platformFilter}
                    </Button>
                  </TableHead>
                  <TableHead className="hidden min-w-0 md:table-cell">
                    <Button variant="ghost" onClick={() => handleSort('path')} className="group h-auto p-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground hover:bg-transparent hover:text-foreground">
                      Path <SortIndicator column="path" />
                    </Button>
                  </TableHead>
                  <TableHead className="w-[22%] text-right">
                    <Button variant="ghost" onClick={() => handleSort('progress')} className="group ml-auto h-auto p-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground hover:bg-transparent hover:text-foreground">
                      Progress <SortIndicator column="progress" />
                    </Button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedGames.map(game => (
                  <MonitoredGameRow
                    key={game.gameId}
                    game={game}
                    onGameSelect={onGameSelect}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
};

export default GamesContent;
