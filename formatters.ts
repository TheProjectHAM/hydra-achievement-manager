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
    if (!date || isNaN(date.getTime())) {
        return '';
    }

    // Format Date Part
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = String(date.getFullYear());
    let dateString = '';
    switch (dateFormat) {
        case 'DD/MM/YYYY': dateString = `${d}/${m}/${y}`; break;
        case 'MM/DD/YYYY': dateString = `${m}/${d}/${y}`; break;
        case 'YYYY-MM-DD': dateString = `${y}-${m}-${d}`; break;
    }

    // Format Time Part
    let timeString = '';
    if (timeFormat === '24h') {
        timeString = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    } else { // 12h
        const h12 = date.getHours() % 12 || 12;
        const ampm = date.getHours() >= 12 ? 'PM' : 'AM';
        timeString = `${h12}:${String(date.getMinutes()).padStart(2, '0')} ${ampm}`;
    }

    return `${dateString} ${timeString}`;
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
  if (isNaN(date.getTime()) || date.getFullYear() !== parseInt(year) || date.getMonth() !== parseInt(month) - 1 || date.getDate() !== parseInt(day)) {
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
    if (isNaN(date.getTime())) {
        return 'Invalid Date';
    }
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = String(date.getFullYear());
    switch (dateFormat) {
        case 'DD/MM/YYYY': return `${d}/${m}/${y}`;
        case 'MM/DD/YYYY': return `${m}/${d}/${y}`;
        case 'YYYY-MM-DD': return `${y}-${m}-${d}`;
        default: return isoDateString;
    }
}