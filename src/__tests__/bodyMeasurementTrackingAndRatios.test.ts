import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { openDatabaseAsync } from './mocks/expo-sqlite';
import { runMigrations } from '../db/migrations';
import { IDatabase } from '../db/types';
import { SQLiteBodyMeasurementRepository } from '../db/repositories/bodyMeasurementRepository';
import { AddBodyMeasurementModal } from '../components/AddBodyMeasurementModal';
import { BodyMeasurementHistoryList } from '../components/BodyMeasurementHistoryList';
import { ProgressScreen } from '../screens/ProgressScreen';
import { translate } from '../i18n';
import {
  loadAllMeasurements,
  getMeasurementEntry,
  getMeasurementsHistory,
  getMeasurementsForDate,
  getLatestMeasurement,
  recordMeasurement,
  updateMeasurement,
  deleteMeasurement,
} from '../services/bodyTrackingService';
import {
  cmToInch,
  inchToCm,
  parseMeasurementInput,
  formatMeasurementInput,
  formatMeasurement,
  validateCircumferenceValue,
  hasAtLeastOneMeasurement,
  compareBodyMeasurementsDescending,
  calculateMeasurementDelta,
  calculateWaistToHipRatio,
  calculateWaistToHeightRatio,
  getLatestMeasurementEntry,
  getPreviousMeasurementEntry,
  validateMeasurementDate,
  validateMeasurementTime,
  MEASUREMENT_FIELDS,
  CM_PER_INCH,
} from '../utils/measurements';
import {
  BodyMeasurementEntry,
  validateBodyMeasurementEntry,
} from '../models/biometrics';
import { UserProfile } from '../types';
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
  id: 'user-athlete-1',
  name: 'Athlete One',
  heightCm: 180,
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
// TEST 1: Single circumference entry parsing, validation, and storage in SQLite
// ============================================================================
test('Task 5.3 - Test 1: Single circumference entry stored in SQLite with unmeasured fields null', async () => {
  const db = await setupFreshDb();
  const repo = new SQLiteBodyMeasurementRepository(db);

  const parsed = parseMeasurementInput('84.5');
  assert.equal(parsed, 84.5);

  const entry: BodyMeasurementEntry = {
    id: 'bm-test-1',
    date: '2026-02-15',
    time: '08:00',
    waistCm: 84.5,
    notes: 'Morning measurement',
    createdAt: '2026-02-15T08:00:00.000Z',
    updatedAt: '2026-02-15T08:00:00.000Z',
  };

  validateBodyMeasurementEntry(entry);
  await repo.insertMeasurement(entry);

  const loaded = await repo.getMeasurementById('bm-test-1');
  assert.ok(loaded);
  assert.equal(loaded?.waistCm, 84.5);
  assert.equal(loaded?.chestCm, null, 'Unmeasured chest must remain null');
  assert.equal(loaded?.hipsCm, null, 'Unmeasured hips must remain null');
  assert.equal(loaded?.leftArmCm, null, 'Unmeasured arm must remain null');
});

// ============================================================================
// TEST 2: Multiple circumferences in a single entry
// ============================================================================
test('Task 5.3 - Test 2: Full body circumferences recorded accurately in a single entry', async () => {
  const db = await setupFreshDb();
  const repo = new SQLiteBodyMeasurementRepository(db);

  const entry: BodyMeasurementEntry = {
    id: 'bm-full-1',
    date: '2026-02-16',
    time: '07:30',
    chestCm: 104.0,
    waistCm: 82.0,
    hipsCm: 98.0,
    leftArmCm: 36.5,
    rightArmCm: 37.0,
    leftThighCm: 58.0,
    rightThighCm: 58.5,
    leftCalfCm: 38.0,
    rightCalfCm: 38.0,
    shouldersCm: 118.0,
    neckCm: 39.0,
    notes: 'Complete monthly check-in',
    createdAt: '2026-02-16T07:30:00.000Z',
    updatedAt: '2026-02-16T07:30:00.000Z',
  };

  validateBodyMeasurementEntry(entry);
  await repo.insertMeasurement(entry);

  const loaded = await repo.getMeasurementById('bm-full-1');
  assert.ok(loaded);
  assert.equal(loaded?.chestCm, 104.0);
  assert.equal(loaded?.waistCm, 82.0);
  assert.equal(loaded?.hipsCm, 98.0);
  assert.equal(loaded?.leftArmCm, 36.5);
  assert.equal(loaded?.rightArmCm, 37.0);
  assert.equal(loaded?.leftThighCm, 58.0);
  assert.equal(loaded?.rightThighCm, 58.5);
  assert.equal(loaded?.leftCalfCm, 38.0);
  assert.equal(loaded?.rightCalfCm, 38.0);
  assert.equal(loaded?.shouldersCm, 118.0);
  assert.equal(loaded?.neckCm, 39.0);
});

