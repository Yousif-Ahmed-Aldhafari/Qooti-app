import { createId } from '../../utils/id';
import type {
  WorkoutSession,
  WorkoutSessionExercise,
  WorkoutSet,
} from '../../models/workoutSession';
import {
  SessionValidationError,
  validateSessionTransition,
  validateWorkoutSet,
} from '../../models/workoutSession';
import type { IDatabase, WorkoutSessionRepository } from '../types';

interface SessionRow {
  id: string;
  source_workout_id: string | null;
  title: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  accumulated_elapsed_ms: number;
  last_resumed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface SessionExerciseRow {
  id: string;
  session_id: string;
  source_exercise_id: string | null;
  catalog_id: string | null;
  exercise_name: string;
  target_muscles: string;
  sort_order: number;
}

interface SetRow {
  id: string;
  session_exercise_id: string;
  set_number: number;
  planned_reps: number;
  actual_reps: number | null;
  planned_weight_kg: number;
  actual_weight_kg: number | null;
  status: string;
  completed_at: string | null;
  rpe: number | null;
  notes: string | null;
}

export class SQLiteWorkoutSessionRepository implements WorkoutSessionRepository {
  constructor(private db: IDatabase) {}

  private mapSession(
    s: SessionRow,
    exercises: SessionExerciseRow[],
    sets: SetRow[]
  ): WorkoutSession {
    const setsByExId = new Map<string, WorkoutSet[]>();
    for (const st of sets) {
      const setObj: WorkoutSet = {
        id: st.id,
        sessionExerciseId: st.session_exercise_id,
        setNumber: st.set_number,
        plannedReps: st.planned_reps,
        actualReps: st.actual_reps,
        plannedWeightKg: st.planned_weight_kg,
        actualWeightKg: st.actual_weight_kg,
        status: st.status as WorkoutSet['status'],
        completedAt: st.completed_at,
        rpe: st.rpe,
        notes: st.notes ?? undefined,
      };
      const list = setsByExId.get(st.session_exercise_id) || [];
      list.push(setObj);
      setsByExId.set(st.session_exercise_id, list);
    }

    const exList: WorkoutSessionExercise[] = exercises.map((ex) => {
      let targetMuscles: string[] = [];
      try {
        targetMuscles = JSON.parse(ex.target_muscles);
        if (!Array.isArray(targetMuscles)) {
          targetMuscles = [String(ex.target_muscles)];
        }
      } catch {
        targetMuscles = ex.target_muscles ? [ex.target_muscles] : [];
      }

      return {
        id: ex.id,
        sessionId: ex.session_id,
        sourceExerciseId: ex.source_exercise_id ?? undefined,
        catalogId: ex.catalog_id ?? undefined,
        exerciseName: ex.exercise_name,
        targetMuscles,
        sortOrder: ex.sort_order,
        sets: setsByExId.get(ex.id) || [],
      };
    });

    return {
      id: s.id,
      sourceWorkoutId: s.source_workout_id ?? undefined,
      title: s.title,
      status: s.status as WorkoutSession['status'],
      startedAt: s.started_at,
      endedAt: s.ended_at ?? undefined,
      accumulatedElapsedMs: s.accumulated_elapsed_ms,
      lastResumedAt: s.last_resumed_at ?? undefined,
      notes: s.notes ?? undefined,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
      exercises: exList,
    };
  }

