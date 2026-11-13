import { getExerciseById } from '../data/exerciseCatalog';
import type { Exercise, Workout } from '../models/workout';
import { createId } from './id';
import { safeNumber } from './nutrition';

export type AnalyticsPeriod = '7d' | '30d' | '90d' | 'all';

export type ExerciseCategoryType =
  | 'weighted'
  | 'bodyweight'
  | 'duration_only'
  | 'unweighted';

export type ExerciseVolumeBreakdown = {
  volumeKg: number;
  category: ExerciseCategoryType;
  isWeighted: boolean;
  isBodyweight: boolean;
  isDurationOnly: boolean;
  isUnweighted: boolean;
  primaryMuscle: string;
};

export type WorkoutVolumeSummary = {
  totalVolumeKg: number;
  totalDurationMinutes: number;
  exerciseCount: number;
  isBodyweightOnly: boolean;
  hasUnweightedExercises: boolean;
  targetMuscles: string[];
};

export type MuscleGroupVolumeAttribution = {
  muscleGroup: string;
  volumeKg: number;
  frequency: number;
};

export type WorkoutProgressionSummary = {
  period: AnalyticsPeriod;
  dateWindow: {
    startDate: string | null;
    endDate: string;
  };
  previousDateWindow: {
    startDate: string | null;
    endDate: string | null;
  };
  totalWorkouts: number;
  totalExercises: number;
  totalDurationMinutes: number;
  totalVolumeKg: number;
  volumeByMuscle: Record<string, number>;
  frequencyByMuscle: Record<string, number>;
  bodyweightExercisesCount: number;
  unweightedExercisesCount: number;
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

export type FilterWorkoutsOptions = {
  includeFuture?: boolean;
};

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates whether a given value is a real calendar date string in YYYY-MM-DD format.
 * Accurately rejects out-of-range months, invalid days, and non-leap years (e.g. 2026-02-29).
 */
export function isValidDateString(dateStr: unknown): boolean {
  if (typeof dateStr !== 'string' || !ISO_DATE_REGEX.test(dateStr)) {
    return false;
  }
  const parts = dateStr.split('-');
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }

  const d = new Date(year, month - 1, day);
  return (
    d.getFullYear() === year &&
    d.getMonth() === month - 1 &&
    d.getDate() === day
  );
}

/**
 * Formats a Date instance as YYYY-MM-DD using its local calendar components,
 * preventing unexpected timezone or UTC day-shift defects.
 */
export function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Computes the start and end calendar dates (YYYY-MM-DD) for a given analytics period
 * relative to a reference date. Setting time to 12:00:00 protects against DST boundary shifts.
 */
export function getDateWindow(
  period: AnalyticsPeriod,
  referenceDate: Date = new Date()
): { startDate: string | null; endDate: string } {
  const refLocal = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    12,
    0,
    0,
    0
  );
  const endDate = toLocalDateString(refLocal);

  if (period === 'all') {
    return { startDate: null, endDate };
  }

  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  const startLocal = new Date(refLocal);
  startLocal.setDate(startLocal.getDate() - (days - 1));
  const startDate = toLocalDateString(startLocal);

  return { startDate, endDate };
}

/**
 * Computes the start and end calendar dates for the preceding equivalent-length period.
 * Guarantees that current and previous periods never overlap and have equal day counts.
 */
export function getPreviousDateWindow(
  period: AnalyticsPeriod,
  referenceDate: Date = new Date()
): { startDate: string | null; endDate: string | null } {
  if (period === 'all') {
    return { startDate: null, endDate: null };
  }

  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  const refLocal = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    12,
    0,
    0,
    0
  );

  const prevEndLocal = new Date(refLocal);
  prevEndLocal.setDate(prevEndLocal.getDate() - days);
  const endDate = toLocalDateString(prevEndLocal);

  const prevStartLocal = new Date(prevEndLocal);
  prevStartLocal.setDate(prevStartLocal.getDate() - (days - 1));
  const startDate = toLocalDateString(prevStartLocal);

  return { startDate, endDate };
}

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

