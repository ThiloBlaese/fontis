/**
 * Identifies if the content represents a valid runtime (Laufzeit).
 * Criteria:
 * 1. Contains 1 or 2 dates.
 * 2. Format: "DD.MM.YYYY" or "D.M.YYYY" or "YYYY".
 * 3. All dates must be in the past.
 * 4. Can contain arbitrary text around the dates.
 * 
 * @param {string} text - The input text to validate.
 * @param {Date} [referenceDate] - Optional reference date for "past" check (default: now).
 * @returns {boolean} - True if it's a valid runtime, false otherwise.
 */
export const identifyRuntimeContent = (text, referenceDate = new Date()) => {
    if (!text || typeof text !== 'string' || text.trim() === '') {
        return false;
    }

    const trimmedText = text.trim();

    // Explicitly ignore content tailored for blocking periods (wrapped in !)
    if (/^\s*!\s*.*\s*!\s*$/.test(trimmedText)) {
        return false;
    }

    // Strict Regex for Supported Formats:
    // 1. Single Date: "DD.MM.YYYY" or "D.M.YYYY" or "YYYY"
    // 2. Date Range: "Date - Date" or "Date-Date"
    //
    // Components:
    // - Year: \d{4}
    // - Day.Month.Year: \d{1,2}\.\d{1,2}\.\d{4}
    //
    // We compose a regex that matches the *entire* string (Anchored with ^ and $).

    const datePattern = `(?:\\d{1,2}\\.\\d{1,2}\\.\\d{4}|\\d{4})`;
    const globalDateRegex = new RegExp(datePattern, 'g');

    const dateMatches = trimmedText.match(globalDateRegex);
    if (!dateMatches || dateMatches.length > 2) {
        return false;
    }

    let dateStrings = dateMatches;

    // Now validate the extracted date strings (parse and check logic)
    // Use start of tomorrow to allow "today" as valid past/present date
    const cutoffDate = new Date(referenceDate);
    cutoffDate.setDate(cutoffDate.getDate() + 1);
    cutoffDate.setHours(0, 0, 0, 0);

    const validDates = [];

    for (const dateStr of dateStrings) {
        let dateObj = null;

        if (dateStr.includes('.')) {
            const parts = dateStr.split('.');
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const year = parseInt(parts[2], 10);

            dateObj = new Date(year, month, day);
            dateObj.setFullYear(year); // Explicitly set full year

            if (dateObj.getFullYear() !== year || dateObj.getMonth() !== month || dateObj.getDate() !== day) {
                return false; // Invalid date (e.g. 32.01.2023)
            }
        } else {
            const year = parseInt(dateStr, 10);
            // Basic sanity check for year range
            if (year < 1000 || year > 9999) return false;

            dateObj = new Date(year, 0, 1);
            dateObj.setFullYear(year);
        }

        // Check if date is strictly in the future (tomorrow or later)
        // If it is in the future, it's NOT a runtime (could be a Blocking Period, or just future info)
        if (dateObj >= cutoffDate) return false;

        validDates.push(dateObj);
    }

    // Check strict chronological order for ranges
    if (validDates.length === 2) {
        if (validDates[0] > validDates[1]) {
            return false;
        }
    }

    return true;
};

/**
 * Identifies if the content represents a blocking period (Sperrfrist).
 * Criteria:
 * 1. Contains exactly 1 date.
 * 2. Date is strictly in the future (tomorrow or later).
 * 3. Supports wrapping in '!' (e.g. "! 2030 !").
 * 
 * @param {string} text - The input text to validate.
 * @param {Date} [referenceDate] - Optional reference date for "future" check (default: now).
 * @returns {boolean} - True if it's a blocking period.
 */
export const identifyBlockingPeriod = (text, referenceDate = new Date()) => {
    if (!text || typeof text !== 'string' || text.trim() === '') {
        return false;
    }

    const dateRegex = /(?:\b\d{1,2}\s*\.\s*\d{1,2}\s*\.\s*\d{4}\b)|(?:\b\d{4}\b)/g;
    const matches = text.match(dateRegex);

    // Blocking period must be a SINGLE date
    if (!matches || matches.length !== 1) return false;

    // Use start of tomorrow for strict future check
    const cutoffDate = new Date(referenceDate);
    cutoffDate.setDate(cutoffDate.getDate() + 1);
    cutoffDate.setHours(0, 0, 0, 0);

    const matchStr = matches[0];
    let dateObj = null;
    const cleanStr = matchStr.replace(/\s/g, '');

    if (cleanStr.includes('.')) {
        const parts = cleanStr.split('.');
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);

        dateObj = new Date(year, month, day);
        dateObj.setFullYear(year);

        if (dateObj.getFullYear() !== year || dateObj.getMonth() !== month || dateObj.getDate() !== day) {
            return false;
        }
    } else {
        const year = parseInt(cleanStr, 10);
        if (year < 1000 || year > 9999) return false;
        dateObj = new Date(year, 0, 1); // rough estimate for just year
        dateObj.setFullYear(year);
    }

    return dateObj >= cutoffDate;
};
