import { IDatabase, BodyMeasurementRepository } from '../types';
import {
  BodyMeasurementEntry,
  validateBodyMeasurementEntry,
} from '../../models/biometrics';

interface BodyMeasurementRow {
  id: string;
  date: string;
  time: string;
  chest_cm: number | null;
  waist_cm: number | null;
  hips_cm: number | null;
  left_arm_cm: number | null;
  right_arm_cm: number | null;
  left_thigh_cm: number | null;
  right_thigh_cm: number | null;
  left_calf_cm: number | null;
  right_calf_cm: number | null;
  shoulders_cm: number | null;
  neck_cm: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export class SQLiteBodyMeasurementRepository implements BodyMeasurementRepository {
  constructor(private db: IDatabase) {}

  private mapRow(row: BodyMeasurementRow): BodyMeasurementEntry {
    return {
      id: row.id,
      date: row.date,
      time: row.time,
      chestCm: row.chest_cm,
      waistCm: row.waist_cm,
      hipsCm: row.hips_cm,
      leftArmCm: row.left_arm_cm,
      rightArmCm: row.right_arm_cm,
      leftThighCm: row.left_thigh_cm,
      rightThighCm: row.right_thigh_cm,
      leftCalfCm: row.left_calf_cm,
      rightCalfCm: row.right_calf_cm,
      shouldersCm: row.shoulders_cm,
      neckCm: row.neck_cm,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getAllMeasurements(txn?: IDatabase): Promise<BodyMeasurementEntry[]> {
    const target = txn || this.db;
    const rows = await target.getAllAsync<BodyMeasurementRow>(
      `SELECT * FROM body_measurement_entries
       ORDER BY date DESC, time DESC, created_at DESC;`
    );
    return rows.map((r) => this.mapRow(r));
  }

  async getMeasurementById(id: string, txn?: IDatabase): Promise<BodyMeasurementEntry | null> {
    const target = txn || this.db;
    const row = await target.getFirstAsync<BodyMeasurementRow>(
      `SELECT * FROM body_measurement_entries WHERE id = ?;`,
      id
    );
    return row ? this.mapRow(row) : null;
  }

  async getMeasurementsByDateRange(
    startDate: string,
    endDate: string,
    txn?: IDatabase
  ): Promise<BodyMeasurementEntry[]> {
    const target = txn || this.db;
    const rows = await target.getAllAsync<BodyMeasurementRow>(
      `SELECT * FROM body_measurement_entries
       WHERE date >= ? AND date <= ?
       ORDER BY date ASC, time ASC, created_at ASC;`,
      startDate,
      endDate
    );
    return rows.map((r) => this.mapRow(r));
  }

  async getMeasurementsForDate(date: string, txn?: IDatabase): Promise<BodyMeasurementEntry[]> {
    const target = txn || this.db;
    const rows = await target.getAllAsync<BodyMeasurementRow>(
      `SELECT * FROM body_measurement_entries
       WHERE date = ?
       ORDER BY time ASC, created_at ASC;`,
      date
    );
    return rows.map((r) => this.mapRow(r));
  }

  async getLatestMeasurement(txn?: IDatabase): Promise<BodyMeasurementEntry | null> {
    const target = txn || this.db;
    const row = await target.getFirstAsync<BodyMeasurementRow>(
      `SELECT * FROM body_measurement_entries
       ORDER BY date DESC, time DESC, created_at DESC
       LIMIT 1;`
    );
    return row ? this.mapRow(row) : null;
  }

  async insertMeasurement(entry: BodyMeasurementEntry, txn?: IDatabase): Promise<void> {
    validateBodyMeasurementEntry(entry);
    const target = txn || this.db;

    await target.runAsync(
      `INSERT INTO body_measurement_entries (
         id, date, time, chest_cm, waist_cm, hips_cm, left_arm_cm, right_arm_cm,
         left_thigh_cm, right_thigh_cm, left_calf_cm, right_calf_cm,
         shoulders_cm, neck_cm, notes, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      entry.id,
      entry.date,
      entry.time,
      entry.chestCm ?? null,
      entry.waistCm ?? null,
      entry.hipsCm ?? null,
      entry.leftArmCm ?? null,
      entry.rightArmCm ?? null,
      entry.leftThighCm ?? null,
      entry.rightThighCm ?? null,
      entry.leftCalfCm ?? null,
      entry.rightCalfCm ?? null,
      entry.shouldersCm ?? null,
      entry.neckCm ?? null,
      entry.notes ?? null,
      entry.createdAt,
      entry.updatedAt
    );
  }

  async updateMeasurement(entry: BodyMeasurementEntry, txn?: IDatabase): Promise<void> {
    validateBodyMeasurementEntry(entry);
    const target = txn || this.db;

    const result = await target.runAsync(
      `UPDATE body_measurement_entries
       SET date = ?,
           time = ?,
           chest_cm = ?,
           waist_cm = ?,
           hips_cm = ?,
           left_arm_cm = ?,
           right_arm_cm = ?,
           left_thigh_cm = ?,
           right_thigh_cm = ?,
           left_calf_cm = ?,
           right_calf_cm = ?,
           shoulders_cm = ?,
           neck_cm = ?,
           notes = ?,
           updated_at = ?
       WHERE id = ?;`,
      entry.date,
      entry.time,
      entry.chestCm ?? null,
      entry.waistCm ?? null,
      entry.hipsCm ?? null,
      entry.leftArmCm ?? null,
      entry.rightArmCm ?? null,
      entry.leftThighCm ?? null,
      entry.rightThighCm ?? null,
      entry.leftCalfCm ?? null,
      entry.rightCalfCm ?? null,
      entry.shouldersCm ?? null,
      entry.neckCm ?? null,
      entry.notes ?? null,
      entry.updatedAt,
      entry.id
    );

    if (result.changes === 0) {
      throw new Error(`Body measurement entry with ID "${entry.id}" not found to update`);
    }
  }

  async deleteMeasurement(id: string, txn?: IDatabase): Promise<void> {
    const target = txn || this.db;
    await target.runAsync(`DELETE FROM body_measurement_entries WHERE id = ?;`, id);
  }
}
