import React, { useState, useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useI18n } from '../../contexts/I18nContext';
import { FolderIcon, CloseIcon, SteamBrandIcon } from '../Icons';
import { ApiSource } from '../../types';
import { getGameNames } from '../../tauri-api';
import { getAppPlatform } from '@/lib/platform';

interface DirectoryConfig {
    path: string;
    name: string;
    enabled: boolean;
    is_default: boolean;
    detectionPreset?: DetectionPreset;
}

type DetectionPreset = 'auto' | 'codex_ini' | 'goldberg_json' | 'empress_json' | 'online_fix' | 'skidrow' | 'cream_api' | 'smart_steam_emu' | 'razor1911';

const createDetectionPresets = (t: (key: string) => string): Array<{ value: DetectionPreset; label: string; description: string }> => [
    { value: 'auto', label: t('settings.monitored.presets.auto.label'), description: t('settings.monitored.presets.auto.description') },
    { value: 'codex_ini', label: t('settings.monitored.presets.codex_ini.label'), description: t('settings.monitored.presets.codex_ini.description') },
    { value: 'goldberg_json', label: t('settings.monitored.presets.goldberg_json.label'), description: t('settings.monitored.presets.goldberg_json.description') },
    { value: 'empress_json', label: t('settings.monitored.presets.empress_json.label'), description: t('settings.monitored.presets.empress_json.description') },
    { value: 'online_fix', label: t('settings.monitored.presets.online_fix.label'), description: t('settings.monitored.presets.online_fix.description') },
    { value: 'skidrow', label: t('settings.monitored.presets.skidrow.label'), description: t('settings.monitored.presets.skidrow.description') },
    { value: 'cream_api', label: t('settings.monitored.presets.cream_api.label'), description: t('settings.monitored.presets.cream_api.description') },
    { value: 'smart_steam_emu', label: t('settings.monitored.presets.smart_steam_emu.label'), description: t('settings.monitored.presets.smart_steam_emu.description') },
    { value: 'razor1911', label: t('settings.monitored.presets.razor1911.label'), description: t('settings.monitored.presets.razor1911.description') },
];

interface MonitoredSettingsProps {
    selectedApi: ApiSource;
    steamIntegrationEnabled: boolean;
    setSteamIntegrationEnabled: (enabled: boolean) => void;
}

interface DirectoryGroup {
    key: string;
    title: string;
    subtitle: string;
    directories: DirectoryConfig[];
    gameId?: string;
    imageUrl?: string;
    custom: boolean;
}

