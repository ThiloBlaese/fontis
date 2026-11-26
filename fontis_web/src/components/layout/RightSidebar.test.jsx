import { describe, it, expect, vi } from 'vitest';
import { searchNodes } from '../../api';

describe('Search API and Sidebar Integration', () => {
    it('should correctly include signal and query params in searchNodes', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => [{ id: 'rec1', metadata: { preview: 'Test' } }]
        });
        vi.stubGlobal('fetch', mockFetch);

        const controller = new AbortController();
        const results = await searchNodes(['Mühle'], '1900', '1950', 0, 50, 'hybrid', true, controller.signal);

        expect(mockFetch).toHaveBeenCalled();
        const callUrl = mockFetch.mock.calls[0][0];
        expect(callUrl).toContain('q=M%C3%BChle');
        expect(callUrl).toContain('from_year=1900');
        expect(callUrl).toContain('to_year=1950');
        expect(callUrl).toContain('mode=hybrid');
        expect(callUrl).toContain('lowest_level_only=true');

        const callOptions = mockFetch.mock.calls[0][1];
        expect(callOptions.signal).toBe(controller.signal);
        expect(results).toHaveLength(1);
    });

    it('should propagate AbortError when aborted', async () => {
        const abortError = new Error('The operation was aborted');
        abortError.name = 'AbortError';

        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError));

        const controller = new AbortController();
        controller.abort();

        await expect(searchNodes(['Test'], '', '', 0, 50, 'classic', false, controller.signal))
            .rejects.toThrow('The operation was aborted');
    });
});
