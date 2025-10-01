import React, { useMemo } from 'react';
import { Tab, SteamSearchResult } from '../types';
import { SETTINGS_TAB } from '../constants';
import { useI18n } from '../contexts/I18nContext';
import { useTheme } from '../contexts/ThemeContext';
import { useMonitoredAchievements } from '../contexts/MonitoredAchievementsContext';

interface SidebarProps {
  tabs: Tab[];
  activeTab: string;
  setActiveTab: (id: string) => void;
  isCollapsed: boolean;
  width: number;
  onResizeStart: (e: React.MouseEvent) => void;
  onGameSelect: (game: SteamSearchResult) => void;
  selectedGameId?: number | null;
}

const SidebarResizer: React.FC<{ onMouseDown: (e: React.MouseEvent) => void }> = ({ onMouseDown }) => (
  <div
    className="absolute top-0 right-0 h-full w-2 cursor-col-resize group flex items-center justify-center"
    onMouseDown={onMouseDown}
  >
    <div className="h-24 w-px rounded-full bg-gray-700 dark:bg-gray-400 group-hover:bg-sky-500 transition-colors duration-200"></div>
  </div>
);

const Sidebar: React.FC<SidebarProps> = ({
  tabs,
  activeTab,
  setActiveTab,
  isCollapsed,
  width,
  onResizeStart,
  onGameSelect,
  selectedGameId
}) => {
  const { t } = useI18n();
  const { sidebarGameScale, sidebarMarquee } = useTheme();
  const { recentGames } = useMonitoredAchievements();

  const scaleStyles = useMemo(() => ({
    sm: { button: 'h-10', image: 'w-8 h-8', name: 'text-sm', count: 'text-xs' },
    md: { button: 'h-12', image: 'w-10 h-10', name: 'text-base', count: 'text-xs' },
    lg: { button: 'h-14', image: 'w-12 h-12', name: 'text-lg', count: 'text-sm' },
  }), []);

  const gameItemStyle = scaleStyles[sidebarGameScale];

  const itemClasses = (isActive: boolean) => `
    w-full flex items-center h-12 my-1 rounded-lg transition-all duration-200 text-sm font-semibold overflow-hidden text-left group relative
    ${isCollapsed ? 'justify-center' : 'pl-4 pr-3'}
    ${isActive
      ? 'bg-black/5 dark:bg-white/10 text-gray-900 dark:text-white'
      : 'text-gray-700 hover:bg-black/10 dark:text-gray-300 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white'
    }
  `;

  const gameItemClasses = (isActive: boolean) => `
    w-full flex items-center ${gameItemStyle.button} my-1 rounded-lg transition-all duration-200 font-semibold overflow-hidden text-left group relative
    ${isCollapsed ? 'justify-center' : 'pl-4 pr-3'}
    ${isActive
      ? 'bg-black/5 dark:bg-white/10 text-gray-900 dark:text-white'
      : 'text-gray-700 hover:bg-black/10 dark:text-gray-300 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white'
    }
  `;

  return (
    <aside
      style={{ width: `${isCollapsed ? width * 0.85 : width}px` }} // largura colapsada = 75% do original
      className="flex flex-col fixed top-10 left-0 bottom-0 z-40 bg-gradient-to-r from-gray-50/80 dark:from-black/50 to-transparent backdrop-blur-sm select-none"
    >
      <div className="flex flex-col h-full w-full">
        {/* Top section: Main Navigation */}
        <div className="flex-shrink-0">
          <ul className={isCollapsed ? "p-2" : "p-2 pr-4"}>
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <li key={tab.id}>
                  <button
                    onClick={() => setActiveTab(tab.id)}
                    title={isCollapsed ? t(tab.label) : undefined}
                    aria-label={t(tab.label)}
                    className={itemClasses(isActive).replace(/rounded-lg/g, '').replace(/rounded-r-full/g, '') + ` flex items-center ${isCollapsed ? '' : 'gap-x-2'}`}
                    style={{alignItems: 'center', borderRadius: '4px'}}
                  >
                    <span className="flex items-center justify-center text-xl flex-shrink-0 align-middle" style={{height: '1.5em'}}>{tab.icon}</span>
                    <span className={`truncate whitespace-nowrap align-middle transition-opacity duration-200 ${isCollapsed ? 'opacity-0 w-0 ml-0 flex-grow-0' : 'opacity-100 ml-3 flex-grow'}`} style={{lineHeight: '1.5em'}}>
                      {t(tab.label)}
                    </span>
                  </button>
                </li>
              );
            })}

            {/* Divider e Recent Games */}
            <li>
              <div className={`transition-all duration-300 ${isCollapsed ? 'my-3' : 'my-2'}`}>
                {isCollapsed ? (
                  <hr className="border-t border-black/10 dark:border-white/10 mx-auto w-8" />
                ) : (
                  <h3 className="pl-4 pr-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    {t('sidebar.recentGames')}
                  </h3>
                )}
              </div>
            </li>
          </ul>
        </div>

        {/* Middle section: Recent Games */}
        <div className="flex-grow overflow-y-auto no-scrollbar">
          <ul className={isCollapsed ? "px-2" : "px-2 pr-4"}>
            {recentGames.map((game) => {
              const isActive = selectedGameId === parseInt(game.gameId) && activeTab === 'conquistas';
              const gameNameClasses = `font-semibold ${gameItemStyle.name} ${
                isActive
                  ? 'text-gray-900 dark:text-white'
                  : 'text-gray-800 dark:text-gray-200 group-hover:text-gray-900 dark:group-hover:text-white'
              }`;
              return (
                <li key={game.gameId}>
                  <button
                    onClick={() => onGameSelect({ id: parseInt(game.gameId), name: game.name, achievementsTotal: game.achievementsTotalFromAPI ?? game.achievementsTotal })}
                    title={isCollapsed ? game.name : `${game.name} (${game.achievementsCurrent}/${game.achievementsTotalFromAPI ?? game.achievementsTotal})`}
                    aria-label={game.name}
                    className={gameItemClasses(isActive).replace(/rounded-lg/g, '') + ' flex items-center gap-x-2'}
                    style={{alignItems: 'center', borderRadius: '4px'}}
                  >
                    <img
                      src={`https://cdn.akamai.steamstatic.com/steam/apps/${game.gameId}/header.jpg`}
                      alt=""
                      className={`object-cover flex-shrink-0 transition-all duration-300 ${gameItemStyle.image} ${isCollapsed ? 'mx-auto' : ''}`}
                      style={{borderRadius: '4px'}}
                    />
                    <div className={`overflow-hidden whitespace-nowrap transition-opacity duration-200 ${isCollapsed ? 'hidden' : 'opacity-100 ml-3 flex-grow'}`}>
                      {sidebarMarquee && !isCollapsed ? (
                        <div className="relative">
                          <p className={`truncate group-hover:opacity-0 transition-opacity duration-150 ${gameNameClasses}`}>{game.name}</p>
                          <div className="marquee-container absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                            <div className="marquee-inner">
                              <span className={`marquee-content ${gameNameClasses}`}>{game.name}</span>
                              <span aria-hidden="true" className={`marquee-content ${gameNameClasses}`}>{game.name}</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className={`truncate ${gameNameClasses}`}>{game.name}</p>
                      )}
                      <p className={`${gameItemStyle.count} truncate ${
                        isActive
                          ? 'text-gray-600 dark:text-gray-300'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}>{t('sidebar.achievementsCount', { current: game.achievementsCurrent, total: game.achievementsTotalFromAPI ?? game.achievementsTotal })}</p>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        {/* Bottom section: Settings */}
        <div className="flex-shrink-0">
          <ul className={isCollapsed ? "p-2" : "p-2 pr-4"}>
            <li>
              <button
                onClick={() => setActiveTab(SETTINGS_TAB.id)}
                title={isCollapsed ? t(SETTINGS_TAB.label) : undefined}
                aria-label={t(SETTINGS_TAB.label)}
                className={itemClasses(activeTab === SETTINGS_TAB.id).replace(/rounded-lg/g, '').replace(/rounded-r-full/g, '') + ` flex items-center ${isCollapsed ? '' : 'gap-x-2'}`}
                style={{alignItems: 'center', borderRadius: '4px'}}
              >
                <span className="flex items-center justify-center text-xl flex-shrink-0 align-middle" style={{height: '1.5em'}}>{SETTINGS_TAB.icon}</span>
                <span className={`truncate whitespace-nowrap align-middle transition-opacity duration-200 ${isCollapsed ? 'opacity-0 w-0 ml-0 flex-grow-0' : 'opacity-100 ml-3 flex-grow'}`} style={{lineHeight: '1.5em'}}>
                  {t(SETTINGS_TAB.label)}
                </span>
              </button>
            </li>
          </ul>
        </div>
      </div>

      <SidebarResizer onMouseDown={onResizeStart} />
    </aside>
  );
};

export default Sidebar;
