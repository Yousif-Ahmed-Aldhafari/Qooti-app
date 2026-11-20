import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabaseAsync } from './mocks/expo-sqlite';
import AsyncStorage from './mocks/async-storage';
import {
  runMigrations,
  MIGRATIONS,
} from '../db/migrations';
import { IDatabase } from '../db/types';
import {
  SQLiteBodyWeightRepository,
  SQLiteBodyMeasurementRepository,
  SQLiteBodyCompositionRepository,
  SQLiteProgressPhotoRepository,
  SQLiteProgressRepository,
} from '../db';
import {
  migrateFromAsyncStorage,
  reconcileLegacyProgressWeights,
} from '../db/migrationService';
import {
  validateRelativePhotoPath,
  BodyWeightEntry,
  BodyMeasurementEntry,
  BodyCompositionEntry,
  ProgressPhoto,
  isValidIsoDate,
  validateBodyWeightEntry,
  hasExactTime,
  formatMeasurementTime,
} from '../models/biometrics';
import { ProgressEntry } from '../models/progress';

async function setupDbUpToVersion(targetVersion: number): Promise<IDatabase> {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  for (let v = 1; v <= targetVersion; v++) {
    const migration = MIGRATIONS.find((m) => m.version === v);
    if (!migration) throw new Error(`Migration version ${v} not found`);
    await db.withTransactionAsync(async () => {
      await migration.up(db);
      await db.runAsync(
        'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);',
        migration.version,
        migration.name,
        new Date().toISOString()
      );
    });
  }
  return db;
}

test('Task 5.1 - Test 1: Fresh installation V0 -> latest (V17) applies all migrations and creates biometrics tables', async () => {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(db);

  const migrations = await db.getAllAsync<{ version: number; name: string }>(
    'SELECT version, name FROM schema_migrations ORDER BY version ASC;'
  );

  assert.equal(migrations.length, 17, 'Should have exactly 17 migrations');
  const v16 = migrations.find((m) => m.version === 16);
  assert.ok(v16, 'Migration 16 must be recorded');
  assert.equal(v16.name, 'add_body_tracking_and_biometrics_v16');
  const v17 = migrations.find((m) => m.version === 17);
  assert.ok(v17, 'Migration 17 must be recorded');
  assert.equal(v17.name, 'add_biometric_time_precision_and_reconcile_legacy_dates_v17');

  // Verify all 4 tables exist
  const tables = await db.getAllAsync<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name IN (
      'body_weight_entries',
      'body_measurement_entries',
      'body_composition_entries',
      'progress_photos'
    );`
  );
  assert.equal(tables.length, 4, 'All 4 biometrics tables must exist');
});

test('Task 5.1 - Test 2: Upgrade from V15 to V16 applies Migration 16 cleanly', async () => {
  const db = await setupDbUpToVersion(15);
  await runMigrations(db);

  const applied = await db.getFirstAsync<{ version: number }>(
    'SELECT version FROM schema_migrations WHERE version = 16;'
  );
  assert.ok(applied, 'Migration 16 should be applied when upgrading from V15');
});

test('Task 5.1 - Test 3: Migration 16 idempotency on repeated runMigrations calls', async () => {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(db);
  await runMigrations(db);
  await runMigrations(db);

  const count = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM schema_migrations WHERE version = 16;'
  );
  assert.equal(count?.count, 1, 'Migration 16 must only be recorded once');
});

test('Task 5.1 - Test 4: Legacy backfill: valid weight and strict ISO date are migrated to body_weight_entries', async () => {
  const db = await setupDbUpToVersion(15);

  // Insert valid legacy progress entry
  await db.runAsync(
    `INSERT INTO progress_entries (id, date, label, calories, workouts, weight_kg, steps, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
    'legacy_valid_1',
    '2026-03-01',
    'Sun',
    2100,
    1,
    78.4,
    8500,
    '2026-03-01T08:30:00.000Z'
  );

  // Run migration 16
  await runMigrations(db);

  const migrated = await db.getFirstAsync<{
    id: string;
    date: string;
    time: string;
    weight_kg: number;
    notes: string;
    source: string;
  }>('SELECT * FROM body_weight_entries WHERE id = ?;', 'bw_migrated_legacy_valid_1');

  assert.ok(migrated, 'Migrated weight entry must exist');
  assert.equal(migrated.id, 'bw_migrated_legacy_valid_1');
  assert.equal(migrated.date, '2026-03-01');
  assert.equal(migrated.time, '12:00');
  assert.equal(migrated.weight_kg, 78.4);
  assert.equal(migrated.source, 'legacy_migration');
  assert.match(migrated.notes, /Migrated from legacy progress entry/);

  // Original progress entry remains intact
  const orig = await db.getFirstAsync<{ id: string; weight_kg: number }>(
    'SELECT id, weight_kg FROM progress_entries WHERE id = ?;',
    'legacy_valid_1'
  );
  assert.ok(orig, 'Original progress row must NOT be deleted');
  assert.equal(orig.weight_kg, 78.4);
});

test('Task 5.1 - Test 5: Legacy backfill exclusion: zero weight, invalid weight, and non-ISO dates are skipped', async () => {
  const db = await setupDbUpToVersion(15);

  // 1. weight_kg = 0
  await db.runAsync(
    `INSERT INTO progress_entries (id, date, label, calories, workouts, weight_kg, steps, created_at)
     VALUES ('legacy_zero_weight', '2026-03-02', 'Mon', 2000, 1, 0.0, 7000, '2026-03-02T10:00:00.000Z');`
  );

  // 2. weight_kg < 10.0 (physically impossible adult body weight)
  await db.runAsync(
    `INSERT INTO progress_entries (id, date, label, calories, workouts, weight_kg, steps, created_at)
     VALUES ('legacy_tiny_weight', '2026-03-03', 'Tue', 1900, 0, 5.0, 6000, '2026-03-03T10:00:00.000Z');`
  );

  // 3. weight_kg > 500.0 (out of bounds)
  await db.runAsync(
    `INSERT INTO progress_entries (id, date, label, calories, workouts, weight_kg, steps, created_at)
     VALUES ('legacy_huge_weight', '2026-03-04', 'Wed', 2200, 1, 999.0, 5000, '2026-03-04T10:00:00.000Z');`
  );

  // 4. weekday-only label instead of ISO date (e.g. 'Fri')
  await db.runAsync(
    `INSERT INTO progress_entries (id, date, label, calories, workouts, weight_kg, steps, created_at)
     VALUES ('legacy_weekday_date', 'Fri', 'Fri', 2000, 1, 75.0, 6000, '2026-03-05T10:00:00.000Z');`
  );

  // 5. Slash formatted date (e.g. '2026/03/06')
  await db.runAsync(
    `INSERT INTO progress_entries (id, date, label, calories, workouts, weight_kg, steps, created_at)
     VALUES ('legacy_slash_date', '2026/03/06', '2026/03/06', 2000, 1, 76.0, 6000, '2026-03-06T10:00:00.000Z');`
  );

  await runMigrations(db);

  const migratedRows = await db.getAllAsync<{ id: string }>(
    `SELECT id FROM body_weight_entries WHERE id LIKE 'bw_migrated_legacy_%';`
  );
  assert.equal(migratedRows.length, 0, 'No invalid or non-calendar legacy entries should be backfilled');
});

