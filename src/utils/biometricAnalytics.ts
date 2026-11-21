/**
 * Pure Biometric Analytics, Moving Averages & Time-Series Engine
 * Phase 5 - Task 5.4
 *
 * Implements descriptive fitness analytics for body weight and circumferences.
 * Strictly avoids medical diagnosis or destructive rounding.
 */

import type { BodyWeightEntry, BodyMeasurementEntry } from '../models/biometrics';
import { hasExactTime } from '../models/biometrics';
import type { MeasurementUnits } from '../models/settings';
import { getDaysBetweenDates, cmToInch, MeasurementFieldKey } from './measurements';
import { kgToLb, compareBodyWeightsDescending } from './weight';

export type AnalyticsTimeRange = '7d' | '30d' | '90d' | '1y' | 'all';

export type MovingAverageType = 'none' | 'sma' | 'ema';

export type DailyWeightAggregationMode = 'final' | 'average';

export const CHART_GAP_THRESHOLD_DAYS = 14;

/**
 * Builds an SVG path string from points with calendar gap segmentation.
 * When calendar days between consecutive points exceeds `gapThresholdDays` (default 14),
 * a new subpath (`M`) is started rather than connecting them with a line (`L`).
 * This prevents misleading visual interpolation across prolonged logging gaps.
 */
export function buildSegmentedPath(
  points: { x: number; y: number; date: string }[],
  gapThresholdDays: number = CHART_GAP_THRESHOLD_DAYS
): string {
  if (!points || points.length === 0) return '';
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const gap = getDaysBetweenDates(points[i - 1].date, points[i].date);
    if (gap > gapThresholdDays) {
      path += ` M ${points[i].x} ${points[i].y}`;
    } else {
      path += ` L ${points[i].x} ${points[i].y}`;
    }
  }
  return path;
}

/**
 * Adds or subtracts calendar days from an ISO date string (YYYY-MM-DD).
 * Uses UTC to ensure timezone neutrality and leap-year/month-boundary correctness.
 */
export function addDaysToDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculates the inclusive lower boundary date for a given time range.
 * Relative to an injectable reference date (defaults to local today).
 * For 'all', returns null (unbounded start).
 */
export function getTimeRangeStartDate(
  range: AnalyticsTimeRange,
  referenceDate: string
): string | null {
  switch (range) {
    case '7d':
      // 7 calendar days inclusive (referenceDate minus 6 days)
      return addDaysToDate(referenceDate, -6);
    case '30d':
      // 30 calendar days inclusive
      return addDaysToDate(referenceDate, -29);
    case '90d':
      // 90 calendar days inclusive
      return addDaysToDate(referenceDate, -89);
    case '1y':
      // 365 calendar days inclusive
      return addDaysToDate(referenceDate, -364);
    case 'all':
    default:
      return null;
  }
}

/**
 * Checks if a date falls between startDate (if defined) and referenceDate inclusive.
 * Rejects future dates relative to referenceDate.
 */
export function isDateInRange(
  dateStr: string,
  startDate: string | null,
  referenceDate: string
): boolean {
  if (dateStr > referenceDate) {
    return false; // Future-dated entries are excluded from historical period trends
  }
  if (startDate != null && dateStr < startDate) {
    return false;
  }
  return true;
}

/**
 * Filters body weight entries strictly within the requested time range.
 */
export function filterWeightsByTimeRange(
  entries: BodyWeightEntry[],
  range: AnalyticsTimeRange,
  referenceDate: string
): BodyWeightEntry[] {
  if (!entries || entries.length === 0) return [];
  const startDate = getTimeRangeStartDate(range, referenceDate);
  return entries.filter((e) => isDateInRange(e.date, startDate, referenceDate));
}

export interface DailyWeightPoint {
  date: string;
  weightKg: number;
  observationCount: number;
  latestTime?: string;
  isLegacyDateOnly?: boolean;
  entries: BodyWeightEntry[];
}

/**
 * Aggregates multiple weigh-ins on the same day into a deterministic daily point.
 * Aggregation policy:
 * - 'final' (default): Uses the chronologically latest recorded measurement of that day.
 * - 'average': Uses the arithmetic mean of all valid readings on that day.
 * - For date-only legacy records, marks `isLegacyDateOnly: true` (placeholder 12:00 is not treated as genuine).
 * Returns array sorted chronologically ascending (oldest to newest) for charting.
 */
