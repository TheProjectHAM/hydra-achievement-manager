import React, { useState } from 'react';
import { SearchIcon, PlatinumIcon } from './Icons';
import { SteamSearchResult } from '../types';
import { useI18n } from '../contexts/I18nContext';





// A card component to display a single game from the search results
const SearchGameCard: React.FC<{ game: SteamSearchResult, onClick: () => void }> = ({ game, onClick }) => {
  const imageUrl = `https://cdn.akamai.steamstatic.com/steam/apps/${game.id}/header.jpg`;
  const { t } = useI18n();
  
  return (
    <div
      onClick={onClick}
      className="group relative aspect-[16/9] bg-cover bg-center rounded-lg overflow-hidden shadow-lg cursor-pointer"
      style={{ backgroundImage: `url(${imageUrl})` }}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
      <div className="relative flex flex-row justify-between items-end h-full p-3 text-white gap-2">
        <h3 className="font-bold text-base truncate min-w-0">{game.name}</h3>
        <div className="flex items-center text-xs text-gray-300 font-medium flex-shrink-0">
            <PlatinumIcon className="text-base mr-1.5 text-gray-400" />
            <span>{t('searchPage.totalAchievements', { count: game.achievementsTotal })}</span>
        </div>
      </div>

      {/* Outline on hover */}
      <div className="absolute inset-0 rounded-lg pointer-events-none transition-all duration-300 group-hover:ring-2 group-hover:ring-inset group-hover:ring-gray-900 dark:group-hover:ring-white"></div>
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
      // Electron context: use IPC
      try {
        const partialResults: SteamSearchResult[] = await window.electronAPI.searchSteamGames(query.trim());
        // Fetch achievements in parallel
        await Promise.all(partialResults.map(async (game) => {
          try {
            const ach = await window.electronAPI.getGameAchievements(game.id.toString());
            game.achievementsTotal = ach.achievements.length;
          } catch (e) {
            console.warn(`Failed to get achievements for ${game.id}:`, e);
            // achievementsTotal remains 0
          }
        }));
        setResults(partialResults);
      } catch (err) {
        setError(t('searchPage.error'));
        console.error('Search error:', err);
      }
    } else {
      // Dev mode fallback (Vite browser): direct fetch with no-cors (limited)
      console.warn('Electron API not available; using direct fetch (may fail due to CORS)');
      try {
        const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(query.trim())}&l=english&cc=us&snr=1_4_4__12`;
        const response = await fetch(url, { mode: 'no-cors' });
        // Opaque response: can't read data, so show warning
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
      {/* Search form */}
      <form onSubmit={handleSearch} className="relative w-full flex-shrink-0">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('searchPage.inputPlaceholder')}
          className="w-full bg-white dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-lg pl-4 pr-12 py-2 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-sky-500 transition-colors"
          aria-label={t('searchPage.searchButton')}
        />
        <button
          type="submit"
          disabled={isLoading || !query.trim()}
          className="absolute inset-y-0 right-0 flex items-center px-4 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label={t('searchPage.searchButton')}
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-gray-500/50 dark:border-white/50 border-t-gray-500 dark:border-t-white rounded-full animate-spin"></div>
          ) : (
            <SearchIcon className="text-xl" />
          )}
        </button>
      </form>

      {/* Content area for results, loaders, or messages */}
      <div className="flex-grow overflow-y-auto min-h-0">
        {isLoading && (
          <div className="text-center text-gray-600 dark:text-gray-400">{t('searchPage.loading')}</div>
        )}

        {error && (
          <div className="text-center text-red-500">{error}</div>
        )}

        {!isLoading && !error && hasSearched && results.length === 0 && (
          <div className="text-center text-gray-600 dark:text-gray-400">{t('searchPage.noResults', { query })}</div>
        )}

        {!isLoading && !error && results.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
            {results.map(game => <SearchGameCard key={game.id} game={game} onClick={() => onGameSelect(game)} />)}
          </div>
        )}
        
        {!isLoading && !error && !hasSearched && (
            <div className="text-center text-gray-500 h-full flex flex-col items-center justify-center -mt-16">
                <h2 className="text-xl font-bold mb-2">{t('searchPage.initialStateTitle')}</h2>
                <p>{t('searchPage.initialStatePrompt')}</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default SearchContent;
