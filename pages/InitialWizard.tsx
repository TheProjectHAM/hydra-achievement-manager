import React, { useState } from 'react';
import TitleBar from '../components/TitleBar';
import { useTheme, Theme } from '../contexts/ThemeContext';
import { DateFormat, TimeFormat, ApiSource } from '../types';
import { useI18n, Language } from '../contexts/I18nContext';
import { CheckIcon, ArrowRightIcon, ChevronLeftIcon, VisibilityIcon, VisibilityOffIcon, SteamIcon, HydraIcon } from '../components/Icons';
import { saveSettings } from '../tauri-api';
import appLogo from '../assets/icon.png';

// Sub-component for palette preview
const PalettePreview: React.FC<{ colors: string[] }> = ({ colors }) => (
    <div className="flex -space-x-2">
        {colors.map((color, i) => (
            <div
                key={i}
                className="w-5 h-5 rounded-full border-2 border-[var(--bg-color)] shadow-sm"
                style={{ backgroundColor: color, zIndex: 5 - i }}
            />
        ))}
    </div>
);

// Sub-component for progress indication
const WizardProgress: React.FC<{ currentStep: number; setStep: (step: number) => void }> = ({ currentStep, setStep }) => {
    const { t } = useI18n();
    const steps = [
        { id: 1, name: t('wizard.steps.welcome') },
        { id: 2, name: t('wizard.steps.language') },
        { id: 3, name: t('wizard.steps.api') },
        { id: 4, name: t('wizard.steps.appearance') },
        { id: 5, name: t('wizard.steps.region') },
    ];

    const handleStepClick = (stepId: number) => {
        if (stepId < currentStep) {
            setStep(stepId);
        }
    };

    const progressPercentage = steps.length > 1 ? ((currentStep - 1) / (steps.length - 1)) * 100 : 0;

    return (
        <nav aria-label="Progress" className="w-full max-w-2xl px-4">
            <div className="relative">
                <div className="absolute top-4 left-4 right-4 h-0.5" style={{ backgroundColor: 'var(--border-color)', opacity: 0.3 }}>
                    <div
                        className="h-full transition-all duration-500 ease-in-out"
                        style={{ width: `${progressPercentage}%`, backgroundColor: 'var(--text-main)' }}
                    />
                </div>

                <ol role="list" className="flex items-center justify-between">
                    {steps.map((step) => {
                        const isCompleted = currentStep > step.id;
                        const isActive = currentStep === step.id;
                        const isClickable = step.id < currentStep;

                        return (
                            <li key={step.name} className="relative z-10">
                                <button
                                    onClick={() => handleStepClick(step.id)}
                                    disabled={!isClickable}
                                    className={`relative flex flex-col items-center group outline-none ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
                                    aria-current={isActive ? 'step' : undefined}
                                >
                                    <div className={`
                    flex h-8 w-8 items-center justify-center rounded-lg border-2 transition-all duration-300
                    ${isActive ? 'scale-110 shadow-lg' : ''}
                  `} style={{
                                            backgroundColor: isCompleted ? 'var(--text-main)' : 'var(--bg-color)',
                                            borderColor: (isActive || isCompleted) ? 'var(--text-main)' : 'var(--border-color)'
                                        }}>
                                        {isCompleted ? (
                                            <CheckIcon className="text-sm" style={{ color: 'var(--bg-color)' }} />
                                        ) : (
                                            <span className="text-[10px] font-black" style={{ color: isActive ? 'var(--text-main)' : 'var(--text-muted)' }}>{step.id}</span>
                                        )}
                                    </div>
                                    <span className={`absolute top-full mt-2 text-[8px] font-black uppercase tracking-[0.2em] transition-colors ${isActive ? 'opacity-100' : 'opacity-40'}`} style={{ color: 'var(--text-main)' }}>
                                        {step.name}
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ol>
            </div>
        </nav>
    );
};

const ThemeCard: React.FC<{
    themeOption: { id: Theme; name: string; palette: string[] };
    isSelected: boolean;
    onSelect: (id: Theme) => void;
}> = ({ themeOption, isSelected, onSelect }) => {
    return (
        <div
            onClick={() => onSelect(themeOption.id)}
            className={`group relative rounded-xl p-5 border-2 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-xl ${isSelected ? 'scale-105' : 'hover:scale-[1.02]'}`}
            style={{
                backgroundColor: 'var(--card-bg)',
                borderColor: isSelected ? 'var(--text-main)' : 'var(--border-color)',
            }}
        >
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--text-main)' }}>{themeOption.name}</h3>
                    {isSelected && <CheckIcon className="text-xs" style={{ color: 'var(--text-main)' }} />}
                </div>
                <div className="h-24 w-full rounded-md p-3 flex flex-col gap-2 shadow-inner transition-colors duration-500" style={{ backgroundColor: themeOption.palette[0] }}>
                    <div className="w-1/2 h-3 rounded-full" style={{ backgroundColor: themeOption.palette[2], opacity: 0.2 }} />
                    <div className="w-full h-3 rounded-full" style={{ backgroundColor: themeOption.palette[2], opacity: 0.1 }} />
                    <div className="w-3/4 h-3 rounded-full" style={{ backgroundColor: themeOption.palette[2], opacity: 0.1 }} />
                    <div className="mt-auto flex justify-end">
                        <PalettePreview colors={themeOption.palette} />
                    </div>
                </div>
            </div>
        </div>
    );
};

const SetupWizard: React.FC<{ onFinish: () => void }> = ({ onFinish }) => {
    const {
        theme, setTheme,
        dateFormat, setDateFormat,
        timeFormat, setTimeFormat
    } = useTheme();
    const { language, setLanguage, t } = useI18n();

    const [selectedApi, setSelectedApi] = useState<ApiSource>('hydra');
    const [steamApiKey, setSteamApiKey] = useState<string>('');
    const [showSteamKey, setShowSteamKey] = useState<boolean>(false);
    const [step, setStep] = useState(1);
    const totalSteps = 5;

    const THEMES: { id: Theme; name: string; palette: string[] }[] = [
        { id: 'light', name: t('settings.appearance.lightTheme'), palette: ['#f0f2f5', '#edf1f4', '#1e293b'] },
        { id: 'dark', name: t('settings.appearance.darkTheme'), palette: ['#0a0a0b', '#1a1a1b', '#ffffff'] },
        { id: 'nord', name: t('settings.appearance.nordTheme'), palette: ['#2e3440', '#3b4252', '#88c0d0'] },
        { id: 'gruvbox', name: t('settings.appearance.gruvboxTheme'), palette: ['#282828', '#3c3836', '#fb4934'] },
        { id: 'tokyo-night', name: t('settings.appearance.tokyoNightTheme'), palette: ['#1a1b26', '#24283b', '#7aa2f7'] },
        { id: 'everforest', name: t('settings.appearance.everforestTheme'), palette: ['#2d353b', '#343f44', '#a7c080'] },
        { id: 'dracula', name: t('settings.appearance.draculaTheme'), palette: ['#282a36', '#44475a', '#bd93f9'] },
        { id: 'retrowave', name: t('settings.appearance.retrowaveTheme'), palette: ['#140522', '#24103d', '#d746ff'] },
        { id: 'github-dark', name: t('settings.appearance.githubDarkTheme'), palette: ['#0d1117', '#161b22', '#58a6ff'] },
        { id: 'solarized-dark', name: t('settings.appearance.solarizedDarkTheme'), palette: ['#002b36', '#073642', '#268bd2'] },
        { id: 'one-dark', name: t('settings.appearance.oneDarkTheme'), palette: ['#282c34', '#353b45', '#61afef'] },
    ];

    const nextStep = () => setStep(s => Math.min(s + 1, totalSteps));
    const prevStep = () => setStep(s => Math.max(s - 1, 1));



    const handleFinish = async () => {
        const currentSettings = {
            language,
            theme,
            dateFormat,
            timeFormat,
            selectedApi,
            steamApiKey,
            steamIntegrationEnabled: false, // Default to disabled
            wizardCompleted: true
        };
        try {
            await saveSettings(currentSettings);
        } catch (error) {
            console.error('Error saving initial settings:', error);
        }
        onFinish();
    };

    const LanguageCard: React.FC<{ id: Language; name: string; countryCode: string }> = ({ id, name, countryCode }) => {
        const isSelected = language === id;
        return (
            <div
                onClick={() => setLanguage(id)}
                className={`group relative rounded-xl p-4 border-2 transition-all duration-200 cursor-pointer ${isSelected ? 'scale-105 shadow-xl' : 'hover:scale-[1.02]'}`}
                style={{
                    backgroundColor: 'var(--card-bg)',
                    borderColor: isSelected ? 'var(--text-main)' : 'var(--border-color)',
                }}
            >
                <div className="flex flex-col items-center gap-4 text-center">
                    <div className="w-16 h-10 rounded-md overflow-hidden shadow-lg border border-black/10">
                        <img src={`${import.meta.env.VITE_FLAGS_API_URL || 'https://flagsapi.com'}/${countryCode}/flat/64.png`} className="w-full h-full object-cover" alt={name} />
                    </div>
                    <h3 className="text-[10px] font-black uppercase tracking-widest leading-tight" style={{ color: 'var(--text-main)' }}>{name}</h3>
                    <div className={`w-4 h-4 rounded-full border-2 transition-all flex items-center justify-center ${isSelected ? 'bg-[var(--text-main)]' : 'bg-transparent'}`} style={{ borderColor: 'var(--text-main)' }}>
                        {isSelected && <CheckIcon className="text-[8px]" style={{ color: 'var(--bg-color)' }} />}
                    </div>
                </div>
            </div>
        );
    };

    const FormatCard: React.FC<{ id: any; label: string; example: string; isSelected: boolean; onSelect: (id: any) => void }> = ({ id, label, example, isSelected, onSelect }) => (
        <div
            onClick={() => onSelect(id)}
            className={`group relative rounded-xl p-6 border-2 transition-all duration-200 cursor-pointer shadow-sm ${isSelected ? 'scale-105 shadow-xl' : 'hover:scale-[1.02]'}`}
            style={{
                backgroundColor: 'var(--card-bg)',
                borderColor: isSelected ? 'var(--text-main)' : 'var(--border-color)',
            }}
        >
            <div className="flex flex-col items-center gap-3 text-center">
                <span className="text-[9px] font-black uppercase tracking-[0.25em] opacity-40" style={{ color: 'var(--text-main)' }}>{label}</span>
                <span className="text-xl font-black uppercase tracking-tighter" style={{ color: 'var(--text-main)' }}>{example}</span>
                <div className={`w-1.5 h-1.5 rounded-full transition-all mt-1 ${isSelected ? 'scale-150' : 'opacity-0'}`} style={{ backgroundColor: 'var(--text-main)' }} />
            </div>
        </div>
    );

    const renderContent = () => {
        const containerClass = "w-full max-w-4xl animate-fade-in px-4";
        switch (step) {
            case 1:
                return (
                    <div className={`${containerClass} text-center space-y-12`}>
                        <div className="relative inline-block">
                            <img src={appLogo} alt="Logo" className="relative w-48 h-48 mx-auto hover:scale-105 transition-transform duration-500" />
                        </div>
                        <div className="space-y-6">
                            <h1 className="text-6xl font-black uppercase tracking-tight leading-none" style={{ color: 'var(--text-main)' }}>
                                {t('wizard.welcomeTitle')}
                            </h1>
                            <p className="text-base font-medium opacity-60 max-w-xl mx-auto leading-relaxed" style={{ color: 'var(--text-main)' }}>
                                {t('wizard.welcomeDesc')}
                            </p>
                        </div>
                    </div>
                );
            case 2:
                return (
                    <section className={containerClass}>
                        <div className="text-center mb-10 space-y-2">
                            <h2 className="text-[10px] font-black uppercase tracking-[0.5em] opacity-40" style={{ color: 'var(--text-main)' }}>Step 02</h2>
                            <h1 className="text-3xl font-black uppercase tracking-tight" style={{ color: 'var(--text-main)' }}>{t('wizard.selectLanguage')}</h1>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                            {[
                                { id: 'en-US', name: 'English', cc: 'US' },
                                { id: 'pt-BR', name: 'Português', cc: 'BR' },
                                { id: 'fr-FR', name: 'Français', cc: 'FR' },
                                { id: 'es-ES', name: 'Español', cc: 'ES' },
                                { id: 'it-IT', name: 'Italiano', cc: 'IT' },
                                { id: 'ru-RU', name: 'Русский', cc: 'RU' },
                                { id: 'zh-CN', name: '中文', cc: 'CN' },
                                { id: 'ja-JP', name: '日本語', cc: 'JP' },
                                { id: 'pl-PL', name: 'Polski', cc: 'PL' },
                                { id: 'uk-UA', name: 'Українська', cc: 'UA' },
                            ].map(l => (
                                <LanguageCard key={l.id} id={l.id as Language} name={l.name} countryCode={l.cc} />
                            ))}
                        </div>
                    </section>
                );
            case 3:
                return (
                    <section className={containerClass}>
                        <div className="text-center mb-10 space-y-2">
                            <h2 className="text-[10px] font-black uppercase tracking-[0.5em] opacity-40" style={{ color: 'var(--text-main)' }}>Step 03</h2>
                            <h1 className="text-3xl font-black uppercase tracking-tight" style={{ color: 'var(--text-main)' }}>{t('wizard.achievementSource')}</h1>
                        </div>
                        <div className="grid grid-cols-2 gap-5 max-w-3xl mx-auto">
                            {[
                                { id: 'hydra', label: t('settings.api.hydraApi'), desc: t('settings.api.hydraDescription'), icon: <HydraIcon className="text-4xl" /> },
                                { id: 'steam', label: t('settings.api.steamApi'), desc: t('settings.api.steamDescription'), icon: <SteamIcon className="text-4xl" /> }
                            ].map(api => {
                                const isSelected = selectedApi === api.id;
                                return (
                                    <div
                                        key={api.id}
                                        onClick={() => setSelectedApi(api.id as ApiSource)}
                                        className={`relative p-6 rounded-2xl border-2 transition-all duration-200 cursor-pointer group flex flex-col items-center text-center ${isSelected ? 'scale-[1.03] shadow-xl' : 'hover:scale-[1.01] hover:bg-white/5 opacity-60 hover:opacity-100'}`}
                                        style={{
                                            backgroundColor: isSelected ? 'var(--text-main)' : 'var(--card-bg)',
                                            borderColor: isSelected ? 'var(--text-main)' : 'var(--border-color)',
                                            color: isSelected ? 'var(--bg-color)' : 'var(--text-main)',
                                        }}
                                    >
                                        <div className={`mb-4 w-16 h-16 rounded-xl flex items-center justify-center transition-all ${isSelected ? 'bg-white/20' : 'bg-[var(--hover-bg)]'}`}>
                                            {api.icon}
                                        </div>
                                        <h3 className="text-xl font-black uppercase tracking-tight mb-2">{api.label}</h3>
                                        <p className={`text-[10px] font-medium leading-relaxed ${isSelected ? 'opacity-80' : 'opacity-40'}`}>{api.desc}</p>

                                        <div className={`absolute top-4 right-4 w-6 h-6 rounded-full border-2 flex items-center justify-center ${isSelected ? 'bg-white border-white' : 'border-[var(--border-color)] opacity-20'}`}>
                                            <CheckIcon className={`text-sm ${isSelected ? 'text-[var(--text-main)]' : 'text-transparent'}`} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {selectedApi === 'steam' && (
                            <div className="mt-10 max-w-xl mx-auto space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="flex items-center justify-between px-4">
                                    <label className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">{t('wizard.securityAccessKey')}</label>
                                    <span className="text-[9px] font-bold opacity-30 italic">{t('wizard.localStorageOnly')}</span>
                                </div>
                                <div className="relative">
                                    <input
                                        type={showSteamKey ? 'text' : 'password'}
                                        value={steamApiKey}
                                        onChange={(e) => setSteamApiKey(e.target.value)}
                                        placeholder={t('wizard.pasteApiKey')}
                                        className="w-full h-14 rounded-xl px-6 border-2 border-transparent outline-none transition-all shadow-inner font-mono text-base tracking-[0.1em] focus:border-[var(--text-main)]"
                                        style={{ backgroundColor: 'var(--input-bg)', color: 'var(--text-main)' }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowSteamKey(!showSteamKey)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 p-2 hover:bg-white/5 rounded-lg transition-all"
                                    >
                                        {showSteamKey ? <VisibilityOffIcon className="text-xl opacity-40" /> : <VisibilityIcon className="text-xl opacity-40" />}
                                    </button>
                                </div>
                            </div>
                        )}
                    </section>
                );
            case 4:
                return (
                    <section className={containerClass}>
                        <div className="text-center mb-10 space-y-2">
                            <h2 className="text-[10px] font-black uppercase tracking-[0.5em] opacity-40" style={{ color: 'var(--text-main)' }}>Step 04</h2>
                            <h1 className="text-3xl font-black uppercase tracking-tight" style={{ color: 'var(--text-main)' }}>{t('wizard.visualStyle')}</h1>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {THEMES.map(t => (
                                <ThemeCard
                                    key={t.id}
                                    themeOption={t}
                                    isSelected={theme === t.id}
                                    onSelect={setTheme}
                                />
                            ))}
                        </div>
                    </section>
                );
            case 5:
                return (
                    <section className={containerClass}>
                        <div className="text-center mb-10 space-y-2">
                            <h2 className="text-[10px] font-black uppercase tracking-[0.5em] opacity-40" style={{ color: 'var(--text-main)' }}>Step 05</h2>
                            <h1 className="text-3xl font-black uppercase tracking-tight" style={{ color: 'var(--text-main)' }}>{t('wizard.regionalFormats')}</h1>
                        </div>
                        <div className="space-y-12">
                            <div>
                                <h4 className="text-[10px] font-black uppercase tracking-[0.3em] opacity-30 text-center mb-6" style={{ color: 'var(--text-main)' }}>{t('wizard.datePreference')}</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
                                    <FormatCard id="DD/MM/YYYY" label="Standard" example="31/12/2026" isSelected={dateFormat === 'DD/MM/YYYY'} onSelect={setDateFormat} />
                                    <FormatCard id="MM/DD/YYYY" label="US Common" example="12/31/2026" isSelected={dateFormat === 'MM/DD/YYYY'} onSelect={setDateFormat} />
                                    <FormatCard id="YYYY-MM-DD" label="ISO Format" example="2026-12-31" isSelected={dateFormat === 'YYYY-MM-DD'} onSelect={setDateFormat} />
                                </div>
                            </div>
                            <div>
                                <h4 className="text-[10px] font-black uppercase tracking-[0.3em] opacity-30 text-center mb-6" style={{ color: 'var(--text-main)' }}>{t('wizard.timeSystem')}</h4>
                                <div className="grid grid-cols-2 gap-6 max-w-md mx-auto">
                                    <FormatCard id="24h" label="Military" example="23:59" isSelected={timeFormat === '24h'} onSelect={setTimeFormat} />
                                    <FormatCard id="12h" label="Standard" example="11:59 PM" isSelected={timeFormat === '12h'} onSelect={setTimeFormat} />
                                </div>
                            </div>
                        </div>
                    </section>
                );
            default: return null;
        }
    };

    return (
        <div className="w-screen h-screen overflow-hidden flex flex-col transition-colors duration-700 relative" style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-main)' }}>
            <TitleBar />

            <header className="relative z-10 flex-shrink-0 flex items-center justify-center pt-8 pb-8 w-full px-8">
                <WizardProgress currentStep={step} setStep={setStep} />
            </header>

            <main className="relative z-10 flex-grow w-full flex flex-col items-center px-8 pb-12 overflow-y-auto no-scrollbar">
                <div className="flex-grow w-full flex items-center justify-center min-h-[400px] py-10">
                    {renderContent()}
                </div>

                {/* Fixed Navigation Area (No Footer Style) */}
                <div className={`w-full max-w-4xl flex items-center gap-6 py-6 mt-auto ${step === 1 ? 'justify-center' : 'justify-between'}`}>
                    {step > 1 && (
                        <div className="flex-1">
                            <button
                                onClick={prevStep}
                                className="flex items-center gap-3 px-0 h-12 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all group"
                                style={{ color: 'var(--text-muted)' }}
                            >
                                <div className="w-8 h-8 rounded-full border border-current flex items-center justify-center group-hover:bg-[var(--text-muted)] group-hover:text-[var(--bg-color)] transition-all">
                                    <ChevronLeftIcon className="text-lg" />
                                </div>
                                <span className="group-hover:text-[var(--text-main)] transition-colors">{t('wizard.goBack')}</span>
                            </button>
                        </div>
                    )}
                    <div className="flex items-center gap-4">
                        {step < totalSteps ? (
                            <button
                                onClick={nextStep}
                                className="flex items-center justify-center gap-4 px-12 h-14 rounded-xl text-[11px] font-black uppercase tracking-[0.25em] transition-all shadow-2xl hover:scale-105 active:scale-95 group"
                                style={{ backgroundColor: 'var(--text-main)', color: 'var(--bg-color)' }}
                            >
                                <span>{t('wizard.continue')}</span>
                                <ArrowRightIcon className="text-xl group-hover:translate-x-1 transition-transform" />
                            </button>
                        ) : (
                            <button
                                onClick={handleFinish}
                                className="flex items-center justify-center gap-4 px-12 h-14 rounded-xl text-[11px] font-black uppercase tracking-[0.25em] transition-all shadow-2xl hover:scale-105 active:scale-95 group"
                                style={{ backgroundColor: 'var(--text-main)', color: 'var(--bg-color)' }}
                            >
                                <span>{t('wizard.completeSetup')}</span>
                                <CheckIcon className="text-xl group-hover:scale-110 transition-transform" />
                            </button>
                        )}
                    </div>
                </div>
            </main>

            {/* Cat GIF in bottom right */}
            <div className="fixed bottom-0 right-4 z-50 pointer-events-none">
                <img
                    src={import.meta.env.VITE_CAT_GIF_URL || "https://media.tenor.com/qdNjqLmr-c8AAAAi/caily-catdogcaily.gif"}
                    alt="Caily Cat"
                    className="w-40 h-auto"
                    style={{ filter: 'drop-shadow(0 10px 15px rgba(0,0,0,0.3))' }}
                />
            </div>
        </div>
    );
};

export default SetupWizard;
