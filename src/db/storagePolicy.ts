import { Platform } from 'react-native';

/**
 * Storage Authority & Transition Policy for Qooti
 * ----------------------------------------------
 *
 * 1. Single Authoritative Source of Truth:
 *    On native platforms (iOS, Android, and test runners), SQLite (`qooti.db`)
 *    is the authoritative store for all domain records (meals, meal items, workouts,
 *    workout exercises, user profile, progress entries, and app settings).
 *
 * 2. Zero Split-Brain (No Dual-Writes):
 *    Domain mutations (inserts, updates, deletes) are committed directly to SQLite.
 *    Active mutations DO NOT write to legacy AsyncStorage keys (`@qooti/meals`,
 *    `@qooti/workouts`, `@qooti/profile`, `@qooti/progress`, `@qooti/settings`).
 *    This eliminates split-brain inconsistencies, out-of-order writes, and
 *    concurrency contention between dual storage systems.
 *
 * 3. No Silent Stale Fallback:
 *    If an operation against SQLite fails (e.g. storage error, constraint failure),
 *    the error is raised immediately. The application NEVER silently falls back to
 *    reading or writing stale AsyncStorage records when SQLite fails.
 *
 * 4. Non-Destructive Legacy Recovery:
 *    The original legacy AsyncStorage records are preserved untouched as a read-only
 *    disaster-recovery source until a future verified cleanup milestone.
 *
 * 5. Web Platform Behavior:
 *    On web platforms, SQLite is used via expo-sqlite's web adapter where available.
 *    Non-exclusive transactions are used automatically on web because exclusive locks
 *    are unsupported in browser web workers / WASM.
 */

export type StorageAuthority = 'sqlite' | 'web_fallback';

export const STORAGE_TRANSITION_VERSION = 1;

export function getStorageAuthority(): StorageAuthority {
  if (Platform?.OS === 'web') {
    return 'web_fallback';
  }
  return 'sqlite';
}

export function isSqliteAuthoritative(): boolean {
  return true;
}
