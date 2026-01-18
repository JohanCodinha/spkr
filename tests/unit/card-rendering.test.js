import { describe, it, expect } from '@jest/globals';
import { truncateToFit } from '../../src/card-rendering.js';

describe('truncateToFit', () => {
  // Mock measureFn: each character = 10px width
  const measureFn = (text) => text.length * 10;

  it('returns text unchanged when it fits', () => {
    expect(truncateToFit('Hello', measureFn, 100)).toBe('Hello'); // 50px < 100px
  });

  it('truncates and adds ellipsis when text overflows', () => {
    const result = truncateToFit('Hello World', measureFn, 80);
    expect(result).toContain('…');
    expect(result.length).toBeLessThan('Hello World'.length);
  });

  it('returns just ellipsis when maxWidth is very small', () => {
    expect(truncateToFit('Hello', measureFn, 5)).toBe('…');
  });

  it('handles empty string', () => {
    expect(truncateToFit('', measureFn, 100)).toBe('');
  });

  it('uses custom ellipsis when provided', () => {
    const result = truncateToFit('Hello World', measureFn, 80, '...');
    expect(result).toContain('...');
    expect(result).not.toContain('…');
  });

  it('truncates to exact fit including ellipsis', () => {
    // maxWidth = 50, ellipsis = 10px, so we have 40px for text = 4 chars
    const result = truncateToFit('ABCDEFGH', measureFn, 50);
    expect(result).toBe('ABCD…');
  });

  it('handles single character that fits', () => {
    expect(truncateToFit('A', measureFn, 10)).toBe('A');
  });

  it('handles single character that does not fit', () => {
    expect(truncateToFit('A', measureFn, 5)).toBe('…');
  });
});