test('Task 5.1 - Test 6: Legacy backfill: multiple valid entries on different dates or same date are preserved', async () => {
  const db = await setupDbUpToVersion(15);

  await db.runAsync(
    `INSERT INTO progress_entries (id, date, label, calories, workouts, weight_kg, steps, created_at)
     VALUES ('entry_a', '2026-03-07', '2026-03-07', 2000, 1, 72.0, 6000, '2026-03-07T08:00:00.000Z');`
  );
  await db.runAsync(
    `INSERT INTO progress_entries (id, date, label, calories, workouts, weight_kg, steps, created_at)
     VALUES ('entry_b', '2026-03-07', '2026-03-07', 2000, 1, 72.5, 6000, '2026-03-07T20:00:00.000Z');`
  );

  await runMigrations(db);

  const migrated = await db.getAllAsync<{ id: string; weight_kg: number }>(
    `SELECT id, weight_kg FROM body_weight_entries WHERE date = '2026-03-07' ORDER BY id ASC;`
  );
  assert.equal(migrated.length, 2, 'Both entries on 2026-03-07 must be backfilled without collision');
  assert.equal(migrated[0].id, 'bw_migrated_entry_a');
  assert.equal(migrated[0].weight_kg, 72.0);
  assert.equal(migrated[1].id, 'bw_migrated_entry_b');
  assert.equal(migrated[1].weight_kg, 72.5);
});

test('Task 5.1 - Test 7: SQLiteBodyWeightRepository: CRUD operations and multiple entries per date', async () => {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(db);

  const repo = new SQLiteBodyWeightRepository(db);

  const morning: BodyWeightEntry = {
    id: 'bw_morning_1',
    date: '2026-03-10',
    time: '07:15',
    weightKg: 80.2,
    notes: 'Fasted morning weigh-in',
    source: 'scale',
    createdAt: '2026-03-10T07:15:00.000Z',
    updatedAt: '2026-03-10T07:15:00.000Z',
  };

  const evening: BodyWeightEntry = {
    id: 'bw_evening_1',
    date: '2026-03-10',
    time: '21:30',
    weightKg: 81.1,
    notes: 'Post-dinner weigh-in',
    source: 'manual',
    createdAt: '2026-03-10T21:30:00.000Z',
    updatedAt: '2026-03-10T21:30:00.000Z',
  };

  await repo.insertWeight(morning);
  await repo.insertWeight(evening);

  const forDate = await repo.getWeightsForDate('2026-03-10');
  assert.equal(forDate.length, 2, 'Should return both morning and evening weights');
  assert.equal(forDate[0].weightKg, 80.2);
  assert.equal(forDate[1].weightKg, 81.1);

  const latest = await repo.getLatestWeight();
  assert.ok(latest);
  assert.equal(latest.id, 'bw_evening_1');

  // Update
  await repo.updateWeight({
    ...morning,
    weightKg: 80.0,
    notes: 'Calibrated scale',
    updatedAt: '2026-03-10T08:00:00.000Z',
  });

  const updated = await repo.getWeightById('bw_morning_1');
  assert.equal(updated?.weightKg, 80.0);
  assert.equal(updated?.notes, 'Calibrated scale');

  // Delete
  await repo.deleteWeight('bw_evening_1');
  const afterDelete = await repo.getWeightsForDate('2026-03-10');
  assert.equal(afterDelete.length, 1);
  assert.equal(afterDelete[0].id, 'bw_morning_1');
});

test('Task 5.1 - Test 8: SQLiteBodyWeightRepository: validation rejects invalid weights and malformed dates', async () => {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(db);

  const repo = new SQLiteBodyWeightRepository(db);

  // Weight too low (< 10kg)
  await assert.rejects(
    () =>
      repo.insertWeight({
        id: 'bw_bad_1',
        date: '2026-03-10',
        time: '08:00',
        weightKg: 4.5,
        source: 'manual',
        createdAt: '2026-03-10T08:00:00.000Z',
        updatedAt: '2026-03-10T08:00:00.000Z',
      }),
    /BiometricsValidationError/
  );

  // Weight NaN
  await assert.rejects(
    () =>
      repo.insertWeight({
        id: 'bw_bad_2',
        date: '2026-03-10',
        time: '08:00',
        weightKg: NaN,
        source: 'manual',
        createdAt: '2026-03-10T08:00:00.000Z',
        updatedAt: '2026-03-10T08:00:00.000Z',
      }),
    /BiometricsValidationError/
  );

  // Invalid date format
  await assert.rejects(
    () =>
      repo.insertWeight({
        id: 'bw_bad_3',
        date: '2026/03/10',
        time: '08:00',
        weightKg: 75.0,
        source: 'manual',
        createdAt: '2026-03-10T08:00:00.000Z',
        updatedAt: '2026-03-10T08:00:00.000Z',
      }),
    /BiometricsValidationError/
  );

  // Invalid time format
  await assert.rejects(
    () =>
      repo.insertWeight({
        id: 'bw_bad_4',
        date: '2026-03-10',
        time: '25:00',
        weightKg: 75.0,
        source: 'manual',
        createdAt: '2026-03-10T08:00:00.000Z',
        updatedAt: '2026-03-10T08:00:00.000Z',
      }),
    /BiometricsValidationError/
  );
});

