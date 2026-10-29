import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeMeal, normalizeMealItem } from '../models/meal';
import { normalizeWorkout, normalizeExercise } from '../models/workout';
import { normalizeProfile } from '../models/profile';
import { normalizeProgressEntry } from '../models/progress';
import { calculateMealTotals, calculateDailyNutrition, progressRatio, safeNumber } from '../utils/nutrition';
import { isRTL, direction, textAlign, writingDirection, rowStyle } from '../utils/rtl';
import { isRTLLanguage, getDirection, getTextAlign, getWritingDirection } from '../utils/languageDirection';
import { defaultSettings, loadSettings, saveSettings } from '../services/settingsService';
import { saveMeals, loadMeals } from '../services/mealService';
import { saveWorkouts, loadWorkouts } from '../services/workoutService';
import { saveProfile, loadProfile } from '../services/profileService';
import { saveProgressEntries, loadProgressEntries } from '../services/progressService';
import { translate } from '../i18n';
import AsyncStorage from '../__tests__/mocks/async-storage';

test('Domain Models: normalizeMealItem harmonizes foodName/name and fats/fat', () => {
  const itemFromLegacy = normalizeMealItem({
    id: 'legacy-1',
    foodName: 'Grilled chicken',
    quantity: 150,
    calories: 200,
    protein: 30,
    carbs: 0,
    fats: 5,
  });

  assert.equal(itemFromLegacy.foodName, 'Grilled chicken');
  assert.equal(itemFromLegacy.name, 'Grilled chicken');
  assert.equal(itemFromLegacy.fats, 5);
  assert.equal(itemFromLegacy.fat, 5);

  const itemFromNew = normalizeMealItem({
    id: 'new-1',
    name: 'Basmati rice',
    quantity: 180,
    calories: 230,
    protein: 4,
    carbs: 50,
    fat: 2,
  });

  assert.equal(itemFromNew.foodName, 'Basmati rice');
  assert.equal(itemFromNew.name, 'Basmati rice');
  assert.equal(itemFromNew.fats, 2);
  assert.equal(itemFromNew.fat, 2);
});

test('Domain Models: normalizeMeal harmonizes title/name and calculates totals', () => {
  const meal = normalizeMeal({
    id: 'm1',
    title: 'Lunch Bowl',
    date: '2026-10-29',
    time: '12:30',
    items: [
      {
        id: 'i1',
        foodName: 'Chicken',
        quantity: 100,
        calories: 165,
        protein: 31,
        carbs: 0,
        fats: 4,
      },
      {
        id: 'i2',
        name: 'Rice',
        foodName: 'Rice',
        quantity: 100,
        calories: 130,
        protein: 3,
        carbs: 28,
        fats: 1,
        fat: 1,
      },
    ],
  });

  assert.equal(meal.title, 'Lunch Bowl');
  assert.equal(meal.name, 'Lunch Bowl');
  assert.equal(meal.totalCalories, 295);
  assert.equal(meal.totalProtein, 34);
  assert.equal(meal.totalCarbs, 28);
  assert.equal(meal.totalFat, 5);
  assert.equal(meal.totalFats, 5);
});

test('Domain Models: normalizeWorkout and normalizeExercise harmonize title/name', () => {
  const exercise = normalizeExercise({
    id: 'ex-1',
    exerciseName: 'Bench Press',
    sets: 3,
    reps: 10,
    weight: 60,
    duration: 15,
    notes: 'Smooth tempo',
  });

  assert.equal(exercise.exerciseName, 'Bench Press');
  assert.equal(exercise.name, 'Bench Press');

  const workout = normalizeWorkout({
    id: 'w-1',
    title: 'Push Day',
    date: '2026-10-29',
    time: '18:00',
    exercises: [exercise],
  });

  assert.equal(workout.title, 'Push Day');
  assert.equal(workout.name, 'Push Day');
  assert.equal(workout.exercises[0].exerciseName, 'Bench Press');
});

test('Domain Models: normalizeProfile harmonizes targetFat/targetFats and initials', () => {
  const profile = normalizeProfile({
    id: 'p-1',
    name: 'Sara Ahmed',
    email: 'sara@qooti.app',
    goal: 'Build strength',
    targetCalories: 2200,
    targetProtein: 140,
    targetCarbs: 240,
    targetFats: 70,
  });

  assert.equal(profile.avatarInitials, 'SA');
  assert.equal(profile.targetFats, 70);
  assert.equal(profile.targetFat, 70);
});

test('Domain Models: normalizeProgressEntry harmonizes label and date', () => {
  const entry = normalizeProgressEntry({
    id: 'prog-1',
    label: 'Mon',
    calories: 2000,
    workouts: 1,
    weightKg: 64.5,
  });

  assert.equal(entry.label, 'Mon');
  assert.equal(entry.date, 'Mon');
  assert.equal(entry.steps, 0);
});

