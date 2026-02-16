import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useI18n } from '../../contexts/I18nContext';
import { FolderIcon, CloseIcon, SteamIcon } from '../Icons';
import { ApiSource } from '../../types';

interface DirectoryConfig {
    path: string;
    name: string;
    enabled: boolean;
    is_default: boolean;
}

interface MonitoredSettingsProps {
    selectedApi: ApiSource;
    steamIntegrationEnabled: boolean;
    setSteamIntegrationEnabled: (enabled: boolean) => void;
}

const MonitoredSettings: React.FC<MonitoredSettingsProps> = ({
    selectedApi,
    steamIntegrationEnabled,
    setSteamIntegrationEnabled
}) => {
    const { t } = useI18n();
    const [directories, setDirectories] = useState<DirectoryConfig[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [cacheSize, setCacheSize] = useState<string>('Loading...');
    const [clearingCache, setClearingCache] = useState(false);
    const [steamLibraryVdfPath, setSteamLibraryVdfPath] = useState<string | null>(null);
    const [steamGamesFound, setSteamGamesFound] = useState<number>(0);
    const [isSteamMissing, setIsSteamMissing] = useState(false);

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

    const handleAddDirectory = async () => {
        if (!(window as any).electronAPI) return;

        try {
            const selectedPath = await (window as any).electronAPI.pickFolder();
            if (selectedPath) {
                const updatedDirs = await (window as any).electronAPI.addMonitoredDirectory(selectedPath);
                setDirectories(updatedDirs);
            }
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

    const neutralBadgeStyle = {
        backgroundColor: 'var(--hover-bg)',
        borderColor: 'var(--border-color)',
        color: 'var(--text-main)',
    };

    return (
        <div className="space-y-6 animate-modal-in">
            <div className="flex flex-col gap-2">
                <h4 className="text-sm font-black tracking-[0.15em] uppercase" style={{ color: 'var(--text-main)' }}>
                    {t('settings.monitored.title')}
                </h4>
                <p className="text-xs font-medium opacity-60 leading-relaxed" style={{ color: 'var(--text-main)' }}>
                    {t('settings.monitored.description')}
                </p>
            </div>

            {/* Cache Management Section */}
            <div className="border rounded-md p-6 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-sm" style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--border-color)' }}>
                <div className="flex items-center gap-6">
                    <div className="space-y-1">
                        <h4 className="text-sm font-black uppercase tracking-[0.15em]" style={{ color: 'var(--text-main)' }}>
                            App Cache
                        </h4>
                        <p className="text-xs font-medium leading-relaxed max-w-md opacity-60" style={{ color: 'var(--text-main)' }}>
                            Stores game names and total achievements to improve offline experience.
                        </p>
                        <p className="text-[10px] font-bold mt-1 uppercase tracking-wide opacity-80" style={{ color: 'var(--text-main)' }}>
                            Current Size: {cacheSize}
                        </p>
                    </div>
                </div>

                <button
                    onClick={handleClearCache}
                    disabled={clearingCache}
                    className={`flex items-center justify-center gap-3 px-6 py-3 rounded-md text-[10px] font-black uppercase tracking-widest transition-all border shadow-sm ${clearingCache
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:bg-[var(--hover-bg)] active:scale-95'
                        }`}
                    style={{
                        borderColor: 'var(--border-color)',
                        color: 'var(--text-main)'
                    }}
                >
                    {clearingCache ? 'Clearing...' : 'Clear Cache'}
                </button>
            </div>

            <div className="space-y-3">
                <div
                    key={steamDirectory.path}
                    className={`group flex items-center justify-between p-4 rounded-xl border transition-all duration-300 ${!steamDirectory.enabled ? 'opacity-50 grayscale' : 'hover:shadow-lg'}`}
                    style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--border-color)' }}
                >
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-lg bg-[var(--hover-bg)] flex items-center justify-center flex-shrink-0">
                            <SteamIcon className="text-xl opacity-70" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <p className="text-xs font-black uppercase tracking-widest truncate" style={{ color: 'var(--text-main)' }}>Steam</p>
                                <span className="text-[7px] font-black px-1.5 py-0.5 rounded-sm border tracking-tighter" style={neutralBadgeStyle}>DEFAULT</span>
                            </div>
                            <p className="text-[10px] font-medium opacity-40 truncate" style={{ color: 'var(--text-main)' }}>{steamDirectory.path}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <p className="text-[10px] font-black uppercase tracking-wider opacity-60" style={{ color: 'var(--text-main)' }}>
                            {steamGamesFound} games
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
                            title={steamIntegrationEnabled ? "Disable Steam integration" : "Enable Steam integration"}
                        >
                            <div className={`absolute top-1 w-3 h-3 rounded-full bg-white shadow-sm transition-all duration-300 ${steamIntegrationEnabled ? 'left-[22px]' : 'left-1'}`} />
                        </button>
                    </div>
                </div>

                {isLoading ? (
                    <div className="h-20 flex items-center justify-center opacity-20">
                        <div className="animate-pulse font-black uppercase tracking-widest text-xs">Loading...</div>
                    </div>
                ) : directories.length === 0 ? (
                    <div className="p-8 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-4 text-center" style={{ borderColor: 'var(--border-color)' }}>
                        <FolderIcon className="text-4xl opacity-10" />
                        <p className="text-xs font-bold opacity-30 uppercase tracking-widest">{t('settings.monitored.noDirectories')}</p>
                    </div>
                ) : (
                    directories.map((dir) => (
                        <div
                            key={dir.path}
                            className={`group flex items-center justify-between p-4 rounded-xl border transition-all duration-300 ${!dir.enabled ? 'opacity-50 grayscale' : 'hover:shadow-lg'}`}
                            style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--border-color)' }}
                        >
                            <div className="flex items-center gap-4 min-w-0 flex-1">
                                <div className="w-10 h-10 rounded-lg bg-[var(--hover-bg)] flex items-center justify-center flex-shrink-0">
                                    <FolderIcon className="text-xl opacity-60" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <p className="text-xs font-black uppercase tracking-widest truncate" style={{ color: 'var(--text-main)' }}>{dir.name}</p>
                                        {dir.is_default && (
                                            <span className="text-[7px] font-black px-1.5 py-0.5 rounded-sm border tracking-tighter" style={neutralBadgeStyle}>DEFAULT</span>
                                        )}
                                    </div>
                                    <p className="text-[10px] font-medium opacity-40 truncate" style={{ color: 'var(--text-main)' }}>{dir.path}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => handleToggleDirectory(dir.path)}
                                    className={`w-9 h-5 rounded-full transition-all duration-300 relative ${dir.enabled ? 'bg-emerald-500' : 'bg-gray-500/30'}`}
                                    title={dir.enabled ? "Disable monitoring" : "Enable monitoring"}
                                >
                                    <div className={`absolute top-1 w-3 h-3 rounded-full bg-white shadow-sm transition-all duration-300 ${dir.enabled ? 'left-[22px]' : 'left-1'}`} />
                                </button>

                                {!dir.is_default && (
                                    <button
                                        onClick={() => handleRemoveDirectory(dir.path)}
                                        className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                                        title="Remove directory"
                                    >
                                        <CloseIcon className="text-lg" />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}

                <button
                    onClick={handleAddDirectory}
                    className="w-full h-14 border-2 border-dashed rounded-xl flex items-center justify-center gap-3 transition-all duration-300 hover:bg-[var(--hover-bg)] active:scale-[0.98]"
                    style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
                >
                    <span className="text-2xl opacity-60">+</span>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">{t('settings.monitored.addDirectory')}</span>
                </button>
            </div>
        </div >
    );
};

export default MonitoredSettings;
