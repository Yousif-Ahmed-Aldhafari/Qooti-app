import { IDatabase, BodyCompositionRepository } from '../types';
import {
  BodyCompositionEntry,
  CompositionMethod,
  validateBodyCompositionEntry,
} from '../../models/biometrics';

interface BodyCompositionRow {
  id: string;
  date: string;
  time: string;
  body_fat_percentage: number | null;
  skeletal_muscle_mass_kg: number | null;
  bone_mass_kg: number | null;
  body_water_percentage: number | null;
  method: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export class SQLiteBodyCompositionRepository implements BodyCompositionRepository {
  constructor(private db: IDatabase) {}

  private mapRow(row: BodyCompositionRow): BodyCompositionEntry {
    return {
      id: row.id,
      date: row.date,
      time: row.time,
      bodyFatPercentage: row.body_fat_percentage,
      skeletalMuscleMassKg: row.skeletal_muscle_mass_kg,
      boneMassKg: row.bone_mass_kg,
      bodyWaterPercentage: row.body_water_percentage,
      method: (row.method as CompositionMethod) ?? null,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getAllCompositions(txn?: IDatabase): Promise<BodyCompositionEntry[]> {
    const target = txn || this.db;
    const rows = await target.getAllAsync<BodyCompositionRow>(
      `SELECT * FROM body_composition_entries
       ORDER BY date DESC, time DESC, created_at DESC;`
    );
    return rows.map((r) => this.mapRow(r));
  }

  async getCompositionById(id: string, txn?: IDatabase): Promise<BodyCompositionEntry | null> {
    const target = txn || this.db;
    const row = await target.getFirstAsync<BodyCompositionRow>(
      `SELECT * FROM body_composition_entries WHERE id = ?;`,
      id
    );
    return row ? this.mapRow(row) : null;
  }

  async getCompositionsByDateRange(
    startDate: string,
    endDate: string,
    txn?: IDatabase
  ): Promise<BodyCompositionEntry[]> {
    const target = txn || this.db;
    const rows = await target.getAllAsync<BodyCompositionRow>(
      `SELECT * FROM body_composition_entries
       WHERE date >= ? AND date <= ?
       ORDER BY date ASC, time ASC, created_at ASC;`,
      startDate,
      endDate
    );
    return rows.map((r) => this.mapRow(r));
  }

  async getLatestComposition(txn?: IDatabase): Promise<BodyCompositionEntry | null> {
    const target = txn || this.db;
    const row = await target.getFirstAsync<BodyCompositionRow>(
      `SELECT * FROM body_composition_entries
       ORDER BY date DESC, time DESC, created_at DESC
       LIMIT 1;`
    );
    return row ? this.mapRow(row) : null;
  }

  async insertComposition(entry: BodyCompositionEntry, txn?: IDatabase): Promise<void> {
    validateBodyCompositionEntry(entry);
    const target = txn || this.db;

    await target.runAsync(
      `INSERT INTO body_composition_entries (
         id, date, time, body_fat_percentage, skeletal_muscle_mass_kg,
         bone_mass_kg, body_water_percentage, method, notes, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      entry.id,
      entry.date,
      entry.time,
      entry.bodyFatPercentage ?? null,
      entry.skeletalMuscleMassKg ?? null,
      entry.boneMassKg ?? null,
      entry.bodyWaterPercentage ?? null,
      entry.method ?? null,
      entry.notes ?? null,
      entry.createdAt,
      entry.updatedAt
    );
  }

  async updateComposition(entry: BodyCompositionEntry, txn?: IDatabase): Promise<void> {
    validateBodyCompositionEntry(entry);
    const target = txn || this.db;

    const result = await target.runAsync(
      `UPDATE body_composition_entries
       SET date = ?,
           time = ?,
           body_fat_percentage = ?,
           skeletal_muscle_mass_kg = ?,
           bone_mass_kg = ?,
           body_water_percentage = ?,
           method = ?,
           notes = ?,
           updated_at = ?
       WHERE id = ?;`,
      entry.date,
      entry.time,
      entry.bodyFatPercentage ?? null,
      entry.skeletalMuscleMassKg ?? null,
      entry.boneMassKg ?? null,
      entry.bodyWaterPercentage ?? null,
      entry.method ?? null,
      entry.notes ?? null,
      entry.updatedAt,
      entry.id
    );

    if (result.changes === 0) {
      throw new Error(`Body composition entry with ID "${entry.id}" not found to update`);
    }
  }

  async deleteComposition(id: string, txn?: IDatabase): Promise<void> {
    const target = txn || this.db;
    await target.runAsync(`DELETE FROM body_composition_entries WHERE id = ?;`, id);
  }
}
