import { describe, it, expect, beforeAll } from 'vitest';
import { spellChecker } from './spellChecker';

describe('SpellCheckerService', () => {
    beforeAll(async () => {
        await spellChecker.init();
    });

    it('initializes dictionary correctly', () => {
        expect(spellChecker.isLoaded).toBe(true);
    });

    it('identifies correctly spelled German words', () => {
        expect(spellChecker.isWordValid('Haus')).toBe(true);
        expect(spellChecker.isWordValid('Archiv')).toBe(true);
        expect(spellChecker.isWordValid('Dokumentation')).toBe(true);
        expect(spellChecker.isWordValid('Bürgermeister')).toBe(true);
    });

    it('identifies correctly spelled English words', () => {
        expect(spellChecker.isWordValid('history')).toBe(true);
        expect(spellChecker.isWordValid('community')).toBe(true);
        expect(spellChecker.isWordValid('archive')).toBe(true);
        expect(spellChecker.isWordValid('document')).toBe(true);
    });

    it('treats words shorter than four characters as valid to avoid flagging abbreviations', () => {
        expect(spellChecker.isWordValid('ca')).toBe(true);
        expect(spellChecker.isWordValid('Az')).toBe(true);
        expect(spellChecker.isWordValid('fol')).toBe(true);
        expect(spellChecker.isWordValid('xyz')).toBe(true);
    });

    it('identifies whitelisted archival terms', () => {
        expect(spellChecker.isWordValid('Salbuch')).toBe(true);
        expect(spellChecker.isWordValid('Urbar')).toBe(true);
        expect(spellChecker.isWordValid('Foliant')).toBe(true);
        expect(spellChecker.isWordValid('Findbuch')).toBe(true);
        expect(spellChecker.isWordValid('Provenienz')).toBe(true);
    });

    it('identifies misspelled words', () => {
        expect(spellChecker.isWordValid('Rechtschraibung')).toBe(false);
        expect(spellChecker.isWordValid('Dokumment')).toBe(false);
        expect(spellChecker.isWordValid('Archiw')).toBe(false);
    });

    it('finds error ranges in full sentences', () => {
        const text = 'Das ist ein fehlafter Text im Archiw.';
        const errors = spellChecker.findErrors(text);
        expect(errors.length).toBe(2);
        expect(errors[0].word).toBe('fehlafter');
        expect(errors[1].word).toBe('Archiw');
    });

    it('allows adding custom words to dictionary', () => {
        expect(spellChecker.isWordValid('Xyloflupp')).toBe(false);
        spellChecker.addCustomWord('Xyloflupp');
        expect(spellChecker.isWordValid('Xyloflupp')).toBe(true);
    });

    it('removes added word from findErrors result', () => {
        expect(spellChecker.findErrors('Ein Kuddelmuddelx reitet vorbei.').length).toBe(1);
        spellChecker.addCustomWord('Kuddelmuddelx');
        expect(spellChecker.findErrors('Ein Kuddelmuddelx reitet vorbei.').length).toBe(0);
    });

    it('provides spelling suggestions for misspelled words', () => {
        const suggestions = spellChecker.getSuggestions('Archiw');
        expect(suggestions.length).toBeGreaterThan(0);
        expect(suggestions.some(s => s.toLowerCase() === 'archiv')).toBe(true);
    });
});
