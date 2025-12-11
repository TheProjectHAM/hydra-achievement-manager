import React, { useState, useEffect } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { CloseIcon, FolderIcon } from './Icons';

interface DirectorySelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (directoryPath: string) => void;
  gameName: string;
  directories: Array<{ path: string; name: string; achievementCount: number; lastModified: Date }>;
}

const DirectoryItem: React.FC<{
  dir: { path: string; name: string; achievementCount: number; lastModified: Date };
  isSelected: boolean;
  onSelect: () => void;
}> = ({ dir, isSelected, onSelect }) => {
  const baseClasses = 'bg-white dark:bg-[#141415] border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20';
  const selectedClasses = 'bg-gray-100 dark:bg-[#1a1a1b] border-gray-800 dark:border-white';

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
      <div className="flex items-center gap-3 min-w-0">
        <FolderIcon className="text-xl text-gray-600 dark:text-gray-400 flex-shrink-0" />
        <div className="flex-grow min-w-0">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-gray-800 dark:text-gray-200 truncate">{dir.name}</p>
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <span>{dir.achievementCount} achievements</span>
            </div>
          </div>
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{dir.path}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 ml-2">
              {formatDate(dir.lastModified)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const DirectorySelectionModal: React.FC<DirectorySelectionModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  gameName,
  directories,
}) => {
  const { t } = useI18n();
  const [selectedPath, setSelectedPath] = useState('');

  useEffect(() => {
    if (isOpen) setSelectedPath('');
  }, [isOpen]);

  const handleConfirm = () => {
    if (selectedPath) onSelect(selectedPath);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="directory-modal-title"
    >
      <div
        className="fixed inset-x-0 bottom-0 top-10 bg-black/60 backdrop-blur-md"
        onClick={onClose}
        aria-hidden="true"
      ></div>

      <div className="relative w-[640px] h-[480px] bg-gray-50 dark:bg-[#0a0a0b] rounded-lg shadow-2xl border border-black/10 dark:border-white/5 flex flex-col">
        <div className="flex items-start justify-between p-6 pb-4 flex-shrink-0">
          <div>
            <h2 id="directory-modal-title" className="text-lg font-bold text-gray-900 dark:text-white">
              {t('directorySelectionModal.title', { gameName })}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {t('directorySelectionModal.description')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="-mt-2 -mr-2 p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            aria-label={t('common.cancel')}
          >
            <CloseIcon className="text-xl" />
          </button>
        </div>

        <div className="px-6 flex-grow overflow-y-auto">
          <div className="py-5 space-y-3">
            {directories.map(dir => (
              <DirectoryItem
                key={dir.path}
                dir={dir}
                isSelected={selectedPath === dir.path}
                onSelect={() => setSelectedPath(dir.path)}
              />
            ))}
          </div>
        </div>

        <div className="flex justify-end items-center p-6 pt-4 flex-shrink-0">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="bg-transparent hover:bg-black/5 text-gray-700 dark:hover:bg-white/5 dark:text-gray-300 font-semibold py-2 px-5 rounded-lg transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedPath}
              className="bg-gray-800 hover:bg-gray-700 text-white dark:bg-[#1a1a1b] dark:hover:bg-[#232325] dark:text-white font-semibold py-2 px-5 rounded-lg transition-all shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {t('directorySelectionModal.select')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DirectorySelectionModal;