test('Task 5.1 - Test 9: SQLiteBodyMeasurementRepository: preserves nulls and rejects zero circumferences', async () => {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(db);

  const repo = new SQLiteBodyMeasurementRepository(db);

  // 1. Partial measurements with nulls
  const measurement: BodyMeasurementEntry = {
    id: 'bm_1',
    date: '2026-03-11',
    time: '08:00',
    waistCm: 82.5,
    chestCm: 98.0,
    hipsCm: null,
    leftArmCm: 34.0,
    rightArmCm: 34.2,
    leftThighCm: null,
    rightThighCm: null,
    leftCalfCm: null,
    rightCalfCm: null,
    shouldersCm: 115.0,
    neckCm: 38.5,
    notes: 'Morning measurement tape',
    createdAt: '2026-03-11T08:00:00.000Z',
    updatedAt: '2026-03-11T08:00:00.000Z',
  };

  await repo.insertMeasurement(measurement);

  const loaded = await repo.getMeasurementById('bm_1');
  assert.ok(loaded);
  assert.equal(loaded.waistCm, 82.5);
  assert.equal(loaded.chestCm, 98.0);
  assert.strictEqual(loaded.hipsCm, null, 'Unmeasured hips must be null, not 0');
  assert.strictEqual(loaded.leftThighCm, null, 'Unmeasured thigh must be null, not 0');
  assert.equal(loaded.leftArmCm, 34.0);

  // 2. Reject 0 cm circumference (measurement error / fabrication)
  await assert.rejects(
    () =>
      repo.insertMeasurement({
        id: 'bm_zero',
        date: '2026-03-11',
        time: '08:00',
        waistCm: 0,
        createdAt: '2026-03-11T08:00:00.000Z',
        updatedAt: '2026-03-11T08:00:00.000Z',
      }),
    /BiometricsValidationError/
  );

  // 3. Reject negative circumference
  await assert.rejects(
    () =>
      repo.insertMeasurement({
        id: 'bm_neg',
        date: '2026-03-11',
        time: '08:00',
        chestCm: -10,
        createdAt: '2026-03-11T08:00:00.000Z',
        updatedAt: '2026-03-11T08:00:00.000Z',
      }),
    /BiometricsValidationError/
  );
});

test('Task 5.1 - Test 10: SQLiteBodyCompositionRepository: CRUD and physical bounds enforcement', async () => {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(db);

  const repo = new SQLiteBodyCompositionRepository(db);

  const comp: BodyCompositionEntry = {
    id: 'bc_1',
    date: '2026-03-12',
    time: '09:00',
    bodyFatPercentage: 15.4,
    skeletalMuscleMassKg: 35.8,
    boneMassKg: 3.2,
    bodyWaterPercentage: 58.2,
    method: 'dexa',
    notes: 'Annual DEXA scan',
    createdAt: '2026-03-12T09:00:00.000Z',
    updatedAt: '2026-03-12T09:00:00.000Z',
  };

  await repo.insertComposition(comp);

  const loaded = await repo.getCompositionById('bc_1');
  assert.ok(loaded);
  assert.equal(loaded.bodyFatPercentage, 15.4);
  assert.equal(loaded.method, 'dexa');

  // Out of bounds body fat (> 80%)
  await assert.rejects(
    () =>
      repo.insertComposition({
        ...comp,
        id: 'bc_bad_bf',
        bodyFatPercentage: 95.0,
      }),
    /BiometricsValidationError/
  );

  // Out of bounds body fat (< 1%)
  await assert.rejects(
    () =>
      repo.insertComposition({
        ...comp,
        id: 'bc_bad_bf_low',
        bodyFatPercentage: 0.2,
      }),
    /BiometricsValidationError/
  );
});

test('Task 5.1 - Test 11: ProgressPhotoRepository: path safety validation and favorite toggle', async () => {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(db);

  const repo = new SQLiteProgressPhotoRepository(db);

  // 1. Path safety tests
  assert.throws(() => validateRelativePhotoPath('/var/data/photos/photo.jpg'), /prohibited/);
  assert.throws(() => validateRelativePhotoPath('file:///storage/emulated/0/photo.jpg'), /prohibited/);
  assert.throws(() => validateRelativePhotoPath('C:\\Users\\AppData\\photo.jpg'), /prohibited/);
  assert.throws(() => validateRelativePhotoPath('../photos/secret.jpg'), /traversal/);
  assert.throws(() => validateRelativePhotoPath(''), /empty/);
  assert.throws(() => validateRelativePhotoPath('   '), /blank/);

  // Safe path must succeed
  assert.doesNotThrow(() => validateRelativePhotoPath('progress_photos/photo_123.jpg'));

  // 2. Insert valid photo
  const photo: ProgressPhoto = {
    id: 'photo_1',
    date: '2026-03-13',
    time: '11:00',
    relativePath: 'progress_photos/photo_1.jpg',
    pose: 'front',
    isFavorite: false,
    notes: 'Front relaxed pose',
    createdAt: '2026-03-13T11:00:00.000Z',
    updatedAt: '2026-03-13T11:00:00.000Z',
  };

  await repo.insertPhoto(photo);

  const loaded = await repo.getPhotoById('photo_1');
  assert.ok(loaded);
  assert.equal(loaded.relativePath, 'progress_photos/photo_1.jpg');
  assert.equal(loaded.isFavorite, false);

  // 3. Toggle favorite
  await repo.togglePhotoFavorite('photo_1', true);
  const favorited = await repo.getPhotoById('photo_1');
  assert.equal(favorited?.isFavorite, true);

  const favList = await repo.getFavoritePhotos();
  assert.equal(favList.length, 1);
  assert.equal(favList[0].id, 'photo_1');
});

test('Task 5.1 - Test 12: ProgressPhoto foreign key to body_weight_entries sets null ON DELETE', async () => {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(db);

  const weightRepo = new SQLiteBodyWeightRepository(db);
  const photoRepo = new SQLiteProgressPhotoRepository(db);

  await weightRepo.insertWeight({
    id: 'bw_linked_1',
    date: '2026-03-14',
    time: '08:00',
    weightKg: 77.0,
    source: 'manual',
    createdAt: '2026-03-14T08:00:00.000Z',
    updatedAt: '2026-03-14T08:00:00.000Z',
  });

  await photoRepo.insertPhoto({
    id: 'photo_linked_1',
    date: '2026-03-14',
    time: '08:05',
    relativePath: 'progress_photos/photo_linked_1.jpg',
    pose: 'side',
    weightEntryId: 'bw_linked_1',
    isFavorite: false,
    createdAt: '2026-03-14T08:05:00.000Z',
    updatedAt: '2026-03-14T08:05:00.000Z',
  });

  // Verify link
  const loadedPhoto = await photoRepo.getPhotoById('photo_linked_1');
  assert.equal(loadedPhoto?.weightEntryId, 'bw_linked_1');

  // Delete weight entry
  await weightRepo.deleteWeight('bw_linked_1');

  // Photo must still exist, with weightEntryId set to null (ON DELETE SET NULL)
  const afterWeightDelete = await photoRepo.getPhotoById('photo_linked_1');
  assert.ok(afterWeightDelete, 'Photo must not be cascaded/deleted');
  assert.strictEqual(
    afterWeightDelete.weightEntryId,
    null,
    'weightEntryId must be set to NULL after deleting the weight record'
  );
});

