import { useCallback, useState } from 'react';

type AsyncFn<TArgs extends any[], TResult> = (...args: TArgs) => Promise<TResult>;

export type AsyncState<TResult> = {
  data: TResult | null;
  loading: boolean;
  error: string | null;
};

export function useAsyncState<TArgs extends any[], TResult>(
  fn: AsyncFn<TArgs, TResult>
): [AsyncState<TResult>, (...args: TArgs) => Promise<TResult | null>] {
  const [state, setState] = useState<AsyncState<TResult>>({
    data: null,
    loading: false,
    error: null,
  });

  const run = useCallback(
    async (...args: TArgs) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const result = await fn(...args);
        setState({ data: result, loading: false, error: null });
        return result;
      } catch (err: any) {
        const message = err?.message ?? 'Request failed';
        setState({ data: null, loading: false, error: message });
        return null;
      }
    },
    [fn]
  );

  return [state, run];
}

