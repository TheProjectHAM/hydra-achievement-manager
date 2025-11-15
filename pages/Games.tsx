import React, { useState, useEffect } from 'react';
import { SteamSearchResult } from '../types';
import { useMonitoredAchievements } from '../contexts/MonitoredAchievementsContext';
import { useTheme } from '../contexts/ThemeContext';
import { GameAchievements } from '../utils/types';

const MonitoredGameCard: React.FC<{
  game: GameAchievements;
  onGameSelect: (game: SteamSearchResult) => void;
}> = ({ game, onGameSelect }) => {
  const { theme } = useTheme();
  const gameId = game.gameId;
  const achievementsCurrent = game.achievements.filter(a => a.achieved).length;
  const [gameName, setGameName] = useState(gameId);
  const [totalAchievements, setTotalAchievements] = useState<number | null>(null);

  const fallbackImages = [
    `https://cdn.akamai.steamstatic.com/steam/apps/${gameId}/library_hero.jpg`,
    `https://cdn.akamai.steamstatic.com/steam/apps/${gameId}/capsule_616x353.jpg`,
    `https://cdn.akamai.steamstatic.com/steam/apps/${gameId}/capsule_467x181.jpg`,
    `https://cdn.akamai.steamstatic.com/steam/apps/${gameId}/capsule_231x87.jpg`,
    `https://cdn.akamai.steamstatic.com/steam/apps/${gameId}/capsule_184x69.jpg`,
    `https://cdn.akamai.steamstatic.com/steam/apps/${gameId}/capsule_sm_120.jpg`,
    `https://cdn.akamai.steamstatic.com/steam/apps/${gameId}/logo.png`,
    `https://cdn.akamai.steamstatic.com/steam/apps/${gameId}/logo.jpg`,
    `https://cdn.akamai.steamstatic.com/steam/apps/${gameId}/library_600x900.jpg`,
    `https://cdn.akamai.steamstatic.com/steam/apps/${gameId}/header.jpg`,
    `https://cdn.akamai.steamstatic.com/steam/apps/${gameId}/header_292x136.jpg`
  ];

  const [imageIndex, setImageIndex] = useState(0);
  const [imageUrl, setImageUrl] = useState(fallbackImages[0]);
  const [isImageLoaded, setIsImageLoaded] = useState(false);

  useEffect(() => {
    setImageIndex(0);
    setImageUrl(fallbackImages[0]);
    setIsImageLoaded(false);
  }, [gameId]);

  useEffect(() => {
    const fetchGameName = async () => {
      if ((window as any).electronAPI) {
        try {
          const name = await (window as any).electronAPI.getGameName(gameId);
          setGameName(name);
        } catch (error) {
          console.error('Error fetching game name:', error);
        }
      }
    };

    fetchGameName();
  }, [gameId]);

  useEffect(() => {
    const fetchTotalAchievements = async () => {
      if ((window as any).electronAPI) {
        try {
          const gameAchievements = await (window as any).electronAPI.getGameAchievements(gameId);
          setTotalAchievements(gameAchievements.achievements.length);
        } catch (error) {
          console.error('Error fetching total achievements:', error);
          setTotalAchievements(0); // Fallback
        }
      }
    };

    fetchTotalAchievements();
  }, [gameId]);

  const handleClick = () => {
    if (onGameSelect) {
      onGameSelect({
        id: parseInt(gameId),
        name: gameName,
        achievementsTotal: game.achievements.length
      });
    }
  };

  const handleImageError = () => {
    if (imageIndex < fallbackImages.length - 1) {
      const nextIndex = imageIndex + 1;
      setImageIndex(nextIndex);
      setImageUrl(fallbackImages[nextIndex]);
    } else {
      setIsImageLoaded(true);
    }
  };

  const handleImageLoad = () => {
    setIsImageLoaded(true);
  };

  return (
    <div
      onClick={handleClick}
      className="group relative aspect-[16/9] bg-cover bg-center rounded-lg overflow-hidden shadow-lg cursor-pointer"
      style={isImageLoaded ? { backgroundImage: `url(${imageUrl})` } : undefined}
    >
      <img src={imageUrl} onError={handleImageError} onLoad={handleImageLoad} style={{ display: 'none' }} alt="" />
      {!isImageLoaded && (
        <div className="absolute inset-0 bg-gray-200 dark:bg-white/10 animate-pulse" />
      )}
      
      {/* Gradient overlay for text readability */}
      <div className={`absolute inset-0 transition-opacity duration-300 ${
        theme === 'dark'
          ? 'bg-gradient-to-b from-black/80 via-black/20 to-black/80'
          : 'bg-gradient-to-b from-black/40 via-black/10 to-black/40'
      }`}></div>

      {/* Content wrapper */}
      <div className={`relative flex flex-col justify-end h-full p-3 text-white ${isImageLoaded ? '' : 'opacity-0'}`}>
        <div>
            <div className="flex justify-between items-end text-xs font-semibold mb-1 transition-transform duration-300 ease-in-out transform translate-y-4 group-hover:translate-y-0 text-white">
                <h3 className="font-bold text-lg truncate pr-4">{gameName}</h3>
                <div className="flex items-center flex-shrink-0">
                    <span>{achievementsCurrent} / {totalAchievements ?? '?'}</span>
                </div>
            </div>
            {/* Progress bar container (appears on hover) */}
            <div className={`w-full rounded-full h-1.5 overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${
              theme === 'dark' ? 'bg-black/20' : 'bg-gray-300'
            }`}>
                <div
                    className={`h-full rounded-full ${
                      theme === 'dark' ? 'bg-white' : 'bg-gray-800'
                    }`}
                    style={{
                      width: totalAchievements ? `${(achievementsCurrent / totalAchievements) * 100}%` : '0%',
                    }}
                ></div>
            </div>
        </div>
      </div>

      {/* Outline on hover */}
      <div className={`absolute inset-0 rounded-lg pointer-events-none transition-all duration-300 group-hover:ring-2 group-hover:ring-inset ${
        theme === 'dark' ? 'group-hover:ring-white' : 'group-hover:ring-gray-900'
      }`}></div>
    </div>
  );
};

const GamesContent: React.FC<{ onGameSelect: (game: SteamSearchResult) => void }> = ({ onGameSelect }) => {
  const { games } = useMonitoredAchievements();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
      {games.map(game => (
        <MonitoredGameCard
          key={game.gameId}
          game={game}
          onGameSelect={onGameSelect}
        />
      ))}
    </div>
  );
};

export default GamesContent;
