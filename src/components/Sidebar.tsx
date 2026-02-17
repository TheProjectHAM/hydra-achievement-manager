import React, { useMemo } from 'react';
import { Tab, SteamSearchResult } from '../types';
import { SETTINGS_TAB } from '../constants';
import { useI18n } from '../contexts/I18nContext';
import { useTheme } from '../contexts/ThemeContext';
import { useMonitoredAchievements } from '../contexts/MonitoredAchievementsContext';
import { SteamBrandIcon } from './Icons';

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
    className="absolute top-0 right-0 h-full w-1 cursor-col-resize group z-50"
    onMouseDown={onMouseDown}
  />
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
    sm: { button: 'h-11', image: 'w-8 h-8', name: 'text-[11px]', count: 'text-[9px]' },
    md: { button: 'h-14', image: 'w-10 h-10', name: 'text-xs', count: 'text-[10px]' },
    lg: { button: 'h-16', image: 'w-12 h-12', name: 'text-sm', count: 'text-[11px]' },
  }), []);

  const gameItemStyle = scaleStyles[sidebarGameScale];

  const itemClasses = (isActive: boolean) => `
    flex items-center rounded-md transition-all duration-300 group relative
    ${isCollapsed ? 'h-11 w-11 justify-center' : 'w-full h-11 px-4 gap-4'}
    ${isActive
      ? 'bg-[var(--border-color)] text-[var(--text-main)] shadow-lg'
      : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--hover-bg)]'
    }
  `;

  const hClass = gameItemStyle.button.split(' ')[0]; // extract h-11, h-14 etc
  const wClass = hClass.replace('h-', 'w-');

  const gameItemClasses = (isActive: boolean) => `
    flex items-center transition-all duration-300 rounded-md group relative
    ${isCollapsed ? `${hClass} ${wClass} aspect-square justify-center` : `w-full ${hClass} px-4 gap-4`}
    ${isActive
      ? 'bg-[var(--border-color)] text-[var(--text-main)] shadow-lg'
      : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--hover-bg)]'
    }
  `;

  return (
    <aside
      style={{ width: `${isCollapsed ? 72 : width}px`, backgroundColor: 'var(--sidebar-bg)' }}
      className="flex flex-col fixed top-10 left-0 bottom-0 z-40 select-none transition-all duration-300 ease-in-out border-r border-[var(--border-color)]"
    >
      <div className={`flex flex-col h-full w-full p-4 overflow-hidden ${isCollapsed ? 'items-center' : 'items-stretch'}`}>

        {/* Top section: Main Navigation */}
        <div className={`flex-shrink-0 mb-6 w-full flex flex-col ${isCollapsed ? 'items-center' : 'items-start'}`}>
          <nav className={`space-y-1 w-full flex flex-col ${isCollapsed ? 'items-center' : 'items-start'}`}>
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  title={isCollapsed ? t(tab.label) : undefined}
                  className={itemClasses(isActive)}
                >
                  <div className={`${isCollapsed ? '' : gameItemStyle.image} flex items-center justify-center flex-shrink-0`}>
                    <span className={`text-xl transition-colors ${isActive ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)] group-hover:text-[var(--text-main)]'}`}>
                      {tab.icon}
                    </span>
                  </div>
                  {!isCollapsed && (
                    <span className="text-[10px] font-black uppercase tracking-widest truncate">
                      {t(tab.label)}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Divider + Recent Games Title */}
        {!isCollapsed ? (
          <div className="px-4 mb-4">
            <h3 className="text-[10px] font-black text-[var(--text-muted)] opacity-30 uppercase tracking-[0.2em] whitespace-nowrap">
              {t('sidebar.recentGames')}
            </h3>
          </div>
        ) : (
          <div className="border-t border-[var(--border-color)] w-8 mb-6" />
        )}

        {/* Middle section: Recent Games */}
        <div className="flex-grow overflow-y-auto no-scrollbar -mx-1 px-1 w-full">
          <div className={`space-y-1 w-full flex flex-col ${isCollapsed ? 'items-center' : 'items-start'}`}>
            {recentGames.map((game) => {
              const isActive = selectedGameId === parseInt(game.gameId) && activeTab === 'conquistas';
              const isSteamSource = game.source === 'steam' || game.source === 'both';
              const gameNameClasses = `font-black uppercase tracking-tight ${gameItemStyle.name} ${isActive
                ? 'text-[var(--text-main)]'
                : 'text-[var(--text-muted)] group-hover:text-[var(--text-main)]'
                }`;

              const steamCdn = import.meta.env.VITE_STEAM_CDN_URL || 'https://cdn.akamai.steamstatic.com/steam/apps';
              const fallbacks = [
                `${steamCdn}/${game.gameId}/capsule_sm_120.jpg`,
                `${steamCdn}/${game.gameId}/capsule_184x69.jpg`,
                `${steamCdn}/${game.gameId}/capsule_231x87.jpg`,
                `${steamCdn}/${game.gameId}/capsule_467x181.jpg`,
                `${steamCdn}/${game.gameId}/capsule_616x353.jpg`,
                `${steamCdn}/${game.gameId}/library_hero.jpg`,
                `${steamCdn}/${game.gameId}/library_600x900.jpg`,
                `${steamCdn}/${game.gameId}/header.jpg`,
                `${steamCdn}/${game.gameId}/header_292x136.jpg`
              ];

              return (
                <button
                  key={game.gameId}
                  onClick={() => {
                    if (isActive) return;
                    onGameSelect({
                      id: parseInt(game.gameId),
                      name: game.name,
                      achievementsTotal: game.achievementsTotalFromAPI ?? game.achievementsTotal
                    });
                  }}
                  title={isCollapsed ? game.name : undefined}
                  className={`${gameItemClasses(isActive)} ${isCollapsed ? 'rounded-2xl overflow-hidden hover:shadow-lg hover:ring-1 hover:ring-[var(--border-color)] hover:bg-[var(--hover-bg)]' : ''}`}
                >
                  <div className={`relative flex-shrink-0 transition-transform duration-300 ${isCollapsed ? 'w-8 h-8 group-hover:scale-105' : gameItemStyle.image}`}>
                    <img
                      src={`${import.meta.env.VITE_STEAM_CDN_URL || 'https://cdn.akamai.steamstatic.com/steam/apps'}/${game.gameId}/logo.png`}
                      alt=""
                      className={`w-full h-full object-contain transition-all duration-300 ${!isActive ? 'opacity-80 grayscale-[0.3] group-hover:opacity-100 group-hover:grayscale-0' : ''} ${isCollapsed ? 'drop-shadow-sm' : ''}`}
                      style={{ borderRadius: '4px' }}
                      onError={(e) => {
                        const img = e.target as HTMLImageElement;
                        if (!img.dataset.index) img.dataset.index = "0";
                        let index = parseInt(img.dataset.index);
                        if (index < fallbacks.length) {
                          img.src = fallbacks[index];
                          img.dataset.index = String(index + 1);
                        }
                      }}
                    />
                  </div>
                  {!isCollapsed && (
                    <div className="flex-grow min-w-0 flex flex-col items-start justify-center">
                      {sidebarMarquee ? (
                        <div className="relative w-full overflow-hidden h-[1.2em]">
                          <p className={`truncate group-hover:opacity-0 transition-opacity duration-150 text-left flex items-center gap-1.5 ${gameNameClasses}`}>
                            {isSteamSource && <SteamBrandIcon className="w-3.5 h-3.5 shrink-0 opacity-60" />}
                            <span className="truncate">{game.name}</span>
                          </p>
                          <div className="marquee-container absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-left">
                            <div className="marquee-inner flex items-center gap-1.5">
                              <span className={`marquee-content text-left flex items-center gap-1.5 ${gameNameClasses}`}>
                                {isSteamSource && <SteamBrandIcon className="w-3.5 h-3.5 shrink-0 opacity-60" />}
                                <span>{game.name}</span>
                              </span>
                              <span aria-hidden="true" className={`marquee-content text-left flex items-center gap-1.5 ${gameNameClasses}`}>
                                {isSteamSource && <SteamBrandIcon className="w-3.5 h-3.5 shrink-0 opacity-60" />}
                                <span>{game.name}</span>
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className={`truncate w-full text-left flex items-center gap-1.5 ${gameNameClasses}`}>
                          {isSteamSource && <SteamBrandIcon className="w-3.5 h-3.5 shrink-0 opacity-60" />}
                          <span className="truncate">{game.name}</span>
                        </p>
                      )}
                      <p className={`${gameItemStyle.count} font-bold uppercase tracking-widest transition-colors duration-300 ${isActive
                        ? 'text-[var(--text-muted)]'
                        : 'text-[var(--text-muted)] opacity-60 group-hover:opacity-100'
                        }`}>
                        {game.achievementsCurrent}/{game.achievementsTotalFromAPI ?? game.achievementsTotal}
                      </p>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Bottom section: Settings */}
        <div className={`flex-shrink-0 mt-4 pt-4 border-t border-[var(--border-color)] w-full flex flex-col ${isCollapsed ? 'items-center' : 'items-start'}`}>
          <button
            onClick={() => setActiveTab(SETTINGS_TAB.id)}
            title={isCollapsed ? t(SETTINGS_TAB.label) : undefined}
            className={itemClasses(activeTab === SETTINGS_TAB.id)}
          >
            <div className={`${isCollapsed ? '' : gameItemStyle.image} flex items-center justify-center flex-shrink-0`}>
              <span className={`text-xl transition-colors ${activeTab === SETTINGS_TAB.id ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)] group-hover:text-[var(--text-main)]'}`}>
                {SETTINGS_TAB.icon}
              </span>
            </div>
            {!isCollapsed && (
              <span className="text-[10px] font-black uppercase tracking-widest truncate">
                {t(SETTINGS_TAB.label)}
              </span>
            )}
          </button>
        </div>
      </div>

      <SidebarResizer onMouseDown={onResizeStart} />
    </aside>
  );
};

export default Sidebar;
