import React from 'react';
import { GithubIcon, TwitterIcon } from '../Icons';
import { useI18n } from '../../contexts/I18nContext';
import packageJson from '../../../package.json';

const InfoRow: React.FC<{ label: string; value: string; action?: () => void; actionLabel?: string; last?: boolean }> = ({ label, value, action, actionLabel, last }) => {
  const { t } = useI18n();
  return (
    <div className={`flex items-center justify-between py-6 ${!last ? 'border-border border-b' : ''}`}>
      <div className="space-y-1">
        <h4 className="text-xs font-semibold opacity-50 text-foreground">{label}</h4>
        <p className="text-sm font-semibold leading-none text-foreground">{value}</p>
      </div>
      {action && (
        <button
          onClick={action}
          className="text-xs font-semibold transition-all px-4 py-2 rounded-lg border border-border bg-accent text-foreground"
        >
          {actionLabel || t('common.view')}
        </button>
      )}
    </div>
  );
};

const CreatorRow: React.FC<{ name: string; githubLink: string; twitterLink: string; imageUrl: string; last?: boolean }> = ({ name, githubLink, twitterLink, imageUrl, last }) => {
  const { t } = useI18n();
  const openLink = (url: string) => {
    const w: any = window as any;
    if (w.electronAPI && typeof w.electronAPI.openExternal === 'function') {
      w.electronAPI.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  };

  return (
    <div className={`flex items-center justify-between py-6 ${!last ? 'border-border border-b' : ''}`}>
      <div className="flex items-center gap-5">
        <img src={imageUrl} alt={name} className="w-14 h-14 rounded-lg object-cover ring-2 ring-border shadow-md" />
        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-foreground">{name}</h4>
          <p className="text-xs font-medium leading-none text-muted-foreground">{t('settings.about.mainDeveloper')}</p>
        </div>
      </div>
      <div className="flex gap-4">
        <button onClick={() => openLink(githubLink)} className="transition-colors text-muted-foreground">
          <GithubIcon className="w-4 h-4 hover:text-foreground transition-colors" />
        </button>
        <button onClick={() => openLink(twitterLink)} className="transition-colors text-muted-foreground">
          <TwitterIcon className="w-4 h-4 hover:text-foreground transition-colors" />
        </button>
      </div>
    </div>
  );
};

const AboutSettings: React.FC = () => {
  const { t } = useI18n();
  const currentVersionLabel = `v${packageJson.version}${packageJson.versionDateTag ? ` ${packageJson.versionDateTag}` : ''}`;

  const openExternal = (url: string) => {
    const w: any = window as any;
    if (w.electronAPI && typeof w.electronAPI.openExternal === 'function') {
      w.electronAPI.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  };

  const TRANSLATORS = [
    { name: 'SterTheStar', language: 'Global', countryCode: 'US', link: 'https://github.com/SterTheStar' },
    { name: 'lilithmki', language: 'Italian', countryCode: 'IT', link: 'https://github.com/lilithmki' },
  ];

  return (
    <div className="space-y-8 pb-4">
      {/* App Basic Info Container */}
      <div className="border border-border rounded-lg px-6 overflow-hidden shadow-sm bg-muted">
        <InfoRow
          label={t('settings.about.appBuild')}
          value={`${currentVersionLabel} ${t('settings.about.stableRelease')}`}
        />
        <InfoRow
          label={t('settings.about.legalLicense')}
          value="General Public License v3"
          action={() => openExternal('https://www.gnu.org/licenses/gpl-3.0.en.html')}
          actionLabel="LICENSE"
          last
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-4 px-1">
          <h4 className="text-xs font-semibold opacity-40 text-foreground">{t('settings.about.creators')}</h4>
          <div className="h-px flex-1 opacity-20 bg-foreground" />
        </div>
        <div className="border border-border rounded-md px-6 overflow-hidden shadow-sm bg-muted">
          <CreatorRow
            name="Esther"
            githubLink="https://github.com/SterTheStar"
            twitterLink="https://x.com/onlysterbr"
            imageUrl="https://avatars.githubusercontent.com/u/151816213?v=4"
          />
          <CreatorRow
            name="Levynsk"
            githubLink="https://github.com/Levynsk/"
            twitterLink="https://x.com/Levynskshy"
            imageUrl="https://avatars.githubusercontent.com/u/199530525?v=4"
            last
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-4 px-1">
          <h4 className="text-xs font-semibold opacity-30 text-foreground">{t('settings.about.translators')}</h4>
          <div className="h-px flex-1 opacity-10 bg-foreground" />
        </div>
        <div className="border border-border rounded-lg px-6 overflow-hidden grid grid-cols-1 sm:grid-cols-2 gap-x-12 shadow-sm bg-muted">
          {TRANSLATORS.map((translator, idx) => (
            <div key={translator.name} className={`flex items-center justify-between py-6 ${idx < 1 ? 'sm:border-b-0 border-b border-border' : ''}`}>
              <span className="text-xs font-semibold text-muted-foreground">{translator.name}</span>
              <div className="flex items-center gap-3">
                <div className="w-5 h-3 rounded-[1px] overflow-hidden shadow-sm">
                  <img src={`${import.meta.env.VITE_FLAGS_API_URL || 'https://flagsapi.com'}/${translator.countryCode}/flat/64.png`} className="w-full h-full object-cover" alt={translator.language} />
                </div>
                <span className="text-[10px] font-semibold italic opacity-60 text-foreground">{translator.language}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-10 flex items-center justify-between border-t border-border">
        <p className="text-xs font-semibold text-muted-foreground">{t('settings.about.footerRights')}</p>
        <button
          onClick={() => openExternal('https://github.com/Levynsk/hydra-achievement-manager')}
          className="px-6 py-3 border rounded-md text-xs font-semibold transition-all flex items-center gap-3 shadow-lg bg-foreground text-background border-foreground"
        >
          <GithubIcon className="w-4 h-4" />
          {t('settings.about.buildRepository')}
        </button>
      </div>
    </div>
  );
};

export default AboutSettings;
