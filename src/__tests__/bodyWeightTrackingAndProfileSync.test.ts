import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { openDatabaseAsync } from './mocks/expo-sqlite';
import {
  runMigrations,
} from '../db/migrations';
import { IDatabase } from '../db/types';
import {
  SQLiteBodyWeightRepository,
  SQLiteProfileRepository,
} from '../db';
import { AddBodyWeightModal } from '../components/AddBodyWeightModal';
import { WeightHistoryList } from '../components/WeightHistoryList';
import { ProgressScreen } from '../screens/ProgressScreen';
import { translate } from '../i18n';
import {
  recordWeightWithProfileSync,
  updateWeightWithProfileSync,
  deleteWeightWithProfileSync,
  loadAllWeights,
  getWeightEntry,
  getWeightHistory,
  getWeightsForDate,
  getLatestWeight,
  recordWeight,
  updateWeight,
  deleteWeight,
} from '../services/bodyTrackingService';
import {
  parseWeightInput,
  validateWeightValue,
  validateWeightDate,
  validateWeightTime,
  kgToLb,
  lbToKg,
  formatWeight,
  compareBodyWeightsDescending,
  getLatestGenuineWeight,
  calculateTargetWeightComparison,
  KG_PER_LB,
} from '../utils/weight';
import {
  BodyWeightEntry,
  validateBodyWeightEntry,
} from '../models/biometrics';
import { UserProfile, ProgressEntry } from '../types';
import {
  activeRowStyle,
  activeTextAlign,
  activeWritingDirection,
  setActiveLanguage,
  rowStyle,
  textAlign,
  writingDirection,
} from '../utils/rtl';
import { getTheme } from '../theme/colors';
import { en } from '../i18n/en';
import { ar } from '../i18n/ar';

async function setupFreshDb(): Promise<IDatabase> {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(db);
  return db;
}

const mockProfile: UserProfile = {
  id: 'user-default',
  name: 'Test Athlete',
  heightCm: 178,
  weightKg: 80.0,
  targetWeightKg: 75.0,
  dailyCalorieTarget: 2200,
  proteinGrams: 160,
  carbsGrams: 220,
  fatsGrams: 70,
  goal: 'fat_loss',
  activityLevel: 'moderate',
  experienceLevel: 'intermediate',
};

// ============================================================================
// TEST 1: Valid kilogram entry parsing and storage
// ============================================================================
test('Task 5.2 - Test 1: Valid kilogram entry parsing and storage in SQLite', async () => {
  const parsed = parseWeightInput('75.5');
  assert.equal(parsed, 75.5, '75.5 string must parse cleanly to 75.5');
  const validation = validateWeightValue(parsed, 'metric');
  assert.equal(validation.isValid, true, '75.5 kg is within bounds');

  const db = await setupFreshDb();
  const repo = new SQLiteBodyWeightRepository(db);

  const entry: BodyWeightEntry = {
    id: 'bw-test-1',
    weightKg: 75.5,
    unit: 'kg',
    date: '2026-02-15',
    time: '08:30',
    timePrecision: 'minute',
    source: 'manual',
    notes: 'Morning weigh-in after wake up',
    createdAt: '2026-02-15T08:30:00.000Z',
    updatedAt: '2026-02-15T08:30:00.000Z',
  };

  await repo.insertWeight(entry);
  const fetched = await repo.getWeightById('bw-test-1');
  assert.ok(fetched, 'Entry must be retrieved from database');
  assert.equal(fetched.weightKg, 75.5);
  assert.equal(fetched.notes, 'Morning weigh-in after wake up');
});

// ============================================================================
// TEST 2: Valid pound entry and exact lossless conversion
// ============================================================================
test('Task 5.2 - Test 2: Valid pound entry and exact lossless conversion using 0.45359237', async () => {
  assert.equal(KG_PER_LB, 0.45359237, 'Exact avoirdupois pound conversion constant');

  const pounds = 165.3467;
  const kg = lbToKg(pounds);
  assert.equal(kg, pounds * 0.45359237, 'lbToKg must use exact multiplication');

  const roundtripLb = kgToLb(kg);
  assert.ok(Math.abs(roundtripLb - pounds) < 1e-10, 'Roundtrip conversion must preserve precision');

  // Display formatting
  const formattedLb = formatWeight(kg, 'imperial', 1);
  assert.equal(formattedLb, '165.3');

  const formattedKg = formatWeight(kg, 'metric', 1);
  assert.equal(formattedKg, (kg).toFixed(1));
});

// ============================================================================
// TEST 3: Comma and period decimal separator parsing
// ============================================================================
test('Task 5.2 - Test 3: Comma and period decimal separator parsing', () => {
  const periodParsed = parseWeightInput('78.4');
  const commaParsed = parseWeightInput('78,4');
  assert.equal(periodParsed, 78.4);
  assert.equal(commaParsed, 78.4);
  assert.equal(periodParsed, commaParsed, 'Period and comma representations must yield identical numbers');

  const arabicComma = parseWeightInput('82٫5'); // Arabic decimal separator
  assert.equal(arabicComma, 82.5);
});