  async createSession(session: WorkoutSession, txn?: IDatabase): Promise<WorkoutSession> {
    const execute = async (client: IDatabase) => {
      // 1. Guard against duplicate active or paused sessions
      if (session.status === 'active' || session.status === 'paused') {
        const existing = await client.getFirstAsync<{ id: string; title: string }>(
          `SELECT id, title FROM workout_sessions WHERE status IN ('active', 'paused') LIMIT 1;`
        );
        if (existing) {
          throw new SessionValidationError(
            `Cannot start a new workout session. Session "${existing.title}" (${existing.id}) is already active or paused.`,
            'status'
          );
        }
      }

      const now = new Date().toISOString();
      const targetId = session.id || createId('session');
      const startedAt = session.startedAt || now;
      const lastResumedAt = session.status === 'active' ? (session.lastResumedAt || now) : null;

      let resolvedSourceWorkoutId: string | null = session.sourceWorkoutId ?? null;
      if (resolvedSourceWorkoutId) {
        const existingWorkout = await client.getFirstAsync<{ id: string }>(
          'SELECT id FROM workouts WHERE id = ?;',
          resolvedSourceWorkoutId
        );
        if (!existingWorkout) {
          resolvedSourceWorkoutId = null;
        }
      }

      // 2. Insert session row
      await client.runAsync(
        `INSERT INTO workout_sessions (
          id, source_workout_id, title, status, started_at, ended_at,
          accumulated_elapsed_ms, last_resumed_at, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        targetId,
        resolvedSourceWorkoutId,
        session.title.trim() || 'Workout Session',
        session.status,
        startedAt,
        session.endedAt ?? null,
        session.accumulatedElapsedMs || 0,
        lastResumedAt,
        session.notes ?? null,
        session.createdAt || now,
        session.updatedAt || now
      );

      // 3. Insert exercises and sets
      for (let i = 0; i < (session.exercises || []).length; i++) {
        const ex = session.exercises[i];
        const exId = ex.id || createId('session-ex');
        const sortOrder = ex.sortOrder !== undefined ? ex.sortOrder : i;

        await client.runAsync(
          `INSERT INTO workout_session_exercises (
            id, session_id, source_exercise_id, catalog_id, exercise_name, target_muscles, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?);`,
          exId,
          targetId,
          ex.sourceExerciseId ?? null,
          ex.catalogId ?? null,
          ex.exerciseName.trim() || 'Exercise',
          JSON.stringify(ex.targetMuscles || []),
          sortOrder
        );

        for (let j = 0; j < (ex.sets || []).length; j++) {
          const st = ex.sets[j];
          validateWorkoutSet(st);
          const setId = st.id || createId('set');
          const setNumber = st.setNumber !== undefined ? st.setNumber : j + 1;

          await client.runAsync(
            `INSERT INTO workout_sets (
              id, session_exercise_id, set_number, planned_reps, actual_reps,
              planned_weight_kg, actual_weight_kg, status, completed_at, rpe, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
            setId,
            exId,
            setNumber,
            st.plannedReps ?? 0,
            st.actualReps ?? null,
            st.plannedWeightKg ?? 0,
            st.actualWeightKg ?? null,
            st.status || 'pending',
            st.completedAt ?? null,
            st.rpe ?? null,
            st.notes ?? null
          );
        }
      }

      const created = await this.getSessionById(targetId, client);
      if (!created) {
        throw new Error('Failed to retrieve newly created workout session.');
      }
      return created;
    };

    if (txn) {
      return execute(txn);
    }
    return this.db.withExclusiveTransactionAsync(execute);
  }

  async getActiveSession(txn?: IDatabase): Promise<WorkoutSession | null> {
    const client = txn || this.db;
    const sessionRow = await client.getFirstAsync<SessionRow>(
      `SELECT * FROM workout_sessions WHERE status IN ('active', 'paused') ORDER BY updated_at DESC LIMIT 1;`
    );
    if (!sessionRow) return null;

    const exercises = await client.getAllAsync<SessionExerciseRow>(
      `SELECT * FROM workout_session_exercises WHERE session_id = ? ORDER BY sort_order ASC;`,
      sessionRow.id
    );

    const sets = await client.getAllAsync<SetRow>(
      `SELECT ws.* FROM workout_sets ws
       JOIN workout_session_exercises wse ON ws.session_exercise_id = wse.id
       WHERE wse.session_id = ?
       ORDER BY ws.set_number ASC;`,
      sessionRow.id
    );

    return this.mapSession(sessionRow, exercises, sets);
  }

  async getSessionById(id: string, txn?: IDatabase): Promise<WorkoutSession | null> {
    const client = txn || this.db;
    const sessionRow = await client.getFirstAsync<SessionRow>(
      `SELECT * FROM workout_sessions WHERE id = ?;`,
      id
    );
    if (!sessionRow) return null;

    const exercises = await client.getAllAsync<SessionExerciseRow>(
      `SELECT * FROM workout_session_exercises WHERE session_id = ? ORDER BY sort_order ASC;`,
      id
    );

    const sets = await client.getAllAsync<SetRow>(
      `SELECT ws.* FROM workout_sets ws
       JOIN workout_session_exercises wse ON ws.session_exercise_id = wse.id
       WHERE wse.session_id = ?
       ORDER BY ws.set_number ASC;`,
      id
    );

    return this.mapSession(sessionRow, exercises, sets);
  }

