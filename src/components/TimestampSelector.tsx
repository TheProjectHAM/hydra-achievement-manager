import React, { useMemo } from 'react';
import { Timestamp, DateFormat, TimeFormat } from '../types';
import { CloseIcon, UpdateIcon } from './Icons';
import { useI18n } from '../contexts/I18nContext';
import { Button } from '@/components/ui/button';

interface TimestampSelectorProps {
  timestamp: Timestamp;
  onChange: (field: keyof Timestamp, value: string) => void;
  onClear: () => void;
  onSetCurrent: () => void;
  disabled: boolean;
  dateFormat: DateFormat;
  timeFormat: TimeFormat;
}

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

    if (val.length > lenCounter) {
      result += ' ';
    }

    const hourPartLen = 2;
    if (val.length > lenCounter) {
      result += val.substring(lenCounter, lenCounter + hourPartLen);
      lenCounter += hourPartLen;
    }

    if (val.length > lenCounter) {
      result += ':';
    }

    const minutePartLen = 2;
    if (val.length > lenCounter) {
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

    if (newTimestamp.month && newTimestamp.month.length === 2) {
      const monthNum = parseInt(newTimestamp.month, 10);
      if (monthNum > 12) newTimestamp.month = '12';
      if (monthNum === 0) newTimestamp.month = '01';
    }

    if (newTimestamp.day && newTimestamp.day.length === 2) {
      const dayNum = parseInt(newTimestamp.day, 10);
      if (dayNum > 31) newTimestamp.day = '31';
      if (dayNum === 0) newTimestamp.day = '01';
    }

    if (newTimestamp.hour && newTimestamp.hour.length === 2) {
      const hourNum = parseInt(newTimestamp.hour, 10);
      if (timeFormat === '12h') {
        if (hourNum > 12) newTimestamp.hour = '12';
        if (hourNum === 0) newTimestamp.hour = '01';
      } else {
        if (hourNum > 23) newTimestamp.hour = '23';
      }
    }

    if (newTimestamp.minute && newTimestamp.minute.length === 2) {
      const minuteNum = parseInt(newTimestamp.minute, 10);
      if (minuteNum > 59) newTimestamp.minute = '59';
    }

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
            className="w-full text-left text-[11px] font-bold tracking-widest rounded-sm px-3 py-1.5 h-8 outline-none border border-transparent focus:border-ring focus:opacity-100 transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-accent text-foreground"
            aria-label={t('timestampSelector.enterTimestamp')}
          />

          {timeFormat === '12h' && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onChange('ampm', (timestamp.ampm || 'AM') === 'AM' ? 'PM' : 'AM');
              }}
              disabled={disabled}
              className="w-12 h-8 text-[10px] font-black tracking-widest"
              aria-label={t('timestampSelector.toggleAmPm')}
            >
              {timestamp.ampm || 'AM'}
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2 ml-2">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={(e) => { e.stopPropagation(); onSetCurrent(); }}
            disabled={disabled}
            className="size-8 bg-accent hover:bg-accent/80"
            aria-label={t('timestampSelector.setCurrentTimestamp')}
          >
            <UpdateIcon className="text-lg" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            disabled={disabled}
            className="size-8 bg-accent hover:bg-accent/80"
            aria-label={t('timestampSelector.clearTimestamp')}
          >
            <CloseIcon className="text-lg" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TimestampSelector;
