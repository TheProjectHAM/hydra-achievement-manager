import React, { useState } from 'react';
import { Timestamp } from '../types';
import TimestampSelector from './TimestampSelector';
import { useTheme } from '../contexts/ThemeContext';
import { useI18n } from '../contexts/I18nContext';
import { ChevronLeftIcon } from './Icons';
import { Button } from '@/components/ui/button';
import { dateToTimestamp, emptyTimestamp } from '../formatters';

export type UnlockMode = 'random' | 'current' | 'custom';

interface GlobalTimestampManagerProps {
  mode: UnlockMode;
  setMode: (mode: UnlockMode) => void;
  timestamp: Timestamp;
  setTimestamp: (timestamp: Timestamp) => void;
}

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
    setTimestamp(emptyTimestamp());
  };

  const handleSetCurrentTimestamp = () => {
    setTimestamp(dateToTimestamp(new Date(), timeFormat));
  };

  const modes: { key: UnlockMode; label: string }[] = [
    { key: 'random', label: t('globalTimestampManager.random') },
    { key: 'current', label: t('globalTimestampManager.current') },
    { key: 'custom', label: t('globalTimestampManager.custom') },
  ];

  return (
    <div className="relative">
      <div className="flex items-center rounded-md border border-border transition-all w-full md:w-[420px] overflow-hidden">
        {isEditingCustom ? (
          <div className="flex items-center w-full p-1.5 bg-muted/30">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleBackClick}
              aria-label={t('common.back')}
            >
              <ChevronLeftIcon className="text-xl" />
            </Button>
            <div className="border-l h-6 mx-2 border-border"></div>
            <TimestampSelector
              timestamp={timestamp}
              onChange={handleTimestampChange}
              onClear={handleTimestampClear}
              onSetCurrent={handleSetCurrentTimestamp}
              disabled={false}
              dateFormat={dateFormat}
              timeFormat={timeFormat}
            />
          </div>
        ) : (
          <div className="flex w-full">
            {modes.map((m, i) => (
              <Button
                key={m.key}
                variant={mode === m.key ? 'default' : 'ghost'}
                onClick={() => handleModeClick(m.key)}
                className={`flex-1 h-11 text-[10px] font-black uppercase tracking-widest rounded-none ${i > 0 ? 'border-l border-border' : ''}`}
              >
                {m.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default GlobalTimestampManager;
