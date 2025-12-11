
import React, { useState } from 'react';
import { Timestamp, DateFormat, TimeFormat } from '../types';
import TimestampSelector from './TimestampSelector';
import { useTheme } from '../contexts/ThemeContext';
import { useI18n } from '../contexts/I18nContext';
import { ChevronLeftIcon } from './Icons';

export type UnlockMode = 'random' | 'current' | 'custom';

interface GlobalTimestampManagerProps {
  mode: UnlockMode;
  setMode: (mode: UnlockMode) => void;
  timestamp: Timestamp;
  setTimestamp: (timestamp: Timestamp) => void;
}

const ModeButton: React.FC<{
  label: string;
  isActive: boolean;
  onClick: () => void;
  isFirst?: boolean;
}> = ({ label, isActive, onClick, isFirst }) => {
  const activeClasses = 'bg-white text-black dark:bg-white dark:text-black shadow-lg border-2 border-gray-300 dark:border-white';
  const inactiveClasses = 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-[#141415] dark:text-gray-500 dark:hover:bg-[#1f1f21] dark:hover:text-gray-300';

  return (
    <button
      onClick={onClick}
      className={`flex-1 px-4 h-10 text-sm font-semibold transition-colors ${isActive ? activeClasses : inactiveClasses
        } ${!isFirst ? 'border-l border-gray-300 dark:border-white/20' : ''}`}
    >
      {label}
    </button>
  );
};


const GlobalTimestampManager: React.FC<GlobalTimestampManagerProps> = ({ mode, setMode, timestamp, setTimestamp }) => {
  const { dateFormat, timeFormat } = useTheme();
  const { t } = useI18n();
  const [isEditingCustom, setIsEditingCustom] = useState(false);

  const handleModeClick = (newMode: UnlockMode) => {
    setMode(newMode);
    if (newMode === 'custom') {
      setIsEditingCustom(true);
    }
  };

  const handleBackClick = () => {
    setIsEditingCustom(false);
  };

  const handleTimestampChange = (field: keyof Timestamp, value: string) => {
    setTimestamp({ ...timestamp, [field]: value });
  };

  const handleTimestampClear = () => {
    setTimestamp({ day: '', month: '', year: '', hour: '', minute: '' });
  };

  const handleSetCurrentTimestamp = () => {
    const now = new Date();
    const newTimestamp: Timestamp = {
      day: String(now.getDate()).padStart(2, '0'),
      month: String(now.getMonth() + 1).padStart(2, '0'),
      year: String(now.getFullYear()),
      minute: String(now.getMinutes()).padStart(2, '0'),
      hour: '',
    };
    if (timeFormat === '12h') {
      const hour12 = now.getHours() % 12 || 12;
      newTimestamp.hour = String(hour12).padStart(2, '0');
      newTimestamp.ampm = now.getHours() >= 12 ? 'PM' : 'AM';
    } else {
      newTimestamp.hour = String(now.getHours()).padStart(2, '0');
    }
    setTimestamp(newTimestamp);
  };

  return (
    <div className="relative">
      <div className={`flex items-center rounded-lg border border-gray-300 dark:border-white/20 transition-all ${isEditingCustom ? 'p-1 bg-gray-100 dark:bg-white/5' : 'overflow-hidden'}`}>
        {isEditingCustom ? (
          <>
            <button
              onClick={handleBackClick}
              className="flex-shrink-0 flex items-center justify-center w-8 h-8 mx-1 bg-transparent text-gray-700 hover:bg-black/10 dark:text-gray-300 dark:hover:bg-white/10 rounded-md transition-colors"
              aria-label={t('common.back')}
            >
              <ChevronLeftIcon className="text-xl" />
            </button>
            <div className="border-l border-gray-300 dark:border-white/20 h-6 mx-1"></div>
            <TimestampSelector
              timestamp={timestamp}
              onChange={handleTimestampChange}
              onClear={handleTimestampClear}
              onSetCurrent={handleSetCurrentTimestamp}
              disabled={false}
              dateFormat={dateFormat}
              timeFormat={timeFormat}
            />
          </>
        ) : (
          <>
            <ModeButton label={t('globalTimestampManager.random')} isActive={mode === 'random'} onClick={() => handleModeClick('random')} isFirst />
            <ModeButton label={t('globalTimestampManager.current')} isActive={mode === 'current'} onClick={() => handleModeClick('current')} />
            <ModeButton label={t('globalTimestampManager.custom')} isActive={mode === 'custom'} onClick={() => handleModeClick('custom')} />
          </>
        )}
      </div>
    </div>
  );
};

export default GlobalTimestampManager;
