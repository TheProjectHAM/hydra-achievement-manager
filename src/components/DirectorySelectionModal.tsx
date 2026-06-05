import React, { useState, useEffect } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { FolderIcon, SteamBrandIcon } from './Icons';
import { useTheme } from '../contexts/ThemeContext';
import { formatDateObj } from '../formatters';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

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
      className={`group rounded-lg border transition-all cursor-pointer overflow-hidden ${isSelected ? 'shadow-md bg-accent border-foreground' : 'hover:bg-accent border-border'}`}
      onClick={onSelect}
      role="radio"
      aria-checked={isSelected}
      tabIndex={0}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onSelect()}
    >
      <div className="p-3 flex gap-2">
        <span className="flex-shrink-0 w-10 flex items-center justify-center leading-none text-foreground">
          {isSteam ? <SteamBrandIcon className="w-6 h-6" /> : <FolderIcon className="text-3xl leading-none" />}
        </span>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex-shrink-0 rounded-md border px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.14em] text-muted-foreground border-border">
              {isSteam ? 'STEAM' : 'LOCAL'}
            </span>
            <p className="font-bold text-sm truncate min-w-0 text-foreground">
              {isSteam ? dir.name : displayTitle}
            </p>
            <span className="text-[10px] font-semibold opacity-70 ml-auto flex-shrink-0 whitespace-nowrap text-muted-foreground">
              {dir.achievementCount} {t('common.achievements').toLowerCase()}
            </span>
          </div>
          <p className="text-[11px] font-medium truncate opacity-60 text-foreground" title={displayPath}>
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-xl h-[560px] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>{t('directorySelectionModal.title', { gameName })}</DialogTitle>
          <DialogDescription>
            {t('directorySelectionModal.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-3">
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

        <div className="flex justify-end gap-3 p-6 pt-4 border-t border-border">
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedPath}>
            {t('directorySelectionModal.select')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DirectorySelectionModal;
