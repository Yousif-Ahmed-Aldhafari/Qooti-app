/**
 * Canonical Workout domain model.
 */
export type Exercise = {
  id: string;
  exerciseName: string;
  name?: string;
  targetMuscles?: string[];
  sets: number;
  reps: number;
  weight: number;
  duration: number;
  notes: string;
};

export type Workout = {
  id: string;
  title: string;
  name?: string;
  date: string;
  time: string;
  exercises: Exercise[];
  notes?: string;
};

export function normalizeExercise(
  exercise: Partial<Exercise> & {
    id: string;
    sets?: number;
    reps?: number;
    weight?: number;
    weightKg?: number;
    duration?: number;
    durationMinutes?: number;
    notes?: string;
  }
): Exercise {
  const name = exercise.exerciseName || exercise.name || '';
  const weight = exercise.weight ?? exercise.weightKg ?? 0;
  const duration = exercise.duration ?? exercise.durationMinutes ?? 0;
  const sets = exercise.sets ?? 0;
  const reps = exercise.reps ?? 0;
  const notes = exercise.notes ?? '';

  return {
    ...exercise,
    exerciseName: name,
    name,
    sets,
    reps,
    weight,
    duration,
    notes,
  };
}

export function normalizeWorkout(
  workout: Partial<Workout> & { id: string; date: string; time: string; exercises: Exercise[] }
): Workout {
  const title = workout.title || workout.name || '';
  return {
    ...workout,
    title,
    name: title,
    exercises: (workout.exercises || []).map(normalizeExercise),
  };
}

export class WorkoutValidationError extends Error {
  constructor(message: string, public readonly field?: string) {
    super(message);
    this.name = 'WorkoutValidationError';
  }
}

/**
 * Validates an exercise domain object strictly without silent numerical coercion.
 */
export function validateExercise(exercise: Exercise, index?: number): void {
  const prefix = index !== undefined ? `Exercise #${index + 1}` : 'Exercise';
  if (!exercise.id || typeof exercise.id !== 'string' || !exercise.id.trim()) {
    throw new WorkoutValidationError(`${prefix} must have a valid non-empty id.`, 'id');
  }

  const name = exercise.exerciseName || exercise.name || '';
  if (typeof name !== 'string' || !name.trim()) {
    throw new WorkoutValidationError(`${prefix} name is required.`, 'exerciseName');
  }

  if (
    typeof exercise.sets !== 'number' ||
    !Number.isFinite(exercise.sets) ||
    !Number.isInteger(exercise.sets) ||
    exercise.sets < 0
  ) {
    throw new WorkoutValidationError(
      `${prefix} sets must be a valid non-negative integer.`,
      'sets'
    );
  }

  if (
    typeof exercise.reps !== 'number' ||
    !Number.isFinite(exercise.reps) ||
    !Number.isInteger(exercise.reps) ||
    exercise.reps < 0
  ) {
    throw new WorkoutValidationError(
      `${prefix} reps must be a valid non-negative integer.`,
      'reps'
    );
  }

  if (
    typeof exercise.weight !== 'number' ||
    !Number.isFinite(exercise.weight) ||
    exercise.weight < 0
  ) {
    throw new WorkoutValidationError(
      `${prefix} weight must be a valid non-negative finite number.`,
      'weight'
    );
  }

  if (
    typeof exercise.duration !== 'number' ||
    !Number.isFinite(exercise.duration) ||
    exercise.duration < 0
  ) {
    throw new WorkoutValidationError(
      `${prefix} duration must be a valid non-negative finite number.`,
      'duration'
    );
  }
}

/**
 * Validates a workout domain object before persistence.
 * Safe empty-workout behavior: workouts with 0 exercises are supported.
 */
export function validateWorkout(workout: Workout): void {
  if (!workout.id || typeof workout.id !== 'string' || !workout.id.trim()) {
    throw new WorkoutValidationError('Workout must have a valid non-empty id.', 'id');
  }

  const title = workout.title || workout.name || '';
  if (typeof title !== 'string' || !title.trim()) {
    throw new WorkoutValidationError('Workout title is required.', 'title');
  }

  if (!workout.date || typeof workout.date !== 'string' || !workout.date.trim()) {
    throw new WorkoutValidationError('Workout date is required.', 'date');
  }

  const parsedDate = new Date(workout.date);
  if (Number.isNaN(parsedDate.getTime())) {
    throw new WorkoutValidationError('Workout date format is invalid.', 'date');
  }

  if (!workout.time || typeof workout.time !== 'string' || !workout.time.trim()) {
    throw new WorkoutValidationError('Workout time is required.', 'time');
  }

  if (!Array.isArray(workout.exercises)) {
    throw new WorkoutValidationError('Workout exercises must be an array.', 'exercises');
  }

  const seenIds = new Set<string>();
  for (let i = 0; i < workout.exercises.length; i++) {
    const ex = workout.exercises[i];
    validateExercise(ex, i);
    if (seenIds.has(ex.id)) {
      throw new WorkoutValidationError(
        `Duplicate exercise id detected: "${ex.id}".`,
        'exercises'
      );
    }
    seenIds.add(ex.id);
  }
}