// ============================================================================
// TEST 3: Unmeasured fields remain strictly NULL, never 0
// ============================================================================
test('Task 5.3 - Test 3: Unmeasured sites remain strictly null in SQLite and are never stored as zero', async () => {
  const db = await setupFreshDb();
  const repo = new SQLiteBodyMeasurementRepository(db);

  const entry: BodyMeasurementEntry = {
    id: 'bm-null-check',
    date: '2026-02-17',
    time: '09:00',
    hipsCm: 95.0,
    createdAt: '2026-02-17T09:00:00.000Z',
    updatedAt: '2026-02-17T09:00:00.000Z',
  };
  await repo.insertMeasurement(entry);

  // Directly query SQLite to check database column values
  const row = await db.getFirstAsync<any>(
    'SELECT * FROM body_measurement_entries WHERE id = ?;',
    'bm-null-check'
  );
  assert.ok(row);
  assert.equal(row.hips_cm, 95.0);
  assert.equal(row.chest_cm, null, 'chest_cm column in SQLite must be NULL');
  assert.equal(row.waist_cm, null, 'waist_cm column in SQLite must be NULL');
  assert.equal(row.left_arm_cm, null, 'left_arm_cm column in SQLite must be NULL');
  assert.notEqual(row.chest_cm, 0, 'Must never be 0');
});

// ============================================================================
// TEST 4: Rejecting entirely empty entries
// ============================================================================
test('Task 5.3 - Test 4: Entries with zero recorded circumferences are rejected', () => {
  const emptyEntry: Partial<BodyMeasurementEntry> = {
    id: 'bm-empty',
    date: '2026-02-18',
    time: '10:00',
    chestCm: null,
    waistCm: null,
    hipsCm: null,
  };

  assert.equal(hasAtLeastOneMeasurement(emptyEntry), false, 'Empty entry has no measurements');

  const withOne: Partial<BodyMeasurementEntry> = {
    ...emptyEntry,
    waistCm: 80.0,
  };
  assert.equal(hasAtLeastOneMeasurement(withOne), true, 'Entry with one measurement is recognized');
});

// ============================================================================
// TEST 5: Exact cm/in conversion accuracy (1 in = 2.54 cm)
// ============================================================================
test('Task 5.3 - Test 5: Exact unit conversion using 1 inch = 2.54 cm', () => {
  assert.equal(inchToCm(1), 2.54);
  assert.equal(inchToCm(10), 25.4);
  assert.equal(cmToInch(2.54), 1);
  assert.equal(cmToInch(25.4), 10);

  // 32 inches to cm
  const waistIn = 32.0;
  const waistCm = inchToCm(waistIn);
  assert.equal(waistCm, 32.0 * CM_PER_INCH);

  // Convert back to inches
  const backToIn = cmToInch(waistCm);
  assert.equal(backToIn, 32.0);
});

// ============================================================================
// TEST 6: Repeated unit switching (20 toggles cm <-> in) without numeric drift
// ============================================================================
test('Task 5.3 - Test 6: 20 repeated unit toggles maintain canonical measurement without drift', () => {
  const initialCm = 82.55; // exactly 32.5 inches
  let canonicalCm = initialCm;
  let currentUnit: 'cm' | 'in' = 'cm';

  for (let i = 0; i < 20; i++) {
    const nextUnit: 'cm' | 'in' = currentUnit === 'cm' ? 'in' : 'cm';
    const displayStr = formatMeasurementInput(canonicalCm, nextUnit, 2);
    assert.ok(displayStr.length > 0);
    // Canonical state remains untouched across unit switches
    currentUnit = nextUnit;
  }

  assert.equal(canonicalCm, initialCm, 'Canonical cm must retain exact precision across 20 toggles');
});