const BODYWEIGHT_NAME_PATTERNS = [
  /bodyweight/i,
  /calisthenic/i,
  /push[- ]?up/i,
  /pull[- ]?up/i,
  /chin[- ]?up/i,
  /dip/i,
  /crunch/i,
  /sit[- ]?up/i,
  /plank/i,
  /air[- ]?squat/i,
  /jumping[- ]?jack/i,
  /burpee/i,
  /وزن الجسم/,
  /ضغط/,
  /عقلة/,
  /متوازي/,
  /بلانك/,
  /معدة/,
];

/**
 * Distinguishes confirmed bodyweight movements from unknown or zero-weight resistance exercises.
 * Uses catalog equipment metadata when available, or recognized bodyweight name patterns.
 */
export function isConfirmedBodyweightExercise(exercise: Exercise): boolean {
  if (exercise.catalogId) {
    const catalogItem = getExerciseById(exercise.catalogId);
    if (catalogItem) {
      return catalogItem.equipment === 'bodyweight';
    }
  }

  const name = (exercise.exerciseName || exercise.name || '').trim();
  if (BODYWEIGHT_NAME_PATTERNS.some((pattern) => pattern.test(name))) {
    return true;
  }

  return false;
}

/**
 * Calculates estimated load-volume for an individual exercise.
 *
 * Semantic Rules:
 * - Weighted resistance: sets * reps * external weight in kg.
 * - Confirmed bodyweight: weight === 0, sets > 0, equipment is bodyweight. External load volume = 0 kg.
 * - Duration-only: duration > 0, weight === 0, reps === 0. Volume = 0 kg.
 * - Unweighted / unknown-load: weight === 0, sets > 0 on non-bodyweight movement. Volume = 0 kg.
 * - Negative, NaN, or non-finite numbers are safely neutralized to 0.
 */