  async listSessions(limit: number = 50, txn?: IDatabase): Promise<WorkoutSession[]> {
    const client = txn || this.db;
    const sessionRows = await client.getAllAsync<SessionRow>(
      `SELECT * FROM workout_sessions ORDER BY started_at DESC LIMIT ?;`,
      limit
    );
    if (sessionRows.length === 0) return [];

    const results: WorkoutSession[] = [];
    for (const s of sessionRows) {
      const exercises = await client.getAllAsync<SessionExerciseRow>(
        `SELECT * FROM workout_session_exercises WHERE session_id = ? ORDER BY sort_order ASC;`,
        s.id
      );
      const sets = await client.getAllAsync<SetRow>(
        `SELECT ws.* FROM workout_sets ws
         JOIN workout_session_exercises wse ON ws.session_exercise_id = wse.id
         WHERE wse.session_id = ?
         ORDER BY ws.set_number ASC;`,
        s.id
      );
      results.push(this.mapSession(s, exercises, sets));
    }
    return results;
  }

  async pauseSession(
    id: string,
    pausedAtOrTxn?: string | IDatabase,
    maybeTxn?: IDatabase
  ): Promise<WorkoutSession> {
    const pausedAt = typeof pausedAtOrTxn === 'string' ? pausedAtOrTxn : undefined;
    const txn = typeof pausedAtOrTxn === 'object' && pausedAtOrTxn !== null ? pausedAtOrTxn : maybeTxn;

    const execute = async (client: IDatabase) => {
      const session = await client.getFirstAsync<SessionRow>(
        `SELECT * FROM workout_sessions WHERE id = ?;`,
        id
      );
      if (!session) {
        throw new SessionValidationError(`Workout session "${id}" not found.`, 'id');
      }

      validateSessionTransition(session.status as WorkoutSession['status'], 'paused');

      let newAccumulated = session.accumulated_elapsed_ms;
      if (session.status === 'active' && session.last_resumed_at) {
        const lastResume = Date.parse(session.last_resumed_at);
        if (!Number.isNaN(lastResume)) {
          const pauseTime = pausedAt ? Date.parse(pausedAt) : Date.now();
          const delta = Math.max(0, pauseTime - lastResume);
          newAccumulated += delta;
        }
      }

      const now = pausedAt || new Date().toISOString();
      await client.runAsync(
        `UPDATE workout_sessions
         SET status = 'paused', accumulated_elapsed_ms = ?, last_resumed_at = NULL, updated_at = ?
         WHERE id = ?;`,
        newAccumulated,
        now,
        id
      );

      const updated = await this.getSessionById(id, client);
      if (!updated) throw new Error('Failed to retrieve paused session.');
      return updated;
    };

    if (txn) return execute(txn);
    return this.db.withExclusiveTransactionAsync(execute);
  }

  async resumeSession(
    id: string,
    resumedAtOrTxn?: string | IDatabase,
    maybeTxn?: IDatabase
  ): Promise<WorkoutSession> {
    const resumedAt = typeof resumedAtOrTxn === 'string' ? resumedAtOrTxn : undefined;
    const txn = typeof resumedAtOrTxn === 'object' && resumedAtOrTxn !== null ? resumedAtOrTxn : maybeTxn;

    const execute = async (client: IDatabase) => {
      const session = await client.getFirstAsync<SessionRow>(
        `SELECT * FROM workout_sessions WHERE id = ?;`,
        id
      );
      if (!session) {
        throw new SessionValidationError(`Workout session "${id}" not found.`, 'id');
      }

      validateSessionTransition(session.status as WorkoutSession['status'], 'active');

      const now = resumedAt || new Date().toISOString();
      await client.runAsync(
        `UPDATE workout_sessions
         SET status = 'active', last_resumed_at = ?, updated_at = ?
         WHERE id = ?;`,
        now,
        now,
        id
      );

      const updated = await this.getSessionById(id, client);
      if (!updated) throw new Error('Failed to retrieve resumed session.');
      return updated;
    };

    if (txn) return execute(txn);
    return this.db.withExclusiveTransactionAsync(execute);
  }