export function aggregateDailyWeights(
  entries: BodyWeightEntry[],
  mode: DailyWeightAggregationMode = 'final',
  referenceDate?: string
): DailyWeightPoint[] {
  if (!entries || entries.length === 0) return [];

  // Group by calendar date
  const groups = new Map<string, BodyWeightEntry[]>();
  for (const entry of entries) {
    if (!entry.weightKg || !Number.isFinite(entry.weightKg) || entry.weightKg <= 0) {
      continue;
    }
    if (referenceDate && entry.date > referenceDate) {
      continue; // Exclude future-dated entries
    }
    const list = groups.get(entry.date) || [];
    list.push(entry);
    groups.set(entry.date, list);
  }

  const result: DailyWeightPoint[] = [];

  for (const [date, dayEntries] of groups.entries()) {
    // Sort day's entries descending according to the canonical precision-aware comparator.
    // Prioritizes known observation times (timePrecision !== 'date_only') over placeholder 12:00,
    // and breaks ties deterministically by createdAt DESC, then id DESC.
    dayEntries.sort(compareBodyWeightsDescending);

    const representative = dayEntries[0];
    const isLegacy = !hasExactTime(representative);

    let weightKg: number;
    if (mode === 'average') {
      const sum = dayEntries.reduce((acc, curr) => acc + curr.weightKg, 0);
      weightKg = sum / dayEntries.length;
    } else {
      // Default: representative weigh-in of the day
      weightKg = representative.weightKg;
    }

    result.push({
      date,
      weightKg,
      observationCount: dayEntries.length,
      latestTime: isLegacy ? undefined : representative.time,
      isLegacyDateOnly: isLegacy,
      entries: dayEntries,
    });
  }

  // Sort ascending by date for chronological progression
  result.sort((a, b) => a.date.localeCompare(b.date));
  return result;
}

export interface TrendSeriesPoint {
  date: string;
  weightKg: number; // Measured daily weight (canonical)
  sma7Kg?: number;  // 7-day Simple Moving Average
  ema7Kg?: number;  // 7-day Exponential Moving Average
}

/**
 * Computes 7-Day Simple Moving Average (SMA).
 * Mathematical definition:
 * For each recorded observation at date D_i, averages all recorded daily weights in the
 * 7-day calendar window [D_i - 6 days, D_i].
 * Uses actual recorded observations ONLY — never interpolates or fabricates missing days.
 */
export function calculate7DaySMA(
  dailyPoints: DailyWeightPoint[]
): (number | undefined)[] {
  if (!dailyPoints || dailyPoints.length === 0) return [];

  return dailyPoints.map((point) => {
    const windowStart = addDaysToDate(point.date, -6);
    const windowPoints = dailyPoints.filter(
      (p) => p.date >= windowStart && p.date <= point.date
    );

    if (windowPoints.length === 0) return undefined;
    const sum = windowPoints.reduce((acc, p) => acc + p.weightKg, 0);
    const avg = sum / windowPoints.length;
    return avg;
  });
}

/**
 * Computes 7-Day Exponential Moving Average (EMA).
 * Mathematical definition:
 * - Smoothing parameter alpha for N=7: alpha = 2 / (N + 1) = 0.25.
 * - Initialization: EMA_0 = Weight_0.
 * - Calendar gap adjustment:
 *   When observations are sparse (daysBetween > 1), time-decay is applied:
 *   alpha_dt = 1 - (1 - alpha)^dt.
 *   EMA_k = EMA_{k-1} + alpha_dt * (Weight_k - EMA_{k-1}).
 * Uses actual recorded observations ONLY — never interpolates missing days.
 * Retains full floating-point precision throughout.
 */
export function calculate7DayEMA(
  dailyPoints: DailyWeightPoint[]
): (number | undefined)[] {
  if (!dailyPoints || dailyPoints.length === 0) return [];

  const baseAlpha = 2 / (7 + 1); // 0.25
  const result: number[] = [];

  let currentEma = dailyPoints[0].weightKg;
  result.push(currentEma);

  for (let i = 1; i < dailyPoints.length; i++) {
    const prevDate = dailyPoints[i - 1].date;
    const currDate = dailyPoints[i].date;
    const dt = Math.max(getDaysBetweenDates(prevDate, currDate), 1);

    // Adjusted alpha accounting for elapsed calendar days
    const alphaDt = 1 - Math.pow(1 - baseAlpha, dt);
    currentEma = currentEma + alphaDt * (dailyPoints[i].weightKg - currentEma);
    result.push(currentEma);
  }

  return result;
}

/**
 * Computes the complete chronological trend series with measured weights and optional SMA/EMA.
 */