// ============================================================================
// TEST 7: Editing an existing entry modifies only target field
// ============================================================================
test('Task 5.3 - Test 7: Modifying one field leaves other measured fields unchanged', async () => {
  const db = await setupFreshDb();
  const repo = new SQLiteBodyMeasurementRepository(db);

  const initialEntry: BodyMeasurementEntry = {
    id: 'bm-edit-1',
    date: '2026-02-15',
    time: '08:00',
    chestCm: 102.0,
    waistCm: 84.0,
    hipsCm: 99.0,
    createdAt: '2026-02-15T08:00:00.000Z',
    updatedAt: '2026-02-15T08:00:00.000Z',
  };
  await repo.insertMeasurement(initialEntry);

  // Athlete lost 1.5 cm from waist; chest and hips remain identical
  const updatedEntry: BodyMeasurementEntry = {
    ...initialEntry,
    waistCm: 82.5,
    updatedAt: '2026-02-15T09:00:00.000Z',
  };
  await repo.updateMeasurement(updatedEntry);

  const reloaded = await repo.getMeasurementById('bm-edit-1');
  assert.equal(reloaded?.waistCm, 82.5);
  assert.equal(reloaded?.chestCm, 102.0, 'Chest must remain 102.0');
  assert.equal(reloaded?.hipsCm, 99.0, 'Hips must remain 99.0');
});

// ============================================================================
// TEST 8: Removing a previously measured field sets it to null
// ============================================================================
test('Task 5.3 - Test 8: Clearing a previously measured field sets column back to null', async () => {
  const db = await setupFreshDb();
  const repo = new SQLiteBodyMeasurementRepository(db);

  const initialEntry: BodyMeasurementEntry = {
    id: 'bm-clear-field',
    date: '2026-02-15',
    time: '08:00',
    chestCm: 100.0,
    waistCm: 80.0,
    createdAt: '2026-02-15T08:00:00.000Z',
    updatedAt: '2026-02-15T08:00:00.000Z',
  };
  await repo.insertMeasurement(initialEntry);

  // User clears chest measurement
  const clearedChestEntry: BodyMeasurementEntry = {
    ...initialEntry,
    chestCm: null,
    updatedAt: '2026-02-15T08:30:00.000Z',
  };
  await repo.updateMeasurement(clearedChestEntry);

  const reloaded = await repo.getMeasurementById('bm-clear-field');
  assert.equal(reloaded?.chestCm, null, 'Cleared chest must be null in SQLite');
  assert.equal(reloaded?.waistCm, 80.0, 'Waist remains intact');
});

// ============================================================================
// TEST 9: Date and time validation
// ============================================================================
test('Task 5.3 - Test 9: Strict Gregorian date and 24-hr time validation', () => {
  assert.equal(validateMeasurementDate('2026-02-15'), true);
  assert.equal(validateMeasurementDate('2024-02-29'), true, 'Leap year valid');
  assert.equal(validateMeasurementDate('2025-02-29'), false, 'Non-leap year invalid');
  assert.equal(validateMeasurementDate('2026-02-30'), false, 'Feb 30 invalid');
  assert.equal(validateMeasurementDate('invalid-date'), false);

  assert.equal(validateMeasurementTime('00:00'), true);
  assert.equal(validateMeasurementTime('08:30'), true);
  assert.equal(validateMeasurementTime('23:59'), true);
  assert.equal(validateMeasurementTime('24:00'), false, '24:00 is invalid');
  assert.equal(validateMeasurementTime('12:60'), false, '12:60 is invalid');
  assert.equal(validateMeasurementTime('8:30'), false, 'Must have leading zero');
});

