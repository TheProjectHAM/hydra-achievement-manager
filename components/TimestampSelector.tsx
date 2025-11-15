import React, { useMemo } from 'react';
import { Timestamp, DateFormat, TimeFormat } from '../types';
import { CloseIcon, UpdateIcon } from './Icons';
import { useI18n } from '../contexts/I18nContext';

interface TimestampSelectorProps {
  timestamp: Timestamp;
  onChange: (field: keyof Timestamp, value: string) => void;
  onClear: () => void;
  onSetCurrent: () => void;
  disabled: boolean;
  dateFormat: DateFormat;
  timeFormat: TimeFormat;
}

const ActionButton: React.FC<{
    onClick: () => void;
    disabled: boolean;
    children: React.ReactNode;
    'aria-label': string;
}> = ({ onClick, disabled, children, 'aria-label': ariaLabel }) => (
    <button
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        disabled={disabled}
        className="flex items-center justify-center w-8 h-8 bg-black/5 text-gray-700 hover:bg-black/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label={ariaLabel}
    >
        {children}
    </button>
);

const TimestampSelector: React.FC<TimestampSelectorProps> = ({ timestamp, onChange, onClear, onSetCurrent, disabled, dateFormat, timeFormat }) => {
  const { t } = useI18n();

  const orderedParts = useMemo(() => {
    const datePartOrder = dateFormat.split(/[/ -]/).map(part => {
        if (part === 'DD') return { key: 'day' as const, len: 2 };
        if (part === 'MM') return { key: 'month' as const, len: 2 };
        if (part === 'YYYY') return { key: 'year' as const, len: 4 };
        return null;
    }).filter(Boolean) as { key: 'day' | 'month' | 'year', len: number }[];

    return [
        ...datePartOrder,
        { key: 'hour' as const, len: 2 },
        { key: 'minute' as const, len: 2 },
    ];
  }, [dateFormat]);
  
  const placeholder = useMemo(() => {
    const timePlaceholder = timeFormat === '12h' ? 'hh:mm' : 'HH:MM';
    return `${dateFormat} ${timePlaceholder}`
      .replace('hh', t('timestampSelector.hourPlaceholder'))
      .replace('HH', t('timestampSelector.hourPlaceholder'))
      .replace('mm', t('timestampSelector.minutePlaceholder'))
      .replace('MM', t('timestampSelector.monthPlaceholder'))
      .replace('DD', t('timestampSelector.dayPlaceholder'))
      .replace('YYYY', t('timestampSelector.yearPlaceholder'));
  }, [dateFormat, timeFormat, t]);

  const displayValue = useMemo(() => {
    const rawDigits = orderedParts.map(p => timestamp[p.key] || '').join('');
    if (!rawDigits) return '';

    let val = rawDigits;
    let result = '';
    
    const dateSeparator = dateFormat.includes('-') ? '-' : '/';
    const dateParts = dateFormat.split(dateSeparator);

    let lenCounter = 0;
    // Date part
    for (let i = 0; i < dateParts.length; i++) {
        const part = dateParts[i];
        const partLen = part === 'YYYY' ? 4 : 2;
        if (val.length > lenCounter) {
            result += val.substring(lenCounter, lenCounter + partLen);
            lenCounter += partLen;
            if (i < dateParts.length - 1 && val.length > lenCounter) {
                result += dateSeparator;
            }
        }
    }

    // Space separator
    if(val.length > lenCounter) {
        result += ' ';
    }
    
    // Hour part
    const hourPartLen = 2;
    if(val.length > lenCounter) {
        result += val.substring(lenCounter, lenCounter + hourPartLen);
        lenCounter += hourPartLen;
    }

    // Minute separator
    if(val.length > lenCounter) {
        result += ':';
    }

    // Minute part
    const minutePartLen = 2;
    if(val.length > lenCounter) {
        result += val.substring(lenCounter, lenCounter + minutePartLen);
    }

    return result;
  }, [timestamp, dateFormat, orderedParts]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const digits = value.replace(/\D/g, '');

    let cursor = 0;
    const newTimestamp: Partial<Timestamp> = {};

    for (const part of orderedParts) {
      const partValue = digits.slice(cursor, cursor + part.len);
      newTimestamp[part.key] = partValue;
      cursor += part.len;
    }

    // --- Start: Input Validation ---
    // Validate month (01-12)
    if (newTimestamp.month && newTimestamp.month.length === 2) {
      const monthNum = parseInt(newTimestamp.month, 10);
      if (monthNum > 12) newTimestamp.month = '12';
      if (monthNum === 0) newTimestamp.month = '01';
    }

    // Validate day (01-31)
    if (newTimestamp.day && newTimestamp.day.length === 2) {
      const dayNum = parseInt(newTimestamp.day, 10);
      if (dayNum > 31) newTimestamp.day = '31';
      if (dayNum === 0) newTimestamp.day = '01';
    }

    // Validate hour based on time format
    if (newTimestamp.hour && newTimestamp.hour.length === 2) {
      const hourNum = parseInt(newTimestamp.hour, 10);
      if (timeFormat === '12h') {
        if (hourNum > 12) newTimestamp.hour = '12';
        if (hourNum === 0) newTimestamp.hour = '01';
      } else { // 24h
        if (hourNum > 23) newTimestamp.hour = '23';
      }
    }

    // Validate minute (00-59)
    if (newTimestamp.minute && newTimestamp.minute.length === 2) {
      const minuteNum = parseInt(newTimestamp.minute, 10);
      if (minuteNum > 59) newTimestamp.minute = '59';
    }
    // --- End: Input Validation ---

    // Call onChange for every part that has changed
    orderedParts.forEach(part => {
      const key = part.key;
      const newValue = (newTimestamp[key] || '').slice(0, part.len);
      const oldValue = timestamp[key] || '';
      if (newValue !== oldValue) {
        onChange(key, newValue);
      }
    });
  };

  return (
    <div className="w-full" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-1.5 flex-grow">
            <input
                type="text"
                value={displayValue}
                placeholder={placeholder}
                onChange={handleInputChange}
                onClick={(e) => e.stopPropagation()}
                disabled={disabled}
                className="w-full bg-gray-200 dark:bg-black/40 text-left text-sm text-gray-800 dark:text-gray-300 rounded-md px-2 py-1 h-8 border border-transparent focus:outline-none focus:border-sky-500 transition-colors disabled:bg-gray-100 dark:disabled:bg-black/20 disabled:cursor-not-allowed disabled:text-gray-400 dark:disabled:text-gray-600"
                aria-label={t('timestampSelector.enterTimestamp')}
            />

            {timeFormat === '12h' && (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onChange('ampm', (timestamp.ampm || 'AM') === 'AM' ? 'PM' : 'AM');
                    }}
                    disabled={disabled}
                    className="w-12 h-8 flex-shrink-0 flex items-center justify-center bg-gray-200 dark:bg-black/40 text-center text-sm font-semibold text-gray-800 dark:text-gray-300 rounded-md border border-transparent focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label={t('timestampSelector.toggleAmPm')}
                >
                    {timestamp.ampm || 'AM'}
                </button>
            )}
        </div>

        <div className="flex items-center gap-2 ml-2">
            <ActionButton onClick={onSetCurrent} disabled={disabled} aria-label={t('timestampSelector.setCurrentTimestamp')}>
                <UpdateIcon className="text-lg" />
            </ActionButton>
            <ActionButton onClick={onClear} disabled={disabled} aria-label={t('timestampSelector.clearTimestamp')}>
                <CloseIcon className="text-lg" />
            </ActionButton>
        </div>
      </div>
    </div>
  );
};

export default TimestampSelector;