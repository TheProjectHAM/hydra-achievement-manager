import React, { useState, useEffect, useRef } from 'react';
import { SteamSearchResult } from '../types';
import { useI18n } from '../contexts/I18nContext';
import { CheckIcon } from '../components/Icons';
import { Button } from '@/components/ui/button';

const ExportPage: React.FC<{
  game: SteamSearchResult;
  onFinish: () => void;
}> = ({ game, onFinish }) => {
  const { t } = useI18n();
  const [isExporting, setIsExporting] = useState(true);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number; name: string; icon: string } | null>(null);
  const [hasStarted, setHasStarted] = useState(false);

  const progressRef = useRef(false);

  useEffect(() => {
    if ((window as any).electronAPI && !progressRef.current) {
      progressRef.current = true;
      const handler = (progressData: any) => setProgress(progressData);
      (window as any).electronAPI.onExportProgress(handler);
      return () => {
        if ((window as any).electronAPI.offExportProgress) {
          (window as any).electronAPI.offExportProgress(handler);
        }
      };
    }
  }, []);

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
    <div className="w-full h-full flex flex-col items-center justify-center p-8 animate-fade-in bg-background">
      <div className="w-full max-w-4xl">
        {error ? (
          <div className="flex flex-col items-center text-center animate-fade-in">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6 border-2 border-destructive text-destructive">
               <span className="text-3xl font-semibold">✕</span>
            </div>
            <h1 className="text-2xl font-semibold mb-2 text-foreground">
              {t('exportPage.error')}
            </h1>
            <p className="text-[10px] font-semibold max-w-md mx-auto opacity-50 text-foreground">
              {error}
            </p>
            <Button
              onClick={onFinish}
              className="mt-10 px-10 h-12 text-[10px] font-semibold"
            >
              {t('exportPage.close')}
            </Button>
          </div>
        ) : isComplete ? (
          <div className="flex flex-col items-center text-center animate-fade-in">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6 border-2 border-foreground text-foreground">
              <CheckIcon className="text-4xl" />
            </div>
            <div className="space-y-1">
              <h1 className="text-3xl font-semibold leading-none text-foreground">
                {t('exportPage.complete')}
              </h1>
              <p className="text-[10px] font-semibold opacity-40 text-foreground">
                {game.name}
              </p>
            </div>
            <Button
              onClick={onFinish}
              className="mt-10 px-10 h-12 text-[10px] font-semibold"
            >
              {t('exportPage.done')}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center w-full">
            <div className="text-center mb-16 w-full max-w-2xl mx-auto space-y-4">
              <h1 className="text-4xl font-semibold leading-none text-foreground">
                {t('exportPage.exporting')}
              </h1>
              <div className="flex items-center justify-center gap-4">
                <div className="h-[1px] flex-1 opacity-10 bg-foreground"></div>
                <p className="text-[10px] font-semibold opacity-30 whitespace-nowrap text-foreground">
                  {game.name}
                </p>
                <div className="h-[1px] flex-1 opacity-10 bg-foreground"></div>
              </div>
            </div>

            <div className="w-full transition-all duration-500">
              {progress ? (
                <div className="w-full flex flex-col items-center">
                  <div className="flex items-center gap-8 mb-10 w-full max-w-3xl">
                    <img
                      src={progress.icon}
                      alt={progress.name}
                      className="w-24 h-24 rounded-2xl border-2 shadow-sm border-border"
                    />
                    <div className="flex-grow min-w-0">
                      <p className="text-[9px] font-semibold opacity-20 mb-2 text-foreground">
                        Processing Achievement
                      </p>
                      <h3 className="text-2xl font-semibold truncate leading-tight text-foreground">
                        {progress.name}
                      </h3>
                      <div className="flex items-baseline gap-2 mt-2">
                        <span className="text-lg font-semibold text-foreground">{progress.current}</span>
                        <span className="text-[9px] font-semibold opacity-20 text-foreground">of {progress.total} Total</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-4xl font-semibold tabular-nums text-foreground">
                        {Math.round((progress.current / progress.total) * 100)}%
                      </span>
                    </div>
                  </div>

                  <div className="w-full max-w-3xl space-y-4">
                    <div className="w-full h-4 relative rounded-full overflow-hidden border-2 bg-muted/30 border-border">
                      <div className="absolute inset-0 opacity-5 pointer-events-none flex gap-[4px]">
                        {Array.from({ length: 30 }).map((_, i) => (
                          <div key={i} className="h-full flex-1 border-r border-foreground"></div>
                        ))}
                      </div>

                      <div
                        className="h-full transition-all duration-1000 ease-out relative bg-foreground"
                        style={{ width: `${(progress.current / progress.total) * 100}%` }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer"></div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center w-full px-2">
                      <div className="flex items-center gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-foreground animate-pulse"></div>
                        <p className="text-[8px] font-semibold opacity-30 text-foreground">
                          {progress.current / progress.total < 0.2 ? t('exportPage.fetchingData') :
                            progress.current / progress.total > 0.9 ? t('exportPage.finalizing') :
                              t('exportPage.writingFile')}
                        </p>
                      </div>
                      <p className="text-[8px] font-semibold opacity-30 text-foreground">
                        {progress.current} / {progress.total}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center py-16 space-y-8 animate-pulse w-full">
                  <div className="h-3 w-full max-w-lg rounded-full bg-muted/30"></div>
                  <div className="space-y-4 text-center">
                    <p className="text-base font-semibold opacity-40 text-foreground">
                      {t('exportPage.initializing')}
                    </p>
                    <div className="flex gap-2 justify-center">
                      {[0, 1, 2].map(i => (
                        <div key={i} className="w-2 h-2 rounded-full bg-foreground animate-bounce" style={{ animationDelay: `${i * 0.15}s` }}></div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExportPage;