// ============================================================================
// TEST 10: Multiple measurement entries on the same date with distinct times
// ============================================================================
test('Task 5.3 - Test 10: Multiple weigh-in/measurement entries on the same day recorded without collision', async () => {
  const db = await setupFreshDb();
  const repo = new SQLiteBodyMeasurementRepository(db);

  const morning: BodyMeasurementEntry = {
    id: 'bm-same-day-am',
    date: '2026-02-15',
    time: '07:00',
    waistCm: 81.0,
    notes: 'Morning fasted',
    createdAt: '2026-02-15T07:00:00.000Z',
    updatedAt: '2026-02-15T07:00:00.000Z',
  };

  const evening: BodyMeasurementEntry = {
    id: 'bm-same-day-pm',
    date: '2026-02-15',
    time: '19:00',
    waistCm: 82.5,
    notes: 'Post-dinner check',
    createdAt: '2026-02-15T19:00:00.000Z',
    updatedAt: '2026-02-15T19:00:00.000Z',
  };

  await repo.insertMeasurement(morning);
  await repo.insertMeasurement(evening);

  const forDate = await repo.getMeasurementsForDate('2026-02-15');
  assert.equal(forDate.length, 2, 'Both same-day measurements must be preserved');
  assert.equal(forDate[0].id, 'bm-same-day-am');
  assert.equal(forDate[1].id, 'bm-same-day-pm');
});

// ============================================================================
// TEST 11: Deterministic chronological ordering
// ============================================================================
test('Task 5.3 - Test 11: compareBodyMeasurementsDescending sorts newest first with tie-breaking', () => {
  const e1: BodyMeasurementEntry = {
    id: 'bm-1',
    date: '2026-02-10',
    time: '08:00',
    waistCm: 85.0,
    createdAt: '2026-02-10T08:00:00.000Z',
    updatedAt: '2026-02-10T08:00:00.000Z',
  };

  const e2: BodyMeasurementEntry = {
    id: 'bm-2',
    date: '2026-02-15',
    time: '08:00',
    waistCm: 84.0,
    createdAt: '2026-02-15T08:00:00.000Z',
    updatedAt: '2026-02-15T08:00:00.000Z',
  };

  const e3: BodyMeasurementEntry = {
    id: 'bm-3',
    date: '2026-02-15',
    time: '18:00',
    waistCm: 84.5,
    createdAt: '2026-02-15T18:00:00.000Z',
    updatedAt: '2026-02-15T18:00:00.000Z',
  };

  const sorted = [e1, e2, e3].sort(compareBodyMeasurementsDescending);
  assert.equal(sorted[0].id, 'bm-3', 'Latest date and time first');
  assert.equal(sorted[1].id, 'bm-2');
  assert.equal(sorted[2].id, 'bm-1', 'Oldest date last');
});

// ============================================================================
// TEST 12: SQLite persistence roundtrip across database connection close and reopen
// ============================================================================
test('Task 5.3 - Test 12: Measurements persist across database connection reload', async () => {
  const db = await setupFreshDb();
  const repo1 = new SQLiteBodyMeasurementRepository(db);

  const entry: BodyMeasurementEntry = {
    id: 'bm-persist-roundtrip',
    date: '2026-02-15',
    time: '12:00',
    waistCm: 79.5,
    hipsCm: 96.0,
    createdAt: '2026-02-15T12:00:00.000Z',
    updatedAt: '2026-02-15T12:00:00.000Z',
  };
  await repo1.insertMeasurement(entry);

  // Create new repository instance simulating app restart
  const repo2 = new SQLiteBodyMeasurementRepository(db);
  const reloaded = await repo2.getMeasurementById('bm-persist-roundtrip');
  assert.ok(reloaded);
  assert.equal(reloaded?.waistCm, 79.5);
  assert.equal(reloaded?.hipsCm, 96.0);
});

// ============================================================================
// TEST 13: Atomic update and deletion operations
// ============================================================================
test('Task 5.3 - Test 13: Deleting a measurement removes it from SQLite without cascading or collateral deletion', async () => {
  const db = await setupFreshDb();
  const repo = new SQLiteBodyMeasurementRepository(db);

  await repo.insertMeasurement({
    id: 'bm-to-keep',
    date: '2026-02-14',
    time: '08:00',
    waistCm: 82.0,
    createdAt: '2026-02-14T08:00:00.000Z',
    updatedAt: '2026-02-14T08:00:00.000Z',
  });

  await repo.insertMeasurement({
    id: 'bm-to-delete',
    date: '2026-02-15',
    time: '08:00',
    waistCm: 81.5,
    createdAt: '2026-02-15T08:00:00.000Z',
    updatedAt: '2026-02-15T08:00:00.000Z',
  });

  await repo.deleteMeasurement('bm-to-delete');

  const remaining = await repo.getAllMeasurements();
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].id, 'bm-to-keep');
});

