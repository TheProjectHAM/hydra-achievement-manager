import React, { useState, useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useI18n } from '../../contexts/I18nContext';
import { FolderIcon, CloseIcon, SteamBrandIcon, HydraIcon } from '../Icons';
import { ApiSource } from '../../types';
import { getGameNames } from '../../tauri-api';
import { getAppPlatform } from '@/lib/platform';
import { getSteamLogoFallbackUrl } from '@/lib/steam-assets';
import { ChevronDown, FolderOpen, Plus, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Button,
  SettingsActionRow,
  SettingsPage,
  SettingsPanel,
  SettingsSection,
  StatusBadge,
  Switch,
} from './shared';

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
                    imageUrl: gameId ? getSteamLogoFallbackUrl(gameId) : undefined,
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
    }, [directories, gameNames]);

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

    return (
        <SettingsPage
            title={t('settings.monitored.title')}
            description={t('settings.monitored.description')}
        >
            <SettingsPanel>
                <SettingsActionRow
                    label={t('settings.monitored.appCacheTitle')}
                    description={`${t('settings.monitored.appCacheDescription')} · ${t('settings.monitored.currentSize')}: ${cacheSize}`}
                    actionLabel={clearingCache ? t('settings.monitored.clearingCache') : t('settings.monitored.clearCache')}
                    onAction={handleClearCache}
                    disabled={clearingCache}
                    loading={clearingCache}
                    icon={<RefreshCw className={cn('h-3.5 w-3.5', clearingCache && 'animate-spin')} />}
                />
            </SettingsPanel>

            {isLinux && (
                <SettingsSection title={t('settings.monitored.winePrefixTitle')}>
                    <SettingsPanel>
                        <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row">
                            <input
                                value={winePrefixPath}
                                onChange={(e) => setWinePrefixPath(e.target.value)}
                                placeholder={t('settings.monitored.winePrefixPlaceholder')}
                                className="h-9 flex-1 rounded-lg border border-input bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground"
                            />
                            <Button
                                onClick={handleSaveWinePrefix}
                                disabled={isSavingWinePrefix || !winePrefixPath.trim()}
                                size="sm"
                            >
                                {isSavingWinePrefix ? t('settings.monitored.savingPrefix') : t('settings.monitored.savePrefix')}
                            </Button>
                        </div>
                    </SettingsPanel>
                </SettingsSection>
            )}

            <section className="overflow-hidden rounded-xl border border-border bg-card/60">
                <div className="flex items-center justify-between gap-3 p-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                        <FolderOpen className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <p className="truncate text-sm font-medium text-foreground">{t('settings.monitored.title')}</p>
                                <span className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">
                                    {isLinux ? (activePathTab === 'global' ? globalPathCount : hydraPathCount) : globalPathCount} {t('settings.monitored.pathsLabel')}
                                </span>
                            </div>
                            <p className="mt-0.5 text-[10px] font-medium leading-relaxed text-muted-foreground">{t('settings.monitored.description')}</p>
                        </div>
                    </div>
                    {(!isLinux || activePathTab === 'global') && !pendingCustomPath && (
                        <button
                            onClick={handleAddDirectory}
                            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-accent px-3 text-[10px] font-semibold text-foreground"
                        >
                            <Plus className="h-3 w-3" />
                            {t('settings.monitored.addDirectory')}
                        </button>
                    )}
                </div>
            <div className="space-y-3 border-t border-border p-3">
                {isLinux && (
                    <div className="grid grid-cols-2 gap-2 rounded-md border border-border bg-background p-1">
                        <button
                            onClick={() => setActivePathTab('global')}
                            className={cn(
                                'flex h-11 items-center justify-between gap-3 rounded px-3 text-left transition-colors',
                                activePathTab === 'global' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                            )}
                        >
                            <span className="flex min-w-0 items-center gap-2">
                                <FolderOpen className="h-4 w-4 flex-shrink-0" />
                                <span className="truncate text-[10px] font-semibold">{t('settings.monitored.globalTab')}</span>
                            </span>
                            <span className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">{globalPathCount}</span>
                        </button>
                        <button
                            onClick={() => setActivePathTab('hydra')}
                            className={cn(
                                'flex h-11 items-center justify-between gap-3 rounded px-3 text-left transition-colors',
                                activePathTab === 'hydra' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                            )}
                        >
                            <span className="flex min-w-0 items-center gap-2">
                                <HydraIcon className="h-4 w-4 flex-shrink-0" />
                                <span className="truncate text-[10px] font-semibold">{t('settings.monitored.hydraLauncherTab')}</span>
                            </span>
                            <span className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">{hydraPathCount}</span>
                        </button>
                    </div>
                )}

                {(!isLinux || activePathTab === 'global') && (
                    <div
                        key={steamDirectory.path}
                        className={cn('group flex items-center justify-between gap-4 rounded-md border border-border bg-muted/50 p-3 transition-colors hover:bg-accent/45', !steamDirectory.enabled && 'opacity-60 grayscale')}
                    >
                        <div className="flex items-center gap-4 min-w-0 flex-1">
                            <SteamBrandIcon className="h-5 w-5 flex-shrink-0 text-muted-foreground opacity-80" />
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <p className="text-xs font-semibold truncate text-foreground">{t('settings.monitored.steamLabel')}</p>
                                    <StatusBadge>{t('settings.monitored.defaultBadge')}</StatusBadge>
                                </div>
                                <p className="truncate text-[10px] font-medium text-muted-foreground">{formatUsersForDisplay(steamDirectory.path)}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <p className="text-[10px] font-semibold text-muted-foreground">
                                 {steamGamesFound} {t('settings.monitored.gamesLabel')}
                            </p>
                            <Switch
                                size="sm"
                                checked={steamIntegrationEnabled}
                                disabled={selectedApi !== 'steam' || isSteamMissing}
                                onCheckedChange={setSteamIntegrationEnabled}
                            />
                        </div>
                    </div>
                )}

                {isLoading ? (
                    <div className="h-20 flex items-center justify-center opacity-20">
                        <div className="animate-pulse font-semibold text-xs">Loading...</div>
                    </div>
                ) : directories.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border p-8 text-center">
                        <FolderIcon className="text-4xl text-muted-foreground opacity-30" />
                        <p className="text-xs font-medium text-muted-foreground">{t('settings.monitored.noDirectories')}</p>
                    </div>
                ) : visibleGroups.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border p-8 text-center">
                        <FolderIcon className="text-4xl text-muted-foreground opacity-30" />
                        <p className="text-xs font-medium text-muted-foreground">
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
                                className="overflow-hidden rounded-xl border border-border bg-card transition-shadow duration-300 ease-out hover:shadow-sm"
                            >
                                <button
                                    onClick={() => toggleGroup(group.key)}
                                    className="flex w-full items-center justify-between gap-4 p-3 text-left transition-colors hover:bg-accent/45"
                                >
                                    <div className="flex items-center gap-4 min-w-0 flex-1">
                                        {group.imageUrl ? (
                                             <div className="h-11 w-20 flex-shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                                                <img
                                                    src={group.imageUrl}
                                                    alt=""
                                                    className="w-full h-full object-cover"
                                                    onError={(event) => {
                                                        event.currentTarget.style.display = 'none';
                                                    }}
                                                />
                                            </div>
                                        ) : group.gameId ? (
                                             <HydraIcon className="h-5 w-5 flex-shrink-0 text-muted-foreground opacity-80" />
                                        ) : (
                                             <FolderIcon className="flex-shrink-0 text-xl text-muted-foreground opacity-70" />
                                        )}

                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <p className="text-xs font-semibold truncate text-foreground">{group.title}</p>
                                                {group.gameId && (
                                                     <StatusBadge>{t('settings.monitored.gameBadge')}</StatusBadge>
                                                )}
                                                {!group.custom && (
                                                     <StatusBadge>{t('settings.monitored.defaultBadge')}</StatusBadge>
                                                )}
                                            </div>
                                             <p className="truncate text-[10px] font-medium text-muted-foreground">{group.subtitle}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 flex-shrink-0">
                                         <span className="text-[9px] font-semibold text-muted-foreground">
                                             {enabledCount}/{group.directories.length} {t('settings.monitored.pathsLabel')}
                                         </span>
                                        <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', isExpanded && 'rotate-180')} />
                                    </div>
                                </button>

                                {isExpanded && (
                                    <div className="divide-y divide-border border-t border-border bg-background">
                                        {group.directories.map((dir) => (
                                            <div
                                                key={dir.path}
                                                className={cn('group flex items-center justify-between gap-4 p-3 pl-5 transition-colors hover:bg-accent/45', !dir.enabled && 'opacity-60 grayscale')}
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <FolderIcon className="flex-shrink-0 text-sm text-muted-foreground" />
                                                         <p className="truncate text-[10px] font-semibold text-foreground">{dir.name.replace(/^Wine \([^)]*\) \/ /, '')}</p>
                                                        {!dir.is_default && (dir.detectionPreset || 'auto') !== 'auto' && (
                                                            <span className="h-5 flex-shrink-0 rounded-md border border-border bg-accent px-1.5 text-[9px] font-semibold leading-5 text-foreground">{getPresetLabel(dir.detectionPreset)}</span>
                                                        )}
                                                    </div>
                                                    <p className="mt-1 truncate text-[9px] font-medium text-muted-foreground">
                                                        {formatUsersForDisplay(getRelativeWinePath(dir.path))}
                                                    </p>
                                                </div>

                                                <div className="flex items-center gap-3 flex-shrink-0">
                                                    <Switch
                                                        size="sm"
                                                        checked={dir.enabled}
                                                        onCheckedChange={() => handleToggleDirectory(dir.path)}
                                                    />

                                                    {!dir.is_default && (
                                                        <button
                                                            onClick={() => handleRemoveDirectory(dir.path)}
                                                            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-all hover:bg-accent hover:text-foreground group-hover:opacity-100"
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

                {(!isLinux || activePathTab === 'global') && pendingCustomPath && (
                        <div className="space-y-3 rounded-md border border-border bg-muted/50 p-3">
                            <div className="space-y-1">
                                <p className="text-[10px] font-semibold text-foreground">{t('settings.monitored.customDetectionPreset')}</p>
                                <p className="truncate text-[10px] font-medium text-muted-foreground" title={pendingCustomPath}>{formatUsersForDisplay(pendingCustomPath)}</p>
                            </div>

                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setIsPresetDropdownOpen(!isPresetDropdownOpen)}
                                    className="flex h-10 w-full items-center justify-between rounded-md border border-border bg-background px-3 transition-all duration-300"
                                >
                                    <span className="truncate text-xs font-semibold text-foreground">
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
                                                             ? 'bg-accent text-foreground shadow-sm'
                                                            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                                                            }`}
                                                    >
                                                        <div className="min-w-0 flex-1">
                                                            <p className="truncate text-xs font-semibold">{preset.label}</p>
                                                            <p className="truncate text-[10px] text-muted-foreground">{preset.description}</p>
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

                                <p className="text-[10px] font-medium leading-relaxed text-muted-foreground">
                                 {t('settings.monitored.customDetectionPresetDesc')}
                                </p>

                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => {
                                        setIsPresetDropdownOpen(false);
                                          setPendingCustomPath(null);
                                          setPendingDetectionPreset('auto');
                                      }}
                                    className="h-10 rounded-md border border-border bg-background text-[10px] font-semibold text-foreground transition-all hover:bg-accent"
                                >
                                    {t('common.cancel')}
                                </button>
                                <button
                                    onClick={handleConfirmCustomDirectory}
                                    className="h-10 rounded-md bg-foreground text-[10px] font-semibold text-background transition-all shadow-sm"
                                >
                                    {t('settings.monitored.addPreset')}
                                </button>
                            </div>
                        </div>
                )}
            </div>
            </section>
        </SettingsPage>
    );
};

export default MonitoredSettings;
