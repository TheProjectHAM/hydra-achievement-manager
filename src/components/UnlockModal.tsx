import React, { useState, useEffect, useMemo } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { getSteamLibraryInfo, getAchievementIniLastModified, getSteamGames, getGameWinePaths, getMonitoredDirectories, loadSettings } from '../tauri-api';
import { SteamSearchResult } from '../types';
import { FolderIcon, SteamBrandIcon, HydraIcon, RetroAchievementsIcon } from './Icons';
import { useTheme } from '../contexts/ThemeContext';
import { formatDateObj } from '../formatters';
import { useMonitoredAchievements } from '../contexts/MonitoredAchievementsContext';
import { UnlockMode } from './GlobalTimestampManager';
import { cn } from '@/lib/utils';
import { getAppPlatform } from '@/lib/platform';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getSteamHeaderUrl, getSteamLogoUrl } from '@/lib/steam-assets';
import { XIcon } from 'lucide-react';

interface UnlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (path: string) => void;
  game: SteamSearchResult;
  newAchievementCount: number;
  unlockMode?: UnlockMode;
}

const normalizePath = (input: string) => input.replace(/[\\]+/g, '/');

const formatUsersForDisplay = (input: string) =>
  input.replace(/(^|[\\/])users(?=[\\/])/gi, '$1Users');

const isHydraWinePrefixPath = (path: string) =>
  normalizePath(path).includes('/.config/hydralauncher/wine-prefixes/');

const getPathTitle = (input: string, fallback: string) => {
  const normalized = normalizePath(input);
  const parts = normalized.split('/').filter(Boolean);
  return parts[parts.length - 1] || fallback;
};

const getCrackerName = (input: string) => {
  const normalized = normalizePath(input).toLowerCase();
  if (normalized.includes('/codex/')) return 'CODEX';
  if (normalized.includes('/rune/')) return 'RUNE';
  if (normalized.includes('/goldberg steamemu saves/') || normalized.includes('/gse saves/')) return 'Goldberg';
  if (normalized.includes('/online fix/')) return 'ONLINE FIX';
  if (normalized.includes('/empress/')) return 'EMPRESS';
  if (normalized.includes('/creamapi/')) return 'CreamAPI';
  if (normalized.includes('/smartsteamemu/')) return 'SmartSteamEmu';
  if (normalized.includes('/rld/') || normalized.includes('/reloaded/')) return 'RLE';
  if (normalized.includes('/skidrow/')) return 'SKIDROW';
  if (normalized.includes('/ali213/')) return 'ALi213';
  if (normalized.includes('/dodi/')) return 'DODI';
  return null;
};

const getPrefixLabel = (path: string) => {
  const normalized = normalizePath(path);
  const isWinePath = !path.startsWith('steam://') && normalized.includes('/drive_c/');
  if (normalized.includes('/.config/hydralauncher/wine-prefixes/')) return 'Hydra Launcher prefix';
  if (normalized.includes('/.wine/drive_c/')) return 'Wine default prefix';
  if (isWinePath) return 'Wine/Proton prefix';
  if (path.startsWith('steam://')) return 'Steam library';
  if (path.startsWith('retroachievements://')) return 'RetroAchievements';
  return 'Local folder';
};

const getPathPreview = (path: string, steamVdfPath?: string | null) => {
  if (path.startsWith('steam://')) return steamVdfPath || 'libraryfolders.vdf not found';
  if (path.startsWith('retroachievements://')) return 'Unlock through RetroAchievements API';
  const normalized = normalizePath(path);
  const isWinePath = normalized.includes('/drive_c/');
  const displayPath = isWinePath ? (normalized.split('/drive_c/')[1] || path) : path;
  return formatUsersForDisplay(displayPath);
};

const getMetricLabel = (existingAchievementCount: number | null, newAchievementCount: number) => {
  if (existingAchievementCount === null) return 'New';
  return (
    <>
      {existingAchievementCount}
      <span className="mx-0.5 font-black">›</span>
      {newAchievementCount}
    </>
  );
};