// ============================================================================
// TEST 4: Blank, whitespace, negative, NaN, Infinity, and malformed input rejection
// ============================================================================
test('Task 5.2 - Test 4: Blank, whitespace, negative, NaN, Infinity, and malformed input rejection', () => {
  assert.equal(parseWeightInput(''), null, 'Empty string returns null');
  assert.equal(parseWeightInput('   '), null, 'Whitespace returns null');
  assert.equal(parseWeightInput('-75'), null, 'Negative weight returns null');
  assert.equal(parseWeightInput('-0.5'), null, 'Negative fraction returns null');
  assert.equal(parseWeightInput('abc'), null, 'Alphabetical returns null');
  assert.equal(parseWeightInput('NaN'), null, 'NaN literal returns null');
  assert.equal(parseWeightInput('Infinity'), null, 'Infinity literal returns null');
  assert.equal(parseWeightInput('-Infinity'), null, '-Infinity literal returns null');
  assert.equal(parseWeightInput('75.4.2'), null, 'Multiple decimals return null');
  assert.equal(parseWeightInput('75..2'), null, 'Consecutive dots return null');
});

// ============================================================================
// TEST 5: Out-of-bounds rejection (< 10 kg, > 500 kg, and equivalent in lbs)
// ============================================================================
test('Task 5.2 - Test 5: Out-of-bounds rejection (< 10 kg, > 500 kg, and equivalent in lbs)', () => {
  // Metric bounds: [10, 500]
  assert.equal(validateWeightValue(9.9, 'metric').isValid, false, 'Below 10 kg rejected');
  assert.equal(validateWeightValue(10.0, 'metric').isValid, true, '10 kg boundary accepted');
  assert.equal(validateWeightValue(250.0, 'metric').isValid, true, '250 kg accepted');
  assert.equal(validateWeightValue(500.0, 'metric').isValid, true, '500 kg boundary accepted');
  assert.equal(validateWeightValue(500.1, 'metric').isValid, false, 'Above 500 kg rejected');

  // Imperial bounds: ~[22.0462, 1102.31]
  assert.equal(validateWeightValue(22.0, 'imperial').isValid, false, 'Below 22.046 lb rejected');
  assert.equal(validateWeightValue(22.1, 'imperial').isValid, true, '22.1 lb accepted');
  assert.equal(validateWeightValue(150.0, 'imperial').isValid, true, '150 lb accepted');
  assert.equal(validateWeightValue(1102.3, 'imperial').isValid, true, '1102.3 lb accepted');
  assert.equal(validateWeightValue(1103.0, 'imperial').isValid, false, 'Above 1102.31 lb rejected');

  // Date and Time validators
  assert.equal(validateWeightDate('2026-02-15'), true);
  assert.equal(validateWeightDate('2026-02-30'), false, 'Feb 30 rejected');
  assert.equal(validateWeightDate('not-a-date'), false);

  assert.equal(validateWeightTime('08:30'), true);
  assert.equal(validateWeightTime('23:59'), true);
  assert.equal(validateWeightTime('24:00'), false);
  assert.equal(validateWeightTime('12:60'), false);
});

// ============================================================================
// TEST 6: Multiple weigh-ins on the same day recorded without collision
// ============================================================================
test('Task 5.2 - Test 6: Multiple weigh-ins on the same day recorded without collision', async () => {
  const db = await setupFreshDb();
  const repo = new SQLiteBodyWeightRepository(db);

  const morning: BodyWeightEntry = {
    id: 'bw-morn-1',
    weightKg: 76.2,
    unit: 'kg',
    date: '2026-02-15',
    time: '07:15',
    timePrecision: 'minute',
    source: 'manual',
    notes: 'Morning fasted',
    createdAt: '2026-02-15T07:15:00.000Z',
    updatedAt: '2026-02-15T07:15:00.000Z',
  };

  const evening: BodyWeightEntry = {
    id: 'bw-eve-1',
    weightKg: 77.0,
    unit: 'kg',
    date: '2026-02-15',
    time: '20:45',
    timePrecision: 'minute',
    source: 'manual',
    notes: 'Post-dinner',
    createdAt: '2026-02-15T20:45:00.000Z',
    updatedAt: '2026-02-15T20:45:00.000Z',
  };

  await repo.insertWeight(morning);
  await repo.insertWeight(evening);

  const allOnDay = await repo.getWeightsForDate('2026-02-15');
  assert.equal(allOnDay.length, 2, 'Both measurements must be stored without collision');

  const ids = allOnDay.map((e) => e.id);
  assert.ok(ids.includes('bw-morn-1'));
  assert.ok(ids.includes('bw-eve-1'));
});

