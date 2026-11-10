import { IDatabase, ProgressRepository } from '../types';
import { ProgressEntry, normalizeProgressEntry } from '../../models/progress';

interface ProgressRow {
  id: string;
  date: string;
  label: string;
  calories: number;
  workouts: number;
  weight_kg: number;
  steps: number;
  created_at: string;
}

export class SQLiteProgressRepository implements ProgressRepository {
  constructor(private db: IDatabase) {}

  async getAllProgress(): Promise<ProgressEntry[]> {
    const rows = await this.db.getAllAsync<ProgressRow>(
      'SELECT * FROM progress_entries ORDER BY date ASC, created_at ASC;'
    );

    return rows.map((r) =>
      normalizeProgressEntry({
        id: r.id,
        date: r.date,
        label: r.label,
        calories: r.calories,
        workouts: r.workouts,
        weightKg: r.weight_kg,
        steps: r.steps,
      })
    );
  }

  async addProgress(entry: ProgressEntry, txn?: IDatabase): Promise<void> {
    const target = txn || this.db;
    const normalized = normalizeProgressEntry(entry);
    const now = new Date().toISOString();

    await target.runAsync(
      `INSERT INTO progress_entries (id, date, label, calories, workouts, weight_kg, steps, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         date = excluded.date,
         label = excluded.label,
         calories = excluded.calories,
         workouts = excluded.workouts,
         weight_kg = excluded.weight_kg,
         steps = excluded.steps;`,
      normalized.id,
      normalized.date,
      normalized.label,
      normalized.calories,
      normalized.workouts,
      normalized.weightKg,
      normalized.steps,
      now
    );
  }

  async saveAllProgress(entries: ProgressEntry[], txn?: IDatabase): Promise<void> {
    const target = txn || this.db;
    const now = new Date().toISOString();

    await target.withExclusiveTransactionAsync(async (t) => {
      await t.runAsync('DELETE FROM progress_entries;');

      for (const raw of entries) {
        const normalized = normalizeProgressEntry(raw);
        await t.runAsync(
          `INSERT INTO progress_entries (id, date, label, calories, workouts, weight_kg, steps, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
          normalized.id,
          normalized.date,
          normalized.label,
          normalized.calories,
          normalized.workouts,
          normalized.weightKg,
          normalized.steps,
          now
        );
      }
    });
  }
}
