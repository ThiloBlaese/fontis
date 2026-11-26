import { describe, it, expect, beforeEach } from 'vitest';

describe('LocalStorage Persistence', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('should save and retrieve active node state from localStorage', () => {
        localStorage.setItem('fontis_activeNodeId', 'node-123');
        expect(localStorage.getItem('fontis_activeNodeId')).toBe('node-123');
    });

    it('should handle JSON arrays in localStorage', () => {
        const key = 'fontis_expanded_nodes';
        const nodes = ['node1', 'node2'];

        localStorage.setItem(key, JSON.stringify(nodes));
        const retrieved = JSON.parse(localStorage.getItem(key));

        expect(retrieved).toContain('node1');
        expect(retrieved).toHaveLength(2);
    });
});

describe('Search Navigation Logic', () => {
    it('should correctly jump to record when node is already active', () => {
        let currentRecordIndex = 0;
        const handleJumpToRecord = (idx) => { currentRecordIndex = idx; };

        const activeNodeId = 'node-123';
        const searchHitNodeId = 'node-123';
        const searchHitRecordIndex = 3;

        if (String(activeNodeId) === String(searchHitNodeId)) {
            handleJumpToRecord(searchHitRecordIndex);
        }

        expect(currentRecordIndex).toBe(3);
    });

    it('should set targetRecordIndexRef and switch node when hit is in another node', () => {
        let activeNodeId = 'node-123';
        const targetRecordIndexRef = { current: null };

        const searchHitNodeId = 'node-456';
        const searchHitRecordIndex = 5;

        if (String(activeNodeId) !== String(searchHitNodeId)) {
            targetRecordIndexRef.current = searchHitRecordIndex;
            activeNodeId = String(searchHitNodeId);
        }

        expect(activeNodeId).toBe('node-456');
        expect(targetRecordIndexRef.current).toBe(5);
    });
});