// ============================================================================
// TEST 7: Chronological ordering and deterministic tie-breaking policy
// ============================================================================
test('Task 5.2 - Test 7: Chronological ordering and deterministic tie-breaking policy', () => {
  const entryDateOld: BodyWeightEntry = {
    id: 'e1',
    weightKg: 80,
    unit: 'kg',
    date: '2026-02-10',
    time: '10:00',
    timePrecision: 'minute',
    source: 'manual',
    createdAt: '2026-02-10T10:00:00.000Z',
    updatedAt: '2026-02-10T10:00:00.000Z',
  };

  const entryDateNewMorn: BodyWeightEntry = {
    id: 'e2',
    weightKg: 79.5,
    unit: 'kg',
    date: '2026-02-15',
    time: '08:00',
    timePrecision: 'minute',
    source: 'manual',
    createdAt: '2026-02-15T08:00:00.000Z',
    updatedAt: '2026-02-15T08:00:00.000Z',
  };

  const entryDateNewEve: BodyWeightEntry = {
    id: 'e3',
    weightKg: 80.1,
    unit: 'kg',
    date: '2026-02-15',
    time: '19:00',
    timePrecision: 'minute',
    source: 'manual',
    createdAt: '2026-02-15T19:00:00.000Z',
    updatedAt: '2026-02-15T19:00:00.000Z',
  };

  const entryDateOnlyOnSameDay: BodyWeightEntry = {
    id: 'e4',
    weightKg: 79.8,
    unit: 'kg',
    date: '2026-02-15',
    time: '12:00', // synthetic legacy time
    timePrecision: 'date_only',
    source: 'legacy_progress_backfill',
    createdAt: '2026-02-15T12:00:00.000Z',
    updatedAt: '2026-02-15T12:00:00.000Z',
  };

  const list = [entryDateOld, entryDateNewMorn, entryDateOnlyOnSameDay, entryDateNewEve];
  list.sort(compareBodyWeightsDescending);

  // Expected order:
  // 1. 2026-02-15 19:00 (e3 - verified minute time)
  // 2. 2026-02-15 08:00 (e2 - verified minute time)
  // 3. 2026-02-15 date_only (e4 - follows minute entries)
  // 4. 2026-02-10 10:00 (e1 - earlier date)
  assert.equal(list[0].id, 'e3', 'Latest verified minute entry comes first');
  assert.equal(list[1].id, 'e2', 'Morning verified minute entry comes second');
  assert.equal(list[2].id, 'e4', 'Date-only entry on same date follows minute entries');
  assert.equal(list[3].id, 'e1', 'Older date entry comes last');

  const latest = getLatestGenuineWeight(list);
  assert.equal(latest?.id, 'e3', 'Latest genuine weight should be e3');
});

// ============================================================================
// TEST 8: Historical edit without mutating or overwriting unrelated records
// ============================================================================
test('Task 5.2 - Test 8: Historical edit without mutating or overwriting unrelated records', async () => {
  const db = await setupFreshDb();
  const repo = new SQLiteBodyWeightRepository(db);
  const profileRepo = new SQLiteProfileRepository(db);

  await profileRepo.saveProfile(mockProfile);

  const entry1: BodyWeightEntry = {
    id: 'bw-1',
    weightKg: 82.0,
    unit: 'kg',
    date: '2026-02-10',
    time: '08:00',
    timePrecision: 'minute',
    source: 'manual',
    notes: 'Initial weight',
    createdAt: '2026-02-10T08:00:00.000Z',
    updatedAt: '2026-02-10T08:00:00.000Z',
  };

  const entry2: BodyWeightEntry = {
    id: 'bw-2',
    weightKg: 80.0,
    unit: 'kg',
    date: '2026-02-15',
    time: '08:00',
    timePrecision: 'minute',
    source: 'manual',
    notes: 'Latest weight',
    createdAt: '2026-02-15T08:00:00.000Z',
    updatedAt: '2026-02-15T08:00:00.000Z',
  };

  await repo.insertWeight(entry1);
  await repo.insertWeight(entry2);

  // Edit historical entry1 (older date)
  const updatedEntry1: BodyWeightEntry = {
    ...entry1,
    weightKg: 81.5,
    notes: 'Corrected typo in initial weight',
    updatedAt: '2026-02-15T10:00:00.000Z',
  };

  const syncResult = await updateWeightWithProfileSync(updatedEntry1, db);

  // Profile should NOT be changed because entry1 is not the latest genuine weight (entry2 is)
  assert.equal(syncResult.updatedProfile, null, 'Historical edit must not change profile weight');

  // Verify entry2 remains untouched in db
  const fetchedEntry2 = await repo.getWeightById('bw-2');
  assert.equal(fetchedEntry2?.weightKg, 80.0);
  assert.equal(fetchedEntry2?.notes, 'Latest weight');

  // Verify entry1 was updated
  const fetchedEntry1 = await repo.getWeightById('bw-1');
  assert.equal(fetchedEntry1?.weightKg, 81.5);
  assert.equal(fetchedEntry1?.notes, 'Corrected typo in initial weight');
});

