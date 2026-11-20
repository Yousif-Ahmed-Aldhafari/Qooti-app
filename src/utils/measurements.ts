/**
 * Body Measurements, Circumference History & Ratios Utility
 * Phase 5 - Task 5.3
 */

import type { BodyMeasurementEntry } from '../models/biometrics';
import type { MeasurementUnits } from '../models/settings';
import { isValidIsoDate, isValid24hTime } from '../models/biometrics';

export const CM_PER_INCH = 2.54;
export const INCH_PER_CM = 1 / 2.54;

export type MeasurementFieldKey =
  | 'chestCm'
  | 'waistCm'
  | 'hipsCm'
  | 'leftArmCm'
  | 'rightArmCm'
  | 'leftThighCm'
  | 'rightThighCm'
  | 'leftCalfCm'
  | 'rightCalfCm'
  | 'shouldersCm'
  | 'neckCm';

export interface FieldDefinition {
  key: MeasurementFieldKey;
  labelKey: string;
  minCm: number;
  maxCm: number;
}

export const MEASUREMENT_FIELDS: FieldDefinition[] = [
  { key: 'chestCm', labelKey: 'progress.chest', minCm: 10.0, maxCm: 300.0 },
  { key: 'waistCm', labelKey: 'progress.waist', minCm: 10.0, maxCm: 300.0 },
  { key: 'hipsCm', labelKey: 'progress.hips', minCm: 10.0, maxCm: 300.0 },
  { key: 'shouldersCm', labelKey: 'progress.shoulders', minCm: 10.0, maxCm: 300.0 },
  { key: 'neckCm', labelKey: 'progress.neck', minCm: 10.0, maxCm: 150.0 },
  { key: 'leftArmCm', labelKey: 'progress.leftArm', minCm: 5.0, maxCm: 150.0 },
  { key: 'rightArmCm', labelKey: 'progress.rightArm', minCm: 5.0, maxCm: 150.0 },
  { key: 'leftThighCm', labelKey: 'progress.leftThigh', minCm: 10.0, maxCm: 200.0 },
  { key: 'rightThighCm', labelKey: 'progress.rightThigh', minCm: 10.0, maxCm: 200.0 },
  { key: 'leftCalfCm', labelKey: 'progress.leftCalf', minCm: 5.0, maxCm: 150.0 },
  { key: 'rightCalfCm', labelKey: 'progress.rightCalf', minCm: 5.0, maxCm: 150.0 },
];

/**
 * Converts centimeters to inches using exact 1 in = 2.54 cm conversion.
 */
export function cmToInch(cm: number): number {
  return cm / CM_PER_INCH;
}

/**
 * Converts inches to centimeters using exact 1 in = 2.54 cm conversion.
 */
export function inchToCm(inch: number): number {
  return inch * CM_PER_INCH;
}

/**
 * Parses a user input string into a floating-point number.
 * Supports comma and period decimal separators, whitespace trimming.
 * Returns null for empty, whitespace, negative, NaN, or non-finite inputs.
 */
