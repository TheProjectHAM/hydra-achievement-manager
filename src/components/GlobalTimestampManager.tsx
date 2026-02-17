
import React, { useState } from 'react';
import { format } from 'date-fns';
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
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-4 h-11 text-[10px] font-black uppercase tracking-widest transition-all ${!isFirst ? 'border-l' : ''}`}
      style={{
        backgroundColor: isActive ? 'var(--text-main)' : 'transparent',
        color: isActive ? 'var(--bg-color)' : 'var(--text-muted)',
        borderColor: 'var(--border-color)',
        boxShadow: isActive ? '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)' : 'none'
      }}
    >
      <span className={!isActive ? "hover:text-[var(--text-main)] transition-colors" : ""}>
        {label}
      </span>
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
      day: format(now, 'dd'),
      month: format(now, 'MM'),
      year: format(now, 'yyyy'),
      minute: format(now, 'mm'),
      hour: format(now, timeFormat === '12h' ? 'hh' : 'HH'),
      ...(timeFormat === '12h' && { ampm: format(now, 'aa').toUpperCase() as 'AM' | 'PM' })
    };
    setTimestamp(newTimestamp);
  };

  return (
    <div className="relative">
      <div
        className={`flex items-center rounded-md border transition-all w-full md:w-[420px] ${isEditingCustom ? 'p-1.5' : 'overflow-hidden'}`}
        style={{
          backgroundColor: isEditingCustom ? 'var(--input-bg)' : 'transparent',
          borderColor: 'var(--border-color)'
        }}
      >
        {isEditingCustom ? (
          <>
            <button
              onClick={handleBackClick}
              className="flex-shrink-0 flex items-center justify-center w-8 h-8 mx-1 rounded-sm transition-all"
              style={{ color: 'var(--text-muted)' }}
              aria-label={t('common.back')}
            >
              <ChevronLeftIcon className="text-xl hover:text-[var(--text-main)] transition-colors" />
            </button>
            <div className="border-l h-6 mx-2" style={{ borderColor: 'var(--border-color)' }}></div>
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
