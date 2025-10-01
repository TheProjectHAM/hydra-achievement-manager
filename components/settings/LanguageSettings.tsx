import React, { useState } from 'react';
import { CheckIcon, BrazilFlagIcon, UsaFlagIcon, FranceFlagIcon, ItalyFlagIcon, ChinaFlagIcon, JapanFlagIcon, RussiaFlagIcon, UkraineFlagIcon, PolandFlagIcon, SpainFlagIcon } from '../Icons';
import { DateFormat, TimeFormat } from '../../types';
import { useI18n, Language } from '../../contexts/I18nContext';

interface LocaleSettingsProps {
  selectedLanguage: Language;
  setSelectedLanguage: (language: Language) => void;
  selectedDateFormat: DateFormat;
  setSelectedDateFormat: (format: DateFormat) => void;
  selectedTimeFormat: TimeFormat;
  setSelectedTimeFormat: (format: TimeFormat) => void;
}

const CustomDropdown: React.FC<{
  options: typeof LANGUAGES;
  selected: Language;
  onSelect: (lang: Language) => void;
}> = ({ options, selected, onSelect }) => {
  const [open, setOpen] = useState(false);
  const selectedObj = options.find(o => o.id === selected);
  return (
    <div className="relative w-full">
      <button
        className="w-full bg-gray-100 dark:bg-white/5 rounded-lg px-4 py-3 flex items-center justify-between cursor-pointer border border-gray-200 dark:border-white/10 shadow-sm"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <span className="w-8 h-6 rounded-sm overflow-hidden border border-black/10 flex-shrink-0">{selectedObj && React.cloneElement(selectedObj.flag, { className: 'w-full h-full object-cover' })}</span>
          <span className="font-semibold text-gray-900 dark:text-white truncate">{selectedObj?.name}</span>
        </span>
        <span className="ml-2 text-gray-500">▼</span>
      </button>
      {open && (
        <ul className="absolute z-10 mt-2 w-full bg-neutral-800 dark:bg-neutral-900 rounded-lg shadow-lg border border-neutral-700 dark:border-neutral-900 max-h-64 overflow-auto">
          {options.map(opt => (
            <li
              key={opt.id}
              className={`flex items-center gap-2 px-4 py-2 cursor-pointer hover:bg-gray-200 dark:hover:bg-white/10 ${selected === opt.id ? 'bg-gray-200 dark:bg-white/10' : ''}`}
              onClick={() => { onSelect(opt.id); setOpen(false); }}
              role="option"
              aria-selected={selected === opt.id}
            >
              <span className="w-8 h-6 rounded-sm overflow-hidden border border-black/10 flex-shrink-0">{React.cloneElement(opt.flag, { className: 'w-full h-full object-cover' })}</span>
              <span className="font-semibold text-gray-900 dark:text-white truncate">{opt.name}</span>
              {selected === opt.id && <CheckIcon className="ml-auto text-green-500" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const LANGUAGES: { id: Language; name: string; flag: React.ReactElement<{ className?: string }> }[] = [
  { id: 'en-US', name: 'English (US)', flag: <UsaFlagIcon /> },
  { id: 'pt-BR', name: 'Português (BR)', flag: <BrazilFlagIcon /> },
  { id: 'fr-FR', name: 'Français', flag: <FranceFlagIcon /> },
  { id: 'it-IT', name: 'Italiano', flag: <ItalyFlagIcon /> },
  { id: 'zh-CN', name: '中文 (简体)', flag: <ChinaFlagIcon /> },
  { id: 'ja-JP', name: '日本語', flag: <JapanFlagIcon /> },
  { id: 'ru-RU', name: 'Русский', flag: <RussiaFlagIcon /> },
  { id: 'uk-UA', name: 'Українська', flag: <UkraineFlagIcon /> },
  { id: 'pl-PL', name: 'Polski', flag: <PolandFlagIcon /> },
  { id: 'es-ES', name: 'Español', flag: <SpainFlagIcon /> },
];

const SettingOptionCard: React.FC<{
  id: string;
  isSelected: boolean;
  onClick: (id: any) => void;
  children: React.ReactNode;
  topRightContent?: React.ReactNode;
}> = ({ id, isSelected, onClick, children, topRightContent }) => (
  <div
    onClick={() => onClick(id)}
    className={`relative rounded-lg p-4 transition-all cursor-pointer flex flex-col gap-2
      ${isSelected
        ? 'bg-gray-200 dark:bg-white/10 shadow-sm'
        : 'bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10'
      }`}
    role="radio"
    aria-checked={isSelected}
    tabIndex={0}
    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick(id)}
  >
    {topRightContent}
    {children}
  </div>
);

const LocaleSettings: React.FC<LocaleSettingsProps> = ({ 
  selectedLanguage, setSelectedLanguage,
  selectedDateFormat, setSelectedDateFormat,
  selectedTimeFormat, setSelectedTimeFormat,
}) => {
  const { t } = useI18n();

  const DATE_FORMATS: { id: DateFormat; labelKey: string }[] = [
    { id: 'DD/MM/YYYY', labelKey: 'settings.language.dateFormatDDMMYYYY' },
    { id: 'MM/DD/YYYY', labelKey: 'settings.language.dateFormatMMDDYYYY' },
    { id: 'YYYY-MM-DD', labelKey: 'settings.language.dateFormatYYYYMMDD' },
  ];

  const TIME_FORMATS: { id: TimeFormat; labelKey: string }[] = [
    { id: '24h', labelKey: 'settings.language.timeFormat24' },
    { id: '12h', labelKey: 'settings.language.timeFormat12' },
  ];

  const getFormattedDateExample = (format: DateFormat): string => {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    switch (format) {
      case 'DD/MM/YYYY': return `${day}/${month}/${year}`;
      case 'MM/DD/YYYY': return `${month}/${day}/${year}`;
      case 'YYYY-MM-DD': return `${year}-${month}-${day}`;
      default: return '';
    }
  };

  const getFormattedTimeExample = (format: TimeFormat): string => {
    const d = new Date();
    const hour24 = d.getHours();
    const minute = String(d.getMinutes()).padStart(2, '0');
    if (format === '24h') {
      return `${String(hour24).padStart(2, '0')}:${minute}`;
    } else {
      const hour12 = hour24 % 12 || 12;
      const ampm = hour24 >= 12 ? 'PM' : 'AM';
      return `${hour12}:${minute} ${ampm}`;
    }
  };

  return (
    <div>
      {/* Language selection dropdown */}
      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 whitespace-nowrap">{t('settings.language.language')}</h3>
      <CustomDropdown options={LANGUAGES} selected={selectedLanguage} onSelect={setSelectedLanguage} />

      {/* Date format selection */}
      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 mt-8">{t('settings.language.dateFormat')}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {DATE_FORMATS.map((format) => (
          <SettingOptionCard key={format.id} id={format.id} isSelected={selectedDateFormat === format.id} onClick={setSelectedDateFormat}>
            <div className="flex justify-between items-center w-full">
              <p className="font-semibold text-gray-900 dark:text-white">{t(format.labelKey)}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('settings.language.example')} {getFormattedDateExample(format.id)}</p>
            </div>
          </SettingOptionCard>
        ))}
      </div>

      {/* Time format selection */}
      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 mt-8">{t('settings.language.timeFormat')}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {TIME_FORMATS.map((format) => (
          <SettingOptionCard key={format.id} id={format.id} isSelected={selectedTimeFormat === format.id} onClick={setSelectedTimeFormat}>
            <div className="flex justify-between items-center w-full">
              <p className="font-semibold text-gray-900 dark:text-white">{t(format.labelKey)}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('settings.language.example')} {getFormattedTimeExample(format.id)}</p>
            </div>
          </SettingOptionCard>
        ))}
      </div>
    </div>
  );
};

export default LocaleSettings;
