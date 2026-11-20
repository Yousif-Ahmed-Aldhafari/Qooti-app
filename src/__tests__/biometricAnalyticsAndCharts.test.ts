/**
 * Biometric Analytics, Moving Averages & Interactive Charting Test Suite
 * Phase 5 - Task 5.4
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  addDaysToDate,
  getTimeRangeStartDate,
  isDateInRange,
  filterWeightsByTimeRange,
  aggregateDailyWeights,
  calculate7DaySMA,
  calculate7DayEMA,
  computeWeightTrendSeries,
  calculateWeightAnalyticsSummary,
  filterMeasurementsByTimeRange,
  aggregateDailySiteMeasurements,
  calculateSiteMeasurementAnalyticsSummary,
} from '../utils/biometricAnalytics';
import { BodyWeightEntry, BodyMeasurementEntry } from '../models/biometrics';
import { WeightTrendChart } from '../components/WeightTrendChart';
import { BodyMeasurementTrendChart } from '../components/BodyMeasurementTrendChart';
import { ProgressScreen } from '../screens/ProgressScreen';
import { translate } from '../i18n';
import { UserProfile } from '../types';
import { en } from '../i18n/en';
import { ar } from '../i18n/ar';
import { getTheme } from '../theme/colors';

const tEn = (key: any, params?: any) => translate('en', key, params);
const tAr = (key: any, params?: any) => translate('ar', key, params);

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
// TEST 1: Weight series chronological normalization
// ============================================================================
test('Task 5.4 - Test 1: Weight series chronological normalization sorts ascending by calendar date', () => {
  const unsorted: BodyWeightEntry[] = [
    { id: 'w-3', date: '2026-02-15', time: '08:00', weightKg: 80.5, createdAt: '2026-02-15T08:00:00.000Z' },
    { id: 'w-1', date: '2026-02-01', time: '08:00', weightKg: 82.0, createdAt: '2026-02-01T08:00:00.000Z' },
    { id: 'w-2', date: '2026-02-10', time: '08:00', weightKg: 81.0, createdAt: '2026-02-10T08:00:00.000Z' },
  ];

  const daily = aggregateDailyWeights(unsorted, 'final');
  assert.equal(daily.length, 3);
  assert.equal(daily[0].date, '2026-02-01');
  assert.equal(daily[1].date, '2026-02-10');
  assert.equal(daily[2].date, '2026-02-15');
});

// ============================================================================
// TEST 2: Multiple weigh-ins on one date
// ============================================================================
test('Task 5.4 - Test 2: Multiple weigh-ins on one date orders descending by time and picks final', () => {
  const multipleSameDay: BodyWeightEntry[] = [
    { id: 'w-morning', date: '2026-02-15', time: '07:30', weightKg: 80.2, createdAt: '2026-02-15T07:30:00.000Z' },
    { id: 'w-evening', date: '2026-02-15', time: '19:45', weightKg: 81.1, createdAt: '2026-02-15T19:45:00.000Z' },
    { id: 'w-noon', date: '2026-02-15', time: '12:15', weightKg: 80.8, createdAt: '2026-02-15T12:15:00.000Z' },
  ];

  const daily = aggregateDailyWeights(multipleSameDay, 'final');
  assert.equal(daily.length, 1);
  assert.equal(daily[0].date, '2026-02-15');
  assert.equal(daily[0].observationCount, 3);
  assert.equal(daily[0].weightKg, 81.1, 'Must pick latest recorded weigh-in of the day');
  assert.equal(daily[0].latestTime, '19:45');
});

// ============================================================================
// TEST 3: Date-only legacy observations
// ============================================================================
test('Task 5.4 - Test 3: Date-only legacy observations flag isLegacyDateOnly and omit placeholder 12:00', () => {
  const legacyEntry: BodyWeightEntry[] = [
    { id: 'w-legacy-1', date: '2026-01-20', time: '12:00', weightKg: 83.5, createdAt: '2026-01-20T12:00:00.000Z' },
  ];

  const daily = aggregateDailyWeights(legacyEntry, 'final');
  assert.equal(daily.length, 1);
  assert.equal(daily[0].isLegacyDateOnly, true);
  assert.equal(daily[0].latestTime, undefined, 'Placeholder 12:00 must not be exposed as a genuine measurement time');
});

// ============================================================================
// TEST 4: Deterministic representative daily weight (final vs average policy)
// ============================================================================
test('Task 5.4 - Test 4: Deterministic representative daily weight supports final and average policies', () => {
  const entries: BodyWeightEntry[] = [
    { id: 'w-1', date: '2026-02-15', time: '08:00', weightKg: 80.0, createdAt: '2026-02-15T08:00:00.000Z' },
    { id: 'w-2', date: '2026-02-15', time: '20:00', weightKg: 82.0, createdAt: '2026-02-15T20:00:00.000Z' },
  ];

  const finalMode = aggregateDailyWeights(entries, 'final');
  assert.equal(finalMode[0].weightKg, 82.0);

  const avgMode = aggregateDailyWeights(entries, 'average');
  assert.equal(avgMode[0].weightKg, 81.0, '(80.0 + 82.0) / 2 = 81.0');
});

// ============================================================================
// TEST 5: SMA mathematical correctness
// ============================================================================
test('Task 5.4 - Test 5: 7-day Simple Moving Average (SMA) mathematical correctness', () => {
  // 7 consecutive daily observations of 80, 81, 82, 83, 84, 85, 86
  const entries: BodyWeightEntry[] = [];
  for (let i = 0; i < 7; i++) {
    const day = String(i + 1).padStart(2, '0');
    entries.push({
      id: `w-${i}`,
      date: `2026-02-${day}`,
      time: '08:00',
      weightKg: 80 + i,
      createdAt: `2026-02-${day}T08:00:00.000Z`,
    });
  }

  const daily = aggregateDailyWeights(entries, 'final');
  const sma = calculate7DaySMA(daily);

  // Day 1: only [80] -> 80
  assert.equal(sma[0], 80.0);
  // Day 2: [80, 81] -> 80.5
  assert.equal(sma[1], 80.5);
  // Day 7: [80, 81, 82, 83, 84, 85, 86] -> sum = 581 / 7 = 83.0
  assert.equal(sma[6], 83.0);
});

// ============================================================================
// TEST 6: EMA mathematical correctness
// ============================================================================
test('Task 5.4 - Test 6: 7-day Exponential Moving Average (EMA) mathematical correctness', () => {
  // 2 consecutive days: Day 1 = 80, Day 2 = 84
  const entries: BodyWeightEntry[] = [
    { id: 'w-1', date: '2026-02-01', time: '08:00', weightKg: 80.0, createdAt: '2026-02-01T08:00:00.000Z' },
    { id: 'w-2', date: '2026-02-02', time: '08:00', weightKg: 84.0, createdAt: '2026-02-02T08:00:00.000Z' },
  ];

  const daily = aggregateDailyWeights(entries, 'final');
  const ema = calculate7DayEMA(daily);

  // EMA_0 = 80.0
  assert.equal(ema[0], 80.0);
  // dt = 1, alpha = 0.25 -> EMA_1 = 80.0 + 0.25 * (84.0 - 80.0) = 81.0
  assert.equal(ema[1], 81.0);
});

// ============================================================================
// TEST 7: EMA initialization
// ============================================================================
test('Task 5.4 - Test 7: EMA initializes exactly to the first genuine observation weight', () => {
  const entries: BodyWeightEntry[] = [
    { id: 'w-init', date: '2026-02-01', time: '08:00', weightKg: 77.3, createdAt: '2026-02-01T08:00:00.000Z' },
  ];

  const daily = aggregateDailyWeights(entries, 'final');
  const ema = calculate7DayEMA(daily);
  assert.equal(ema[0], 77.3);
});

// ============================================================================
// TEST 8: Sparse calendar observations
// ============================================================================
test('Task 5.4 - Test 8: Sparse calendar observations apply calendar decay without crashing', () => {
  // Day 1: 2026-02-01 weight 80.0
  // Day 2: 2026-02-21 (20 days later) weight 90.0
  const entries: BodyWeightEntry[] = [
    { id: 'w-1', date: '2026-02-01', time: '08:00', weightKg: 80.0, createdAt: '2026-02-01T08:00:00.000Z' },
    { id: 'w-2', date: '2026-02-21', time: '08:00', weightKg: 90.0, createdAt: '2026-02-21T08:00:00.000Z' },
  ];

  const daily = aggregateDailyWeights(entries, 'final');
  const ema = calculate7DayEMA(daily);
  assert.equal(ema[0], 80.0);
  // After 20 days, alpha_dt = 1 - (0.75)^20 = 0.9968 -> EMA closely tracks new weight (approx 89.97)
  assert.ok(ema[1]! > 89.5, 'EMA must decay towards new weight after a long gap');
});

// ============================================================================
// TEST 9: No interpolation into missing days
// ============================================================================
test('Task 5.4 - Test 9: No synthetic data points are interpolated into unmeasured calendar days', () => {
  const entries: BodyWeightEntry[] = [
    { id: 'w-1', date: '2026-02-01', time: '08:00', weightKg: 80.0, createdAt: '2026-02-01T08:00:00.000Z' },
    { id: 'w-2', date: '2026-02-15', time: '08:00', weightKg: 82.0, createdAt: '2026-02-15T08:00:00.000Z' },
  ];

  const daily = aggregateDailyWeights(entries, 'final');
  assert.equal(daily.length, 2, 'Must contain exactly 2 points, zero synthetic intermediate points');

  const trend = computeWeightTrendSeries(daily);
  assert.equal(trend.length, 2);
  assert.equal(trend[0].date, '2026-02-01');
  assert.equal(trend[1].date, '2026-02-15');
});

// ============================================================================
// TEST 10: Empty and single-entry states
// ============================================================================
test('Task 5.4 - Test 10: Empty and single-entry datasets handle gracefully without division by zero', () => {
  const emptySummary = calculateWeightAnalyticsSummary([], '30d', '2026-02-15', 'metric', 75);
  assert.equal(emptySummary.isEmpty, true);
  assert.equal(emptySummary.hasEnoughDataForTrend, false);
  assert.equal(emptySummary.observationCount, 0);

  const singleEntry: BodyWeightEntry[] = [
    { id: 'w-single', date: '2026-02-15', time: '08:00', weightKg: 80.0, createdAt: '2026-02-15T08:00:00.000Z' },
  ];
  const singleSummary = calculateWeightAnalyticsSummary(singleEntry, '30d', '2026-02-15', 'metric', 75);
  assert.equal(singleSummary.isEmpty, false);
  assert.equal(singleSummary.hasEnoughDataForTrend, false, 'Single point does not have enough data for a multi-point trend');
  assert.equal(singleSummary.netChangeKg, 0.0);
  assert.equal(singleSummary.weeklyRateKg, undefined);
  assert.equal(singleSummary.currentWeightKg, 80.0);
});

// ============================================================================
// TEST 11: Seven-day filtering
// ============================================================================
test('Task 5.4 - Test 11: 7-day range filter isolates exactly today and previous 6 days', () => {
  const refDate = '2026-02-15';
  const startDate = getTimeRangeStartDate('7d', refDate);
  assert.equal(startDate, '2026-02-09'); // 9, 10, 11, 12, 13, 14, 15 = 7 days

  const entries: BodyWeightEntry[] = [
    { id: 'w-in', date: '2026-02-09', time: '08:00', weightKg: 80.0, createdAt: '2026-02-09T08:00:00.000Z' },
    { id: 'w-out', date: '2026-02-08', time: '08:00', weightKg: 80.5, createdAt: '2026-02-08T08:00:00.000Z' },
  ];

  const filtered = filterWeightsByTimeRange(entries, '7d', refDate);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, 'w-in');
});

// ============================================================================
// TEST 12: Thirty-day filtering
// ============================================================================
test('Task 5.4 - Test 12: 30-day range filter isolates exactly 30 calendar days inclusive', () => {
  const refDate = '2026-02-15';
  const startDate = getTimeRangeStartDate('30d', refDate);
  assert.equal(startDate, '2026-01-17'); // 17 to 31 Jan (15 days) + 1 to 15 Feb (15 days) = 30 days
});

// ============================================================================
// TEST 13: Ninety-day filtering
// ============================================================================
test('Task 5.4 - Test 13: 90-day range filter calculates boundary correctly across year boundaries', () => {
  const refDate = '2026-01-15';
  const startDate = getTimeRangeStartDate('90d', refDate);
  assert.equal(startDate, '2025-10-18');
});

// ============================================================================
// TEST 14: One-year and all-time filtering
// ============================================================================
test('Task 5.4 - Test 14: 1-year and all-time range filtering boundaries', () => {
  const refDate = '2026-02-15';
  const startDate1y = getTimeRangeStartDate('1y', refDate);
  assert.equal(startDate1y, '2025-02-16');

  const startDateAll = getTimeRangeStartDate('all', refDate);
  assert.equal(startDateAll, null, 'All-time start date must be unbounded null');
});

// ============================================================================
// TEST 15: Leap-year boundaries
// ============================================================================
test('Task 5.4 - Test 15: Leap-year date arithmetic respects February 29th', () => {
  // 2024 is a leap year
  const feb28 = '2024-02-28';
  const nextDay = addDaysToDate(feb28, 1);
  assert.equal(nextDay, '2024-02-29', '2024-02-28 + 1 day must equal 2024-02-29');

  const march1 = addDaysToDate(nextDay, 1);
  assert.equal(march1, '2024-03-01');

  // 2025 is not a leap year
  const nonLeapFeb28 = '2025-02-28';
  assert.equal(addDaysToDate(nonLeapFeb28, 1), '2025-03-01');
});

// ============================================================================
// TEST 16: Daylight-saving and timezone boundaries
// ============================================================================
test('Task 5.4 - Test 16: UTC date math is immune to local daylight-saving transitions', () => {
  // DST transition in US is mid-March
  const dstStart = '2026-03-07';
  const afterDst = addDaysToDate(dstStart, 2);
  assert.equal(afterDst, '2026-03-09');
});

// ============================================================================
// TEST 17: Future-dated observation handling
// ============================================================================
test('Task 5.4 - Test 17: Future-dated entries are excluded from period analysis', () => {
  const refDate = '2026-02-15';
  const entries: BodyWeightEntry[] = [
    { id: 'w-today', date: '2026-02-15', time: '08:00', weightKg: 80.0, createdAt: '2026-02-15T08:00:00.000Z' },
    { id: 'w-future', date: '2026-02-20', time: '08:00', weightKg: 85.0, createdAt: '2026-02-20T08:00:00.000Z' },
  ];

  const filtered = filterWeightsByTimeRange(entries, '30d', refDate);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, 'w-today');
});

// ============================================================================
// TEST 18: Weekly weight-change rate
// ============================================================================
test('Task 5.4 - Test 18: Weekly weight-change rate in kg/week computed accurately', () => {
  // Lost 2.0 kg across 14 days = -1.0 kg/week
  const entries: BodyWeightEntry[] = [
    { id: 'w-1', date: '2026-02-01', time: '08:00', weightKg: 82.0, createdAt: '2026-02-01T08:00:00.000Z' },
    { id: 'w-2', date: '2026-02-15', time: '08:00', weightKg: 80.0, createdAt: '2026-02-15T08:00:00.000Z' },
  ];

  const summary = calculateWeightAnalyticsSummary(entries, '30d', '2026-02-15', 'metric', 75);
  assert.equal(summary.netChangeKg, -2.0);
  assert.equal(summary.weeklyRateKg, -1.0);
  assert.equal(summary.weeklyRateFormatted, '-1.0 kg/wk');
});

// ============================================================================
// TEST 19: Goal-weight comparison
// ============================================================================
test('Task 5.4 - Test 19: Goal weight comparison correctly computes distance and goal completion', () => {
  const entries: BodyWeightEntry[] = [
    { id: 'w-1', date: '2026-02-15', time: '08:00', weightKg: 75.1, createdAt: '2026-02-15T08:00:00.000Z' },
  ];

  // Within 0.2kg of target 75.0kg -> goal reached
  const summary = calculateWeightAnalyticsSummary(entries, '30d', '2026-02-15', 'metric', 75.0);
  assert.equal(summary.isGoalReached, true);
  assert.equal(summary.distanceToGoalKg, 0.1);
});

// ============================================================================
// TEST 20: cm/in and kg/lb display conversions
// ============================================================================
test('Task 5.4 - Test 20: Display unit conversions preserve canonical database precision without drift', () => {
  const entries: BodyWeightEntry[] = [
    { id: 'w-1', date: '2026-02-01', time: '08:00', weightKg: 80.0, createdAt: '2026-02-01T08:00:00.000Z' },
    { id: 'w-2', date: '2026-02-15', time: '08:00', weightKg: 78.0, createdAt: '2026-02-15T08:00:00.000Z' },
  ];

  const imperialSummary = calculateWeightAnalyticsSummary(entries, '30d', '2026-02-15', 'imperial', 75.0);
  assert.equal(imperialSummary.netChangeKg, -2.0, 'Canonical kg must remain unmodified');
  assert.ok(imperialSummary.netChangeFormatted?.includes('lb'));
  assert.ok(imperialSummary.weeklyRateFormatted?.includes('lb/wk'));
});

// ============================================================================
// TEST 21: Partial circumference history & filtering
// ============================================================================
test('Task 5.4 - Test 21: Partial records never insert zero points for unmeasured sites', () => {
  assert.equal(isDateInRange('2026-02-10', '2026-02-01', '2026-02-15'), true);
  assert.equal(isDateInRange('2026-01-20', '2026-02-01', '2026-02-15'), false);
  assert.equal(isDateInRange('2026-02-20', '2026-02-01', '2026-02-15'), false); // Future date

  const entries: BodyMeasurementEntry[] = [
    { id: 'bm-1', date: '2026-02-10', time: '08:00', waistCm: 84.0, hipsCm: null, createdAt: '2026-02-10T08:00:00.000Z' },
    { id: 'bm-2', date: '2026-02-15', time: '08:00', waistCm: null, hipsCm: 100.0, createdAt: '2026-02-15T08:00:00.000Z' },
  ];

  const filtered = filterMeasurementsByTimeRange(entries, '30d', '2026-02-15');
  assert.equal(filtered.length, 2);

  const waistPoints = aggregateDailySiteMeasurements(entries, 'waistCm', '2026-02-15');
  assert.equal(waistPoints.length, 1);
  assert.equal(waistPoints[0].date, '2026-02-10');
  assert.equal(waistPoints[0].valueCm, 84.0);

  const hipsPoints = aggregateDailySiteMeasurements(entries, 'hipsCm', '2026-02-15');
  assert.equal(hipsPoints.length, 1);
  assert.equal(hipsPoints[0].date, '2026-02-15');
  assert.equal(hipsPoints[0].valueCm, 100.0);
});

// ============================================================================
// TEST 22: Site-specific measurement charts
// ============================================================================
test('Task 5.4 - Test 22: Site-specific measurement chart computes start, latest and net change', () => {
  const entries: BodyMeasurementEntry[] = [
    { id: 'bm-1', date: '2026-02-01', time: '08:00', waistCm: 86.0, createdAt: '2026-02-01T08:00:00.000Z' },
    { id: 'bm-2', date: '2026-02-15', time: '08:00', waistCm: 83.5, createdAt: '2026-02-15T08:00:00.000Z' },
  ];

  const summary = calculateSiteMeasurementAnalyticsSummary(entries, 'waistCm', '30d', '2026-02-15', 'metric');
  assert.equal(summary.startValueCm, 86.0);
  assert.equal(summary.latestValueCm, 83.5);
  assert.equal(summary.netChangeCm, -2.5);
  assert.equal(summary.netChangeFormatted, '-2.5 cm');
  assert.equal(summary.hasEnoughDataForTrend, true);
});

// ============================================================================
// TEST 23: Multiple same-day circumference records
// ============================================================================
test('Task 5.4 - Test 23: Multiple same-day circumferences aggregate to final recorded measurement', () => {
  const entries: BodyMeasurementEntry[] = [
    { id: 'bm-morning', date: '2026-02-15', time: '08:00', waistCm: 84.0, createdAt: '2026-02-15T08:00:00.000Z' },
    { id: 'bm-evening', date: '2026-02-15', time: '20:00', waistCm: 85.0, createdAt: '2026-02-15T20:00:00.000Z' },
  ];

  const points = aggregateDailySiteMeasurements(entries, 'waistCm', '2026-02-15');
  assert.equal(points.length, 1);
  assert.equal(points[0].valueCm, 85.0, 'Must pick final recorded reading of the day');
  assert.equal(points[0].observationCount, 2);
});

// ============================================================================
// TEST 24: TalkBack/VoiceOver chart summaries
// ============================================================================
test('Task 5.4 - Test 24: WeightTrendChart and BodyMeasurementTrendChart provide accessible summaries', () => {
  const dailyPoints = [
    { date: '2026-02-01', weightKg: 82.0, observationCount: 1, entries: [] },
    { date: '2026-02-15', weightKg: 80.0, observationCount: 1, entries: [] },
  ];
  const trend = computeWeightTrendSeries(dailyPoints);

  const chartElement = React.createElement(WeightTrendChart, {
    dailyPoints,
    trendSeries: trend,
    unit: 'metric',
    movingAverage: 'none',
    goalWeightKg: 75.0,
    t: tEn,
  });

  const html = renderToStaticMarkup(chartElement);

  assert.ok(html.includes('80.0 kg'), 'Must render latest weight');
  assert.ok(html.includes('2026-02-01'), 'Must render start observation date');
  assert.ok(html.includes('2026-02-15'), 'Must render latest observation date');

  // Test BodyMeasurementTrendChart render
  const measEntries: BodyMeasurementEntry[] = [
    { id: 'bm-1', date: '2026-02-01', time: '08:00', waistCm: 84.0, createdAt: '2026-02-01T08:00:00.000Z' },
    { id: 'bm-2', date: '2026-02-15', time: '08:00', waistCm: 81.5, createdAt: '2026-02-15T08:00:00.000Z' },
  ];
  const measSummary = calculateSiteMeasurementAnalyticsSummary(measEntries, 'waistCm', '30d', '2026-02-15', 'metric');

  const measChartElement = React.createElement(BodyMeasurementTrendChart, {
    summary: measSummary,
    selectedSite: 'waistCm',
    onSelectSite: () => {},
    unit: 'metric',
    t: tEn,
  });

  const measHtml = renderToStaticMarkup(measChartElement);
  assert.ok(measHtml.includes('81.5 cm'), 'Must render latest waist value');
  assert.ok(measHtml.includes('-2.5 cm'), 'Must render net change');
});

// ============================================================================
// TEST 25: Arabic RTL localization
// ============================================================================
test('Task 5.4 - Test 25: Arabic localization keys match English symmetrically', () => {
  assert.ok(en.progress.weightAnalytics);
  assert.ok(ar.progress.weightAnalytics);
  assert.ok(en.progress.range7d);
  assert.ok(ar.progress.range7d);
  assert.ok(en.progress.sma7);
  assert.ok(ar.progress.sma7);
  assert.ok(en.progress.ema7);
  assert.ok(ar.progress.ema7);
  assert.ok(en.progress.measurementTrend);
  assert.ok(ar.progress.measurementTrend);
  assert.ok(en.progress.waistAndHipsDisclosure);
  assert.ok(ar.progress.waistAndHipsDisclosure);

  // Arabic translation of waist/hips disclosure replaces variables correctly
  const arDisclosure = tAr('progress.waistAndHipsDisclosure', {
    waistDate: '2026-02-15',
    hipsDate: '2026-02-10',
  });
  assert.ok(arDisclosure.includes('2026-02-15'));
  assert.ok(arDisclosure.includes('2026-02-10'));
});

// ============================================================================
// TEST 26: Theme rendering
// ============================================================================
test('Task 5.4 - Test 26: Light and dark themes provide compliant tokens for charts', () => {
  const light = getTheme('light').colors;
  const dark = getTheme('dark').colors;

  assert.ok(light.purple);
  assert.ok(dark.purple);
  assert.ok(light.lavender);
  assert.ok(dark.lavender);
  assert.ok(light.accent);
  assert.ok(dark.accent);
});

// ============================================================================
// TEST 27: ProgressScreen integrates analytics without regressions
// ============================================================================
test('Task 5.4 - Test 27: ProgressScreen integrates weight analytics and measurement trend without crashing', () => {
  const weights: BodyWeightEntry[] = [
    { id: 'w-1', date: '2026-02-01', time: '08:00', weightKg: 82.0, createdAt: '2026-02-01T08:00:00.000Z' },
    { id: 'w-2', date: '2026-02-15', time: '08:00', weightKg: 80.0, createdAt: '2026-02-15T08:00:00.000Z' },
  ];
  const measurements: BodyMeasurementEntry[] = [
    { id: 'bm-1', date: '2026-02-01', time: '08:00', waistCm: 85.0, createdAt: '2026-02-01T08:00:00.000Z' },
    { id: 'bm-2', date: '2026-02-15', time: '08:00', waistCm: 83.0, createdAt: '2026-02-15T08:00:00.000Z' },
  ];

  const html = renderToStaticMarkup(
    React.createElement(ProgressScreen, {
      t: tEn,
      profile: mockProfile,
      progress: [],
      bodyWeights: weights,
      bodyMeasurements: measurements,
      referenceDate: '2026-02-15',
      language: 'en',
    })
  );

  assert.ok(html.includes(en.progress.weightAnalytics), 'Must render weight analytics header');
  assert.ok(html.includes(en.progress.measurementTrend), 'Must render measurement trend header');
  assert.ok(html.includes(en.progress.netChange), 'Must render net change label');
  assert.ok(html.includes('-2.0 kg'), 'Must render net change value');
});
