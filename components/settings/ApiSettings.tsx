
import React, { useState, useEffect } from 'react';
import { ApiSource } from '../../types';
import { SteamIcon, HydraIcon } from '../Icons';
import { useI18n } from '../../contexts/I18nContext';
import { SteamAPI } from '../../utils/steam-api';
import { HydraAPI } from '../../utils/hydra-api';

interface ApiSettingsProps {
  selectedApi: ApiSource;
  setSelectedApi: (api: ApiSource) => void;
  steamApiKey: string;
  setSteamApiKey: (key: string) => void;
}

const ApiOptionButton: React.FC<{
    id: ApiSource;
    label: string;
    icon: React.ReactNode;
    isSelected: boolean;
    isRecommended: boolean;
    onClick: (id: ApiSource) => void;
}> = ({ id, label, icon, isSelected, isRecommended, onClick }) => {
    const activeClasses = 'bg-gray-800 text-white dark:bg-white dark:text-black shadow-md';
    const inactiveClasses = 'bg-gray-100 dark:bg-white/5 text-gray-700 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-white/10';

    return (
        <div className="relative flex-1 overflow-visible">
            <button
                onClick={() => onClick(id)}
                className={`w-full flex items-center justify-center gap-2 py-3 px-4 text-sm font-semibold rounded-lg transition-all duration-200 focus:outline-none ${isSelected ? activeClasses : inactiveClasses}`}
                aria-pressed={isSelected}
            >
                <span className="text-xl">{icon}</span>
                <span>{label}</span>
            </button>
            {isRecommended && (
                <span className="absolute top-1 right-1 bg-green-500 text-white text-xs px-1 py-0.5 rounded-full font-medium z-20 shadow-sm">
                    Recommended
                </span>
            )}
        </div>
    );
};

const ApiSettings: React.FC<ApiSettingsProps> = ({
  selectedApi,
  setSelectedApi,
  steamApiKey,
  setSteamApiKey,
}) => {
  const { t, language } = useI18n();
  const [steamAchievements, setSteamAchievements] = useState<any[]>([]);
  const [hydraAchievements, setHydraAchievements] = useState<any[]>([]);
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string>('');

  const validateApiKey = (key: string) => {
    if (!key) return '';
    if (key.length !== 32) return t('settings.api.apiKeyInvalidLength');
    if (!/^[a-fA-F0-9]{32}$/.test(key)) return t('settings.api.apiKeyInvalidFormat');
    return '';
  };

  // All supported languages for Steam API (all app languages) with full names and flags
  const steamSupportedLanguages = [
    { code: 'en-US', name: 'English (United States)', flag: '🇺🇸' },
    { code: 'pt-BR', name: 'Português (Brasil)', flag: '🇧🇷' },
    { code: 'fr-FR', name: 'Français (France)', flag: '🇫🇷' },
    { code: 'it-IT', name: 'Italiano (Italia)', flag: '🇮🇹' },
    { code: 'zh-CN', name: '中文 (简体)', flag: '🇨🇳' },
    { code: 'ja-JP', name: '日本語 (日本)', flag: '🇯🇵' },
    { code: 'ru-RU', name: 'Русский (Россия)', flag: '🇷🇺' },
    { code: 'uk-UA', name: 'Українська (Україна)', flag: '🇺🇦' },
    { code: 'pl-PL', name: 'Polski (Polska)', flag: '🇵🇱' },
    { code: 'es-ES', name: 'Español (España)', flag: '🇪🇸' },
  ];

  // Supported languages for Hydra API (limited) with full names and flags
  const hydraSupportedLanguages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'ru', name: 'Русский', flag: '🇷🇺' },
    { code: 'pt', name: 'Português', flag: '🇧🇷' },
  ];

  // Map app language codes to Hydra API language codes
  const hydraLanguageMap: Record<string, string> = {
    'en-US': 'en',
    'es-ES': 'es',
    'ru-RU': 'ru',
    'pt-BR': 'pt',
  };

  // Determine available languages based on selected API
  const availableLanguages = selectedApi === 'steam' ? steamSupportedLanguages : hydraSupportedLanguages;

  // Hydra API is recommended only for these 4 languages
  const hydraRecommendedLanguages = ['en-US', 'es-ES', 'ru-RU', 'pt-BR'];
  const isHydraRecommended = hydraRecommendedLanguages.includes(language);
  const isSteamRecommended = !isHydraRecommended;

  useEffect(() => {
    if (selectedApi === 'steam' && steamApiKey) {
      // Example: fetch achievements for a game with appId 440 (Team Fortress 2)
      SteamAPI.getGameAchievements(440, steamApiKey, language)
        .then(setSteamAchievements)
        .catch(console.error);
    }
  }, [selectedApi, steamApiKey, language]);

  useEffect(() => {
    if (selectedApi === 'hydra') {
      const hydraLang = hydraLanguageMap[language] || 'en';
      HydraAPI.getGameAchievements('440', hydraLang)
        .then(setHydraAchievements)
        .catch(console.error);
    }
  }, [selectedApi, language]);

  const apiDescriptions: Record<ApiSource, string> = {
    steam: t('settings.api.steamDescription'),
    hydra: t('settings.api.hydraDescription'),
  };

  return (
    <div>
      <div className="flex gap-3 overflow-visible">
        <ApiOptionButton
          id="steam"
          label={t('settings.api.steamApi')}
          icon={<SteamIcon />}
          isSelected={selectedApi === 'steam'}
          isRecommended={isSteamRecommended}
          onClick={setSelectedApi}
        />
        <ApiOptionButton
          id="hydra"
          label={t('settings.api.hydraApi')}
          icon={<HydraIcon />}
          isSelected={selectedApi === 'hydra'}
          isRecommended={isHydraRecommended}
          onClick={setSelectedApi}
        />
      </div>

      <div className="mt-4 p-3 rounded-lg bg-gray-100 dark:bg-white/5 border border-black/5 dark:border-white/5">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {selectedApi === 'steam' && (
            <span className="block text-xs">
              Supported languages: {steamSupportedLanguages.map(lang => `${lang.name}`).join(', ')}
            </span>
          )}
          {selectedApi === 'hydra' && (
            <span className="block text-xs">
              Supported languages: {hydraSupportedLanguages.map(lang => `${lang.name}`).join(', ')}
            </span>
          )}
        </p>
      </div>

      <div className={`transition-all duration-300 ease-in-out ${selectedApi === 'steam' ? 'max-h-40 opacity-100 mt-6' : 'max-h-0 opacity-0 overflow-hidden'}`}>
        <label htmlFor="steam-api-key" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t('settings.api.apiKeyLabel')}
        </label>
        <div className="relative">
          <input
            type={showApiKey ? "text" : "password"}
            id="steam-api-key"
            value={steamApiKey}
            onChange={(e) => {
              const value = e.target.value;
              setSteamApiKey(value);
              setApiKeyError(validateApiKey(value));
            }}
            placeholder={t('settings.api.apiKeyPlaceholder')}
            className={`w-full bg-white dark:bg-white/5 border rounded-lg px-4 py-2 pr-12 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-sky-500 transition-colors ${apiKeyError ? 'border-red-500' : 'border-gray-300 dark:border-white/10'}`}
          />
          <button
            type="button"
            onClick={() => setShowApiKey(!showApiKey)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            aria-label={showApiKey ? "Hide API key" : "Show API key"}
          >
            {showApiKey ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 0010.586 10.586z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2 2l20 20" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>
        {apiKeyError && <p className="text-red-500 text-xs mt-1">{apiKeyError}</p>}
      </div>
    </div>
  );
};

export default ApiSettings;
