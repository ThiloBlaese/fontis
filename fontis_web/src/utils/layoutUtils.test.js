import { describe, it, expect } from 'vitest';
import { rectsOverlap, hasFieldOverlap, findFreePosition } from './layoutUtils';

describe('layoutUtils', () => {
  it('detects overlapping rectangles and ignores touching edges', () => {
    const a = { x: 0, y: 0, width: 288, height: 128 };
    const bOverlap = { x: 128, y: 64, width: 288, height: 128 };
    const cTouching = { x: 288, y: 0, width: 288, height: 128 };

    expect(rectsOverlap(a, bOverlap)).toBe(true);
    expect(rectsOverlap(a, cTouching)).toBe(false);
  });

  it('excludes the dragged/resized field id from overlap checks', () => {
    const fields = [
      { id: 'f1', x: 0, y: 0, width: 288, height: 128 },
      { id: 'f2', x: 320, y: 0, width: 288, height: 128 },
    ];

    expect(hasFieldOverlap({ x: 32, y: 0, width: 288, height: 128 }, fields, 'f1')).toBe(false);
    expect(hasFieldOverlap({ x: 64, y: 0, width: 288, height: 128 }, fields, 'f1')).toBe(true);
  });

  it('finds nearest free non-overlapping position when preferred spot is occupied', () => {
    const fields = [
      { id: 'f1', x: 0, y: 0, width: 288, height: 128 },
    ];

    const pos = findFreePosition(32, 32, 288, 128, fields);
    expect(pos.x).toBeGreaterThanOrEqual(0);
    expect(pos.y).toBeGreaterThanOrEqual(0);
    expect(hasFieldOverlap({ x: pos.x, y: pos.y, width: 288, height: 128 }, fields)).toBe(false);
  });
});
