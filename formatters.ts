import { format, isValid } from 'date-fns';
import { Timestamp, DateFormat, TimeFormat } from './types';

// Helper to check if a timestamp is fully populated
const isTimestampComplete = (timestamp: Timestamp, timeFormat: TimeFormat): boolean => {
    const baseComplete = !!(timestamp.year && timestamp.month && timestamp.day && timestamp.hour && timestamp.minute);
    if (timeFormat === '12h') {
        return baseComplete && !!timestamp.ampm;
    }
    return baseComplete;
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

    const { year, month, day, hour, minute, ampm } = timestamp;
    let hour24 = parseInt(hour);

    if (timeFormat === '12h' && ampm) {
        if (ampm === 'PM' && hour24 < 12) {
            hour24 += 12;
        }
        if (ampm === 'AM' && hour24 === 12) { // Midnight case (12 AM is 00:00)
            hour24 = 0;
        }
    }

    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), hour24, parseInt(minute));

    // Check for invalid date from parts
    if (!isValid(date) || date.getFullYear() !== parseInt(year) || date.getMonth() !== parseInt(month) - 1 || date.getDate() !== parseInt(day)) {
        return ''; // Return empty for invalid constructed dates like 31/02
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