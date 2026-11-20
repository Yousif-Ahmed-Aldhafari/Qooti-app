import { getDatabase } from '../db/database';
import type { IDatabase } from '../db/types';
import {
  BodyWeightEntry,
  BodyMeasurementEntry,
  BodyCompositionEntry,
  ProgressPhoto,
  PhotoPose,
} from '../models/biometrics';
import { SQLiteBodyWeightRepository } from '../db/repositories/bodyWeightRepository';
import { SQLiteProfileRepository } from '../db/repositories/profileRepository';
import { SQLiteBodyMeasurementRepository } from '../db/repositories/bodyMeasurementRepository';
import { SQLiteBodyCompositionRepository } from '../db/repositories/bodyCompositionRepository';
import { SQLiteProgressPhotoRepository } from '../db/repositories/progressPhotoRepository';
import { UserProfile } from '../models/profile';
import { getLatestGenuineWeight } from '../utils/weight';
import {
  reconcileLegacyProgressWeights,
  LegacyProgressReconciliationResult,
} from '../db/migrationService';

export { reconcileLegacyProgressWeights };
export type { LegacyProgressReconciliationResult };

// --- Body Weight Services ---

export async function loadAllWeights(txn?: IDatabase): Promise<BodyWeightEntry[]> {
  const db = txn || (await getDatabase());
  const repo = new SQLiteBodyWeightRepository(db);
  return repo.getAllWeights(txn);
}

export async function getWeightEntry(
  id: string,
  txn?: IDatabase
): Promise<BodyWeightEntry | null> {
  const db = txn || (await getDatabase());
  const repo = new SQLiteBodyWeightRepository(db);
  return repo.getWeightById(id, txn);
}

export async function getWeightHistory(
  startDate: string,
  endDate: string,
  txn?: IDatabase
): Promise<BodyWeightEntry[]> {
  const db = txn || (await getDatabase());
  const repo = new SQLiteBodyWeightRepository(db);
  return repo.getWeightsByDateRange(startDate, endDate, txn);
}

export async function getWeightsForDate(
  date: string,
  txn?: IDatabase
): Promise<BodyWeightEntry[]> {
  const db = txn || (await getDatabase());
  const repo = new SQLiteBodyWeightRepository(db);
  return repo.getWeightsForDate(date, txn);
}

export async function getLatestWeight(txn?: IDatabase): Promise<BodyWeightEntry | null> {
  const db = txn || (await getDatabase());
  const repo = new SQLiteBodyWeightRepository(db);
  return repo.getLatestWeight(txn);
}

export async function recordWeight(
  entry: BodyWeightEntry,
  txn?: IDatabase
): Promise<void> {
  if (txn) {
    const repo = new SQLiteBodyWeightRepository(txn);
    await repo.insertWeight(entry, txn);
  } else {
    const db = await getDatabase();
    await db.withExclusiveTransactionAsync(async (client) => {
      const repo = new SQLiteBodyWeightRepository(client);
      await repo.insertWeight(entry, client);
    });
  }
}

export async function updateWeight(
  entry: BodyWeightEntry,
  txn?: IDatabase
): Promise<void> {
  if (txn) {
    const repo = new SQLiteBodyWeightRepository(txn);
    await repo.updateWeight(entry, txn);
  } else {
    const db = await getDatabase();
    await db.withExclusiveTransactionAsync(async (client) => {
      const repo = new SQLiteBodyWeightRepository(client);
      await repo.updateWeight(entry, client);
    });
  }
}

export async function deleteWeight(
  id: string,
  txn?: IDatabase
): Promise<void> {
  if (txn) {
    const repo = new SQLiteBodyWeightRepository(txn);
    await repo.deleteWeight(id, txn);
  } else {
    const db = await getDatabase();
    await db.withExclusiveTransactionAsync(async (client) => {
      const repo = new SQLiteBodyWeightRepository(client);
      await repo.deleteWeight(id, client);
    });
  }
}

/**
 * Inserts a body weight entry and atomically synchronizes the user's current profile weight
 * if and only if the new entry represents the chronologically latest genuine weigh-in.
 */
