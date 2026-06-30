import { format, isValid } from 'date-fns';
import { Timestamp, DateFormat, TimeFormat } from './types';

export const emptyTimestamp = (): Timestamp => ({
    day: '',
    month: '',
    year: '',
    hour: '',
    minute: '',
});

export const isTimestampEmpty = (timestamp: Timestamp): boolean => (
    !timestamp.day &&
    !timestamp.month &&
    !timestamp.year &&
    !timestamp.hour &&
    !timestamp.minute &&
    !timestamp.ampm
);

// Helper to check if a timestamp is fully populated
export const isTimestampComplete = (timestamp: Timestamp, timeFormat: TimeFormat): boolean => {
    const baseComplete = !!(timestamp.year && timestamp.month && timestamp.day && timestamp.hour && timestamp.minute);
    if (timeFormat === '12h') {
        return baseComplete && !!timestamp.ampm;
    }
    return baseComplete;
};

export const dateToTimestamp = (date: Date, timeFormat: TimeFormat): Timestamp => ({
    day: format(date, 'dd'),
    month: format(date, 'MM'),
    year: format(date, 'yyyy'),
    hour: format(date, timeFormat === '12h' ? 'hh' : 'HH'),
    minute: format(date, 'mm'),
    ...(timeFormat === '12h' && { ampm: format(date, 'aa').toUpperCase() as 'AM' | 'PM' }),
});

export const unixSecondsToTimestamp = (seconds: number, timeFormat: TimeFormat): Timestamp => {
    if (!Number.isFinite(seconds) || seconds <= 0) {
        return emptyTimestamp();
    }

    const date = new Date(seconds * 1000);
    if (!isValid(date)) {
        return emptyTimestamp();
    }

    return dateToTimestamp(date, timeFormat);
};

export const timestampToDate = (timestamp: Timestamp): Date | null => {
    if (!timestamp.day || !timestamp.month || !timestamp.year) {
        return null;
    }

    const year = parseInt(timestamp.year, 10);
    const month = parseInt(timestamp.month, 10) - 1;
    const day = parseInt(timestamp.day, 10);
    const hour = parseInt(timestamp.hour || '0', 10);
    const minute = parseInt(timestamp.minute || '0', 10);

    if ([year, month, day, hour, minute].some((part) => Number.isNaN(part))) {
        return null;
    }

    let hour24 = hour;
    if (timestamp.ampm === 'PM' && hour24 < 12) hour24 += 12;
    else if (timestamp.ampm === 'AM' && hour24 === 12) hour24 = 0;

    const date = new Date(year, month, day, hour24, minute);
    if (!isValid(date) || date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
        return null;
    }

    return date;
};

export const timestampToMillis = (timestamp: Timestamp): number => {
    const date = timestampToDate(timestamp);
    return date ? date.getTime() : 0;
};

export const convertTimestampTimeFormat = (timestamp: Timestamp, timeFormat: TimeFormat): Timestamp => {
    if (isTimestampEmpty(timestamp)) {
        return emptyTimestamp();
    }

    const date = timestampToDate(timestamp);
    if (!date) {
        return timestamp;
    }

    return dateToTimestamp(date, timeFormat);
};

// Converts a Date object into a formatted string based on settings
export const formatDateObj = (
    date: Date | null,
    dateFormat: DateFormat,
    timeFormat: TimeFormat
): string => {
    if (!date || !isValid(date)) {
        return '';
    }

    // Map our internal format tokens to date-fns tokens
    const dateFnsFormat = dateFormat
        .replace('DD', 'dd')
        .replace('MM', 'MM')
        .replace('YYYY', 'yyyy');

    // Time part
    const timeFnsFormat = timeFormat === '24h' ? 'HH:mm' : 'hh:mm aa';

    return format(date, `${dateFnsFormat} ${timeFnsFormat}`);
}

// Converts a Timestamp object into a formatted string based on settings
export const formatTimestamp = (
    timestamp: Timestamp,
    dateFormat: DateFormat,
    timeFormat: TimeFormat
): string => {
    if (!isTimestampComplete(timestamp, timeFormat)) {
        return '';
    }

    const date = timestampToDate(timestamp);
    if (!date) {
        return '';
    }

    return formatDateObj(date, dateFormat, timeFormat);
};

// Formats only the date part from an ISO string
export const formatDate = (
    isoDateString: string,
    dateFormat: DateFormat
): string => {
    const date = new Date(isoDateString);
    if (!isValid(date)) {
        return 'Invalid Date';
    }

    const dateFnsFormat = dateFormat
        .replace('DD', 'dd')
        .replace('MM', 'MM')
        .replace('YYYY', 'yyyy');

    return format(date, dateFnsFormat);
}
