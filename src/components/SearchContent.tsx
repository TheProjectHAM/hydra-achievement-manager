import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { SearchIcon, PlatinumIcon, SteamBrandIcon, RetroAchievementsIcon } from './Icons';
import { SteamSearchResult } from '../types';
import { useI18n } from '../contexts/I18nContext';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { getSteamHeaderUrl } from '@/lib/steam-assets';
import { searchRetroAchievementsGames, searchSteamGames } from '../tauri-api';
import { getRetroAchievementsGameImage } from '@/lib/retro-achievements-assets';

type SearchProvider = 'all' | 'steam' | 'retroachievements';

const providerOptions: { value: SearchProvider; label: string; icon: React.ReactNode }[] = [
  { value: 'all', label: 'All Sources', icon: <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg> },
  { value: 'steam', label: 'Steam / Hydra', icon: <SteamBrandIcon className="h-3.5 w-3.5" /> },
  { value: 'retroachievements', label: 'RetroAchievements', icon: <RetroAchievementsIcon className="h-3.5 w-3.5" /> },
];

const nameFilters = ['~Unlicensed~', '~Homebrew~', '~Demo~', '~Hack~', '~Prototype~'] as const;

const platformFilters = [
  'Nintendo', 'Super Nintendo', 'Game Boy', 'Game Boy Advance', 'Game Boy Color',
  'Nintendo 64', 'Nintendo DS', 'GameCube', 'Wii',
  'PlayStation', 'PlayStation 2', 'PSP',
  'Sega Genesis', 'Sega Master System', 'Sega Saturn', 'Sega CD', 'Game Gear',
  'Atari', 'TurboGrafx-16', 'Neo Geo', 'Arcade', 'MSX',
] as const;