  async completeSet(
    setId: string,
    updates: {
      actualReps: number;
      actualWeightKg: number;
      rpe?: number | null;
      notes?: string;
    },
    txn?: IDatabase
  ): Promise<WorkoutSet> {
    const execute = async (client: IDatabase) => {
      const existing = await client.getFirstAsync<SetRow>(
        `SELECT * FROM workout_sets WHERE id = ?;`,
        setId
      );
      if (!existing) {
        throw new SessionValidationError(`Set with id "${setId}" not found.`, 'id');
      }

      const actualReps = Math.max(0, Math.round(updates.actualReps));
      const actualWeight = Math.max(0, Math.round(updates.actualWeightKg * 10) / 10);
      const now = new Date().toISOString();

      await client.runAsync(
        `UPDATE workout_sets
         SET status = 'completed', actual_reps = ?, actual_weight_kg = ?, completed_at = ?, rpe = ?, notes = ?
         WHERE id = ?;`,
        actualReps,
        actualWeight,
        now,
        updates.rpe ?? null,
        updates.notes ?? existing.notes,
        setId
      );

      const updated = await client.getFirstAsync<SetRow>(
        `SELECT * FROM workout_sets WHERE id = ?;`,
        setId
      );
      if (!updated) throw new Error('Failed to fetch updated set.');

      return {
        id: updated.id,
        sessionExerciseId: updated.session_exercise_id,
        setNumber: updated.set_number,
        plannedReps: updated.planned_reps,
        actualReps: updated.actual_reps,
        plannedWeightKg: updated.planned_weight_kg,
        actualWeightKg: updated.actual_weight_kg,
        status: updated.status as WorkoutSet['status'],
        completedAt: updated.completed_at,
        rpe: updated.rpe,
        notes: updated.notes ?? undefined,
      };
    };

    if (txn) return execute(txn);
    return this.db.withExclusiveTransactionAsync(execute);
  }

  async updateSet(
    setId: string,
    updates: Partial<WorkoutSet>,
    txn?: IDatabase
  ): Promise<WorkoutSet> {
    const execute = async (client: IDatabase) => {
      const existing = await client.getFirstAsync<SetRow>(
        `SELECT * FROM workout_sets WHERE id = ?;`,
        setId
      );
      if (!existing) {
        throw new SessionValidationError(`Set with id "${setId}" not found.`, 'id');
      }

      const actualReps = updates.actualReps !== undefined ? updates.actualReps : existing.actual_reps;
      const actualWeightKg =
        updates.actualWeightKg !== undefined ? updates.actualWeightKg : existing.actual_weight_kg;
      const status = updates.status || existing.status;
      const completedAt =
        updates.completedAt !== undefined ? updates.completedAt : existing.completed_at;
      const rpe = updates.rpe !== undefined ? updates.rpe : existing.rpe;
      const notes = updates.notes !== undefined ? updates.notes : existing.notes;

      await client.runAsync(
        `UPDATE workout_sets
         SET status = ?, actual_reps = ?, actual_weight_kg = ?, completed_at = ?, rpe = ?, notes = ?
         WHERE id = ?;`,
        status,
        actualReps,
        actualWeightKg,
        completedAt,
        rpe,
        notes,
        setId
      );

      const updated = await client.getFirstAsync<SetRow>(
        `SELECT * FROM workout_sets WHERE id = ?;`,
        setId
      );
      if (!updated) throw new Error('Failed to fetch updated set.');

      return {
        id: updated.id,
        sessionExerciseId: updated.session_exercise_id,
        setNumber: updated.set_number,
        plannedReps: updated.planned_reps,
        actualReps: updated.actual_reps,
        plannedWeightKg: updated.planned_weight_kg,
        actualWeightKg: updated.actual_weight_kg,
        status: updated.status as WorkoutSet['status'],
        completedAt: updated.completed_at,
        rpe: updated.rpe,
        notes: updated.notes ?? undefined,
      };
    };

    if (txn) return execute(txn);
    return this.db.withExclusiveTransactionAsync(execute);
  }

  async skipSet(setId: string, notes?: string, txn?: IDatabase): Promise<WorkoutSet> {
    const execute = async (client: IDatabase) => {
      const existing = await client.getFirstAsync<SetRow>(
        `SELECT * FROM workout_sets WHERE id = ?;`,
        setId
      );
      if (!existing) {
        throw new SessionValidationError(`Set with id "${setId}" not found.`, 'id');
      }

      await client.runAsync(
        `UPDATE workout_sets
         SET status = 'skipped', completed_at = NULL, notes = ?
         WHERE id = ?;`,
        notes ?? existing.notes,
        setId
      );

      const updated = await client.getFirstAsync<SetRow>(
        `SELECT * FROM workout_sets WHERE id = ?;`,
        setId
      );
      if (!updated) throw new Error('Failed to fetch skipped set.');

      return {
        id: updated.id,
        sessionExerciseId: updated.session_exercise_id,
        setNumber: updated.set_number,
        plannedReps: updated.planned_reps,
        actualReps: updated.actual_reps,
        plannedWeightKg: updated.planned_weight_kg,
        actualWeightKg: updated.actual_weight_kg,
        status: updated.status as WorkoutSet['status'],
        completedAt: updated.completed_at,
        rpe: updated.rpe,
        notes: updated.notes ?? undefined,
      };
    };

    if (txn) return execute(txn);
    return this.db.withExclusiveTransactionAsync(execute);
  }

