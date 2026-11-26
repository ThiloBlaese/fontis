import nspell from 'nspell';
import { safeStorage } from './storage';

// Common archival terms and German abbreviations to whitelist by default
const DEFAULT_WHITELIST = [
    // Archival & historic terms
    'Bestand', 'Bestände', 'Signatur', 'Signaturen', 'Laufzeit', 'Laufzeiten',
    'Sperrfrist', 'Schutzfrist', 'Findbuch', 'Findbücher', 'Archivalie', 'Archivalien',
    'Akten', 'Urkunde', 'Urkunden', 'Foliant', 'Folianten', 'Salbuch', 'Salbücher',
    'Urbar', 'Urbare', 'Kopiar', 'Kopiare', 'Konvolut', 'Konvolute', 'Faszikel',
    'Repositur', 'Pertinenz', 'Provenienz', 'Provenienzprinzip', 'Registratur',
    'Aktenplan', 'Kassation', 'Depot', 'Depositum', 'Deposita', 'Nachlass', 'Nachlässe',
    'Amtsbuch', 'Amtsbücher', 'Protokollbuch', 'Ratsprotokoll', 'Zunft', 'Zünfte',
    'Gilde', 'Gilden', 'Lehen', 'Lehnbuch', 'Matrikel', 'Matrikeln',
    // Latin & formal archival abbreviations
    'Acta', 'Actum', 'Anno', 'Item', 'Idem', 'Ibidem', 'fol', 'pag', 'Bl', 'Bd', 'Bde',
    'dito', 'ebda', 'ff', 'passim', 'recto', 'verso',
    // Common abbreviations
    'z.B', 'u.a', 'd.h', 'bzw', 'ca', 'inkl', 'exkl', 'evtl', 'usw', 'etc',
    'Dr', 'Prof', 'St', 'Sankt', 'Jh', 'Jhd', 'Nr', 'Az', 'Gz', 'Hrsg', 'hrsg',
    'vgl', 's.o', 's.u', 'Abb', 'Tab', 'orig', 'Abs', 'Art', 'Par'
];

class SpellCheckerService {
    constructor() {
        this.spellDe = null;
        this.spellEn = null;
        this.spell = null; // backward compatibility
        this.isLoading = false;
        this.isLoaded = false;
        this.listeners = new Set();
        this.customWords = new Set();
        this.loadCustomWords();
    }

