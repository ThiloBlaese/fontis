import { describe, it, expect } from 'vitest';
import { findNodeById, getSubtreeStats } from './treeUtils';

describe('treeUtils', () => {
    const mockTree = [
        {
            id: '1', label: 'Root', children: [
                {
                    id: '1.1', label: 'Child 1.1', children: [
                        { id: '1.1.1', label: 'Deep Child' }
                    ]
                },
                { id: '1.2', label: 'Child 1.2' }
            ]
        },
        { id: '2', label: 'Root 2' }
    ];

    it('should find a root node by id', () => {
        const found = findNodeById(mockTree, '1');
        expect(found.label).toBe('Root');
    });

    it('should find a nested node by id', () => {
        const found = findNodeById(mockTree, '1.1.1');
        expect(found.label).toBe('Deep Child');
    });

    it('should return null if node is not found', () => {
        const found = findNodeById(mockTree, '999');
        expect(found).toBe(null);
    });

    it('should count subnodes and records recursively via getSubtreeStats', () => {
        const treeWithCounts = {
            id: '1',
            label: 'Root',
            recordCount: 2,
            children: [
                {
                    id: '1.1',
                    label: 'Child 1.1',
                    recordCount: 3,
                    children: [{ id: '1.1.1', label: 'Deep Child', recordCount: 5 }]
                },
                { id: '1.2', label: 'Child 1.2', recordCount: 1 }
            ]
        };

        expect(getSubtreeStats(treeWithCounts)).toEqual({ subnodesCount: 3, recordsCount: 11 });
        expect(getSubtreeStats(null)).toEqual({ subnodesCount: 0, recordsCount: 0 });
    });
});
