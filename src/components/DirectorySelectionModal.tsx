import React, { useState, useEffect } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { CloseIcon, FolderIcon, SteamBrandIcon } from './Icons';
import { useTheme } from '../contexts/ThemeContext';
import { formatDateObj } from '../formatters';

interface DirectorySelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (directoryPath: string) => void;
  gameName: string;
  directories: Array<{ path: string; name: string; achievementCount: number; lastModified: Date; source?: 'steam' | 'local' }>;
}

const DirectoryItem: React.FC<{
  dir: { path: string; name: string; achievementCount: number; lastModified: Date; source?: 'steam' | 'local' };
  isSelected: boolean;
  onSelect: () => void;
}> = ({ dir, isSelected, onSelect }) => {
  const { t } = useI18n();
  const { dateFormat, timeFormat } = useTheme();
  const formatUsersForDisplay = (input: string) =>
    input.replace(/(^|[\\/])users(?=[\\/])/gi, '$1Users');
  const getPathTitle = (input: string) => {
    const normalized = input.replace(/[\\]+/g, '/');
    const parts = normalized.split('/').filter(Boolean);
    return parts[parts.length - 1] || input;
  };

  const formattedDate = formatDateObj(dir.lastModified, dateFormat, timeFormat);
  const displayPath = formatUsersForDisplay(dir.path);
  const displayTitle = getPathTitle(displayPath);

  const isSteam = dir.source === 'steam' || dir.path.startsWith('steam://');

  return (
    <div
      className={`group rounded-lg border transition-all cursor-pointer overflow-hidden ${isSelected ? 'shadow-md' : 'hover:bg-[var(--hover-bg)]'}`}
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
                color: 'var(--text-muted)',
                borderColor: 'var(--border-color)'
              }}
            >
              {isSteam ? 'STEAM' : 'LOCAL'}
            </span>
            <p className="font-bold text-sm truncate min-w-0" style={{ color: 'var(--text-main)' }}>
              {isSteam ? dir.name : displayTitle}
            </p>
            <span className="text-[10px] font-semibold opacity-70 ml-auto flex-shrink-0 whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
              {dir.achievementCount} {t('common.achievements').toLowerCase()}
            </span>
          </div>
          <p
            className="text-[11px] font-medium truncate opacity-60"
            style={{ color: 'var(--text-main)' }}
            title={displayPath}
          >
            {displayPath}
          </p>
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
      className="fixed top-10 left-0 right-0 bottom-0 z-40 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="directory-modal-title"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      ></div>

      <div
        className="relative w-[640px] h-[480px] rounded-lg shadow-2xl border flex flex-col animate-modal-in"
        style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}
      >
        <div className="flex items-start justify-between p-6 pb-4 flex-shrink-0">
          <div>
            <h2 id="directory-modal-title" className="text-xl font-bold" style={{ color: 'var(--text-main)' }}>
              {t('directorySelectionModal.title', { gameName })}
            </h2>
            <p className="text-xs font-medium mt-1" style={{ color: 'var(--text-muted)' }}>
              {t('directorySelectionModal.description')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="-mt-1 -mr-1 w-10 h-10 flex items-center justify-center rounded-md transition-all"
            style={{ color: 'var(--text-muted)' }}
            aria-label={t('common.cancel')}
          >
            <CloseIcon className="text-xl hover:text-[var(--text-main)] transition-colors text-[var(--text-muted)]" />
          </button>
        </div>

        <div className="px-6 flex-grow overflow-y-auto custom-scrollbar">
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

        <div className="flex justify-end items-center p-6 pt-4 flex-shrink-0 border-t" style={{ borderColor: 'var(--border-color)' }}>
          <div className="flex w-full gap-3">
            <button
              onClick={onClose}
              className="flex-1 h-12 rounded-md text-[10px] font-black uppercase tracking-[0.2em] border transition-all"
              style={{ backgroundColor: 'var(--hover-bg)', borderColor: 'var(--border-color)', color: 'var(--text-main)' }}
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedPath}
              className="flex-1 h-12 rounded-md text-[10px] font-black uppercase tracking-[0.2em] disabled:opacity-20 disabled:cursor-not-allowed transition-all shadow-xl"
              style={{ backgroundColor: 'var(--text-main)', color: 'var(--bg-color)' }}
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