export async function recordWeightWithProfileSync(
  entry: BodyWeightEntry,
  txn?: IDatabase
): Promise<{ updatedProfile: UserProfile | null; entry: BodyWeightEntry }> {
  const execute = async (client: IDatabase) => {
    const weightRepo = new SQLiteBodyWeightRepository(client);
    const profileRepo = new SQLiteProfileRepository(client);

    await weightRepo.insertWeight(entry, client);

    const allWeights = await weightRepo.getAllWeights(client);
    const latest = getLatestGenuineWeight(allWeights);

    let updatedProfile: UserProfile | null = null;
    if (latest && latest.id === entry.id) {
      const currentProfile = await profileRepo.getProfile();
      if (currentProfile && currentProfile.weightKg !== latest.weightKg) {
        const newProfile: UserProfile = {
          ...currentProfile,
          weightKg: latest.weightKg,
        };
        await profileRepo.saveProfile(newProfile, client);
        updatedProfile = newProfile;
      }
    }

    return { updatedProfile, entry };
  };

  if (txn) {
    return await execute(txn);
  } else {
    const db = await getDatabase();
    return await db.withExclusiveTransactionAsync(execute);
  }
}

/**
 * Updates an existing body weight entry and atomically synchronizes the user's current profile weight
 * if and only if the modified entry was the chronologically latest genuine weigh-in or was promoted
 * to become the latest genuine weigh-in. Unrelated older entry edits never alter the profile weight.
 */
export async function updateWeightWithProfileSync(
  entry: BodyWeightEntry,
  txn?: IDatabase
): Promise<{ updatedProfile: UserProfile | null; entry: BodyWeightEntry }> {
  const execute = async (client: IDatabase) => {
    const weightRepo = new SQLiteBodyWeightRepository(client);
    const profileRepo = new SQLiteProfileRepository(client);

    const allWeightsBefore = await weightRepo.getAllWeights(client);
    const prevLatest = getLatestGenuineWeight(allWeightsBefore);

    await weightRepo.updateWeight(entry, client);

    const allWeightsAfter = await weightRepo.getAllWeights(client);
    const newLatest = getLatestGenuineWeight(allWeightsAfter);

    let updatedProfile: UserProfile | null = null;

    // A profile sync should only occur if the modified entry was the latest,
    // or if the modification promoted this entry to become the latest!
    const wasLatest = prevLatest != null && prevLatest.id === entry.id;
    const isNowLatest = newLatest != null && newLatest.id === entry.id;

    if (wasLatest || isNowLatest) {
      if (newLatest) {
        const currentProfile = await profileRepo.getProfile();
        if (currentProfile && currentProfile.weightKg !== newLatest.weightKg) {
          const newProfile: UserProfile = {
            ...currentProfile,
            weightKg: newLatest.weightKg,
          };
          await profileRepo.saveProfile(newProfile, client);
          updatedProfile = newProfile;
        }
      }
    }

    return { updatedProfile, entry };
  };

  if (txn) {
    return await execute(txn);
  } else {
    const db = await getDatabase();
    return await db.withExclusiveTransactionAsync(execute);
  }
}

/**
 * Deletes a body weight entry and atomically updates the user's profile weight to the new
 * chronologically latest genuine weigh-in IF AND ONLY IF the deleted entry was the latest genuine weigh-in.
 * Deleting an older measurement leaves profile weight untouched.
 * If history becomes empty, preserves the current profile weight without modification.
 */
export async function deleteWeightWithProfileSync(
  id: string,
  txn?: IDatabase
): Promise<{ updatedProfile: UserProfile | null }> {
  const execute = async (client: IDatabase) => {
    const weightRepo = new SQLiteBodyWeightRepository(client);
    const profileRepo = new SQLiteProfileRepository(client);

    const allWeightsBefore = await weightRepo.getAllWeights(client);
    const prevLatest = getLatestGenuineWeight(allWeightsBefore);

    await weightRepo.deleteWeight(id, client);

    const allWeightsAfter = await weightRepo.getAllWeights(client);
    const newLatest = getLatestGenuineWeight(allWeightsAfter);

    let updatedProfile: UserProfile | null = null;

    // A profile sync should only occur if the deleted entry was the latest genuine weigh-in!
    const wasLatest = prevLatest != null && prevLatest.id === id;

    if (wasLatest) {
      if (newLatest) {
        // Fall back to the next newest genuine weigh-in
        const currentProfile = await profileRepo.getProfile();
        if (currentProfile && currentProfile.weightKg !== newLatest.weightKg) {
          const newProfile: UserProfile = {
            ...currentProfile,
            weightKg: newLatest.weightKg,
          };
          await profileRepo.saveProfile(newProfile, client);
          updatedProfile = newProfile;
        }
      } else {
        // History is now empty!
        // "Preserve profile values when history is empty."
        // "Deleting the final measurement: preserve profile values when history is empty."
        // Do NOT change profile.weightKg; leave it preserved as-is.
      }
    }

    return { updatedProfile };
  };

  if (txn) {
    return await execute(txn);
  } else {
    const db = await getDatabase();
    return await db.withExclusiveTransactionAsync(execute);
  }
}

