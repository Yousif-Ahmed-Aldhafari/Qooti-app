export type SessionStatus = 'active' | 'paused' | 'completed' | 'discarded';

export type SessionRecoveryState = 'interrupted' | 'recovered' | 'archived' | 'ambiguous';

export type SetStatus = 'pending' | 'completed' | 'skipped';

export type WorkoutSet = {
  id: string;
  sessionExerciseId: string;
  setNumber: number;
  plannedReps: number;
  actualReps?: number | null;
  plannedWeightKg: number;
  actualWeightKg?: number | null;
  status: SetStatus;
  completedAt?: string | null;
  rpe?: number | null;
  notes?: string;
};

export type WorkoutSessionExercise = {
  id: string;
  sessionId: string;
  sourceExerciseId?: string | null;
  catalogId?: string | null;
  exerciseName: string;
  targetMuscles?: string[];
  sortOrder: number;
  sets: WorkoutSet[];
};

export type WorkoutSession = {
  id: string;
  sourceWorkoutId?: string | null;
  title: string;
  status: SessionStatus;
  startedAt: string;
  endedAt?: string | null;
  accumulatedElapsedMs: number;
  lastResumedAt?: string | null;
  restTargetAt?: string | null;
  recoveryState?: SessionRecoveryState | null;
  createdAt: string;
  updatedAt: string;
  exercises: WorkoutSessionExercise[];
  notes?: string;
};

export class SessionValidationError extends Error {
  constructor(message: string, public readonly field?: string) {
    super(message);
    this.name = 'SessionValidationError';
  }
}

export class MigrationSessionConflictError extends Error {
  constructor(
    message: string,
    public readonly conflictingSessions: { id: string; title: string; startedAt: string; status?: string }[] = []
  ) {
    super(message);
    this.name = 'MigrationSessionConflictError';
  }
}

/**
 * Validates that a session transition follows allowed state machine paths:
 * active <-> paused
 * active -> completed
 * paused -> completed
 * active -> discarded
 * paused -> discarded
 * Terminal states (completed, discarded) cannot be transitioned.
 */
export function validateSessionTransition(
  currentStatus: SessionStatus,
  targetStatus: SessionStatus
): void {
  if (currentStatus === targetStatus) return;

  if (currentStatus === 'completed' || currentStatus === 'discarded') {
    throw new SessionValidationError(
      `Cannot transition from terminal session status "${currentStatus}" to "${targetStatus}".`,
      'status'
    );
  }

  const allowedTransitions: Record<SessionStatus, SessionStatus[]> = {
    active: ['paused', 'completed', 'discarded'],
    paused: ['active', 'completed', 'discarded'],
    completed: [],
    discarded: [],
  };

  if (!allowedTransitions[currentStatus]?.includes(targetStatus)) {
    throw new SessionValidationError(
      `Invalid session status transition from "${currentStatus}" to "${targetStatus}".`,
      'status'
    );
  }
}

/**
 * Validates a workout set before insertion or update.
 */
export function validateWorkoutSet(set: WorkoutSet): void {
  if (!set.id || typeof set.id !== 'string' || !set.id.trim()) {
    throw new SessionValidationError('Workout set must have a non-empty id.', 'id');
  }

  const allowedSetStatuses: SetStatus[] = ['pending', 'completed', 'skipped'];
  if (!allowedSetStatuses.includes(set.status)) {
    throw new SessionValidationError(`Invalid set status "${set.status}".`, 'status');
  }

  if (
    typeof set.setNumber !== 'number' ||
    !Number.isInteger(set.setNumber) ||
    set.setNumber < 1
  ) {
    throw new SessionValidationError('Set number must be a positive integer >= 1.', 'setNumber');
  }

  if (
    typeof set.plannedReps !== 'number' ||
    !Number.isInteger(set.plannedReps) ||
    set.plannedReps < 0
  ) {
    throw new SessionValidationError(
      'Planned reps must be a non-negative integer.',
      'plannedReps'
    );
  }

  if (
    typeof set.plannedWeightKg !== 'number' ||
    !Number.isFinite(set.plannedWeightKg) ||
    set.plannedWeightKg < 0
  ) {
    throw new SessionValidationError(
      'Planned weight must be a non-negative number.',
      'plannedWeightKg'
    );
  }

  if (set.status === 'completed') {
    if (set.actualReps !== undefined && set.actualReps !== null) {
      if (
        typeof set.actualReps !== 'number' ||
        !Number.isInteger(set.actualReps) ||
        set.actualReps < 0
      ) {
        throw new SessionValidationError(
          'Actual reps must be a non-negative integer.',
          'actualReps'
        );
      }
    }
    if (set.actualWeightKg !== undefined && set.actualWeightKg !== null) {
      if (
        typeof set.actualWeightKg !== 'number' ||
        !Number.isFinite(set.actualWeightKg) ||
        set.actualWeightKg < 0
      ) {
        throw new SessionValidationError(
          'Actual weight must be a non-negative number.',
          'actualWeightKg'
        );
      }
    }
    if (set.actualReps === undefined || set.actualReps === null) {
      throw new SessionValidationError(
        'Actual reps must be provided for completed sets.',
        'actualReps'
      );
    }
    if (set.actualWeightKg === undefined || set.actualWeightKg === null) {
      throw new SessionValidationError(
        'Actual weight must be provided for completed sets.',
        'actualWeightKg'
      );
    }
  }

  if (set.rpe !== undefined && set.rpe !== null) {
    if (
      typeof set.rpe !== 'number' ||
      !Number.isFinite(set.rpe) ||
      set.rpe < 1 ||
      set.rpe > 10
    ) {
      throw new SessionValidationError('RPE must be a number between 1 and 10.', 'rpe');
    }
  }
}
