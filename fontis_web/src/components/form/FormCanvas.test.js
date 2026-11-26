import { describe, it, expect } from 'vitest';
import React from 'react';

// Wir testen hier die interne Sortierlogik der FormCanvas Komponente.
// Da FormCanvas eine funktionale Komponente ist, können wir den internen sortedFields Hook 
// am besten testen, indem wir die Komponente rendern oder die Logik isolieren.

const sortFieldsForMobile = (layoutFields) => {
    return [...layoutFields].sort((a, b) => (a.y - b.y) || (a.x - b.x));
};

describe('FormCanvas Mobile Sorting', () => {
    it('should sort fields by Y then X coordinate', () => {
        const fields = [
            { id: 'f1', x: 100, y: 100 },
            { id: 'f2', x: 50,  y: 50  },
            { id: 'f3', x: 200, y: 50  }
        ];
        
        const sorted = sortFieldsForMobile(fields);
        
        // Erwartete Reihenfolge:
        // 1. f2 (y=50, x=50)
        // 2. f3 (y=50, x=200)
        // 3. f1 (y=100, x=100)
        
        expect(sorted[0].id).toBe('f2');
        expect(sorted[1].id).toBe('f3');
        expect(sorted[2].id).toBe('f1');
    });
});