// --- Body Measurement Services ---

export async function loadAllMeasurements(
  txn?: IDatabase
): Promise<BodyMeasurementEntry[]> {
  const db = txn || (await getDatabase());
  const repo = new SQLiteBodyMeasurementRepository(db);
  return repo.getAllMeasurements(txn);
}

export async function getMeasurementEntry(
  id: string,
  txn?: IDatabase
): Promise<BodyMeasurementEntry | null> {
  const db = txn || (await getDatabase());
  const repo = new SQLiteBodyMeasurementRepository(db);
  return repo.getMeasurementById(id, txn);
}

export async function getMeasurementsHistory(
  startDate: string,
  endDate: string,
  txn?: IDatabase
): Promise<BodyMeasurementEntry[]> {
  const db = txn || (await getDatabase());
  const repo = new SQLiteBodyMeasurementRepository(db);
  return repo.getMeasurementsByDateRange(startDate, endDate, txn);
}

export async function getMeasurementsForDate(
  date: string,
  txn?: IDatabase
): Promise<BodyMeasurementEntry[]> {
  const db = txn || (await getDatabase());
  const repo = new SQLiteBodyMeasurementRepository(db);
  return repo.getMeasurementsForDate(date, txn);
}

export async function getLatestMeasurement(
  txn?: IDatabase
): Promise<BodyMeasurementEntry | null> {
  const db = txn || (await getDatabase());
  const repo = new SQLiteBodyMeasurementRepository(db);
  return repo.getLatestMeasurement(txn);
}

export async function recordMeasurement(
  entry: BodyMeasurementEntry,
  txn?: IDatabase
): Promise<void> {
  if (txn) {
    const repo = new SQLiteBodyMeasurementRepository(txn);
    await repo.insertMeasurement(entry, txn);
  } else {
    const db = await getDatabase();
    await db.withExclusiveTransactionAsync(async (client) => {
      const repo = new SQLiteBodyMeasurementRepository(client);
      await repo.insertMeasurement(entry, client);
    });
  }
}

export async function updateMeasurement(
  entry: BodyMeasurementEntry,
  txn?: IDatabase
): Promise<void> {
  if (txn) {
    const repo = new SQLiteBodyMeasurementRepository(txn);
    await repo.updateMeasurement(entry, txn);
  } else {
    const db = await getDatabase();
    await db.withExclusiveTransactionAsync(async (client) => {
      const repo = new SQLiteBodyMeasurementRepository(client);
      await repo.updateMeasurement(entry, client);
    });
  }
}

export async function deleteMeasurement(
  id: string,
  txn?: IDatabase
): Promise<void> {
  if (txn) {
    const repo = new SQLiteBodyMeasurementRepository(txn);
    await repo.deleteMeasurement(id, txn);
  } else {
    const db = await getDatabase();
    await db.withExclusiveTransactionAsync(async (client) => {
      const repo = new SQLiteBodyMeasurementRepository(client);
      await repo.deleteMeasurement(id, client);
    });
  }
}

// --- Body Composition Services ---

export async function loadAllCompositions(
  txn?: IDatabase
): Promise<BodyCompositionEntry[]> {
  const db = txn || (await getDatabase());
  const repo = new SQLiteBodyCompositionRepository(db);
  return repo.getAllCompositions(txn);
}

export async function getCompositionEntry(
  id: string,
  txn?: IDatabase
): Promise<BodyCompositionEntry | null> {
  const db = txn || (await getDatabase());
  const repo = new SQLiteBodyCompositionRepository(db);
  return repo.getCompositionById(id, txn);
}

export async function getCompositionsHistory(
  startDate: string,
  endDate: string,
  txn?: IDatabase
): Promise<BodyCompositionEntry[]> {
  const db = txn || (await getDatabase());
  const repo = new SQLiteBodyCompositionRepository(db);
  return repo.getCompositionsByDateRange(startDate, endDate, txn);
}

export async function getLatestComposition(
  txn?: IDatabase
): Promise<BodyCompositionEntry | null> {
  const db = txn || (await getDatabase());
  const repo = new SQLiteBodyCompositionRepository(db);
  return repo.getLatestComposition(txn);
}

export async function recordComposition(
  entry: BodyCompositionEntry,
  txn?: IDatabase
): Promise<void> {
  if (txn) {
    const repo = new SQLiteBodyCompositionRepository(txn);
    await repo.insertComposition(entry, txn);
  } else {
    const db = await getDatabase();
    await db.withExclusiveTransactionAsync(async (client) => {
      const repo = new SQLiteBodyCompositionRepository(client);
      await repo.insertComposition(entry, client);
    });
  }
}

