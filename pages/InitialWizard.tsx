import React, { useState } from 'react';
import TitleBar from '../components/TitleBar';
import { useTheme, Theme } from '../contexts/ThemeContext';
import { DateFormat, TimeFormat, ApiSource } from '../types';
import { useI18n, Language } from '../contexts/I18nContext';
import { useMonitoredAchievements } from '../contexts/MonitoredAchievementsContext';
import { DEFAULT_PATHS } from '../constants';
import { CheckIcon, ArrowRightIcon, ChevronLeftIcon, SteamIcon, HydraIcon, VisibilityIcon, VisibilityOffIcon } from '../components/Icons';

// Sub-component for progress indication with enhanced animations
const WizardProgress: React.FC<{ currentStep: number; setStep: (step: number) => void }> = ({ currentStep, setStep }) => {
  const steps = [
        { id: 1, name: 'Welcome' },
        { id: 2, name: 'Language' },
        { id: 3, name: 'API' },
        { id: 4, name: 'Appearance' },
        { id: 5, name: 'Region' },
    ];

    const handleStepClick = (stepId: number) => {
        // Allow navigation only to steps that have been visited
        if (stepId < currentStep) {
            setStep(stepId);
        }
    };

    const progressPercentage = steps.length > 1 ? ((currentStep - 1) / (steps.length - 1)) * 100 : 0;

    return (
        <nav aria-label="Progress" className="w-full max-w-3xl">
            <div className="relative">
                {/* Background line with progress fill */}
                <div className="absolute top-4 left-4 right-4 h-0.5 bg-white/20" aria-hidden="true">
                    <div
                        className="h-full bg-white transition-all duration-500 ease-in-out"
                        style={{ width: `${progressPercentage}%` }}
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
                                    className={`
                                        relative flex flex-col items-center group focus:outline-none
                                        ${isClickable ? 'cursor-pointer' : 'cursor-default'}
                                    `}
                                    aria-current={isActive ? 'step' : undefined}
                                >
                                    <div className={`
                                        flex h-8 w-8 items-center justify-center rounded-lg border-2 transition-all duration-300 ease-in-out bg-black/50
                                        ${isActive ? 'scale-110 border-white animate-pulse-glow' : 'border-white/20'}
                                        ${isCompleted ? 'border-white bg-white' : ''}
                                        ${isClickable ? 'group-hover:border-white' : ''}
                                    `}>
                                        {isCompleted ? (
                                            <CheckIcon className="text-xl leading-none text-black" />
                                        ) : (
                                            <span className="text-sm font-bold text-white">{step.id}</span>
                                        )}
                                    </div>
                                    <span className={`
                                        absolute top-full mt-2 text-xs font-semibold whitespace-nowrap transition-colors
                                        ${isActive ? 'text-white' : 'text-gray-400'}
                                        ${isClickable ? 'group-hover:text-white' : ''}
                                    `}>
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


const SetupWizard: React.FC<{ onFinish: () => void }> = ({ onFinish }) => {
  const {
    theme, setTheme,
    dateFormat, setDateFormat,
    timeFormat, setTimeFormat
  } = useTheme();
  const { language, setLanguage } = useI18n();

  const hydraRecommendedLanguages = ['en-US', 'es-ES', 'ru-RU', 'pt-BR'];
  const isHydraRecommended = hydraRecommendedLanguages.includes(language);
  const isSteamRecommended = !isHydraRecommended;

  const [selectedApi, setSelectedApi] = useState<ApiSource>('hydra');
  const [steamApiKey, setSteamApiKey] = useState<string>('');
  const [showSteamKey, setShowSteamKey] = useState<boolean>(false);

  const [step, setStep] = useState(1);
  const totalSteps = 5;

  const nextStep = () => setStep(s => Math.min(s + 1, totalSteps));
  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  const handleFinish = async () => {
    const currentSettings = {
      language: language,
      theme: theme,
      dateFormat: dateFormat,
      timeFormat: timeFormat,
      selectedApi: selectedApi,
    };

    try {
      if ((window as any).electronAPI) {
        await (window as any).electronAPI.saveSettings(currentSettings);
      }
      console.log('Saving initial settings:', currentSettings);
    } catch (error) {
      console.error('Error saving initial settings:', error);
    }

    onFinish();
  };
  
  const ThemeCard: React.FC<{ id: Theme; label: string; }> = ({ id, label }) => {
    const isSelected = theme === id;
    const isLight = id === 'light';
    
    return (
      <div
        onClick={() => setTheme(id)}
        className={`group relative rounded-lg p-4 transition-colors duration-200 cursor-pointer ${
          isSelected ? 'bg-white/10' : 'bg-transparent hover:bg-white/5'
        }`}
        role="radio"
        aria-checked={isSelected}
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setTheme(id)}
      >
        <div className={`w-full h-32 rounded-md p-3 flex gap-2.5 transition-colors ${ isLight ? 'bg-gray-200' : 'bg-white/5' }`}>
            <div className={`w-1/4 rounded-sm ${ isLight ? 'bg-gray-300' : 'bg-white/10' }`}></div>
            <div className="flex-grow flex flex-col gap-2">
                <div className={`h-4 rounded-sm ${ isLight ? 'bg-gray-300' : 'bg-white/10' }`}></div>
                <div className={`h-4 w-3/4 rounded-sm ${ isLight ? 'bg-gray-300' : 'bg-white/10' }`}></div>
                <div className={`h-4 w-1/2 rounded-sm ${ isLight ? 'bg-gray-300' : 'bg-white/10' }`}></div>
            </div>
        </div>
        <div className="flex items-center justify-between mt-3">
          <h3 className="font-semibold text-white">{label}</h3>
          <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${isSelected ? 'border-white bg-white' : 'border-white/30'}`}>
            {isSelected && <CheckIcon className="text-sm text-black"/>}
          </div>
        </div>
      </div>
    );
  };

  const FormatCard: React.FC<{
    id: any;
    label: string;
    example?: string;
    previewContent?: React.ReactNode;
    isSelected: boolean;
    isRecommended?: boolean;
    onSelect: (id: any) => void;
  }> = ({ id, label, example, previewContent, isSelected, isRecommended, onSelect }) => (
    <div
        onClick={() => onSelect(id)}
        className={`group relative rounded-lg p-4 transition-colors duration-200 cursor-pointer flex flex-col ${!previewContent ? 'h-36' : ''} ${
            isSelected ? 'bg-white/10' : 'bg-transparent hover:bg-white/5'
        }`}
        role="radio" aria-checked={isSelected} tabIndex={0} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(id)}>

        <div className={`${previewContent ? 'aspect-[16/9] flex items-center justify-center' : 'flex-grow flex items-center justify-center'} bg-white/5 rounded-md overflow-hidden`}>
          {previewContent ? (
            previewContent
          ) : (
            example && <p className="text-2xl font-bold text-gray-100 tracking-wider font-mono">{example}</p>
          )}
        </div>

        <div className="flex items-center justify-between mt-3">
          <h3 className="font-semibold text-white">{label}</h3>
          <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${isSelected ? 'border-white bg-white' : 'border-white/30'}`}>
            {isSelected && <CheckIcon className="text-sm text-black"/>}
          </div>
        </div>
        {isRecommended && (
            <span className="absolute top-1 right-1 bg-green-500 text-white text-xs px-1 py-0.5 rounded-full font-medium z-20 shadow-sm">
                Recommended
            </span>
        )}
    </div>
  );

  const renderContent = () => {
    // Each step's content is wrapped to control its max-width and centering
    const contentWrapperClass = "w-full max-w-3xl animate-fade-in";
    switch (step) {
        case 1:
            return (
                <div className={`${contentWrapperClass} text-center`}>
                    <img src="https://i.imgur.com/AzgRNEo.png" alt="Project HAM Logo" className="w-32 h-32 mx-auto mb-6" />
                    <h1 className="text-4xl font-bold mb-3">Welcome to Project HAM</h1>
                    <p className="text-lg text-gray-300 max-w-xl mx-auto">
                        Your new companion for managing and exporting game achievements. Let's get you set up in just a few steps.
                    </p>
                </div>
            );
        case 2:
            return (
                 <section className={contentWrapperClass}>
                    <h2 className="text-2xl font-bold mb-8 text-center">Choose Your Language</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        <FormatCard
                            id="en-US"
                            label="English"
                            previewContent={<img src="https://flagcdn.com/w160/us.png" alt="USA Flag" className="w-full h-full object-cover contrast-200"/>}
                            isSelected={language === 'en-US'}
                            onSelect={setLanguage} />
                        <FormatCard
                            id="pt-BR"
                            label="Português"
                            previewContent={<img src="https://flagcdn.com/w160/br.png" alt="Brazil Flag" className="w-full h-full object-cover contrast-200"/>}
                            isSelected={language === 'pt-BR'}
                            onSelect={setLanguage} />
                        <FormatCard
                            id="fr-FR"
                            label="Français"
                            previewContent={<img src="https://flagcdn.com/w160/fr.png" alt="France Flag" className="w-full h-full object-cover contrast-200"/>}
                            isSelected={language === 'fr-FR'}
                            onSelect={setLanguage} />
                        <FormatCard
                            id="es-ES"
                            label="Español"
                            previewContent={<img src="https://flagcdn.com/w160/es.png" alt="Spain Flag" className="w-full h-full object-cover contrast-200"/>}
                            isSelected={language === 'es-ES'}
                            onSelect={setLanguage} />
                        <FormatCard
                            id="it-IT"
                            label="Italiano"
                            previewContent={<img src="https://flagcdn.com/w160/it.png" alt="Italy Flag" className="w-full h-full object-cover contrast-200"/>}
                            isSelected={language === 'it-IT'}
                            onSelect={setLanguage} />
                        <FormatCard
                            id="ru-RU"
                            label="Русский"
                            previewContent={<img src="https://flagcdn.com/w160/ru.png" alt="Russia Flag" className="w-full h-full object-cover contrast-200"/>}
                            isSelected={language === 'ru-RU'}
                            onSelect={setLanguage} />
                        <FormatCard
                            id="zh-CN"
                            label="中文"
                            previewContent={<img src="https://flagcdn.com/w160/cn.png" alt="China Flag" className="w-full h-full object-cover contrast-200"/>}
                            isSelected={language === 'zh-CN'}
                            onSelect={setLanguage} />
                        <FormatCard
                            id="ja-JP"
                            label="日本語"
                            previewContent={<img src="https://flagcdn.com/w160/jp.png" alt="Japan Flag" className="w-full h-full object-cover contrast-200"/>}
                            isSelected={language === 'ja-JP'}
                            onSelect={setLanguage} />
                        <FormatCard
                            id="pl-PL"
                            label="Polski"
                            previewContent={<img src="https://flagcdn.com/w160/pl.png" alt="Poland Flag" className="w-full h-full object-cover contrast-200"/>}
                            isSelected={language === 'pl-PL'}
                            onSelect={setLanguage} />
                        <FormatCard
                            id="uk-UA"
                            label="Українська"
                            previewContent={<img src="https://flagcdn.com/w160/ua.png" alt="Ukraine Flag" className="w-full h-full object-cover contrast-200"/>}
                            isSelected={language === 'uk-UA'}
                            onSelect={setLanguage} />
                    </div>
                </section>
            );
        case 3:
            return (
                 <section className={contentWrapperClass}>
                    <h2 className="text-2xl font-bold mb-8 text-center">Choose Your API</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-lg mx-auto">
                        <FormatCard
                            id="steam"
                            label="Steam API"
                            previewContent={<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Steam_icon_logo.svg/2048px-Steam_icon_logo.svg.png" alt="Steam API Logo" className="max-w-[80%] max-h-[80%] mx-auto object-contain" />}
                            isSelected={selectedApi === 'steam'}
                            isRecommended={isSteamRecommended}
                            onSelect={setSelectedApi} />
                        <FormatCard
                            id="hydra"
                            label="Hydra API"
                            previewContent={<img src="https://cdn2.steamgriddb.com/icon/0adbfc15ded7e9d183c206ecf5681b15.ico" alt="Hydra API Logo" className="w-full h-full object-contain" />}
                            isSelected={selectedApi === 'hydra'}
                            isRecommended={isHydraRecommended}
                            onSelect={setSelectedApi} />
                    </div>
                    {selectedApi === 'steam' && (
                        <div className="mt-4">
                            <label htmlFor="steam-api-key" className="block text-sm font-medium text-white mb-1">
                                Steam API Key
                            </label>
                            <div className="relative">
                                <input
                                    type={showSteamKey ? 'text' : 'password'}
                                    id="steam-api-key"
                                    value={steamApiKey}
                                    onChange={(e) => setSteamApiKey(e.target.value)}
                                    placeholder="Enter your Steam API key"
                                    className="w-full rounded-md px-3 py-2 pr-10 text-white bg-black/50 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowSteamKey(!showSteamKey)}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700"
                                >
                                    {showSteamKey ? <VisibilityOffIcon className="h-5 w-5" /> : <VisibilityIcon className="h-5 w-5" />}
                                </button>
                            </div>
                        </div>
                    )}
                </section>
            );
        case 4:
            return (
                <section className={contentWrapperClass}>
                    <h2 className="text-2xl font-bold mb-6 text-center">Choose Your Look</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-lg mx-auto">
                        <ThemeCard id="light" label="Light Mode" />
                        <ThemeCard id="dark" label="Dark Mode" />
                    </div>
                </section>
            );
        case 5:
            return (
                <section className={contentWrapperClass}>
                    <div className="space-y-8">
                        <div>
                            <h3 className="font-semibold mb-4 text-center text-gray-200">Date Format</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <FormatCard id="MM/DD/YYYY" label="Month / Day / Year" example="12/31/2024" isSelected={dateFormat === 'MM/DD/YYYY'} onSelect={setDateFormat} />
                                <FormatCard id="DD/MM/YYYY" label="Day / Month / Year" example="31/12/2024" isSelected={dateFormat === 'DD/MM/YYYY'} onSelect={setDateFormat} />
                                <FormatCard id="YYYY-MM-DD" label="Year - Month - Day" example="2024-12-31" isSelected={dateFormat === 'YYYY-MM-DD'} onSelect={setDateFormat} />
                            </div>
                        </div>
                        <div>
                            <h3 className="font-semibold mb-4 text-center text-gray-200">Time Format</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-sm mx-auto">
                                <FormatCard id="12h" label="12-Hour" example="11:59 PM" isSelected={timeFormat === '12h'} onSelect={setTimeFormat} />
                                <FormatCard id="24h" label="24-Hour" example="23:59" isSelected={timeFormat === '24h'} onSelect={setTimeFormat} />
                            </div>
                        </div>
                    </div>
                </section>
            );
        default: return null;
    }
  };

  return (
    <div 
      className="relative w-screen h-screen bg-cover bg-center text-white flex flex-col pt-10"
      style={{ backgroundImage: 'url(https://i.imgur.com/HVKmcY1.jpeg)' }}
    >
      <TitleBar />
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      
      <header className="relative z-10 flex-shrink-0 flex items-center justify-center h-28 w-full px-8">
        <WizardProgress currentStep={step} setStep={setStep} />
      </header>
      
      <main className="relative z-10 flex-grow w-full flex flex-col items-center justify-between p-8 overflow-y-auto">
          <div className="flex-grow w-full flex items-center justify-center">
            {renderContent()}
          </div>
          
          <footer className="flex-shrink-0 flex justify-between items-center w-full max-w-3xl pt-8">
              <div>
                  {step > 1 && (
                      <button
                          onClick={prevStep}
                          className="flex items-center gap-2 px-5 py-2 rounded-lg font-semibold bg-transparent hover:bg-white/10 text-gray-200 transition-colors"
                      >
                          <ChevronLeftIcon className="text-xl" />
                          <span>Back</span>
                      </button>
                  )}
              </div>
              <div className="w-48">
              {step === 1 && (
                  <button
                      onClick={nextStep}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold bg-white hover:bg-gray-200 text-black transition-colors shadow-lg"
                  >
                      <span>Get Started</span>
                      <ArrowRightIcon className="text-xl" />
                  </button>
              )}
              {step > 1 && step < totalSteps && (
                  <button
                      onClick={nextStep}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold bg-white hover:bg-gray-200 text-black transition-colors shadow-lg"
                  >
                      <span>Next</span>
                      <ArrowRightIcon className="text-xl" />
                  </button>
              )}
              {step === totalSteps && (
                  <button
                      onClick={handleFinish}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold bg-green-600 hover:bg-green-700 text-white transition-colors shadow-lg shadow-green-600/20"
                  >
                      <span>Finish Setup</span>
                      <CheckIcon className="text-xl" />
                  </button>
              )}
              </div>
          </footer>
      </main>
    </div>
  );
};

export default SetupWizard;