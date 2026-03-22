import { useState, useRef, useCallback, useEffect } from 'react';

export function useDebouncedHover(delay = 150) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onMouseEnter = useCallback(
    (id: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setHoveredId(id), delay);
    },
    [delay]
  );

  const onMouseLeave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setHoveredId(null);
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  return { hoveredId, onMouseEnter, onMouseLeave };
}