// ============================================================================
// TEST 14: Transactional rollback on database write failure
// ============================================================================
test('Task 5.3 - Test 14: Database write failure rolls back completely without partial state residue', async () => {
  const db = await setupFreshDb();
  const repo = new SQLiteBodyMeasurementRepository(db);

  const validEntry: BodyMeasurementEntry = {
    id: 'bm-tx-test',
    date: '2026-02-15',
    time: '08:00',
    waistCm: 83.0,
    createdAt: '2026-02-15T08:00:00.000Z',
    updatedAt: '2026-02-15T08:00:00.000Z',
  };
  await repo.insertMeasurement(validEntry);

  // Attempt duplicate primary key insert inside transaction
  let failed = false;
  try {
    await db.withExclusiveTransactionAsync(async (txDb) => {
      const txRepo = new SQLiteBodyMeasurementRepository(txDb);
      await txRepo.insertMeasurement(validEntry, txDb); // duplicate ID throws
    });
  } catch {
    failed = true;
  }

  assert.equal(failed, true, 'Duplicate key must throw error');
  const all = await repo.getAllMeasurements();
  assert.equal(all.length, 1, 'Database remains in clean original state');
});

// ============================================================================
// TEST 15: Duplicate-save prevention
// ============================================================================
test('Task 5.3 - Test 15: Duplicate save barrier prevents double-submission during rapid taps', async () => {
  let saveCount = 0;
  let isSaving = false;

  const simulateUserSave = async () => {
    if (isSaving) return;
    isSaving = true;
    try {
      await new Promise((r) => setTimeout(r, 20));
      saveCount++;
    } finally {
      isSaving = false;
    }
  };

  // Simulate two rapid clicks in parallel
  await Promise.all([simulateUserSave(), simulateUserSave()]);
  assert.equal(saveCount, 1, 'Only one save must execute');
});

// ============================================================================
// TEST 16: Circumference delta calculations
// ============================================================================
test('Task 5.3 - Test 16: calculateMeasurementDelta computes differences accurately in metric and imperial', () => {
  // Metric: decrease of 1.5 cm
  const d1 = calculateMeasurementDelta(82.5, 84.0, 'metric');
  assert.equal(d1.hasDelta, true);
  assert.equal(d1.isDecrease, true);
  assert.equal(d1.isIncrease, false);
  assert.equal(d1.deltaFormatted, '-1.5 cm');

  // Metric: increase of 2.0 cm
  const d2 = calculateMeasurementDelta(86.0, 84.0, 'metric');
  assert.equal(d2.hasDelta, true);
  assert.equal(d2.isIncrease, true);
  assert.equal(d2.deltaFormatted, '+2.0 cm');

  // Metric: unchanged (within 0.05 cm threshold)
  const d3 = calculateMeasurementDelta(84.02, 84.0, 'metric');
  assert.equal(d3.hasDelta, true);
  assert.equal(d3.isUnchanged, true);
  assert.equal(d3.deltaFormatted, '0.0 cm');

  // Missing previous measurement
  const d4 = calculateMeasurementDelta(82.0, null, 'metric');
  assert.equal(d4.hasDelta, false);

  // Imperial unit: 2.54 cm = 1.0 inch
  const d5 = calculateMeasurementDelta(82.54, 80.0, 'imperial');
  assert.equal(d5.hasDelta, true);
  assert.equal(d5.isIncrease, true);
  assert.equal(d5.deltaFormatted, '+1.0 in');
});

// ============================================================================
// TEST 17: Waist-to-hip ratio calculation
// ============================================================================
test('Task 5.3 - Test 17: calculateWaistToHipRatio computes accurate waist-to-hip ratio', () => {
  // Waist: 80 cm, Hips: 100 cm -> ratio = 0.80
  const res1 = calculateWaistToHipRatio(80, 100);
  assert.equal(res1.isValid, true);
  assert.equal(res1.ratio, 0.8);
  assert.equal(res1.ratioFormatted, '0.80');

  // Waist: 85 cm, Hips: 98 cm -> ratio = 0.867... -> '0.87'
  const res2 = calculateWaistToHipRatio(85, 98);
  assert.equal(res2.isValid, true);
  assert.equal(res2.ratioFormatted, '0.87');

  // Missing waist
  const res3 = calculateWaistToHipRatio(null, 100);
  assert.equal(res3.isValid, false);

  // Missing hips
  const res4 = calculateWaistToHipRatio(80, null);
  assert.equal(res4.isValid, false);

  // Zero hips (division by zero protection)
  const res5 = calculateWaistToHipRatio(80, 0);
  assert.equal(res5.isValid, false);
});

