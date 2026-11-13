import { getExerciseById } from '../data/exerciseCatalog';
import type { Exercise, Workout } from '../models/workout';
import { safeNumber } from './nutrition';

export type AnalyticsPeriod = '7d' | '30d' | '90d' | 'all';

export type ExerciseVolumeBreakdown = {
  volumeKg: number;
  isBodyweight: boolean;
  isDurationOnly: boolean;
  primaryMuscle: string;
};

export type WorkoutVolumeSummary = {
  totalVolumeKg: number;
  totalDurationMinutes: number;
  exerciseCount: number;
  isBodyweightOnly: boolean;
  targetMuscles: string[];
};

export type MuscleGroupVolumeAttribution = {
  muscleGroup: string;
  volumeKg: number;
  frequency: number;
};

export type WorkoutProgressionSummary = {
  period: AnalyticsPeriod;
  totalWorkouts: number;
  totalExercises: number;
  totalDurationMinutes: number;
  totalVolumeKg: number;
  volumeByMuscle: Record<string, number>;
  frequencyByMuscle: Record<string, number>;
  bodyweightExercisesCount: number;
  percentageChangeVsPreviousPeriod: {
    volume: number | null;
    workouts: number | null;
  };
};

export type ExerciseHistoryPoint = {
  workoutId: string;
  workoutTitle: string;
  date: string;
  time: string;
  sets: number;
  reps: number;
  weight: number;
  duration: number;
  volumeKg: number;
  isBodyweight: boolean;
  notes: string;
  catalogId?: string;
};

/**
 * Muscle-Group Attribution Policy:
 * --------------------------------
 * To prevent volume inflation and double-counting across muscle groups:
 * 1. 100% of an exercise's load-volume is attributed strictly to its PRIMARY muscle group.
 *    - If exercise has a known `catalogId`, primaryMuscle is retrieved from the Exercise Catalog.
 *    - If custom exercise or catalogId unknown, `targetMuscles[0]` is used as primary.
 *    - If no target muscles are specified, it is categorized under 'other'.
 * 2. Secondary muscle groups (from catalog secondaryMuscles or targetMuscles[1..n]) are
 *    attributed to training FREQUENCY (number of sessions engaging this muscle), but NOT
 *    to volume.
 * 3. This ensures the invariant: sum(volumeByMuscle) === totalVolumeKg exactly.
 */
export function resolvePrimaryMuscleGroup(exercise: Exercise): string {
  if (exercise.catalogId) {
    const catalogEntry = getExerciseById(exercise.catalogId);
    if (catalogEntry?.primaryMuscle) {
      return catalogEntry.primaryMuscle;
    }
  }

  if (exercise.targetMuscles && exercise.targetMuscles.length > 0) {
    const first = exercise.targetMuscles[0]?.trim().toLowerCase();
    if (first) return first;
  }

  return 'other';
}

export function resolveAllExerciseMuscles(exercise: Exercise): {
  primary: string;
  secondary: string[];
} {
  if (exercise.catalogId) {
    const catalogEntry = getExerciseById(exercise.catalogId);
    if (catalogEntry) {
      return {
        primary: catalogEntry.primaryMuscle,
        secondary: catalogEntry.secondaryMuscles || [],
      };
    }
  }

  const primary = resolvePrimaryMuscleGroup(exercise);
  const secondary = (exercise.targetMuscles || [])
    .slice(1)
    .map((m) => m.trim().toLowerCase())
    .filter((m) => m && m !== primary);

  return { primary, secondary };
}

/**
 * Calculates estimated load-volume for an individual exercise.
 *
 * Semantic Rules:
 * - Load-volume = sets * reps * weight (kg-reps).
 * - Zero weight exercises (weight <= 0) with sets > 0 are marked as isBodyweight. Their
 *   weighted volume is 0 kg, but effort is tracked via sets/reps without fabricated numbers.
 * - Duration-only exercises (duration > 0, weight <= 0, reps <= 0) are marked as isDurationOnly.
 *   Duration is NOT coerced into reps or volume.
 * - Negative, NaN, or non-finite numbers are safely neutralized to 0.
 */
export function calculateExerciseVolume(exercise: Exercise): ExerciseVolumeBreakdown {
  const sets = Math.max(0, safeNumber(exercise.sets));
  const reps = Math.max(0, safeNumber(exercise.reps));
  const weight = Math.max(0, safeNumber(exercise.weight));
  const duration = Math.max(0, safeNumber(exercise.duration));

  const isBodyweight = weight === 0 && sets > 0;
  const isDurationOnly = duration > 0 && weight === 0 && reps === 0;

  const volumeKg = isDurationOnly ? 0 : Math.round(sets * reps * weight * 10) / 10;
  const primaryMuscle = resolvePrimaryMuscleGroup(exercise);

  return {
    volumeKg,
    isBodyweight,
    isDurationOnly,
    primaryMuscle,
  };
}

