
// A simple utility library for handling the game's custom time string format.

/**
 * Parses the game's time string into a JavaScript Date object.
 * @param timeString The string from gameData, e.g., "July 26, 2024, 08:30"
 * @returns A Date object or null if parsing fails.
 */
export const parseGameTime = (timeString: string): Date | null => {
    try {
        // The format is "Month Day, Year, HH:MM" which is natively understood by the Date constructor.
        const date = new Date(timeString);
        if (isNaN(date.getTime())) {
            // Handle invalid date strings gracefully
            throw new Error('Invalid date format');
        }
        return date;
    } catch (e) {
        console.error("Could not parse game time string:", timeString, e);
        return null;
    }
};

/**
 * Formats a Date object back into the game's standard string format.
 * @param date The Date object to format.
 * @returns A string in the format "Month Day, Year, HH:MM".
 */
export const formatGameTime = (date: Date): string => {
    const options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    };
    const datePart = date.toLocaleDateString('en-US', options);
    const timePart = date.toTimeString().slice(0, 5); // Extracts HH:MM
    return `${datePart}, ${timePart}`;
};

/**
 * Adds a specified duration to a Date object.
 * @param date The starting date.
 * @param hours The number of hours to add.
 * @param minutes The number of minutes to add.
 * @param seconds The number of seconds to add.
 * @returns A new Date object with the added duration.
 */
export const addDuration = (date: Date, hours: number = 0, minutes: number = 0, seconds: number = 0): Date => {
    const newDate = new Date(date.getTime());
    newDate.setHours(newDate.getHours() + hours);
    newDate.setMinutes(newDate.getMinutes() + minutes);
    newDate.setSeconds(newDate.getSeconds() + seconds);
    return newDate;
};

/**
 * Converts a time string into a narrative period.
 */
export const getTimePeriod = (timeString: string): string => {
    const date = parseGameTime(timeString);
    if (!date) return 'Unknown';

    const hours = date.getHours();
    const minutes = date.getMinutes();

    if (hours === 0 && minutes === 0) return 'Midnight';
    if (hours >= 5 && hours < 8) return 'Dawn';
    if (hours >= 8 && hours < 12) return 'Morning';
    if (hours >= 12 && hours < 14) return 'Midday';
    if (hours >= 14 && hours < 17) return 'Afternoon';
    if (hours >= 17 && hours < 20) return 'Dusk';
    return 'Night';
};
/**
 * Calculates a relative time string between two in-game timestamps.
 * Returns a string like "2 days and 5 hours ago".
 * @param currentTimeStr The reference current time string.
 * @param pastTimeStr The past time string to compare against.
 */
export const getRelativeTimeString = (currentTimeStr: string, pastTimeStr: string): string => {
    const current = parseGameTime(currentTimeStr);
    const past = parseGameTime(pastTimeStr);
    
    if (!current || !past) return "some time ago";

    const diffMs = current.getTime() - past.getTime();
    
    // Safety check: if past is somehow in the future, just return the raw time or a blank
    if (diffMs < 0) return "very recently";

    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    const remainingHours = diffHours % 24;
    const remainingMinutes = diffMinutes % 60;

    // Cases for small time differences
    if (diffDays === 0 && remainingHours === 0) {
        if (remainingMinutes === 0) return "just now";
        return `${remainingMinutes} minute${remainingMinutes === 1 ? '' : 's'} ago`;
    }

    // Standard case: "X days and Y hours ago"
    let parts: string[] = [];
    if (diffDays > 0) {
        parts.push(`${diffDays} day${diffDays === 1 ? '' : 's'}`);
    }
    if (remainingHours > 0) {
        parts.push(`${remainingHours} hour${remainingHours === 1 ? '' : 's'}`);
    }

    return `${parts.join(' and ')} ago`;
};
