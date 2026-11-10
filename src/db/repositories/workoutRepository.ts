import { IDatabase, WorkoutRepository } from '../types';
import { Workout, Exercise, normalizeWorkout, normalizeExercise } from '../../models/workout';

interface WorkoutRow {
  id: string;
  title: string;
  date: string;
  time: string;
  notes: string | null;
  created_at: string;
}

interface ExerciseRow {
  id: string;
  workout_id: string;
  name: string;
  target_muscles: string;
  sets: number;
  reps: number;
  weight: number | null;
  duration: number | null;
  notes: string | null;
  sort_order: number;
}

export class SQLiteWorkoutRepository implements WorkoutRepository {
  constructor(private db: IDatabase) {}

  async getAllWorkouts(): Promise<Workout[]> {
    const workoutRows = await this.db.getAllAsync<WorkoutRow>(
      'SELECT * FROM workouts ORDER BY date DESC, created_at DESC;'
    );
    if (workoutRows.length === 0) {
      return [];
    }

    const exerciseRows = await this.db.getAllAsync<ExerciseRow>(
      'SELECT * FROM workout_exercises ORDER BY sort_order ASC;'
    );

    const exercisesByWorkoutId = new Map<string, Exercise[]>();
    for (const ex of exerciseRows) {
      let targetMuscles: string[] = [];
      try {
        targetMuscles = JSON.parse(ex.target_muscles);
        if (!Array.isArray(targetMuscles)) {
          targetMuscles = [String(ex.target_muscles)];
        }
      } catch {
        targetMuscles = ex.target_muscles ? [ex.target_muscles] : [];
      }

      const exercise = normalizeExercise({
        id: ex.id,
        name: ex.name,
        targetMuscles,
        sets: ex.sets,
        reps: ex.reps,
        weight: ex.weight ?? 0,
        duration: ex.duration ?? 0,
        notes: ex.notes ?? '',
      });

      const list = exercisesByWorkoutId.get(ex.workout_id) || [];
      list.push(exercise);
      exercisesByWorkoutId.set(ex.workout_id, list);
    }

    return workoutRows.map((w) =>
      normalizeWorkout({
        id: w.id,
        title: w.title,
        date: w.date,
        time: w.time,
        notes: w.notes ?? undefined,
        exercises: exercisesByWorkoutId.get(w.id) || [],
      })
    );
  }

  async getWorkoutById(id: string): Promise<Workout | null> {
    const workoutRow = await this.db.getFirstAsync<WorkoutRow>(
      'SELECT * FROM workouts WHERE id = ?;',
      id
    );
    if (!workoutRow) {
      return null;
    }

    const exerciseRows = await this.db.getAllAsync<ExerciseRow>(
      'SELECT * FROM workout_exercises WHERE workout_id = ? ORDER BY sort_order ASC;',
      id
    );

    const exercises = exerciseRows.map((ex) => {
      let targetMuscles: string[] = [];
      try {
        targetMuscles = JSON.parse(ex.target_muscles);
        if (!Array.isArray(targetMuscles)) {
          targetMuscles = [String(ex.target_muscles)];
        }
      } catch {
        targetMuscles = ex.target_muscles ? [ex.target_muscles] : [];
      }

      return normalizeExercise({
        id: ex.id,
        name: ex.name,
        targetMuscles,
        sets: ex.sets,
        reps: ex.reps,
        weight: ex.weight ?? 0,
        duration: ex.duration ?? 0,
        notes: ex.notes ?? '',
      });
    });

    return normalizeWorkout({
      id: workoutRow.id,
      title: workoutRow.title,
      date: workoutRow.date,
      time: workoutRow.time,
      notes: workoutRow.notes ?? undefined,
      exercises,
    });
  }

  async insertWorkout(workout: Workout, txn?: IDatabase): Promise<void> {
    const target = txn || this.db;
    const normalized = normalizeWorkout(workout);
    const now = new Date().toISOString();

    await target.withExclusiveTransactionAsync(async (t) => {
      await t.runAsync(
        `INSERT INTO workouts (id, title, date, time, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?);`,
        normalized.id,
        normalized.title,
        normalized.date,
        normalized.time,
        normalized.notes ?? null,
        now
      );

      for (let i = 0; i < normalized.exercises.length; i++) {
        const ex = normalizeExercise(normalized.exercises[i]);
        await t.runAsync(
          `INSERT INTO workout_exercises (
             id, workout_id, name, target_muscles, sets, reps, weight, duration, notes, sort_order
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          ex.id,
          normalized.id,
          ex.name,
          JSON.stringify(ex.targetMuscles || []),
          ex.sets,
          ex.reps,
          ex.weight ?? null,
          ex.duration ?? null,
          ex.notes ?? null,
          i
        );
      }
    });
  }

  async updateWorkout(workout: Workout, txn?: IDatabase): Promise<void> {
    const target = txn || this.db;
    const normalized = normalizeWorkout(workout);

    await target.withExclusiveTransactionAsync(async (t) => {
      await t.runAsync(
        `UPDATE workouts SET
           title = ?,
           date = ?,
           time = ?,
           notes = ?
         WHERE id = ?;`,
        normalized.title,
        normalized.date,
        normalized.time,
        normalized.notes ?? null,
        normalized.id
      );

      await t.runAsync('DELETE FROM workout_exercises WHERE workout_id = ?;', normalized.id);

      for (let i = 0; i < normalized.exercises.length; i++) {
        const ex = normalizeExercise(normalized.exercises[i]);
        await t.runAsync(
          `INSERT INTO workout_exercises (
             id, workout_id, name, target_muscles, sets, reps, weight, duration, notes, sort_order
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          ex.id,
          normalized.id,
          ex.name,
          JSON.stringify(ex.targetMuscles || []),
          ex.sets,
          ex.reps,
          ex.weight ?? null,
          ex.duration ?? null,
          ex.notes ?? null,
          i
        );
      }
    });
  }

  async deleteWorkout(id: string, txn?: IDatabase): Promise<void> {
    const target = txn || this.db;
    await target.withExclusiveTransactionAsync(async (t) => {
      await t.runAsync('DELETE FROM workout_exercises WHERE workout_id = ?;', id);
      await t.runAsync('DELETE FROM workouts WHERE id = ?;', id);
    });
  }

  async saveAllWorkouts(workouts: Workout[], txn?: IDatabase): Promise<void> {
    const target = txn || this.db;
    const now = new Date().toISOString();

    await target.withExclusiveTransactionAsync(async (t) => {
      await t.runAsync('DELETE FROM workout_exercises;');
      await t.runAsync('DELETE FROM workouts;');

      for (const workout of workouts) {
        const normalized = normalizeWorkout(workout);
        await t.runAsync(
          `INSERT INTO workouts (id, title, date, time, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?);`,
          normalized.id,
          normalized.title,
          normalized.date,
          normalized.time,
          normalized.notes ?? null,
          now
        );

        for (let i = 0; i < normalized.exercises.length; i++) {
          const ex = normalizeExercise(normalized.exercises[i]);
          await t.runAsync(
            `INSERT INTO workout_exercises (
               id, workout_id, name, target_muscles, sets, reps, weight, duration, notes, sort_order
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
            ex.id,
            normalized.id,
            ex.name,
            JSON.stringify(ex.targetMuscles || []),
            ex.sets,
            ex.reps,
            ex.weight ?? null,
            ex.duration ?? null,
            ex.notes ?? null,
            i
          );
        }
      }
    });
  }
}