export function computeWeightTrendSeries(
  dailyPoints: DailyWeightPoint[]
): TrendSeriesPoint[] {
  if (!dailyPoints || dailyPoints.length === 0) return [];

  const sma = calculate7DaySMA(dailyPoints);
  const ema = calculate7DayEMA(dailyPoints);

  return dailyPoints.map((point, index) => ({
    date: point.date,
    weightKg: point.weightKg,
    sma7Kg: sma[index],
    ema7Kg: ema[index],
  }));
}

export interface WeightAnalyticsSummary {
  timeRange: AnalyticsTimeRange;
  observationCount: number;
  dailyPointsCount: number;
  earliestDate?: string;
  latestDate?: string;
  startWeightKg?: number;
  currentWeightKg?: number;
  netChangeKg?: number;
  netChangeFormatted?: string;
  weeklyRateKg?: number;
  weeklyRateFormatted?: string;
  goalWeightKg?: number;
  distanceToGoalKg?: number;
  isGoalReached?: boolean;
  hasEnoughDataForTrend: boolean;
  isEmpty: boolean;
}

/**
 * Computes descriptive period analytics for body weight.
 * Handles single-entry, sparse data, and metric/imperial formatting cleanly.
 */
export function calculateWeightAnalyticsSummary(
  entries: BodyWeightEntry[],
  timeRange: AnalyticsTimeRange,
  referenceDate: string,
  unit: 'metric' | 'imperial' | MeasurementUnits,
  goalWeightKg?: number | null
): WeightAnalyticsSummary {
  const filtered = filterWeightsByTimeRange(entries, timeRange, referenceDate);
  const isInchOrLb = unit === 'imperial';
  const unitLabel = isInchOrLb ? 'lb' : 'kg';

  if (filtered.length === 0) {
    return {
      timeRange,
      observationCount: 0,
      dailyPointsCount: 0,
      hasEnoughDataForTrend: false,
      isEmpty: true,
      goalWeightKg: goalWeightKg ?? undefined,
    };
  }

  const dailyPoints = aggregateDailyWeights(filtered, 'final', referenceDate);
  const earliestPoint = dailyPoints[0];
  const latestPoint = dailyPoints[dailyPoints.length - 1];

  const startWeightKg = earliestPoint.weightKg;
  const currentWeightKg = latestPoint.weightKg;
  const netChangeKg = currentWeightKg - startWeightKg;

  // Format net change
  const netChangeVal = isInchOrLb ? kgToLb(netChangeKg) : netChangeKg;
  const absNet = Math.abs(netChangeVal);
  const sign = netChangeKg > 0.05 ? '+' : netChangeKg < -0.05 ? '-' : '';
  const netChangeFormatted =
    absNet <= 0.05 ? `0.0 ${unitLabel}` : `${sign}${absNet.toFixed(1)} ${unitLabel}`;

  // Weekly rate of change
  const daysDiff = getDaysBetweenDates(earliestPoint.date, latestPoint.date);
  let weeklyRateKg: number | undefined;
  let weeklyRateFormatted: string | undefined;

  if (daysDiff >= 1) {
    weeklyRateKg = (netChangeKg / daysDiff) * 7;
    const weeklyRateVal = isInchOrLb ? kgToLb(weeklyRateKg) : weeklyRateKg;
    const absRate = Math.abs(weeklyRateVal);
    const rateSign = weeklyRateKg > 0.05 ? '+' : weeklyRateKg < -0.05 ? '-' : '';
    weeklyRateFormatted =
      absRate <= 0.05 ? `0.0 ${unitLabel}/wk` : `${rateSign}${absRate.toFixed(1)} ${unitLabel}/wk`;
  }

  // Goal comparison
  let distanceToGoalKg: number | undefined;
  let isGoalReached: boolean | undefined;

  if (goalWeightKg != null && goalWeightKg > 0) {
    distanceToGoalKg = currentWeightKg - goalWeightKg;
    isGoalReached = Math.abs(distanceToGoalKg) <= 0.2;
  }

  return {
    timeRange,
    observationCount: filtered.length,
    dailyPointsCount: dailyPoints.length,
    earliestDate: earliestPoint.date,
    latestDate: latestPoint.date,
    startWeightKg,
    currentWeightKg,
    netChangeKg,
    netChangeFormatted,
    weeklyRateKg,
    weeklyRateFormatted,
    goalWeightKg: goalWeightKg ?? undefined,
    distanceToGoalKg,
    isGoalReached,
    hasEnoughDataForTrend: dailyPoints.length >= 2,
    isEmpty: false,
  };
}

