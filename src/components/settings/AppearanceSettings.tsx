import React, { useState } from 'react';
import { Theme, useTheme } from '../../contexts/ThemeContext';
import { SidebarGameScale, GamesViewMode, TitleBarMode } from '../../types';
import { ApiSource } from '../../types';
import {
  UpdateIcon
} from '../Icons';
import { useI18n } from '../../contexts/I18nContext';

const DEFAULT_SIDEBAR_WIDTH = 288;

const PalettePreview: React.FC<{ colors: string[] }> = ({ colors }) => (
  <div className="flex -space-x-1.5 flex-shrink-0">
    {colors.map((color, i) => (
      <div
        key={i}
        className="w-4 h-4 rounded-full border border-black/10 shadow-sm"
        style={{ backgroundColor: color, zIndex: 3 - i }}
      />
    ))}
  </div>
);

const ToggleRow: React.FC<{
  label: string;
  description: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
}> = ({ label, description, enabled, onChange, disabled = false }) => (
  <div className={`flex items-center justify-between gap-6 py-8 border-b border-border last:border-0 ${disabled ? 'opacity-50' : ''}`}>
    <div className="flex-1">
       <h4 className="text-sm font-semibold mb-1.5 text-foreground">{label}</h4>
      <p className="text-xs opacity-60 font-medium leading-relaxed max-w-md text-foreground">{description}</p>
    </div>
    <button
      onClick={() => {
        if (!disabled) onChange(!enabled);
      }}
      disabled={disabled}
      className={`relative w-12 h-6 rounded-full transition-all duration-300 p-1 ${enabled ? 'bg-foreground' : 'bg-accent'}`}
    >
      <div className={`w-4 h-4 rounded-full bg-background transition-all duration-300 shadow-sm ${enabled ? 'translate-x-6' : 'translate-x-0'}`} />
    </button>
  </div>
);

