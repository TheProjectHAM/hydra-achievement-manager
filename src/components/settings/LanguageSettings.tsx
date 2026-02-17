import React, { useState } from 'react';
import {
  CheckIcon,
} from '../Icons';
import { DateFormat, TimeFormat } from '../../types';
import { useI18n, Language } from '../../contexts/I18nContext';
import TimeFormatWarningModal from '../TimeFormatWarningModal';

interface LocaleSettingsProps {
  selectedLanguage: Language;
  setSelectedLanguage: (language: Language) => void;
  selectedDateFormat: DateFormat;
  setSelectedDateFormat: (format: DateFormat) => void;
  selectedTimeFormat: TimeFormat;
  setSelectedTimeFormat: (format: TimeFormat) => void;
  onSave?: (overrides?: any) => Promise<void>;
}

const LANGUAGES: { id: Language; name: string; countryCode: string }[] = [
  { id: 'en-US', name: 'English (US)', countryCode: 'US' },
  { id: 'pt-BR', name: 'Português (BR)', countryCode: 'BR' },
  { id: 'fr-FR', name: 'Français', countryCode: 'FR' },
  { id: 'it-IT', name: 'Italiano', countryCode: 'IT' },
  { id: 'zh-CN', name: '中文 (简体)', countryCode: 'CN' },
  { id: 'ja-JP', name: '日本語', countryCode: 'JP' },
  { id: 'ru-RU', name: 'Русский', countryCode: 'RU' },
  { id: 'uk-UA', name: 'Українська', countryCode: 'UA' },
  { id: 'pl-PL', name: 'Polski', countryCode: 'PL' },
  { id: 'es-ES', name: 'Español', countryCode: 'ES' },
];

const ModernDropdown: React.FC<{
  label: string;
  description: string;
  options: { id: any; name: string; icon?: React.ReactNode }[];
  selectedId: any;
  onSelect: (id: any) => void;
}> = ({ label, description, options, selectedId, onSelect }) => {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.id === selectedId);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 py-8 border-b last:border-0" style={{ borderColor: 'var(--border-color)' }}>
      <div className="flex-1">
        <h4 className="text-sm font-black tracking-[0.15em] uppercase mb-1.5" style={{ color: 'var(--text-main)' }}>{label}</h4>
        <p className="text-xs opacity-60 font-medium leading-relaxed max-w-md" style={{ color: 'var(--text-main)' }}>{description}</p>
      </div>

      <div className="relative w-full sm:w-60 flex-shrink-0">
        <button
          onClick={() => setOpen(!open)}
          className="w-full h-12 border rounded-md px-5 flex items-center justify-between transition-all duration-300 group"
          style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--border-color)' }}
        >
          <div className="flex items-center gap-3">
            {selected?.icon && <div className="w-6 h-4 rounded-sm overflow-hidden flex-shrink-0 shadow-sm">{selected.icon}</div>}
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-main)' }}>{selected?.name}</span>
          </div>
          <svg className={`w-3.5 h-3.5 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} style={{ color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
            <ul className="absolute z-40 mt-1 w-full border rounded-md shadow-2xl overflow-hidden p-1.5 animate-modal-in" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>
              {options.map(opt => (
                <li key={opt.id}>
                  <button
                    onClick={() => { onSelect(opt.id); setOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${selectedId === opt.id
                      ? 'bg-[var(--border-color)] text-[var(--text-main)]'
                      : 'text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-main)]'
                      }`}
                  >
                    {opt.icon && <div className="w-6 h-4 rounded-sm overflow-hidden flex-shrink-0">{opt.icon}</div>}
                    <span className="text-xs font-bold uppercase tracking-widest flex-grow text-left">{opt.name}</span>
                    {selectedId === opt.id && <div className="w-1.5 h-1.5 rounded-full shadow-sm" style={{ backgroundColor: 'var(--text-main)' }} />}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
};

const LocaleSettings: React.FC<LocaleSettingsProps> = ({
  selectedLanguage, setSelectedLanguage,
  selectedDateFormat, setSelectedDateFormat,
  selectedTimeFormat, setSelectedTimeFormat,
  onSave
}) => {
  const { t } = useI18n();
  const [isWarningOpen, setIsWarningOpen] = useState(false);
  const [pendingTimeFormat, setPendingTimeFormat] = useState<TimeFormat | null>(null);

  const handleTimeFormatChange = (format: TimeFormat) => {
    if (format === selectedTimeFormat) return;
    setPendingTimeFormat(format);
    setIsWarningOpen(true);
  };

  const handleCancelTimeFormat = () => {
    setPendingTimeFormat(null);
    setIsWarningOpen(false);
  };

  const handleConfirmAndRestart = async () => {
    if (pendingTimeFormat) {
      setSelectedTimeFormat(pendingTimeFormat);

      // If onSave is provided, save everything to disk before reloading
      if (onSave) {
        try {
          await onSave({ timeFormat: pendingTimeFormat });
        } catch (error) {
          console.error("Failed to save before restart:", error);
        }
      }

      window.location.reload();
    }
  };

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
    <div className="space-y-1">
      <ModernDropdown
        label={t('settings.language.language')}
        description={t('settings.language.languageDesc')}
        options={LANGUAGES.map(l => ({
          id: l.id,
          name: l.name,
          icon: <img src={`${import.meta.env.VITE_FLAGS_API_URL || 'https://flagsapi.com'}/${l.countryCode}/flat/64.png`} className="w-full h-full object-cover" alt={l.countryCode} />
        }))}
        selectedId={selectedLanguage}
        onSelect={setSelectedLanguage}
      />

      <ModernDropdown
        label={t('settings.language.dateFormat')}
        description={t('settings.language.dateFormatDesc')}
        options={[
          { id: 'DD/MM/YYYY', name: `DD/MM/YYYY (${getFormattedDateExample('DD/MM/YYYY')})` },
          { id: 'MM/DD/YYYY', name: `MM/DD/YYYY (${getFormattedDateExample('MM/DD/YYYY')})` },
          { id: 'YYYY-MM-DD', name: `YYYY-MM-DD (${getFormattedDateExample('YYYY-MM-DD')})` },
        ]}
        selectedId={selectedDateFormat}
        onSelect={setSelectedDateFormat}
      />

      <ModernDropdown
        label={t('settings.language.timeFormat')}
        description={t('settings.language.timeFormatDesc')}
        options={[
          { id: '24h', name: `${t('settings.language.timeFormat24')} (${getFormattedTimeExample('24h')})` },
          { id: '12h', name: `${t('settings.language.timeFormat12')} (${getFormattedTimeExample('12h')})` },
        ]}
        selectedId={selectedTimeFormat}
        onSelect={handleTimeFormatChange}
      />

      <TimeFormatWarningModal
        isOpen={isWarningOpen}
        onClose={handleCancelTimeFormat}
        onSaveAndRestart={handleConfirmAndRestart}
      />
    </div>
  );
};

export default LocaleSettings;
