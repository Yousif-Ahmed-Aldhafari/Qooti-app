import test from 'node:test';
import assert from 'node:assert/strict';

import AsyncStorage from './mocks/async-storage';
import { STORAGE_KEYS } from '../constants/storageKeys';
import { loadMeals, saveMeals } from '../services/mealService';
import { loadWorkouts, saveWorkouts } from '../services/workoutService';
import { loadProfile, saveProfile } from '../services/profileService';
import { loadProgressEntries, saveProgressEntries } from '../services/progressService';
import { defaultSettings, loadSettings, saveSettings } from '../services/settingsService';
import { getOptionalJson, setJson } from '../services/storageService';
import { normalizeMeal, type Meal } from '../models/meal';
import { normalizeWorkout, type Workout } from '../models/workout';
import { normalizeProfile } from '../models/profile';
import { normalizeProgressEntry } from '../models/progress';
import { getSeedMeals, getSeedProfile, getSeedWorkouts } from '../data/seedData';

test('Integration: Startup Hydration on First Launch (empty storage initializes defaults)', async () => {
  await AsyncStorage.clear();

  const [savedMeals, savedWorkouts, savedProfile, savedSettings] = await Promise.all([
    loadMeals(),
    loadWorkouts(),
    loadProfile(),
    loadSettings(),
  ]);

  // Before any user action, raw storage is null
  assert.equal(savedMeals, null);
  assert.equal(savedWorkouts, null);
  assert.equal(savedProfile, null);
  assert.equal(savedSettings, null);

  // System seeds data on first launch
  const isFirstLaunch = savedSettings === null && savedMeals === null && savedWorkouts === null;
  assert.equal(isFirstLaunch, true);

  const initialMeals = isFirstLaunch ? getSeedMeals() : [];
  const initialWorkouts = isFirstLaunch ? getSeedWorkouts() : [];
  const initialProfile = getSeedProfile();
  const initialSettings = { ...defaultSettings };

  assert.ok(initialMeals.length > 0);
  assert.ok(initialWorkouts.length > 0);
  assert.equal(initialSettings.hasCompletedOnboarding, false);

  // First launch writes seed state so subsequent launches don't re-seed
  await Promise.all([
    saveMeals(initialMeals),
    saveWorkouts(initialWorkouts),
    saveProfile(initialProfile),
    saveSettings(initialSettings),
  ]);

  const persistedMeals = await loadMeals();
  assert.ok(persistedMeals);
  assert.equal(persistedMeals.length, initialMeals.length);
});

test('Integration: Hydration preserves empty data without re-seeding', async () => {
  await AsyncStorage.clear();

  // User has completed onboarding and cleared all meals and workouts
  await saveSettings({ ...defaultSettings, hasCompletedOnboarding: true });
  await saveMeals([]);
  await saveWorkouts([]);

  const savedSettings = await loadSettings();
  const savedMeals = await loadMeals();
  const savedWorkouts = await loadWorkouts();

  // Storage contains empty array, NOT null
  assert.deepEqual(savedMeals, []);
  assert.deepEqual(savedWorkouts, []);

  const isFirstLaunch = savedSettings === null && savedMeals === null && savedWorkouts === null;
  assert.equal(isFirstLaunch, false);

  // Authoritative state must remain empty and NOT overwrite with seed data
  const resolvedMeals = savedMeals !== null ? savedMeals : getSeedMeals();
  const resolvedWorkouts = savedWorkouts !== null ? savedWorkouts : getSeedWorkouts();

  assert.deepEqual(resolvedMeals, []);
  assert.deepEqual(resolvedWorkouts, []);
});