export function parseMeasurementInput(rawText: string | null | undefined): number | null {
  if (rawText == null) return null;
  const trimmed = rawText.trim();
  if (trimmed === '') return null;

  // Replace comma with period
  const normalized = trimmed.replace(',', '.');
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed) || isNaN(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

/**
 * Formats a canonical measurement in cm into a string suitable for an editable input box.
 * Trims trailing zeros and limits decimal places to prevent rounding artifacts.
 */
export function formatMeasurementInput(
  valCm: number | null | undefined,
  unit: 'cm' | 'in' | MeasurementUnits,
  maxDecimals = 2
): string {
  if (valCm == null || !Number.isFinite(valCm) || valCm <= 0) {
    return '';
  }
  const isInch = unit === 'in' || unit === 'imperial';
  const val = isInch ? cmToInch(valCm) : valCm;

  const factor = Math.pow(10, maxDecimals);
  const rounded = Math.round(val * factor) / factor;
  return rounded.toString();
}

/**
 * Formats a measurement in cm into a display string with unit.
 */
export function formatMeasurement(
  valCm: number | null | undefined,
  unit: 'cm' | 'in' | MeasurementUnits,
  decimals = 1
): string {
  if (valCm == null || !Number.isFinite(valCm) || valCm <= 0) {
    return '--';
  }
  const isInch = unit === 'in' || unit === 'imperial';
  const val = isInch ? cmToInch(valCm) : valCm;

  const factor = Math.pow(10, decimals);
  const rounded = Math.round(val * factor) / factor;
  return rounded.toFixed(decimals);
}

/**
 * Validates a single measurement value against the field's allowed physical bounds.
 */
export function validateCircumferenceValue(
  value: number,
  fieldDef: FieldDefinition,
  unit: 'cm' | 'in' | MeasurementUnits
): { isValid: boolean; valueCm?: number; errorKey?: string } {
  if (!Number.isFinite(value) || isNaN(value) || value <= 0) {
    return { isValid: false, errorKey: 'progress.invalidNumberError' };
  }

  const isInch = unit === 'in' || unit === 'imperial';
  const canonicalCm = isInch ? inchToCm(value) : value;

  if (canonicalCm < fieldDef.minCm || canonicalCm > fieldDef.maxCm) {
    return { isValid: false, errorKey: 'progress.measurementRangeError' };
  }

  return { isValid: true, valueCm: canonicalCm };
}

/**
 * Checks if at least one measurement field has a valid numeric value.
 */
export function hasAtLeastOneMeasurement(entry: Partial<BodyMeasurementEntry>): boolean {
  return MEASUREMENT_FIELDS.some((field) => {
    const val = entry[field.key];
    return val != null && Number.isFinite(val) && val > 0;
  });
}

/**
 * Deterministic tie-breaking comparator for body measurement entries (newest first).
 */
export function compareBodyMeasurementsDescending(
  a: BodyMeasurementEntry,
  b: BodyMeasurementEntry
): number {
  if (a.date !== b.date) {
    return b.date.localeCompare(a.date);
  }
  if (a.time !== b.time) {
    return b.time.localeCompare(a.time);
  }
  if (a.createdAt !== b.createdAt) {
    return b.createdAt.localeCompare(a.createdAt);
  }
  return b.id.localeCompare(a.id);
}

export interface MeasurementDeltaResult {
  hasDelta: boolean;
  deltaCm?: number;
  deltaFormatted?: string;
  isIncrease?: boolean;
  isDecrease?: boolean;
  isUnchanged?: boolean;
}

/**
 * Computes difference between current and previous measurements.
 */
export function calculateMeasurementDelta(
  currentCm: number | null | undefined,
  previousCm: number | null | undefined,
  unit: 'cm' | 'in' | MeasurementUnits
): MeasurementDeltaResult {
  if (
    currentCm == null ||
    previousCm == null ||
    !Number.isFinite(currentCm) ||
    !Number.isFinite(previousCm) ||
    currentCm <= 0 ||
    previousCm <= 0
  ) {
    return { hasDelta: false };
  }

  const deltaCm = currentCm - previousCm;
  const isInch = unit === 'in' || unit === 'imperial';
  const deltaValue = isInch ? cmToInch(deltaCm) : deltaCm;
  const unitLabel = isInch ? 'in' : 'cm';

  const isIncrease = deltaCm > 0.05;
  const isDecrease = deltaCm < -0.05;
  const isUnchanged = !isIncrease && !isDecrease;

  const sign = isIncrease ? '+' : '';
  const deltaFormatted = `${sign}${deltaValue.toFixed(1)} ${unitLabel}`;

  return {
    hasDelta: true,
    deltaCm,
    deltaFormatted,
    isIncrease,
    isDecrease,
    isUnchanged,
  };
}

export interface WaistToHipRatioResult {
  isValid: boolean;
  ratio?: number;
  ratioFormatted?: string;
}

/**
 * Computes Waist-to-Hip ratio: waist / hips.
 * Missing-value and zero-division protected.
 */
export function calculateWaistToHipRatio(
  waistCm: number | null | undefined,
  hipsCm: number | null | undefined
): WaistToHipRatioResult {
  if (
    waistCm == null ||
    hipsCm == null ||
    !Number.isFinite(waistCm) ||
    !Number.isFinite(hipsCm) ||
    waistCm <= 0 ||
    hipsCm <= 0
  ) {
    return { isValid: false };
  }

  const ratio = waistCm / hipsCm;
  if (!Number.isFinite(ratio) || isNaN(ratio)) {
    return { isValid: false };
  }

  return {
    isValid: true,
    ratio,
    ratioFormatted: ratio.toFixed(2),
  };
}

export interface WaistToHeightRatioResult {
  isValid: boolean;
  ratio?: number;
  ratioFormatted?: string;
}

/**
 * Computes Waist-to-Height ratio: waist / profile height (both in cm).
 * Missing-value and zero-division protected.
 */
export function calculateWaistToHeightRatio(
  waistCm: number | null | undefined,
  heightCm: number | null | undefined
): WaistToHeightRatioResult {
  if (
    waistCm == null ||
    heightCm == null ||
    !Number.isFinite(waistCm) ||
    !Number.isFinite(heightCm) ||
    waistCm <= 0 ||
    heightCm <= 0
  ) {
    return { isValid: false };
  }

  const ratio = waistCm / heightCm;
  if (!Number.isFinite(ratio) || isNaN(ratio)) {
    return { isValid: false };
  }

  return {
    isValid: true,
    ratio,
    ratioFormatted: ratio.toFixed(2),
  };
}

/**
 * Returns the chronologically latest measurement from a list.
 */
export function getLatestMeasurementEntry(
  entries: BodyMeasurementEntry[]
): BodyMeasurementEntry | null {
  if (!entries || entries.length === 0) return null;
  const sorted = [...entries].sort(compareBodyMeasurementsDescending);
  return sorted[0];
}

/**
 * Finds the measurement chronologically preceding the entry with `currentEntryId`.
 */
export function getPreviousMeasurementEntry(
  entries: BodyMeasurementEntry[],
  currentEntryId: string
): BodyMeasurementEntry | null {
  if (!entries || entries.length < 2) return null;
  const sorted = [...entries].sort(compareBodyMeasurementsDescending);
  const currentIndex = sorted.findIndex((e) => e.id === currentEntryId);
  if (currentIndex === -1 || currentIndex >= sorted.length - 1) {
    return null;
  }
  return sorted[currentIndex + 1];
}

export function validateMeasurementDate(dateStr: string): boolean {
  return isValidIsoDate(dateStr);
}

export function validateMeasurementTime(timeStr: string): boolean {
  return isValid24hTime(timeStr.trim());
}