const PathRow: React.FC<{
  path: string;
  isSelected: boolean;
  existingAchievementCount: number | null;
  lastModified: Date | null;
  steamVdfPath?: string | null;
  steamVdfLastModified?: Date | null;
  newAchievementCount: number;
  onSelect: () => void;
}> = ({ path, isSelected, existingAchievementCount, lastModified, steamVdfPath, steamVdfLastModified, newAchievementCount, onSelect }) => {
  const { t } = useI18n();
  const { dateFormat, timeFormat } = useTheme();
  const isSteam = path.startsWith('steam://');
  const isRetroAchievements = path.startsWith('retroachievements://');
  const hasExistingFile = existingAchievementCount !== null && !isSteam && !isRetroAchievements;
  const normalizedPath = normalizePath(path);
  const isWinePath = !isSteam && !isRetroAchievements && normalizedPath.includes('/drive_c/');
  const prefixGameId = normalizedPath.match(/\/wine-prefixes\/([^/]+)\/drive_c\//)?.[1] ?? null;
  const wineUser = normalizedPath.match(/\/drive_c\/users\/([^/]+)\//i)?.[1] ?? null;
  const crackerName = getCrackerName(path);
  const prefixLabel = getPrefixLabel(path);
  const displayPathFormatted = getPathPreview(path, steamVdfPath);
  const displayTitle = isWinePath
    ? [crackerName, getPathTitle(displayPathFormatted, prefixLabel)].filter(Boolean).join(' · ')
    : getPathTitle(displayPathFormatted, path);

  const formattedLastModified = lastModified ? formatDateObj(lastModified, dateFormat, timeFormat) : '';
  const formattedSteamVdfLastModified = steamVdfLastModified ? formatDateObj(steamVdfLastModified, dateFormat, timeFormat) : '';
  const lastModifiedText = isSteam
    ? t('unlockModal.lastModified', { date: formattedSteamVdfLastModified || '--' })
    : t('unlockModal.lastModified', { date: formattedLastModified || '--' });
  const statusText = getMetricLabel(existingAchievementCount, newAchievementCount);
  const badgeText = isSteam ? 'Steam' : isRetroAchievements ? 'RA' : hasExistingFile ? statusText : t('unlockModal.newPath');
  const isFaded = !isSteam && !isRetroAchievements && !hasExistingFile && !isSelected;

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl border transition-all duration-200 cursor-pointer min-h-[92px]',
        isFaded && 'opacity-55',
        isSelected
          ? 'border-foreground/80 bg-accent shadow-[0_0_0_1px_hsl(var(--foreground)/0.35)]'
          : 'border-border hover:border-foreground/25 hover:bg-accent/60'
      )}
      onClick={onSelect}
      role="radio"
      aria-checked={isSelected}
      tabIndex={0}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onSelect()}
    >
      <div className="grid min-h-[96px] grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:px-4.5 sm:py-3.5">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center justify-self-center overflow-hidden text-foreground/85">
          {isSteam ? (
            <SteamBrandIcon className="h-8 w-8" />
          ) : isRetroAchievements ? (
            <RetroAchievementsIcon className="h-8 w-8 text-foreground/85" />
          ) : prefixLabel === 'Hydra Launcher prefix' ? (
            <HydraIcon className="h-8 w-8 text-foreground/85" />
          ) : (
            <FolderIcon className="leading-none" style={{ fontSize: '2.25rem' }} />
          )}
        </div>

        <div className="min-w-0 self-center space-y-1">
          <div className="flex min-w-0 items-center gap-2">
            <p className="min-w-0 truncate text-sm font-semibold leading-5 text-foreground">
              {isSteam ? 'Steam Library' : isRetroAchievements ? 'RetroAchievements' : displayTitle}
            </p>
          </div>

          <p className="whitespace-normal break-all text-[11px] font-medium leading-4 text-muted-foreground" title={displayPathFormatted}>
            {displayPathFormatted}
          </p>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-medium text-muted-foreground">
            <span className="truncate" title={lastModifiedText}>
              {lastModifiedText}
            </span>
          </div>
        </div>

        <div className="flex items-center self-center">
          <span
            className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold whitespace-nowrap bg-muted text-muted-foreground')}
          >
            {badgeText}
          </span>
        </div>
      </div>
    </div>
  );
};

type ProviderKey = 'steam' | 'retroachievements' | 'hydra' | 'global';

interface ProviderGroup {
  key: ProviderKey;
  title: string;
  subtitle: string;
  paths: string[];
  icon: React.ReactNode;
}