// ============================================================================
// BODY MEASUREMENT ANALYTICS
// ============================================================================

export interface SiteMeasurementPoint {
  date: string;
  valueCm: number;
  time?: string;
  observationCount: number;
  entries: BodyMeasurementEntry[];
}

export interface SiteMeasurementAnalyticsSummary {
  siteKey: MeasurementFieldKey;
  timeRange: AnalyticsTimeRange;
  observationCount: number;
  earliestDate?: string;
  latestDate?: string;
  startValueCm?: number;
  latestValueCm?: number;
  netChangeCm?: number;
  netChangeFormatted?: string;
  points: SiteMeasurementPoint[];
  isEmpty: boolean;
  hasEnoughDataForTrend: boolean;
}

/**
 * Filters body measurement entries by time range.
 */
export function filterMeasurementsByTimeRange(
  entries: BodyMeasurementEntry[],
  range: AnalyticsTimeRange,
  referenceDate: string
): BodyMeasurementEntry[] {
  if (!entries || entries.length === 0) return [];
  const startDate = getTimeRangeStartDate(range, referenceDate);
  return entries.filter((e) => isDateInRange(e.date, startDate, referenceDate));
}

/**
 * Aggregates site-specific measurements by calendar date.
 * Rejects records where the site is null or <= 0.
 * Uses final recorded observation of the day.
 */
export function aggregateDailySiteMeasurements(
  entries: BodyMeasurementEntry[],
  siteKey: MeasurementFieldKey,
  referenceDate?: string
): SiteMeasurementPoint[] {
  if (!entries || entries.length === 0) return [];

  const groups = new Map<string, BodyMeasurementEntry[]>();
  for (const entry of entries) {
    const val = entry[siteKey];
    if (val == null || !Number.isFinite(val) || val <= 0) {
      continue;
    }
    if (referenceDate && entry.date > referenceDate) {
      continue;
    }
    const list = groups.get(entry.date) || [];
    list.push(entry);
    groups.set(entry.date, list);
  }

  const result: SiteMeasurementPoint[] = [];

  for (const [date, dayEntries] of groups.entries()) {
    dayEntries.sort((a, b) => {
      const timeComp = (b.time || '').localeCompare(a.time || '');
      if (timeComp !== 0) return timeComp;
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });

    const chosen = dayEntries[0];
    result.push({
      date,
      valueCm: chosen[siteKey]!,
      time: chosen.time,
      observationCount: dayEntries.length,
      entries: dayEntries,
    });
  }

  result.sort((a, b) => a.date.localeCompare(b.date));
  return result;
}

/**
 * Computes descriptive analytics for a specific anatomical site over a time range.
 */
export function calculateSiteMeasurementAnalyticsSummary(
  entries: BodyMeasurementEntry[],
  siteKey: MeasurementFieldKey,
  timeRange: AnalyticsTimeRange,
  referenceDate: string,
  unit: 'metric' | 'imperial' | MeasurementUnits
): SiteMeasurementAnalyticsSummary {
  const filtered = filterMeasurementsByTimeRange(entries, timeRange, referenceDate);
  const points = aggregateDailySiteMeasurements(filtered, siteKey, referenceDate);
  const isInch = unit === 'imperial';
  const unitLabel = isInch ? 'in' : 'cm';

  if (points.length === 0) {
    return {
      siteKey,
      timeRange,
      observationCount: 0,
      points: [],
      isEmpty: true,
      hasEnoughDataForTrend: false,
    };
  }

  const earliest = points[0];
  const latest = points[points.length - 1];

  const startValueCm = earliest.valueCm;
  const latestValueCm = latest.valueCm;
  const netChangeCm = latestValueCm - startValueCm;

  const netChangeVal = isInch ? cmToInch(netChangeCm) : netChangeCm;
  const absNet = Math.abs(netChangeVal);
  const sign = netChangeCm > 0.05 ? '+' : netChangeCm < -0.05 ? '-' : '';
  const netChangeFormatted =
    absNet <= 0.05 ? `0.0 ${unitLabel}` : `${sign}${absNet.toFixed(1)} ${unitLabel}`;

  return {
    siteKey,
    timeRange,
    observationCount: points.reduce((acc, p) => acc + p.observationCount, 0),
    earliestDate: earliest.date,
    latestDate: latest.date,
    startValueCm,
    latestValueCm,
    netChangeCm,
    netChangeFormatted,
    points,
    isEmpty: false,
    hasEnoughDataForTrend: points.length >= 2,
  };
}
