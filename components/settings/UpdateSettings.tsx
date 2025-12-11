import React, { useState, useEffect } from 'react';
import { UpdateIcon, TagIcon } from '../Icons';
import { useTheme } from '../../contexts/ThemeContext';
import { formatDate, formatDateObj } from '../../formatters';
import { useI18n } from '../../contexts/I18nContext';
import packageJson from '../../package.json';

const UPDATES_URL = 'https://raw.githubusercontent.com/Levynsk/hydra-achievement-manager/refs/heads/main/updates.json';

const UpdateSettings: React.FC = () => {
  const { dateFormat, timeFormat } = useTheme();
  const { t } = useI18n();
  const [updates, setUpdates] = useState<any[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  useEffect(() => {
    fetch(UPDATES_URL)
      .then(res => res.json())
      .then(data => setUpdates(data.updates || []));
  }, []);

  useEffect(() => {
    if (statusMessage && !isChecking) {
      const timer = setTimeout(() => setStatusMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage, isChecking]);

  const handleCheckForUpdates = () => {
    setIsChecking(true);
    setStatusMessage('Checking for updates...');
    setTimeout(() => {
      setStatusMessage('Checked!');
      setLastChecked(new Date());
      setIsChecking(false);
    }, 2500);
  };

  const lastCheckedFormatted = lastChecked ? formatDateObj(lastChecked, dateFormat, timeFormat) : 'Never';

  // Version logic
  const latest = updates[updates.length - 1]?.version;
  let updateStatus = '';
  if (latest) {
    if (packageJson.version === latest) {
      updateStatus = 'You are up to date!';
    } else if (packageJson.version < latest) {
      updateStatus = `New version available: ${latest}`;
    } else {
      updateStatus = `You are a beta tester! (version: ${packageJson.version})`;
    }
  }

  return (
    <div>
      {/* Update checker card */}
      <div className="bg-gray-100 dark:bg-white/5 rounded-lg p-6 flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
        <div className="flex-grow text-center sm:text-left">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('settings.updates.currentVersion', { version: packageJson.version })}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t('settings.updates.lastChecked', { date: lastCheckedFormatted })}
          </p>
          {updateStatus && (
            <p className="text-sm mt-2 h-5 transition-opacity duration-300 text-green-400">
              {updateStatus}
            </p>
          )}
          {statusMessage && (
            <p className="text-sm mt-2 h-5 transition-opacity duration-300 text-sky-400">
              {statusMessage}
            </p>
          )}
        </div>
        <button
          onClick={handleCheckForUpdates}
          disabled={isChecking}
          className="w-full sm:w-auto flex-shrink-0 flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white dark:bg-[#1a1a1b] dark:hover:bg-[#232325] dark:text-white font-semibold py-2 px-5 rounded-lg transition-all shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isChecking ? (
            <>
              <div className="w-5 h-5 border-2 border-white/50 dark:border-black/50 border-t-white dark:border-t-black rounded-full animate-spin"></div>
              <span>{t('settings.updates.checkingButton')}</span>
            </>
          ) : (
            <>
              <UpdateIcon className="text-xl" />
              <span>{t('settings.updates.checkForUpdates')}</span>
            </>
          )}
        </button>
      </div>

      {/* Changelog section */}
      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">{t('settings.updates.whatsNew')}</h3>
      <div className="space-y-6">
        {[...updates].reverse().map((log) => (
          <div key={log.version} className="bg-gray-100/50 dark:bg-white/5 rounded-lg p-5">
            <div className="flex items-center gap-3 mb-3 border-b border-black/10 dark:border-white/10 pb-3">
              <div className="bg-gray-200 dark:bg-[#17171a] p-1.5 rounded-md">
                <TagIcon className="text-gray-700 dark:text-gray-300 text-lg" />
              </div>
              <div>
                <h4 className="font-bold text-gray-900 dark:text-white">Version {log.version}</h4>
              </div>
            </div>
            <ul className="space-y-2">
              {log.changelog.map((change, idx) => (
                <li key={idx} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-3">
                  <span className="flex-grow">{change}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UpdateSettings;
