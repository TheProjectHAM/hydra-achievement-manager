import React, { useState, useEffect } from 'react';
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
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

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

const getGameArtUrl = (gameId: string | number) => {
  const steamCdn = import.meta.env.VITE_STEAM_CDN_URL || 'https://cdn.akamai.steamstatic.com/steam/apps';
  return `${steamCdn}/${gameId}`;
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
  isFirst?: boolean;
  isLast?: boolean;
}> = ({ path, isSelected, existingAchievementCount, lastModified, steamVdfPath, steamVdfLastModified, newAchievementCount, onSelect, isFirst, isLast }) => {
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
        'group relative overflow-hidden border transition-all duration-200 cursor-pointer min-h-[92px]',
        isFirst && isLast
          ? 'rounded-xl'
          : isFirst
            ? 'rounded-t-xl rounded-b-none'
            : isLast
              ? 'rounded-b-xl rounded-t-none -mt-px'
              : 'rounded-none -mt-px',
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

const ChevronIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4.18179 6.18181C4.35753 6.00608 4.64245 6.00608 4.81819 6.18181L7.49999 8.86362L10.1818 6.18181C10.3575 6.00608 10.6424 6.00608 10.8182 6.18181C10.9939 6.35755 10.9939 6.64247 10.8182 6.81821L7.81819 9.81821C7.73379 9.9026 7.61934 9.95001 7.49999 9.95001C7.38064 9.95001 7.26618 9.9026 7.18179 9.81821L4.18179 6.81821C4.00605 6.64247 4.00605 6.35755 4.18179 6.18181Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"/>
  </svg>
);

const SectionCard: React.FC<{
  title: string;
  artUrl?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  isEmpty?: boolean;
  emptyMessage?: string;
  defaultOpen?: boolean;
}> = ({ title, artUrl, icon, children, isEmpty, emptyMessage, defaultOpen = true }) => {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-border overflow-hidden transition-all duration-300">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left hover:bg-accent/40 transition-colors"
      >
        {artUrl ? (
          <div className="relative h-28 w-full overflow-hidden bg-muted">
            <img
              src={artUrl}
              alt=""
              className="w-full h-full object-cover opacity-50"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/60 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 flex items-center gap-2.5 px-4 pb-3">
              {icon && (
                <>
                  <span className="flex items-center justify-center text-foreground/80">{icon}</span>
                  <span className="text-foreground/30">|</span>
                </>
              )}
              <p className="text-sm font-semibold text-foreground truncate">{title}</p>
              <ChevronIcon className={cn(
                'ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
                isOpen && 'rotate-180'
              )} />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 px-4 py-3 bg-muted/50">
            {icon && (
              <>
                <span className="flex items-center justify-center text-foreground/80">{icon}</span>
                <span className="text-foreground/30">|</span>
              </>
            )}
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <ChevronIcon className={cn(
              'ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
              isOpen && 'rotate-180'
            )} />
          </div>
        )}
      </button>

      {isOpen && (
        <div className="divide-y divide-border">
          {isEmpty ? (
            <div className="px-4 py-6 flex flex-col items-center justify-center gap-2 text-center">
              <FolderIcon className="text-xl opacity-20" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
                {emptyMessage || t('unlockModal.noPathsFound')}
              </p>
            </div>
          ) : (
            children
          )}
        </div>
      )}
    </div>
  );
};

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

  if (!isOpen) return null;

  const steamPaths = hasSteamPathForCurrentGame ? ['steam://'] : [];
  const hydraPaths = gameWinePaths;
  const globalOnlyPaths = globalPaths.filter(p => !hydraPaths.includes(p));

  const artUrl = getGameArtUrl(game.id);
  const steamArtUrl = `${artUrl}/header.jpg`;

  const showSteamCustomTimestampWarning =
    selectedPath.startsWith('steam://');
  const steamWarningMessage =
    unlockMode === 'custom'
      ? t('unlockModal.steamCustomTimestampWarning')
      : t('unlockModal.steamCustomTimestampWarning');

  const renderPathItem = (path: string, isFirst = false, isLast = false) => {
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
        isFirst={isFirst}
        isLast={isLast}
      />
    );
  };

  const renderPathList = (paths: string[]) =>
    paths.map((path, index) => renderPathItem(path, index === 0, index === paths.length - 1));

  const hasAnyPath = steamPaths.length > 0 || (isLinux && hydraPaths.length > 0) || globalOnlyPaths.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-2xl h-[620px] flex flex-col overflow-hidden p-0 gap-0 bg-background [&_[data-slot='dialog-close']]:top-5 [&_[data-slot='dialog-close']]:right-5 [&_[data-slot='dialog-close']]:h-8 [&_[data-slot='dialog-close']]:w-8">
        <DialogHeader className="relative px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle className="text-lg font-semibold tracking-tight pr-8">{t('unlockModal.title')}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-4">
            {steamPaths.length > 0 && (
              <SectionCard
                title="Steam"
                artUrl={steamArtUrl}
                icon={<SteamBrandIcon className="w-5 h-5" />}
              >
                {renderPathList(steamPaths)}
              </SectionCard>
            )}

            {isLinux && hydraPaths.length > 0 && (
              <SectionCard
                title="Hydra"
                artUrl={steamArtUrl}
                icon={<HydraIcon className="w-5 h-5" />}
              >
                {renderPathList(hydraPaths)}
              </SectionCard>
            )}

            {globalOnlyPaths.length > 0 && (
              <SectionCard
                title={t('unlockModal.globalPaths')}
                artUrl={steamArtUrl}
                icon={<FolderIcon className="w-5 h-5" />}
                isEmpty={false}
              >
                {renderPathList(globalOnlyPaths)}
              </SectionCard>
            )}

            {!hasAnyPath && (
              <div className="p-10 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-3 text-center border-muted/60 bg-muted/20">
                <FolderIcon className="text-3xl opacity-20" />
                <p className="text-xs font-bold opacity-50 uppercase tracking-widest leading-relaxed text-muted-foreground">
                  {t('unlockModal.noPathsFound')}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 p-6 pt-4 border-t border-border bg-background">
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
      </DialogContent>
    </Dialog>
  );
};

export default UnlockModal;
