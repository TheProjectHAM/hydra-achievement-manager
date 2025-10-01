import React from 'react';
import { GithubIcon, TwitterIcon } from '../Icons';
import { useI18n } from '../../contexts/I18nContext';

interface CreatorCardProps {
    name: string;
    githubHandle: string;
    githubLink: string;
    twitterHandle: string;
    twitterLink: string;
    imageUrl: string;
}

const CreatorCard: React.FC<CreatorCardProps> = ({ name, githubHandle, githubLink, twitterHandle, twitterLink, imageUrl }) => (
    <div className="bg-gray-100 dark:bg-white/5 rounded-lg p-4 flex items-center gap-4 transition-colors hover:bg-gray-200 dark:hover:bg-white/10">
        <img src={imageUrl} alt={name} className="w-16 h-16 rounded-full object-cover flex-shrink-0" />
        <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-white text-lg truncate">{name}</h3>
            <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mt-1">
                 <a 
                    href={githubLink} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors flex items-center gap-1.5 group"
                >
                    <GithubIcon className="w-4 h-4 text-gray-500 group-hover:text-gray-900 dark:group-hover:text-white transition-colors" />
                    <span className="truncate">{githubHandle}</span>
                </a>
                <a 
                    href={twitterLink} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors flex items-center gap-1.5 group"
                >
                    <TwitterIcon className="w-4 h-4 text-gray-500 group-hover:text-gray-900 dark:group-hover:text-white transition-colors" />
                    <span className="truncate">{twitterHandle}</span>
                </a>
            </div>
        </div>
    </div>
);

const TRANSLATORS = [
    { name: '@SterTheStar', language: 'ENG, FR, JP, PL, BR, RU, UA, ZH', link: 'https://github.com/SterTheStar' },
    { name: '@lilithmki', language: 'IT', link: 'https://github.com/lilithmki' },
];

const AboutSettings: React.FC = () => {
  const { t } = useI18n();

  return (
    <div>
      <div className="bg-gray-100 dark:bg-white/5 rounded-lg p-4 mb-8">
        <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('common.version')}</span>
            <span className="text-sm text-gray-900 dark:text-white">2.0.0</span>
        </div>
        <div className="border-b border-black/10 dark:border-white/10 my-3"></div>
        <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('common.status')}</span>
            <span className="inline-flex items-center rounded-md bg-green-500/10 px-2 py-1 text-xs font-medium text-green-400 ring-1 ring-inset ring-green-500/20">
                {t('common.operational')}
            </span>
        </div>
        <div className="border-b border-black/10 dark:border-white/10 my-3"></div>
        <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">License</span>
            <a href="https://www.gnu.org/licenses/gpl-3.0.en.html" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-900 dark:text-white underline">GPLv3</a>
        </div>
        <div className="border-b border-black/10 dark:border-white/10 my-3"></div>
        <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Repository</span>
            <a href="https://github.com/SterTheStar/ProjectHAM" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-900 dark:text-white flex items-center gap-2">
                <GithubIcon className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                <span className="truncate">github.com/SterTheStar/ProjectHAM</span>
            </a>
        </div>
      </div>
      
      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">{t('settings.about.creators')}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CreatorCard 
            name="Esther"
            githubHandle="@SterTheStar"
            githubLink="https://github.com/SterTheStar"
            twitterHandle="@onlysterbr"
            twitterLink="https://x.com/onlysterbr"
            imageUrl="https://avatars.githubusercontent.com/u/151816213?v=4"
        />
        <CreatorCard 
            name="Levynsk"
            githubHandle="@Levynsk"
            githubLink="https://github.com/Levynsk/"
            twitterHandle="@Levynskshy"
            twitterLink="https://x.com/Levynskshy"
            imageUrl="https://avatars.githubusercontent.com/u/199530525?v=4"
        />
      </div>

      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 mt-8">{t('settings.about.translators')}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {TRANSLATORS.map(translator => (
          <a
            key={translator.name + translator.language}
            href={translator.link}
            target="_blank"
            rel="noopener noreferrer"
            className={`block bg-gray-100 dark:bg-white/5 rounded-lg p-3 transition-colors ${translator.link !== '#' ? 'hover:bg-gray-200 dark:hover:bg-white/10' : 'cursor-default'}`}
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <GithubIcon className="w-4 h-4 text-gray-500" />
                <span className="font-semibold text-gray-900 dark:text-white text-sm">{translator.name}</span>
              </div>
              <span className="text-sm text-gray-600 dark:text-gray-400">{translator.language}</span>
            </div>
          </a>
        ))}
      </div>

    </div>
  );
};

export default AboutSettings;