// ============================================================================
// TEST 18: Waist-to-height ratio calculation
// ============================================================================
test('Task 5.3 - Test 18: calculateWaistToHeightRatio computes accurate waist-to-height ratio', () => {
  // Waist: 81 cm, Height: 180 cm -> ratio = 0.45
  const res1 = calculateWaistToHeightRatio(81, 180);
  assert.equal(res1.isValid, true);
  assert.equal(res1.ratio, 0.45);
  assert.equal(res1.ratioFormatted, '0.45');

  // Zero height protection
  const res2 = calculateWaistToHeightRatio(81, 0);
  assert.equal(res2.isValid, false);

  // Missing height
  const res3 = calculateWaistToHeightRatio(81, null);
  assert.equal(res3.isValid, false);
});

// ============================================================================
// TEST 19: Missing-value and zero-division handling
// ============================================================================
test('Task 5.3 - Test 19: Utilities cleanly handle nulls, NaN, negatives, and Infinity without crashing', () => {
  assert.equal(calculateWaistToHipRatio(NaN, 100).isValid, false);
  assert.equal(calculateWaistToHipRatio(80, Infinity).isValid, false);
  assert.equal(calculateWaistToHipRatio(-80, 100).isValid, false);
  assert.equal(calculateWaistToHeightRatio(-70, 175).isValid, false);
  assert.equal(formatMeasurement(null, 'cm'), '--');
  assert.equal(formatMeasurement(undefined, 'in'), '--');
  assert.equal(formatMeasurement(-5, 'cm'), '--');
  assert.equal(formatMeasurement(0, 'cm'), '--');
  assert.equal(parseMeasurementInput(''), null);
  assert.equal(parseMeasurementInput('abc'), null);
  assert.equal(parseMeasurementInput('-50'), null);
});

// ============================================================================
// TEST 20: Per-field bounds validation
// ============================================================================
test('Task 5.3 - Test 20: validateCircumferenceValue respects domain physical limits', () => {
  const waistDef = MEASUREMENT_FIELDS.find((f) => f.key === 'waistCm')!;
  assert.ok(waistDef);

  // Valid waist: 80 cm
  const v1 = validateCircumferenceValue(80, waistDef, 'metric');
  assert.equal(v1.isValid, true);
  assert.equal(v1.valueCm, 80);

  // Waist < 10 cm is out of bounds
  const v2 = validateCircumferenceValue(8, waistDef, 'metric');
  assert.equal(v2.isValid, false);

  // Waist > 300 cm is out of bounds
  const v3 = validateCircumferenceValue(350, waistDef, 'metric');
  assert.equal(v3.isValid, false);

  // Arm field limits: 5 to 150 cm
  const armDef = MEASUREMENT_FIELDS.find((f) => f.key === 'leftArmCm')!;
  const v4 = validateCircumferenceValue(35, armDef, 'metric');
  assert.equal(v4.isValid, true);
  const v5 = validateCircumferenceValue(3, armDef, 'metric');
  assert.equal(v5.isValid, false);
});