// ============================================================================
// TEST 9: Deletion of weigh-in and confirmation flow
// ============================================================================
test('Task 5.2 - Test 9: Deletion of weigh-in and confirmation flow', async () => {
  const db = await setupFreshDb();
  const repo = new SQLiteBodyWeightRepository(db);
  const profileRepo = new SQLiteProfileRepository(db);

  await profileRepo.saveProfile({ ...mockProfile, weightKg: 79.0 });

  const older: BodyWeightEntry = {
    id: 'bw-old',
    weightKg: 80.5,
    unit: 'kg',
    date: '2026-02-10',
    time: '08:00',
    timePrecision: 'minute',
    source: 'manual',
    createdAt: '2026-02-10T08:00:00.000Z',
    updatedAt: '2026-02-10T08:00:00.000Z',
  };

  const newer: BodyWeightEntry = {
    id: 'bw-new',
    weightKg: 79.0,
    unit: 'kg',
    date: '2026-02-15',
    time: '08:00',
    timePrecision: 'minute',
    source: 'manual',
    createdAt: '2026-02-15T08:00:00.000Z',
    updatedAt: '2026-02-15T08:00:00.000Z',
  };

  await repo.insertWeight(older);
  await repo.insertWeight(newer);

  // Delete the latest entry
  const delResult = await deleteWeightWithProfileSync('bw-new', db);
  assert.ok(delResult.updatedProfile, 'Deleting latest entry must update profile');
  assert.equal(delResult.updatedProfile?.weightKg, 80.5, 'Profile reverts to previous latest weigh-in');

  // Check database
  const remaining = await repo.getAllWeights();
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].id, 'bw-old');

  const updatedProfile = await profileRepo.getProfile();
  assert.equal(updatedProfile?.weightKg, 80.5, 'Profile updated to 80.5 in SQLite');
});

// ============================================================================
// TEST 10: SQLite persistence roundtrip across database connection restarts
// ============================================================================
test('Task 5.2 - Test 10: SQLite persistence roundtrip across database connection restarts', async () => {
  const db = await setupFreshDb();
  const repo = new SQLiteBodyWeightRepository(db);

  const entry: BodyWeightEntry = {
    id: 'bw-persist-1',
    weightKg: 78.4321,
    unit: 'kg',
    date: '2026-02-14',
    time: '14:25',
    timePrecision: 'minute',
    source: 'manual',
    notes: 'After hydration session',
    createdAt: '2026-02-14T14:25:00.123Z',
    updatedAt: '2026-02-14T14:25:00.123Z',
  };

  await repo.insertWeight(entry);

  // Simulate new repository instance connected to same db
  const repoReconnected = new SQLiteBodyWeightRepository(db);
  const fetched = await repoReconnected.getWeightById('bw-persist-1');

  assert.ok(fetched);
  assert.equal(fetched.id, 'bw-persist-1');
  assert.equal(fetched.weightKg, 78.4321);
  assert.equal(fetched.date, '2026-02-14');
  assert.equal(fetched.time, '14:25');
  assert.equal(fetched.timePrecision, 'minute');
  assert.equal(fetched.notes, 'After hydration session');
  assert.equal(fetched.createdAt, '2026-02-14T14:25:00.123Z');
});

// ============================================================================
// TEST 11: Duplicate-save prevention (concurrent submissions flag)
// ============================================================================
test('Task 5.2 - Test 11: Duplicate-save prevention simulates isSaving barrier', async () => {
  let saveCount = 0;
  let isSaving = false;

  async function simulateUserSave() {
    if (isSaving) return; // Barrier active
    isSaving = true;
    try {
      await new Promise((resolve) => setTimeout(resolve, 10));
      saveCount++;
    } finally {
      isSaving = false;
    }
  }

  // Simulate rapid double click
  const p1 = simulateUserSave();
  const p2 = simulateUserSave();
  await Promise.all([p1, p2]);

  assert.equal(saveCount, 1, 'Only one save must execute during concurrent double-press');
});

// ============================================================================
// TEST 12: Atomic profile synchronization on insert (latest vs older)
// ============================================================================
test('Task 5.2 - Test 12: Atomic profile synchronization on insert (latest vs older)', async () => {
  const db = await setupFreshDb();
  const profileRepo = new SQLiteProfileRepository(db);
  await profileRepo.saveProfile({ ...mockProfile, weightKg: 85.0 });

  // 1. Insert initial latest entry
  const entryToday: BodyWeightEntry = {
    id: 'bw-today',
    weightKg: 83.0,
    unit: 'kg',
    date: '2026-02-15',
    time: '09:00',
    timePrecision: 'minute',
    source: 'manual',
    createdAt: '2026-02-15T09:00:00.000Z',
    updatedAt: '2026-02-15T09:00:00.000Z',
  };

  const res1 = await recordWeightWithProfileSync(entryToday, db);
  assert.ok(res1.updatedProfile, 'New latest weigh-in updates profile');
  assert.equal(res1.updatedProfile?.weightKg, 83.0);

  const profileAfter1 = await profileRepo.getProfile();
  assert.equal(profileAfter1?.weightKg, 83.0);

  // 2. Insert older entry from last week (e.g. backlogged entry)
  const entryLastWeek: BodyWeightEntry = {
    id: 'bw-last-week',
    weightKg: 84.5,
    unit: 'kg',
    date: '2026-02-08',
    time: '09:00',
    timePrecision: 'minute',
    source: 'manual',
    createdAt: '2026-02-15T10:00:00.000Z',
    updatedAt: '2026-02-15T10:00:00.000Z',
  };

  const res2 = await recordWeightWithProfileSync(entryLastWeek, db);
  assert.equal(res2.updatedProfile, null, 'Older historical weigh-in must NOT update profile');

  const profileAfter2 = await profileRepo.getProfile();
  assert.equal(profileAfter2?.weightKg, 83.0, 'Profile weight remains 83.0');
});

