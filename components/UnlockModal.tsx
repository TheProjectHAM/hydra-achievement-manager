
import React, { useState, useEffect } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { SteamSearchResult } from '../types';
import { CloseIcon, FolderIcon, CheckIcon } from './Icons';
import { useTheme } from '../contexts/ThemeContext';
import { useMonitoredAchievements } from '../contexts/MonitoredAchievementsContext';
import { DEFAULT_PATHS } from '../constants';

interface UnlockModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (path: string) => void;
    game: SteamSearchResult;
    newAchievementCount: number;
}





const PathItem: React.FC<{
    path: string;
    isSelected: boolean;
    existingAchievementCount: number | null;
    lastModified: Date | null;
    newAchievementCount: number;
    onSelect: () => void;
}> = ({ path, isSelected, existingAchievementCount, lastModified, newAchievementCount, onSelect }) => {
    const { t } = useI18n();
    const selectedClasses = 'border-gray-800 dark:border-white bg-black/5 dark:bg-white/5';
    const baseClasses = 'border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20';
    const hasExistingFile = existingAchievementCount !== null;

    const formatDate = (date: Date) => {
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div
            className={`p-3 rounded-lg border transition-all cursor-pointer ${isSelected ? selectedClasses : baseClasses}`}
            onClick={onSelect}
            role="radio"
            aria-checked={isSelected}
            tabIndex={0}
            onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onSelect()}
        >
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 min-w-0 flex-grow">
                    <FolderIcon className="text-xl text-gray-600 dark:text-gray-400 flex-shrink-0" />
                    <div className="min-w-0 flex-grow">
                        <p className="font-semibold text-gray-800 dark:text-gray-200 truncate">{path}</p>
                        {hasExistingFile && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 space-y-1">
                                <p>{t('unlockModal.existingAchievements', { count: existingAchievementCount })}</p>
                                <div className="flex items-center justify-between">
                                    <p className="text-blue-600 dark:text-blue-400 font-medium">
                                        {t('unlockModal.newTotal', { count: newAchievementCount })}
                                    </p>
                                    <p className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                                        {t('unlockModal.lastModified', { date: formatDate(lastModified!) })}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <div className="relative">
                    {hasExistingFile && (
                        <div className="w-5 h-5 flex-shrink-0 bg-green-500/10 dark:bg-green-500/20 text-green-500 rounded-md flex items-center justify-center mt-4" title={t('unlockModal.overwriteWarning')}>
                            <CheckIcon className="text-sm" />
                        </div>
                    )}
                </div>
            </div>

        </div>
    );
};


const UnlockModal: React.FC<UnlockModalProps> = ({ isOpen, onClose, onConfirm, game, newAchievementCount }) => {
    const { t } = useI18n();
    const { games: monitoredGames } = useMonitoredAchievements();
    const [selectedPath, setSelectedPath] = useState('');

    useEffect(() => {
        if (isOpen) {
            setSelectedPath('');
        }
    }, [isOpen, game]);

    const getExistingFileInfo = (path: string) => {
        const gameInPath = monitoredGames.find(g => g.gameId === game.id.toString() && g.directory === path);
        if (gameInPath) {
            return {
                count: gameInPath.achievements.length,
                lastModified: gameInPath.lastModified
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

    return (
        <div
            className="fixed inset-0 z-40 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="unlock-modal-title"
        >
            <div className="fixed inset-x-0 bottom-0 top-10 bg-black/60 backdrop-blur-md" onClick={onClose} aria-hidden="true"></div>

            <div className="relative w-[640px] h-[480px] bg-gray-50 dark:bg-[#0a0a0b] rounded-lg shadow-2xl border border-black/10 dark:border-white/5 flex flex-col">

                <div className="flex items-start justify-between p-6 pb-4 flex-shrink-0">
                    <div>
                        <h2 id="unlock-modal-title" className="text-lg font-bold text-gray-900 dark:text-white">{t('unlockModal.title')}</h2>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('unlockModal.description', { gameName: game.name })}</p>
                    </div>
                    <button onClick={onClose} className="-mt-2 -mr-2 p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-black/10 dark:hover:bg-white/10 transition-colors" aria-label={t('unlockModal.cancel')}>
                        <CloseIcon className="text-xl" />
                    </button>
                </div>

                <div className="px-6 flex-grow overflow-y-auto">
                    <div className="py-5 space-y-3">
                        {DEFAULT_PATHS.map(path => {
                            const existingInfo = getExistingFileInfo(path);
                            return (
                                <PathItem
                                    key={path}
                                    path={path}
                                    isSelected={selectedPath === path}
                                    existingAchievementCount={existingInfo?.count ?? null}
                                    lastModified={existingInfo?.lastModified ?? null}
                                    newAchievementCount={newAchievementCount}
                                    onSelect={() => setSelectedPath(path)}
                                />
                            );
                        })}
                    </div>
                </div>

                <div className="flex justify-end items-center p-6 pt-4 flex-shrink-0">
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="bg-transparent hover:bg-black/5 text-gray-700 dark:hover:bg-white/5 dark:text-gray-300 font-semibold py-2 px-5 rounded-lg transition-colors"
                        >
                            {t('unlockModal.cancel')}
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={!selectedPath}
                            className="bg-gray-800 hover:bg-gray-700 text-white dark:bg-[#1a1a1b] dark:hover:bg-[#232325] dark:text-white font-semibold py-2 px-5 rounded-lg transition-all shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {t('unlockModal.unlockHere')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UnlockModal;