  async addSet(
    sessionExerciseId: string,
    plannedReps: number,
    plannedWeightKg: number,
    txn?: IDatabase
  ): Promise<WorkoutSet> {
    const execute = async (client: IDatabase) => {
      const ex = await client.getFirstAsync<SessionExerciseRow>(
        `SELECT * FROM workout_session_exercises WHERE id = ?;`,
        sessionExerciseId
      );
      if (!ex) {
        throw new SessionValidationError(
          `Session exercise with id "${sessionExerciseId}" not found.`,
          'sessionExerciseId'
        );
      }

      const maxSetRow = await client.getFirstAsync<{ max_set: number | null }>(
        `SELECT MAX(set_number) as max_set FROM workout_sets WHERE session_exercise_id = ?;`,
        sessionExerciseId
      );
      const nextSetNumber = (maxSetRow?.max_set || 0) + 1;
      const newSetId = createId('set');

      await client.runAsync(
        `INSERT INTO workout_sets (
          id, session_exercise_id, set_number, planned_reps, actual_reps,
          planned_weight_kg, actual_weight_kg, status, completed_at, rpe, notes
        ) VALUES (?, ?, ?, ?, NULL, ?, NULL, 'pending', NULL, NULL, NULL);`,
        newSetId,
        sessionExerciseId,
        nextSetNumber,
        Math.max(0, Math.round(plannedReps)),
        Math.max(0, Math.round(plannedWeightKg * 10) / 10)
      );

      return {
        id: newSetId,
        sessionExerciseId,
        setNumber: nextSetNumber,
        plannedReps: Math.max(0, Math.round(plannedReps)),
        plannedWeightKg: Math.max(0, Math.round(plannedWeightKg * 10) / 10),
        status: 'pending' as const,
      };
    };

    if (txn) return execute(txn);
    return this.db.withExclusiveTransactionAsync(execute);
  }

  async completeSession(
    id: string,
    notes?: string,
    completedAtOrTxn?: string | IDatabase,
    maybeTxn?: IDatabase
  ): Promise<WorkoutSession> {
    const completedAt = typeof completedAtOrTxn === 'string' ? completedAtOrTxn : undefined;
    const txn = typeof completedAtOrTxn === 'object' && completedAtOrTxn !== null ? completedAtOrTxn : maybeTxn;

    const execute = async (client: IDatabase) => {
      const session = await client.getFirstAsync<SessionRow>(
        `SELECT * FROM workout_sessions WHERE id = ?;`,
        id
      );
      if (!session) {
        throw new SessionValidationError(`Workout session "${id}" not found.`, 'id');
      }

      validateSessionTransition(session.status as WorkoutSession['status'], 'completed');

      const now = completedAt || new Date().toISOString();
      let newAccumulated = session.accumulated_elapsed_ms;
      if (session.status === 'active' && session.last_resumed_at) {
        const lastResume = Date.parse(session.last_resumed_at);
        if (!Number.isNaN(lastResume)) {
          const finishTime = Date.parse(now);
          const delta = Math.max(0, finishTime - lastResume);
          newAccumulated += delta;
        }
      }

      await client.runAsync(
        `UPDATE workout_sessions
         SET status = 'completed', ended_at = ?, accumulated_elapsed_ms = ?,
             last_resumed_at = NULL, notes = ?, updated_at = ?
         WHERE id = ?;`,
        now,
        newAccumulated,
        notes ?? session.notes,
        now,
        id
      );

      const completed = await this.getSessionById(id, client);
      if (!completed) throw new Error('Failed to retrieve completed session.');
      return completed;
    };

    if (txn) return execute(txn);
    return this.db.withExclusiveTransactionAsync(execute);
  }

  async discardSession(id: string, txn?: IDatabase): Promise<void> {
    const execute = async (client: IDatabase) => {
      const session = await client.getFirstAsync<SessionRow>(
        `SELECT * FROM workout_sessions WHERE id = ?;`,
        id
      );
      if (!session) {
        // Idempotent: already discarded or deleted
        return;
      }

      // Deleting the session cascades and cleans up exercises and sets
      await client.runAsync(`DELETE FROM workout_sessions WHERE id = ?;`, id);
    };

    if (txn) return execute(txn);
    return this.db.withExclusiveTransactionAsync(execute);
  }
}