/**
 * Calculates aggregate volume and duration metrics for a workout session.
 */
export function calculateWorkoutVolumeSummary(workout: Workout): WorkoutVolumeSummary {
  const exercises = workout.exercises || [];
  let totalVolumeKg = 0;
  let totalDurationMinutes = 0;
  let hasWeighted = false;
  const musclesSet = new Set<string>();

  for (const ex of exercises) {
    const breakdown = calculateExerciseVolume(ex);
    totalVolumeKg += breakdown.volumeKg;
    totalDurationMinutes += Math.max(0, safeNumber(ex.duration));

    if (breakdown.volumeKg > 0) {
      hasWeighted = true;
    }

    const { primary, secondary } = resolveAllExerciseMuscles(ex);
    if (primary && primary !== 'other') musclesSet.add(primary);
    for (const sec of secondary) {
      if (sec && sec !== 'other') musclesSet.add(sec);
    }
  }

  const isBodyweightOnly = exercises.length > 0 && !hasWeighted;

  return {
    totalVolumeKg: Math.round(totalVolumeKg * 10) / 10,
    totalDurationMinutes,
    exerciseCount: exercises.length,
    isBodyweightOnly,
    targetMuscles: Array.from(musclesSet),
  };
}

/**
 * Filters workouts within a given date period (7d, 30d, 90d, all) relative to a reference date.
 * Workouts are sorted chronologically descending (newest first).
 */
export function filterWorkoutsByPeriod(
  workouts: Workout[],
  period: AnalyticsPeriod,
  referenceDate: Date = new Date()
): Workout[] {
  // First sort newest first
  const sorted = [...workouts].sort((a, b) => {
    const dateComp = (b.date || '').localeCompare(a.date || '');
    if (dateComp !== 0) return dateComp;
    return (b.time || '').localeCompare(a.time || '');
  });

  if (period === 'all') {
    return sorted;
  }

  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  const cutoff = new Date(referenceDate);
  cutoff.setDate(cutoff.getDate() - (days - 1));
  cutoff.setHours(0, 0, 0, 0);

  const cutoffKey = cutoff.toISOString().slice(0, 10);

  return sorted.filter((w) => {
    if (!w.date) return false;
    return w.date >= cutoffKey;
  });
}

/**
 * Calculates progression metrics across a given period, including muscle breakdown
 * and safe percentage changes versus the preceding equivalent period.
 */
export function calculateWorkoutProgressionSummary(
  workouts: Workout[],
  period: AnalyticsPeriod,
  referenceDate: Date = new Date()
): WorkoutProgressionSummary {
  const currentWorkouts = filterWorkoutsByPeriod(workouts, period, referenceDate);

  let totalExercises = 0;
  let totalDurationMinutes = 0;
  let totalVolumeKg = 0;
  let bodyweightExercisesCount = 0;
  const volumeByMuscle: Record<string, number> = {};
  const frequencyByMuscle: Record<string, number> = {};

  for (const workout of currentWorkouts) {
    const sessionMuscles = new Set<string>();

    for (const ex of workout.exercises || []) {
      totalExercises += 1;
      totalDurationMinutes += Math.max(0, safeNumber(ex.duration));

      const breakdown = calculateExerciseVolume(ex);
      totalVolumeKg += breakdown.volumeKg;

      if (breakdown.isBodyweight) {
        bodyweightExercisesCount += 1;
      }

      // 1. Primary muscle gets 100% of the volume (no double counting)
      const primary = breakdown.primaryMuscle;
      volumeByMuscle[primary] = Math.round(((volumeByMuscle[primary] || 0) + breakdown.volumeKg) * 10) / 10;

      // 2. Both primary and secondary contribute to frequency for this workout
      const { primary: p, secondary: s } = resolveAllExerciseMuscles(ex);
      if (p) sessionMuscles.add(p);
      for (const sec of s) {
        if (sec) sessionMuscles.add(sec);
      }
    }

    // Tally frequency once per workout per muscle
    for (const m of sessionMuscles) {
      frequencyByMuscle[m] = (frequencyByMuscle[m] || 0) + 1;
    }
  }

  // Safe percentage change vs previous period of same length
  let volumeChangePct: number | null = null;
  let workoutsChangePct: number | null = null;

  if (period !== 'all') {
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const prevRef = new Date(referenceDate);
    prevRef.setDate(prevRef.getDate() - days);

    const prevWorkouts = filterWorkoutsByPeriod(workouts, period, prevRef);
    let prevVolume = 0;
    for (const pw of prevWorkouts) {
      for (const ex of pw.exercises || []) {
        prevVolume += calculateExerciseVolume(ex).volumeKg;
      }
    }

    if (prevVolume > 0) {
      volumeChangePct = Math.round(((totalVolumeKg - prevVolume) / prevVolume) * 100);
    }

    if (prevWorkouts.length > 0) {
      workoutsChangePct = Math.round(
        ((currentWorkouts.length - prevWorkouts.length) / prevWorkouts.length) * 100
      );
    }
  }

  return {
    period,
    totalWorkouts: currentWorkouts.length,
    totalExercises,
    totalDurationMinutes,
    totalVolumeKg: Math.round(totalVolumeKg * 10) / 10,
    volumeByMuscle,
    frequencyByMuscle,
    bodyweightExercisesCount,
    percentageChangeVsPreviousPeriod: {
      volume: volumeChangePct,
      workouts: workoutsChangePct,
    },
  };
}

