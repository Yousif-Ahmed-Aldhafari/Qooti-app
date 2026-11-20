/**
 * Body Measurements, Circumference History & Ratios Utility
 * Phase 5 - Task 5.3 & Task 5.3A
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
 * Normalizes Eastern Arabic (٠-٩) and Persian (۰-۹) numerals to ASCII digits (0-9),
 * and Arabic decimal comma (،), Arabic decimal separator (٫, \u066B), and standard comma (,) to period (.).
 */
export function normalizeNumeralsAndSeparators(str: string): string {
  return str
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
    .replace(/[\u066B،,]/g, '.');
}

/**
 * Parses a user input string into a floating-point number.
 * Accepts conventional decimals with period (.), comma (,), Arabic decimal separator (٫, \u066B),
 * Arabic comma (،), and Arabic-Indic numerals (٠-٩, ۰-۹).
 * Strictly rejects scientific notation (1e2, 1E-2), hex (0x10), octal/binary (0b10),
 * signs (+, -), negative numbers, NaN, Infinity, multiple decimal separators, and non-numeric symbols.
 * Returns null for invalid or empty inputs.
 */
export function parseMeasurementInput(rawText: string | null | undefined): number | null {
  if (rawText == null) return null;
  const trimmed = rawText.trim();
  if (trimmed === '') return null;

  // Strict rejection: disallow signs (+, -), scientific exponents (e, E), hex/octal/binary prefixes
  if (/[+\-eExXbBoO]/.test(trimmed)) {
    return null;
  }

  const normalized = normalizeNumeralsAndSeparators(trimmed);

  // Must match standard non-negative decimal: digits optionally with a single period and digits
  // or starting with a period followed by digits (.5)
  if (!/^(\d+(\.\d+)?|\.\d+)$/.test(normalized)) {
    return null;
  }

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
 * Unchanged (|delta| <= 0.05 cm) is formatted unambiguously as 0.0 cm/in,
 * completely preventing -0.0 artifacts.
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

  let deltaFormatted: string;
  if (isUnchanged) {
    deltaFormatted = `0.0 ${unitLabel}`;
  } else {
    const rawFixed = deltaValue.toFixed(1);
    const fixed = rawFixed === '-0.0' || rawFixed === '-0' ? '0.0' : rawFixed;
    const sign = isIncrease ? '+' : '';
    deltaFormatted = `${sign}${fixed} ${unitLabel}`;
  }

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

/**
 * Computes the absolute calendar day difference between two ISO date strings (YYYY-MM-DD).
 * Uses UTC to ensure timezone neutrality.
 */
export function getDaysBetweenDates(dateA: string, dateB: string): number {
  const [y1, m1, d1] = dateA.split('-').map(Number);
  const [y2, m2, d2] = dateB.split('-').map(Number);
  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round(Math.abs(utc1 - utc2) / msPerDay);
}

export interface SiteMeasurementRecord {
  fieldKey: MeasurementFieldKey;
  valueCm: number;
  entry: BodyMeasurementEntry;
  date: string;
  time: string;
  isStale: boolean; // true if this observation is older than the newest overall measurement entry
}

/**
 * Selects the chronologically latest valid measurement for each anatomical site independently.
 * Partial records will not erase previously known measurements for other sites.
 */
export function getLatestSiteMeasurements(
  entries: BodyMeasurementEntry[]
): Record<MeasurementFieldKey, SiteMeasurementRecord | null> {
  const result: Record<MeasurementFieldKey, SiteMeasurementRecord | null> = {
    chestCm: null,
    waistCm: null,
    hipsCm: null,
    leftArmCm: null,
    rightArmCm: null,
    leftThighCm: null,
    rightThighCm: null,
    leftCalfCm: null,
    rightCalfCm: null,
    shouldersCm: null,
    neckCm: null,
  };

  if (!entries || entries.length === 0) {
    return result;
  }

  const sorted = [...entries].sort(compareBodyMeasurementsDescending);
  const newestOverall = sorted[0];

  for (const field of MEASUREMENT_FIELDS) {
    const key = field.key;
    for (const entry of sorted) {
      const val = entry[key];
      if (val != null && Number.isFinite(val) && val > 0) {
        result[key] = {
          fieldKey: key,
          valueCm: val,
          entry,
          date: entry.date,
          time: entry.time,
          isStale: entry.id !== newestOverall.id,
        };
        break;
      }
    }
  }

  return result;
}

export interface SiteMeasurementDeltaResult extends MeasurementDeltaResult {
  currentRecord?: SiteMeasurementRecord;
  previousRecord?: SiteMeasurementRecord;
}

/**
 * Calculates deltas using the two most recent valid observations for the same anatomical site,
 * rather than two adjacent records that may contain different sites.
 */
export function getSiteMeasurementDelta(
  entries: BodyMeasurementEntry[],
  fieldKey: MeasurementFieldKey,
  unit: 'cm' | 'in' | MeasurementUnits
): SiteMeasurementDeltaResult {
  if (!entries || entries.length === 0) {
    return { hasDelta: false };
  }

  const sorted = [...entries].sort(compareBodyMeasurementsDescending);
  const newestOverall = sorted[0];

  const validForSite = sorted.filter((e) => {
    const val = e[fieldKey];
    return val != null && Number.isFinite(val) && val > 0;
  });

  if (validForSite.length === 0) {
    return { hasDelta: false };
  }

  const currentEntry = validForSite[0];
  const currentRecord: SiteMeasurementRecord = {
    fieldKey,
    valueCm: currentEntry[fieldKey]!,
    entry: currentEntry,
    date: currentEntry.date,
    time: currentEntry.time,
    isStale: currentEntry.id !== newestOverall.id,
  };

  if (validForSite.length === 1) {
    return {
      hasDelta: false,
      currentRecord,
    };
  }

  const prevEntry = validForSite[1];
  const previousRecord: SiteMeasurementRecord = {
    fieldKey,
    valueCm: prevEntry[fieldKey]!,
    entry: prevEntry,
    date: prevEntry.date,
    time: prevEntry.time,
    isStale: true,
  };

  const delta = calculateMeasurementDelta(currentRecord.valueCm, previousRecord.valueCm, unit);

  return {
    ...delta,
    currentRecord,
    previousRecord,
  };
}

export interface DerivedWaistToHipRatioResult extends WaistToHipRatioResult {
  isSameDate?: boolean;
  waistDate?: string;
  hipsDate?: string;
  daysApart?: number;
  disclosedDateText?: string;
}

/**
 * Derives Waist-to-Hip ratio across measurement history.
 * Policy:
 * 1. Resolves newest valid waist and newest valid hips.
 * 2. If both are recorded in the same entry, pairs them with zero gap.
 * 3. If recorded in different entries, pairs them only if calendar gap <= 30 days.
 * 4. Gaps > 30 days return isValid: false to prevent misleading clinical interpretations.
 * 5. Discloses individual dates when observations originate from different dates.
 */
export function deriveWaistToHipRatio(
  entries: BodyMeasurementEntry[],
  formatDisclosedText?: (waistDate: string, hipsDate: string) => string
): DerivedWaistToHipRatioResult {
  if (!entries || entries.length === 0) {
    return { isValid: false };
  }

  const sorted = [...entries].sort(compareBodyMeasurementsDescending);

  const waistEntry = sorted.find(
    (e) => e.waistCm != null && Number.isFinite(e.waistCm) && e.waistCm > 0
  );
  const hipsEntry = sorted.find(
    (e) => e.hipsCm != null && Number.isFinite(e.hipsCm) && e.hipsCm > 0
  );

  if (!waistEntry || !hipsEntry || waistEntry.waistCm == null || hipsEntry.hipsCm == null) {
    return { isValid: false };
  }

  if (waistEntry.id === hipsEntry.id) {
    const base = calculateWaistToHipRatio(waistEntry.waistCm, hipsEntry.hipsCm);
    if (!base.isValid) return { isValid: false };
    return {
      ...base,
      isSameDate: true,
      waistDate: waistEntry.date,
      hipsDate: hipsEntry.date,
      daysApart: 0,
      disclosedDateText: waistEntry.date,
    };
  }

  const daysApart = getDaysBetweenDates(waistEntry.date, hipsEntry.date);
  if (daysApart > 30) {
    return { isValid: false };
  }

  const base = calculateWaistToHipRatio(waistEntry.waistCm, hipsEntry.hipsCm);
  if (!base.isValid) return { isValid: false };

  const isSameDate = waistEntry.date === hipsEntry.date;
  const disclosedDateText = isSameDate
    ? waistEntry.date
    : formatDisclosedText
      ? formatDisclosedText(waistEntry.date, hipsEntry.date)
      : `Waist: ${waistEntry.date} • Hips: ${hipsEntry.date}`;

  return {
    ...base,
    isSameDate,
    waistDate: waistEntry.date,
    hipsDate: hipsEntry.date,
    daysApart,
    disclosedDateText,
  };
}

export interface DerivedWaistToHeightRatioResult extends WaistToHeightRatioResult {
  waistDate?: string;
  disclosedDateText?: string;
}

/**
 * Derives Waist-to-Height ratio: latest valid waist / profile height.
 * Missing-value and zero-division protected. Discloses waist observation date.
 */
export function deriveWaistToHeightRatio(
  entries: BodyMeasurementEntry[],
  heightCm: number | null | undefined
): DerivedWaistToHeightRatioResult {
  if (!entries || entries.length === 0 || heightCm == null || heightCm <= 0) {
    return { isValid: false };
  }

  const sorted = [...entries].sort(compareBodyMeasurementsDescending);
  const waistEntry = sorted.find(
    (e) => e.waistCm != null && Number.isFinite(e.waistCm) && e.waistCm > 0
  );
  if (!waistEntry || waistEntry.waistCm == null) {
    return { isValid: false };
  }

  const base = calculateWaistToHeightRatio(waistEntry.waistCm, heightCm);
  if (!base.isValid) return { isValid: false };

  return {
    ...base,
    waistDate: waistEntry.date,
    disclosedDateText: waistEntry.date,
  };
}