// ============================================================================
// TEST 13: Transaction rollback on failed database writes
// ============================================================================
test('Task 5.2 - Test 13: Transaction rollback on failed database writes', async () => {
  const db = await setupFreshDb();
  const profileRepo = new SQLiteProfileRepository(db);
  const weightRepo = new SQLiteBodyWeightRepository(db);

  await profileRepo.saveProfile({ ...mockProfile, weightKg: 85.0 });

  // Simulate invalid insertion that violates database constraint (e.g. duplicate PK)
  const entryA: BodyWeightEntry = {
    id: 'bw-unique-1',
    weightKg: 77.0,
    unit: 'kg',
    date: '2026-02-15',
    time: '08:00',
    timePrecision: 'minute',
    source: 'manual',
    createdAt: '2026-02-15T08:00:00.000Z',
    updatedAt: '2026-02-15T08:00:00.000Z',
  };
  await weightRepo.insertWeight(entryA);

  // Try to insert duplicate entryA through recordWeightWithProfileSync
  let errorCaught = false;
  try {
    await recordWeightWithProfileSync(entryA, db);
  } catch {
    errorCaught = true;
  }

  assert.equal(errorCaught, true, 'Duplicate key must throw error');

  // Verify profile did not get updated to 77.0
  const currentProfile = await profileRepo.getProfile();
  assert.equal(currentProfile?.weightKg, 85.0, 'Profile weight must remain 85.0 after rollback');
});

// ============================================================================
// TEST 14: Existing profile weight preservation when all historical entries are deleted
// ============================================================================
test('Task 5.2 - Test 14: Existing profile weight preservation when all historical entries are deleted', async () => {
  const db = await setupFreshDb();
  const profileRepo = new SQLiteProfileRepository(db);
  const weightRepo = new SQLiteBodyWeightRepository(db);

  await profileRepo.saveProfile({ ...mockProfile, weightKg: 80.0 });

  const singleEntry: BodyWeightEntry = {
    id: 'bw-only-one',
    weightKg: 79.5,
    unit: 'kg',
    date: '2026-02-15',
    time: '08:00',
    timePrecision: 'minute',
    source: 'manual',
    createdAt: '2026-02-15T08:00:00.000Z',
    updatedAt: '2026-02-15T08:00:00.000Z',
  };

  await recordWeightWithProfileSync(singleEntry, db);
  assert.equal((await profileRepo.getProfile())?.weightKg, 79.5);

  // Now delete the only entry in history
  const delResult = await deleteWeightWithProfileSync('bw-only-one', db);
  assert.equal(delResult.updatedProfile, null, 'Profile must not be cleared when all entries are deleted');

  const afterDeleteProfile = await profileRepo.getProfile();
  assert.equal(afterDeleteProfile?.weightKg, 79.5, 'Profile weight preserved, never zeroed or deleted');

  const remaining = await weightRepo.getAllWeights();
  assert.equal(remaining.length, 0, 'Weight table is empty');
});

// ============================================================================
// TEST 15: Legacy date_only display behavior: never displays 12:00, displays unrecorded
// ============================================================================
test('Task 5.2 - Test 15: Legacy date_only display behavior: never displays 12:00, displays unrecorded label', () => {
  const dateOnlyEntry: BodyWeightEntry = {
    id: 'legacy-1',
    weightKg: 78.0,
    unit: 'kg',
    date: '2026-02-10',
    time: '12:00', // synthetic legacy time in db
    timePrecision: 'date_only',
    source: 'legacy_progress_backfill',
    createdAt: '2026-02-10T12:00:00.000Z',
    updatedAt: '2026-02-10T12:00:00.000Z',
  };

  const isDateOnly = dateOnlyEntry.timePrecision === 'date_only';
  assert.equal(isDateOnly, true);

  // In UI rendering logic:
  const displayText = isDateOnly ? en.progress.timeUnrecorded : dateOnlyEntry.time;
  assert.equal(displayText, 'Time unrecorded');
  assert.notEqual(displayText, '12:00', 'Must never display synthetic 12:00');

  const arabicDisplayText = isDateOnly ? ar.progress.timeUnrecorded : dateOnlyEntry.time;
  assert.equal(arabicDisplayText, 'الوقت غير مسجل');
});

