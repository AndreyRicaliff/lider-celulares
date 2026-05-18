import { useState, useEffect, useCallback } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function useThrottle<T>(value: T, limit: number): T {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const [lastCall, setLastCall] = useState<number>(0);

  useEffect(() => {
    const now = Date.now();
    if (now - lastCall >= limit) {
      setThrottledValue(value);
      setLastCall(now);
    } else {
      const handler = setTimeout(() => {
        setThrottledValue(value);
        setLastCall(Date.now());
      }, limit - (now - lastCall));

      return () => clearTimeout(handler);
    }
  }, [value, limit, lastCall]);

  return throttledValue;
}