export async function updateComposition(
  entry: BodyCompositionEntry,
  txn?: IDatabase
): Promise<void> {
  if (txn) {
    const repo = new SQLiteBodyCompositionRepository(txn);
    await repo.updateComposition(entry, txn);
  } else {
    const db = await getDatabase();
    await db.withExclusiveTransactionAsync(async (client) => {
      const repo = new SQLiteBodyCompositionRepository(client);
      await repo.updateComposition(entry, client);
    });
  }
}

export async function deleteComposition(
  id: string,
  txn?: IDatabase
): Promise<void> {
  if (txn) {
    const repo = new SQLiteBodyCompositionRepository(txn);
    await repo.deleteComposition(id, txn);
  } else {
    const db = await getDatabase();
    await db.withExclusiveTransactionAsync(async (client) => {
      const repo = new SQLiteBodyCompositionRepository(client);
      await repo.deleteComposition(id, client);
    });
  }
}

// --- Progress Photo Services ---

export async function loadAllPhotos(txn?: IDatabase): Promise<ProgressPhoto[]> {
  const db = txn || (await getDatabase());
  const repo = new SQLiteProgressPhotoRepository(db);
  return repo.getAllPhotos(txn);
}

export async function getPhotoEntry(
  id: string,
  txn?: IDatabase
): Promise<ProgressPhoto | null> {
  const db = txn || (await getDatabase());
  const repo = new SQLiteProgressPhotoRepository(db);
  return repo.getPhotoById(id, txn);
}

export async function getPhotosHistory(
  startDate: string,
  endDate: string,
  txn?: IDatabase
): Promise<ProgressPhoto[]> {
  const db = txn || (await getDatabase());
  const repo = new SQLiteProgressPhotoRepository(db);
  return repo.getPhotosByDateRange(startDate, endDate, txn);
}

export async function getPhotosByPose(
  pose: PhotoPose,
  txn?: IDatabase
): Promise<ProgressPhoto[]> {
  const db = txn || (await getDatabase());
  const repo = new SQLiteProgressPhotoRepository(db);
  return repo.getPhotosByPose(pose, txn);
}

export async function getFavoritePhotos(txn?: IDatabase): Promise<ProgressPhoto[]> {
  const db = txn || (await getDatabase());
  const repo = new SQLiteProgressPhotoRepository(db);
  return repo.getFavoritePhotos(txn);
}

export async function recordPhoto(
  photo: ProgressPhoto,
  txn?: IDatabase
): Promise<void> {
  if (txn) {
    const repo = new SQLiteProgressPhotoRepository(txn);
    await repo.insertPhoto(photo, txn);
  } else {
    const db = await getDatabase();
    await db.withExclusiveTransactionAsync(async (client) => {
      const repo = new SQLiteProgressPhotoRepository(client);
      await repo.insertPhoto(photo, client);
    });
  }
}

export async function updatePhoto(
  photo: ProgressPhoto,
  txn?: IDatabase
): Promise<void> {
  if (txn) {
    const repo = new SQLiteProgressPhotoRepository(txn);
    await repo.updatePhoto(photo, txn);
  } else {
    const db = await getDatabase();
    await db.withExclusiveTransactionAsync(async (client) => {
      const repo = new SQLiteProgressPhotoRepository(client);
      await repo.updatePhoto(photo, client);
    });
  }
}

export async function deletePhoto(
  id: string,
  txn?: IDatabase
): Promise<void> {
  if (txn) {
    const repo = new SQLiteProgressPhotoRepository(txn);
    await repo.deletePhoto(id, txn);
  } else {
    const db = await getDatabase();
    await db.withExclusiveTransactionAsync(async (client) => {
      const repo = new SQLiteProgressPhotoRepository(client);
      await repo.deletePhoto(id, client);
    });
  }
}

export async function togglePhotoFavorite(
  id: string,
  isFavorite: boolean,
  txn?: IDatabase
): Promise<void> {
  if (txn) {
    const repo = new SQLiteProgressPhotoRepository(txn);
    await repo.togglePhotoFavorite(id, isFavorite, txn);
  } else {
    const db = await getDatabase();
    await db.withExclusiveTransactionAsync(async (client) => {
      const repo = new SQLiteProgressPhotoRepository(client);
      await repo.togglePhotoFavorite(id, isFavorite, client);
    });
  }
}