test('Task 5.1 - Test 13: Granular ProgressRepository: operations do NOT wipe the progress_entries table', async () => {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(db);

  const repo = new SQLiteProgressRepository(db);

  const entry1: ProgressEntry = {
    id: 'p_1',
    date: '2026-03-01',
    label: '2026-03-01',
    calories: 2000,
    workouts: 1,
    weightKg: 75.0,
    steps: 8000,
  };

  const entry2: ProgressEntry = {
    id: 'p_2',
    date: '2026-03-02',
    label: '2026-03-02',
    calories: 2200,
    workouts: 2,
    weightKg: 75.2,
    steps: 10000,
  };

  await repo.insertProgressEntry(entry1);
  await repo.insertProgressEntry(entry2);

  // Both exist
  let all = await repo.getAllProgress();
  assert.equal(all.length, 2);

  // Safe batch save with only entry1 modified must NOT delete entry2!
  await repo.saveAllProgress([
    {
      ...entry1,
      calories: 2050,
    },
  ]);

  all = await repo.getAllProgress();
  assert.equal(
    all.length,
    2,
    'Batch save must NOT delete entry2 (table wipe pattern eliminated)'
  );
  const updated1 = all.find((p) => p.id === 'p_1');
  assert.equal(updated1?.calories, 2050);

  // Row-level update
  await repo.updateProgressEntry({
    ...entry2,
    steps: 12000,
  });
  const updated2 = await repo.getProgressById('p_2');
  assert.equal(updated2?.steps, 12000);

  // Row-level delete
  await repo.deleteProgressEntry('p_1');
  all = await repo.getAllProgress();
  assert.equal(all.length, 1);
  assert.equal(all[0].id, 'p_2');
});

test('Task 5.1 - Test 14: Transaction failure triggers atomic rollback leaving biometric tables clean', async () => {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(db);

  const repo = new SQLiteBodyWeightRepository(db);

  const validEntry: BodyWeightEntry = {
    id: 'bw_atomic_1',
    date: '2026-03-15',
    time: '08:00',
    weightKg: 76.0,
    source: 'manual',
    createdAt: '2026-03-15T08:00:00.000Z',
    updatedAt: '2026-03-15T08:00:00.000Z',
  };

  await assert.rejects(
    async () => {
      await db.withExclusiveTransactionAsync(async (txn) => {
        await repo.insertWeight(validEntry, txn);

        // Intentionally trigger a SQLite constraint failure inside transaction
        await txn.runAsync(
          `INSERT INTO body_weight_entries (
             id, date, time, weight_kg, source, created_at, updated_at
           ) VALUES ('bw_fail', '2026-03-15', '08:01', -50.0, 'manual', 'now', 'now');`
        );
      });
    },
    /CHECK constraint failed/
  );

  // Verify that validEntry was rolled back and is NOT present in the database
  const loaded = await repo.getWeightById('bw_atomic_1');
  assert.strictEqual(loaded, null, 'Transaction failure must atomically roll back all changes');
});

test('Task 5.1 - Test 15: bodyTrackingService: high-level service functions with and without external txn', async () => {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(db);

  // We can pass txn to service methods
  const {
    loadAllWeights,
    getWeightEntry,
    getWeightHistory,
    getWeightsForDate,
    getLatestWeight,
    recordWeight,
    updateWeight,
    deleteWeight,
    loadAllMeasurements,
    getMeasurementEntry,
    getMeasurementsHistory,
    getMeasurementsForDate,
    getLatestMeasurement,
    recordMeasurement,
    updateMeasurement,
    deleteMeasurement,
    loadAllCompositions,
    getCompositionEntry,
    getCompositionsHistory,
    getLatestComposition,
    recordComposition,
    updateComposition,
    deleteComposition,
    loadAllPhotos,
    getPhotoEntry,
    getPhotosHistory,
    getPhotosByPose,
    getFavoritePhotos,
    recordPhoto,
    updatePhoto,
    deletePhoto,
    togglePhotoFavorite,
  } = await import('../services/bodyTrackingService');

  // 1. Weight Service
  const weight1: BodyWeightEntry = {
    id: 'svc_bw_1',
    date: '2026-03-20',
    time: '07:00',
    weightKg: 79.5,
    source: 'manual',
    createdAt: '2026-03-20T07:00:00.000Z',
    updatedAt: '2026-03-20T07:00:00.000Z',
  };
  await recordWeight(weight1, db);
  const loadedW = await getWeightEntry('svc_bw_1', db);
  assert.equal(loadedW?.weightKg, 79.5);

  const historyW = await getWeightHistory('2026-03-01', '2026-03-31', db);
  assert.equal(historyW.length, 1);
  const forDateW = await getWeightsForDate('2026-03-20', db);
  assert.equal(forDateW.length, 1);
  const latestW = await getLatestWeight(db);
  assert.equal(latestW?.id, 'svc_bw_1');

  await updateWeight({ ...weight1, weightKg: 79.2 }, db);
  const updatedW = await getWeightEntry('svc_bw_1', db);
  assert.equal(updatedW?.weightKg, 79.2);

  const allW = await loadAllWeights(db);
  assert.equal(allW.length, 1);

  // 2. Measurement Service
  const measure1: BodyMeasurementEntry = {
    id: 'svc_bm_1',
    date: '2026-03-20',
    time: '07:10',
    waistCm: 84.0,
    chestCm: 100.0,
    createdAt: '2026-03-20T07:10:00.000Z',
    updatedAt: '2026-03-20T07:10:00.000Z',
  };
  await recordMeasurement(measure1, db);
  const loadedM = await getMeasurementEntry('svc_bm_1', db);
  assert.equal(loadedM?.waistCm, 84.0);

  const historyM = await getMeasurementsHistory('2026-03-01', '2026-03-31', db);
  assert.equal(historyM.length, 1);
  const forDateM = await getMeasurementsForDate('2026-03-20', db);
  assert.equal(forDateM.length, 1);
  const latestM = await getLatestMeasurement(db);
  assert.equal(latestM?.id, 'svc_bm_1');

  await updateMeasurement({ ...measure1, waistCm: 83.5 }, db);
  const updatedM = await getMeasurementEntry('svc_bm_1', db);
  assert.equal(updatedM?.waistCm, 83.5);

  const allM = await loadAllMeasurements(db);
  assert.equal(allM.length, 1);

  // 3. Composition Service
  const comp1: BodyCompositionEntry = {
    id: 'svc_bc_1',
    date: '2026-03-20',
    time: '07:20',
    bodyFatPercentage: 16.2,
    method: 'calipers',
    createdAt: '2026-03-20T07:20:00.000Z',
    updatedAt: '2026-03-20T07:20:00.000Z',
  };
  await recordComposition(comp1, db);
  const loadedC = await getCompositionEntry('svc_bc_1', db);
  assert.equal(loadedC?.bodyFatPercentage, 16.2);

  const historyC = await getCompositionsHistory('2026-03-01', '2026-03-31', db);
  assert.equal(historyC.length, 1);
  const latestC = await getLatestComposition(db);
  assert.equal(latestC?.id, 'svc_bc_1');

  await updateComposition({ ...comp1, bodyFatPercentage: 15.9 }, db);
  const updatedC = await getCompositionEntry('svc_bc_1', db);
  assert.equal(updatedC?.bodyFatPercentage, 15.9);

  const allC = await loadAllCompositions(db);
  assert.equal(allC.length, 1);

  // 4. Photo Service
  const photo1: ProgressPhoto = {
    id: 'svc_p_1',
    date: '2026-03-20',
    time: '07:30',
    relativePath: 'progress_photos/svc_p_1.jpg',
    pose: 'front',
    isFavorite: false,
    createdAt: '2026-03-20T07:30:00.000Z',
    updatedAt: '2026-03-20T07:30:00.000Z',
  };
  await recordPhoto(photo1, db);
  const loadedP = await getPhotoEntry('svc_p_1', db);
  assert.equal(loadedP?.relativePath, 'progress_photos/svc_p_1.jpg');

  const historyP = await getPhotosHistory('2026-03-01', '2026-03-31', db);
  assert.equal(historyP.length, 1);
  const byPoseP = await getPhotosByPose('front', db);
  assert.equal(byPoseP.length, 1);

  await togglePhotoFavorite('svc_p_1', true, db);
  const favsP = await getFavoritePhotos(db);
  assert.equal(favsP.length, 1);

  await updatePhoto({ ...photo1, pose: 'side', isFavorite: true }, db);
  const updatedP = await getPhotoEntry('svc_p_1', db);
  assert.equal(updatedP?.pose, 'side');

  const allP = await loadAllPhotos(db);
  assert.equal(allP.length, 1);

  // Deletions
  await deleteWeight('svc_bw_1', db);
  assert.strictEqual(await getWeightEntry('svc_bw_1', db), null);

  await deleteMeasurement('svc_bm_1', db);
  assert.strictEqual(await getMeasurementEntry('svc_bm_1', db), null);

  await deleteComposition('svc_bc_1', db);
  assert.strictEqual(await getCompositionEntry('svc_bc_1', db), null);

  await deletePhoto('svc_p_1', db);
  assert.strictEqual(await getPhotoEntry('svc_p_1', db), null);
});

