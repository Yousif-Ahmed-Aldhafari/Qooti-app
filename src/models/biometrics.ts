/**
 * Canonical Biometrics & Body Tracking Domain Models
 * Phase 5 - Normalized durable biometrics storage
 */

export type WeightSource =
  | 'manual'
  | 'scale'
  | 'apple_health'
  | 'google_fit'
  | 'legacy_migration';

export interface BodyWeightEntry {
  id: string;
  date: string; // YYYY-MM-DD (local calendar date)
  time: string; // HH:mm (24-hour local time)
  weightKg: number;
  notes?: string | null;
  source: WeightSource;
  createdAt: string; // ISO 8601 timestamp
  updatedAt: string; // ISO 8601 timestamp
}

export interface BodyMeasurementEntry {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  chestCm?: number | null;
  waistCm?: number | null;
  hipsCm?: number | null;
  leftArmCm?: number | null;
  rightArmCm?: number | null;
  leftThighCm?: number | null;
  rightThighCm?: number | null;
  leftCalfCm?: number | null;
  rightCalfCm?: number | null;
  shouldersCm?: number | null;
  neckCm?: number | null;
  notes?: string | null;
  createdAt: string; // ISO 8601 timestamp
  updatedAt: string; // ISO 8601 timestamp
}

export type CompositionMethod =
  | 'dexa'
  | 'calipers'
  | 'bioimpedance'
  | 'navy_tape'
  | 'manual'
  | 'other';

export interface BodyCompositionEntry {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  bodyFatPercentage?: number | null;
  skeletalMuscleMassKg?: number | null;
  boneMassKg?: number | null;
  bodyWaterPercentage?: number | null;
  method?: CompositionMethod | null;
  notes?: string | null;
  createdAt: string; // ISO 8601 timestamp
  updatedAt: string; // ISO 8601 timestamp
}

export type PhotoPose = 'front' | 'side' | 'back' | 'custom';

export interface ProgressPhoto {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  relativePath: string; // Safe relative path inside app storage, e.g. 'progress_photos/photo_xyz.jpg'
  pose: PhotoPose;
  weightEntryId?: string | null;
  notes?: string | null;
  isFavorite: boolean;
  createdAt: string; // ISO 8601 timestamp
  updatedAt: string; // ISO 8601 timestamp
}

export class BiometricsValidationError extends Error {
  constructor(
    message: string,
    public readonly field?: string
  ) {
    super(message);
    this.name = 'BiometricsValidationError';
  }
}

const ISO_DATE_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const TIME_24H_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidIsoDate(dateStr: string): boolean {
  if (!ISO_DATE_REGEX.test(dateStr)) return false;
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function isValid24hTime(timeStr: string): boolean {
  return TIME_24H_REGEX.test(timeStr);
}

export function validateRelativePhotoPath(relativePath: string): void {
  if (!relativePath || typeof relativePath !== 'string') {
    throw new BiometricsValidationError('Photo relative path cannot be empty', 'relativePath');
  }
  const trimmed = relativePath.trim();
  if (trimmed.length === 0) {
    throw new BiometricsValidationError('Photo relative path cannot be blank', 'relativePath');
  }
  if (
    trimmed.startsWith('/') ||
    trimmed.startsWith('\\') ||
    /^[a-zA-Z]:/.test(trimmed) ||
    /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)
  ) {
    throw new BiometricsValidationError(
      'Photo path must be relative to storage directory; absolute paths and URIs are prohibited',
      'relativePath'
    );
  }
  if (trimmed.includes('..') || trimmed.includes('/./') || trimmed.includes('\\.\\')) {
    throw new BiometricsValidationError(
      'Photo relative path cannot contain directory traversal sequences',
      'relativePath'
    );
  }
}

