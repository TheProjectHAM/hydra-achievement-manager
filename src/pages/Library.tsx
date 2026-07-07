import React, { useState, useEffect, useMemo, useRef } from 'react';
import { SteamSearchResult } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { useI18n } from '../contexts/I18nContext';
import { getAllSteamLibraryGames } from '../tauri-api';
import { LibraryIcon, GridViewIcon, ListViewIcon, SteamBrandIcon, SearchIcon, WarningIcon, PlatinumIcon, CheckIcon } from '../components/Icons';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  getSteamBackgroundFallbackUrls,
  getSteamLogoFallbackUrl,
  getSteamLogoUrl,
  isSteamLogoFallbackUrl,
} from '@/lib/steam-assets';

interface SteamLibraryGame {
  gameId: string;
  name: string;
  achievementsTotal: number;
  achievementsCurrent: number;
  source: string;
  installed?: boolean;
  playtimeForever?: number;
  playtime2weeks?: number;
  rtimeLastPlayed?: number;
  imgIconUrl?: string;
}

type FilterType = 'all' | 'installed' | 'not_installed';
type SortKey = 'name' | 'playtime' | 'last_played';

const formatPlaytime = (minutes: number | undefined): string => {
  if (!minutes || minutes === 0) return '0h';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
};

const formatLastPlayed = (timestamp: number | undefined): string => {
  if (!timestamp || timestamp === 0) return 'Never';
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
};

