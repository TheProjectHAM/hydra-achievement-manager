import React, { useState, useEffect, useMemo } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { getSteamLibraryInfo, getAchievementIniLastModified, getSteamGames, getGameWinePaths, getMonitoredDirectories } from '../tauri-api';
import { SteamSearchResult } from '../types';
import { FolderIcon, SteamBrandIcon, HydraIcon } from './Icons';
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
import { getSteamHeaderUrl } from '@/lib/steam-assets';
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
  return 'Local folder';
};

const getPathPreview = (path: string, steamVdfPath?: string | null) => {
  if (path.startsWith('steam://')) return steamVdfPath || 'libraryfolders.vdf not found';
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
  const hasExistingFile = existingAchievementCount !== null && !isSteam;
  const normalizedPath = normalizePath(path);
  const isWinePath = !isSteam && normalizedPath.includes('/drive_c/');
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
  const badgeText = isSteam ? 'Steam' : hasExistingFile ? statusText : 'New path';
  const isFaded = !isSteam && !hasExistingFile && !isSelected;

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
          ) : prefixLabel === 'Hydra Launcher prefix' ? (
            <HydraIcon className="h-8 w-8 text-foreground/85" />
          ) : (
            <FolderIcon className="leading-none" style={{ fontSize: '2.25rem' }} />
          )}
        </div>

        <div className="min-w-0 self-center space-y-1">
          <div className="flex min-w-0 items-center gap-2">
            <p className="min-w-0 truncate text-sm font-semibold leading-5 text-foreground">
              {isSteam ? 'Steam Library' : displayTitle}
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

type ProviderKey = 'steam' | 'hydra' | 'global';

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
  const [activeProvider, setActiveProvider] = useState<ProviderKey>('steam');
  const isLinux = getAppPlatform() === 'linux';

  useEffect(() => {
    if (isOpen) {
      setSelectedPath('');
      setIniLastModifiedByPath({});
      setHasSteamPathForCurrentGame(false);
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
  const hydraPaths = gameWinePaths;
  const globalOnlyPaths = globalPaths.filter(p => !hydraPaths.includes(p));

  const steamArtUrl = getSteamHeaderUrl(game.id);
  const providerGroups = useMemo<ProviderGroup[]>(() => ([
    {
      key: 'steam',
      title: 'Steam',
      subtitle: steamPaths.length > 0 ? 'Steamworks provider' : 'Unavailable for this game',
      paths: steamPaths,
      icon: <SteamBrandIcon className="h-5 w-5" />,
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
  ]), [globalOnlyPaths, hydraPaths, isLinux, steamPaths, t]);
  const availableProviderGroups = providerGroups.filter(group => group.paths.length > 0);

  useEffect(() => {
    if (!isOpen) return;
    const selectedProvider = providerGroups.find(group => group.paths.includes(selectedPath));
    if (selectedProvider) {
      setActiveProvider(selectedProvider.key);
      return;
    }

    if (!providerGroups.some(group => group.key === activeProvider && group.paths.length > 0)) {
      setActiveProvider(availableProviderGroups[0]?.key || 'steam');
    }
  }, [activeProvider, availableProviderGroups, isOpen, providerGroups, selectedPath]);

  const activeProviderGroup = providerGroups.find(group => group.key === activeProvider) || availableProviderGroups[0] || providerGroups[0];

  if (!isOpen) return null;

  const showSteamCustomTimestampWarning =
    selectedPath.startsWith('steam://');
  const steamWarningMessage =
    unlockMode === 'custom'
      ? t('unlockModal.steamCustomTimestampWarning')
      : t('unlockModal.steamCustomTimestampWarning');

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

  const hasAnyPath = steamPaths.length > 0 || (isLinux && hydraPaths.length > 0) || globalOnlyPaths.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent showCloseButton={false} className="w-[min(94vw,1040px)] max-w-none aspect-[16/9] max-h-[88vh] min-h-[560px] grid grid-rows-[minmax(0,1fr)_auto] overflow-hidden p-0 gap-0 bg-background">
        <DialogTitle className="sr-only">{t('unlockModal.title')}</DialogTitle>

        <div className="grid min-h-0 grid-cols-[220px_minmax(0,1fr)] overflow-hidden">
          <aside className="bg-muted/10 p-4">
            <div className="mb-4 px-1">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Providers</p>
            </div>
            <div className="space-y-2">
              {providerGroups.map((group) => {
                const isActive = group.key === activeProviderGroup.key;
                const isDisabled = group.paths.length === 0;

                return (
                  <button
                    key={group.key}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => setActiveProvider(group.key)}
                    className={cn(
                      'group/provider relative w-full overflow-hidden rounded-xl px-3.5 py-3 text-left transition-all duration-200',
                      isActive
                        ? 'bg-foreground text-background shadow-sm'
                        : 'bg-muted/55 text-foreground hover:bg-accent',
                      isDisabled && 'cursor-not-allowed opacity-35 hover:bg-muted/55'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center transition-colors',
                        isActive ? 'text-background' : 'text-muted-foreground group-hover/provider:text-foreground'
                      )}>
                        {group.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn(
                          'block truncate text-sm font-semibold',
                          isActive ? 'text-background' : 'text-foreground'
                        )}>{group.title}</span>
                        <span className={cn(
                          'block truncate text-[10px] font-semibold',
                          isActive ? 'text-background/65' : 'text-muted-foreground'
                        )}>{group.paths.length} path{group.paths.length === 1 ? '' : 's'}</span>
                      </span>
                    </div>
                    {isActive && <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-primary" />}
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="min-w-0 overflow-y-auto">
            <div className="relative h-48 overflow-hidden bg-muted sm:h-56">
              <DialogClose
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="absolute right-4 top-4 z-20 border border-white/25 bg-background/90 text-foreground shadow-lg backdrop-blur hover:bg-background hover:text-foreground"
                  />
                }
              >
                <XIcon className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </DialogClose>
              <img
                src={steamArtUrl}
                alt=""
                className="h-full w-full object-cover opacity-70"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-black/15" />
              <div className="absolute inset-x-0 bottom-0 flex items-end gap-4 p-6">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center text-white drop-shadow-lg">
                  {activeProviderGroup.icon}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-2xl font-semibold text-white drop-shadow">{game.name}</p>
                  <p className="mt-1 text-xs font-semibold text-white/70 drop-shadow">
                    {activeProviderGroup.title} · {activeProviderGroup.subtitle}
                  </p>
                </div>
                <div className="ml-auto hidden border-l border-white/25 pl-4 text-right text-[10px] font-bold uppercase tracking-widest text-white/80 drop-shadow sm:block">
                  {newAchievementCount} {t('common.achievements').toLowerCase()}
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
        </div>

        <div className="grid grid-cols-[220px_minmax(0,1fr)] bg-background">
          <div className="bg-muted/10" />
          <div className="flex flex-col gap-3 p-5 pt-2">
            {showSteamCustomTimestampWarning && (
              <div className="w-full rounded-md border px-3 py-2 text-[10px] font-semibold leading-relaxed bg-muted/50 text-muted-foreground">
                {steamWarningMessage}
              </div>
            )}
            <div className="flex w-full gap-3">
              <Button variant="outline" onClick={onClose} className="flex-1">
                {t('unlockModal.cancel')}
              </Button>
              <Button onClick={handleConfirm} disabled={!selectedPath} className="flex-1">
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
