
import React, { useState, useEffect } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { getSteamLibraryInfo, getAchievementIniLastModified, getSteamGames, getGameWinePaths, getMonitoredDirectories } from '../tauri-api';
import { SteamSearchResult } from '../types';
import { CloseIcon, FolderIcon, SteamBrandIcon } from './Icons';
import { useTheme } from '../contexts/ThemeContext';
import { formatDateObj } from '../formatters';
import { useMonitoredAchievements } from '../contexts/MonitoredAchievementsContext';
import { UnlockMode } from './GlobalTimestampManager';

interface UnlockModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (path: string) => void;
    game: SteamSearchResult;
    newAchievementCount: number;
    unlockMode?: UnlockMode;
}





const PathItem: React.FC<{
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
    const formatUsersForDisplay = (input: string) =>
        input.replace(/(^|[\\/])users(?=[\\/])/gi, '$1Users');
    const getPathTitle = (input: string, fallback: string) => {
        const normalized = input.replace(/[\\]+/g, '/');
        const parts = normalized.split('/').filter(Boolean);
        return parts[parts.length - 1] || fallback;
    };
    const getCrackerName = (input: string) => {
        const normalized = input.replace(/[\\]+/g, '/').toLowerCase();
        if (normalized.includes('/codex/')) return 'CODEX';
        if (normalized.includes('/rune/')) return 'RUNE';
        if (normalized.includes('/goldberg steamemu saves/') || normalized.includes('/gse saves/')) return 'Goldberg';
        if (normalized.includes('/empress/')) return 'EMPRESS';
        if (normalized.includes('/creamapi/')) return 'CreamAPI';
        if (normalized.includes('/smartsteamemu/')) return 'SmartSteamEmu';
        if (normalized.includes('/skidrow/')) return 'SKIDROW';
        if (normalized.includes('/ali213/')) return 'ALi213';
        return null;
    };

    const normalizedPath = path.replace(/[\\]+/g, '/');
    const isWinePath = !isSteam && normalizedPath.includes('/drive_c/');
    const isHydraLauncherPrefix = isWinePath && normalizedPath.includes('/.config/hydralauncher/wine-prefixes/');
    const isDefaultWinePrefix = isWinePath && normalizedPath.includes('/.wine/drive_c/');
    const prefixGameId = normalizedPath.match(/\/wine-prefixes\/([^/]+)\/drive_c\//)?.[1] ?? null;
    const wineUser = normalizedPath.match(/\/drive_c\/users\/([^/]+)\//i)?.[1] ?? null;
    const crackerName = getCrackerName(path);
    const prefixLabel = isHydraLauncherPrefix
        ? 'Hydra Launcher prefix'
        : isDefaultWinePrefix
            ? 'Wine default prefix'
            : isWinePath
                ? 'Wine/Proton prefix'
                : 'Local folder';
    const displayPath = isWinePath
        ? (normalizedPath.split('/drive_c/')[1] || path)
        : path;
    const displayPathFormatted = formatUsersForDisplay(displayPath);
    const displayTitle = isWinePath
        ? [crackerName, getPathTitle(displayPathFormatted, prefixLabel)].filter(Boolean).join(' · ')
        : getPathTitle(displayPathFormatted, path);

    const formattedLastModified = lastModified ? formatDateObj(lastModified, dateFormat, timeFormat) : '';
    const formattedSteamVdfLastModified = steamVdfLastModified ? formatDateObj(steamVdfLastModified, dateFormat, timeFormat) : '';
    const lastModifiedText = isSteam
        ? t('unlockModal.lastModified', { date: formattedSteamVdfLastModified || '--' })
        : t('unlockModal.lastModified', { date: formattedLastModified || '--' });
    const sourceBadgeText = isSteam
        ? 'STEAM'
        : isWinePath
            ? (isHydraLauncherPrefix ? 'HYDRA PREFIX' : 'WINE PREFIX')
            : 'LOCAL PATH';
    const pathPreview = isSteam
        ? (steamVdfPath || 'libraryfolders.vdf not found')
        : displayPathFormatted;
    const metadataItems = [
        prefixGameId ? `AppID ${prefixGameId}` : null,
        wineUser ? `User ${wineUser}` : null,
    ].filter(Boolean);
    const metadataText = metadataItems.join(' · ');
    const statusText = hasExistingFile
        ? `${existingAchievementCount} → ${newAchievementCount}`
        : '';
    const isFaded = !isSteam && !hasExistingFile && !isSelected;

    return (
        <div
            className={`group rounded-lg border transition-all cursor-pointer overflow-hidden ${isFaded ? 'opacity-50' : ''} ${isSelected
                ? 'shadow-md'
                : 'hover:bg-[var(--hover-bg)]'}`}
            style={{
                backgroundColor: isSelected ? 'var(--hover-bg)' : 'transparent',
                borderColor: isSelected ? 'var(--text-main)' : 'var(--border-color)'
            }}
            onClick={onSelect}
            role="radio"
            aria-checked={isSelected}
            tabIndex={0}
            onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onSelect()}
        >
            <div className="p-3 flex gap-2">
                        <span className="flex-shrink-0 w-10 flex items-center justify-center leading-none" style={{ color: 'var(--text-main)' }}>
                            {isSteam ? <SteamBrandIcon className="w-6 h-6" /> : <FolderIcon className="text-3xl leading-none" />}
                        </span>
                    <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 min-w-0">
                        <span
                            className="flex-shrink-0 rounded-md border px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.14em]"
                            style={{
                                color: isHydraLauncherPrefix && !isFaded ? 'rgb(192 132 252)' : 'var(--text-muted)',
                                borderColor: isHydraLauncherPrefix && !isFaded ? 'rgba(168, 85, 247, 0.35)' : 'var(--border-color)',
                                backgroundColor: isHydraLauncherPrefix && !isFaded ? 'rgba(168, 85, 247, 0.10)' : 'transparent'
                            }}
                        >
                            {sourceBadgeText}
                        </span>
                        <p className="font-bold text-sm truncate min-w-0" style={{ color: 'var(--text-main)' }}>
                            {isSteam ? 'Steam Library' : displayTitle}
                        </p>
                        {statusText && (
                            <span className="text-[10px] font-semibold whitespace-nowrap opacity-70 ml-auto" style={{ color: 'var(--text-main)' }}>
                                {statusText}
                            </span>
                        )}
                    </div>

                    <p
                        className="text-[11px] font-medium truncate opacity-60"
                        style={{ color: 'var(--text-main)' }}
                        title={pathPreview}
                    >
                        {pathPreview}
                    </p>

                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-medium opacity-50 whitespace-nowrap" style={{ color: 'var(--text-main)' }}>
                            {lastModifiedText}
                        </span>
                        {metadataText && (
                            <>
                                <span className="text-[10px] opacity-30">·</span>
                                <span className="text-[10px] font-medium opacity-50 truncate" style={{ color: 'var(--text-main)' }}>
                                    {metadataText}
                                </span>
                            </>
                        )}
                    </div>
                </div>
                </div>
        </div>
    );
};


const UnlockModal: React.FC<UnlockModalProps> = ({ isOpen, onClose, onConfirm, game, newAchievementCount, unlockMode }) => {
    const { t } = useI18n();
    const { games: monitoredGames } = useMonitoredAchievements();
    const [selectedPath, setSelectedPath] = useState('');
    const [gameWinePaths, setGameWinePaths] = useState<string[]>([]);
    const [globalPaths, setGlobalPaths] = useState<string[]>([]);
    const [activePathTab, setActivePathTab] = useState<'global' | 'hydra'>('hydra');
    const [steamVdfPath, setSteamVdfPath] = useState<string | null>(null);
    const [steamVdfLastModified, setSteamVdfLastModified] = useState<Date | null>(null);
    const [iniLastModifiedByPath, setIniLastModifiedByPath] = useState<Record<string, Date | null>>({});
    const [hasSteamPathForCurrentGame, setHasSteamPathForCurrentGame] = useState(false);
    const isLinux = (window as any).electronAPI?.platform === 'linux';

    useEffect(() => {
        if (isOpen) {
            setSelectedPath('');
            setIniLastModifiedByPath({});
            setHasSteamPathForCurrentGame(false);
            setGameWinePaths([]);
            setGlobalPaths([]);
            setActivePathTab('hydra');
            const gameId = game?.id?.toString();
            if (isLinux) {
                getMonitoredDirectories()
                    .then((dirs: any[]) => {
                        const paths = dirs
                            .filter((d: any) => d.enabled && !d.path.includes('wine-prefixes/'))
                            .map((d: any) => d.path);
                        setGlobalPaths(Array.from(new Set(paths)));
                    })
                    .catch(() => setGlobalPaths([]));
            }
            // Busca paths Wine específicos do jogo (Linux)
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
    }, [isOpen, game]);

    useEffect(() => {
        if (!isOpen || !game) return;

        const localPaths = isLinux
            ? [...gameWinePaths, ...globalPaths]
            : monitoredGames.filter(g => g.gameId === game.id.toString()).map(g => g.directory);
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
    }

    if (!isOpen) return null;

    const hydraPaths = gameWinePaths;
    const globalTabPaths = Array.from(new Set([
        ...(hasSteamPathForCurrentGame ? ['steam://'] : []),
        ...globalPaths
    ]));
    const localPaths = isLinux
        ? (activePathTab === 'hydra' ? hydraPaths : globalTabPaths)
        : monitoredGames.filter(g => g.gameId === game.id.toString()).map(g => g.directory);
    const availablePaths = Array.from(new Set([
        ...localPaths
    ]));

    const showSteamCustomTimestampWarning =
        selectedPath.startsWith('steam://');
    const steamWarningMessage =
        unlockMode === 'custom'
            ? t('unlockModal.steamCustomTimestampWarning')
            : t('unlockModal.steamCustomTimestampWarning');

    return (
        <div
            className="fixed top-10 left-0 right-0 bottom-0 z-40 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="unlock-modal-title"
        >
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true"></div>

            <div
                className="relative w-[640px] h-[480px] rounded-lg shadow-2xl border flex flex-col animate-modal-in"
                style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}
            >

                <div className="flex items-start justify-between p-6 pb-4 flex-shrink-0">
                    <div className="flex-1 min-w-0">
                        <h2 id="unlock-modal-title" className="text-xl font-bold" style={{ color: 'var(--text-main)' }}>{t('unlockModal.title')}</h2>
                        <p className="text-xs font-medium mt-1 line-clamp-1" style={{ color: 'var(--text-muted)' }}>{t('unlockModal.description', { gameName: game.name })}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="-mt-1 -mr-1 w-10 h-10 flex items-center justify-center rounded-md transition-all"
                        style={{ color: 'var(--text-muted)' }}
                        aria-label={t('unlockModal.cancel')}
                    >
                        <CloseIcon className="text-xl hover:text-[var(--text-main)] transition-colors text-[var(--text-muted)]" />
                    </button>
                </div>

                <div className="px-6 flex-grow overflow-y-auto custom-scrollbar">
                    <div className="py-5 space-y-3">
                        {isLinux && (
                            <div className="grid grid-cols-2 gap-2 rounded-lg border p-1" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--input-bg)' }}>
                                <button
                                    onClick={() => setActivePathTab('hydra')}
                                    className={`h-9 rounded-md text-[10px] font-black uppercase tracking-[0.16em] transition-all ${activePathTab === 'hydra' ? 'shadow-sm' : 'opacity-55 hover:opacity-100'}`}
                                    style={{ backgroundColor: activePathTab === 'hydra' ? 'var(--hover-bg)' : 'transparent', color: 'var(--text-main)' }}
                                >
                                    Hydra Launcher · {hydraPaths.length}
                                </button>
                                <button
                                    onClick={() => setActivePathTab('global')}
                                    className={`h-9 rounded-md text-[10px] font-black uppercase tracking-[0.16em] transition-all ${activePathTab === 'global' ? 'shadow-sm' : 'opacity-55 hover:opacity-100'}`}
                                    style={{ backgroundColor: activePathTab === 'global' ? 'var(--hover-bg)' : 'transparent', color: 'var(--text-main)' }}
                                >
                                    Global · {globalTabPaths.length}
                                </button>
                            </div>
                        )}

                        {availablePaths.map(path => {
                            const existingInfo = getExistingFileInfo(path);
                            return (
                                <PathItem
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
                        })}

                        {availablePaths.length === 0 && (
                            <div className="p-10 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-3 text-center" style={{ borderColor: 'var(--border-color)' }}>
                                <FolderIcon className="text-3xl opacity-15" />
                                <p className="text-xs font-bold opacity-40 uppercase tracking-widest leading-relaxed" style={{ color: 'var(--text-main)' }}>
                                    {t('unlockModal.noPathsFound')}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-end items-center p-6 pt-4 flex-shrink-0 border-t" style={{ borderColor: 'var(--border-color)' }}>
                    <div className="flex w-full gap-3 flex-col">
                        {showSteamCustomTimestampWarning && (
                            <div
                                className="w-full rounded-md border px-3 py-2 text-[10px] font-semibold leading-relaxed"
                                style={{
                                    color: 'var(--text-main)',
                                    borderColor: 'var(--border-color)',
                                    backgroundColor: 'var(--hover-bg)'
                                }}
                            >
                                {steamWarningMessage}
                            </div>
                        )}
                        <div className="flex w-full gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 h-12 rounded-md text-[10px] font-black uppercase tracking-[0.2em] border transition-all"
                            style={{ backgroundColor: 'var(--hover-bg)', borderColor: 'var(--border-color)', color: 'var(--text-main)' }}
                        >
                            {t('unlockModal.cancel')}
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={!selectedPath}
                            className="flex-1 h-12 rounded-md text-[10px] font-black uppercase tracking-[0.2em] disabled:opacity-20 disabled:cursor-not-allowed transition-all shadow-xl"
                            style={{ backgroundColor: 'var(--text-main)', color: 'var(--bg-color)' }}
                        >
                            {t('unlockModal.unlockHere')}
                        </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UnlockModal;
