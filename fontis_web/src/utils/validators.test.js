import { describe, it, expect } from 'vitest';
import { identifyRuntimeContent, identifyBlockingPeriod } from './validators';

describe('Validators Utility', () => {
    describe('identifyRuntimeContent', () => {
        it('should return true for valid year ranges', () => {
            expect(identifyRuntimeContent('1950 - 1960')).toBe(true);
            expect(identifyRuntimeContent('1950-1960')).toBe(true);
            expect(identifyRuntimeContent('ca. 1950')).toBe(true);
            expect(identifyRuntimeContent('1950')).toBe(true);
        });

        it('should return false for non-date strings', () => {
            expect(identifyRuntimeContent('Hallo Welt')).toBe(false);
            expect(identifyRuntimeContent('Aktenzeichen 123')).toBe(false);
            expect(identifyRuntimeContent('')).toBe(false);
        });
    });

    describe('identifyBlockingPeriod', () => {
        it('should return true for future years', () => {
            const currentYear = new Date().getFullYear();
            expect(identifyBlockingPeriod((currentYear + 5).toString())).toBe(true);
        });

        it('should return false for current or past years', () => {
            const currentYear = new Date().getFullYear();
            expect(identifyBlockingPeriod((currentYear - 1).toString())).toBe(false);
            // Optional: current year depends on exact date, but usually runtime
        });

        it('should handle full date strings in future', () => {
            const futureDate = '01.01.2099';
            expect(identifyBlockingPeriod(futureDate)).toBe(true);
        });

        it('should handle ! wrapping', () => {
            expect(identifyBlockingPeriod('! 2050 !')).toBe(true);
        });

        it('should return false for invalid input', () => {
            expect(identifyBlockingPeriod('Keine Sperrfrist')).toBe(false);
        });
    });
});
