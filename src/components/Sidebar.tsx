import React, { useMemo, useState } from 'react';
import { Tab, SteamSearchResult } from '../types';
import { SETTINGS_TAB } from '../constants';
import { useI18n } from '../contexts/I18nContext';
import { useTheme } from '../contexts/ThemeContext';
import { useMonitoredAchievements } from '../contexts/MonitoredAchievementsContext';
import { SortAscendingIcon, SortDescendingIcon, SteamBrandIcon, WarningIcon } from './Icons';
import { getSteamLogoFallbackUrls, getSteamLogoUrl } from '@/lib/steam-assets';

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
  const { sidebarGameScale, sidebarMarquee, titleBarMode } = useTheme();
  const { recentGames } = useMonitoredAchievements();
  const [recentSearch, setRecentSearch] = useState('');
  const [recentSortDirection, setRecentSortDirection] = useState<'desc' | 'asc'>('desc');

  const scaleStyles = useMemo(() => ({
    sm: { button: 'h-11', image: 'w-8 h-8', name: 'text-xs', count: 'text-[10px]' },
    md: { button: 'h-14', image: 'w-10 h-10', name: 'text-sm', count: 'text-[10px]' },
    lg: { button: 'h-16', image: 'w-12 h-12', name: 'text-[0.95rem]', count: 'text-[11px]' },
  }), []);

  const gameItemStyle = scaleStyles[sidebarGameScale];
  const iconColumnClass = isCollapsed ? '' : 'w-8';
  const visibleRecentGames = useMemo(() => {
    const query = recentSearch.trim().toLowerCase();

    return [...recentGames]
      .filter((game) => {
        if (!query) return true;
        return game.name.toLowerCase().includes(query) || game.gameId.includes(query);
      })
      .sort((a, b) => {
        const timeA = typeof a.lastModified === 'number' ? a.lastModified * 1000 : new Date(a.lastModified).getTime();
        const timeB = typeof b.lastModified === 'number' ? b.lastModified * 1000 : new Date(b.lastModified).getTime();
        return recentSortDirection === 'desc' ? timeB - timeA : timeA - timeB;
      });
  }, [recentGames, recentSearch, recentSortDirection]);

  const itemClasses = (isActive: boolean) => `
    flex items-center rounded-md transition-all duration-300 group relative
    ${isCollapsed ? 'h-11 w-11 justify-center' : 'w-full h-11 px-4 gap-3 justify-start'}
    ${isActive
      ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-lg'
      : 'text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent'
    }
  `;

  const hClass = gameItemStyle.button.split(' ')[0]; // extract h-11, h-14 etc
  const wClass = hClass.replace('h-', 'w-');

  const gameItemClasses = (isActive: boolean) => `
    flex items-center transition-all duration-300 rounded-md group relative box-border
    ${isCollapsed ? `${hClass} ${wClass} aspect-square justify-center` : `w-full self-stretch ${hClass} px-4 gap-4`}
    ${isActive
      ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-lg'
      : 'text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent'
    }
  `;

  return (
    <aside
      style={{ width: `${isCollapsed ? 72 : width}px` }}
      className={`flex flex-col fixed left-0 bottom-0 z-40 select-none transition-all duration-300 ease-in-out border-r border-sidebar-border bg-sidebar-background ${titleBarMode === 'custom' ? 'top-10' : 'top-0'}`}
    >
      <div className={`flex flex-col h-full w-full p-4 overflow-hidden ${isCollapsed ? 'items-center' : 'items-stretch'}`}>

        {/* Top section: Main Navigation */}
        <div className={`flex-shrink-0 mb-6 w-full flex flex-col ${isCollapsed ? 'items-center' : 'items-start'}`}>
          <nav className={`space-y-1 w-full flex flex-col ${isCollapsed ? 'items-center' : 'items-stretch'}`}>
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  title={isCollapsed ? t(tab.label) : undefined}
                  className={itemClasses(isActive)}
                >
                  <div className={`${iconColumnClass} flex items-center justify-start flex-shrink-0`}>
                    <span className={`text-2xl transition-colors ${isActive ? 'text-sidebar-accent-foreground' : 'text-sidebar-foreground group-hover:text-sidebar-accent-foreground'}`}>
                      {tab.icon}
                    </span>
                  </div>
                  {!isCollapsed && (
                    <span className="text-[0.95rem] font-semibold truncate flex items-center gap-2">
                      {t(tab.label)}
                      {tab.id === 'biblioteca' && (
                        <span className="inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold leading-none text-amber-400 uppercase tracking-wider">
                          Beta
                        </span>
                      )}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Divider + Recent Games Filter */}
        {!isCollapsed ? (
          <div className="mb-4 space-y-2 w-full">
            <h3 className="w-full text-[11px] font-semibold text-sidebar-foreground opacity-30 whitespace-nowrap">
              {t('sidebar.recentGames')}
            </h3>
            <div className="grid w-full grid-cols-[minmax(0,1fr)_2.25rem] items-center gap-2">
              <input
                value={recentSearch}
                onChange={(event) => setRecentSearch(event.target.value)}
                placeholder={`${t('sidebar.search')}...`}
                className="h-9 min-w-0 flex-1 rounded-md border border-transparent bg-sidebar-accent px-3 text-[0.95rem] font-semibold text-sidebar-accent-foreground placeholder:text-sidebar-foreground/60 outline-none transition-all focus:ring-2 focus:ring-sidebar-ring/40"
              />
              <button
                type="button"
                onClick={() => setRecentSortDirection((current) => current === 'desc' ? 'asc' : 'desc')}
                className="h-9 w-9 rounded-md border border-transparent bg-sidebar-accent text-sidebar-accent-foreground transition-all hover:ring-1 hover:ring-sidebar-ring/40 flex items-center justify-center"
                title={recentSortDirection === 'desc' ? 'Mais recentes primeiro' : 'Menos recentes primeiro'}
                aria-label={recentSortDirection === 'desc' ? 'Mais recentes primeiro' : 'Menos recentes primeiro'}
              >
                {recentSortDirection === 'desc' ? (
                  <SortDescendingIcon className="text-lg opacity-80" style={{ fontVariationSettings: "'wght' 300" }} />
                ) : (
                  <SortAscendingIcon className="text-lg opacity-80" style={{ fontVariationSettings: "'wght' 300" }} />
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="border-t border-sidebar-border w-11 mb-6" />
        )}

        {/* Middle section: Recent Games */}
        <div className="flex-grow overflow-y-auto no-scrollbar w-full">
          <div className={`space-y-1 w-full flex flex-col ${isCollapsed ? 'items-center' : 'items-stretch'}`}>
            {visibleRecentGames.map((game) => {
              const isActive = selectedGameId === parseInt(game.gameId) && activeTab === 'conquistas';
              const isSteamSource = game.source === 'steam' || game.source === 'both';
              const gameNameClasses = `font-semibold ${gameItemStyle.name} ${isActive
                ? 'text-sidebar-accent-foreground'
                : 'text-sidebar-foreground group-hover:text-sidebar-accent-foreground'
                }`;

              const fallbacks = getSteamLogoFallbackUrls(game.gameId);

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
                  className={`${gameItemClasses(isActive)} ${isCollapsed ? 'rounded-2xl overflow-hidden hover:shadow-lg hover:ring-1 hover:ring-sidebar-border hover:bg-sidebar-accent' : ''}`}
                >
                  <div className={`relative flex-shrink-0 transition-transform duration-300 ${isCollapsed ? 'w-8 h-8 group-hover:scale-105' : gameItemStyle.image}`}>
                    <img
                      src={getSteamLogoUrl(game.gameId)}
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
                        } else {
                          img.style.display = 'none';
                          const container = img.parentElement;
                          if (container) {
                            const warning = container.querySelector('[data-warning-icon]') as HTMLElement;
                            if (warning) warning.style.display = 'flex';
                          }
                        }
                      }}
                    />
                    <WarningIcon
                      data-warning-icon
                      className="w-full h-full text-yellow-500 flex items-center justify-center"
                      style={{ display: 'none', borderRadius: '4px' }}
                    />
                  </div>
                  {!isCollapsed && (
                    <div className="flex-grow min-w-0 flex flex-col items-start justify-center">
                      {sidebarMarquee ? (
                        <div className="relative w-full overflow-hidden h-[1.2em]">
                          <p className={`truncate group-hover:opacity-0 transition-opacity duration-150 text-left flex items-center gap-1.5 ${gameNameClasses}`}>
                            {isSteamSource && <SteamBrandIcon className="w-4 h-4 shrink-0 opacity-60" />}
                            <span className="truncate">{game.name}</span>
                          </p>
                          <div className="marquee-container absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-left">
                            <div className="marquee-inner flex items-center gap-1.5">
                              <span className={`marquee-content text-left flex items-center gap-1.5 ${gameNameClasses}`}>
                                {isSteamSource && <SteamBrandIcon className="w-4 h-4 shrink-0 opacity-60" />}
                                <span>{game.name}</span>
                              </span>
                              <span aria-hidden="true" className={`marquee-content text-left flex items-center gap-1.5 ${gameNameClasses}`}>
                                {isSteamSource && <SteamBrandIcon className="w-4 h-4 shrink-0 opacity-60" />}
                                <span>{game.name}</span>
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className={`truncate w-full text-left flex items-center gap-1.5 ${gameNameClasses}`}>
                          {isSteamSource && <SteamBrandIcon className="w-4 h-4 shrink-0 opacity-60" />}
                          <span className="truncate">{game.name}</span>
                        </p>
                      )}
                      <p className={`${gameItemStyle.count} font-medium transition-colors duration-300 ${isActive ? 'text-sidebar-accent-foreground' : 'text-sidebar-foreground'} ${isActive
                        ? ''
                        : 'opacity-60 group-hover:opacity-100'
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
        <div className={`flex-shrink-0 mt-4 pt-4 border-t border-sidebar-border w-full flex flex-col ${isCollapsed ? 'items-center' : 'items-start'}`}>
          <button
            onClick={() => setActiveTab(SETTINGS_TAB.id)}
            title={isCollapsed ? t(SETTINGS_TAB.label) : undefined}
            className={itemClasses(activeTab === SETTINGS_TAB.id)}
          >
            <div className={`${iconColumnClass} flex items-center justify-start flex-shrink-0`}>
              <span className={`text-2xl transition-colors ${activeTab === SETTINGS_TAB.id ? 'text-sidebar-accent-foreground' : 'text-sidebar-foreground group-hover:text-sidebar-accent-foreground'}`}>
                {SETTINGS_TAB.icon}
              </span>
            </div>
            {!isCollapsed && (
              <span className="text-[0.95rem] font-semibold truncate">
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