const UnlockModal: React.FC<UnlockModalProps> = ({ isOpen, onClose, onConfirm, game, newAchievementCount, unlockMode }) => {
  const { t } = useI18n();
  const { games: monitoredGames } = useMonitoredAchievements();
  const [selectedPath, setSelectedPath] = useState('');
  const [gameWinePaths, setGameWinePaths] = useState<string[]>([]);
  const [globalPaths, setGlobalPaths] = useState<string[]>([]);
  const [steamVdfPath, setSteamVdfPath] = useState<string | null>(null);
  const [steamVdfLastModified, setSteamVdfLastModified] = useState<Date | null>(null);
  const [iniLastModifiedByPath, setIniLastModifiedByPath] = useState<Record<string, Date | null>>({});
  const [hasSteamPathForCurrentGame, setHasSteamPathForCurrentGame] = useState(false);
  const [hasRetroAchievementsWebSession, setHasRetroAchievementsWebSession] = useState(false);
  const [activeProvider, setActiveProvider] = useState<ProviderKey>('steam');
  const [gameLogoFailed, setGameLogoFailed] = useState(false);
  const isLinux = getAppPlatform() === 'linux';
  const isRetroAchievementsGame = (game as any)?.source === 'retroachievements' || (game as any)?.directory === 'retroachievements://';

  useEffect(() => {
    if (isOpen) {
      setSelectedPath('');
      setIniLastModifiedByPath({});
      setHasSteamPathForCurrentGame(false);
      setGameLogoFailed(false);
      setGameWinePaths([]);
      setGlobalPaths([]);
      const gameId = game?.id?.toString();
      getMonitoredDirectories()
        .then((dirs: any[]) => {
          const paths = dirs
            .filter((d: any) => d.enabled && !isHydraWinePrefixPath(d.path))
            .map((d: any) => d.path)
            .filter((path: string) => !path.startsWith('steam://'));
          setGlobalPaths(Array.from(new Set(paths)));
        })
        .catch(() => setGlobalPaths([]));
      if (isLinux && gameId) {
        getGameWinePaths(gameId)
          .then((dirs: any[]) => {
            const paths = dirs.filter((d: any) => d.enabled).map((d: any) => d.path);
            setGameWinePaths(paths);
          })
          .catch(() => setGameWinePaths([]));
      }
      getSteamGames()
        .then((steamGames: any[]) => {
          const gameId = game?.id?.toString();
          const found = Array.isArray(steamGames)
            && steamGames.some((g: any) => g?.gameId?.toString() === gameId);
          setHasSteamPathForCurrentGame(found);
        })
        .catch(() => {
          setHasSteamPathForCurrentGame(false);
        });
      getSteamLibraryInfo()
        .then((info: any) => {
          setSteamVdfPath(info?.vdfPath ?? null);
          setSteamVdfLastModified(
            info?.lastModified ? new Date(info.lastModified * 1000) : null
          );
        })
        .catch(() => {
          setSteamVdfPath(null);
          setSteamVdfLastModified(null);
        });
      loadSettings()
        .then((settings) => {
          setHasRetroAchievementsWebSession(!!String(settings?.retroAchievementsWebCookie || '').trim());
        })
        .catch(() => setHasRetroAchievementsWebSession(false));
    }
  }, [isOpen, game, isLinux]);

  useEffect(() => {
    if (!isOpen || !game) return;

    const localPaths = isLinux
      ? [...gameWinePaths, ...globalPaths]
      : globalPaths;
    const allPaths = Array.from(new Set([
      ...(hasSteamPathForCurrentGame ? ['steam://'] : []),
      ...localPaths
    ]));

    const iniPaths = allPaths.filter((p) => !p.startsWith('steam://'));
    if (iniPaths.length === 0) return;

    let cancelled = false;
    Promise.all(
      iniPaths.map(async (path) => {
        try {
          const ts = await getAchievementIniLastModified(game.id.toString(), path);
          return [path, ts ? new Date(ts * 1000) : null] as const;
        } catch {
          return [path, null] as const;
        }
      })
    ).then((entries) => {
      if (cancelled) return;
      const map: Record<string, Date | null> = {};
      for (const [path, date] of entries) map[path] = date;
      setIniLastModifiedByPath(map);
    });

    return () => {
      cancelled = true;
    };
  }, [isOpen, game, monitoredGames, hasSteamPathForCurrentGame, gameWinePaths, globalPaths, isLinux]);

  const getExistingFileInfo = (path: string) => {
    const gameInPath = monitoredGames.find(g => g.gameId === game.id.toString() && g.directory === path);
    if (gameInPath) {
      return {
        count: gameInPath.achievements.length,
        lastModified: iniLastModifiedByPath[path] ?? gameInPath.lastModified
      };
    }
    return null;
  };

  const handleConfirm = () => {
    if (selectedPath) {
      onConfirm(selectedPath);
    }
  };

  const steamPaths = hasSteamPathForCurrentGame ? ['steam://'] : [];
  const retroAchievementsPaths = isRetroAchievementsGame ? ['retroachievements://'] : [];
  const hydraPaths = gameWinePaths;
  const globalOnlyPaths = globalPaths.filter(p => !hydraPaths.includes(p));

  const steamArtUrl = isRetroAchievementsGame
    ? ((game as any).imageUrl || (game as any).logoUrl || getSteamHeaderUrl(game.id))
    : getSteamHeaderUrl(game.id);
  const gameLogoUrl = isRetroAchievementsGame
    ? ((game as any).logoUrl || (game as any).imageUrl || getSteamLogoUrl(game.id))
    : getSteamLogoUrl(game.id);
  const providerGroups = useMemo<ProviderGroup[]>(() => ([
    {
      key: 'steam',
      title: 'Steam',
      subtitle: steamPaths.length > 0 ? 'Steamworks provider' : 'Unavailable for this game',
      paths: steamPaths,
      icon: <SteamBrandIcon className="h-5 w-5" />,
    },
    {
      key: 'retroachievements',
      title: 'RetroAchievements',
      subtitle: retroAchievementsPaths.length > 0 ? 'RetroAchievements API' : 'Only available for RetroAchievements games',
      paths: retroAchievementsPaths,
      icon: <RetroAchievementsIcon className="h-5 w-5" />,
    },
    ...(isLinux ? [{
      key: 'hydra' as const,
      title: 'Hydra',
      subtitle: hydraPaths.length > 0 ? 'Per-game Wine prefixes' : 'No Hydra prefix found',
      paths: hydraPaths,
      icon: <HydraIcon className="h-5 w-5" />,
    }] : []),
    {
      key: 'global',
      title: t('unlockModal.globalPaths'),
      subtitle: globalOnlyPaths.length > 0 ? 'Shared monitored folders' : 'No global path available',
      paths: globalOnlyPaths,
      icon: <FolderIcon className="h-5 w-5" />,
    },
  ]), [globalOnlyPaths, hydraPaths, isLinux, retroAchievementsPaths, steamPaths, t]);
  const availableProviderGroups = providerGroups.filter(group => group.paths.length > 0);

  useEffect(() => {
    if (!isOpen) return;
    if (!providerGroups.some(group => group.key === activeProvider && group.paths.length > 0)) {
      setActiveProvider(availableProviderGroups[0]?.key || 'steam');
    }
  }, [activeProvider, availableProviderGroups, isOpen, providerGroups]);

  const activeProviderGroup = providerGroups.find(group => group.key === activeProvider) || availableProviderGroups[0] || providerGroups[0];

  if (!isOpen) return null;

  const showSteamCustomTimestampWarning =
    selectedPath.startsWith('steam://');
  const showRetroAchievementsCustomTimestampWarning =
    selectedPath.startsWith('retroachievements://');
  const steamWarningMessage = t('unlockModal.steamCustomTimestampWarning');
  const retroAchievementsWarningMessage =
    t('unlockModal.retroAchievementsCustomTimestampWarning');
  const retroAchievementsWebSessionWarningMessage =
    t('unlockModal.retroAchievementsWebSessionRequiredWarning');

  const renderPathItem = (path: string) => {
    const existingInfo = getExistingFileInfo(path);
    return (
      <PathRow
        key={path}
        path={path}
        isSelected={selectedPath === path}
        existingAchievementCount={existingInfo?.count ?? null}
        lastModified={existingInfo?.lastModified ?? null}
        steamVdfPath={steamVdfPath}
        steamVdfLastModified={steamVdfLastModified}
        newAchievementCount={newAchievementCount}
        onSelect={() => setSelectedPath(path)}
      />
    );
  };

  const hasAnyPath = steamPaths.length > 0 || retroAchievementsPaths.length > 0 || (isLinux && hydraPaths.length > 0) || globalOnlyPaths.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent showCloseButton={false} className="w-[94vw] max-w-[960px] sm:max-w-[960px] aspect-[16/9] max-h-[82vh] min-h-[500px] overflow-hidden p-0 bg-background">
        <DialogTitle className="sr-only">{t('unlockModal.title')}</DialogTitle>
        <DialogClose
          render={
            <button
              type="button"
              className="absolute right-1 top-1 z-30 flex h-10 w-10 items-center justify-center border-0 bg-transparent p-0 text-white transition-colors hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            />
          }
        >
          <XIcon className="h-6 w-6" strokeWidth={2} />
          <span className="sr-only">Close</span>
        </DialogClose>

        <div className="grid min-h-0 grid-cols-[200px_minmax(0,1fr)] grid-rows-[minmax(0,1fr)_auto] overflow-hidden">
          <aside className="row-span-2 flex flex-col border-r border-border/40 bg-muted/20">
            <nav className="flex-1 space-y-1 p-3">
              {providerGroups.map((group) => {
                const isActive = group.key === activeProviderGroup.key;
                const isDisabled = group.paths.length === 0;
                const count = group.paths.length;

                return (
                  <button
                    key={group.key}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => setActiveProvider(group.key)}
                    className={cn(
                      'group/provider relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-all duration-150',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-foreground/80 hover:bg-accent hover:text-foreground',
                      isDisabled && 'cursor-not-allowed opacity-40'
                    )}
                  >
                    <span className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center transition-colors',
                      isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover/provider:text-foreground'
                    )}>
                      {group.icon}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">{group.title}</span>
                    <span className={cn(
                      'tabular-nums text-xs font-semibold',
                      isActive ? 'text-primary-foreground/80' : 'text-muted-foreground/60'
                    )}>
                      {count > 0 ? count : '—'}
                    </span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <div className="min-w-0 overflow-y-auto">
            <div className="relative h-40 overflow-hidden bg-muted sm:h-48">
              <img
                src={steamArtUrl}
                alt=""
                className="h-full w-full object-cover opacity-70"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-black/15" />
              <div className="absolute inset-x-0 bottom-0 p-6">
                <div className="flex h-9 min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center text-white [&_svg]:h-7 [&_svg]:w-7">
                    {activeProviderGroup.icon}
                  </div>
                  {gameLogoFailed ? (
                    <p className="min-w-0 truncate text-2xl font-semibold leading-9 text-white">{game.name}</p>
                  ) : (
                    <img
                      src={gameLogoUrl}
                      alt={game.name}
                      className="max-h-12 min-w-0 max-w-[min(430px,76%)] object-contain object-left"
                      onError={() => setGameLogoFailed(true)}
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="p-5">
              {hasAnyPath && activeProviderGroup.paths.length > 0 ? (
                <div className="grid gap-3">
                  {activeProviderGroup.paths.map(renderPathItem)}
                </div>
              ) : (
                <div className="flex min-h-[180px] flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-muted/60 bg-muted/20 p-10 text-center">
                  <FolderIcon className="text-3xl opacity-20" />
                  <p className="text-xs font-bold uppercase tracking-widest leading-relaxed text-muted-foreground/60">
                    {hasAnyPath ? activeProviderGroup.subtitle : t('unlockModal.noPathsFound')}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 px-5 py-3">
            {(showSteamCustomTimestampWarning || showRetroAchievementsCustomTimestampWarning) && (
              <div className="w-full rounded-md border px-3 py-2 text-[10px] font-semibold leading-relaxed bg-muted/50 text-muted-foreground">
                <p>{showRetroAchievementsCustomTimestampWarning ? retroAchievementsWarningMessage : steamWarningMessage}</p>
                {showRetroAchievementsCustomTimestampWarning && !hasRetroAchievementsWebSession && (
                  <p className="mt-1.5">{retroAchievementsWebSessionWarningMessage}</p>
                )}
              </div>
            )}
            <div className="flex w-full gap-2">
              <Button variant="ghost" onClick={onClose} className="flex-1 h-9 text-sm font-medium text-muted-foreground hover:text-foreground">
                {t('unlockModal.cancel')}
              </Button>
              <Button onClick={handleConfirm} disabled={!selectedPath} className="flex-1 h-9 text-sm font-semibold">
                {t('unlockModal.unlockHere')}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UnlockModal;