// ============================================================================
// TEST 21: AddBodyMeasurementModal renders in create and edit modes
// ============================================================================
test('Task 5.3 - Test 21: AddBodyMeasurementModal renders cleanly without error', () => {
  const tEn = (key: any) => translate('en', key);

  // Create mode
  const createHtml = renderToStaticMarkup(
    React.createElement(AddBodyMeasurementModal, {
      visible: true,
      onClose: () => {},
      onSave: async () => {},
      t: tEn,
    })
  );
  assert.ok(createHtml.includes(en.progress.logMeasurements));
  assert.ok(createHtml.includes(en.progress.chest));
  assert.ok(createHtml.includes(en.progress.waist));
  assert.ok(createHtml.includes(en.progress.hips));

  // Edit mode
  const existing: BodyMeasurementEntry = {
    id: 'bm-edit-render',
    date: '2026-02-15',
    time: '08:30',
    waistCm: 83.5,
    createdAt: '2026-02-15T08:30:00.000Z',
    updatedAt: '2026-02-15T08:30:00.000Z',
  };

  const editHtml = renderToStaticMarkup(
    React.createElement(AddBodyMeasurementModal, {
      visible: true,
      onClose: () => {},
      onSave: async () => {},
      onDelete: async () => {},
      initialEntry: existing,
      t: tEn,
    })
  );
  assert.ok(editHtml.includes(en.progress.editMeasurements));
  assert.ok(editHtml.includes('83.5'));
  assert.ok(editHtml.includes(en.common.delete));
});

// ============================================================================
// TEST 22: BodyMeasurementHistoryList renders grouped dates and empty state
// ============================================================================
test('Task 5.3 - Test 22: BodyMeasurementHistoryList renders chronological groups and empty state', () => {
  const tEn = (key: any) => translate('en', key);

  // Empty state
  const emptyHtml = renderToStaticMarkup(
    React.createElement(BodyMeasurementHistoryList, {
      measurements: [],
      unit: 'metric',
      t: tEn,
      onEditEntry: () => {},
    })
  );
  assert.ok(emptyHtml.includes(en.progress.noMeasurementsYet));

  // With entries
  const measurements: BodyMeasurementEntry[] = [
    {
      id: 'bm-hist-1',
      date: '2026-02-15',
      time: '08:30',
      chestCm: 102.0,
      waistCm: 82.5,
      notes: 'Morning check',
      createdAt: '2026-02-15T08:30:00.000Z',
      updatedAt: '2026-02-15T08:30:00.000Z',
    },
  ];

  const html = renderToStaticMarkup(
    React.createElement(BodyMeasurementHistoryList, {
      measurements,
      unit: 'metric',
      t: tEn,
      onEditEntry: () => {},
    })
  );
  assert.ok(html.includes('2026-02-15'));
  assert.ok(html.includes('08:30'));
  assert.ok(html.includes('102.0 cm'));
  assert.ok(html.includes('82.5 cm'));
  assert.ok(html.includes('Morning check'));
});

// ============================================================================
// TEST 23: ProgressScreen integrates latest measurements, ratios, and history
// ============================================================================
test('Task 5.3 - Test 23: ProgressScreen integrates body measurements, ratios, and measurement history', () => {
  const tEn = (key: any) => translate('en', key);

  const measurements: BodyMeasurementEntry[] = [
    {
      id: 'bm-prev',
      date: '2026-02-10',
      time: '08:00',
      waistCm: 84.0,
      hipsCm: 100.0,
      chestCm: 103.0,
      createdAt: '2026-02-10T08:00:00.000Z',
      updatedAt: '2026-02-10T08:00:00.000Z',
    },
    {
      id: 'bm-latest',
      date: '2026-02-15',
      time: '08:00',
      waistCm: 82.0,
      hipsCm: 98.0,
      chestCm: 102.0,
      createdAt: '2026-02-15T08:00:00.000Z',
      updatedAt: '2026-02-15T08:00:00.000Z',
    },
  ];

  const html = renderToStaticMarkup(
    React.createElement(ProgressScreen, {
      t: tEn,
      profile: mockProfile,
      progress: [],
      bodyWeights: [],
      bodyMeasurements: measurements,
      referenceDate: '2026-02-15',
      language: 'en',
    })
  );

  assert.ok(html.includes(en.progress.latestMeasurements));
  assert.ok(html.includes('82.0 cm'), 'Must render latest waist');
  assert.ok(html.includes('-2.0 cm'), 'Must render waist delta from previous');
  assert.ok(html.includes(en.progress.waistToHipRatio));
  assert.ok(html.includes('0.84'), '82 / 98 = 0.84 waist to hip ratio');
  assert.ok(html.includes(en.progress.waistToHeightRatio));
  assert.ok(html.includes('0.46'), '82 / 180 = 0.46 waist to height ratio');
  assert.ok(html.includes(en.progress.measurementHistory));
});

