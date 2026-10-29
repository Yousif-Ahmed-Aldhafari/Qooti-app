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
  exercise: Partial<Exercise> & { id: string; sets: number; reps: number; weight: number; duration: number; notes: string }
): Exercise {
  const name = exercise.exerciseName || exercise.name || '';
  return {
    ...exercise,
    exerciseName: name,
    name,
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