test('Integration: Malformed storage recovery does not crash', async () => {
  await AsyncStorage.clear();

  // Write corrupt JSON strings into storage
  await AsyncStorage.setItem(STORAGE_KEYS.meals, '{ corrupted json: !!');
  await AsyncStorage.setItem(STORAGE_KEYS.settings, 'INVALID_JSON');

  // Load functions must safely handle JSON syntax errors and return null
  const loadedMeals = await loadMeals();
  const loadedSettings = await loadSettings();

  assert.equal(loadedMeals, null);
  assert.equal(loadedSettings, null);

  // Safe fallback can be applied without unhandled rejection
  const fallbackSettings = loadedSettings ?? defaultSettings;
  assert.equal(fallbackSettings.selectedLanguage, 'en');
});

test('Integration: Sequential write queue prevents race conditions and out-of-order writes', async () => {
  await AsyncStorage.clear();

  const key = '@test/queue';

  // Issue 5 rapid writes in sequence
  const writes = [
    setJson(key, { value: 1 }),
    setJson(key, { value: 2 }),
    setJson(key, { value: 3 }),
    setJson(key, { value: 4 }),
    setJson(key, { value: 5 }),
  ];

  await Promise.all(writes);

  const final = await getOptionalJson<{ value: number }>(key);
  assert.ok(final);
  // Final value must strictly be the last write (5), not an earlier write that finished late
  assert.equal(final.value, 5);
});

test('Integration: Meal CRUD lifecycle and persistence', async () => {
  await AsyncStorage.clear();

  // 1. Create (Add)
  const newMeal: Meal = normalizeMeal({
    id: 'meal-crud-1',
    title: 'Post-Workout Shake',
    date: '2026-10-30',
    time: '11:00',
    items: [
      {
        id: 'item-1',
        foodName: 'Whey Protein',
        quantity: 1,
        calories: 130,
        protein: 26,
        carbs: 2,
        fats: 2,
      },
    ],
  });

  await saveMeals([newMeal]);
  let meals = await loadMeals();
  assert.ok(meals);
  assert.equal(meals.length, 1);
  assert.equal(meals[0].title, 'Post-Workout Shake');
  assert.equal(meals[0].name, 'Post-Workout Shake');
  assert.equal(meals[0].totalCalories, 130);
  assert.equal(meals[0].totalProtein, 26);

  // 2. Update
  const updatedMeal: Meal = normalizeMeal({
    ...meals[0],
    title: 'Mega Protein Shake',
    items: [
      ...meals[0].items,
      {
        id: 'item-2',
        foodName: 'Peanut Butter',
        quantity: 32,
        calories: 190,
        protein: 8,
        carbs: 7,
        fats: 16,
      },
    ],
  });

  await saveMeals([updatedMeal]);
  meals = await loadMeals();
  assert.ok(meals);
  assert.equal(meals.length, 1);
  assert.equal(meals[0].title, 'Mega Protein Shake');
  assert.equal(meals[0].items.length, 2);
  assert.equal(meals[0].totalCalories, 320);
  assert.equal(meals[0].totalProtein, 34);

  // 3. Delete
  const remainingMeals = meals.filter((m) => m.id !== 'meal-crud-1');
  await saveMeals(remainingMeals);
  meals = await loadMeals();
  assert.ok(meals);
  assert.equal(meals.length, 0);
});

