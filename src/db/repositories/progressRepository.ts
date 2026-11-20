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

  private mapRow(r: ProgressRow): ProgressEntry {
    return normalizeProgressEntry({
      id: r.id,
      date: r.date,
      label: r.label,
      calories: r.calories,
      workouts: r.workouts,
      weightKg: r.weight_kg,
      steps: r.steps,
    });
  }

  async getAllProgress(txn?: IDatabase): Promise<ProgressEntry[]> {
    const target = txn || this.db;
    const rows = await target.getAllAsync<ProgressRow>(
      'SELECT * FROM progress_entries ORDER BY date ASC, created_at ASC;'
    );

    return rows.map((r) => this.mapRow(r));
  }

  async getProgressById(id: string, txn?: IDatabase): Promise<ProgressEntry | null> {
    const target = txn || this.db;
    const row = await target.getFirstAsync<ProgressRow>(
      'SELECT * FROM progress_entries WHERE id = ?;',
      id
    );

    return row ? this.mapRow(row) : null;
  }

  async insertProgressEntry(entry: ProgressEntry, txn?: IDatabase): Promise<void> {
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

  async updateProgressEntry(entry: ProgressEntry, txn?: IDatabase): Promise<void> {
    const target = txn || this.db;
    const normalized = normalizeProgressEntry(entry);

    const result = await target.runAsync(
      `UPDATE progress_entries
       SET date = ?,
           label = ?,
           calories = ?,
           workouts = ?,
           weight_kg = ?,
           steps = ?
       WHERE id = ?;`,
      normalized.date,
      normalized.label,
      normalized.calories,
      normalized.workouts,
      normalized.weightKg,
      normalized.steps,
      normalized.id
    );

    if (result.changes === 0) {
      throw new Error(`Progress entry with ID "${entry.id}" not found to update`);
    }
  }

  async deleteProgressEntry(id: string, txn?: IDatabase): Promise<void> {
    const target = txn || this.db;
    await target.runAsync('DELETE FROM progress_entries WHERE id = ?;', id);
  }

  async addProgress(entry: ProgressEntry, txn?: IDatabase): Promise<void> {
    return this.insertProgressEntry(entry, txn);
  }

  /**
   * Safe batch save: upserts provided entries in a single transaction without wiping
   * existing progress records. Preserves existing rows not present in this batch.
   */
  async saveAllProgress(entries: ProgressEntry[], txn?: IDatabase): Promise<void> {
    const execute = async (client: IDatabase) => {
      const now = new Date().toISOString();
      for (const raw of entries) {
        const normalized = normalizeProgressEntry(raw);
        await client.runAsync(
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
    };

    if (txn) {
      await execute(txn);
    } else {
      await this.db.withExclusiveTransactionAsync(execute);
    }
  }
}