const ModernSelector: React.FC<{
  label: string;
  description: string;
  options: { id: any; name: string }[];
  selectedId: any;
  onSelect: (id: any) => void;
}> = ({ label, description, options, selectedId, onSelect }) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 py-8 border-b border-border last:border-0">
      <div className="flex-1">
        <h4 className="text-sm font-semibold mb-1.5 text-foreground">{label}</h4>
        <p className="text-xs opacity-60 font-medium leading-relaxed max-w-md text-foreground">{description}</p>
      </div>

      <div className="flex p-1.5 rounded-lg border border-border overflow-hidden shadow-inner bg-muted">
        {options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => onSelect(opt.id)}
            className={`px-5 py-2 rounded-md text-xs font-semibold transition-all duration-300 ${selectedId === opt.id
              ? 'bg-foreground text-background shadow-xl'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
          >
            {opt.name}
          </button>
        ))}
      </div>
    </div>
  );
};

const ModernDropdown: React.FC<{
  label: string;
  description: string;
  options: { id: any; name: string; palette?: string[] }[];
  selectedId: any;
  onSelect: (id: any) => void;
}> = ({ label, description, options, selectedId, onSelect }) => {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.id === selectedId);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 py-8 border-b border-border last:border-0">
      <div className="flex-1">
        <h4 className="text-sm font-semibold mb-1.5 text-foreground">{label}</h4>
        <p className="text-xs opacity-60 font-medium leading-relaxed max-w-md text-foreground">{description}</p>
      </div>

      <div className="relative w-full sm:w-60 flex-shrink-0">
        <button
          onClick={() => setOpen(!open)}
          className="w-full h-12 border border-border rounded-md px-5 flex items-center justify-between transition-all duration-300 group shadow-sm hover:shadow-md bg-muted"
        >
          <div className="flex items-center gap-3">
            {selected?.palette && <PalettePreview colors={selected.palette} />}
            <span className="text-xs font-semibold text-foreground">{selected?.name}</span>
          </div>
          <svg className={`w-3.5 h-3.5 transition-transform duration-300 text-muted-foreground ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
            <ul className="absolute z-40 mt-1 w-full border border-border rounded-md shadow-2xl overflow-hidden p-1.5 animate-modal-in bg-card">
              {options.map(opt => (
                <li key={opt.id}>
                  <button
                    onClick={() => { onSelect(opt.id); setOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors ${selectedId === opt.id
                      ? 'bg-border text-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                      }`}
                  >
                    {opt.palette && <PalettePreview colors={opt.palette} />}
                    <span className="text-xs font-semibold flex-grow text-left">{opt.name}</span>
                    {selectedId === opt.id && <div className="w-1.5 h-1.5 rounded-full bg-foreground" />}
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

const ActionRow: React.FC<{
  label: string;
  description: string;
  actionLabel: string;
  onClick: () => void;
}> = ({ label, description, actionLabel, onClick }) => (
  <div className="flex items-center justify-between gap-6 py-8 border-b border-border last:border-0">
    <div className="flex-1">
      <h4 className="text-sm font-semibold mb-1.5 text-foreground">{label}</h4>
      <p className="text-xs opacity-60 font-medium leading-relaxed max-w-md text-foreground">{description}</p>
    </div>
    <button
      onClick={onClick}
      className="h-12 px-6 rounded-md text-[10px] font-semibold border border-border transition-all duration-300 shadow-sm hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] flex items-center gap-2.5 bg-muted text-foreground"
    >
      <UpdateIcon className="text-base opacity-70" />
      {actionLabel}
    </button>
  </div>
);

const AppearanceSettings: React.FC<{
  selectedTheme: Theme;
  setSelectedTheme: (theme: Theme) => void;
  selectedGameScale: SidebarGameScale;
  setSelectedGameScale: (scale: SidebarGameScale) => void;
  selectedMarquee: boolean;
  setSelectedMarquee: (marquee: boolean) => void;
  selectedGamesViewMode: GamesViewMode;
  setSelectedGamesViewMode: (mode: GamesViewMode) => void;
  selectedTitleBarMode: TitleBarMode;
  setSelectedTitleBarMode: (mode: TitleBarMode) => void;
  selectedHideHiddenAchievements: boolean;
  setSelectedHideHiddenAchievements: (enabled: boolean) => void;
  selectedApi: ApiSource;
}> = ({
  selectedTheme, setSelectedTheme,
  selectedGameScale, setSelectedGameScale,
  selectedMarquee, setSelectedMarquee,
  selectedGamesViewMode, setSelectedGamesViewMode,
  selectedTitleBarMode, setSelectedTitleBarMode,
  selectedHideHiddenAchievements, setSelectedHideHiddenAchievements,
  selectedApi
}) => {
    const { t } = useI18n();
    const { setSidebarWidth } = useTheme();
    const canToggleHiddenAchievements = selectedApi === 'steam';

    const THEMES: { id: Theme; name: string; palette: string[] }[] = [
      { id: 'light', name: t('settings.appearance.lightTheme'), palette: ['#f0f2f5', '#edf1f4', '#1e293b'] },
      { id: 'dark', name: t('settings.appearance.darkTheme'), palette: ['#0a0a0b', '#1a1a1b', '#ffffff'] },
      { id: 'nord', name: t('settings.appearance.nordTheme'), palette: ['#2e3440', '#3b4252', '#88c0d0'] },
      { id: 'gruvbox', name: t('settings.appearance.gruvboxTheme'), palette: ['#282828', '#3c3836', '#fb4934'] },
      { id: 'tokyo-night', name: t('settings.appearance.tokyoNightTheme'), palette: ['#1a1b26', '#24283b', '#7aa2f7'] },
      { id: 'everforest', name: t('settings.appearance.everforestTheme'), palette: ['#2d353b', '#343f44', '#a7c080'] },
      { id: 'dracula', name: t('settings.appearance.draculaTheme'), palette: ['#282a36', '#44475a', '#bd93f9'] },
      { id: 'retrowave', name: t('settings.appearance.retrowaveTheme'), palette: ['#140522', '#24103d', '#d746ff'] },
      { id: 'catppuccin', name: t('settings.appearance.catppuccinTheme'), palette: ['#1f1b18', '#2a2320', '#d6a78a'] },
      { id: 'github-dark', name: t('settings.appearance.githubDarkTheme'), palette: ['#0d1117', '#161b22', '#58a6ff'] },
      { id: 'solarized-dark', name: t('settings.appearance.solarizedDarkTheme'), palette: ['#002b36', '#073642', '#268bd2'] },
      { id: 'one-dark', name: t('settings.appearance.oneDarkTheme'), palette: ['#282c34', '#353b45', '#61afef'] },
      { id: 'breeze-dark', name: t('settings.appearance.breezeDarkTheme'), palette: ['#202326', '#141618', '#3daee9'] },
    ];

    return (
      <div className="space-y-1">
        <ModernDropdown
          label={t('settings.appearance.title')}
          description={t('settings.appearance.description')}
          options={THEMES}
          selectedId={selectedTheme}
          onSelect={setSelectedTheme}
        />

        <ModernSelector
          label={t('settings.appearance.titleBarMode')}
          description={t('settings.appearance.titleBarModeDesc')}
          options={[
            { id: 'hidden', name: t('settings.appearance.titleBarHidden') },
            { id: 'custom', name: t('settings.appearance.titleBarCustom') },
            { id: 'native', name: t('settings.appearance.titleBarNative') }
          ]}
          selectedId={selectedTitleBarMode}
          onSelect={setSelectedTitleBarMode}
        />

        <ModernSelector
          label={t('settings.appearance.viewMode')}
          description={t('settings.appearance.viewModeDesc')}
          options={[
            { id: 'grid', name: t('settings.appearance.grid') },
            { id: 'list', name: t('settings.appearance.list') }
          ]}
          selectedId={selectedGamesViewMode}
          onSelect={setSelectedGamesViewMode}
        />

        <ModernSelector
          label={t('settings.appearance.sidebarGameScale')}
          description={t('settings.appearance.description')}
          options={[
            { id: 'sm', name: t('settings.appearance.sizeSmall') },
            { id: 'md', name: t('settings.appearance.sizeMedium') },
            { id: 'lg', name: t('settings.appearance.sizeLarge') }
          ]}
          selectedId={selectedGameScale}
          onSelect={setSelectedGameScale}
        />

        <ToggleRow
          label={t('settings.appearance.sidebarMarquee')}
          description={t('settings.appearance.sidebarMarqueeDesc')}
          enabled={selectedMarquee}
          onChange={setSelectedMarquee}
        />

        <ToggleRow
          label={t('settings.appearance.hideHiddenAchievements')}
          description={t('settings.appearance.hideHiddenAchievementsDesc')}
          enabled={selectedHideHiddenAchievements}
          onChange={setSelectedHideHiddenAchievements}
          disabled={!canToggleHiddenAchievements}
        />

        <ActionRow
          label={t('settings.appearance.resetSidebarWidth')}
          description={t('settings.appearance.resetSidebarWidthDesc')}
          actionLabel={t('settings.appearance.reset')}
          onClick={() => setSidebarWidth(DEFAULT_SIDEBAR_WIDTH)}
        />
      </div>
    );
  };

export default AppearanceSettings;
