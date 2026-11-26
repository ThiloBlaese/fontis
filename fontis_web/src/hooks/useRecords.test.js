import { describe, it, expect } from 'vitest';
import { incrementSignature } from './useRecords';

describe('incrementSignature', () => {
  it('should increment trailing digits correctly', () => {
    expect(incrementSignature('E-2C-93')).toBe('E-2C-94');
    expect(incrementSignature('E-2C-99')).toBe('E-2C-100');
    expect(incrementSignature('A1')).toBe('A2');
  });

  it('should preserve padding of trailing digits', () => {
    expect(incrementSignature('E-2C-09')).toBe('E-2C-10');
    expect(incrementSignature('E-2C-009')).toBe('E-2C-010');
    expect(incrementSignature('0001')).toBe('0002');
  });

  it('should return empty string if signature does not end in digits', () => {
    expect(incrementSignature('E-2C-93a')).toBe('');
    expect(incrementSignature('Archive-A')).toBe('');
    expect(incrementSignature('abc')).toBe('');
    expect(incrementSignature('')).toBe('');
    expect(incrementSignature(null)).toBe('');
  });
});