const FilterSection: React.FC<{
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ label, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
      >
        {label}
        <svg
          className={`w-3 h-3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M3 4.5L6 7.5L9 4.5" />
        </svg>
      </button>
      {open && <div className="pb-1">{children}</div>}
    </div>
  );
};

const CheckboxItem: React.FC<{
  label: string;
  checked: boolean;
  onChange: () => void;
  count?: number;
}> = ({ label, checked, onChange, count }) => (
  <label className="flex items-center gap-2.5 px-2 py-1 rounded-md cursor-pointer text-sm transition-colors hover:bg-accent text-foreground">
    <span className={`flex items-center justify-center size-4 rounded flex-shrink-0 transition-colors ${checked ? 'bg-primary border-primary' : 'border border-border bg-background'}`}>
      {checked && (
        <svg className="size-3 text-primary-foreground" viewBox="0 0 16 16" fill="currentColor">
          <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
        </svg>
      )}
    </span>
    <span className="font-medium truncate flex-1">{label}</span>
    {count !== undefined && count > 0 && (
      <span className="text-[10px] text-muted-foreground tabular-nums">{count}</span>
    )}
    <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
  </label>
);

const SearchGameCard: React.FC<{ game: SteamSearchResult; onClick: () => void }> = ({ game, onClick }) => {
  const isRetro = game.source === 'retroachievements';
  const imageUrl = isRetro ? getRetroAchievementsGameImage(game) : getSteamHeaderUrl(game.id);

  return (
    <div
      onClick={onClick}
      className="group relative aspect-[16/9] rounded-md overflow-hidden shadow-2xl cursor-pointer transition-all duration-300 border bg-card bg-cover bg-center hover:border-foreground/30"
      style={{ backgroundImage: `url(${imageUrl})` }}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>
      <div className="relative flex flex-col justify-end h-full p-4 text-white">
        <div className="flex items-center justify-between mb-2 gap-3 min-w-0">
          <h3 className="font-semibold text-sm truncate min-w-0 leading-tight drop-shadow-md">
            {game.name}
          </h3>
          <div className="flex items-center gap-1.5 text-[10px] font-medium text-gray-200 flex-shrink-0 drop-shadow-md">
            {isRetro ? <RetroAchievementsIcon className="text-[11px] opacity-70" /> : null}
            <PlatinumIcon className="text-[11px] opacity-50" />
            <span>{game.achievementsTotal}</span>
          </div>
        </div>
        {game.consoleName && (
          <p className="text-[10px] font-semibold uppercase tracking-wide text-white/60 drop-shadow-md">
            {game.consoleName}
          </p>
        )}
      </div>
      <div className="absolute inset-0 rounded-md pointer-events-none transition-shadow duration-300 group-hover:ring-1 group-hover:ring-inset group-hover:ring-white/5"></div>
    </div>
  );
};

interface SearchContentProps {
  onGameSelect: (game: SteamSearchResult) => void;
}

export const SearchContent: React.FC<SearchContentProps> = ({ onGameSelect }) => {
  const [query, setQuery] = useState('');
  const [provider, setProvider] = useState<SearchProvider>('all');
  const [results, setResults] = useState<SteamSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [hideZeroAchievements, setHideZeroAchievements] = useState(true);
  const [hideFilters, setHideFilters] = useState<Record<string, boolean>>({
    '~Unlicensed~': true,
    '~Homebrew~': true,
    '~Demo~': true,
    '~Hack~': true,
    '~Prototype~': true,
  });
  const [platformFiltersState, setPlatformFiltersState] = useState<Record<string, boolean>>(
    Object.fromEntries(platformFilters.map(p => [p, true]))
  );
  const filterRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { t } = useI18n();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleNameFilter = useCallback((key: string) => {
    setHideFilters(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const togglePlatformFilter = useCallback((key: string) => {
    setPlatformFiltersState(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const deactivatedPlatforms = useMemo(() =>
    Object.entries(platformFiltersState).filter(([, v]) => !v).map(([k]) => k.toLowerCase()),
    [platformFiltersState]
  );

  const platformMatchCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const platform of platformFilters) {
      const lower = platform.toLowerCase();
      counts[platform] = results.filter(g =>
        g.consoleName?.toLowerCase().includes(lower)
      ).length;
    }
    return counts;
  }, [results]);

  const { filteredResults, hiddenCount } = useMemo(() => {
    const hidden = results.filter((game) => {
      if (hideZeroAchievements && game.achievementsTotal === 0) return true;
      const name = game.name.toLowerCase();
      for (const tag of nameFilters) {
        if (hideFilters[tag] && name.includes(tag.toLowerCase())) return true;
      }
      if (game.consoleName && deactivatedPlatforms.length > 0) {
        const consoleLower = game.consoleName.toLowerCase();
        const matchesDeactivated = deactivatedPlatforms.some(p => consoleLower.includes(p));
        if (matchesDeactivated) return true;
      }
      return false;
    });
    return { filteredResults: results.filter(g => !hidden.includes(g)), hiddenCount: hidden.length };
  }, [results, hideZeroAchievements, hideFilters, deactivatedPlatforms]);

  const activeFiltersCount = (provider === 'all' ? 0 : 1)
    + (hideZeroAchievements ? 1 : 0)
    + Object.values(hideFilters).filter(Boolean).length
    + deactivatedPlatforms.length;

  const handleSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);
    setHasSearched(true);
    setResults([]);

    if (typeof window !== 'undefined' && window.electronAPI) {
      try {
        const searchPromises: Promise<SteamSearchResult[]>[] = [];

        if (provider === 'all' || provider === 'steam') {
          searchPromises.push(
            searchSteamGames(query.trim()).then(async (games) => {
              await Promise.all(games.map(async (game) => {
                try {
                  const ach = await window.electronAPI.getGameAchievements(game.id.toString());
                  game.achievementsTotal = ach.achievements.length;
                } catch (e) {
                  console.warn(`Failed to get achievements for ${game.id}:`, e);
                }
              }));
              return games;
            })
          );
        }

        if (provider === 'all' || provider === 'retroachievements') {
          searchPromises.push(searchRetroAchievementsGames(query.trim()));
        }

        const allResults = await Promise.all(searchPromises);
        setResults(allResults.flat());
      } catch (err) {
        setError(t('searchPage.error'));
        console.error('Search error:', err);
      }
    } else {
      console.warn('Electron API not available; using direct fetch (may fail due to CORS)');
      try {
        const url = `${import.meta.env.VITE_STEAM_STORE_API_URL || 'https://store.steampowered.com/api'}/storesearch/?term=${encodeURIComponent(query.trim())}&l=english&cc=us&snr=1_4_4__12`;
        await fetch(url, { mode: 'no-cors' });
        setError('Search not fully supported in browser dev mode. Run in Electron for full functionality.');
      } catch (err) {
        setError(t('searchPage.error'));
        console.error(err);
      }
    }

    setIsLoading(false);
  }, [query, provider, t]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <header className="flex-shrink-0 w-full mb-4 relative z-50">
        <form onSubmit={handleSearch} className="relative w-full group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none z-10">
            <SearchIcon className={`text-lg transition-colors duration-300 ${query ? 'text-foreground' : 'text-muted-foreground group-focus-within:text-foreground'}`} />
          </div>
          <Input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={provider === 'all' ? 'Search games across all sources...' : provider === 'retroachievements' ? 'Search games on RetroAchievements...' : t('searchPage.inputPlaceholder')}
            className="w-full h-12 pl-12 pr-14 text-[0.95rem] font-semibold"
            aria-label={t('searchPage.searchButton')}
          />
          <div className="absolute inset-y-0 right-2 flex items-center z-10">
            {isLoading ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            ) : (
              <button
                ref={buttonRef}
                type="button"
                onClick={() => setFilterOpen(!filterOpen)}
                className="relative flex items-center justify-center size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title={t('searchPage.searchFilters')}
              >
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                </svg>
                {activeFiltersCount > 0 && (
                  <span className="absolute -top-1 -right-1 size-3.5 rounded-full bg-primary text-primary-foreground text-[8px] font-bold flex items-center justify-center">
                    {activeFiltersCount}
                  </span>
                )}
              </button>
            )}
          </div>

          {filterOpen && (
            <div
              ref={filterRef}
              className="absolute top-full right-0 mt-2 w-64 max-h-[70vh] rounded-lg bg-popover shadow-xl shadow-black/20 z-50 animate-in fade-in-0 zoom-in-95 overflow-hidden flex flex-col"
            >
              <div className="overflow-y-auto custom-scrollbar p-1 flex-1 min-h-0">
                <FilterSection label="Source" defaultOpen>
                  {providerOptions.map((option) => (
                    <label
                      key={option.value}
                      className={`flex items-center gap-2.5 px-2 py-1 rounded-md cursor-pointer text-sm transition-colors hover:bg-accent ${provider === option.value ? 'text-foreground' : 'text-muted-foreground'}`}
                    >
                      <span className="flex items-center justify-center size-4 rounded border border-border flex-shrink-0 bg-background">
                        {provider === option.value && (
                          <svg className="size-3 text-primary" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
                          </svg>
                        )}
                      </span>
                      <span className="flex items-center gap-2 flex-1 min-w-0">
                        {option.icon}
                        <span className="font-medium truncate">{option.label}</span>
                      </span>
                      <input
                        type="radio"
                        name="search-provider"
                        value={option.value}
                        checked={provider === option.value}
                        onChange={() => {
                          setProvider(option.value);
                          setFilterOpen(false);
                        }}
                        className="sr-only"
                      />
                    </label>
                  ))}
                </FilterSection>

                <div className="h-px bg-border mx-1" />

                <FilterSection label="Exclusions" defaultOpen>
                  <CheckboxItem
                    label="0 achievements"
                    checked={hideZeroAchievements}
                    onChange={() => setHideZeroAchievements(!hideZeroAchievements)}
                  />
                  {nameFilters.map((tag) => (
                    <CheckboxItem
                      key={tag}
                      label={tag}
                      checked={hideFilters[tag]}
                      onChange={() => toggleNameFilter(tag)}
                    />
                  ))}
                </FilterSection>

                <div className="h-px bg-border mx-1" />

                <FilterSection label="Platform">
                  {platformFilters.map((platform) => (
                    <CheckboxItem
                      key={platform}
                      label={platform}
                      checked={!!platformFiltersState[platform]}
                      onChange={() => togglePlatformFilter(platform)}
                      count={platformMatchCounts[platform]}
                    />
                  ))}
                </FilterSection>
              </div>

              {hiddenCount > 0 && (
                <>
                  <div className="h-px bg-border" />
                  <div className="px-3 py-2 text-[11px] text-muted-foreground flex-shrink-0">
                    <span className="font-semibold text-foreground">{hiddenCount}</span> game{hiddenCount !== 1 ? 's' : ''} hidden
                  </div>
                </>
              )}
            </div>
          )}
        </form>
      </header>

      <div className="flex-grow overflow-y-auto no-scrollbar pb-10 custom-scrollbar">
        {filteredResults.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6 pt-2 pb-5 overflow-visible">
            {filteredResults.map(game => <SearchGameCard key={`${game.source || 'steam'}-${game.id}`} game={game} onClick={() => onGameSelect(game)} />)}
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center p-12 bg-red-500/5 border border-red-500/10 rounded-md">
            <p className="text-sm font-bold text-red-400 uppercase tracking-widest">{error}</p>
          </div>
        )}

        {!isLoading && !error && hasSearched && filteredResults.length === 0 && (
          <div className="flex flex-col items-center justify-center p-12 border rounded-md bg-muted/30 border-border">
            <p className="text-[11px] font-bold tracking-wide opacity-70 text-muted-foreground">
              {t('searchPage.noResults', { query })}
            </p>
          </div>
        )}

        {!isLoading && !error && !hasSearched && (
          <div className="h-full flex flex-col items-center justify-center text-center select-none pointer-events-none">
            <SearchIcon className="text-5xl text-muted-foreground/20 mb-4" />
            <h2 className="text-sm font-semibold text-foreground/50">{t('searchPage.initialStateTitle')}</h2>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchContent;
