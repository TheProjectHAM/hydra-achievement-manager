
import React from 'react';
import { Tab, Game, Achievement } from './types';
import { GameIcon, SearchIcon, TrophyIcon, SettingsIcon } from './components/Icons';

export const SETTINGS_TAB: Tab = { id: 'configuracoes', label: 'sidebar.settings', icon: <SettingsIcon /> };

export const TABS: Tab[] = [
  { id: 'jogos', label: 'sidebar.games', icon: <GameIcon /> },
  { id: 'pesquisar', label: 'sidebar.search', icon: <SearchIcon /> },
  { id: 'conquistas', label: 'sidebar.achievements', icon: <TrophyIcon /> },
];

const WINDOWS_PATHS = [
  'C:/Users/Public/Documents/Steam/RUNE',
  'C:/Users/Public/Documents/Steam/CODEX',
  'C:/ProgramData/Steam/RLD!',
  'C:/Users/Public/Documents/OnlineFix',
];

const LINUX_PATHS = [
  '~/.wine/drive_c/Users/Public/Documents/Steam/RUNE',
  '~/.wine/drive_c/Users/Public/Documents/Steam/CODEX',
  '~/.wine/drive_c/ProgramData/Steam/RLD!',
  '~/.wine/drive_c/Users/Public/Documents/OnlineFix',
];

// Detect platform and export appropriate paths
const getPlatform = () => {
  if (typeof window !== 'undefined' && (window as any).electronAPI?.platform) {
    return (window as any).electronAPI.platform;
  }
  if (typeof window !== 'undefined' && navigator.userAgent.includes('Windows')) {
    return 'win32';
  }
  return 'linux';
};

export const DEFAULT_PATHS = getPlatform() === 'win32' ? WINDOWS_PATHS : LINUX_PATHS;
