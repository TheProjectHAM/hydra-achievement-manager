import React, { useState, useEffect } from 'react';
import { LanguageIcon, InfoIcon, SaveIcon, CheckIcon, PaletteIcon, UpdateIcon, SteamIcon, FolderIcon } from './Icons';
import LocaleSettings from './settings/LanguageSettings';
import AboutSettings from './settings/AboutSettings';
import AppearanceSettings from './settings/AppearanceSettings';
import UpdateSettings from './settings/UpdateSettings';
import ApiSettings from './settings/ApiSettings';
import MonitoredSettings from './settings/MonitoredSettings';
import { DateFormat, TimeFormat, SidebarGameScale, ApiSource, GamesViewMode } from '../types';
import { useTheme, Theme } from '../contexts/ThemeContext';
import { useI18n, Language } from '../contexts/I18nContext';

type SubTabId = 'language' | 'appearance' | 'api' | 'monitored' | 'updates' | 'about';

const SettingsContent: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<SubTabId>('language');
  const { t, language, setLanguage } = useI18n();

  const {
    theme, setTheme,
    dateFormat, setDateFormat,
    timeFormat, setTimeFormat,
    sidebarGameScale, setSidebarGameScale,
    sidebarMarquee, setSidebarMarquee,
    hideHiddenAchievements, setHideHiddenAchievements,
    sidebarWidth,
    gamesViewMode, setGamesViewMode
  } = useTheme();

  // State for current settings
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(language);
  const [selectedTheme, setSelectedTheme] = useState<Theme>(theme);
  const [selectedDateFormat, setSelectedDateFormat] = useState<DateFormat>(dateFormat);
  const [selectedTimeFormat, setSelectedTimeFormat] = useState<TimeFormat>(timeFormat);
  const [selectedSidebarGameScale, setSelectedSidebarGameScale] = useState<SidebarGameScale>(sidebarGameScale);
  const [selectedSidebarMarquee, setSelectedSidebarMarquee] = useState<boolean>(sidebarMarquee);
  const [selectedGamesViewMode, setSelectedGamesViewMode] = useState<GamesViewMode>(gamesViewMode);
  const [selectedHideHiddenAchievements, setSelectedHideHiddenAchievements] = useState<boolean>(hideHiddenAchievements);
  const [selectedApi, setSelectedApi] = useState<ApiSource>('hydra');
  const [steamApiKey, setSteamApiKey] = useState<string>('');
  const [steamIntegrationEnabled, setSteamIntegrationEnabled] = useState<boolean>(false);

  // State for tracking changes
  const [savedSettings, setSavedSettings] = useState({
    language: language,
    theme: theme,
    dateFormat: dateFormat,
    timeFormat: timeFormat,
    sidebarGameScale: sidebarGameScale,
    sidebarMarquee: sidebarMarquee,
    hideHiddenAchievements: hideHiddenAchievements,
    gamesViewMode: gamesViewMode,
    selectedApi: 'hydra' as ApiSource,
    steamApiKey: '',
    steamIntegrationEnabled: false,
  });
  const [isDirty, setIsDirty] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // Load settings from electron on component mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        if ((window as any).electronAPI) {
          const loadedSettings = await (window as any).electronAPI.loadSettings();
          if (loadedSettings) {
            // Update local state with loaded settings
            if (loadedSettings.selectedApi) setSelectedApi(loadedSettings.selectedApi);
            if (loadedSettings.steamApiKey) setSteamApiKey(loadedSettings.steamApiKey);
            if (loadedSettings.steamIntegrationEnabled !== undefined) setSteamIntegrationEnabled(loadedSettings.steamIntegrationEnabled);
            if (loadedSettings.gamesViewMode) setSelectedGamesViewMode(loadedSettings.gamesViewMode);
            if (loadedSettings.hideHiddenAchievements !== undefined) setSelectedHideHiddenAchievements(loadedSettings.hideHiddenAchievements);

            // Update saved settings state
            setSavedSettings({
              language: loadedSettings.language || language,
              theme: loadedSettings.theme || theme,
              dateFormat: loadedSettings.dateFormat || dateFormat,
              timeFormat: loadedSettings.timeFormat || timeFormat,
              sidebarGameScale: loadedSettings.sidebarGameScale || sidebarGameScale,
              sidebarMarquee: loadedSettings.sidebarMarquee || sidebarMarquee,
              hideHiddenAchievements: loadedSettings.hideHiddenAchievements ?? hideHiddenAchievements,
              gamesViewMode: loadedSettings.gamesViewMode || gamesViewMode,
              selectedApi: loadedSettings.selectedApi || 'hydra',
              steamApiKey: loadedSettings.steamApiKey || '',
              steamIntegrationEnabled: loadedSettings.steamIntegrationEnabled || false,
            });
          }
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };

    loadSettings();
  }, []);

  // Sync local state if context changes
  useEffect(() => setSelectedLanguage(language), [language]);
  useEffect(() => setSelectedTheme(theme), [theme]);
  useEffect(() => setSelectedDateFormat(dateFormat), [dateFormat]);
  useEffect(() => setSelectedTimeFormat(timeFormat), [timeFormat]);
  useEffect(() => setSelectedSidebarGameScale(sidebarGameScale), [sidebarGameScale]);
  useEffect(() => setSelectedSidebarMarquee(sidebarMarquee), [sidebarMarquee]);
  useEffect(() => setSelectedHideHiddenAchievements(hideHiddenAchievements), [hideHiddenAchievements]);
  useEffect(() => setSelectedGamesViewMode(gamesViewMode), [gamesViewMode]);

  // Auto-disable Steam integration when switching to Hydra API
  useEffect(() => {
    if (selectedApi !== 'steam' && steamIntegrationEnabled) {
      setSteamIntegrationEnabled(false);
    }
  }, [selectedApi]);


  // Effect to check for changes
  useEffect(() => {
    const currentSettings = {
      language: selectedLanguage,
      theme: selectedTheme,
      dateFormat: selectedDateFormat,
      timeFormat: selectedTimeFormat,
      sidebarGameScale: selectedSidebarGameScale,
      sidebarMarquee: selectedSidebarMarquee,
      hideHiddenAchievements: selectedHideHiddenAchievements,
      gamesViewMode: selectedGamesViewMode,
      selectedApi: selectedApi,
      steamApiKey: steamApiKey,
      steamIntegrationEnabled: steamIntegrationEnabled,
    };
    if (JSON.stringify(currentSettings) !== JSON.stringify(savedSettings)) {
      setIsDirty(true);
      setIsSaved(false);
    } else {
      setIsDirty(false);
    }
  }, [selectedLanguage, selectedTheme, selectedDateFormat, selectedTimeFormat, selectedSidebarGameScale, selectedSidebarMarquee, selectedHideHiddenAchievements, selectedGamesViewMode, selectedApi, steamApiKey, steamIntegrationEnabled, savedSettings]);


  const handleSaveChanges = async () => {
    if (language !== selectedLanguage) setLanguage(selectedLanguage);
    if (theme !== selectedTheme) setTheme(selectedTheme);
    if (dateFormat !== selectedDateFormat) setDateFormat(selectedDateFormat);
    if (timeFormat !== selectedTimeFormat) setTimeFormat(selectedTimeFormat);
    if (sidebarGameScale !== selectedSidebarGameScale) setSidebarGameScale(selectedSidebarGameScale);
    if (sidebarMarquee !== selectedSidebarMarquee) setSidebarMarquee(selectedSidebarMarquee);
    if (hideHiddenAchievements !== selectedHideHiddenAchievements) setHideHiddenAchievements(selectedHideHiddenAchievements);
    if (gamesViewMode !== selectedGamesViewMode) setGamesViewMode(selectedGamesViewMode);

    const currentSettings = {
      language: selectedLanguage,
      theme: selectedTheme,
      dateFormat: selectedDateFormat,
      timeFormat: selectedTimeFormat,
      sidebarGameScale: selectedSidebarGameScale,
      sidebarMarquee: selectedSidebarMarquee,
      hideHiddenAchievements: selectedHideHiddenAchievements,
      gamesViewMode: selectedGamesViewMode,
      sidebarWidth: sidebarWidth,
      selectedApi: selectedApi,
      steamApiKey: steamApiKey,
      steamIntegrationEnabled: steamIntegrationEnabled,
    };

    try {
      if ((window as any).electronAPI) {
        await (window as any).electronAPI.saveSettings(currentSettings);
      }
      console.log('Saving global settings:', currentSettings);
      setSavedSettings({
        language: selectedLanguage,
        theme: selectedTheme,
        dateFormat: selectedDateFormat,
        timeFormat: selectedTimeFormat,
        sidebarGameScale: selectedSidebarGameScale,
        sidebarMarquee: selectedSidebarMarquee,
        hideHiddenAchievements: selectedHideHiddenAchievements,
        gamesViewMode: selectedGamesViewMode,
        selectedApi: selectedApi,
        steamApiKey: steamApiKey,
        steamIntegrationEnabled: steamIntegrationEnabled,
      });
      setIsSaved(true);

      // Dispatch event to notify other components that settings changed
      window.dispatchEvent(new Event('settings-saved'));
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  const SETTINGS_SUB_TABS = [
    { id: 'language', icon: <LanguageIcon />, key: 'language' },
    { id: 'appearance', icon: <PaletteIcon />, key: 'appearance' },
    { id: 'api', icon: <SteamIcon />, key: 'api' },
    { id: 'monitored', icon: <FolderIcon />, key: 'monitored' },
    { id: 'updates', icon: <UpdateIcon />, key: 'updates' },
    { id: 'about', icon: <InfoIcon />, key: 'about' },
  ];

  const renderSubTabContent = () => {
    switch (activeSubTab) {
      case 'language':
        return (
          <LocaleSettings
            selectedLanguage={selectedLanguage}
            setSelectedLanguage={setSelectedLanguage}
            selectedDateFormat={selectedDateFormat}
            setSelectedDateFormat={setSelectedDateFormat}
            selectedTimeFormat={selectedTimeFormat}
            setSelectedTimeFormat={setSelectedTimeFormat}
          />
        );
      case 'appearance':
        return <AppearanceSettings
          selectedTheme={selectedTheme}
          setSelectedTheme={setSelectedTheme}
          selectedGameScale={selectedSidebarGameScale}
          setSelectedGameScale={setSelectedSidebarGameScale}
          selectedMarquee={selectedSidebarMarquee}
          setSelectedMarquee={setSelectedSidebarMarquee}
          selectedHideHiddenAchievements={selectedHideHiddenAchievements}
          setSelectedHideHiddenAchievements={setSelectedHideHiddenAchievements}
          selectedGamesViewMode={selectedGamesViewMode}
          setSelectedGamesViewMode={setSelectedGamesViewMode}
          selectedApi={selectedApi}
        />;
      case 'api':
        return <ApiSettings
          selectedApi={selectedApi}
          setSelectedApi={setSelectedApi}
          steamApiKey={steamApiKey}
          setSteamApiKey={setSteamApiKey}
          steamIntegrationEnabled={steamIntegrationEnabled}
          setSteamIntegrationEnabled={setSteamIntegrationEnabled}
        />;
      case 'monitored':
        return <MonitoredSettings
          selectedApi={selectedApi}
          steamIntegrationEnabled={steamIntegrationEnabled}
          setSteamIntegrationEnabled={setSteamIntegrationEnabled}
        />;
      case 'updates':
        return <UpdateSettings />;
      case 'about':
        return <AboutSettings />;
      default:
        return null;
    }
  };

  useEffect(() => {
    if (isSaved) {
      const timer = setTimeout(() => setIsSaved(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [isSaved]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex-shrink-0 mb-6">
        <div className="flex items-center gap-1 flex-nowrap overflow-x-auto scrollbar-thin w-full" style={{ whiteSpace: 'nowrap' }}>
          {SETTINGS_SUB_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as SubTabId)}
              className={`flex-1 flex items-center justify-center gap-1 px-4 py-2 rounded-lg transition-colors duration-200 text-sm font-semibold h-10 overflow-hidden text-ellipsis whitespace-nowrap ${activeSubTab === tab.id
                ? 'bg-gray-800 text-white dark:bg-white dark:text-black'
                : 'bg-black/5 text-gray-700 hover:bg-black/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white'
                }`}
              aria-current={activeSubTab === tab.id ? 'page' : undefined}
              style={{ alignItems: 'center' }}
            >
              <span className="text-lg flex items-center justify-center" style={{ height: '100%' }}>{tab.icon}</span>
              <span className="overflow-hidden text-ellipsis whitespace-nowrap block w-full" style={{ lineHeight: '1' }}>{t(`settings.${tab.key}.tab`)}</span>
            </button>
          ))}
        </div>
      </header>

      {/* Tab Content */}
      <div className="flex-grow overflow-y-auto pr-2 overflow-x-visible">
        {renderSubTabContent()}
      </div>

      {/* Footer with Actions */}
      <footer className="flex-shrink-0 mt-auto pt-6 flex justify-end items-center">
        <button
          onClick={handleSaveChanges}
          disabled={!isDirty}
          className="w-48 flex-shrink-0 flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white dark:bg-white dark:hover:bg-gray-200 dark:text-black font-semibold py-2 px-5 rounded-lg transition-all shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSaved ? (
            <>
              <CheckIcon className="text-xl" />
              <span className="whitespace-nowrap">{t('settings.saved')}</span>
            </>
          ) : isDirty ? (
            <>
              <SaveIcon className="text-xl" />
              <span className="whitespace-nowrap">{t('settings.saveChanges')}</span>
            </>
          ) : (
            <>
              <CheckIcon className="text-xl" />
              <span className="whitespace-nowrap">{t('settings.changesSaved')}</span>
            </>
          )}
        </button>
      </footer>
    </div>
  );
};

export default SettingsContent;