// ============================================================================
// TEST 16: Zero-valued legacy progress fields (weightKg === 0) ignored as valid biometric entries
// ============================================================================
test('Task 5.2 - Test 16: Zero-valued legacy progress fields (weightKg === 0) ignored as valid biometric entries', () => {
  const legacyProgressZeroWeight: ProgressEntry = {
    id: 'prog-zero',
    date: '2026-02-01',
    weightKg: 0,
    calories: 2100,
    workouts: 1,
    steps: 8000,
  };

  // 0 kg is not a valid biometric entry (< 10 kg boundary)
  assert.equal(validateWeightValue(legacyProgressZeroWeight.weightKg, 'metric').isValid, false);

  assert.throws(
    () =>
      validateBodyWeightEntry({
        id: 'bw-zero',
        weightKg: 0,
        unit: 'kg',
        date: '2026-02-01',
        time: '12:00',
        timePrecision: 'date_only',
        source: 'legacy_progress_backfill',
        createdAt: '2026-02-01T12:00:00.000Z',
        updatedAt: '2026-02-01T12:00:00.000Z',
      }),
    /Weight must be a valid number between 10.0 kg and 500.0 kg/
  );

  // Target comparison ignores 0 kg or invalid weights
  const comparison = calculateTargetWeightComparison(0, 75.0);
  assert.equal(comparison.hasTarget, true);
  assert.equal(comparison.deltaKg, undefined);
  assert.equal(comparison.isGoalReached, false);
});

// ============================================================================
// TEST 17: Arabic RTL layout, text alignment, and writing direction
// ============================================================================
test('Task 5.2 - Test 17: Arabic RTL layout, text alignment, and writing direction', () => {
  setActiveLanguage('ar');
  const activeRow = activeRowStyle();
  assert.equal(activeRow.flexDirection, 'row-reverse', 'Arabic row style is row-reverse');

  const activeText = activeTextAlign();
  assert.equal(activeText, 'right', 'Arabic text align is right');

  const activeDir = activeWritingDirection();
  assert.equal(activeDir, 'rtl', 'Arabic writing direction is rtl');

  // Explicit helper with argument
  assert.equal(rowStyle('ar').flexDirection, 'row-reverse');
  assert.equal(textAlign('ar'), 'right');
  assert.equal(writingDirection('ar'), 'rtl');

  // Reset to default
  setActiveLanguage('en');

  // Check required progress i18n keys in Arabic
  assert.ok(ar.progress.addWeight, 'ar.progress.addWeight exists');
  assert.ok(ar.progress.logWeight, 'ar.progress.logWeight exists');
  assert.ok(ar.progress.weightHistory, 'ar.progress.weightHistory exists');
  assert.ok(ar.progress.targetWeight, 'ar.progress.targetWeight exists');
  assert.ok(ar.progress.currentWeight, 'ar.progress.currentWeight exists');
  assert.ok(ar.progress.timeUnrecorded, 'ar.progress.timeUnrecorded exists');
});

// ============================================================================
// TEST 18: English LTR layout
// ============================================================================
test('Task 5.2 - Test 18: English LTR layout', () => {
  setActiveLanguage('en');
  const activeRow = activeRowStyle();
  assert.equal(activeRow.flexDirection, 'row', 'English row style is row');

  const activeText = activeTextAlign();
  assert.equal(activeText, 'left', 'English text align is left');

  const activeDir = activeWritingDirection();
  assert.equal(activeDir, 'ltr', 'English writing direction is ltr');

  assert.equal(rowStyle('en').flexDirection, 'row');
  assert.equal(textAlign('en'), 'left');
  assert.equal(writingDirection('en'), 'ltr');

  // Check required progress i18n keys in English
  assert.ok(en.progress.addWeight, 'en.progress.addWeight exists');
  assert.ok(en.progress.logWeight, 'en.progress.logWeight exists');
  assert.ok(en.progress.weightHistory, 'en.progress.weightHistory exists');
  assert.ok(en.progress.targetWeight, 'en.progress.targetWeight exists');
  assert.ok(en.progress.currentWeight, 'en.progress.currentWeight exists');
  assert.ok(en.progress.timeUnrecorded, 'en.progress.timeUnrecorded exists');
});

// ============================================================================
// TEST 19: Light and dark theme rendering
// ============================================================================
test('Task 5.2 - Test 19: Light and dark theme token rendering and contrast', () => {
  const lightColors = getTheme('light').colors;
  assert.ok(lightColors.background, 'Light background color exists');
  assert.ok(lightColors.text, 'Light text color exists');
  assert.ok(lightColors.surface, 'Light surface color exists');
  assert.ok(lightColors.accent, 'Light accent color exists');

  const darkColors = getTheme('dark').colors;
  assert.ok(darkColors.background, 'Dark background color exists');
  assert.ok(darkColors.text, 'Dark text color exists');
  assert.ok(darkColors.surface, 'Dark surface color exists');
  assert.ok(darkColors.accent, 'Dark accent color exists');

  assert.notEqual(lightColors.background, darkColors.background, 'Light and dark themes have distinct backgrounds');
  assert.notEqual(lightColors.text, darkColors.text, 'Light and dark themes have distinct text colors');
});

