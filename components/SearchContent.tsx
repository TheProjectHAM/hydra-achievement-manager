import React, { useState } from 'react';
import { SearchIcon, PlatinumIcon } from './Icons';
import { SteamSearchResult } from '../types';
import { useI18n } from '../contexts/I18nContext';





// A card component to display a single game from the search results
const SearchGameCard: React.FC<{ game: SteamSearchResult, onClick: () => void }> = ({ game, onClick }) => {
  const imageUrl = `${import.meta.env.VITE_STEAM_CDN_URL || 'https://cdn.akamai.steamstatic.com/steam/apps'}/${game.id}/header.jpg`;
  const { t } = useI18n();

  return (
    <div
      onClick={onClick}
      className="group relative aspect-[16/9] bg-cover bg-center rounded-md overflow-hidden shadow-2xl cursor-pointer transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] border border-[var(--border-color)]"
      style={{ backgroundImage: `url(${imageUrl})`, backgroundColor: 'var(--card-bg)' }}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
      <div className="relative flex flex-col justify-end h-full p-4 text-white gap-1">
        <h3 className="font-black text-sm uppercase tracking-tight truncate min-w-0 drop-shadow-md">{game.name}</h3>
        <div className="flex items-center text-[10px] text-gray-200 font-bold uppercase tracking-widest flex-shrink-0 drop-shadow-md">
          <PlatinumIcon className="text-xs mr-2 opacity-50" />
          <span>{t('searchPage.totalAchievements', { count: game.achievementsTotal })}</span>
        </div>
      </div>

      {/* Outline on hover */}
      <div className="absolute inset-0 rounded-md pointer-events-none transition-all duration-300 group-hover:ring-1 group-hover:ring-inset group-hover:ring-black/20"></div>
    </div>
  );
};

interface SearchContentProps {
  onGameSelect: (game: SteamSearchResult) => void;
}

// The main component for the search tab
export const SearchContent: React.FC<SearchContentProps> = ({ onGameSelect }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SteamSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const { t } = useI18n();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);
    setHasSearched(true);
    setResults([]);

    if (typeof window !== 'undefined' && window.electronAPI) {
      try {
        const partialResults: SteamSearchResult[] = await window.electronAPI.searchSteamGames(query.trim());
        await Promise.all(partialResults.map(async (game) => {
          try {
            const ach = await window.electronAPI.getGameAchievements(game.id.toString());
            game.achievementsTotal = ach.achievements.length;
          } catch (e) {
            console.warn(`Failed to get achievements for ${game.id}:`, e);
          }
        }));
        setResults(partialResults);
      } catch (err) {
        setError(t('searchPage.error'));
        console.error('Search error:', err);
      }
    } else {
      console.warn('Electron API not available; using direct fetch (may fail due to CORS)');
      try {
        const url = `${import.meta.env.VITE_STEAM_STORE_API_URL || 'https://store.steampowered.com/api'}/storesearch/?term=${encodeURIComponent(query.trim())}&l=english&cc=us&snr=1_4_4__12`;
        const response = await fetch(url, { mode: 'no-cors' });
        setError('Search not fully supported in browser dev mode. Run in Electron for full functionality.');
      } catch (err) {
        setError(t('searchPage.error'));
        console.error(err);
      }
    }

    setIsLoading(false);
  };

  return (
    <div className="flex flex-col h-full gap-8">
      {/* Search form area - Aligned with scroll area */}
      <div className="flex-shrink-0" style={{ paddingRight: '6px' }}>
        <form onSubmit={handleSearch} className="relative w-full group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <SearchIcon className={`text-lg transition-colors duration-300 ${query ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)] group-focus-within:text-[var(--text-main)]'}`} />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchPage.inputPlaceholder')}
            className="w-full h-12 border rounded-md pl-12 pr-4 text-sm font-medium tracking-normal placeholder:normal-case placeholder:tracking-normal outline-none transition-all shadow-inner"
            style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-main)' }}
            aria-label={t('searchPage.searchButton')}
          />
          {isLoading && (
            <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
              <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--border-color)', borderTopColor: 'var(--text-main)' }}></div>
            </div>
          )}
        </form>
      </div>

      {/* Content area for results, loaders, or messages */}
      <div className="flex-grow min-h-0 custom-scrollbar overflow-y-auto" style={{ scrollbarGutter: 'stable' }}>
        {results.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-8 pb-20 px-1 pt-1">
            {results.map(game => <SearchGameCard key={game.id} game={game} onClick={() => onGameSelect(game)} />)}
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center p-12 bg-red-500/5 border border-red-500/10 rounded-md">
            <p className="text-sm font-bold text-red-400 uppercase tracking-widest">{error}</p>
          </div>
        )}

        {!isLoading && !error && hasSearched && results.length === 0 && (
          <div className="flex flex-col items-center justify-center p-12 border rounded-md" style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--border-color)' }}>
            <p className="text-[11px] font-bold tracking-wide opacity-70" style={{ color: 'var(--text-muted)' }}>
              {t('searchPage.noResults', { query })}
            </p>
          </div>
        )}

        {!isLoading && !error && !hasSearched && (
          <div className="h-full flex flex-col items-center justify-center text-center select-none pointer-events-none">
            <SearchIcon className="text-8xl mb-6 text-[var(--text-main)] opacity-15" />
            <h2 className="text-xl font-black tracking-wide text-[var(--text-main)] opacity-35">
              {t('searchPage.initialStateTitle')}
            </h2>
            <p className="text-[11px] font-bold tracking-wide mt-2 text-[var(--text-muted)] opacity-70">
              {t('searchPage.delistedHint')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchContent;
