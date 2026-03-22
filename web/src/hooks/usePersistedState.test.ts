import { renderHook, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { usePersistedState, readPersistedValue, writePersistedValue } from './usePersistedState';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('usePersistedState', () => {
  it('returns fallback when storage is empty', () => {
    const { result } = renderHook(() => usePersistedState('c5:test:key', 'default'));
    expect(result.current[0]).toBe('default');
  });

  it('restores value from storage', () => {
    localStorage.setItem('c5:test:key', JSON.stringify('saved'));
    const { result } = renderHook(() => usePersistedState('c5:test:key', 'default'));
    expect(result.current[0]).toBe('saved');
  });

  it('writes to storage on set', () => {
    const { result } = renderHook(() => usePersistedState('c5:test:key', 'initial'));
    act(() => { result.current[1]('updated'); });
    expect(result.current[0]).toBe('updated');
    expect(JSON.parse(localStorage.getItem('c5:test:key')!)).toBe('updated');
  });

  it('supports functional updater', () => {
    const { result } = renderHook(() => usePersistedState('c5:test:num', 0));
    act(() => { result.current[1]((prev) => prev + 1); });
    expect(result.current[0]).toBe(1);
    expect(JSON.parse(localStorage.getItem('c5:test:num')!)).toBe(1);
  });

  it('handles corrupt JSON gracefully', () => {
    localStorage.setItem('c5:test:key', '{broken');
    const { result } = renderHook(() => usePersistedState('c5:test:key', 'fallback'));
    expect(result.current[0]).toBe('fallback');
  });

  it('handles storage unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    const { result } = renderHook(() => usePersistedState('c5:test:key', 42));
    expect(result.current[0]).toBe(42);
  });

  it('persists objects', () => {
    const { result } = renderHook(() => usePersistedState('c5:test:obj', { a: 1 }));
    act(() => { result.current[1]({ a: 2 }); });
    expect(result.current[0]).toEqual({ a: 2 });
    expect(JSON.parse(localStorage.getItem('c5:test:obj')!)).toEqual({ a: 2 });
  });
});

describe('readPersistedValue / writePersistedValue', () => {
  it('reads and writes imperatively', () => {
    writePersistedValue('c5:imp:test', [1, 2, 3]);
    expect(readPersistedValue('c5:imp:test', [])).toEqual([1, 2, 3]);
  });

  it('returns fallback on missing key', () => {
    expect(readPersistedValue('c5:imp:missing', 'nope')).toBe('nope');
  });
});