test('Task 5.1 - Test 16: progressService: row-level operations and loadProgressEntries', async () => {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(db);

  const {
    insertProgressEntry,
    updateProgressEntry,
    deleteProgressEntry,
    getProgressEntryById,
    saveProgressEntries,
  } = await import('../services/progressService');

  const pEntry: ProgressEntry = {
    id: 'p_svc_1',
    date: '2026-03-21',
    label: '2026-03-21',
    calories: 2300,
    workouts: 1,
    weightKg: 80.5,
    steps: 11000,
  };

  await insertProgressEntry(pEntry, db);
  const loaded = await getProgressEntryById('p_svc_1', db);
  assert.ok(loaded);
  assert.equal(loaded.calories, 2300);

  await updateProgressEntry({ ...pEntry, calories: 2400 }, db);
  const updated = await getProgressEntryById('p_svc_1', db);
  assert.equal(updated?.calories, 2400);

  // Batch save with other entries preserves pEntry
  await saveProgressEntries(
    [
      {
        id: 'p_svc_2',
        date: '2026-03-22',
        calories: 1900,
        workouts: 0,
        weightKg: 80.3,
      },
    ],
    db
  );
  const check1 = await getProgressEntryById('p_svc_1', db);
  assert.ok(check1, 'p_svc_1 must be preserved during saveProgressEntries');

  await deleteProgressEntry('p_svc_1', db);
  const deleted = await getProgressEntryById('p_svc_1', db);
  assert.strictEqual(deleted, null);
});

test('Task 5.1 - Test 17: Comprehensive domain model validation edge cases', async () => {
  const {
    isValidIsoDate,
    isValid24hTime,
    validateBodyWeightEntry,
    validateBodyMeasurementEntry,
    validateBodyCompositionEntry,
    validateProgressPhoto,
  } = await import('../models/biometrics');

  // Date validation edge cases
  assert.equal(isValidIsoDate('2026-02-28'), true);
  assert.equal(isValidIsoDate('2026-02-29'), false, '2026 is not a leap year');
  assert.equal(isValidIsoDate('2024-02-29'), true, '2024 is a leap year');
  assert.equal(isValidIsoDate('2026-04-31'), false, 'April has 30 days');
  assert.equal(isValidIsoDate('2026-13-01'), false, 'Invalid month 13');
  assert.equal(isValidIsoDate('2026-00-01'), false, 'Invalid month 00');
  assert.equal(isValidIsoDate('not-a-date'), false);

  // Time validation edge cases
  assert.equal(isValid24hTime('00:00'), true);
  assert.equal(isValid24hTime('23:59'), true);
  assert.equal(isValid24hTime('24:00'), false);
  assert.equal(isValid24hTime('12:60'), false);
  assert.equal(isValid24hTime('8:30'), false);

  // Weight entry validation edge cases
  assert.throws(
    () =>
      validateBodyWeightEntry({
        id: '',
        date: '2026-03-01',
        time: '12:00',
        weightKg: 70,
        source: 'manual',
        createdAt: 'now',
        updatedAt: 'now',
      }),
    /ID is required/
  );
  assert.throws(
    () =>
      validateBodyWeightEntry({
        id: 'w1',
        date: '2026-03-01',
        time: '12:00',
        weightKg: 70,
        source: 'invalid_src' as any,
        createdAt: 'now',
        updatedAt: 'now',
      }),
    /Invalid weight source/
  );

  // Body measurement circumference validation bounds
  assert.throws(
    () =>
      validateBodyMeasurementEntry({
        id: 'm1',
        date: '2026-03-01',
        time: '12:00',
        leftArmCm: 2, // < 5cm
        createdAt: 'now',
        updatedAt: 'now',
      }),
    /leftArmCm/
  );
  assert.throws(
    () =>
      validateBodyMeasurementEntry({
        id: 'm1',
        date: '2026-03-01',
        time: '12:00',
        leftArmCm: 160, // > 150cm
        createdAt: 'now',
        updatedAt: 'now',
      }),
    /leftArmCm/
  );
  assert.throws(
    () =>
      validateBodyMeasurementEntry({
        id: 'm1',
        date: '2026-03-01',
        time: '12:00',
        leftThighCm: 250, // > 200cm
        createdAt: 'now',
        updatedAt: 'now',
      }),
    /leftThighCm/
  );
  assert.throws(
    () =>
      validateBodyMeasurementEntry({
        id: 'm1',
        date: '2026-03-01',
        time: '12:00',
        neckCm: 180, // > 150cm
        createdAt: 'now',
        updatedAt: 'now',
      }),
    /neckCm/
  );

  // Body composition validation bounds
  assert.throws(
    () =>
      validateBodyCompositionEntry({
        id: 'c1',
        date: '2026-03-01',
        time: '12:00',
        skeletalMuscleMassKg: 250, // > 200kg
        createdAt: 'now',
        updatedAt: 'now',
      }),
    /Skeletal muscle mass/
  );
  assert.throws(
    () =>
      validateBodyCompositionEntry({
        id: 'c1',
        date: '2026-03-01',
        time: '12:00',
        boneMassKg: 25, // > 20kg
        createdAt: 'now',
        updatedAt: 'now',
      }),
    /Bone mass/
  );
  assert.throws(
    () =>
      validateBodyCompositionEntry({
        id: 'c1',
        date: '2026-03-01',
        time: '12:00',
        bodyWaterPercentage: 95, // > 90%
        createdAt: 'now',
        updatedAt: 'now',
      }),
    /Body water percentage/
  );
  assert.throws(
    () =>
      validateBodyCompositionEntry({
        id: 'c1',
        date: '2026-03-01',
        time: '12:00',
        method: 'crystal_ball' as any,
        createdAt: 'now',
        updatedAt: 'now',
      }),
    /Invalid composition method/
  );

  // Photo validation bounds
  assert.throws(
    () =>
      validateProgressPhoto({
        id: 'p1',
        date: '2026-03-01',
        time: '12:00',
        relativePath: 'progress_photos/p1.jpg',
        pose: 'upside_down' as any,
        isFavorite: false,
        createdAt: 'now',
        updatedAt: 'now',
      }),
    /Invalid photo pose/
  );
  assert.throws(
    () =>
      validateProgressPhoto({
        id: 'p1',
        date: '2026-03-01',
        time: '12:00',
        relativePath: 'progress_photos/p1.jpg',
        pose: 'front',
        isFavorite: 'yes' as any,
        createdAt: 'now',
        updatedAt: 'now',
      }),
    /isFavorite must be a boolean/
  );
});

