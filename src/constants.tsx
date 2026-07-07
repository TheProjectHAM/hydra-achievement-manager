
import React from 'react';
import { Tab } from './types';
import { GameIcon, LibraryIcon, SearchIcon, TrophyIcon, SettingsIcon } from './components/Icons';

export const SETTINGS_TAB: Tab = { id: 'configuracoes', label: 'sidebar.settings', icon: <SettingsIcon /> };

export const TABS: Tab[] = [
  { id: 'jogos', label: 'sidebar.games', icon: <GameIcon /> },
  { id: 'biblioteca', label: 'sidebar.library', icon: <LibraryIcon /> },
  { id: 'pesquisar', label: 'sidebar.search', icon: <SearchIcon /> },
  { id: 'conquistas', label: 'sidebar.achievements', icon: <TrophyIcon /> },
];