/**
 * Exercise Identity & Matching Policy:
 * ------------------------------------
 * 1. For catalog exercises: Matches strictly by `exercise.catalogId === target.catalogId`.
 * 2. For custom exercises without catalogId:
 *    Matches strictly by exact trimmed case-insensitive name (`name.trim().toLowerCase()`)
 *    AND where `exercise.catalogId` is falsy (custom to custom only).
 * 3. Never merges custom exercises with catalog exercises.
 * 4. Returns chronologically sorted historical points (oldest to newest for trend visualization).
 */
export function getExerciseHistory(
  workouts: Workout[],
  target: { catalogId?: string; exerciseName?: string }
): ExerciseHistoryPoint[] {
  const points: ExerciseHistoryPoint[] = [];

  const targetCatalogId = target.catalogId?.trim();
  const targetName = target.exerciseName?.trim().toLowerCase();

  if (!targetCatalogId && !targetName) {
    return [];
  }

  for (const workout of workouts) {
    for (const ex of workout.exercises || []) {
      let isMatch = false;

      if (targetCatalogId) {
        isMatch = ex.catalogId === targetCatalogId;
      } else if (targetName && !ex.catalogId) {
        const exName = (ex.exerciseName || ex.name || '').trim().toLowerCase();
        isMatch = exName === targetName;
      }

      if (isMatch) {
        const breakdown = calculateExerciseVolume(ex);
        points.push({
          workoutId: workout.id,
          workoutTitle: workout.title || workout.name || '',
          date: workout.date,
          time: workout.time,
          sets: safeNumber(ex.sets),
          reps: safeNumber(ex.reps),
          weight: safeNumber(ex.weight),
          duration: safeNumber(ex.duration),
          volumeKg: breakdown.volumeKg,
          isBodyweight: breakdown.isBodyweight,
          notes: ex.notes || '',
          catalogId: ex.catalogId,
        });
      }
    }
  }

  // Sort chronological ascending (oldest first for progression graphs)
  return points.sort((a, b) => {
    const dComp = a.date.localeCompare(b.date);
    if (dComp !== 0) return dComp;
    return a.time.localeCompare(b.time);
  });
}

/**
 * Quick-Add / Workout Template Duplication Helper:
 * -----------------------------------------------
 * Generates a completely new draft workout based on an existing workout.
 * - Deep-copies exercise structure and parameters.
 * - Assigns fresh workout ID (`workout-${timestamp}`) and exercise IDs (`draft-ex-${timestamp}-${idx}`).
 * - Preserves all catalogId references and targetMuscles.
 * - Sets the date to the current date and time to current local time.
 * - Original source workout is NOT modified.
 * - Does NOT persist to SQLite directly; returns a draft object for review/editing.
 */
export function createQuickAddWorkoutDraft(
  sourceWorkout: Workout,
  customTitle?: string,
  referenceDate: Date = new Date()
): Workout {
  const timestamp = Date.now();
  const newDate = referenceDate.toISOString().slice(0, 10);
  const newTime = referenceDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const exercises: Exercise[] = (sourceWorkout.exercises || []).map((ex, idx) => ({
    id: `draft-ex-${timestamp}-${idx}`,
    exerciseName: ex.exerciseName || ex.name || '',
    name: ex.exerciseName || ex.name || '',
    sets: safeNumber(ex.sets),
    reps: safeNumber(ex.reps),
    weight: safeNumber(ex.weight),
    duration: safeNumber(ex.duration),
    notes: ex.notes || '',
    targetMuscles: ex.targetMuscles ? [...ex.targetMuscles] : [],
    catalogId: ex.catalogId,
  }));

  return {
    id: `workout-${timestamp}`,
    title: customTitle || sourceWorkout.title || sourceWorkout.name || '',
    name: customTitle || sourceWorkout.title || sourceWorkout.name || '',
    date: newDate,
    time: newTime,
    notes: sourceWorkout.notes || '',
    exercises,
  };
}
