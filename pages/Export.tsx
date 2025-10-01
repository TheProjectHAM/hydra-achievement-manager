import React, { useState, useEffect, useRef } from 'react';
import { SteamSearchResult } from '../types';
import { useI18n } from '../contexts/I18nContext';
import { useTheme } from '../contexts/ThemeContext';
import { CheckIcon } from '../components/Icons';

const ExportPage: React.FC<{
  game: SteamSearchResult;
  onFinish: () => void;
}> = ({ game, onFinish }) => {
  const { t } = useI18n();
  const { theme } = useTheme();
  const [isExporting, setIsExporting] = useState(true);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number; name: string; icon: string } | null>(null);
  const [hasStarted, setHasStarted] = useState(false);

  const progressRef = useRef(false); // garante apenas 1 listener
  const gameHeaderUrl = `https://cdn.akamai.steamstatic.com/steam/apps/${game.id}/header.jpg`;

  // Listener de progresso
  useEffect(() => {
    if ((window as any).electronAPI && !progressRef.current) {
      progressRef.current = true;
      const handler = (progressData: any) => setProgress(progressData);

      (window as any).electronAPI.onExportProgress(handler);

      // Remove listener ao desmontar se a API suportar
      return () => {
        if ((window as any).electronAPI.offExportProgress) {
          (window as any).electronAPI.offExportProgress(handler);
        }
      };
    }
  }, []);

  // Exportação
  useEffect(() => {
    if (hasStarted || (window as any).exportInProgress) return;
    setHasStarted(true);
    (window as any).exportInProgress = true;

    const exportAchievements = async () => {
      try {
        const result = await (window as any).electronAPI.exportAchievements(game.id.toString());
        if (result.success) {
          setIsExporting(false);
          setTimeout(() => setIsComplete(true), 500);
        } else {
          setError(result.message || 'Export failed');
          setIsExporting(false);
        }
        (window as any).exportInProgress = false;
      } catch (err: any) {
        setError(err.message || 'Export failed');
        setIsExporting(false);
        (window as any).exportInProgress = false;
      }
    };

    exportAchievements();
  }, [game.id, hasStarted]);

  return (
    <div className="relative w-full h-full overflow-hidden font-sans">
      {/* Blurred Background */}
      <img
        src={gameHeaderUrl}
        alt=""
        className="absolute inset-0 w-full h-full object-cover filter blur-md scale-110"
        aria-hidden="true"
      />
      {/* Overlay & Vignette */}
      <div className="absolute inset-0 bg-black/60 dark:bg-black/70" aria-hidden="true"></div>
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0)_40%,rgba(0,0,0,0.9)_100%)]"
        aria-hidden="true"
      ></div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full text-center p-4">
        <div className="w-full max-w-2xl flex flex-col items-center">

          {/* Error State */}
          {error ? (
            <div className="animate-fade-in text-red-300 text-center">
              <div className="bg-red-500/20 text-red-300 rounded-full w-28 h-28 flex items-center justify-center mx-auto mb-6 border-2 border-red-400/50 shadow-xl">
                <span className="text-6xl">✕</span>
              </div>
              <h1 className="text-5xl font-bold">{t('exportPage.error')}</h1>
              <p className="text-xl text-gray-200 mt-2">{error}</p>
              <button
                onClick={onFinish}
                className="mt-12 bg-gray-800 hover:bg-gray-700 text-white dark:bg-white dark:hover:bg-gray-200 dark:text-black font-semibold py-3 px-8 rounded-lg transition-all shadow-lg hover:shadow-2xl text-lg"
              >
                {t('exportPage.close')}
              </button>
            </div>
          ) : isComplete ? (
            <div className="animate-fade-in text-white text-center">
              <div className="bg-green-500/20 text-green-300 rounded-full w-28 h-28 flex items-center justify-center mx-auto mb-6 border-2 border-green-400/50 shadow-xl">
                <CheckIcon className="text-6xl" />
              </div>
              <h1 className="text-5xl font-bold">{t('exportPage.complete')}</h1>
              <p className="text-xl text-gray-200 mt-2">{game.name}</p>
              <button
                onClick={onFinish}
                className="mt-12 bg-gray-800 hover:bg-gray-700 text-white dark:bg-white dark:hover:bg-gray-200 dark:text-black font-semibold py-3 px-8 rounded-lg transition-all shadow-lg hover:shadow-2xl text-lg"
              >
                {t('exportPage.done')}
              </button>
            </div>
          ) : (
            <>
              <h1 className="text-3xl font-bold text-white mb-2">{t('exportPage.exporting')}</h1>
              <p className="text-lg text-gray-200 mb-12">{game.name}</p>

              {/* Progress */}
              <div className="h-48 flex flex-col items-center justify-center w-full">
                {progress ? (
                  <div className="w-full max-w-md flex flex-col items-center">
                    <img
                      src={progress.icon}
                      alt={progress.name}
                      className="w-16 h-16 rounded-md mb-4 border border-white/20 shadow-md"
                    />
                    <p className="text-white text-center font-medium mb-2">{progress.name}</p>
                    <p className="text-gray-300 text-sm mb-4">{progress.current} / {progress.total}</p>
                    {/* White progress bar */}
                    <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-white h-3 transition-all duration-300"
                        style={{ width: `${(progress.current / progress.total) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="animate-spin rounded-full h-24 w-24 border-t-4 border-white/50 border-b-4 border-white"></div>
                    <p className="text-white mt-4 font-medium">Exporting achievements...</p>
                  </>
                )}
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
};

export default ExportPage;
