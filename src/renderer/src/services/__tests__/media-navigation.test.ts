import { describe, expect, it } from 'vitest';
import { nextMediaPath } from '../media-navigation';
const items = [{ path: 'a.mp4' }, { path: 'b.mp4' }, { path: 'c.mp4' }];
describe('media navigation', () => {
  it('advances from the current file and wraps without repeating it', () => {
    expect(nextMediaPath(items, 'a.mp4')).toBe('b.mp4');
    expect(nextMediaPath(items, 'b.mp4')).toBe('c.mp4');
    expect(nextMediaPath(items, 'c.mp4')).toBe('a.mp4');
    expect(nextMediaPath(items, 'a.mp4', -1)).toBe('c.mp4');
  });
  it('does not replay a singleton, even with duplicate catalog entries', () => {
    expect(nextMediaPath([], 'a.mp4')).toBeNull();
    expect(nextMediaPath([{ path: 'a.mp4' }, { path: 'a.mp4' }], 'a.mp4')).toBeNull();
  });
  it('handles a removed current file', () => {
    expect(nextMediaPath(items, 'removed.mp4')).toBe('a.mp4');
  });
});