test('Nutrition Utils: calculateMealTotals and calculateDailyNutrition support both models', () => {
  const items = [
    { id: '1', foodName: 'Oats', quantity: 40, calories: 150, protein: 5, carbs: 27, fats: 3 },
    { id: '2', foodName: 'Milk', name: 'Milk', quantity: 200, calories: 100, protein: 7, carbs: 10, fats: 2, fat: 2 },
  ];

  const totals = calculateMealTotals(items);
  assert.equal(totals.calories, 250);
  assert.equal(totals.protein, 12);
  assert.equal(totals.carbs, 37);
  assert.equal(totals.fats, 5);
  assert.equal(totals.fat, 5);

  const meal = normalizeMeal({
    id: 'm1',
    title: 'Breakfast',
    date: '2026-10-29',
    time: '08:00',
    items,
  });

  const dailyTotals = calculateDailyNutrition([meal]);
  assert.equal(dailyTotals.calories, 250);
  assert.equal(dailyTotals.protein, 12);
  assert.equal(dailyTotals.carbs, 37);
  assert.equal(dailyTotals.fats, 5);

  assert.equal(progressRatio(50, 100), 0.5);
  assert.equal(progressRatio(150, 100), 1);
  assert.equal(safeNumber(undefined), 0);
  assert.equal(safeNumber(42), 42);
});

test('RTL and Language: direction utilities match across consolidated files', () => {
  assert.equal(isRTL('ar'), true);
  assert.equal(isRTL('en'), false);
  assert.equal(isRTLLanguage('ar'), true);
  assert.equal(isRTLLanguage('en'), false);

  assert.equal(direction('ar'), 'rtl');
  assert.equal(direction('en'), 'ltr');
  assert.equal(getDirection('ar'), 'rtl');
  assert.equal(getDirection('en'), 'ltr');

  assert.equal(textAlign('ar'), 'right');
  assert.equal(textAlign('en'), 'left');
  assert.equal(getTextAlign('ar'), 'right');
  assert.equal(getTextAlign('en'), 'left');

  assert.equal(writingDirection('ar'), 'rtl');
  assert.equal(writingDirection('en'), 'ltr');
  assert.equal(getWritingDirection('ar'), 'rtl');
  assert.equal(getWritingDirection('en'), 'ltr');

  const arabicRow = rowStyle('ar');
  assert.equal(arabicRow.direction, 'rtl');
  assert.equal(arabicRow.flexDirection, 'row');
});

test('Settings Service: defaultSettings and legacy storage migration', async () => {
  await AsyncStorage.clear();

  assert.equal(defaultSettings.selectedLanguage, 'en');
  assert.equal(defaultSettings.themeMode, 'system');
  assert.equal(defaultSettings.measurementUnits, 'metric');
  assert.equal(defaultSettings.hasCompletedOnboarding, false);
  assert.equal(defaultSettings.isAuthenticated, false);

  // Test legacy key migration
  await AsyncStorage.setItem('@qooti/language', 'ar');
  await AsyncStorage.setItem('@qooti/hasOnboarded', 'true');
  await AsyncStorage.setItem('@qooti/themePreference', 'dark');

  const migrated = await loadSettings();
  assert.ok(migrated);
  assert.equal(migrated.selectedLanguage, 'ar');
  assert.equal(migrated.hasCompletedOnboarding, true);
  assert.equal(migrated.themeMode, 'dark');

  // Test saveSettings updates canonical and legacy keys
  await saveSettings({
    ...defaultSettings,
    selectedLanguage: 'en',
    hasCompletedOnboarding: true,
    themeMode: 'light',
  });

  const updated = await loadSettings();
  assert.ok(updated);
  assert.equal(updated.selectedLanguage, 'en');
  assert.equal(updated.themeMode, 'light');
  assert.equal(await AsyncStorage.getItem('@qooti/language'), 'en');
  assert.equal(await AsyncStorage.getItem('@qooti/themePreference'), 'light');
});

test('Persistence Services: roundtrip for meals, workouts, profile, and progress', async () => {
  await AsyncStorage.clear();

  const meal = normalizeMeal({
    id: 'test-meal-1',
    title: 'Protein Snack',
    date: '2026-10-29',
    time: '16:00',
    items: [],
  });
  await saveMeals([meal]);
  const loadedMeals = await loadMeals();
  assert.ok(loadedMeals);
  assert.equal(loadedMeals.length, 1);
  assert.equal(loadedMeals[0].title, 'Protein Snack');

  const workout = normalizeWorkout({
    id: 'test-workout-1',
    title: 'Leg Day',
    date: '2026-10-29',
    time: '17:00',
    exercises: [],
  });
  await saveWorkouts([workout]);
  const loadedWorkouts = await loadWorkouts();
  assert.ok(loadedWorkouts);
  assert.equal(loadedWorkouts.length, 1);
  assert.equal(loadedWorkouts[0].title, 'Leg Day');

  const profile = normalizeProfile({
    id: 'test-p-1',
    name: 'Sara Ahmed',
    email: 'sara@qooti.app',
    goal: 'Maintain',
  });
  await saveProfile(profile);
  const loadedProfile = await loadProfile();
  assert.ok(loadedProfile);
  assert.equal(loadedProfile.name, 'Sara Ahmed');
  assert.equal(loadedProfile.avatarInitials, 'SA');

  const progress = [normalizeProgressEntry({ id: 'pr-1', calories: 2100, workouts: 1, weightKg: 64 })];
  await saveProgressEntries(progress);
  const loadedProgress = await loadProgressEntries();
  assert.ok(loadedProgress);
  assert.equal(loadedProgress.length, 1);
  assert.equal(loadedProgress[0].calories, 2100);
});

test('i18n Translation: supports English and Arabic keys', () => {
  assert.equal(translate('en', 'common.save'), 'Save');
  assert.equal(translate('ar', 'common.save'), 'حفظ');
  assert.equal(translate('en', 'tabs.home'), 'Home');
  assert.equal(translate('ar', 'tabs.home'), 'الرئيسية');
});
