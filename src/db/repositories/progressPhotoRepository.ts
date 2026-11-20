import { IDatabase, ProgressPhotoRepository } from '../types';
import {
  ProgressPhoto,
  PhotoPose,
  validateProgressPhoto,
} from '../../models/biometrics';

interface ProgressPhotoRow {
  id: string;
  date: string;
  time: string;
  relative_path: string;
  pose: string;
  weight_entry_id: string | null;
  notes: string | null;
  is_favorite: number;
  created_at: string;
  updated_at: string;
}

export class SQLiteProgressPhotoRepository implements ProgressPhotoRepository {
  constructor(private db: IDatabase) {}

  private mapRow(row: ProgressPhotoRow): ProgressPhoto {
    return {
      id: row.id,
      date: row.date,
      time: row.time,
      relativePath: row.relative_path,
      pose: row.pose as PhotoPose,
      weightEntryId: row.weight_entry_id,
      notes: row.notes,
      isFavorite: row.is_favorite === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getAllPhotos(txn?: IDatabase): Promise<ProgressPhoto[]> {
    const target = txn || this.db;
    const rows = await target.getAllAsync<ProgressPhotoRow>(
      `SELECT * FROM progress_photos
       ORDER BY date DESC, time DESC, created_at DESC;`
    );
    return rows.map((r) => this.mapRow(r));
  }

  async getPhotoById(id: string, txn?: IDatabase): Promise<ProgressPhoto | null> {
    const target = txn || this.db;
    const row = await target.getFirstAsync<ProgressPhotoRow>(
      `SELECT * FROM progress_photos WHERE id = ?;`,
      id
    );
    return row ? this.mapRow(row) : null;
  }

  async getPhotosByDateRange(
    startDate: string,
    endDate: string,
    txn?: IDatabase
  ): Promise<ProgressPhoto[]> {
    const target = txn || this.db;
    const rows = await target.getAllAsync<ProgressPhotoRow>(
      `SELECT * FROM progress_photos
       WHERE date >= ? AND date <= ?
       ORDER BY date ASC, time ASC, created_at ASC;`,
      startDate,
      endDate
    );
    return rows.map((r) => this.mapRow(r));
  }

  async getPhotosByPose(pose: PhotoPose, txn?: IDatabase): Promise<ProgressPhoto[]> {
    const target = txn || this.db;
    const rows = await target.getAllAsync<ProgressPhotoRow>(
      `SELECT * FROM progress_photos
       WHERE pose = ?
       ORDER BY date DESC, time DESC, created_at DESC;`,
      pose
    );
    return rows.map((r) => this.mapRow(r));
  }

  async getFavoritePhotos(txn?: IDatabase): Promise<ProgressPhoto[]> {
    const target = txn || this.db;
    const rows = await target.getAllAsync<ProgressPhotoRow>(
      `SELECT * FROM progress_photos
       WHERE is_favorite = 1
       ORDER BY date DESC, time DESC, created_at DESC;`
    );
    return rows.map((r) => this.mapRow(r));
  }

  async insertPhoto(photo: ProgressPhoto, txn?: IDatabase): Promise<void> {
    validateProgressPhoto(photo);
    const target = txn || this.db;

    await target.runAsync(
      `INSERT INTO progress_photos (
         id, date, time, relative_path, pose, weight_entry_id, notes,
         is_favorite, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      photo.id,
      photo.date,
      photo.time,
      photo.relativePath,
      photo.pose,
      photo.weightEntryId ?? null,
      photo.notes ?? null,
      photo.isFavorite ? 1 : 0,
      photo.createdAt,
      photo.updatedAt
    );
  }

  async updatePhoto(photo: ProgressPhoto, txn?: IDatabase): Promise<void> {
    validateProgressPhoto(photo);
    const target = txn || this.db;

    const result = await target.runAsync(
      `UPDATE progress_photos
       SET date = ?,
           time = ?,
           relative_path = ?,
           pose = ?,
           weight_entry_id = ?,
           notes = ?,
           is_favorite = ?,
           updated_at = ?
       WHERE id = ?;`,
      photo.date,
      photo.time,
      photo.relativePath,
      photo.pose,
      photo.weightEntryId ?? null,
      photo.notes ?? null,
      photo.isFavorite ? 1 : 0,
      photo.updatedAt,
      photo.id
    );

    if (result.changes === 0) {
      throw new Error(`Progress photo with ID "${photo.id}" not found to update`);
    }
  }

  async deletePhoto(id: string, txn?: IDatabase): Promise<void> {
    const target = txn || this.db;
    await target.runAsync(`DELETE FROM progress_photos WHERE id = ?;`, id);
  }

  async togglePhotoFavorite(id: string, isFavorite: boolean, txn?: IDatabase): Promise<void> {
    const target = txn || this.db;
    const now = new Date().toISOString();
    const result = await target.runAsync(
      `UPDATE progress_photos
       SET is_favorite = ?,
           updated_at = ?
       WHERE id = ?;`,
      isFavorite ? 1 : 0,
      now,
      id
    );

    if (result.changes === 0) {
      throw new Error(`Progress photo with ID "${id}" not found to update`);
    }
  }
}