// ============================================================================
// TASK 5.1A: MIGRATION INTEGRITY & LEGACY WEIGHT BACKFILL HARDENING
// ============================================================================

test('Task 5.1A - Test 1: Strict Gregorian calendar date validation rejects invalid dates and accepts valid leap days', () => {
  // Invalid calendar dates must be rejected by isValidIsoDate
  assert.equal(isValidIsoDate('2026-02-30'), false, 'Feb 30 is not a Gregorian calendar date');
  assert.equal(isValidIsoDate('2025-02-29'), false, 'Feb 29 is not valid in non-leap year 2025');
  assert.equal(isValidIsoDate('2026-04-31'), false, 'April 31 does not exist (30 days in April)');
  assert.equal(isValidIsoDate('2026-13-01'), false, 'Month 13 does not exist');
  assert.equal(isValidIsoDate('2026-00-15'), false, 'Month 00 does not exist');
  assert.equal(isValidIsoDate('2026-05-00'), false, 'Day 00 does not exist');
  assert.equal(isValidIsoDate('Fri'), false, 'Non-ISO weekday string must be rejected');
  assert.equal(isValidIsoDate('2026/03/01'), false, 'Slash-separated dates must be rejected');
  assert.equal(isValidIsoDate('2026-03-1'), false, 'Short day component must be rejected');

  // Valid dates must be accepted
  assert.equal(isValidIsoDate('2024-02-29'), true, 'Feb 29 in leap year 2024 is valid');
  assert.equal(isValidIsoDate('2026-02-28'), true, 'Feb 28 in 2026 is valid');
  assert.equal(isValidIsoDate('2026-12-31'), true, 'Dec 31 is valid');

  // Validator throws on invalid calendar date
  assert.throws(
    () =>
      validateBodyWeightEntry({
        id: 'bw_inv_1',
        date: '2026-02-30',
        time: '12:00',
        weightKg: 75.0,
        source: 'manual',
        createdAt: '2026-02-30T12:00:00.000Z',
        updatedAt: '2026-02-30T12:00:00.000Z',
      }),
    /Invalid date format/
  );

  // Validator accepts valid leap date
  assert.doesNotThrow(() =>
    validateBodyWeightEntry({
      id: 'bw_leap_1',
      date: '2024-02-29',
      time: '12:00',
      timePrecision: 'date_only',
      weightKg: 75.0,
      source: 'legacy_migration',
      createdAt: '2024-02-29T12:00:00.000Z',
      updatedAt: '2024-02-29T12:00:00.000Z',
    })
  );

  // Validator checks timePrecision enum
  assert.throws(
    () =>
      validateBodyWeightEntry({
        id: 'bw_prec_inv',
        date: '2026-03-01',
        time: '12:00',
        timePrecision: 'second' as any,
        weightKg: 75.0,
        source: 'manual',
        createdAt: '2026-03-01T12:00:00.000Z',
        updatedAt: '2026-03-01T12:00:00.000Z',
      }),
    /Invalid timePrecision/
  );
});

