/**
 * Body Weight Utilities & Validation
 * Phase 5 - Canonical unit conversion, deterministic tie-breaking, and validation
 */

import { BodyWeightEntry, hasExactTime, isValidIsoDate, isValid24hTime } from '../models/biometrics';
import { MeasurementUnits } from '../models/settings';

/**
 * Exact international avoirdupois pound to kilogram conversion factor.
 * 1 lb = 0.45359237 kg (exact standard)
 */
export const KG_PER_LB = 0.45359237;
export const LB_PER_KG = 1 / KG_PER_LB;

export const MIN_WEIGHT_KG = 10.0;
export const MAX_WEIGHT_KG = 500.0;
export const MIN_WEIGHT_LB = MIN_WEIGHT_KG / KG_PER_LB; // ~22.0462 lb
export const MAX_WEIGHT_LB = MAX_WEIGHT_KG / KG_PER_LB; // ~1102.31 lb

/**
 * Converts kilograms to pounds without destructive intermediate rounding.
 */
export function kgToLb(kg: number): number {
  return kg / KG_PER_LB;
}

/**
 * Converts pounds to kilograms without destructive intermediate rounding.
 */
export function lbToKg(lb: number): number {
  return lb * KG_PER_LB;
}

/**
 * Parses user numeric input supporting both period (.) and comma (,) decimal separators.
 * Returns a finite positive number, or null if blank, negative, NaN, Infinity, or malformed.
 */
export function parseWeightInput(raw: string | undefined | null): number | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed === '') return null;

  // Replace standard comma and Arabic decimal separator (U+066B) with period
  const normalized = trimmed.replace(/[,٫]/g, '.');

  // Must match numeric pattern: digits, optional decimal point, digits
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    return null;
  }

  const parsed = parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export type WeightValidationResult = {
  isValid: boolean;
  weightKg?: number;
  errorKey?: string;
  errorMessage?: string;
};

/**
 * Validates a numeric weight value in the specified unit.
 * Ensures the resulting canonical kilograms are within the physiological bounds [10.0, 500.0].
 */
export function validateWeightValue(
  value: number | null | undefined,
  unit: 'kg' | 'lb' | MeasurementUnits
): WeightValidationResult {
  if (value == null || !Number.isFinite(value) || value <= 0) {
    return {
      isValid: false,
      errorKey: 'progress.invalidNumberError',
      errorMessage: 'Please enter a valid weight number',
    };
  }

  const isLb = unit === 'lb' || unit === 'imperial';
  const canonicalKg = isLb ? lbToKg(value) : value;

  if (canonicalKg < MIN_WEIGHT_KG || canonicalKg > MAX_WEIGHT_KG) {
    return {
      isValid: false,
      errorKey: 'progress.weightRangeError',
      errorMessage: `Weight must be between 10 kg and 500 kg (${Math.round(MIN_WEIGHT_LB)} - ${Math.round(MAX_WEIGHT_LB)} lb)`,
    };
  }

  return {
    isValid: true,
    weightKg: canonicalKg,
  };
}

/**
 * Formats a weight in kilograms into the target display unit ('metric'/'kg' or 'imperial'/'lb').
 */
export function formatWeight(
  weightKg: number | null | undefined,
  unit: 'kg' | 'lb' | MeasurementUnits,
  decimals = 1
): string {
  if (weightKg == null || !Number.isFinite(weightKg) || weightKg <= 0) {
    return '--';
  }

  const isLb = unit === 'lb' || unit === 'imperial';
  const val = isLb ? kgToLb(weightKg) : weightKg;

  // Round to specified decimal places without scientific notation
  const factor = Math.pow(10, decimals);
  const rounded = Math.round(val * factor) / factor;
  return rounded.toFixed(decimals);
}

/**
 * Deterministic tie-breaking comparator for body weight entries (newest first).
 *
 * Policy:
 * 1. Primary sort: Calendar date descending (newest calendar date first).
 * 2. On the same calendar date:
 *    - Both have exact times: sorted by observation time descending (`time DESC`).
 *    - One has exact time, other is date_only: precise measurement takes precedence over unrecorded-time reading.
 *    - Both are date_only: tie-broken by immutable creation timestamp descending (`createdAt DESC`), then ID (`id DESC`).
 *    - Identical times: tie-broken by `createdAt DESC`, then `id DESC`.
 *
 * This guarantees:
 * - No synthetic 12:00 placeholder is ever used to determine chronological recency.
 * - Genuine observations with verified times are prioritized over unverified timestamps.
 * - Exact deterministic ordering across platforms, queries, and restarts.
 */