    loadCustomWords() {
        try {
            const stored = safeStorage.getItem('fontis_custom_dictionary');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    parsed.forEach(w => {
                        this.customWords.add(w.toLowerCase());
                        this.customWords.add(w);
                    });
                }
            }
        } catch (e) {
            console.warn('Failed to load custom dictionary from safeStorage', e);
        }
        if (typeof fetch !== 'undefined') {
            this.syncWithBackend();
        }
    }

    async reloadFromBackend() {
        this.customWords.clear();
        this.saveCustomWords();
        await this.syncWithBackend();
    }

    async syncWithBackend() {
        if (typeof window === 'undefined' || !window.location || !window.location.protocol?.startsWith('http')) {
            return;
        }
        try {
            const res = await fetch('/api/system/dictionary');
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data.words)) {
                    this.customWords.clear();
                    data.words.forEach(w => {
                        const clean = w.trim();
                        this.customWords.add(clean.toLowerCase());
                        this.customWords.add(clean);
                        const titleCase = clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
                        if (this.spellDe) {
                            try {
                                this.spellDe.add(clean);
                                this.spellDe.add(clean.toLowerCase());
                                this.spellDe.add(titleCase);
                            } catch (_) {}
                        }
                        if (this.spellEn) {
                            try {
                                this.spellEn.add(clean);
                                this.spellEn.add(clean.toLowerCase());
                                this.spellEn.add(titleCase);
                            } catch (_) {}
                        }
                    });
                    this.saveCustomWords();
                    this.notifyListeners();
                }
            }
        } catch (e) {
            // Ignore if backend is currently unreachable
        }
    }

    saveCustomWords() {
        try {
            safeStorage.setItem('fontis_custom_dictionary', JSON.stringify(Array.from(this.customWords)));
        } catch (e) {
            console.warn('Failed to save custom dictionary to safeStorage', e);
        }
    }

    async addCustomWord(word) {
        if (!word || typeof word !== 'string') return;
        const clean = word.replace(/^[^a-zA-ZäöüÄÖÜß]+|[^a-zA-ZäöüÄÖÜß]+$/g, '').trim();
        if (!clean) return;
        
        this.customWords.add(clean.toLowerCase());
        this.customWords.add(clean);
        this.saveCustomWords();
        const titleCase = clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
        if (this.spellDe) {
            try {
                this.spellDe.add(clean);
                this.spellDe.add(clean.toLowerCase());
                this.spellDe.add(titleCase);
            } catch (err) {
                console.warn('Could not add word to German nspell runtime', err);
            }
        }
        if (this.spellEn) {
            try {
                this.spellEn.add(clean);
                this.spellEn.add(clean.toLowerCase());
                this.spellEn.add(titleCase);
            } catch (err) {
                console.warn('Could not add word to English nspell runtime', err);
            }
        }
        this.notifyListeners();

        try {
            if (typeof window !== 'undefined' && window.location && window.location.protocol?.startsWith('http')) {
                await fetch('/api/system/dictionary', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ word: clean })
                });
            }
        } catch (e) {
            // Silently ignore network failures (offline / tests)
        }
    }

    async removeCustomWord(word) {
        if (!word) return;
        const clean = word.trim();
        this.customWords.delete(clean.toLowerCase());
        this.customWords.delete(clean);
        this.saveCustomWords();
        this.notifyListeners();

        try {
            if (typeof window !== 'undefined' && window.location && window.location.protocol?.startsWith('http')) {
                await fetch(`/api/system/dictionary/${encodeURIComponent(clean)}`, {
                    method: 'DELETE'
                });
            }
        } catch (e) {
            // Silently ignore network failures (offline / tests)
        }
    }

    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    notifyListeners() {
        this.listeners.forEach(cb => {
            try { cb(); } catch (e) { console.error(e); }
        });
    }

    async init() {
        if (this.isLoaded || this.isLoading) return;
        this.isLoading = true;

        try {
            const [affDeModule, dicDeModule, affEnModule, dicEnModule] = await Promise.all([
                import('../assets/dictionaries/de/index.aff?raw'),
                import('../assets/dictionaries/de/index.dic?raw'),
                import('../assets/dictionaries/en/index.aff?raw'),
                import('../assets/dictionaries/en/index.dic?raw')
            ]);

            const affDeText = affDeModule.default;
            const dicDeText = dicDeModule.default;
            const affEnText = affEnModule.default;
            const dicEnText = dicEnModule.default;

            if (affDeText && dicDeText) {
                this.spellDe = nspell(affDeText, dicDeText);
                this.spell = this.spellDe;
                // Add whitelisted terms
                DEFAULT_WHITELIST.forEach(w => {
                    try { this.spellDe.add(w); } catch (_) {}
                });
                // Add user custom words
                this.customWords.forEach(w => {
                    try { this.spellDe.add(w); } catch (_) {}
                });
            }

            if (affEnText && dicEnText) {
                this.spellEn = nspell(affEnText, dicEnText);
                this.customWords.forEach(w => {
                    try { this.spellEn.add(w); } catch (_) {}
                });
            }

            this.isLoaded = !!(this.spellDe || this.spellEn);
        } catch (error) {
            console.error('SpellChecker initialization error:', error);
        } finally {
            this.isLoading = false;
            this.notifyListeners();
        }
    }

    checkSimpleWord(w) {
        if (!w || !this.isLoaded) return true;
        if (this.customWords.has(w.toLowerCase()) || this.customWords.has(w)) return true;

        // Check German
        if (this.spellDe) {
            if (this.spellDe.correct(w)) return true;
            if (this.spellDe.correct(w.toLowerCase())) return true;
            const titleCase = w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
            if (this.spellDe.correct(titleCase)) return true;
        }

        // Check English
        if (this.spellEn) {
            if (this.spellEn.correct(w)) return true;
            if (this.spellEn.correct(w.toLowerCase())) return true;
            const titleCase = w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
            if (this.spellEn.correct(titleCase)) return true;
        }

        return false;
    }

    isWordValid(word, depth = 0) {
        if (!word) return true;
        
        // Strip punctuation like quotes, commas, dots
        const clean = word.replace(/^[^a-zA-ZäöüÄÖÜß]+|[^a-zA-ZäöüÄÖÜß]+$/g, '');
        if (!clean) return true;
        // On root level, ignore words shorter than 4 characters (e.g. abbreviations like ca, Nr, fol, etc.)
        if (depth === 0 && clean.length < 4) return true;
        // Inside compound word parts, sub-parts must have at least 3 characters
        if (depth > 0 && clean.length < 3) return false;

        // Skip numbers, roman numerals, signatures (e.g. Best., Nr., 1920)
        if (/^\d+([./-]\d+)*$/.test(clean)) return true;
        if (/^[IVXLCDMivxlcdm]+$/.test(clean)) return true;

        if (!this.isLoaded) return true; // If not loaded yet, don't falsely flag

        // Check custom words immediately
        if (this.customWords.has(clean.toLowerCase()) || this.customWords.has(clean)) return true;

        // Check direct word
        if (this.checkSimpleWord(clean)) return true;

        // For hyphenated compound words (e.g. "Archiv-Verwaltung")
        if (clean.includes('-')) {
            const parts = clean.split('-').filter(Boolean);
            if (parts.length > 1 && parts.every(part => this.isWordValid(part, depth + 1))) {
                return true;
            }
        }

        // German compound words (Komposita-Zerlegung, only for capitalized words e.g. Bürgermeister, Stadtarchiv)
        const isCapitalized = /^[A-ZÄÖÜ]/.test(clean);
        if (isCapitalized && clean.length >= 6 && depth < 2) {
            const fugen = ['', 's', 'es', 'en', 'er', 'e', 'n'];
            for (let i = 3; i <= clean.length - 3; i++) {
                const part1 = clean.slice(0, i);
                const part2 = clean.slice(i);

                let part1Valid = false;
                for (const f of fugen) {
                    if (f && part1.endsWith(f)) {
                        const stripped = part1.slice(0, -f.length);
                        if (stripped.length >= 3 && this.checkSimpleWord(stripped)) {
                            part1Valid = true;
                            break;
                        }
                    }
                }
                if (!part1Valid && this.checkSimpleWord(part1)) {
                    part1Valid = true;
                }

                if (part1Valid) {
                    // In German compound nouns, part2 must be a valid capitalized noun in dictionary
                    const part2Title = part2.charAt(0).toUpperCase() + part2.slice(1).toLowerCase();
                    if (this.checkSimpleWord(part2Title) || (part2.length >= 4 && this.isWordValid(part2Title, depth + 1))) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    getSuggestions(word) {
        if (!this.isLoaded || !word) return [];
        const clean = word.replace(/^[^a-zA-ZäöüÄÖÜß]+|[^a-zA-ZäöüÄÖÜß]+$/g, '');
        if (!clean) return [];
        try {
            const deSug = this.spellDe ? this.spellDe.suggest(clean) : [];
            const enSug = this.spellEn ? this.spellEn.suggest(clean) : [];
            const combined = [...deSug, ...enSug];
            const seen = new Set();
            const unique = [];
            for (const s of combined) {
                if (!seen.has(s)) {
                    seen.add(s);
                    unique.push(s);
                }
            }
            return unique.slice(0, 5);
        } catch (e) {
            return [];
        }
    }

    /**
     * Finds all misspelled words in a given text string.
     * Returns an array of { word, start, end }
     */
    findErrors(text) {
        if (!this.isLoaded || (!this.spellDe && !this.spellEn) || !text || typeof text !== 'string') {
            return [];
        }

        const errors = [];
        // Match words consisting of letters (including German umlauts & ß) and hyphens
        const wordRegex = /[a-zA-ZäöüÄÖÜß]+(?:-[a-zA-ZäöüÄÖÜß]+)*/g;
        let match;

        while ((match = wordRegex.exec(text)) !== null) {
            const word = match[0];
            const start = match.index;
            const end = start + word.length;

            if (!this.isWordValid(word)) {
                errors.push({ word, start, end });
            }
        }

        return errors;
    }
}

export const spellChecker = new SpellCheckerService();
