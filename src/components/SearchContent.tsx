import React, { useState } from 'react';
import { SearchIcon, PlatinumIcon } from './Icons';
import { SteamSearchResult } from '../types';
import { useI18n } from '../contexts/I18nContext';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { getSteamHeaderUrl } from '@/lib/steam-assets';

const SearchGameCard: React.FC<{ game: SteamSearchResult, onClick: () => void }> = ({ game, onClick }) => {
  const imageUrl = getSteamHeaderUrl(game.id);

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
            <PlatinumIcon className="text-[11px] opacity-50" />
            <span>{game.achievementsTotal}</span>
          </div>
        </div>
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
    <div className="h-full flex flex-col overflow-hidden">
      <header className="flex-shrink-0 w-full mb-4 animate-fade-in">
        <form onSubmit={handleSearch} className="relative w-full group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <SearchIcon className={`text-lg transition-colors duration-300 ${query ? 'text-foreground' : 'text-muted-foreground group-focus-within:text-foreground'}`} />
          </div>
          <Input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchPage.inputPlaceholder')}
            className="w-full h-12 pl-12 pr-4 text-[0.95rem] font-semibold"
            aria-label={t('searchPage.searchButton')}
          />
          {isLoading && (
            <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </form>
      </header>

      <div className="flex-grow overflow-y-auto no-scrollbar pb-10 custom-scrollbar">
        {results.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6 pt-2 pb-5 overflow-visible">
            {results.map(game => <SearchGameCard key={game.id} game={game} onClick={() => onGameSelect(game)} />)}
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center p-12 bg-red-500/5 border border-red-500/10 rounded-md">
            <p className="text-sm font-bold text-red-400 uppercase tracking-widest">{error}</p>
          </div>
        )}

        {!isLoading && !error && hasSearched && results.length === 0 && (
          <div className="flex flex-col items-center justify-center p-12 border rounded-md bg-muted/30 border-border">
            <p className="text-[11px] font-bold tracking-wide opacity-70 text-muted-foreground">
              {t('searchPage.noResults', { query })}
            </p>
          </div>
        )}

        {!isLoading && !error && !hasSearched && (
          <div className="h-full flex flex-col items-center justify-center text-center select-none pointer-events-none">
            <SearchIcon className="text-8xl mb-6 text-foreground opacity-15" />
            <h2 className="text-xl font-black tracking-wide text-foreground opacity-35">
              {t('searchPage.initialStateTitle')}
            </h2>
            <p className="text-[11px] font-bold tracking-wide mt-2 text-muted-foreground opacity-70">
              {t('searchPage.delistedHint')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchContent;
