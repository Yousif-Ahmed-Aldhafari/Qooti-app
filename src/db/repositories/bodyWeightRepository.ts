import { IDatabase, BodyWeightRepository } from '../types';
import {
  BodyWeightEntry,
  TimePrecision,
  WeightSource,
  validateBodyWeightEntry,
} from '../../models/biometrics';

interface BodyWeightRow {
  id: string;
  date: string;
  time: string;
  time_precision?: string | null;
  weight_kg: number;
  notes: string | null;
  source: string;
  created_at: string;
  updated_at: string;
}

export class SQLiteBodyWeightRepository implements BodyWeightRepository {
  constructor(private db: IDatabase) {}

  private mapRow(row: BodyWeightRow): BodyWeightEntry {
    return {
      id: row.id,
      date: row.date,
      time: row.time,
      timePrecision: (row.time_precision as TimePrecision) || 'minute',
      weightKg: row.weight_kg,
      notes: row.notes,
      source: row.source as WeightSource,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getAllWeights(txn?: IDatabase): Promise<BodyWeightEntry[]> {
    const target = txn || this.db;
    const rows = await target.getAllAsync<BodyWeightRow>(
      `SELECT * FROM body_weight_entries
       ORDER BY date DESC, time DESC, created_at DESC;`
    );
    return rows.map((r) => this.mapRow(r));
  }

  async getWeightById(id: string, txn?: IDatabase): Promise<BodyWeightEntry | null> {
    const target = txn || this.db;
    const row = await target.getFirstAsync<BodyWeightRow>(
      `SELECT * FROM body_weight_entries WHERE id = ?;`,
      id
    );
    return row ? this.mapRow(row) : null;
  }

  async getWeightsByDateRange(
    startDate: string,
    endDate: string,
    txn?: IDatabase
  ): Promise<BodyWeightEntry[]> {
    const target = txn || this.db;
    const rows = await target.getAllAsync<BodyWeightRow>(
      `SELECT * FROM body_weight_entries
       WHERE date >= ? AND date <= ?
       ORDER BY date ASC, time ASC, created_at ASC;`,
      startDate,
      endDate
    );
    return rows.map((r) => this.mapRow(r));
  }

  async getWeightsForDate(date: string, txn?: IDatabase): Promise<BodyWeightEntry[]> {
    const target = txn || this.db;
    const rows = await target.getAllAsync<BodyWeightRow>(
      `SELECT * FROM body_weight_entries
       WHERE date = ?
       ORDER BY time ASC, created_at ASC;`,
      date
    );
    return rows.map((r) => this.mapRow(r));
  }

  async getLatestWeight(txn?: IDatabase): Promise<BodyWeightEntry | null> {
    const target = txn || this.db;
    const row = await target.getFirstAsync<BodyWeightRow>(
      `SELECT * FROM body_weight_entries
       ORDER BY date DESC, time DESC, created_at DESC
       LIMIT 1;`
    );
    return row ? this.mapRow(row) : null;
  }

  async insertWeight(entry: BodyWeightEntry, txn?: IDatabase): Promise<void> {
    validateBodyWeightEntry(entry);
    const target = txn || this.db;

    await target.runAsync(
      `INSERT INTO body_weight_entries (
         id, date, time, time_precision, weight_kg, notes, source, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      entry.id,
      entry.date,
      entry.time,
      entry.timePrecision || 'minute',
      entry.weightKg,
      entry.notes ?? null,
      entry.source,
      entry.createdAt,
      entry.updatedAt
    );
  }

  async updateWeight(entry: BodyWeightEntry, txn?: IDatabase): Promise<void> {
    validateBodyWeightEntry(entry);
    const target = txn || this.db;

    const result = await target.runAsync(
      `UPDATE body_weight_entries
       SET date = ?,
           time = ?,
           time_precision = ?,
           weight_kg = ?,
           notes = ?,
           source = ?,
           updated_at = ?
       WHERE id = ?;`,
      entry.date,
      entry.time,
      entry.timePrecision || 'minute',
      entry.weightKg,
      entry.notes ?? null,
      entry.source,
      entry.updatedAt,
      entry.id
    );

    if (result.changes === 0) {
      throw new Error(`Body weight entry with ID "${entry.id}" not found to update`);
    }
  }

  async deleteWeight(id: string, txn?: IDatabase): Promise<void> {
    const target = txn || this.db;
    await target.runAsync(`DELETE FROM body_weight_entries WHERE id = ?;`, id);
  }
}
