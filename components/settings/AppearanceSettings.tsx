import React from 'react';
import { Theme, useTheme } from '../../contexts/ThemeContext';
import { SidebarGameScale } from '../../types';
import {
  LightModeIcon, DarkModeIcon, TextDecreaseIcon, TextFieldsIcon, TextIncreaseIcon, UpdateIcon
} from '../Icons';
import { useI18n } from '../../contexts/I18nContext';

const DEFAULT_SIDEBAR_WIDTH = 288;

const ThemeCard: React.FC<{
  id: Theme;
  label: string;
  icon: React.ReactNode;
  currentTheme: Theme;
  setTheme: (theme: Theme) => void;
}> = ({ id, label, icon, currentTheme, setTheme }) => {
  const isSelected = currentTheme === id;
  const cardClasses = `
    relative rounded-lg px-4 py-4 transition-all cursor-pointer flex flex-col items-center justify-center gap-3
    ${isSelected
      ? 'bg-gray-200 dark:bg-white/10 shadow-sm' // ativo mais claro e suave
      : 'bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10'
    }
  `;
  return (
    <div
      onClick={() => setTheme(id)}
      className={cardClasses.trim()}
      role="radio"
      aria-checked={isSelected}
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setTheme(id)}
    >
      <div className="text-3xl text-gray-700 dark:text-gray-300 flex-shrink-0 flex items-center justify-center">{icon}</div>
      <h3 className="font-semibold text-gray-900 dark:text-white text-center">{label}</h3>
    </div>
  );
};

const OptionCard: React.FC<{
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  isSelected: boolean;
  onSelect: (id: any) => void;
}> = ({ id, label, description, icon, isSelected, onSelect }) => {
  const cardClasses = `
    relative rounded-lg p-4 transition-all cursor-pointer flex items-center gap-4
    ${isSelected
      ? 'bg-gray-200 dark:bg-white/10 shadow-sm'
      : 'bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10'
    }
  `;
  return (
    <div
      onClick={() => onSelect(id)}
      className={cardClasses.trim()}
      role="radio"
      aria-checked={isSelected}
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(id)}
    >
      <div className="text-4xl text-gray-700 dark:text-gray-300">{icon}</div>
      <div>
        <h3 className="font-semibold text-gray-900 dark:text-white">{label}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{description}</p>
      </div>
    </div>
  );
};

const SettingRow: React.FC<{ title: string, description: string, children: React.ReactNode }> = ({ title, description, children }) => (
  <div className="bg-gray-100 dark:bg-white/5 rounded-lg p-4 flex items-center justify-between gap-4 border-2 border-transparent">
    <div>
      <h4 className="font-semibold text-gray-900 dark:text-white">{title}</h4>
      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{description}</p>
    </div>
    <div className="flex-shrink-0">{children}</div>
  </div>
);

const ToggleSwitch: React.FC<{ enabled: boolean, onChange: (enabled: boolean) => void }> = ({ enabled, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!enabled)}
    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${enabled ? 'bg-white dark:bg-white border-gray-300 dark:border-white' : 'bg-gray-300 dark:bg-[#141415]'
      }`}
    role="switch"
    aria-checked={enabled}
  >
    <span
      aria-hidden="true"
      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full shadow ring-0 transition duration-200 ease-in-out ${enabled ? 'translate-x-5 bg-black dark:bg-black' : 'translate-x-0 bg-white'
        }`}
    />
  </button>
);

interface AppearanceSettingsProps {
  selectedTheme: Theme;
  setSelectedTheme: (theme: Theme) => void;
  selectedGameScale: SidebarGameScale;
  setSelectedGameScale: (scale: SidebarGameScale) => void;
  selectedMarquee: boolean;
  setSelectedMarquee: (marquee: boolean) => void;
}

const AppearanceSettings: React.FC<AppearanceSettingsProps> = ({
  selectedTheme, setSelectedTheme,
  selectedGameScale, setSelectedGameScale,
  selectedMarquee, setSelectedMarquee
}) => {
  const { t } = useI18n();
  const { setSidebarWidth } = useTheme();

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ThemeCard
          id="light"
          label={t('settings.appearance.lightTheme')}
          icon={<LightModeIcon />}
          currentTheme={selectedTheme}
          setTheme={setSelectedTheme}
        />
        <ThemeCard
          id="dark"
          label={t('settings.appearance.darkTheme')}
          icon={<DarkModeIcon />}
          currentTheme={selectedTheme}
          setTheme={setSelectedTheme}
        />
      </div>

      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 mt-2">{t('settings.appearance.sidebar')}</h3>
      <div className="space-y-4">
        <SettingRow
          title={t('settings.appearance.resetSidebarWidth')}
          description={t('settings.appearance.resetSidebarWidthDesc')}
        >
          <button
            onClick={() => setSidebarWidth(DEFAULT_SIDEBAR_WIDTH)}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors duration-200 text-sm font-semibold bg-black/5 text-gray-700 hover:bg-black/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white"
          >
            <UpdateIcon className="text-lg" />
            <span>{t('settings.appearance.reset')}</span>
          </button>
        </SettingRow>
        <SettingRow
          title={t('settings.appearance.sidebarMarquee')}
          description={t('settings.appearance.sidebarMarqueeDesc')}
        >
          <ToggleSwitch enabled={selectedMarquee} onChange={setSelectedMarquee} />
        </SettingRow>
      </div>

      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 mt-2">{t('settings.appearance.sidebarGameScale')}</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <OptionCard
          id="sm"
          label={t('settings.appearance.sizeSmall')}
          description={t('settings.appearance.sizeSmallDesc')}
          icon={<TextDecreaseIcon />}
          isSelected={selectedGameScale === 'sm'}
          onSelect={setSelectedGameScale}
        />
        <OptionCard
          id="md"
          label={t('settings.appearance.sizeMedium')}
          description={t('settings.appearance.sizeMediumDesc')}
          icon={<TextFieldsIcon />}
          isSelected={selectedGameScale === 'md'}
          onSelect={setSelectedGameScale}
        />
        <OptionCard
          id="lg"
          label={t('settings.appearance.sizeLarge')}
          description={t('settings.appearance.sizeLargeDesc')}
          icon={<TextIncreaseIcon />}
          isSelected={selectedGameScale === 'lg'}
          onSelect={setSelectedGameScale}
        />
      </div>
    </div>
  );
};

export default AppearanceSettings;
