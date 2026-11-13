import { getDatabase } from '../db/database';
import { SQLiteWorkoutSessionRepository } from '../db/repositories/workoutSessionRepository';
import type { WorkoutSessionRepository } from '../db/types';
import type { Workout } from '../models/workout';
import type {
  WorkoutSession,
  WorkoutSessionExercise,
  WorkoutSet,
} from '../models/workoutSession';
import { createId } from '../utils/id';

export async function getWorkoutSessionRepository(): Promise<WorkoutSessionRepository> {
  const db = await getDatabase();
  return new SQLiteWorkoutSessionRepository(db);
}

/**
 * Creates and starts a new active execution session from a Workout template.
 * All planned sets are initialized as 'pending' with null actual reps and weight.
 * No planned sets are fabricated as completed.
 */
export async function startWorkoutSession(
  sourceWorkout: Workout,
  customRepo?: WorkoutSessionRepository
): Promise<WorkoutSession> {
  const repo = customRepo ?? (await getWorkoutSessionRepository());

  const sessionId = createId('session');
  const now = new Date().toISOString();

  const exercises: WorkoutSessionExercise[] = (sourceWorkout.exercises || []).map(
    (ex, exIdx) => {
      const sessionExId = createId('session-ex');
      const setsCount = Math.max(1, ex.sets || 3);
      const plannedReps = Math.max(0, ex.reps || 10);
      const plannedWeightKg = Math.max(0, ex.weight || 0);

      const sets: WorkoutSet[] = [];
      for (let s = 1; s <= setsCount; s++) {
        sets.push({
          id: createId('set'),
          sessionExerciseId: sessionExId,
          setNumber: s,
          plannedReps,
          actualReps: null,
          plannedWeightKg,
          actualWeightKg: null,
          status: 'pending',
          completedAt: null,
        });
      }

      return {
        id: sessionExId,
        sessionId,
        sourceExerciseId: ex.id,
        catalogId: ex.catalogId,
        exerciseName: ex.exerciseName || ex.name || 'Exercise',
        targetMuscles: ex.targetMuscles ? [...ex.targetMuscles] : [],
        sortOrder: exIdx,
        sets,
      };
    }
  );

  const session: WorkoutSession = {
    id: sessionId,
    sourceWorkoutId: sourceWorkout.id,
    title: sourceWorkout.title || sourceWorkout.name || 'Workout Session',
    status: 'active',
    startedAt: now,
    accumulatedElapsedMs: 0,
    lastResumedAt: now,
    createdAt: now,
    updatedAt: now,
    exercises,
    notes: sourceWorkout.notes,
  };

  return repo.createSession(session);
}

export async function getActiveWorkoutSession(
  customRepo?: WorkoutSessionRepository
): Promise<WorkoutSession | null> {
  const repo = customRepo ?? (await getWorkoutSessionRepository());
  return repo.getActiveSession();
}

export async function pauseWorkoutSession(
  id: string,
  customRepo?: WorkoutSessionRepository
): Promise<WorkoutSession> {
  const repo = customRepo ?? (await getWorkoutSessionRepository());
  return repo.pauseSession(id);
}

export async function resumeWorkoutSession(
  id: string,
  customRepo?: WorkoutSessionRepository
): Promise<WorkoutSession> {
  const repo = customRepo ?? (await getWorkoutSessionRepository());
  return repo.resumeSession(id);
}

export async function completeSessionSet(
  setId: string,
  actualReps: number,
  actualWeightKg: number,
  rpe?: number | null,
  notes?: string,
  customRepo?: WorkoutSessionRepository
): Promise<WorkoutSet> {
  const repo = customRepo ?? (await getWorkoutSessionRepository());
  return repo.completeSet(setId, {
    actualReps,
    actualWeightKg,
    rpe,
    notes,
  });
}

export async function skipSessionSet(
  setId: string,
  notes?: string,
  customRepo?: WorkoutSessionRepository
): Promise<WorkoutSet> {
  const repo = customRepo ?? (await getWorkoutSessionRepository());
  return repo.skipSet(setId, notes);
}

export async function addSessionSet(
  sessionExerciseId: string,
  plannedReps: number,
  plannedWeightKg: number,
  customRepo?: WorkoutSessionRepository
): Promise<WorkoutSet> {
  const repo = customRepo ?? (await getWorkoutSessionRepository());
  return repo.addSet(sessionExerciseId, plannedReps, plannedWeightKg);
}

export async function finishWorkoutSession(
  id: string,
  notes?: string,
  customRepo?: WorkoutSessionRepository
): Promise<WorkoutSession> {
  const repo = customRepo ?? (await getWorkoutSessionRepository());
  return repo.completeSession(id, notes);
}

export async function discardWorkoutSession(
  id: string,
  customRepo?: WorkoutSessionRepository
): Promise<void> {
  const repo = customRepo ?? (await getWorkoutSessionRepository());
  return repo.discardSession(id);
}

export async function setSessionRestTarget(
  id: string,
  restTargetAt: string | null,
  customRepo?: WorkoutSessionRepository
): Promise<WorkoutSession> {
  const repo = customRepo ?? (await getWorkoutSessionRepository());
  return repo.setRestTarget(id, restTargetAt);
}

export async function getInterruptedWorkoutSessions(
  customRepo?: WorkoutSessionRepository
): Promise<WorkoutSession[]> {
  const repo = customRepo ?? (await getWorkoutSessionRepository());
  return repo.listInterruptedSessions();
}

export async function resumeInterruptedWorkoutSession(
  id: string,
  options?: { currentSessionAction?: 'archive' | 'discard' } | 'archive' | 'discard',
  customRepo?: WorkoutSessionRepository
): Promise<WorkoutSession> {
  const repo = customRepo ?? (await getWorkoutSessionRepository());
  return repo.resumeInterruptedSession(id, options);
}

export async function archiveInterruptedWorkoutSession(
  id: string,
  notes?: string,
  customRepo?: WorkoutSessionRepository
): Promise<WorkoutSession> {
  const repo = customRepo ?? (await getWorkoutSessionRepository());
  return repo.archiveInterruptedSession(id, notes);
}