const LibraryGameCard: React.FC<{
  game: SteamLibraryGame;
  onGameSelect: (game: SteamSearchResult) => void;
}> = ({ game, onGameSelect }) => {
  const { t } = useI18n();
  const gameId = game.gameId;

  const fallbackImages = getSteamBackgroundFallbackUrls(gameId);
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

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isImageLoaded) setIsImageLoaded(true);
    }, 1200);
    return () => clearTimeout(timer);
  }, [isImageLoaded]);

  const isCompleted = game.achievementsTotal > 0 && game.achievementsCurrent >= game.achievementsTotal;
  const isInstalled = game.installed === true;

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

  const handleSelect = () => {
    onGameSelect({
      id: parseInt(gameId),
      name: game.name,
      achievementsTotal: game.achievementsTotal,
    });
  };

  return (
    <div
      onClick={handleSelect}
      className={`group monitored-game-card relative aspect-[16/9] rounded-md shadow-2xl cursor-pointer transition-all duration-300 border bg-card p-px ${isCompleted ? 'completed-game-card border-transparent' : 'border-border hover:border-foreground/30'}`}
    >
      <div className="relative z-10 h-full w-full overflow-hidden rounded-[5px]">
        <div
          className={`absolute inset-0 bg-cover bg-center transition-opacity duration-500 ${isImageLoaded ? 'opacity-100' : 'opacity-80'}`}
          style={{ backgroundImage: `url(${imageUrl})`, backgroundColor: '#000' }}
        />
        <img src={imageUrl} onError={handleImageError} onLoad={() => setIsImageLoaded(true)} style={{ display: 'none' }} alt="" />

        {!isImageLoaded && <div className="absolute inset-0 bg-black/20" />}

        {backgroundFailed && (
          <div className="absolute inset-0 flex items-center justify-center">
            <WarningIcon className="text-yellow-500/60 text-6xl" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent via-50% to-black/90"></div>

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

        {hoverLogoFailed ? (
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
              <SteamBrandIcon className="h-5 w-5 shrink-0 opacity-75" />
              <span className="truncate">{game.name}</span>
            </h3>
            <div className="flex items-center gap-1 flex-shrink-0">
              {isInstalled ? (
                <span className="inline-flex items-center gap-0.5 rounded-full border border-green-500/30 bg-green-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-green-400">
                  <CheckIcon className="leading-none" style={{ fontSize: 12 }} />
                  {t('libraryPage.installed')}
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full border border-muted-foreground/20 bg-muted/30 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground/70">
                  {t('libraryPage.notInstalled')}
                </span>
              )}
            </div>
          </div>

          {game.achievementsTotal > 0 && (
            <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden mb-1.5">
              <div
                className={`game-card-progress-fill h-full transition-all duration-500 ease-out ${isCompleted
                  ? 'bg-gradient-to-r from-primary via-primary/80 to-primary shadow-[0_0_15px_var(--primary)] animate-shimmer bg-[length:200%_100%]'
                  : 'bg-white/40 group-hover:bg-white/60'
                  }`}
                style={{ width: `${(game.achievementsCurrent / game.achievementsTotal) * 100}%` }}
              ></div>
            </div>
          )}

          <div className="flex items-center gap-3 text-[11px] text-white/60">
            {game.playtimeForever ? (
              <span>{formatPlaytime(game.playtimeForever)}</span>
            ) : null}
            {game.rtimeLastPlayed ? (
              <span>{formatLastPlayed(game.rtimeLastPlayed)}</span>
            ) : null}
            {game.achievementsTotal > 0 && (
              <span className={isCompleted ? 'text-primary' : ''}>
                {game.achievementsCurrent}/{game.achievementsTotal}
              </span>
            )}
          </div>
        </div>

        <div className="absolute inset-0 pointer-events-none transition-shadow duration-300 group-hover:ring-1 group-hover:ring-inset group-hover:ring-white/5"></div>
      </div>
    </div>
  );
};

const LibraryGameRow: React.FC<{
  game: SteamLibraryGame;
  onGameSelect: (game: SteamSearchResult) => void;
}> = ({ game, onGameSelect }) => {
  const { t } = useI18n();
  const gameId = game.gameId;
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    setLogoFailed(false);
  }, [gameId]);

  const isCompleted = game.achievementsTotal > 0 && game.achievementsCurrent >= game.achievementsTotal;
  const isInstalled = game.installed === true;
  const progressPercent = game.achievementsTotal > 0
    ? Math.round((game.achievementsCurrent / game.achievementsTotal) * 100)
    : 0;

  const handleSelect = () => {
    onGameSelect({
      id: parseInt(gameId),
      name: game.name,
      achievementsTotal: game.achievementsTotal,
    });
  };

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
        {logoFailed ? (
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

      <TableCell className="w-[28%] min-w-0">
        <div className="min-w-0 space-y-1">
          <h3 className="flex items-center gap-2 truncate text-sm font-semibold text-foreground">
            <SteamBrandIcon className="h-4 w-4 shrink-0 opacity-60" />
            <span className="truncate">{game.name}</span>
          </h3>
          <p className="text-[11px] font-medium text-muted-foreground">AppID: {gameId}</p>
        </div>
      </TableCell>

      <TableCell className="hidden w-[10%] sm:table-cell">
        {isInstalled ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-green-500/30 bg-green-500/15 px-2 py-0.5 text-[11px] font-semibold text-green-400">
            <CheckIcon className="leading-none" style={{ fontSize: 14 }} />
            {t('libraryPage.installed')}
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full border border-muted-foreground/20 bg-muted/30 px-2 py-0.5 text-[11px] font-medium text-muted-foreground/70">
            {t('libraryPage.notInstalled')}
          </span>
        )}
      </TableCell>

      <TableCell className="hidden w-[12%] md:table-cell">
        <span className="text-xs font-medium text-muted-foreground">
          {game.playtimeForever ? formatPlaytime(game.playtimeForever) : '—'}
        </span>
      </TableCell>

      <TableCell className="hidden w-[12%] lg:table-cell">
        <span className="text-xs font-medium text-muted-foreground">
          {game.rtimeLastPlayed ? formatLastPlayed(game.rtimeLastPlayed) : '—'}
        </span>
      </TableCell>

      <TableCell className="w-[22%]">
        {game.achievementsTotal > 0 ? (
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
                <span className={isCompleted ? 'text-primary' : 'text-foreground'}>{game.achievementsCurrent}</span>
                <span className="mx-1 opacity-40">/</span>
                {game.achievementsTotal}
              </span>
            </div>
            <Progress
              value={progressPercent}
              aria-label={`Progresso de ${game.name}`}
              className={`w-full [&_[data-slot=progress-track]]:h-1.5 [&_[data-slot=progress-track]]:bg-muted/70 ${isCompleted ? '[&_[data-slot=progress-indicator]]:animate-shimmer [&_[data-slot=progress-indicator]]:bg-[length:200%_100%] [&_[data-slot=progress-indicator]]:bg-gradient-to-r [&_[data-slot=progress-indicator]]:from-primary [&_[data-slot=progress-indicator]]:via-primary/80 [&_[data-slot=progress-indicator]]:to-primary [&_[data-slot=progress-indicator]]:shadow-[0_0_15px_var(--primary)]' : '[&_[data-slot=progress-indicator]]:bg-muted-foreground/40 group-hover:[&_[data-slot=progress-indicator]]:bg-primary/70'}`}
            />
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
    </TableRow>
  );
};

const LibraryContent: React.FC<{ onGameSelect: (game: SteamSearchResult) => void }> = ({ onGameSelect }) => {
  const { gamesViewMode, setGamesViewMode } = useTheme();
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });
  const [libraryGames, setLibraryGames] = useState<SteamLibraryGame[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    // Use cached data if available, don't refetch on remount
    if (loadedRef.current) return;

    const cached = localStorage.getItem('steam_library_cache');
    if (cached) {
      try {
        setLibraryGames(JSON.parse(cached));
        setIsLoading(false);
        loadedRef.current = true;
        return;
      } catch { /* ignore bad cache */ }
    }

    setIsLoading(true);
    setError(null);

    getAllSteamLibraryGames()
      .then((games) => {
        setLibraryGames(games);
        localStorage.setItem('steam_library_cache', JSON.stringify(games));
      })
      .catch((err) => {
        console.error('Failed to load Steam library:', err);
        setError(String(err));
      })
      .finally(() => {
        setIsLoading(false);
        loadedRef.current = true;
      });
  }, []);

  const filteredAndSortedGames = useMemo(() => {
    let result = libraryGames.filter(game => {
      const name = (game.name || '').toLowerCase();
      const query = searchQuery.toLowerCase();
      const matchesSearch = name.includes(query) || game.gameId.includes(query);

      const isInstalled = game.installed === true;

      const matchesFilter =
        filter === 'all' ||
        (filter === 'installed' && isInstalled) ||
        (filter === 'not_installed' && !isInstalled);

      return matchesSearch && matchesFilter;
    });

    result.sort((a, b) => {
      let valA: any;
      let valB: any;

      switch (sortConfig.key) {
        case 'name':
          valA = (a.name || '').toLowerCase();
          valB = (b.name || '').toLowerCase();
          break;
        case 'playtime':
          valA = a.playtimeForever || 0;
          valB = b.playtimeForever || 0;
          break;
        case 'last_played':
          valA = a.rtimeLastPlayed || 0;
          valB = b.rtimeLastPlayed || 0;
          break;
        default:
          return 0;
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [libraryGames, searchQuery, sortConfig, filter]);

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

  const filterOptions: { key: FilterType; label: string }[] = [
    { key: 'all', label: t('libraryPage.filterAll') },
    { key: 'installed', label: t('libraryPage.installed') },
    { key: 'not_installed', label: t('libraryPage.notInstalled') },
  ];

  const installedCount = libraryGames.filter(g => g.installed === true).length;
  const notInstalledCount = libraryGames.filter(g => g.installed === false).length;

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
            placeholder={t('libraryPage.searchPlaceholder')}
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

        <div className="flex flex-wrap gap-2 mt-3">
          {filterOptions.map((opt) => (
            <Button
              key={opt.key}
              variant={filter === opt.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(opt.key)}
              className="h-7 px-3 text-xs"
            >
              {opt.label}
              {opt.key === 'installed' && !isLoading && (
                <span className="ml-1.5 text-muted-foreground">({installedCount})</span>
              )}
              {opt.key === 'not_installed' && !isLoading && (
                <span className="ml-1.5 text-muted-foreground">({notInstalledCount})</span>
              )}
            </Button>
          ))}
        </div>
      </header>

      <div className="flex-grow overflow-y-auto no-scrollbar pb-10">
        {isLoading ? (
          gamesViewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6 pt-2 pb-5 overflow-visible">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="aspect-[16/9] rounded-md overflow-hidden">
                  <Skeleton className="w-full h-full" />
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border bg-card/50">
              <Table className="w-full table-fixed">
                <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[6%]" />
                    <TableHead className="w-[28%]"><div className="h-4 w-20" /></TableHead>
                    <TableHead className="hidden w-[10%] sm:table-cell"><div className="h-4 w-12" /></TableHead>
                    <TableHead className="hidden w-[12%] md:table-cell"><div className="h-4 w-16" /></TableHead>
                    <TableHead className="hidden w-[12%] lg:table-cell"><div className="h-4 w-16" /></TableHead>
                    <TableHead className="w-[22%]"><div className="h-4 w-20" /></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="w-10 h-10 rounded" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <WarningIcon className="text-yellow-500 text-5xl mb-4" />
            <p className="text-sm text-muted-foreground mb-2">{t('libraryPage.error')}</p>
            <p className="text-xs text-muted-foreground/70 max-w-md">{error}</p>
          </div>
        ) : filteredAndSortedGames.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <LibraryIcon className="text-muted-foreground/30 text-6xl mb-4" />
            <p className="text-sm text-muted-foreground">{t('libraryPage.noResults')}</p>
          </div>
        ) : (
          gamesViewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6 pt-2 pb-5 overflow-visible">
              {filteredAndSortedGames.map(game => (
                <LibraryGameCard
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
                    <TableHead className="w-[28%]">
                      <Button variant="ghost" onClick={() => handleSort('name')} className="group h-auto p-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground hover:bg-transparent hover:text-foreground">
                        Game <SortIndicator column="name" />
                      </Button>
                    </TableHead>
                    <TableHead className="hidden w-[10%] sm:table-cell">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Status</span>
                    </TableHead>
                    <TableHead className="hidden w-[12%] md:table-cell">
                      <Button variant="ghost" onClick={() => handleSort('playtime')} className="group h-auto p-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground hover:bg-transparent hover:text-foreground">
                        Playtime <SortIndicator column="playtime" />
                      </Button>
                    </TableHead>
                    <TableHead className="hidden w-[12%] lg:table-cell">
                      <Button variant="ghost" onClick={() => handleSort('last_played')} className="group h-auto p-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground hover:bg-transparent hover:text-foreground">
                        Last Played <SortIndicator column="last_played" />
                      </Button>
                    </TableHead>
                    <TableHead className="w-[22%] text-right">
                      <Button variant="ghost" onClick={() => handleSort('playtime')} className="group ml-auto h-auto p-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground hover:bg-transparent hover:text-foreground">
                        Progress <SortIndicator column="playtime" />
                      </Button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedGames.map(game => (
                    <LibraryGameRow
                      key={game.gameId}
                      game={game}
                      onGameSelect={onGameSelect}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default LibraryContent;
