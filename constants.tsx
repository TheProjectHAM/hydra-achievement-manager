
import React from 'react';
import { Tab, Game, Achievement } from './types';
import { GameIcon, SearchIcon, TrophyIcon, SettingsIcon } from './components/Icons';

export const SETTINGS_TAB: Tab = { id: 'configuracoes', label: 'sidebar.settings', icon: <SettingsIcon /> };

export const TABS: Tab[] = [
  { id: 'jogos', label: 'sidebar.games', icon: <GameIcon /> },
  { id: 'pesquisar', label: 'sidebar.search', icon: <SearchIcon /> },
  { id: 'conquistas', label: 'sidebar.achievements', icon: <TrophyIcon /> },
];

export const DEFAULT_PATHS = [
    'C:/Users/Public/Documents/Steam/RUNE',
    'C:/Users/Public/Documents/Steam/CODEX',
    'C:/ProgramData/Steam/RLD!',
    'C:/Users/Public/Documents/OnlineFix',
];