export function calculateExerciseVolume(exercise: Exercise): ExerciseVolumeBreakdown {
  const sets = Math.max(0, safeNumber(exercise.sets));
  const reps = Math.max(0, safeNumber(exercise.reps));
  const weight = Math.max(0, safeNumber(exercise.weight));
  const duration = Math.max(0, safeNumber(exercise.duration));

  const isDurationOnly = duration > 0 && weight === 0 && reps === 0;
  const isWeighted = weight > 0 && sets > 0 && reps > 0;

  let category: ExerciseCategoryType;
  if (isWeighted) {
    category = 'weighted';
  } else if (isDurationOnly) {
    category = 'duration_only';
  } else if (weight === 0 && sets > 0) {
    category = isConfirmedBodyweightExercise(exercise) ? 'bodyweight' : 'unweighted';
  } else {
    category = 'unweighted';
  }

  const isBodyweight = category === 'bodyweight';
  const isUnweighted = category === 'unweighted';
  const volumeKg = isWeighted ? Math.round(sets * reps * weight * 10) / 10 : 0;
  const primaryMuscle = resolvePrimaryMuscleGroup(exercise);

  return {
    volumeKg,
    category,
    isWeighted,
    isBodyweight,
    isDurationOnly,
    isUnweighted,
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
  let hasBodyweight = false;
  let hasUnweighted = false;
  const musclesSet = new Set<string>();

  for (const ex of exercises) {
    const breakdown = calculateExerciseVolume(ex);
    totalVolumeKg += breakdown.volumeKg;
    totalDurationMinutes += Math.max(0, safeNumber(ex.duration));

    if (breakdown.isWeighted) hasWeighted = true;
    if (breakdown.isBodyweight) hasBodyweight = true;
    if (breakdown.isUnweighted) hasUnweighted = true;

    const { primary, secondary } = resolveAllExerciseMuscles(ex);
    if (primary && primary !== 'other') musclesSet.add(primary);
    for (const sec of secondary) {
      if (sec && sec !== 'other') musclesSet.add(sec);
    }
  }

  // isBodyweightOnly is true strictly when session contains confirmed bodyweight movements
  // and NO external weighted exercises and NO unweighted/unknown resistance exercises
  const isBodyweightOnly =
    exercises.length > 0 && hasBodyweight && !hasWeighted && !hasUnweighted;

  return {
    totalVolumeKg: Math.round(totalVolumeKg * 10) / 10,
    totalDurationMinutes,
    exerciseCount: exercises.length,
    isBodyweightOnly,
    hasUnweightedExercises: hasUnweighted,
    targetMuscles: Array.from(musclesSet),
  };
}

/**
 * Filters workouts within a given date period (7d, 30d, 90d, all) relative to a reference date.
 * Workouts are sorted chronologically descending (newest first) with deterministic tie-breaking.
 * Excludes future-dated workouts from bounded historical windows.
 */
export function filterWorkoutsByPeriod(
  workouts: Workout[],
  period: AnalyticsPeriod,
  referenceDate: Date = new Date(),
  options?: FilterWorkoutsOptions
): Workout[] {
  // Sort newest first; if date and time match, use id as deterministic tie-breaker
  const sorted = [...workouts].sort((a, b) => {
    const dateA = a.date || '';
    const dateB = b.date || '';
    const dateComp = dateB.localeCompare(dateA);
    if (dateComp !== 0) return dateComp;
    const timeA = a.time || '';
    const timeB = b.time || '';
    const timeComp = timeB.localeCompare(timeA);
    if (timeComp !== 0) return timeComp;
    return (b.id || '').localeCompare(a.id || '');
  });

  const { startDate, endDate } = getDateWindow(period, referenceDate);

  return sorted.filter((w) => {
    if (!w.date || !isValidDateString(w.date)) {
      return false;
    }

    if (period === 'all') {
      if (options?.includeFuture === false) {
        return w.date <= endDate;
      }
      return true;
    }

    return startDate !== null && w.date >= startDate && w.date <= endDate;
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
  const dateWindow = getDateWindow(period, referenceDate);
  const previousDateWindow = getPreviousDateWindow(period, referenceDate);

  // Current workouts strictly up to reference date (no future workouts)
  const currentWorkouts = filterWorkoutsByPeriod(workouts, period, referenceDate, {
    includeFuture: false,
  });

  let totalExercises = 0;
  let totalDurationMinutes = 0;
  let totalVolumeKg = 0;
  let bodyweightExercisesCount = 0;
  let unweightedExercisesCount = 0;
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
      } else if (breakdown.isUnweighted) {
        unweightedExercisesCount += 1;
      }

      // 1. Primary muscle gets 100% of the volume (no double counting)
      const primary = breakdown.primaryMuscle;
      volumeByMuscle[primary] =
        Math.round(((volumeByMuscle[primary] || 0) + breakdown.volumeKg) * 10) / 10;

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

  if (period !== 'all' && previousDateWindow.startDate && previousDateWindow.endDate) {
    const prevWorkouts = workouts.filter((w) => {
      if (!w.date || !isValidDateString(w.date)) return false;
      return (
        w.date >= previousDateWindow.startDate! &&
        w.date <= previousDateWindow.endDate!
      );
    });

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
    dateWindow,
    previousDateWindow,
    totalWorkouts: currentWorkouts.length,
    totalExercises,
    totalDurationMinutes,
    totalVolumeKg: Math.round(totalVolumeKg * 10) / 10,
    volumeByMuscle,
    frequencyByMuscle,
    bodyweightExercisesCount,
    unweightedExercisesCount,
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
 * - Assigns fresh collision-resistant workout ID (`createId('workout')`) and exercise IDs (`createId('draft-ex')`).
 * - Preserves all catalogId references, targetMuscles, and sequence order.
 * - Sets the date to the current local calendar date and time to current local time.
 * - Original source workout is NOT modified.
 * - Does NOT persist to SQLite directly; returns a draft object for review/editing.
 */
export function createQuickAddWorkoutDraft(
  sourceWorkout: Workout,
  customTitle?: string,
  referenceDate: Date = new Date()
): Workout {
  const workoutId = createId('workout');
  const refLocal = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    referenceDate.getHours(),
    referenceDate.getMinutes(),
    0,
    0
  );
  const newDate = toLocalDateString(refLocal);
  const newTime = referenceDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const exercises: Exercise[] = (sourceWorkout.exercises || []).map((ex) => ({
    id: createId('draft-ex'),
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
    id: workoutId,
    title: customTitle || sourceWorkout.title || sourceWorkout.name || '',
    name: customTitle || sourceWorkout.title || sourceWorkout.name || '',
    date: newDate,
    time: newTime,
    notes: sourceWorkout.notes || '',
    exercises,
  };
}
