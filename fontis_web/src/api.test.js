import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fetchRootNodes, searchNodes, createBackup } from './api';

describe('API Client', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('fetchRootNodes marks returned root nodes as open', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => [{ id: 'root-1', label: 'Mein Archiv' }]
        }));

        const nodes = await fetchRootNodes();
        expect(fetch).toHaveBeenCalledWith('/api/nodes/root', {});
        expect(nodes).toEqual([{ id: 'root-1', label: 'Mein Archiv', isOpen: true }]);
    });

    it('searchNodes builds query parameters properly', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => []
        }));

        await searchNodes(['Urkunde', '1848'], '1800', '1900', 10, 25, 'hybrid', true);
        expect(fetch).toHaveBeenCalledWith(
            '/api/search?q=Urkunde&q=1848&from_year=1800&to_year=1900&offset=10&limit=25&mode=hybrid&lowest_level_only=true',
            {}
        );
    });

    it('createBackup posts to /api/backups', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ status: 'ok', filename: 'archiv_2026.db' })
        }));

        const res = await createBackup();
        expect(fetch).toHaveBeenCalledWith('/api/backups', { method: 'POST' });
        expect(res.filename).toBe('archiv_2026.db');
    });
});