test('Integration: Workout CRUD lifecycle and persistence', async () => {
  await AsyncStorage.clear();

  // 1. Create
  const workout: Workout = normalizeWorkout({
    id: 'workout-crud-1',
    title: 'Leg Day',
    date: '2026-10-30',
    time: '18:00',
    exercises: [
      {
        id: 'ex-1',
        exerciseName: 'Squat',
        sets: 4,
        reps: 8,
        weight: 100,
        duration: 20,
        notes: 'Deep reps',
      },
    ],
  });

  await saveWorkouts([workout]);
  let workouts = await loadWorkouts();
  assert.ok(workouts);
  assert.equal(workouts.length, 1);
  assert.equal(workouts[0].title, 'Leg Day');
  assert.equal(workouts[0].name, 'Leg Day');
  assert.equal(workouts[0].exercises[0].exerciseName, 'Squat');
  assert.equal(workouts[0].exercises[0].name, 'Squat');

  // 2. Update
  const updatedWorkout: Workout = normalizeWorkout({
    ...workouts[0],
    title: 'Heavy Leg Day',
    exercises: [
      ...workouts[0].exercises,
      {
        id: 'ex-2',
        exerciseName: 'Leg Press',
        sets: 3,
        reps: 12,
        weight: 180,
        duration: 15,
        notes: '',
      },
    ],
  });

  await saveWorkouts([updatedWorkout]);
  workouts = await loadWorkouts();
  assert.ok(workouts);
  assert.equal(workouts.length, 1);
  assert.equal(workouts[0].title, 'Heavy Leg Day');
  assert.equal(workouts[0].exercises.length, 2);

  // 3. Delete
  const remainingWorkouts = workouts.filter((w) => w.id !== 'workout-crud-1');
  await saveWorkouts(remainingWorkouts);
  workouts = await loadWorkouts();
  assert.ok(workouts);
  assert.equal(workouts.length, 0);
});

test('Integration: Profile and Progress mutation persistence', async () => {
  await AsyncStorage.clear();

  const profile = normalizeProfile({
    id: 'prof-test',
    name: 'Fatima Al-Hassan',
    email: 'fatima@qooti.app',
    goal: 'Hypertrophy',
    weightKg: 62,
    targetCalories: 2300,
    targetProtein: 145,
    targetCarbs: 250,
    targetFats: 75,
  });

  await saveProfile(profile);
  const loadedProfile = await loadProfile();
  assert.ok(loadedProfile);
  assert.equal(loadedProfile.name, 'Fatima Al-Hassan');
  assert.equal(loadedProfile.avatarInitials, 'FA');
  assert.equal(loadedProfile.targetFats, 75);
  assert.equal(loadedProfile.targetFat, 75);

  const progress = [
    normalizeProgressEntry({
      id: 'entry-1',
      date: '2026-10-29',
      weightKg: 62.2,
      calories: 2280,
      workouts: 1,
    }),
    normalizeProgressEntry({
      id: 'entry-2',
      date: '2026-10-30',
      weightKg: 62.0,
      calories: 2310,
      workouts: 1,
    }),
  ];

  await saveProgressEntries(progress);
  const loadedProgress = await loadProgressEntries();
  assert.ok(loadedProgress);
  assert.equal(loadedProgress.length, 2);
  assert.equal(loadedProgress[1].weightKg, 62.0);
});

test('Integration: Persistence across simulated app restart', async () => {
  await AsyncStorage.clear();

  // Session 1: User completes onboarding, adds custom meal, and updates language to Arabic
  const userSettings = {
    ...defaultSettings,
    hasCompletedOnboarding: true,
    selectedLanguage: 'ar' as const,
    themeMode: 'dark' as const,
  };
  const userMeal = normalizeMeal({
    id: 'session-meal-1',
    title: 'وجبة العشاء',
    date: '2026-10-30',
    time: '20:30',
    items: [
      {
        id: 'item-d1',
        foodName: 'Grilled Fish',
        quantity: 200,
        calories: 250,
        protein: 40,
        carbs: 0,
        fats: 8,
      },
    ],
  });

  await saveSettings(userSettings);
  await saveMeals([userMeal]);

  // Session 2: App restarts (re-hydrating from storage)
  const [restoredSettings, restoredMeals] = await Promise.all([loadSettings(), loadMeals()]);

  assert.ok(restoredSettings);
  assert.equal(restoredSettings.hasCompletedOnboarding, true);
  assert.equal(restoredSettings.selectedLanguage, 'ar');
  assert.equal(restoredSettings.themeMode, 'dark');

  assert.ok(restoredMeals);
  assert.equal(restoredMeals.length, 1);
  assert.equal(restoredMeals[0].title, 'وجبة العشاء');
  assert.equal(restoredMeals[0].items[0].protein, 40);
});
