import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { formatLocalDate } from '../utils/nutrition';

/**
 * Calculates milliseconds remaining until the next local midnight plus a safe 50ms buffer.
 * Enforces a minimum delay of 500ms to prevent busy loops around midnight boundaries.
 */
export function getMsUntilNextMidnight(now: Date = new Date()): number {
  const tomorrow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    0,
    50
  );
  return Math.max(500, tomorrow.getTime() - now.getTime());
}

/**
 * Hook that returns the authoritative local date string (YYYY-MM-DD).
 * It dynamically updates when:
 * 1. The device clock rolls past midnight while the app remains mounted/active.
 * 2. The app resumes from background state.
 * 3. Timezone or DST changes occur between pauses.
 *
 * @param initialDate Optional initial date string (defaults to today).
 * @param clock Optional custom clock function for deterministic testing.
 */
export function useLiveLocalDate(initialDate?: string, clock?: () => Date): string {
  const [todayKey, setTodayKey] = useState<string>(
    () => initialDate || formatLocalDate(clock ? clock() : new Date())
  );

  useEffect(() => {
    const getNow = clock || (() => new Date());

    function refreshDate() {
      const current = formatLocalDate(getNow());
      setTodayKey((prev) => (prev !== current ? current : prev));
    }

    // Refresh immediately on mount/clock change
    refreshDate();

    // 1. AppState listener: refresh local date when app returns to foreground
    function handleAppStateChange(status: AppStateStatus) {
      if (status === 'active') {
        refreshDate();
      }
    }

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // 2. Midnight rollover timer
    let timerId: ReturnType<typeof setTimeout> | null = null;

    function scheduleMidnightUpdate() {
      const delay = getMsUntilNextMidnight(getNow());
      timerId = setTimeout(() => {
        refreshDate();
        scheduleMidnightUpdate();
      }, delay);
    }

    scheduleMidnightUpdate();

    return () => {
      subscription.remove();
      if (timerId) clearTimeout(timerId);
    };
  }, [clock]);

  return todayKey;
}