const MonitoredSettings: React.FC<MonitoredSettingsProps> = ({
    selectedApi,
    steamIntegrationEnabled,
    setSteamIntegrationEnabled
}) => {
    const { t } = useI18n();
    const DETECTION_PRESETS = useMemo(() => createDetectionPresets(t), [t]);
    const formatUsersForDisplay = (input: string) =>
        input.replace(/(^|[\\/])users(?=[\\/])/gi, '$1Users');
    const [directories, setDirectories] = useState<DirectoryConfig[]>([]);
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
    const [activePathTab, setActivePathTab] = useState<'global' | 'hydra'>('global');
    const [gameNames, setGameNames] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [cacheSize, setCacheSize] = useState<string>('Loading...');
    const [clearingCache, setClearingCache] = useState(false);
    const [steamLibraryVdfPath, setSteamLibraryVdfPath] = useState<string | null>(null);
    const [steamGamesFound, setSteamGamesFound] = useState<number>(0);
    const [isSteamMissing, setIsSteamMissing] = useState(false);
    const isLinux = getAppPlatform() === 'linux';
    const [winePrefixPath, setWinePrefixPath] = useState<string>('~/.config/hydralauncher/wine-prefix');
    const [isSavingWinePrefix, setIsSavingWinePrefix] = useState(false);
    const [pendingCustomPath, setPendingCustomPath] = useState<string | null>(null);
    const [pendingDetectionPreset, setPendingDetectionPreset] = useState<DetectionPreset>('auto');
    const [isPresetDropdownOpen, setIsPresetDropdownOpen] = useState(false);
    const steamCdnUrl = import.meta.env.VITE_STEAM_CDN_URL || 'https://cdn.cloudflare.steamstatic.com/steam/apps';

    const getPresetLabel = (preset?: DetectionPreset) =>
        DETECTION_PRESETS.find(item => item.value === (preset || 'auto'))?.label || t('settings.monitored.presets.auto.label');

    const getGamePrefixId = (path: string) => {
        const normalized = path.replace(/\\/g, '/');
        return normalized.match(/wine-prefixes\/([^/]+)/)?.[1] ?? null;
    };

    const getRelativeWinePath = (path: string) => {
        const normalized = path.replace(/\\/g, '/');
        return normalized.includes('/drive_c/') ? normalized.split('/drive_c/')[1] : normalized;
    };

    const directoryGroups = useMemo<DirectoryGroup[]>(() => {
        const groups = new Map<string, DirectoryGroup>();

        for (const dir of directories) {
            const gameId = getGamePrefixId(dir.path);
            const key = gameId
                ? `game:${gameId}`
                : dir.is_default
                    ? 'global:wine'
                    : 'custom';

            if (!groups.has(key)) {
                groups.set(key, {
                    key,
                    title: gameId ? (gameNames[gameId] || gameId) : dir.is_default ? 'Global Wine Paths' : 'Custom Paths',
                    subtitle: gameId
                        ? `Steam AppID ${gameId}`
                        : dir.is_default
                            ? 'Shared/legacy Wine prefix'
                            : 'User-added monitored directories',
                    directories: [],
                    gameId: gameId || undefined,
                    imageUrl: gameId ? `${steamCdnUrl}/${gameId}/capsule_184x69.jpg` : undefined,
                    custom: !dir.is_default,
                });
            }

            groups.get(key)!.directories.push(dir);
        }

        return Array.from(groups.values()).sort((a, b) => {
            if (a.gameId && !b.gameId) return -1;
            if (!a.gameId && b.gameId) return 1;
            return a.title.localeCompare(b.title);
        });
    }, [directories, gameNames, steamCdnUrl]);

    useEffect(() => {
        const gameIds = Array.from(new Set(directories.map(d => getGamePrefixId(d.path)).filter(Boolean))) as string[];
        const missing = gameIds.filter(id => !gameNames[id]);
        if (missing.length === 0) return;

        getGameNames(missing)
            .then(names => setGameNames(prev => ({ ...prev, ...names })))
            .catch(error => console.error('Error loading monitored game names:', error));
    }, [directories, gameNames]);

    const toggleGroup = (key: string) => {
        setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const globalGroups = directoryGroups.filter(group => !group.gameId);
    const hydraGroups = directoryGroups.filter(group => group.gameId);
    const visibleGroups = isLinux
        ? (activePathTab === 'global' ? globalGroups : hydraGroups)
        : globalGroups;
    const globalPathCount = globalGroups.reduce((total, group) => total + group.directories.length, 0);
    const hydraPathCount = hydraGroups.reduce((total, group) => total + group.directories.length, 0);

    useEffect(() => {
        const loadCacheSize = async () => {
            if ((window as any).electronAPI) {
                try {
                    const size = await (window as any).electronAPI.getCacheSize();
                    setCacheSize(size);
                } catch (error) {
                    console.error('Error loading cache size:', error);
                    setCacheSize('Unknown');
                }
            }
        };
        loadCacheSize();
    }, []);

    const handleClearCache = async () => {
        setClearingCache(true);
        try {
            await (window as any).electronAPI.clearCache();
            const newSize = await (window as any).electronAPI.getCacheSize();
            setCacheSize(newSize);
        } catch (error) {
            console.error('Failed to clear cache:', error);
        } finally {
            setClearingCache(false);
        }
    };

    useEffect(() => {
        const loadSteamInfo = async () => {
            try {
                const available = await invoke<boolean>('is_steam_available');
                setIsSteamMissing(!available);

                if (available) {
                    const vdfPath = await invoke<string | null>('get_steam_library_path');
                    setSteamLibraryVdfPath(vdfPath);

                    const steamGames = await invoke<any[]>('get_steam_games');
                    setSteamGamesFound(Array.isArray(steamGames) ? steamGames.length : 0);
                } else {
                    setSteamLibraryVdfPath(null);
                    setSteamGamesFound(0);
                }
            } catch (error) {
                console.error('Error loading Steam info:', error);
                setIsSteamMissing(true);
                setSteamLibraryVdfPath(null);
                setSteamGamesFound(0);
            }
        };

        loadSteamInfo();
    }, [steamIntegrationEnabled]);

    useEffect(() => {
        const loadDirs = async () => {
            if ((window as any).electronAPI) {
                try {
                    const dirs = await (window as any).electronAPI.getMonitoredDirectories();
                    setDirectories(dirs);
                    const settings = await (window as any).electronAPI.loadSettings();
                    const savedPrefix = settings?.winePrefixPath;
                    if (typeof savedPrefix === 'string' && savedPrefix.trim()) {
                        setWinePrefixPath(savedPrefix);
                    }
                } catch (error) {
                    console.error('Error loading monitored directories:', error);
                } finally {
                    setIsLoading(false);
                }
            } else {
                setIsLoading(false);
            }
        };
        loadDirs();
    }, []);

    const handleSaveWinePrefix = async () => {
        if (!isLinux || !(window as any).electronAPI?.setWinePrefixPath) return;

        const trimmed = winePrefixPath.trim();
        if (!trimmed) return;

        setIsSavingWinePrefix(true);
        try {
            const updatedDirs = await (window as any).electronAPI.setWinePrefixPath(trimmed);
            setDirectories(updatedDirs);
            setWinePrefixPath(trimmed);
        } catch (error) {
            console.error('Error saving Wine prefix path:', error);
        } finally {
            setIsSavingWinePrefix(false);
        }
    };

    const handleAddDirectory = async () => {
        if (!(window as any).electronAPI) return;

        try {
            const selectedPath = await (window as any).electronAPI.pickFolder();
            if (selectedPath) {
                setPendingCustomPath(selectedPath);
                setPendingDetectionPreset('auto');
            }
        } catch (error) {
            console.error('Error adding directory:', error);
        }
    };

    const handleConfirmCustomDirectory = async () => {
        if (!(window as any).electronAPI || !pendingCustomPath) return;

        try {
            const updatedDirs = await (window as any).electronAPI.addMonitoredDirectory(pendingCustomPath, pendingDetectionPreset);
            setDirectories(updatedDirs);
            setIsPresetDropdownOpen(false);
            setPendingCustomPath(null);
            setPendingDetectionPreset('auto');
        } catch (error) {
            console.error('Error adding directory:', error);
        }
    };

    const handleToggleDirectory = async (path: string) => {
        if (!(window as any).electronAPI) return;
        try {
            const updatedDirs = await (window as any).electronAPI.toggleMonitoredDirectory(path);
            setDirectories(updatedDirs);
        } catch (error) {
            console.error('Error toggling directory:', error);
        }
    };

    const handleRemoveDirectory = async (path: string) => {
        if (!(window as any).electronAPI) return;

        try {
            const updatedDirs = await (window as any).electronAPI.removeMonitoredDirectory(path);
            setDirectories(updatedDirs);
        } catch (error) {
            console.error('Error removing directory:', error);
        }
    };

    const steamDirectory: DirectoryConfig = {
        path: steamLibraryVdfPath || 'steamapps/libraryfolders.vdf',
        name: 'Steam',
        enabled: steamIntegrationEnabled,
        is_default: true,
    };

    const neutralBadgeStyle = "bg-accent border-border text-foreground";

    return (
        <div className="space-y-6 animate-modal-in">
            <div className="flex flex-col gap-2">
                <h4 className="text-sm font-semibold text-foreground">
                    {t('settings.monitored.title')}
                </h4>
                <p className="text-xs font-medium opacity-60 leading-relaxed text-foreground">
                    {t('settings.monitored.description')}
                </p>
            </div>

            {/* Cache Management Section */}
            <div className="border border-border rounded-md p-6 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-sm bg-muted">
                <div className="flex items-center gap-6">
                    <div className="space-y-1">
                        <h4 className="text-sm font-semibold text-foreground">
                            {t('settings.monitored.appCacheTitle')}
                        </h4>
                        <p className="text-xs font-medium leading-relaxed max-w-md opacity-60 text-foreground">
                            {t('settings.monitored.appCacheDescription')}
                        </p>
                        <p className="text-[10px] font-medium mt-1 opacity-80 text-foreground">
                            {t('settings.monitored.currentSize')}: {cacheSize}
                        </p>
                    </div>
                </div>

                <button
                    onClick={handleClearCache}
                    disabled={clearingCache}
                    className={`flex items-center justify-center gap-3 px-6 py-3 rounded-md text-[10px] font-semibold transition-all border border-border shadow-sm text-foreground ${clearingCache
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:bg-accent active:scale-95'
                        }`}
                >
                    {clearingCache ? t('settings.monitored.clearingCache') : t('settings.monitored.clearCache')}
                </button>
            </div>

            {isLinux && (
                <div className="border border-border rounded-md p-6 flex flex-col gap-4 shadow-sm bg-muted">
                    <div className="space-y-1">
                        <h4 className="text-sm font-semibold text-foreground">
                            {t('settings.monitored.winePrefixTitle')}
                        </h4>
                        <p className="text-xs font-medium leading-relaxed opacity-60 text-foreground">
                            {t('settings.monitored.winePrefixDescription')}
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                        <input
                            value={winePrefixPath}
                            onChange={(e) => setWinePrefixPath(e.target.value)}
                            placeholder={t('settings.monitored.winePrefixPlaceholder')}
                            className="flex-1 h-11 px-4 rounded-md border border-border text-xs font-semibold placeholder:text-muted-foreground bg-muted text-foreground"
                        />
                        <button
                            onClick={handleSaveWinePrefix}
                            disabled={isSavingWinePrefix || !winePrefixPath.trim()}
                            className={`h-11 px-5 rounded-md text-[10px] font-semibold border border-border transition-all text-foreground ${isSavingWinePrefix || !winePrefixPath.trim() ? 'opacity-50 cursor-not-allowed' : 'hover:bg-accent active:scale-95'}`}
                        >
                            {isSavingWinePrefix ? t('settings.monitored.savingPrefix') : t('settings.monitored.savePrefix')}
                        </button>
                    </div>
                </div>
            )}

            <div className="space-y-3">
                {isLinux && (
                    <div className="grid grid-cols-2 gap-2 rounded-xl border border-border p-1 bg-muted">
                        <button
                            onClick={() => setActivePathTab('global')}
                            className={`h-10 rounded-lg text-[10px] font-semibold transition-all ${activePathTab === 'global' ? 'shadow-sm bg-accent' : 'opacity-55 hover:opacity-100 bg-transparent'} text-foreground`}
                        >
                            {t('settings.monitored.globalTab')} · {globalPathCount}
                        </button>
                        <button
                            onClick={() => setActivePathTab('hydra')}
                            className={`h-10 rounded-lg text-[10px] font-semibold transition-all ${activePathTab === 'hydra' ? 'shadow-sm bg-accent' : 'opacity-55 hover:opacity-100 bg-transparent'} text-foreground`}
                        >
                            {t('settings.monitored.hydraLauncherTab')} · {hydraGroups.length}
                        </button>
                    </div>
                )}

                {(!isLinux || activePathTab === 'global') && (
                    <div
                        key={steamDirectory.path}
                        className={`group flex items-center justify-between p-4 rounded-xl border border-border transition-all duration-300 bg-muted ${!steamDirectory.enabled ? 'opacity-50 grayscale' : 'hover:shadow-lg'}`}
                    >
                        <div className="flex items-center gap-4 min-w-0 flex-1">
                            <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
                                <SteamBrandIcon className="w-5 h-5 opacity-80" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <p className="text-xs font-semibold truncate text-foreground">{t('settings.monitored.steamLabel')}</p>
                                    <span className="text-[7px] font-semibold px-1.5 py-0.5 rounded-sm border bg-accent border-border text-foreground">{t('settings.monitored.defaultBadge')}</span>
                                </div>
                                <p className="text-[10px] font-medium opacity-40 truncate text-foreground">{formatUsersForDisplay(steamDirectory.path)}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <p className="text-[10px] font-semibold opacity-60 text-foreground">
                                 {steamGamesFound} {t('settings.monitored.gamesLabel')}
                            </p>
                            <button
                                onClick={() => setSteamIntegrationEnabled(!steamIntegrationEnabled)}
                                disabled={selectedApi !== 'steam' || isSteamMissing}
                                className={`w-9 h-5 rounded-full transition-all duration-300 relative ${
                                    (selectedApi !== 'steam' || isSteamMissing)
                                        ? 'bg-gray-500/30 opacity-50 cursor-not-allowed'
                                        : steamIntegrationEnabled
                                            ? 'bg-emerald-500'
                                            : 'bg-gray-500/30'
                                }`}
                                title={steamIntegrationEnabled ? t('settings.api.steamIntegrationDisable') : t('settings.api.steamIntegrationEnable')}
                            >
                                <div className={`absolute top-1 w-3 h-3 rounded-full bg-white shadow-sm transition-all duration-300 ${steamIntegrationEnabled ? 'left-[22px]' : 'left-1'}`} />
                            </button>
                        </div>
                    </div>
                )}

                {isLoading ? (
                    <div className="h-20 flex items-center justify-center opacity-20">
                        <div className="animate-pulse font-semibold text-xs">Loading...</div>
                    </div>
                ) : directories.length === 0 ? (
                    <div className="p-8 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-4 text-center border-border">
                        <FolderIcon className="text-4xl opacity-10" />
                        <p className="text-xs font-medium opacity-30">{t('settings.monitored.noDirectories')}</p>
                    </div>
                ) : visibleGroups.length === 0 ? (
                    <div className="p-8 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-4 text-center border-border">
                        <FolderIcon className="text-4xl opacity-10" />
                        <p className="text-xs font-medium opacity-30">
                            {isLinux && activePathTab === 'hydra' ? t('settings.monitored.noHydraPrefixes') : t('settings.monitored.noDirectories')}
                        </p>
                    </div>
                ) : (
                    visibleGroups.map((group) => {
                        const enabledCount = group.directories.filter(d => d.enabled).length;
                        const isExpanded = expandedGroups[group.key] ?? group.directories.length <= 4;

                        return (
                            <div
                                key={group.key}
                                className="rounded-xl border border-border overflow-hidden transition-all duration-300 bg-muted"
                            >
                                <button
                                    onClick={() => toggleGroup(group.key)}
                                    className="w-full p-4 flex items-center justify-between gap-4 text-left hover:bg-accent transition-colors"
                                >
                                    <div className="flex items-center gap-4 min-w-0 flex-1">
                                        {group.imageUrl ? (
                                            <div className="w-20 h-11 rounded-md overflow-hidden bg-accent border border-border flex-shrink-0">
                                                <img
                                                    src={group.imageUrl}
                                                    alt=""
                                                    className="w-full h-full object-cover"
                                                    onError={(event) => {
                                                        event.currentTarget.style.display = 'none';
                                                    }}
                                                />
                                            </div>
                                        ) : (
                                            <div className="w-11 h-11 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
                                                <FolderIcon className="text-xl opacity-60" />
                                            </div>
                                        )}

                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <p className="text-xs font-semibold truncate text-foreground">{group.title}</p>
                                                {group.gameId && (
                                                    <span className="text-[7px] font-semibold px-1.5 py-0.5 rounded-sm border bg-accent border-border text-foreground">{t('settings.monitored.gameBadge')}</span>
                                                )}
                                                {!group.custom && (
                                                    <span className="text-[7px] font-semibold px-1.5 py-0.5 rounded-sm border bg-accent border-border text-foreground">{t('settings.monitored.defaultBadge')}</span>
                                                )}
                                            </div>
                                            <p className="text-[10px] font-medium opacity-50 truncate text-foreground">{group.subtitle}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 flex-shrink-0">
                                        <span className="text-[9px] font-semibold opacity-60 text-foreground">
                                            {enabledCount}/{group.directories.length} {t('settings.monitored.pathsLabel')}
                                        </span>
                                        <span className={`text-xs transition-transform text-muted-foreground ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                                    </div>
                                </button>

                                {isExpanded && (
                                    <div className="border-t border-border divide-y divide-border">
                                        {group.directories.map((dir) => (
                                            <div
                                                key={dir.path}
                                                className={`group flex items-center justify-between p-3 pl-5 gap-4 transition-all ${!dir.enabled ? 'opacity-50 grayscale' : ''}`}
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <FolderIcon className="text-sm opacity-50 flex-shrink-0" />
                                                         <p className="text-[10px] font-semibold truncate text-foreground">{dir.name.replace(/^Wine \([^)]*\) \/ /, '')}</p>
                                                        {!dir.is_default && (dir.detectionPreset || 'auto') !== 'auto' && (
                                                            <span className="text-[7px] font-semibold px-1.5 py-0.5 rounded-sm border flex-shrink-0 bg-accent border-border text-foreground">{getPresetLabel(dir.detectionPreset)}</span>
                                                        )}
                                                    </div>
                                                    <p className="text-[9px] font-medium opacity-40 truncate mt-1 text-foreground">
                                                        {formatUsersForDisplay(getRelativeWinePath(dir.path))}
                                                    </p>
                                                </div>

                                                <div className="flex items-center gap-3 flex-shrink-0">
                                                    <button
                                                        onClick={() => handleToggleDirectory(dir.path)}
                                                        className={`w-9 h-5 rounded-full transition-all duration-300 relative ${dir.enabled ? 'bg-emerald-500' : 'bg-gray-500/30'}`}
                                                        title={dir.enabled ? t('settings.monitored.disableMonitoring') : t('settings.monitored.enableMonitoring')}
                                                    >
                                                        <div className={`absolute top-1 w-3 h-3 rounded-full bg-white shadow-sm transition-all duration-300 ${dir.enabled ? 'left-[22px]' : 'left-1'}`} />
                                                    </button>

                                                    {!dir.is_default && (
                                                        <button
                                                            onClick={() => handleRemoveDirectory(dir.path)}
                                                            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                                                            title={t('settings.monitored.removeDirectory')}
                                                        >
                                                            <CloseIcon className="text-lg" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}

                {(!isLinux || activePathTab === 'global') && (
                    pendingCustomPath ? (
                        <div className="rounded-xl border border-border p-4 space-y-3 bg-muted">
                            <div className="space-y-1">
                                <p className="text-[10px] font-semibold text-foreground">{t('settings.monitored.customDetectionPreset')}</p>
                                <p className="text-[10px] font-semibold opacity-50 truncate text-foreground" title={pendingCustomPath}>{formatUsersForDisplay(pendingCustomPath)}</p>
                            </div>

                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setIsPresetDropdownOpen(!isPresetDropdownOpen)}
                                    className="w-full h-11 border border-border rounded-md px-3 flex items-center justify-between transition-all duration-300 bg-muted"
                                >
                                    <span className="text-xs font-bold truncate text-foreground">
                                        {DETECTION_PRESETS.find(p => p.value === pendingDetectionPreset)?.label}
                                    </span>
                                    <svg className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-300 text-muted-foreground ${isPresetDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>

                                {isPresetDropdownOpen && (
                                    <>
                                        <div className="fixed inset-0 z-30" onClick={() => setIsPresetDropdownOpen(false)} />
                                        <ul className="absolute z-40 mt-1 w-full border border-border rounded-md shadow-2xl overflow-hidden p-1.5 animate-modal-in bg-card">
                                            {DETECTION_PRESETS.map((preset) => (
                                                <li key={preset.value}>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setPendingDetectionPreset(preset.value);
                                                            setIsPresetDropdownOpen(false);
                                                        }}
                                                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md transition-colors ${pendingDetectionPreset === preset.value
                                                            ? 'bg-border text-foreground shadow-sm'
                                                            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                                                            }`}
                                                    >
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-xs font-bold truncate">{preset.label}</p>
                                                            <p className="text-[10px] opacity-60 truncate">{preset.description}</p>
                                                        </div>
                                                        {pendingDetectionPreset === preset.value && (
                                                            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 ml-2 bg-foreground" />
                                                        )}
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    </>
                                )}
                            </div>

                                <p className="text-[10px] font-medium opacity-55 leading-relaxed text-foreground">
                                 {t('settings.monitored.customDetectionPresetDesc')}
                                </p>

                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => {
                                        setIsPresetDropdownOpen(false);
                                          setPendingCustomPath(null);
                                          setPendingDetectionPreset('auto');
                                      }}
                                    className="h-10 rounded-md border border-border text-[10px] font-semibold transition-all hover:bg-accent text-foreground"
                                >
                                    {t('common.cancel')}
                                </button>
                                <button
                                    onClick={handleConfirmCustomDirectory}
                                    className="h-10 rounded-md text-[10px] font-semibold transition-all shadow-sm bg-foreground text-background"
                                >
                                    {t('settings.monitored.addPreset')}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={handleAddDirectory}
                            className="w-full h-14 border-2 border-dashed rounded-xl flex items-center justify-center gap-3 transition-all duration-300 hover:bg-accent active:scale-[0.98] border-border text-muted-foreground"
                        >
                            <span className="text-2xl opacity-60">+</span>
                            <span className="text-[10px] font-semibold">{t('settings.monitored.addDirectory')}</span>
                        </button>
                    )
                )}
            </div>
        </div >
    );
};

export default MonitoredSettings;