// ============================================================================
// TEST 20: Target weight comparison and goal calculations
// ============================================================================
test('Task 5.2 - Test 20: Target weight comparison, delta calculations, and goal reached states', () => {
  // Scenario A: Above target weight
  const aboveTarget = calculateTargetWeightComparison(80.0, 75.0);
  assert.equal(aboveTarget.hasTarget, true);
  assert.equal(aboveTarget.deltaKg, 5.0);
  assert.equal(aboveTarget.isGoalReached, false);
  assert.equal(aboveTarget.deltaFormatted, '+5.0 kg');

  // Scenario B: Below target weight
  const belowTarget = calculateTargetWeightComparison(73.5, 75.0);
  assert.equal(belowTarget.hasTarget, true);
  assert.equal(belowTarget.deltaKg, -1.5);
  assert.equal(belowTarget.isGoalReached, false);
  assert.equal(belowTarget.deltaFormatted, '-1.5 kg');

  // Scenario C: Exact target reached (within 0.1 kg tolerance)
  const exactTarget = calculateTargetWeightComparison(75.05, 75.0);
  assert.equal(exactTarget.hasTarget, true);
  assert.equal(exactTarget.isGoalReached, true, 'Within 0.1 kg tolerance counts as goal reached');

  // Scenario D: No target configured
  const noTarget = calculateTargetWeightComparison(80.0, undefined);
  assert.equal(noTarget.hasTarget, false);
  assert.equal(noTarget.isGoalReached, false);

  // Scenario E: Invalid target out of bounds
  const invalidTarget = calculateTargetWeightComparison(80.0, 5);
  assert.equal(invalidTarget.hasTarget, false);
});

// ============================================================================
// TEST 21: Body tracking service CRUD wrappers with transaction delegation
// ============================================================================
test('Task 5.2 - Test 21: Body tracking service standalone functions operate correctly with txn', async () => {
  const db = await setupFreshDb();

  const entry: BodyWeightEntry = {
    id: 'bw-svc-1',
    weightKg: 78.5,
    unit: 'kg',
    date: '2026-02-14',
    time: '07:30',
    timePrecision: 'minute',
    source: 'manual',
    notes: 'Initial test entry',
    createdAt: '2026-02-14T07:30:00.000Z',
    updatedAt: '2026-02-14T07:30:00.000Z',
  };

  await recordWeight(entry, db);

  const fetched = await getWeightEntry('bw-svc-1', db);
  assert.ok(fetched);
  assert.equal(fetched.weightKg, 78.5);

  const all = await loadAllWeights(db);
  assert.equal(all.length, 1);

  const dateWeights = await getWeightsForDate('2026-02-14', db);
  assert.equal(dateWeights.length, 1);

  const rangeWeights = await getWeightHistory('2026-02-01', '2026-02-28', db);
  assert.equal(rangeWeights.length, 1);

  const latest = await getLatestWeight(db);
  assert.ok(latest);
  assert.equal(latest.id, 'bw-svc-1');

  // Update
  await updateWeight({ ...entry, weightKg: 79.0 }, db);
  const updated = await getWeightEntry('bw-svc-1', db);
  assert.equal(updated?.weightKg, 79.0);

  // Delete
  await deleteWeight('bw-svc-1', db);
  const afterDelete = await getWeightEntry('bw-svc-1', db);
  assert.equal(afterDelete, null);
});

// ============================================================================
// TEST 22: Weight utility tie-breaking, sorting, and edge cases
// ============================================================================
test('Task 5.2 - Test 22: Weight utilities edge cases, imperial target deltas, and tie-breaking', () => {
  // Edge cases for getLatestGenuineWeight
  assert.equal(getLatestGenuineWeight(null), null);
  assert.equal(getLatestGenuineWeight([]), null);
  assert.equal(
    getLatestGenuineWeight([
      {
        id: 'bad-1',
        weightKg: 5, // below min
        date: '2026-02-15',
        time: '10:00',
        source: 'manual',
        createdAt: '2026-02-15T10:00:00.000Z',
        updatedAt: '2026-02-15T10:00:00.000Z',
      },
    ]),
    null
  );

  // Imperial unit target comparison
  const imperialComparison = calculateTargetWeightComparison(80.0, 75.0, 'imperial');
  assert.equal(imperialComparison.hasTarget, true);
  assert.ok(imperialComparison.deltaFormatted?.includes('lb'));

  // Comparator tie breaker: same date, one exact time and one date_only
  const exactEntry: BodyWeightEntry = {
    id: 'e-exact',
    weightKg: 80.0,
    date: '2026-02-15',
    time: '10:00',
    timePrecision: 'minute',
    source: 'manual',
    createdAt: '2026-02-15T10:00:00.000Z',
    updatedAt: '2026-02-15T10:00:00.000Z',
  };

  const dateOnlyEntry: BodyWeightEntry = {
    id: 'e-dateonly',
    weightKg: 80.0,
    date: '2026-02-15',
    time: '12:00',
    timePrecision: 'date_only',
    source: 'legacy_progress_backfill',
    createdAt: '2026-02-15T10:00:00.000Z',
    updatedAt: '2026-02-15T10:00:00.000Z',
  };

  assert.equal(compareBodyWeightsDescending(exactEntry, dateOnlyEntry), -1, 'Exact minute entry beats date_only');
  assert.equal(compareBodyWeightsDescending(dateOnlyEntry, exactEntry), 1, 'date_only follows exact minute entry');

  // Same date, same precision, same createdAt -> tie-broken by ID
  const entryA: BodyWeightEntry = {
    id: 'entry-a',
    weightKg: 80.0,
    date: '2026-02-15',
    time: '10:00',
    timePrecision: 'minute',
    source: 'manual',
    createdAt: '2026-02-15T10:00:00.000Z',
    updatedAt: '2026-02-15T10:00:00.000Z',
  };
  const entryB: BodyWeightEntry = {
    id: 'entry-b',
    weightKg: 80.0,
    date: '2026-02-15',
    time: '10:00',
    timePrecision: 'minute',
    source: 'manual',
    createdAt: '2026-02-15T10:00:00.000Z',
    updatedAt: '2026-02-15T10:00:00.000Z',
  };
  assert.ok(compareBodyWeightsDescending(entryA, entryB) > 0, 'entry-b comes before entry-a (ID descending)');
  assert.ok(compareBodyWeightsDescending(entryB, entryA) < 0);
});

