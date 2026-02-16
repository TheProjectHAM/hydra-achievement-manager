
import React, { useState, useEffect } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { getMonitoredDirectories, getSteamLibraryInfo, getAchievementIniLastModified, getSteamGames } from '../tauri-api';
import { SteamSearchResult } from '../types';
import { CloseIcon, FolderIcon, CheckIcon, SteamBrandIcon } from './Icons';
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
    const getPathTitle = (input: string) => {
        const normalized = input.replace(/[\\]+/g, '/');
        const parts = normalized.split('/').filter(Boolean);
        return parts[parts.length - 1] || input;
    };

    const displayPath = path.includes('.wine') && path.includes('drive_c')
        ? (path.split('drive_c/')[1] || path)
        : path;
    const displayPathFormatted = formatUsersForDisplay(displayPath);
    const displayTitle = getPathTitle(displayPathFormatted);

    const formattedLastModified = lastModified ? formatDateObj(lastModified, dateFormat, timeFormat) : '';
    const formattedSteamVdfLastModified = steamVdfLastModified ? formatDateObj(steamVdfLastModified, dateFormat, timeFormat) : '';

    return (
        <div
            className={`p-3 rounded-lg border transition-all cursor-pointer ${isSelected
                ? 'shadow-xl'
                : 'hover:bg-[var(--hover-bg)]'}`}
            style={{
                backgroundColor: isSelected ? 'var(--input-bg)' : 'transparent',
                borderColor: isSelected ? 'var(--text-main)' : 'var(--border-color)'
            }}
            onClick={onSelect}
            role="radio"
            aria-checked={isSelected}
            tabIndex={0}
            onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onSelect()}
        >
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 min-w-0 flex-grow">
                    {isSteam ? (
                        <SteamBrandIcon className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--text-main)' }} />
                    ) : (
                        <FolderIcon className="text-xl flex-shrink-0 text-[var(--text-muted)]" />
                    )}
                    <div className="min-w-0 flex-grow mt-0.5 space-y-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                            <p className="font-bold truncate text-sm tracking-wide min-w-0" style={{ color: 'var(--text-main)' }}>
                                {isSteam ? 'Steam' : displayTitle}
                            </p>
                            {!isSteam && hasExistingFile && (
                                <>
                                    <span className="px-1.5 py-0.5 rounded-md font-semibold border whitespace-nowrap text-[10px]" style={{ color: 'var(--text-main)', borderColor: 'var(--border-color)', backgroundColor: 'var(--input-bg)' }}>
                                        {t('unlockModal.existingAchievements', { count: existingAchievementCount })}
                                    </span>
                                    <span className="px-1.5 py-0.5 rounded-md font-semibold border whitespace-nowrap text-[10px]" style={{ color: 'var(--text-main)', borderColor: 'var(--border-color)', backgroundColor: 'var(--input-bg)' }}>
                                        {t('unlockModal.newTotal', { count: newAchievementCount })}
                                    </span>
                                </>
                            )}
                        </div>
                        <div className="flex items-center justify-between gap-2 min-w-0">
                            <div className="min-w-0 flex-1 flex items-center gap-1.5">
                                {!isSteam && path.includes('.wine') && path.includes('drive_c') && (
                                    <span className="flex-shrink-0 bg-purple-500/20 text-purple-400 text-[8px] font-black px-1.5 py-0.5 rounded-sm uppercase tracking-widest border border-purple-500/30">
                                        WINE
                                    </span>
                                )}
                                {isSteam ? (
                                    <p className="font-semibold text-xs opacity-85 min-w-0 flex-1 truncate" style={{ color: 'var(--text-main)' }}>
                                        {steamVdfPath || 'libraryfolders.vdf not found'}
                                    </p>
                                ) : hasExistingFile ? (
                                    <p className="font-semibold text-xs opacity-85 min-w-0 flex-1 truncate" style={{ color: 'var(--text-main)' }}>
                                        {displayPathFormatted}
                                    </p>
                                ) : (
                                    <p className="font-semibold text-xs opacity-85 min-w-0 flex-1 truncate" style={{ color: 'var(--text-main)' }}>
                                        {displayPathFormatted}
                                    </p>
                                )}
                            </div>
                            <p className="text-[9px] opacity-65 whitespace-nowrap text-right font-semibold" style={{ color: 'var(--text-muted)' }}>
                                {isSteam
                                    ? t('unlockModal.lastModified', { date: formattedSteamVdfLastModified || '--' })
                                    : t('unlockModal.lastModified', { date: formattedLastModified || '--' })}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="relative">
                    {(isSteam || hasExistingFile) && (
                        <div className="w-5 h-5 flex-shrink-0 bg-emerald-500/10 text-emerald-500 rounded-md flex items-center justify-center mt-1" title={t('unlockModal.overwriteWarning')}>
                            <CheckIcon className="text-sm" />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};


const UnlockModal: React.FC<UnlockModalProps> = ({ isOpen, onClose, onConfirm, game, newAchievementCount, unlockMode }) => {
    const { t } = useI18n();
    const { games: monitoredGames } = useMonitoredAchievements();
    const [selectedPath, setSelectedPath] = useState('');
    const [settingsPaths, setSettingsPaths] = useState<string[]>([]);
    const [steamVdfPath, setSteamVdfPath] = useState<string | null>(null);
    const [steamVdfLastModified, setSteamVdfLastModified] = useState<Date | null>(null);
    const [iniLastModifiedByPath, setIniLastModifiedByPath] = useState<Record<string, Date | null>>({});
    const [hasSteamPathForCurrentGame, setHasSteamPathForCurrentGame] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setSelectedPath('');
            setIniLastModifiedByPath({});
            setHasSteamPathForCurrentGame(false);
            getMonitoredDirectories().then((dirs: any[]) => {
                const paths = dirs.filter((d: any) => d.enabled).map((d: any) => d.path);
                setSettingsPaths(paths);
            });
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

        const allPaths = Array.from(new Set([
            ...(hasSteamPathForCurrentGame ? ['steam://'] : []),
            ...monitoredGames.filter(g => g.gameId === game.id.toString()).map(g => g.directory),
            ...settingsPaths
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
    }, [isOpen, game, settingsPaths, monitoredGames, hasSteamPathForCurrentGame]);

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

    const availablePaths = Array.from(new Set([
        ...(hasSteamPathForCurrentGame ? ['steam://'] : []),
        ...monitoredGames.filter(g => g.gameId === game.id.toString()).map(g => g.directory),
        ...settingsPaths
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
                            <div className="p-8 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-4 text-center" style={{ borderColor: 'var(--border-color)' }}>
                                <FolderIcon className="text-4xl opacity-10" />
                                <p className="text-xs font-bold opacity-30 uppercase tracking-widest">
                                    {t('unlockModal.noPathsFound') || 'No monitored paths found for this game. Please add folders in Settings.'}
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