export function validateBodyWeightEntry(entry: Partial<BodyWeightEntry>): asserts entry is BodyWeightEntry {
  if (!entry.id || typeof entry.id !== 'string' || entry.id.trim() === '') {
    throw new BiometricsValidationError('Body weight entry ID is required', 'id');
  }
  if (!entry.date || !isValidIsoDate(entry.date)) {
    throw new BiometricsValidationError('Invalid date format (must be YYYY-MM-DD)', 'date');
  }
  if (!entry.time || !isValid24hTime(entry.time)) {
    throw new BiometricsValidationError('Invalid time format (must be HH:mm)', 'time');
  }
  if (
    entry.weightKg == null ||
    typeof entry.weightKg !== 'number' ||
    !Number.isFinite(entry.weightKg) ||
    entry.weightKg < 10.0 ||
    entry.weightKg > 500.0
  ) {
    throw new BiometricsValidationError(
      'Weight must be a valid number between 10.0 kg and 500.0 kg',
      'weightKg'
    );
  }
  const validSources: WeightSource[] = [
    'manual',
    'scale',
    'apple_health',
    'google_fit',
    'legacy_migration',
  ];
  if (!entry.source || !validSources.includes(entry.source)) {
    throw new BiometricsValidationError(
      `Invalid weight source. Must be one of: ${validSources.join(', ')}`,
      'source'
    );
  }
  if (!entry.createdAt || typeof entry.createdAt !== 'string') {
    throw new BiometricsValidationError('createdAt timestamp is required', 'createdAt');
  }
  if (!entry.updatedAt || typeof entry.updatedAt !== 'string') {
    throw new BiometricsValidationError('updatedAt timestamp is required', 'updatedAt');
  }
}

function validateCircumference(
  val: number | null | undefined,
  field: string,
  min: number,
  max: number
): void {
  if (val == null) return;
  if (typeof val !== 'number' || !Number.isFinite(val) || val < min || val > max) {
    throw new BiometricsValidationError(
      `${field} must be null or a valid measurement between ${min} cm and ${max} cm`,
      field
    );
  }
}

export function validateBodyMeasurementEntry(
  entry: Partial<BodyMeasurementEntry>
): asserts entry is BodyMeasurementEntry {
  if (!entry.id || typeof entry.id !== 'string' || entry.id.trim() === '') {
    throw new BiometricsValidationError('Body measurement entry ID is required', 'id');
  }
  if (!entry.date || !isValidIsoDate(entry.date)) {
    throw new BiometricsValidationError('Invalid date format (must be YYYY-MM-DD)', 'date');
  }
  if (!entry.time || !isValid24hTime(entry.time)) {
    throw new BiometricsValidationError('Invalid time format (must be HH:mm)', 'time');
  }

  // Missing values must be null/undefined, never zero or negative
  validateCircumference(entry.chestCm, 'chestCm', 10.0, 300.0);
  validateCircumference(entry.waistCm, 'waistCm', 10.0, 300.0);
  validateCircumference(entry.hipsCm, 'hipsCm', 10.0, 300.0);
  validateCircumference(entry.leftArmCm, 'leftArmCm', 5.0, 150.0);
  validateCircumference(entry.rightArmCm, 'rightArmCm', 5.0, 150.0);
  validateCircumference(entry.leftThighCm, 'leftThighCm', 10.0, 200.0);
  validateCircumference(entry.rightThighCm, 'rightThighCm', 10.0, 200.0);
  validateCircumference(entry.leftCalfCm, 'leftCalfCm', 5.0, 150.0);
  validateCircumference(entry.rightCalfCm, 'rightCalfCm', 5.0, 150.0);
  validateCircumference(entry.shouldersCm, 'shouldersCm', 10.0, 300.0);
  validateCircumference(entry.neckCm, 'neckCm', 10.0, 150.0);

  if (!entry.createdAt || typeof entry.createdAt !== 'string') {
    throw new BiometricsValidationError('createdAt timestamp is required', 'createdAt');
  }
  if (!entry.updatedAt || typeof entry.updatedAt !== 'string') {
    throw new BiometricsValidationError('updatedAt timestamp is required', 'updatedAt');
  }
}