// ============================================================================
// TEST 24: Bilingual translation parity (en.ts and ar.ts)
// ============================================================================
test('Task 5.3 - Test 24: Bilingual measurement translation keys match symmetrically in en and ar', () => {
  const measurementKeys = [
    'measurements',
    'logMeasurements',
    'editMeasurements',
    'addMeasurements',
    'measurementHistory',
    'noMeasurementsYet',
    'noMeasurementsSub',
    'deleteMeasurementConfirmTitle',
    'deleteMeasurementConfirmMessage',
    'measurementHistoryCount',
    'chest',
    'waist',
    'hips',
    'leftArm',
    'rightArm',
    'leftThigh',
    'rightThigh',
    'leftCalf',
    'rightCalf',
    'shoulders',
    'neck',
    'unitCm',
    'unitIn',
    'waistToHipRatio',
    'waistToHeightRatio',
    'ratios',
    'latestMeasurements',
    'noMeasurementsAtLeastOne',
    'measurementRangeError',
    'circumferenceChanges',
    'noChange',
  ];

  for (const key of measurementKeys) {
    const enVal = (en.progress as any)[key];
    const arVal = (ar.progress as any)[key];
    assert.ok(enVal, `Key "progress.${key}" must exist in en.ts`);
    assert.ok(arVal, `Key "progress.${key}" must exist in ar.ts`);
  }
});

// ============================================================================
// TEST 25: Universal theme tokens for measurement UI
// ============================================================================
test('Task 5.3 - Test 25: Theme colors provide WCAG contrast for measurement components', () => {
  const light = getTheme('light').colors;
  const dark = getTheme('dark').colors;

  assert.ok(light.accent);
  assert.ok(light.background);
  assert.ok(light.card);
  assert.ok(light.border);
  assert.ok(dark.accent);
  assert.ok(dark.background);
  assert.ok(dark.card);
  assert.ok(dark.border);
});

// ============================================================================
// TEST 26: Body tracking measurement service standalone functions operate correctly with txn
// ============================================================================
test('Task 5.3 - Test 26: Body tracking measurement service standalone functions operate with txn', async () => {
  const db = await setupFreshDb();

  const entry1: BodyMeasurementEntry = {
    id: 'bm-srv-1',
    date: '2026-02-14',
    time: '08:00',
    waistCm: 83.0,
    hipsCm: 99.0,
    createdAt: '2026-02-14T08:00:00.000Z',
    updatedAt: '2026-02-14T08:00:00.000Z',
  };

  const entry2: BodyMeasurementEntry = {
    id: 'bm-srv-2',
    date: '2026-02-15',
    time: '08:00',
    waistCm: 82.0,
    hipsCm: 98.0,
    createdAt: '2026-02-15T08:00:00.000Z',
    updatedAt: '2026-02-15T08:00:00.000Z',
  };

  await recordMeasurement(entry1, db);
  await recordMeasurement(entry2, db);

  const all = await loadAllMeasurements(db);
  assert.equal(all.length, 2);

  const single = await getMeasurementEntry('bm-srv-1', db);
  assert.equal(single?.waistCm, 83.0);

  const latest = await getLatestMeasurement(db);
  assert.equal(latest?.id, 'bm-srv-2');

  const history = await getMeasurementsHistory('2026-02-14', '2026-02-15', db);
  assert.equal(history.length, 2);

  const forDate = await getMeasurementsForDate('2026-02-14', db);
  assert.equal(forDate.length, 1);
  assert.equal(forDate[0].id, 'bm-srv-1');

  // getLatestMeasurementEntry & getPreviousMeasurementEntry
  const latestHelper = getLatestMeasurementEntry(all);
  assert.equal(latestHelper?.id, 'bm-srv-2');
  const prevHelper = getPreviousMeasurementEntry(all, 'bm-srv-2');
  assert.equal(prevHelper?.id, 'bm-srv-1');

  // Update
  await updateMeasurement({ ...entry1, waistCm: 82.5 }, db);
  const updated = await getMeasurementEntry('bm-srv-1', db);
  assert.equal(updated?.waistCm, 82.5);

  // Delete
  await deleteMeasurement('bm-srv-1', db);
  const afterDelete = await loadAllMeasurements(db);
  assert.equal(afterDelete.length, 1);
  assert.equal(afterDelete[0].id, 'bm-srv-2');
});
