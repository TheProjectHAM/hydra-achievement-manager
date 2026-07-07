import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { SteamSearchResult } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { useI18n } from '../contexts/I18nContext';
import { getAllSteamLibraryGames, getHydraLibraryGames, getRetroAchievementsLibraryGames, HydraLibraryGame } from '../tauri-api';
import AlphabetScrollbar from '../components/AlphabetScrollbar';
import { LibraryIcon, GridViewIcon, ListViewIcon, SteamBrandIcon, SearchIcon, WarningIcon, PlatinumIcon, CheckIcon, RetroAchievementsIcon } from '../components/Icons';
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
import { getRetroAchievementsGameImage } from '@/lib/retro-achievements-assets';

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
  consoleName?: string | null;
  imageBoxArt?: string | null;
  imageIcon?: string | null;
}

type SortKey = 'name' | 'playtime' | 'last_played';
type LibrarySourceFilter = 'all' | 'steam' | 'hydra' | 'retroachievements';

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
  const isRetro = game.source === 'retroachievements';

  const fallbackImages = isRetro
    ? [getRetroAchievementsGameImage({ imageUrl: game.imageBoxArt, logoUrl: game.imageIcon })]
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
      source: isRetro ? 'retroachievements' : undefined,
      consoleName: game.consoleName,
      imageUrl: game.imageBoxArt,
      logoUrl: game.imageIcon,
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

        {isRetro ? null : hoverLogoFailed ? (
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
              {isRetro ? (
                <RetroAchievementsIcon className="h-5 w-5 shrink-0 opacity-75" />
              ) : (
                <SteamBrandIcon className="h-5 w-5 shrink-0 opacity-75" />
              )}
              <span className="truncate">{game.name}</span>
            </h3>
            <div className="flex items-center gap-1 flex-shrink-0">
              {isRetro ? (
                game.consoleName && (
                  <span className="inline-flex items-center rounded-full border border-muted-foreground/20 bg-muted/30 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground/70 truncate max-w-[120px]">
                    {game.consoleName}
                  </span>
                )
              ) : isInstalled ? (
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
            {!isRetro && game.playtimeForever ? (
              <span>{formatPlaytime(game.playtimeForever)}</span>
            ) : null}
            {!isRetro && game.rtimeLastPlayed ? (
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
  'data-alpha-ref'?: string;
}> = ({ game, onGameSelect, ...rest }) => {
  const { t } = useI18n();
  const gameId = game.gameId;
  const isRetro = game.source === 'retroachievements';
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
      source: isRetro ? 'retroachievements' : undefined,
      consoleName: game.consoleName,
      imageUrl: game.imageBoxArt,
      logoUrl: game.imageIcon,
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
      data-alpha-ref={rest['data-alpha-ref']}
    >
      <TableCell className="w-[6%] p-2 sm:p-3">
        {isRetro ? (
          <img
            src={game.imageIcon || game.imageBoxArt || getRetroAchievementsGameImage({ imageUrl: game.imageBoxArt, logoUrl: game.imageIcon })}
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

      <TableCell className="w-[28%] min-w-0">
        <div className="min-w-0 space-y-1">
          <h3 className="flex items-center gap-2 truncate text-sm font-semibold text-foreground">
            {isRetro ? (
              <RetroAchievementsIcon className="h-4 w-4 shrink-0 opacity-60" />
            ) : (
              <SteamBrandIcon className="h-4 w-4 shrink-0 opacity-60" />
            )}
            <span className="truncate">{game.name}</span>
          </h3>
          <p className="text-[11px] font-medium text-muted-foreground">
            {isRetro ? (game.consoleName || 'RetroAchievements') : `AppID: ${gameId}`}
          </p>
        </div>
      </TableCell>

      <TableCell className="hidden w-[10%] sm:table-cell">
        {isRetro ? (
          <span className="inline-flex items-center rounded-full border border-muted-foreground/20 bg-muted/30 px-2 py-0.5 text-[11px] font-medium text-muted-foreground/70">
            Retro
          </span>
        ) : isInstalled ? (
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
          {isRetro ? '—' : (game.playtimeForever ? formatPlaytime(game.playtimeForever) : '—')}
        </span>
      </TableCell>

      <TableCell className="hidden w-[12%] lg:table-cell">
        <span className="text-xs font-medium text-muted-foreground">
          {isRetro ? '—' : (game.rtimeLastPlayed ? formatLastPlayed(game.rtimeLastPlayed) : '—')}
        </span>
      </TableCell>

      <TableCell className="w-[22%]">
        {game.achievementsTotal > 0 ? (
          <div className="space-y-2">
            <div className="flex min-h-5 items-center justify-between gap-2 text-xs font-semibold">
              <div className="min-w-0">
                {isCompleted && (
                  <span className="inline-flex h-5 shrink-0 items-center gap-1 rounded-full border border-primary/30 bg-primary/90 px-2 text-[10px] font-semibold text-primary-foreground">
                    <PlatinumIcon
                      className="shrink-0 leading-none opacity-80"
                      style={{ fontSize: 12, lineHeight: 1, fontVariationSettings: "'FILL' 1, 'wght' 300, 'GRAD' 0, 'opsz' 20" }}
                    />
                    {t('gamesPage.completed')}
                  </span>
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

const FilterSection: React.FC<{
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ label, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
      >
        {label}
        <svg
          className={`w-3 h-3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M3 4.5L6 7.5L9 4.5" />
        </svg>
      </button>
      {open && <div className="pb-1">{children}</div>}
    </div>
  );
};

const CheckboxItem: React.FC<{
  label: string;
  checked: boolean;
  onChange: () => void;
  count?: number;
}> = ({ label, checked, onChange, count }) => (
  <label className="flex items-center gap-2.5 px-2 py-1 rounded-md cursor-pointer text-sm transition-colors hover:bg-accent text-foreground">
    <span className={`flex items-center justify-center size-4 rounded flex-shrink-0 transition-colors ${checked ? 'bg-primary border-primary' : 'border border-border bg-background'}`}>
      {checked && (
        <svg className="size-3 text-primary-foreground" viewBox="0 0 16 16" fill="currentColor">
          <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
        </svg>
      )}
    </span>
    <span className="font-medium truncate flex-1">{label}</span>
    {count !== undefined && count > 0 && (
      <span className="text-[10px] text-muted-foreground tabular-nums">{count}</span>
    )}
    <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
  </label>
);

const sourceOptions: { value: LibrarySourceFilter; label: string; icon: React.ReactNode }[] = [
  { value: 'all', label: 'All Sources', icon: <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg> },
  { value: 'steam', label: 'Steam', icon: <SteamBrandIcon className="h-3.5 w-3.5" /> },
  { value: 'hydra', label: 'Hydra', icon: <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg> },
  { value: 'retroachievements', label: 'RetroAchievements', icon: <RetroAchievementsIcon className="h-3.5 w-3.5" /> },
];

const LibraryContent: React.FC<{ onGameSelect: (game: SteamSearchResult) => void }> = ({ onGameSelect }) => {
  const { gamesViewMode, setGamesViewMode } = useTheme();
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });
  const [libraryGames, setLibraryGames] = useState<SteamLibraryGame[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeAlphaChar, setActiveAlphaChar] = useState<string | null>(null);
  const gameRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Filter state
  const [filterOpen, setFilterOpen] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<LibrarySourceFilter>('all');
  const [hideInstalled, setHideInstalled] = useState(false);
  const [hideNotInstalled, setHideNotInstalled] = useState(false);
  const [hideZeroAchievements, setHideZeroAchievements] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    const CACHE_KEY = 'steam_library_cache';

    // Load cache immediately to show something while fetching
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        setLibraryGames(JSON.parse(cached));
        setIsLoading(false);
      } catch { /* ignore bad cache */ }
    }

    // Always try to fetch fresh data
    setIsLoading(true);
    setError(null);

    Promise.all([
      getAllSteamLibraryGames().catch((err) => {
        console.error('[Library] Failed to load Steam library:', err);
        return [] as SteamLibraryGame[];
      }),
      getHydraLibraryGames().catch((err) => {
        console.error('[Library] Failed to load Hydra library:', err);
        return [] as HydraLibraryGame[];
      }),
      getRetroAchievementsLibraryGames().catch((err) => {
        console.error('[Library] Failed to load RetroAchievements library:', err);
        return [] as any[];
      }),
    ])
      .then(([steamGames, hydraGames, retroGames]) => {
        console.log(`[Library] Steam: ${steamGames.length}, Hydra: ${hydraGames.length}, RetroAchievements: ${retroGames.length}`);

        const steamMap = new Map<string, SteamLibraryGame>();
        for (const game of steamGames) {
          steamMap.set(game.gameId, game);
        }

        const merged = [...steamGames];
        for (const hg of hydraGames) {
          if (hg.isDeleted) continue;
          if (hg.shop !== 'steam') continue;
          if (!hg.objectId) continue;
          if (steamMap.has(hg.objectId)) continue;

          merged.push({
            gameId: hg.objectId,
            name: hg.title,
            achievementsTotal: hg.achievementCount || 0,
            achievementsCurrent: hg.unlockedAchievementCount || 0,
            source: 'hydra',
            installed: false,
            playtimeForever: hg.playTimeInMilliseconds
              ? Math.floor(hg.playTimeInMilliseconds / 60000)
              : undefined,
            rtimeLastPlayed: hg.lastTimePlayed
              ? Math.floor(new Date(hg.lastTimePlayed).getTime() / 1000)
              : undefined,
            imgIconUrl: hg.iconUrl || undefined,
          });
        }

        for (const rg of retroGames) {
          const rgId = String(rg.id);
          if (steamMap.has(rgId)) continue;

          merged.push({
            gameId: rgId,
            name: rg.title,
            achievementsTotal: rg.achievementsTotal || 0,
            achievementsCurrent: rg.achievementsCurrent || 0,
            source: 'retroachievements',
            consoleName: rg.consoleName || null,
            imageBoxArt: rg.imageBoxArt || null,
            imageIcon: rg.imageIcon || null,
          });
        }

        console.log(`[Library] Merged: ${merged.length} total`);

        setLibraryGames(merged);
        localStorage.setItem(CACHE_KEY, JSON.stringify(merged));
      })
      .catch((err) => {
        console.error('[Library] Fetch failed, using cache:', err);
        setError(String(err));
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  // Source match counts
  const sourceMatchCounts = useMemo(() => {
    const counts: Record<string, number> = { steam: 0, hydra: 0, retroachievements: 0 };
    for (const game of libraryGames) {
      const src = game.source || 'steam';
      if (src in counts) counts[src]++;
    }
    return counts;
  }, [libraryGames]);

  const { filteredGames, hiddenCount } = useMemo(() => {
    let hidden = 0;
    const filtered = libraryGames.filter(game => {
      const name = (game.name || '').toLowerCase();
      const query = searchQuery.toLowerCase();
      if (query && !name.includes(query) && !game.gameId.includes(query)) return false;

      // Source filter
      const gameSource = game.source || 'steam';
      if (sourceFilter !== 'all' && gameSource !== sourceFilter) return false;

      // Status filters
      const isInstalled = game.installed === true;
      if (hideInstalled && isInstalled) { hidden++; return false; }
      if (hideNotInstalled && !isInstalled) { hidden++; return false; }

      // Zero achievements filter
      if (hideZeroAchievements && game.achievementsTotal === 0) { hidden++; return false; }

      return true;
    });

    // Sort
    filtered.sort((a, b) => {
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

    return { filteredGames: filtered, hiddenCount: hidden };
  }, [libraryGames, searchQuery, sortConfig, sourceFilter, hideInstalled, hideNotInstalled, hideZeroAchievements]);

  const activeFiltersCount = (sourceFilter === 'all' ? 0 : 1)
    + (hideInstalled ? 1 : 0)
    + (hideNotInstalled ? 1 : 0)
    + (hideZeroAchievements ? 1 : 0);

  const getGameLetter = useCallback((game: SteamLibraryGame): string => {
    const first = (game.name || game.gameId || '')[0] || '#';
    if (/[0-9]/.test(first)) return '#';
    return first.toUpperCase();
  }, []);

  const availableChars = useMemo(() => {
    const chars = new Set<string>();
    for (const game of filteredGames) {
      chars.add(getGameLetter(game));
    }
    return chars;
  }, [filteredGames, getGameLetter]);

  const scrollLockRef = useRef(0);

  const scrollToChar = useCallback((char: string) => {
    const target = char === '0-9' ? '#' : char;
    for (const game of filteredGames) {
      if (getGameLetter(game) === target) {
        const el = gameRefs.current.get(game.gameId)
          || scrollRef.current?.querySelector(`[data-alpha-ref="${game.gameId}"]`);
        if (el) {
          scrollLockRef.current = Date.now() + 800;
          setActiveAlphaChar(char);
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }
      }
    }
  }, [filteredGames, getGameLetter]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || filteredGames.length === 0) return;

    const getElTop = (el: Element) => {
      const containerRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      return elRect.top - containerRect.top + container.scrollTop;
    };

    let ticking = false;
    let lastScrollTop = container.scrollTop;
    const onScroll = () => {
      if (Date.now() < scrollLockRef.current) return;
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const scrollTop = container.scrollTop;
        const goingDown = scrollTop >= lastScrollTop;
        lastScrollTop = scrollTop;
        const viewH = container.clientHeight;
        const scrollBottom = scrollTop + viewH;

        if (goingDown) {
          let lastVisible: string | null = null;
          for (const game of filteredGames) {
            const el = gameRefs.current.get(game.gameId)
              || scrollRef.current?.querySelector(`[data-alpha-ref="${game.gameId}"]`);
            if (!el) continue;
            const elTop = getElTop(el);
            if (elTop <= scrollBottom) {
              const letter = getGameLetter(game) === '#' ? '0-9' : getGameLetter(game);
              if (lastVisible !== letter) lastVisible = letter;
            }
          }
          if (lastVisible) setActiveAlphaChar(lastVisible);
        } else {
          for (const game of filteredGames) {
            const el = gameRefs.current.get(game.gameId)
              || scrollRef.current?.querySelector(`[data-alpha-ref="${game.gameId}"]`);
            if (!el) continue;
            const elTop = getElTop(el);
            const elBottom = elTop + (el as HTMLElement).offsetHeight;
            if (elBottom >= scrollTop) {
              const letter = getGameLetter(game) === '#' ? '0-9' : getGameLetter(game);
              setActiveAlphaChar(letter);
              return;
            }
          }
        }
      });
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, [filteredGames, getGameLetter]);

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
      <header className="flex-shrink-0 w-full mb-4 relative z-50">
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

          <div className="absolute inset-y-0 right-2 flex items-center gap-1 z-10">
            <button
              ref={buttonRef}
              type="button"
              onClick={() => setFilterOpen(!filterOpen)}
              className="relative flex items-center justify-center size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title={t('searchPage.searchFilters')}
            >
              <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              {activeFiltersCount > 0 && (
                <span className="absolute -top-1 -right-1 size-3.5 rounded-full bg-primary text-primary-foreground text-[8px] font-bold flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setGamesViewMode(gamesViewMode === 'grid' ? 'list' : 'grid')}
              className="flex items-center justify-center size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title={gamesViewMode === 'grid' ? 'Alternar para lista' : 'Alternar para grade'}
            >
              {gamesViewMode === 'grid' ? (
                <GridViewIcon className="text-lg" />
              ) : (
                <ListViewIcon className="text-lg" />
              )}
            </button>
          </div>

          {filterOpen && (
            <div
              ref={filterRef}
              className="absolute top-full right-0 mt-2 w-64 max-h-[70vh] rounded-lg bg-popover shadow-xl shadow-black/20 z-50 animate-in fade-in-0 zoom-in-95 overflow-hidden flex flex-col"
            >
              <div className="overflow-y-auto custom-scrollbar p-1 flex-1 min-h-0">
                <FilterSection label="Source" defaultOpen>
                  {sourceOptions.map((option) => (
                    <label
                      key={option.value}
                      className={`flex items-center gap-2.5 px-2 py-1 rounded-md cursor-pointer text-sm transition-colors hover:bg-accent ${sourceFilter === option.value ? 'text-foreground' : 'text-muted-foreground'}`}
                    >
                      <span className="flex items-center justify-center size-4 rounded border border-border flex-shrink-0 bg-background">
                        {sourceFilter === option.value && (
                          <svg className="size-3 text-primary" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
                          </svg>
                        )}
                      </span>
                      <span className="flex items-center gap-2 flex-1 min-w-0">
                        {option.icon}
                        <span className="font-medium truncate">{option.label}</span>
                      </span>
                      {option.value !== 'all' && sourceMatchCounts[option.value] !== undefined && (
                        <span className="text-[10px] text-muted-foreground tabular-nums">{sourceMatchCounts[option.value]}</span>
                      )}
                      <input
                        type="radio"
                        name="library-source"
                        value={option.value}
                        checked={sourceFilter === option.value}
                        onChange={() => setSourceFilter(option.value)}
                        className="sr-only"
                      />
                    </label>
                  ))}
                </FilterSection>

                <div className="h-px bg-border mx-1" />

                <FilterSection label="Status" defaultOpen>
                  <CheckboxItem
                    label={t('libraryPage.installed')}
                    checked={!hideInstalled}
                    onChange={() => setHideInstalled(!hideInstalled)}
                    count={libraryGames.filter(g => g.installed === true).length}
                  />
                  <CheckboxItem
                    label={t('libraryPage.notInstalled')}
                    checked={!hideNotInstalled}
                    onChange={() => setHideNotInstalled(!hideNotInstalled)}
                    count={libraryGames.filter(g => g.installed === false).length}
                  />
                </FilterSection>

                <div className="h-px bg-border mx-1" />

                <FilterSection label="Exclusions" defaultOpen>
                  <CheckboxItem
                    label="0 achievements"
                    checked={hideZeroAchievements}
                    onChange={() => setHideZeroAchievements(!hideZeroAchievements)}
                  />
                </FilterSection>
              </div>

              {hiddenCount > 0 && (
                <>
                  <div className="h-px bg-border" />
                  <div className="px-3 py-2 text-[11px] text-muted-foreground flex-shrink-0">
                    <span className="font-semibold text-foreground">{hiddenCount}</span> game{hiddenCount !== 1 ? 's' : ''} hidden
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="flex-grow flex overflow-hidden pb-4 gap-2">
        <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar">
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
        ) : filteredGames.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <LibraryIcon className="text-muted-foreground/30 text-6xl mb-4" />
            <p className="text-sm text-muted-foreground">{t('libraryPage.noResults')}</p>
          </div>
        ) : (
          gamesViewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6 pt-2 pb-5 overflow-visible">
              {filteredGames.map(game => (
                <div
                  key={game.gameId}
                  ref={(el) => { if (el) gameRefs.current.set(game.gameId, el); }}
                >
                  <LibraryGameCard
                    game={game}
                    onGameSelect={onGameSelect}
                  />
                </div>
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
                  {filteredGames.map(game => (
                    <LibraryGameRow
                      key={game.gameId}
                      game={game}
                      onGameSelect={onGameSelect}
                      data-alpha-ref={game.gameId}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )
        )}
        </div>

        {!isLoading && filteredGames.length > 0 && (
          <div className="flex-shrink-0 h-full py-2">
            <AlphabetScrollbar
              onCharSelect={scrollToChar}
              activeChar={activeAlphaChar}
              availableChars={availableChars}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default LibraryContent;
