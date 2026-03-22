import { useCallback, useState } from 'react';

function getStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

function readKey<T>(key: string, fallback: T): T {
  const storage = getStorage();
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeKey<T>(key: string, value: T): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // quota exceeded or other storage error — ignore
  }
}

/**
 * Like useState but persists to localStorage under a namespaced key.
 * Reads initial value from storage on first render; writes on every set.
 * Falls back to `fallback` if storage is unavailable or corrupt.
 */
export function usePersistedState<T>(key: string, fallback: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setStateRaw] = useState<T>(() => readKey(key, fallback));

  const setState = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStateRaw((prev) => {
        const next = typeof value === 'function' ? (value as (prev: T) => T)(prev) : value;
        writeKey(key, next);
        return next;
      });
    },
    [key]
  );

  return [state, setState];
}

/** Read a persisted value without a React hook (useful in effects for validation). */
export function readPersistedValue<T>(key: string, fallback: T): T {
  return readKey(key, fallback);
}

/** Write a persisted value imperatively. */
export function writePersistedValue<T>(key: string, value: T): void {
  writeKey(key, value);
}