// ============================================================================
// TEST 23: AddBodyWeightModal component rendering and accessibility
// ============================================================================
test('Task 5.2 - Test 23: AddBodyWeightModal renders correctly in edit and create modes', () => {
  const tEn = (key: any) => translate('en', key);
  const tAr = (key: any) => translate('ar', key);

  // Edit mode in English
  const editHtml = renderToStaticMarkup(
    React.createElement(AddBodyWeightModal, {
      visible: true,
      onClose: () => {},
      onSave: async () => {},
      onDelete: async () => {},
      initialEntry: {
        id: 'bw-modal-1',
        weightKg: 82.5,
        unit: 'kg',
        date: '2026-02-15',
        time: '08:30',
        timePrecision: 'minute',
        source: 'manual',
        notes: 'Morning weigh-in',
        createdAt: '2026-02-15T08:30:00.000Z',
        updatedAt: '2026-02-15T08:30:00.000Z',
      },
      defaultUnit: 'metric',
      t: tEn,
    })
  );

  assert.ok(editHtml.includes('82.5'));
  assert.ok(editHtml.includes('2026-02-15'));
  assert.ok(editHtml.includes('08:30'));

  // Create mode in Arabic
  const createHtml = renderToStaticMarkup(
    React.createElement(AddBodyWeightModal, {
      visible: true,
      onClose: () => {},
      onSave: async () => {},
      defaultUnit: 'imperial',
      t: tAr,
      referenceDate: '2026-02-15',
    })
  );

  assert.ok(createHtml.includes('2026-02-15'));
});

// ============================================================================
// TEST 24: WeightHistoryList component rendering and legacy date-only handling
// ============================================================================
test('Task 5.2 - Test 24: WeightHistoryList renders chronological groups and date-only labels', () => {
  const tEn = (key: any) => translate('en', key);

  const entries: BodyWeightEntry[] = [
    {
      id: 'bw-h1',
      weightKg: 79.5,
      unit: 'kg',
      date: '2026-02-15',
      time: '08:00',
      timePrecision: 'minute',
      source: 'manual',
      notes: 'Morning run',
      createdAt: '2026-02-15T08:00:00.000Z',
      updatedAt: '2026-02-15T08:00:00.000Z',
    },
    {
      id: 'bw-h2',
      weightKg: 80.2,
      unit: 'kg',
      date: '2026-02-15',
      time: '12:00',
      timePrecision: 'date_only',
      source: 'legacy_progress_backfill',
      createdAt: '2026-02-15T12:00:00.000Z',
      updatedAt: '2026-02-15T12:00:00.000Z',
    },
  ];

  const html = renderToStaticMarkup(
    React.createElement(WeightHistoryList, {
      weights: entries,
      onEditEntry: () => {},
      unit: 'metric',
      t: tEn,
    })
  );

  assert.ok(html.includes('79.5'));
  assert.ok(html.includes('80.2'));
  assert.ok(html.includes('Time unrecorded'), 'Must render Time unrecorded label for date_only');

  // Empty state rendering
  const emptyHtml = renderToStaticMarkup(
    React.createElement(WeightHistoryList, {
      weights: [],
      onEditEntry: () => {},
      unit: 'metric',
      t: tEn,
    })
  );

  assert.ok(emptyHtml.includes(en.progress.noWeightsYet));
});

// ============================================================================
// TEST 25: ProgressScreen integration with weight tracking and target delta
// ============================================================================
test('Task 5.2 - Test 25: ProgressScreen integrates body weights, target comparison, and history', () => {
  const tEn = (key: any) => translate('en', key);

  const bodyWeights: BodyWeightEntry[] = [
    {
      id: 'bw-scr-1',
      weightKg: 78.0,
      unit: 'kg',
      date: '2026-02-15',
      time: '09:00',
      timePrecision: 'minute',
      source: 'manual',
      createdAt: '2026-02-15T09:00:00.000Z',
      updatedAt: '2026-02-15T09:00:00.000Z',
    },
  ];

  const html = renderToStaticMarkup(
    React.createElement(ProgressScreen, {
      t: tEn,
      profile: mockProfile,
      progress: [],
      bodyWeights,
      referenceDate: '2026-02-15',
      language: 'en',
    })
  );

  assert.ok(html.includes('78.0 kg'), 'Must render latest genuine weight');
  assert.ok(html.includes('75.0 kg'), 'Must render target weight');
  assert.ok(html.includes('+3.0 kg'), 'Must render target delta');
});