test('Task 5.1A - Test 2: Migration 17 upgrades existing V16 database, purges invalid calendar dates, adds time_precision, and marks legacy as date_only', async () => {
  const db = await setupDbUpToVersion(16);

  // In an existing V16 database, insert legacy rows with valid leap day and invalid Feb 30
  await db.runAsync(`
    INSERT INTO body_weight_entries (id, date, time, weight_kg, notes, source, created_at, updated_at)
    VALUES ('bw_migrated_leap_2024', '2024-02-29', '12:00', 80.0, 'Legacy leap', 'legacy_migration', '2024-02-29T12:00:00.000Z', '2024-02-29T12:00:00.000Z');
  `);
  await db.runAsync(`
    INSERT INTO body_weight_entries (id, date, time, weight_kg, notes, source, created_at, updated_at)
    VALUES ('bw_migrated_feb30', '2026-02-30', '12:00', 81.0, 'Legacy invalid feb30', 'legacy_migration', '2026-02-30T12:00:00.000Z', '2026-02-30T12:00:00.000Z');
  `);
  await db.runAsync(`
    INSERT INTO body_weight_entries (id, date, time, weight_kg, notes, source, created_at, updated_at)
    VALUES ('bw_manual_1', '2026-03-01', '08:00', 80.5, 'Manual weigh-in', 'manual', '2026-03-01T08:00:00.000Z', '2026-03-01T08:00:00.000Z');
  `);

  // Run forward migration 17
  await runMigrations(db);

  const applied = await db.getAllAsync<{ version: number; name: string }>(
    'SELECT version, name FROM schema_migrations ORDER BY version ASC;'
  );
  assert.equal(applied.length, 17);
  assert.equal(applied[16].version, 17);
  assert.equal(applied[16].name, 'add_biometric_time_precision_and_reconcile_legacy_dates_v17');

  // Verify time_precision column exists
  const cols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(body_weight_entries);');
  assert.ok(cols.some((c) => c.name === 'time_precision'), 'time_precision column must exist');

  // Verify invalid date '2026-02-30' was purged
  const purged = await db.getFirstAsync('SELECT * FROM body_weight_entries WHERE id = ?;', 'bw_migrated_feb30');
  assert.equal(purged, null, 'Invalid calendar date entry must be purged by Migration 17');

  // Verify valid leap day entry was preserved and updated to date_only
  const leap = await db.getFirstAsync<{ id: string; time_precision: string }>(
    'SELECT id, time_precision FROM body_weight_entries WHERE id = ?;',
    'bw_migrated_leap_2024'
  );
  assert.ok(leap);
  assert.equal(leap.time_precision, 'date_only', 'Legacy migration records must have date_only precision');

  // Verify manual user entry retains default 'minute' precision
  const manual = await db.getFirstAsync<{ id: string; time_precision: string }>(
    'SELECT id, time_precision FROM body_weight_entries WHERE id = ?;',
    'bw_manual_1'
  );
  assert.ok(manual);
  assert.equal(manual.time_precision, 'minute');
});

test('Task 5.1A - Test 3: AsyncStorage-to-biometric migration ordering and atomic backfill', async () => {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(db);

  await AsyncStorage.clear();

  // Populate legacy progress data in AsyncStorage
  const legacyProgress = [
    {
      id: 'p_valid_leap',
      date: '2024-02-29',
      label: 'Leap Day',
      calories: 2200,
      workouts: 1,
      weightKg: 85.0,
      steps: 10000,
      createdAt: '2024-02-29T10:00:00.000Z',
    },
    {
      id: 'p_valid_norm',
      date: '2026-03-15',
      label: 'Week 2',
      calories: 2100,
      workouts: 2,
      weightKg: 84.2,
      steps: 9000,
      createdAt: '2026-03-15T09:00:00.000Z',
    },
    {
      id: 'p_invalid_date',
      date: '2026-02-30', // Feb 30 does not exist
      label: 'Bad Date',
      calories: 2000,
      workouts: 0,
      weightKg: 84.0,
      steps: 5000,
      createdAt: '2026-02-30T10:00:00.000Z',
    },
    {
      id: 'p_zero_weight',
      date: '2026-03-16',
      label: 'Zero Weight',
      calories: 2000,
      workouts: 1,
      weightKg: 0, // Ineligible weight
      steps: 7000,
      createdAt: '2026-03-16T10:00:00.000Z',
    },
  ];

  await AsyncStorage.setItem('@qooti/progress', JSON.stringify(legacyProgress));

  // Execute migrateFromAsyncStorage
  const summary = await migrateFromAsyncStorage(db);
  assert.equal(summary.status, 'completed');
  assert.equal(summary.migratedProgressEntries, 4, 'All 4 progress records safely imported into progress_entries');

  // Verify body_weight_entries backfill
  const weights = await db.getAllAsync<{
    id: string;
    date: string;
    time: string;
    time_precision: string;
    weight_kg: number;
    notes: string;
    source: string;
  }>('SELECT * FROM body_weight_entries ORDER BY date ASC;');

  assert.equal(weights.length, 2, 'Only the 2 eligible records with valid calendar dates should be backfilled');

  // Check entry 1 (leap day)
  assert.equal(weights[0].id, 'bw_migrated_p_valid_leap');
  assert.equal(weights[0].date, '2024-02-29');
  assert.equal(weights[0].time, '12:00');
  assert.equal(weights[0].time_precision, 'date_only');
  assert.equal(weights[0].weight_kg, 85.0);
  assert.equal(weights[0].source, 'legacy_migration');
  assert.match(weights[0].notes, /Leap Day/);

  // Check entry 2 (normal date)
  assert.equal(weights[1].id, 'bw_migrated_p_valid_norm');
  assert.equal(weights[1].date, '2026-03-15');
  assert.equal(weights[1].time, '12:00');
  assert.equal(weights[1].time_precision, 'date_only');
  assert.equal(weights[1].weight_kg, 84.2);
  assert.match(weights[1].notes, /Week 2/);

  // Ineligible records (Feb 30 and weight=0) were skipped from biometrics but remain in progress_entries
  const allProgress = await db.getAllAsync<{ id: string }>('SELECT id FROM progress_entries ORDER BY id ASC;');
  assert.equal(allProgress.length, 4, 'Original progress rows are never deleted or mutated');
});

test('Task 5.1A - Test 4: Repeated startup reconciliation is strictly idempotent', async () => {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(db);

  // Insert a progress entry
  await db.runAsync(`
    INSERT INTO progress_entries (id, date, label, calories, workouts, weight_kg, steps, created_at)
    VALUES ('p_idem_1', '2026-03-20', 'Day 1', 2000, 1, 77.5, 8000, '2026-03-20T08:00:00.000Z');
  `);

  // First reconciliation
  const first = await reconcileLegacyProgressWeights(db);
  assert.equal(first.reconciledCount, 1);

  // Second reconciliation (simulating app restart)
  const second = await reconcileLegacyProgressWeights(db);
  assert.equal(second.reconciledCount, 0, 'Must not re-insert or duplicate records');
  assert.equal(second.skippedCount, 1, 'Already-present record is safely skipped');

  // Third reconciliation
  const third = await reconcileLegacyProgressWeights(db);
  assert.equal(third.reconciledCount, 0);

  const count = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM body_weight_entries WHERE id = 'bw_migrated_p_idem_1';"
  );
  assert.equal(count?.count, 1, 'Exactly one biometric record must exist');
});

