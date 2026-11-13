import { IDatabase, SchemaMigration } from './types';
import { SCHEMA_V1_SQL } from './schema';
import { MigrationSessionConflictError, SessionValidationError } from '../models/workoutSession';

type ColumnDefinition = { name: string; ddl: string };

async function addMissingColumns(
  db: IDatabase,
  tableName: string,
  columns: ColumnDefinition[]
): Promise<void> {
  const tableInfo = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${tableName});`);
  const existingColumns = new Set(tableInfo.map((col) => col.name));

  for (const col of columns) {
    if (!existingColumns.has(col.name)) {
      await db.execAsync(col.ddl);
    }
  }
}

export const MIGRATIONS: SchemaMigration[] = [
  {
    version: 1,
    name: 'initial_schema_v1',
    up: async (db: IDatabase) => {
      await db.execAsync(SCHEMA_V1_SQL);
    },
  },
  {
    version: 2,
    name: 'add_profile_personalization_v2',
    up: async (db: IDatabase) => {
      await addMissingColumns(db, 'user_profiles', [
        { name: 'age', ddl: 'ALTER TABLE user_profiles ADD COLUMN age INTEGER DEFAULT 28;' },
        { name: 'gender', ddl: "ALTER TABLE user_profiles ADD COLUMN gender TEXT DEFAULT 'unspecified';" },
        { name: 'activity_level', ddl: "ALTER TABLE user_profiles ADD COLUMN activity_level TEXT DEFAULT 'moderately_active';" },
        { name: 'primary_goal', ddl: "ALTER TABLE user_profiles ADD COLUMN primary_goal TEXT DEFAULT 'general_health';" },
        { name: 'target_weight_kg', ddl: 'ALTER TABLE user_profiles ADD COLUMN target_weight_kg REAL DEFAULT 70;' },
        { name: 'weekly_goal_rate', ddl: "ALTER TABLE user_profiles ADD COLUMN weekly_goal_rate TEXT DEFAULT 'moderate';" },
        { name: 'training_experience', ddl: "ALTER TABLE user_profiles ADD COLUMN training_experience TEXT DEFAULT 'beginner';" },
        { name: 'preferred_workout_days', ddl: 'ALTER TABLE user_profiles ADD COLUMN preferred_workout_days INTEGER DEFAULT 4;' },
        { name: 'available_equipment', ddl: `ALTER TABLE user_profiles ADD COLUMN available_equipment TEXT DEFAULT '["bodyweight"]';` },
        { name: 'workout_location', ddl: "ALTER TABLE user_profiles ADD COLUMN workout_location TEXT DEFAULT 'flexible';" },
        { name: 'dietary_preference', ddl: "ALTER TABLE user_profiles ADD COLUMN dietary_preference TEXT DEFAULT 'standard';" },
        { name: 'meals_per_day', ddl: 'ALTER TABLE user_profiles ADD COLUMN meals_per_day INTEGER DEFAULT 3;' },
        { name: 'allergies_restrictions', ddl: `ALTER TABLE user_profiles ADD COLUMN allergies_restrictions TEXT DEFAULT '[]';` },
        { name: 'calculation_overridden', ddl: 'ALTER TABLE user_profiles ADD COLUMN calculation_overridden INTEGER DEFAULT 0;' },
      ]);
    },
  },
  {
    version: 3,
    name: 'add_profile_confirmation_and_bmr_ref_v3',
    up: async (db: IDatabase) => {
      await addMissingColumns(db, 'user_profiles', [
        { name: 'attributes_confirmed', ddl: 'ALTER TABLE user_profiles ADD COLUMN attributes_confirmed INTEGER DEFAULT 0;' },
        { name: 'bmr_biological_reference', ddl: 'ALTER TABLE user_profiles ADD COLUMN bmr_biological_reference TEXT;' },
      ]);
    },
  },
  {
    version: 4,
    name: 'add_workout_exercise_catalog_id_v4',
    up: async (db: IDatabase) => {
      await addMissingColumns(db, 'workout_exercises', [
        { name: 'catalog_id', ddl: 'ALTER TABLE workout_exercises ADD COLUMN catalog_id TEXT;' },
      ]);
    },
  },
  {
    version: 5,
    name: 'add_workout_execution_sessions_v5',
    up: async (db: IDatabase) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS workout_sessions (
          id TEXT PRIMARY KEY,
          source_workout_id TEXT REFERENCES workouts(id) ON DELETE SET NULL,
          title TEXT NOT NULL,
          status TEXT NOT NULL CHECK(status IN ('active', 'paused', 'completed', 'discarded')),
          started_at TEXT NOT NULL,
          ended_at TEXT,
          accumulated_elapsed_ms INTEGER NOT NULL DEFAULT 0,
          last_resumed_at TEXT,
          notes TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_workout_sessions_status ON workout_sessions(status);
        CREATE INDEX IF NOT EXISTS idx_workout_sessions_started_at ON workout_sessions(started_at);

        CREATE TABLE IF NOT EXISTS workout_session_exercises (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
          source_exercise_id TEXT,
          catalog_id TEXT,
          exercise_name TEXT NOT NULL,
          target_muscles TEXT NOT NULL DEFAULT '[]',
          sort_order INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_workout_session_exercises_session ON workout_session_exercises(session_id);

        CREATE TABLE IF NOT EXISTS workout_sets (
          id TEXT PRIMARY KEY,
          session_exercise_id TEXT NOT NULL REFERENCES workout_session_exercises(id) ON DELETE CASCADE,
          set_number INTEGER NOT NULL,
          planned_reps INTEGER NOT NULL DEFAULT 0,
          actual_reps INTEGER,
          planned_weight_kg REAL NOT NULL DEFAULT 0,
          actual_weight_kg REAL,
          status TEXT NOT NULL CHECK(status IN ('pending', 'completed', 'skipped')),
          completed_at TEXT,
          rpe REAL,
          notes TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_workout_sets_session_ex ON workout_sets(session_exercise_id);
      `);
    },
  },
  {
    version: 6,
    name: 'enforce_single_open_workout_session_v6',
    up: async (db) => {
      const sessionCols = await db.getAllAsync<{ name: string }>(
        `PRAGMA table_info(workout_sessions);`
      );
      const hasRestTarget = sessionCols.some((c) => c.name === 'rest_target_at');
      if (!hasRestTarget) {
        await db.execAsync(
          `ALTER TABLE workout_sessions ADD COLUMN rest_target_at TEXT;`
        );
      }

      const openSessions = await db.getAllAsync<{
        id: string;
        started_at: string;
        updated_at: string;
      }>(
        `SELECT id, started_at, updated_at FROM workout_sessions
         WHERE status IN ('active', 'paused')
         ORDER BY started_at DESC, updated_at DESC;`
      );

      if (openSessions.length > 1) {
        const [, ...older] = openSessions;
        const now = new Date().toISOString();
        for (const old of older) {
          await db.runAsync(
            `UPDATE workout_sessions
             SET status = 'discarded', updated_at = ?
             WHERE id = ?;`,
            now,
            old.id
          );
        }
      }

      await db.execAsync(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_workout_sessions_single_open
         ON workout_sessions((1)) WHERE status IN ('active', 'paused');`
      );
    },
  },
  {
    version: 7,
    name: 'recover_conflicted_workout_sessions_v7',
    up: async (db) => {
      const sessionCols = await db.getAllAsync<{ name: string }>(
        `PRAGMA table_info(workout_sessions);`
      );
      const hasRecoveryState = sessionCols.some((c) => c.name === 'recovery_state');
      if (!hasRecoveryState) {
        await db.execAsync(
          `ALTER TABLE workout_sessions ADD COLUMN recovery_state TEXT;`
        );
      }

      // Mark sessions that were transitioned by Migration 6 conflict resolution
      // (status = 'discarded' with child exercises and no explicit user deletion)
      // as 'interrupted' so they can be inspected and recovered by the user.
      await db.runAsync(
        `UPDATE workout_sessions
         SET recovery_state = 'interrupted'
         WHERE status = 'discarded' AND (recovery_state IS NULL OR recovery_state = '');`
      );
    },
  },
  {
    version: 8,
    name: 'clarify_session_recovery_provenance_v8',
    up: async (db) => {
      const sessionCols = await db.getAllAsync<{ name: string }>(
        `PRAGMA table_info(workout_sessions);`
      );
      const hasRecoveryState = sessionCols.some((c) => c.name === 'recovery_state');
      if (!hasRecoveryState) {
        await db.execAsync(
          `ALTER TABLE workout_sessions ADD COLUMN recovery_state TEXT;`
        );
      }

      // Mark older retained discarded sessions whose origin is unproven (e.g. from historical Migration 6/7)
      // as 'ambiguous' so they are not falsely represented as confirmed interrupted sessions.
      await db.runAsync(
        `UPDATE workout_sessions
         SET recovery_state = 'ambiguous'
         WHERE status = 'discarded' AND (recovery_state = 'interrupted' OR recovery_state IS NULL OR recovery_state = '');`
      );
    },
  },
];

/**
 * Checks for pre-migration conflicts (multiple open sessions) before enforcing single-open-session constraint.
 */
export async function detectPreMigrationSessionConflicts(
  db: IDatabase
): Promise<{ id: string; title: string; startedAt: string; status: string }[]> {
  const tableExists = await db.getFirstAsync<{ count: number }>(
    `SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='workout_sessions';`
  );
  if (!tableExists || tableExists.count === 0) {
    return [];
  }
  const openSessions = await db.getAllAsync<{
    id: string;
    title: string;
    started_at: string;
    status: string;
  }>(
    `SELECT id, title, started_at, status FROM workout_sessions
     WHERE status IN ('active', 'paused')
     ORDER BY started_at DESC, updated_at DESC;`
  );
  return openSessions.map((s) => ({
    id: s.id,
    title: s.title,
    startedAt: s.started_at,
    status: s.status,
  }));
}

export type PreMigrationSessionAction =
  | 'resume'
  | 'keep_interrupted'
  | 'archive'
  | 'discard';

export type PreMigrationResolution = {
  resumeSessionId?: string;
  actionForOthers?: 'keep_interrupted' | 'archive' | 'discard';
  sessionResolutions?: Record<string, PreMigrationSessionAction>;
};

/**
 * Calculates confirmed elapsed active duration for a workout session.
 * 
 * Policy:
 * 1. Base accumulated_elapsed_ms is always preserved and non-negative.
 * 2. Paused sessions never accumulate paused time (delta = 0).
 * 3. Active sessions only accumulate confirmed in-session active time up to the last
 *    verified database activity (updated_at). Uncertain offline intervals (between
 *    updated_at and now) are NEVER counted as confirmed workout time.
 * 4. Clock rollbacks are safely bounded by Math.max(0, ...).
 */
export function calculateConfirmedElapsedMs(session: {
  status: string;
  accumulated_elapsed_ms: number;
  last_resumed_at?: string | null;
  started_at: string;
  updated_at: string;
}): number {
  let accumulated = Math.max(0, Number(session.accumulated_elapsed_ms) || 0);

  if (session.status === 'active') {
    const resumeStr = session.last_resumed_at || session.started_at;
    const resumeTime = Date.parse(resumeStr);
    const updateTime = Date.parse(session.updated_at);

    if (!Number.isNaN(resumeTime) && !Number.isNaN(updateTime) && updateTime > resumeTime) {
      // Confirmed active delta up to the last known database update
      const confirmedDelta = Math.max(0, updateTime - resumeTime);
      accumulated = Math.max(0, accumulated + confirmedDelta);
    }
  }

  return Math.max(0, Math.floor(accumulated));
}

/**
 * Reconciles pre-migration session conflicts safely under user direction.
 * Keeps at most one selected session open while safely setting other open sessions to
 * a recoverable non-completed disposition ('keep_interrupted'), archiving as completed
 * if explicitly chosen ('archive'), or permanently deleting if explicitly chosen ('discard').
 */
export async function reconcilePreMigrationConflicts(
  db: IDatabase,
  resolution: PreMigrationResolution
): Promise<void> {
  await db.withExclusiveTransactionAsync(async (client) => {
    const sessionCols = await client.getAllAsync<{ name: string }>(
      `PRAGMA table_info(workout_sessions);`
    );
    const hasRestTarget = sessionCols.some((c) => c.name === 'rest_target_at');
    const hasRecoveryState = sessionCols.some((c) => c.name === 'recovery_state');
    const hasLastResumedAt = sessionCols.some((c) => c.name === 'last_resumed_at');
    const hasAccumulated = sessionCols.some((c) => c.name === 'accumulated_elapsed_ms');
    const hasEndedAt = sessionCols.some((c) => c.name === 'ended_at');

    if (!hasRecoveryState) {
      await client.execAsync(`ALTER TABLE workout_sessions ADD COLUMN recovery_state TEXT;`);
    }

    const openSessions = await client.getAllAsync<{
      id: string;
      status: string;
      started_at: string;
      ended_at: string | null;
      accumulated_elapsed_ms: number;
      last_resumed_at: string | null;
      updated_at: string;
      notes: string | null;
    }>(
      `SELECT id, status, started_at,
              ${hasEndedAt ? 'ended_at' : 'NULL as ended_at'},
              ${hasAccumulated ? 'accumulated_elapsed_ms' : '0 as accumulated_elapsed_ms'},
              ${hasLastResumedAt ? 'last_resumed_at' : 'NULL as last_resumed_at'},
              updated_at,
              notes
       FROM workout_sessions
       WHERE status IN ('active', 'paused');`
    );

    if (openSessions.length === 0) {
      return;
    }

    if (resolution.resumeSessionId) {
      const exists = openSessions.some((s) => s.id === resolution.resumeSessionId);
      if (!exists) {
        throw new SessionValidationError(
          `Selected session "${resolution.resumeSessionId}" not found among open sessions.`,
          'resumeSessionId'
        );
      }
    }

    // Verify at most one session is designated to resume
    let resumeCount = 0;
    if (resolution.sessionResolutions) {
      for (const [id, act] of Object.entries(resolution.sessionResolutions)) {
        if (act === 'resume') {
          resumeCount++;
          if (!openSessions.some((s) => s.id === id)) {
            throw new SessionValidationError(
              `Session "${id}" in sessionResolutions not found among open sessions.`,
              'sessionResolutions'
            );
          }
        }
      }
    } else if (resolution.resumeSessionId) {
      resumeCount = 1;
    }

    if (resumeCount > 1) {
      throw new SessionValidationError(
        'At most one session can be resumed simultaneously.',
        'resumeSessionId'
      );
    }

    const now = new Date().toISOString();

    for (const s of openSessions) {
      let action: PreMigrationSessionAction;
      if (resolution.sessionResolutions && resolution.sessionResolutions[s.id]) {
        action = resolution.sessionResolutions[s.id];
      } else if (resolution.resumeSessionId) {
        action = s.id === resolution.resumeSessionId
          ? 'resume'
          : (resolution.actionForOthers ?? 'keep_interrupted');
      } else {
        action = resolution.actionForOthers ?? 'keep_interrupted';
      }

      const confirmedElapsed = calculateConfirmedElapsedMs(s);

      if (action === 'resume') {
        if (hasRestTarget) {
          await client.runAsync(
            `UPDATE workout_sessions
             SET status = 'active', recovery_state = 'recovered',
                 accumulated_elapsed_ms = ?, last_resumed_at = ?, rest_target_at = NULL, updated_at = ?
             WHERE id = ?;`,
            confirmedElapsed,
            now,
            now,
            s.id
          );
        } else {
          await client.runAsync(
            `UPDATE workout_sessions
             SET status = 'active', recovery_state = 'recovered',
                 accumulated_elapsed_ms = ?, last_resumed_at = ?, updated_at = ?
             WHERE id = ?;`,
            confirmedElapsed,
            now,
            now,
            s.id
          );
        }
      } else if (action === 'discard') {
        await client.runAsync(`DELETE FROM workout_sessions WHERE id = ?;`, s.id);
      } else if (action === 'archive') {
        // User explicitly chose to archive/complete to history
        const endedAt = s.ended_at || s.updated_at || now;
        if (hasRestTarget) {
          await client.runAsync(
            `UPDATE workout_sessions
             SET status = 'completed', recovery_state = 'archived', ended_at = ?,
                 accumulated_elapsed_ms = ?, last_resumed_at = NULL, rest_target_at = NULL, updated_at = ?
             WHERE id = ?;`,
            endedAt,
            confirmedElapsed,
            now,
            s.id
          );
        } else {
          await client.runAsync(
            `UPDATE workout_sessions
             SET status = 'completed', recovery_state = 'archived', ended_at = ?,
                 accumulated_elapsed_ms = ?, last_resumed_at = NULL, updated_at = ?
             WHERE id = ?;`,
            endedAt,
            confirmedElapsed,
            now,
            s.id
          );
        }
      } else {
        // action === 'keep_interrupted' (safe default!)
        // Preserves the session as recoverable without falsely marking it completed
        if (hasRestTarget) {
          await client.runAsync(
            `UPDATE workout_sessions
             SET status = 'discarded', recovery_state = 'interrupted',
                 accumulated_elapsed_ms = ?, last_resumed_at = NULL, rest_target_at = NULL, updated_at = ?
             WHERE id = ?;`,
            confirmedElapsed,
            now,
            s.id
          );
        } else {
          await client.runAsync(
            `UPDATE workout_sessions
             SET status = 'discarded', recovery_state = 'interrupted',
                 accumulated_elapsed_ms = ?, last_resumed_at = NULL, updated_at = ?
             WHERE id = ?;`,
            confirmedElapsed,
            now,
            s.id
          );
        }
      }
    }
  });
}

/**
 * Initializes migration tracking and executes any pending schema migrations in sequence.
 */
export async function runMigrations(
  db: IDatabase,
  options: { strictConflictCheck?: boolean } = { strictConflictCheck: true }
): Promise<void> {
  // Ensure schema_migrations table exists
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  // Query existing applied migrations
  const appliedRows = await db.getAllAsync<{ version: number }>(
    'SELECT version FROM schema_migrations ORDER BY version ASC;'
  );
  const appliedVersions = new Set(appliedRows.map((r) => r.version));

  // If strictConflictCheck is active (default true) and migration 6 has not run yet, check for conflicts
  const shouldCheckStrict = options.strictConflictCheck !== false;
  if (shouldCheckStrict && !appliedVersions.has(6)) {
    const conflicts = await detectPreMigrationSessionConflicts(db);
    if (conflicts.length > 1) {
      throw new MigrationSessionConflictError(
        `Found ${conflicts.length} conflicting open workout sessions. Resolve conflicts before enforcing single-open-session invariant.`,
        conflicts
      );
    }
  }

  // Run pending migrations in ascending order
  for (const migration of MIGRATIONS) {
    if (!appliedVersions.has(migration.version)) {
      await db.withTransactionAsync(async () => {
        await migration.up(db);
        await db.runAsync(
          'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);',
          migration.version,
          migration.name,
          new Date().toISOString()
        );
      });
    }
  }
}