export function validateBodyCompositionEntry(
  entry: Partial<BodyCompositionEntry>
): asserts entry is BodyCompositionEntry {
  if (!entry.id || typeof entry.id !== 'string' || entry.id.trim() === '') {
    throw new BiometricsValidationError('Body composition entry ID is required', 'id');
  }
  if (!entry.date || !isValidIsoDate(entry.date)) {
    throw new BiometricsValidationError('Invalid date format (must be YYYY-MM-DD)', 'date');
  }
  if (!entry.time || !isValid24hTime(entry.time)) {
    throw new BiometricsValidationError('Invalid time format (must be HH:mm)', 'time');
  }

  if (entry.bodyFatPercentage != null) {
    if (
      typeof entry.bodyFatPercentage !== 'number' ||
      !Number.isFinite(entry.bodyFatPercentage) ||
      entry.bodyFatPercentage < 1.0 ||
      entry.bodyFatPercentage > 80.0
    ) {
      throw new BiometricsValidationError(
        'Body fat percentage must be between 1.0% and 80.0%',
        'bodyFatPercentage'
      );
    }
  }

  if (entry.skeletalMuscleMassKg != null) {
    if (
      typeof entry.skeletalMuscleMassKg !== 'number' ||
      !Number.isFinite(entry.skeletalMuscleMassKg) ||
      entry.skeletalMuscleMassKg < 5.0 ||
      entry.skeletalMuscleMassKg > 200.0
    ) {
      throw new BiometricsValidationError(
        'Skeletal muscle mass must be between 5.0 kg and 200.0 kg',
        'skeletalMuscleMassKg'
      );
    }
  }

  if (entry.boneMassKg != null) {
    if (
      typeof entry.boneMassKg !== 'number' ||
      !Number.isFinite(entry.boneMassKg) ||
      entry.boneMassKg < 0.5 ||
      entry.boneMassKg > 20.0
    ) {
      throw new BiometricsValidationError(
        'Bone mass must be between 0.5 kg and 20.0 kg',
        'boneMassKg'
      );
    }
  }

  if (entry.bodyWaterPercentage != null) {
    if (
      typeof entry.bodyWaterPercentage !== 'number' ||
      !Number.isFinite(entry.bodyWaterPercentage) ||
      entry.bodyWaterPercentage < 10.0 ||
      entry.bodyWaterPercentage > 90.0
    ) {
      throw new BiometricsValidationError(
        'Body water percentage must be between 10.0% and 90.0%',
        'bodyWaterPercentage'
      );
    }
  }

  const validMethods: CompositionMethod[] = [
    'dexa',
    'calipers',
    'bioimpedance',
    'navy_tape',
    'manual',
    'other',
  ];
  if (entry.method != null && !validMethods.includes(entry.method)) {
    throw new BiometricsValidationError(
      `Invalid composition method. Must be one of: ${validMethods.join(', ')}`,
      'method'
    );
  }

  if (!entry.createdAt || typeof entry.createdAt !== 'string') {
    throw new BiometricsValidationError('createdAt timestamp is required', 'createdAt');
  }
  if (!entry.updatedAt || typeof entry.updatedAt !== 'string') {
    throw new BiometricsValidationError('updatedAt timestamp is required', 'updatedAt');
  }
}

export function validateProgressPhoto(
  photo: Partial<ProgressPhoto>
): asserts photo is ProgressPhoto {
  if (!photo.id || typeof photo.id !== 'string' || photo.id.trim() === '') {
    throw new BiometricsValidationError('Progress photo ID is required', 'id');
  }
  if (!photo.date || !isValidIsoDate(photo.date)) {
    throw new BiometricsValidationError('Invalid date format (must be YYYY-MM-DD)', 'date');
  }
  if (!photo.time || !isValid24hTime(photo.time)) {
    throw new BiometricsValidationError('Invalid time format (must be HH:mm)', 'time');
  }
  validateRelativePhotoPath(photo.relativePath || '');

  const validPoses: PhotoPose[] = ['front', 'side', 'back', 'custom'];
  if (!photo.pose || !validPoses.includes(photo.pose)) {
    throw new BiometricsValidationError(
      `Invalid photo pose. Must be one of: ${validPoses.join(', ')}`,
      'pose'
    );
  }

  if (typeof photo.isFavorite !== 'boolean') {
    throw new BiometricsValidationError('isFavorite must be a boolean', 'isFavorite');
  }

  if (!photo.createdAt || typeof photo.createdAt !== 'string') {
    throw new BiometricsValidationError('createdAt timestamp is required', 'createdAt');
  }
  if (!photo.updatedAt || typeof photo.updatedAt !== 'string') {
    throw new BiometricsValidationError('updatedAt timestamp is required', 'updatedAt');
  }
}