test('Task 5.1A - Test 5: User-edited biometric records are never overwritten by legacy reconciliation', async () => {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(db);

  const repo = new SQLiteBodyWeightRepository(db);

  // Backfill an initial progress row
  await db.runAsync(`
    INSERT INTO progress_entries (id, date, label, calories, workouts, weight_kg, steps, created_at)
    VALUES ('p_user_edit_1', '2026-03-22', 'Orig Label', 2100, 1, 80.0, 7500, '2026-03-22T08:00:00.000Z');
  `);
  await reconcileLegacyProgressWeights(db);

  const initial = await repo.getWeightById('bw_migrated_p_user_edit_1');
  assert.ok(initial);
  assert.equal(initial.weightKg, 80.0);
  assert.equal(initial.timePrecision, 'date_only');

  // User edits this biometric entry (e.g. corrected weight, verified exact morning time)
  const updatedEntry: BodyWeightEntry = {
    ...initial,
    weightKg: 79.2,
    time: '07:45',
    timePrecision: 'minute',
    notes: 'Corrected scale reading from morning session',
    updatedAt: '2026-03-22T08:15:00.000Z',
  };
  await repo.updateWeight(updatedEntry);

  // App restarts and runs reconciliation again
  const recon = await reconcileLegacyProgressWeights(db);
  assert.equal(recon.reconciledCount, 0, 'Should not overwrite existing biometric record');

  // Verify user's edits are 100% intact
  const reloaded = await repo.getWeightById('bw_migrated_p_user_edit_1');
  assert.ok(reloaded);
  assert.equal(reloaded.weightKg, 79.2, 'User-edited weight must NOT be reverted to 80.0');
  assert.equal(reloaded.time, '07:45', 'User-edited measurement time must be preserved');
  assert.equal(reloaded.timePrecision, 'minute', 'User-edited time precision must be preserved');
  assert.equal(reloaded.notes, 'Corrected scale reading from morning session');
});

test('Task 5.1A - Test 6: Timestamp precision helpers distinguish date-only from exact minute observations', () => {
  const dateOnlyEntry: BodyWeightEntry = {
    id: 'bw_date_only',
    date: '2026-03-01',
    time: '12:00',
    timePrecision: 'date_only',
    weightKg: 75.0,
    source: 'legacy_migration',
    createdAt: '2026-03-01T12:00:00.000Z',
    updatedAt: '2026-03-01T12:00:00.000Z',
  };

  const exactMinuteEntry: BodyWeightEntry = {
    id: 'bw_exact_minute',
    date: '2026-03-01',
    time: '08:30',
    timePrecision: 'minute',
    weightKg: 74.8,
    source: 'manual',
    createdAt: '2026-03-01T08:30:00.000Z',
    updatedAt: '2026-03-01T08:30:00.000Z',
  };

  const defaultPrecisionEntry: BodyWeightEntry = {
    id: 'bw_default',
    date: '2026-03-01',
    time: '18:15',
    // timePrecision omitted (defaults to minute in UI / helpers)
    weightKg: 75.2,
    source: 'scale',
    createdAt: '2026-03-01T18:15:00.000Z',
    updatedAt: '2026-03-01T18:15:00.000Z',
  };

  // date_only entry
  assert.equal(hasExactTime(dateOnlyEntry), false, 'date_only entry must not claim exact time');
  assert.equal(formatMeasurementTime(dateOnlyEntry), null, 'date_only entry must return null formatted time');

  // minute entry
  assert.equal(hasExactTime(exactMinuteEntry), true, 'minute entry has exact time');
  assert.equal(formatMeasurementTime(exactMinuteEntry), '08:30', 'minute entry returns exact 08:30 time');

  // default entry
  assert.equal(hasExactTime(defaultPrecisionEntry), true, 'omitted timePrecision treated as exact minute');
  assert.equal(formatMeasurementTime(defaultPrecisionEntry), '18:15');
});

test('Task 5.1A - Test 7: Multiple records per date and chronological sorting with date_only entries', async () => {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(db);

  const repo = new SQLiteBodyWeightRepository(db);

  // 1. Morning user measurement
  await repo.insertWeight({
    id: 'bw_morning',
    date: '2026-03-25',
    time: '07:00',
    timePrecision: 'minute',
    weightKg: 80.0,
    source: 'manual',
    createdAt: '2026-03-25T07:00:00.000Z',
    updatedAt: '2026-03-25T07:00:00.000Z',
  });

  // 2. Legacy date-only entry on same date
  await repo.insertWeight({
    id: 'bw_legacy_noon',
    date: '2026-03-25',
    time: '12:00',
    timePrecision: 'date_only',
    weightKg: 80.3,
    source: 'legacy_migration',
    createdAt: '2026-03-25T12:00:00.000Z',
    updatedAt: '2026-03-25T12:00:00.000Z',
  });

  // 3. Evening user measurement
  await repo.insertWeight({
    id: 'bw_evening',
    date: '2026-03-25',
    time: '21:00',
    timePrecision: 'minute',
    weightKg: 80.8,
    source: 'scale',
    createdAt: '2026-03-25T21:00:00.000Z',
    updatedAt: '2026-03-25T21:00:00.000Z',
  });

  const forDate = await repo.getWeightsForDate('2026-03-25');
  assert.equal(forDate.length, 3, 'All 3 entries on same date must coexist');
  assert.equal(forDate[0].id, 'bw_morning');
  assert.equal(forDate[0].timePrecision, 'minute');
  assert.equal(formatMeasurementTime(forDate[0]), '07:00');

  assert.equal(forDate[1].id, 'bw_legacy_noon');
  assert.equal(forDate[1].timePrecision, 'date_only');
  assert.equal(formatMeasurementTime(forDate[1]), null, 'Synthetic noon time must not be formatted as real observation');

  assert.equal(forDate[2].id, 'bw_evening');
  assert.equal(forDate[2].timePrecision, 'minute');
  assert.equal(formatMeasurementTime(forDate[2]), '21:00');
});

test('Task 5.1A - Test 8: Transaction rollback on failure preserves previous state', async () => {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(db);

  // Insert an initial progress entry
  await db.runAsync(`
    INSERT INTO progress_entries (id, date, label, calories, workouts, weight_kg, steps, created_at)
    VALUES ('p_rb_1', '2026-03-28', 'Rollback test', 2000, 1, 76.0, 6000, '2026-03-28T08:00:00.000Z');
  `);

  // Attempt transaction that reconciles and then fails
  let threw = false;
  try {
    await db.withExclusiveTransactionAsync(async (txn) => {
      await reconcileLegacyProgressWeights(db, txn);
      throw new Error('Simulated atomic failure');
    });
  } catch (err: any) {
    threw = true;
    assert.equal(err.message, 'Simulated atomic failure');
  }
  assert.ok(threw);

  // Verify rollback occurred: body_weight_entries must be empty
  const count = await db.getFirstAsync<{ count: number }>('SELECT count(*) as count FROM body_weight_entries;');
  assert.equal(count?.count, 0, 'Reconciliation must be completely rolled back on error');
});