export function compareBodyWeightsDescending(a: BodyWeightEntry, b: BodyWeightEntry): number {
  // 1. Calendar date descending
  if (a.date !== b.date) {
    return b.date.localeCompare(a.date);
  }

  // 2. Same calendar date: evaluate precision
  const aExact = hasExactTime(a);
  const bExact = hasExactTime(b);

  if (aExact && bExact) {
    // Both have verified measurement times
    if (a.time !== b.time) {
      return b.time.localeCompare(a.time);
    }
  } else if (aExact && !bExact) {
    // a has exact observation time, b is date_only -> a is considered more definitive
    return -1;
  } else if (!aExact && bExact) {
    // b has exact observation time, a is date_only -> b is considered more definitive
    return 1;
  }

  // 3. Fallback tie-breaker: createdAt descending, then id descending
  const aCreated = a.createdAt || '';
  const bCreated = b.createdAt || '';
  if (aCreated !== bCreated) {
    return bCreated.localeCompare(aCreated);
  }

  return b.id.localeCompare(a.id);
}

/**
 * Finds the chronologically latest genuine weigh-in from an array of entries.
 * Filters out invalid or zero weights.
 */
export function getLatestGenuineWeight(entries: BodyWeightEntry[] | null | undefined): BodyWeightEntry | null {
  if (!entries || entries.length === 0) return null;
  const valid = entries.filter(
    (e) => e && Number.isFinite(e.weightKg) && e.weightKg >= MIN_WEIGHT_KG && e.weightKg <= MAX_WEIGHT_KG
  );
  if (valid.length === 0) return null;
  const sorted = [...valid].sort(compareBodyWeightsDescending);
  return sorted[0];
}

export type TargetWeightComparison = {
  hasTarget: boolean;
  targetWeightKg?: number;
  currentWeightKg?: number;
  deltaKg?: number;
  isGoalReached: boolean;
  deltaFormatted?: string;
};

/**
 * Calculates comparison between current weight and target weight.
 */
export function calculateTargetWeightComparison(
  currentWeightKg: number | null | undefined,
  targetWeightKg: number | null | undefined,
  unit: 'kg' | 'lb' | MeasurementUnits = 'metric'
): TargetWeightComparison {
  if (
    targetWeightKg == null ||
    !Number.isFinite(targetWeightKg) ||
    targetWeightKg < MIN_WEIGHT_KG ||
    targetWeightKg > MAX_WEIGHT_KG
  ) {
    return { hasTarget: false, isGoalReached: false };
  }

  if (
    currentWeightKg == null ||
    !Number.isFinite(currentWeightKg) ||
    currentWeightKg < MIN_WEIGHT_KG ||
    currentWeightKg > MAX_WEIGHT_KG
  ) {
    return {
      hasTarget: true,
      targetWeightKg,
      isGoalReached: false,
    };
  }

  const deltaKg = currentWeightKg - targetWeightKg;
  const isGoalReached = Math.abs(deltaKg) < 0.1;

  const isLb = unit === 'lb' || unit === 'imperial';
  const deltaValue = isLb ? kgToLb(deltaKg) : deltaKg;
  const unitLabel = isLb ? 'lb' : 'kg';

  const sign = deltaValue > 0 ? '+' : '';
  const deltaFormatted = `${sign}${deltaValue.toFixed(1)} ${unitLabel}`;

  return {
    hasTarget: true,
    targetWeightKg,
    currentWeightKg,
    deltaKg,
    isGoalReached,
    deltaFormatted,
  };
}

/**
 * Validates a date string for body weight logging (must be YYYY-MM-DD Gregorian).
 */
export function validateWeightDate(dateStr: string): boolean {
  return isValidIsoDate(dateStr);
}

/**
 * Validates a time string for body weight logging (must be HH:mm 24-hr).
 */
export function validateWeightTime(timeStr: string): boolean {
  return isValid24hTime(timeStr);
}
