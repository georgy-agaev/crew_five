import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useAsyncState } from './useAsyncState';

describe('useAsyncState', () => {
  it('tracks loading, data, and error around async function', async () => {
    const fn = vi.fn().mockResolvedValue({ value: 42 });
    const { result } = renderHook(() => useAsyncState(fn));

    expect(result.current[0].loading).toBe(false);
    expect(result.current[0].data).toBeNull();

    await act(async () => {
      await result.current[1]('arg1');
    });

    expect(fn).toHaveBeenCalledWith('arg1');
    expect(result.current[0].loading).toBe(false);
    expect(result.current[0].error).toBeNull();
    expect(result.current[0].data).toEqual({ value: 42 });
  });

  it('captures errors and clears data on failure', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useAsyncState(fn));

    await act(async () => {
      await result.current[1]();
    });

    expect(result.current[0].loading).toBe(false);
    expect(result.current[0].data).toBeNull();
    expect(result.current[0].error).toBe('boom');
  });
});

