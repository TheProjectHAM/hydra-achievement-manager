import React, { useEffect, useMemo, useState } from 'react';
import TitleBar from '../components/TitleBar';
import { useTheme, Theme } from '../contexts/ThemeContext';
import { DateFormat, TimeFormat, ApiSource } from '../types';
import { useI18n, Language } from '../contexts/I18nContext';
import {
  ArrowRightIcon,
  CheckIcon,
  ChevronLeftIcon,
  FolderIcon,
  HydraIcon,
  SteamBrandIcon,
  VisibilityIcon,
  VisibilityOffIcon
} from '../components/Icons';
import { loadSettings, saveSettings, setWinePrefixPath } from '../tauri-api';
import appLogo from '../../assets/icon.png';

type WizardStep = 1 | 2 | 3 | 4 | 5;

const STEP_IDS: WizardStep[] = [1, 2, 3, 4, 5];

const SetupWizard: React.FC<{ onFinish: () => void }> = ({ onFinish }) => {
  const { theme, setTheme, dateFormat, setDateFormat, timeFormat, setTimeFormat } = useTheme();
  const { language, setLanguage, t } = useI18n();
  const [step, setStep] = useState<WizardStep>(1);
  const [selectedApi, setSelectedApi] = useState<ApiSource>('hydra');
  const [steamApiKey, setSteamApiKey] = useState('');
  const [showSteamKey, setShowSteamKey] = useState(false);
  const [steamIntegrationEnabled, setSteamIntegrationEnabled] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const isLinux = (window as any).electronAPI?.platform === 'linux';
  const [winePrefixPath, setWinePrefixPathLocal] = useState('~/.wine');

  useEffect(() => {
    const loadInitial = async () => {
      try {
        const settings = await loadSettings();
        if (!settings) return;
        if (settings.selectedApi) setSelectedApi(settings.selectedApi);
        if (settings.steamApiKey) setSteamApiKey(settings.steamApiKey);
        if (typeof settings.steamIntegrationEnabled === 'boolean') {
          setSteamIntegrationEnabled(settings.steamIntegrationEnabled);
        }
        if (isLinux && typeof settings.winePrefixPath === 'string' && settings.winePrefixPath.trim()) {
          setWinePrefixPathLocal(settings.winePrefixPath.trim());
        }
      } catch (error) {
        console.error('Failed to load wizard defaults:', error);
      }
    };
    loadInitial();
  }, [isLinux]);

  const themes: Array<{ id: Theme; name: string; preview: string[] }> = useMemo(() => ([
    { id: 'light', name: t('settings.appearance.lightTheme'), preview: ['#f3f4f6', '#d1d5db', '#111827'] },
    { id: 'dark', name: t('settings.appearance.darkTheme'), preview: ['#0b0f15', '#1f2937', '#f9fafb'] },
    { id: 'nord', name: t('settings.appearance.nordTheme'), preview: ['#2e3440', '#4c566a', '#88c0d0'] },
    { id: 'gruvbox', name: t('settings.appearance.gruvboxTheme'), preview: ['#282828', '#504945', '#fabd2f'] },
    { id: 'tokyo-night', name: t('settings.appearance.tokyoNightTheme'), preview: ['#1a1b26', '#2a2f4a', '#7aa2f7'] },
    { id: 'everforest', name: t('settings.appearance.everforestTheme'), preview: ['#2d353b', '#475258', '#a7c080'] },
    { id: 'dracula', name: t('settings.appearance.draculaTheme'), preview: ['#282a36', '#44475a', '#ff79c6'] },
    { id: 'retrowave', name: t('settings.appearance.retrowaveTheme'), preview: ['#140522', '#2c0f4c', '#d946ef'] },
    { id: 'catppuccin', name: t('settings.appearance.catppuccinTheme'), preview: ['#1e1e2e', '#313244', '#f5c2e7'] },
    { id: 'github-dark', name: t('settings.appearance.githubDarkTheme'), preview: ['#0d1117', '#30363d', '#58a6ff'] },
    { id: 'solarized-dark', name: t('settings.appearance.solarizedDarkTheme'), preview: ['#002b36', '#073642', '#2aa198'] },
    { id: 'one-dark', name: t('settings.appearance.oneDarkTheme'), preview: ['#282c34', '#3e4451', '#61afef'] }
  ]), [t]);

  const stepLabels = [
    t('wizard.steps.welcome'),
    t('wizard.steps.language'),
    t('wizard.steps.api'),
    t('wizard.steps.appearance'),
    t('wizard.steps.region')
  ];

  const canGoNext = true;
  const isLastStep = step === 5;
  const sampleDate = new Date('2026-12-31T23:59:00');

  const dateExampleByFormat: Record<DateFormat, string> = {
    'DD/MM/YYYY': '31/12/2026',
    'MM/DD/YYYY': '12/31/2026',
    'YYYY-MM-DD': '2026-12-31'
  };

  const timeExampleByFormat: Record<TimeFormat, string> = {
    '24h': '23:59',
    '12h': '11:59 PM'
  };

  const nextStep = () => {
    const idx = STEP_IDS.indexOf(step);
    if (idx < STEP_IDS.length - 1) setStep(STEP_IDS[idx + 1]);
  };

  const prevStep = () => {
    const idx = STEP_IDS.indexOf(step);
    if (idx > 0) setStep(STEP_IDS[idx - 1]);
  };

  const handleFinish = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      if (isLinux && winePrefixPath.trim()) {
        await setWinePrefixPath(winePrefixPath.trim());
      }

      await saveSettings({
        language,
        theme,
        dateFormat,
        timeFormat,
        selectedApi,
        steamApiKey,
        steamIntegrationEnabled: selectedApi === 'steam' ? steamIntegrationEnabled : false,
        winePrefixPath: isLinux ? winePrefixPath.trim() : undefined,
        wizardCompleted: true
      });
      onFinish();
    } catch (error) {
      console.error('Error saving initial settings:', error);
      onFinish();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-screen h-screen overflow-hidden flex flex-col" style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-main)' }}>
      <TitleBar />

      <div className="mx-auto w-full max-w-5xl px-6 pt-8 pb-4">
        <div className="flex items-center gap-2">
          {STEP_IDS.map((id, idx) => {
            const active = id <= step;
            return (
              <React.Fragment key={id}>
                <button
                  type="button"
                  className="h-8 min-w-8 px-2 rounded-md border text-[10px] font-black uppercase tracking-wider"
                  style={{
                    borderColor: active ? 'var(--text-main)' : 'var(--border-color)',
                    backgroundColor: active ? 'var(--text-main)' : 'transparent',
                    color: active ? 'var(--bg-color)' : 'var(--text-main)'
                  }}
                  onClick={() => id < step && setStep(id)}
                  disabled={id >= step}
                >
                  {idx + 1}
                </button>
                {idx < STEP_IDS.length - 1 && (
                  <div className="h-px flex-1" style={{ backgroundColor: 'var(--border-color)' }} />
                )}
              </React.Fragment>
            );
          })}
        </div>
        <div className="mt-2 text-[10px] uppercase font-bold tracking-widest opacity-60">
          {stepLabels[step - 1]}
        </div>
      </div>

      <main className="flex-1 overflow-y-auto flex items-center">
        <div className="mx-auto w-full max-w-5xl px-6 pb-8">
          {step === 1 && (
            <section className="max-w-3xl mx-auto py-8">
              <div className="flex flex-col sm:flex-row items-center gap-8">
                <img src={appLogo} alt="Project HAM" className="w-32 h-32 sm:w-40 sm:h-40" />
                <div className="space-y-4 text-center sm:text-left">
                  <h1 className="text-4xl font-black uppercase tracking-tight">{t('wizard.welcomeTitle')}</h1>
                  <p className="text-sm opacity-70 max-w-2xl">{t('wizard.welcomeDesc')}</p>
                </div>
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="max-w-4xl mx-auto py-4 text-center">
              <h2 className="text-2xl font-black uppercase tracking-tight mb-8">{t('wizard.selectLanguage')}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 text-left">
                {[
                  { id: 'en-US', name: 'English', cc: 'US' },
                  { id: 'pt-BR', name: 'Portugues', cc: 'BR' },
                  { id: 'fr-FR', name: 'Francais', cc: 'FR' },
                  { id: 'es-ES', name: 'Espanol', cc: 'ES' },
                  { id: 'it-IT', name: 'Italiano', cc: 'IT' },
                  { id: 'ru-RU', name: 'Russkiy', cc: 'RU' },
                  { id: 'zh-CN', name: 'Zhongwen', cc: 'CN' },
                  { id: 'ja-JP', name: 'Nihongo', cc: 'JP' },
                  { id: 'pl-PL', name: 'Polski', cc: 'PL' },
                  { id: 'uk-UA', name: 'Ukrainska', cc: 'UA' }
                ].map((langOption) => {
                  const selected = language === langOption.id;
                  return (
                    <button
                      key={langOption.id}
                      type="button"
                      className="rounded-lg border p-3 text-left transition-all"
                      style={{
                        borderColor: selected ? 'var(--text-main)' : 'var(--border-color)',
                        backgroundColor: selected ? 'var(--hover-bg)' : 'transparent',
                        opacity: selected ? 1 : 0.85
                      }}
                      onClick={() => setLanguage(langOption.id as Language)}
                    >
                      <img
                        src={`${import.meta.env.VITE_FLAGS_API_URL || 'https://flagsapi.com'}/${langOption.cc}/flat/64.png`}
                        alt={langOption.name}
                        className="w-8 h-6 rounded mb-2"
                      />
                      <div className="text-[11px] font-bold uppercase tracking-wider">{langOption.name}</div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="max-w-4xl mx-auto py-4 space-y-8 text-center">
              <h2 className="text-2xl font-black uppercase tracking-tight">{t('wizard.achievementSource')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { id: 'hydra', label: t('settings.api.hydraApi'), desc: t('settings.api.hydraDescription'), icon: <HydraIcon className="text-3xl" /> },
                  { id: 'steam', label: t('settings.api.steamApi'), desc: t('settings.api.steamDescription'), icon: <SteamBrandIcon className="w-8 h-8" /> }
                ].map((api) => {
                  const selected = selectedApi === api.id;
                  return (
                    <button
                      key={api.id}
                      type="button"
                      onClick={() => setSelectedApi(api.id as ApiSource)}
                      className="rounded-lg border p-5 text-left transition-all"
                      style={{
                        borderColor: selected ? 'var(--text-main)' : 'var(--border-color)',
                        backgroundColor: selected ? 'var(--hover-bg)' : 'transparent',
                        opacity: selected ? 1 : 0.85
                      }}
                    >
                      <div className="flex items-center justify-between">
                        {api.icon}
                        {selected && <CheckIcon className="text-lg" />}
                      </div>
                      <h3 className="text-sm font-black uppercase tracking-wider mt-3">{api.label}</h3>
                      <p className="text-xs opacity-70 mt-2">{api.desc}</p>
                    </button>
                  );
                })}
              </div>

              {selectedApi === 'steam' && (
                <div className="max-w-2xl mx-auto space-y-4 text-left">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider opacity-70">{t('wizard.securityAccessKey')}</p>
                    <p className="text-[10px] opacity-60 mt-1">{t('wizard.localStorageOnly')}</p>
                  </div>
                  <div className="relative">
                    <input
                      type={showSteamKey ? 'text' : 'password'}
                      value={steamApiKey}
                      onChange={(e) => setSteamApiKey(e.target.value)}
                      placeholder={t('wizard.pasteApiKey')}
                      className="w-full h-11 rounded-md border px-3 pr-11 text-sm"
                      style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)' }}
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded"
                      onClick={() => setShowSteamKey((v) => !v)}
                    >
                      {showSteamKey ? <VisibilityOffIcon className="text-lg opacity-70" /> : <VisibilityIcon className="text-lg opacity-70" />}
                    </button>
                  </div>
                  <label className="flex items-center justify-between rounded-md border p-3" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--input-bg)' }}>
                    <span className="text-xs font-semibold">{t('wizard.enableSteamIntegration')}</span>
                    <button
                      type="button"
                      className={`w-10 h-5 rounded-full relative ${steamIntegrationEnabled ? 'bg-emerald-500' : 'bg-gray-500/40'}`}
                      onClick={() => setSteamIntegrationEnabled((v) => !v)}
                    >
                      <span className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${steamIntegrationEnabled ? 'left-6' : 'left-1'}`} />
                    </button>
                  </label>
                </div>
              )}
            </section>
          )}

          {step === 4 && (
            <section className="max-w-4xl mx-auto py-4 text-center">
              <h2 className="text-2xl font-black uppercase tracking-tight mb-8">{t('wizard.visualStyle')}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {themes.map((themeOption) => {
                  const selected = theme === themeOption.id;
                  return (
                    <button
                      key={themeOption.id}
                      type="button"
                      className="rounded-lg border p-3 text-left transition-all"
                      style={{
                        borderColor: selected ? 'var(--text-main)' : 'var(--border-color)',
                        backgroundColor: selected ? 'var(--hover-bg)' : 'transparent',
                        opacity: selected ? 1 : 0.85
                      }}
                      onClick={() => setTheme(themeOption.id)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-black uppercase tracking-wider">{themeOption.name}</span>
                        {selected && <CheckIcon className="text-lg" />}
                      </div>
                      <div className="h-10 rounded-md overflow-hidden flex">
                        {themeOption.preview.map((c) => (
                          <div key={`${themeOption.id}-${c}`} className="flex-1" style={{ backgroundColor: c }} />
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {step === 5 && (
            <section className="max-w-4xl mx-auto py-4 space-y-8 text-center">
              <h2 className="text-2xl font-black uppercase tracking-tight">{t('wizard.regionalFormats')}</h2>
              <div className="max-w-3xl mx-auto space-y-5 text-left">
                <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--input-bg)' }}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider opacity-70 mb-2">{t('wizard.datePreference')}</p>
                      <div className="grid grid-cols-3 gap-2">
                        {(['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'] as DateFormat[]).map((fmt) => (
                          <button
                            key={fmt}
                            type="button"
                            className="rounded-md border px-2 py-2 text-[10px] font-black tracking-wide text-center"
                            style={{
                              borderColor: dateFormat === fmt ? 'var(--text-main)' : 'var(--border-color)',
                              backgroundColor: dateFormat === fmt ? 'var(--text-main)' : 'transparent',
                              color: dateFormat === fmt ? 'var(--bg-color)' : 'var(--text-main)'
                            }}
                            onClick={() => setDateFormat(fmt)}
                          >
                            {dateExampleByFormat[fmt]}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider opacity-70 mb-2">{t('wizard.timeSystem')}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {(['24h', '12h'] as TimeFormat[]).map((fmt) => (
                          <button
                            key={fmt}
                            type="button"
                            className="rounded-md border px-2 py-2 text-[10px] font-black tracking-wide text-center"
                            style={{
                              borderColor: timeFormat === fmt ? 'var(--text-main)' : 'var(--border-color)',
                              backgroundColor: timeFormat === fmt ? 'var(--text-main)' : 'transparent',
                              color: timeFormat === fmt ? 'var(--bg-color)' : 'var(--text-main)'
                            }}
                            onClick={() => setTimeFormat(fmt)}
                          >
                            {timeExampleByFormat[fmt]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t flex items-center justify-between text-xs" style={{ borderColor: 'var(--border-color)' }}>
                    <span className="opacity-60">{sampleDate.toLocaleDateString(language, { year: 'numeric', month: '2-digit', day: '2-digit' })}</span>
                    <span className="font-semibold">
                      {sampleDate.toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit', hour12: timeFormat === '12h' })}
                    </span>
                  </div>
                </div>
              </div>

              {isLinux && (
                <div className="max-w-3xl mx-auto rounded-lg border p-4 text-left" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--input-bg)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <FolderIcon className="text-base opacity-70" />
                    <p className="text-[10px] font-black uppercase tracking-wider opacity-70">{t('wizard.winePrefixTitle')}</p>
                  </div>
                  <p className="text-xs opacity-70 mb-3">
                    {t('settings.monitored.winePrefixDescription')}
                  </p>
                  <input
                    value={winePrefixPath}
                    onChange={(e) => setWinePrefixPathLocal(e.target.value)}
                    placeholder={t('settings.monitored.winePrefixPlaceholder')}
                    className="w-full h-11 rounded-md border px-3 text-sm"
                    style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)' }}
                  />
                </div>
              )}
            </section>
          )}
        </div>
      </main>

      <footer className="mx-auto w-full max-w-5xl px-6 pb-8 pt-4 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={prevStep}
          disabled={step === 1}
          className="h-11 px-4 rounded-md border text-xs font-black uppercase tracking-wider disabled:opacity-40 flex items-center gap-2"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <ChevronLeftIcon className="text-base" />
          {t('wizard.goBack')}
        </button>

        {!isLastStep ? (
          <button
            type="button"
            onClick={nextStep}
            disabled={!canGoNext}
            className="h-11 px-5 rounded-md text-xs font-black uppercase tracking-wider flex items-center gap-2 disabled:opacity-40"
            style={{ backgroundColor: 'var(--text-main)', color: 'var(--bg-color)' }}
          >
            {t('wizard.continue')}
            <ArrowRightIcon className="text-base" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleFinish}
            disabled={isSaving}
            className="h-11 px-5 rounded-md text-xs font-black uppercase tracking-wider flex items-center gap-2 disabled:opacity-40"
            style={{ backgroundColor: 'var(--text-main)', color: 'var(--bg-color)' }}
          >
            {isSaving ? t('settings.monitored.savingPrefix') : t('wizard.completeSetup')}
            <CheckIcon className="text-base" />
          </button>
        )}
      </footer>
    </div>
  );
};

export default SetupWizard;
