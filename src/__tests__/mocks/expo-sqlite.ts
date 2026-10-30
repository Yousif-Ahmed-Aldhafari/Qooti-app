import { DatabaseSync } from 'node:sqlite';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { IDatabase } from '../../db/types';

const openDatabases: Map<string, MockSQLiteDatabase> =
  (globalThis as any).__mockSQLiteDatabasesMap || new Map<string, MockSQLiteDatabase>();
(globalThis as any).__mockSQLiteDatabasesMap = openDatabases;

export class MockSQLiteDatabase implements IDatabase {
  public db: DatabaseSync;
  public dbPath: string;
  private transactionDepth = 0;
  private isClosed = false;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    this.db = new DatabaseSync(dbPath);
  }

  async execAsync(source: string): Promise<void> {
    if (this.isClosed) {
      throw new Error('database is not open');
    }
    this.db.exec(source);
  }

  async runAsync(source: string, ...params: any[]): Promise<{ lastInsertRowId: number; changes: number }> {
    if (this.isClosed) {
      throw new Error('database is not open');
    }
    const stmt = this.db.prepare(source);
    const flatParams = params.flat().map((p) => (p === undefined ? null : p));
    const result = stmt.run(...flatParams);
    return {
      lastInsertRowId: Number(result.lastInsertRowid ?? 0),
      changes: Number(result.changes ?? 0),
    };
  }

  async getFirstAsync<T = any>(source: string, ...params: any[]): Promise<T | null> {
    if (this.isClosed) {
      throw new Error('database is not open');
    }
    const stmt = this.db.prepare(source);
    const flatParams = params.flat().map((p) => (p === undefined ? null : p));
    const row = stmt.get(...flatParams);
    return (row as T) ?? null;
  }

  async getAllAsync<T = any>(source: string, ...params: any[]): Promise<T[]> {
    if (this.isClosed) {
      throw new Error('database is not open');
    }
    const stmt = this.db.prepare(source);
    const flatParams = params.flat().map((p) => (p === undefined ? null : p));
    const rows = stmt.all(...flatParams);
    return rows as T[];
  }

  async isInTransactionAsync(): Promise<boolean> {
    return this.transactionDepth > 0;
  }

  async withTransactionAsync<T = void>(task: (txn: IDatabase) => Promise<T>): Promise<T> {
    return this.withExclusiveTransactionAsync(task);
  }

  async withExclusiveTransactionAsync<T = void>(task: (txn: IDatabase) => Promise<T>): Promise<T> {
    if (this.isClosed) {
      throw new Error('database is not open');
    }

    if (this.transactionDepth > 0) {
      return await task(this);
    }

    this.transactionDepth++;
    this.db.exec('BEGIN');
    try {
      const result = await task(this);
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      try {
        this.db.exec('ROLLBACK');
      } catch {
        // Rollback may fail if transaction was aborted by SQLite
      }
      throw error;
    } finally {
      this.transactionDepth--;
    }
  }

  async closeAsync(): Promise<void> {
    if (this.isClosed) {
      return;
    }
    this.isClosed = true;
    openDatabases.delete(this.dbPath);
    try {
      this.db.close();
    } catch {
      // Ignore if already closed
    }
  }

  reset(): void {
    if (this.isClosed) {
      return;
    }
    this.transactionDepth = 0;
    const tables = [
      'workout_exercises',
      'workouts',
      'meal_items',
      'meals',
      'user_profiles',
      'progress_entries',
      'app_settings',
      'migration_meta',
      'schema_migrations',
    ];

    try {
      this.db.exec('PRAGMA foreign_keys = OFF;');
      for (const table of tables) {
        try {
          this.db.exec(`DELETE FROM ${table};`);
        } catch {
          // Table may not exist yet
        }
      }
      this.db.exec('PRAGMA foreign_keys = ON;');
    } catch {
      // Ignore
    }
  }
}

export async function openDatabaseAsync(
  databaseName: string,
  _options?: any,
  _directory?: string
): Promise<MockSQLiteDatabase> {
  if (databaseName === ':memory:') {
    return new MockSQLiteDatabase(':memory:');
  }

  const filePath = path.join(os.tmpdir(), `test-qooti-${databaseName.replace(/[^a-zA-Z0-9_-]/g, '_')}`);
  let existing = openDatabases.get(filePath);
  if (!existing || (existing as any).isClosed) {
    existing = new MockSQLiteDatabase(filePath);
    openDatabases.set(filePath, existing);
  }

  return existing;
}

export async function deleteDatabaseAsync(databaseName: string): Promise<void> {
  const filePath = path.join(os.tmpdir(), `test-qooti-${databaseName.replace(/[^a-zA-Z0-9_-]/g, '_')}`);
  const existing = openDatabases.get(filePath);
  if (existing) {
    await existing.closeAsync();
    openDatabases.delete(filePath);
  }
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch {
      // Ignore
    }
  }
}

export async function resetDatabaseState(): Promise<void> {
  for (const [, db] of openDatabases) {
    try {
      db.reset();
    } catch {
      // Ignore
    }
  }

  // Delete any unopened test database files on disk so future opens start completely fresh
  const tmpDir = os.tmpdir();
  try {
    const files = fs.readdirSync(tmpDir);
    for (const file of files) {
      if (file.startsWith('test-qooti-')) {
        const fullPath = path.join(tmpDir, file);
        if (!openDatabases.has(fullPath)) {
          try {
            fs.unlinkSync(fullPath);
          } catch {
            // Ignore
          }
        }
      }
    }
  } catch {
    // Ignore
  }
}

export function cleanupAllTestDatabases(): void {
  for (const [, db] of openDatabases) {
    try {
      db.closeAsync();
    } catch {
      // Ignore
    }
  }
  openDatabases.clear();

  const tmpDir = os.tmpdir();
  try {
    const files = fs.readdirSync(tmpDir);
    for (const file of files) {
      if (file.startsWith('test-qooti-')) {
        try {
          fs.unlinkSync(path.join(tmpDir, file));
        } catch {
          // Ignore
        }
      }
    }
  } catch {
    // Ignore
  }
}
