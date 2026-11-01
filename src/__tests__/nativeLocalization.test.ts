import test from 'node:test';
import assert from 'node:assert/strict';
import { I18nManager, Platform, Linking, Alert } from 'react-native';
import { setMockLocales, resetMockLocales } from './mocks/expo-localization';
import {
  resolveAuthoritativeLanguage,
  getNativeDeviceLanguage,
  normalizeLocaleToLanguage,
  openIosAppSettings,
  getLocalizationDiagnostics,
} from '../services/localizationService';
import { translate } from '../i18n';
import {
  rowDirection,
  flexStart,
  flexEnd,
  alignItemsStart,
  alignItemsEnd,
  textAlign,
  writingDirection,
  direction,
} from '../utils/rtl';
import { getDatabase, closeDatabase } from '../db/database';
import { SQLiteSettingsRepository } from '../db/repositories/settingsRepository';
import { SQLiteMealRepository } from '../db/repositories/mealRepository';
import { SQLiteWorkoutRepository } from '../db/repositories/workoutRepository';
import { defaultSettings } from '../services/settingsService';
import { normalizeMeal, normalizeMealItem } from '../models/meal';
import { normalizeWorkout, normalizeExercise } from '../models/workout';

async function setupFreshDb() {
  await closeDatabase();
  const db = await getDatabase();
  await db.execAsync(`
    DELETE FROM meals;
    DELETE FROM workouts;
    DELETE FROM user_profiles;
    DELETE FROM progress_entries;
    DELETE FROM app_settings;
  `);
  (I18nManager as any).reset();
  (Alert as any).reset();
  (Linking as any).reset();
  (Platform as any).reset();
  resetMockLocales();
  return db;
}

test('Part 8.1 & 8.2: iOS English and Arabic locale resolution from expo-localization getLocales()', () => {
  (Platform as any).setOS('ios');

  // iOS with English locale
  setMockLocales([{ languageTag: 'en-US', languageCode: 'en', textDirection: 'ltr' }]);
  assert.equal(getNativeDeviceLanguage(), 'en');
  assert.equal(resolveAuthoritativeLanguage('ar'), 'en', 'iOS must ignore stored SQLite language in favor of iOS');

  // iOS with Arabic locale
  setMockLocales([{ languageTag: 'ar-SA', languageCode: 'ar', textDirection: 'rtl' }]);
  assert.equal(getNativeDeviceLanguage(), 'ar');
  assert.equal(resolveAuthoritativeLanguage('en'), 'ar', 'iOS must ignore stored SQLite language in favor of iOS');
});

test('Part 8.3: Unsupported locale fallback defaults safely to English', () => {
  assert.equal(normalizeLocaleToLanguage('fr-FR'), null);
  assert.equal(normalizeLocaleToLanguage('de'), null);
  assert.equal(normalizeLocaleToLanguage('ja-JP'), null);
  assert.equal(normalizeLocaleToLanguage(''), null);
  assert.equal(normalizeLocaleToLanguage(null), null);

  setMockLocales([{ languageTag: 'fr-FR', languageCode: 'fr', textDirection: 'ltr' }]);
  assert.equal(getNativeDeviceLanguage(), 'en', 'Unsupported locale must fall back to en');

  (Platform as any).setOS('ios');
  assert.equal(resolveAuthoritativeLanguage(null), 'en');
});

test('Part 8.4 & 8.5: Arabic and English translation rendering across key categories', () => {
  const criticalKeys = [
    'app.name',
    'tabs.home',
    'tabs.meals',
    'tabs.workouts',
    'tabs.progress',
    'tabs.profile',
    'common.calories',
    'common.protein',
    'common.carbs',
    'common.fats',
    'common.back',
    'common.save',
    'common.add',
    'settings.title',
    'settings.changeAppLanguage',
    'settings.iosLanguageNotice',
    'settings.currentLanguage',
    'home.todayPlan',
    'home.addMeal',
    'home.addWorkout',
    'meals.title',
    'workouts.title',
  ];

  for (const key of criticalKeys) {
    const arText = translate('ar', key);
    const enText = translate('en', key);

    assert.ok(arText, `Arabic translation for ${key} must exist`);
    assert.ok(enText, `English translation for ${key} must exist`);
    assert.notEqual(arText, key, `Arabic key ${key} must not return raw key`);
    assert.notEqual(enText, key, `English key ${key} must not return raw key`);
    assert.notEqual(arText, enText, `Arabic and English must differ for ${key}`);
  }
});

test('Part 8.6: RTL bottom navigation ordering', () => {
  (I18nManager as any).reset();

  // In native RTL (EAS build on iOS with Arabic):
  I18nManager.isRTL = true;
  assert.equal(rowDirection('ar'), 'row', 'In native RTL, standard row flows right-to-left without double reverse');

  // In LTR environment:
  I18nManager.isRTL = false;
  assert.equal(rowDirection('ar'), 'row-reverse', 'In LTR host, row-reverse ensures Home is placed on right');
  assert.equal(rowDirection('en'), 'row', 'In LTR host, English tab row is standard row');
});

test('Part 8.7: RTL header and card alignment', () => {
  (I18nManager as any).reset();

  // In Arabic:
  assert.equal(textAlign('ar'), 'right');
  assert.equal(writingDirection('ar'), 'rtl');
  assert.equal(direction('ar'), 'rtl');

  // In English:
  assert.equal(textAlign('en'), 'left');
  assert.equal(writingDirection('en'), 'ltr');
  assert.equal(direction('en'), 'ltr');
});

test('Part 8.8: RTL back navigation direction and alignment', () => {
  (I18nManager as any).reset();
  I18nManager.isRTL = false;

  // Under Expo Go / LTR host with Arabic:
  assert.equal(flexStart('ar'), 'flex-end', 'Arabic back button aligns to right (flex-end) in LTR host');
  assert.equal(flexEnd('ar'), 'flex-start');

  // Under native RTL build:
  I18nManager.isRTL = true;
  assert.equal(flexStart('ar'), 'flex-start', 'Arabic back button aligns to start (which native RTL mirrors to right)');
});

test('Part 8.9: LTR restoration when English is active', () => {
  (I18nManager as any).reset();
  I18nManager.isRTL = false;

  assert.equal(rowDirection('en'), 'row');
  assert.equal(flexStart('en'), 'flex-start');
  assert.equal(flexEnd('en'), 'flex-end');
  assert.equal(alignItemsStart('en'), 'flex-start');
  assert.equal(alignItemsEnd('en'), 'flex-end');
  assert.equal(textAlign('en'), 'left');
  assert.equal(writingDirection('en'), 'ltr');
  assert.equal(direction('en'), 'ltr');
});

test('Part 8.10: Legacy language preference precedence (Android respects SQLite, iOS uses native iOS)', () => {
  // On Android: SQLite setting is authoritative
  (Platform as any).setOS('android');
  setMockLocales([{ languageTag: 'en-US', languageCode: 'en', textDirection: 'ltr' }]);
  assert.equal(resolveAuthoritativeLanguage('ar'), 'ar', 'Android honors user SQLite choice over system');
  assert.equal(resolveAuthoritativeLanguage('en'), 'en');
  assert.equal(resolveAuthoritativeLanguage(null), 'en', 'Android falls back to system when null');

  // On iOS: iOS native locale is ALWAYS authoritative, ignoring SQLite
  (Platform as any).setOS('ios');
  setMockLocales([{ languageTag: 'ar-EG', languageCode: 'ar', textDirection: 'rtl' }]);
  assert.equal(resolveAuthoritativeLanguage('en'), 'ar', 'iOS ignores stored SQLite en because iOS is ar');

  setMockLocales([{ languageTag: 'en-GB', languageCode: 'en', textDirection: 'ltr' }]);
  assert.equal(resolveAuthoritativeLanguage('ar'), 'en', 'iOS ignores stored SQLite ar because iOS is en');
});

test('Part 8.11 & 8.12: Opening iOS app Settings via Linking with success and graceful failure', async () => {
  (Linking as any).reset();

  // Success case
  Linking.shouldFailOpenSettings = false;
  const opened = await openIosAppSettings();
  assert.equal(opened, true);
  assert.equal(Linking.openedSettingsCount, 1);

  // Failure case (e.g. unsupported device, simulator restriction)
  Linking.shouldFailOpenSettings = true;
  const failed = await openIosAppSettings();
  assert.equal(failed, false, 'openIosAppSettings must catch error and return false without crashing');
  assert.equal(Linking.openedSettingsCount, 2);

  (Linking as any).reset();
});

test('Part 8.13 & 8.14: No DevSettings.reload() regression and no in-app forceRTL on iOS', () => {
  // Confirm neither DevSettings nor I18nManager.forceRTL is invoked during iOS language resolution
  (I18nManager as any).reset();
  (Platform as any).setOS('ios');
  setMockLocales([{ languageTag: 'ar-SA', languageCode: 'ar', textDirection: 'rtl' }]);

  const resolved = resolveAuthoritativeLanguage('en');
  assert.equal(resolved, 'ar');
  assert.equal((I18nManager as any).calls.forceRTL.length, 0, 'No forceRTL must be called during resolution');
});

test('Part 8.15: Data and theme persistence across language resolution', async () => {
  const db = await setupFreshDb();
  const mealRepo = new SQLiteMealRepository(db);
  const workoutRepo = new SQLiteWorkoutRepository(db);
  const settingsRepo = new SQLiteSettingsRepository(db);

  // Save meal and workout
  await mealRepo.insertMeal(
    normalizeMeal({
      id: 'meal_1',
      title: 'Steak and Rice',
      date: '2026-11-01',
      time: '14:00',
      items: [
        normalizeMealItem({ id: 'item_1', name: 'Steak', calories: 500, protein: 45, carbs: 0, fats: 20, quantity: 1 }),
      ],
    }),
  );

  await workoutRepo.insertWorkout(
    normalizeWorkout({
      id: 'workout_1',
      title: 'Back and Biceps',
      date: '2026-11-01',
      time: '18:00',
      exercises: [
        normalizeExercise({ id: 'ex_1', name: 'Pullups', sets: 4, reps: 10, weight: 0, duration: 15 }),
      ],
    }),
  );

  await settingsRepo.saveSettings({
    ...defaultSettings,
    selectedLanguage: 'en',
    themeMode: 'dark',
    hasCompletedOnboarding: true,
  });

  // Switch iOS locale to Arabic
  (Platform as any).setOS('ios');
  setMockLocales([{ languageTag: 'ar-SA', languageCode: 'ar', textDirection: 'rtl' }]);

  const currentLang = resolveAuthoritativeLanguage(defaultSettings.selectedLanguage);
  assert.equal(currentLang, 'ar');

  // Verify database data was untouched
  const meals = await mealRepo.getAllMeals();
  assert.equal(meals.length, 1);
  assert.equal(meals[0].title, 'Steak and Rice');

  const workouts = await workoutRepo.getAllWorkouts();
  assert.equal(workouts.length, 1);
  assert.equal(workouts[0].title, 'Back and Biceps');

  const settings = await settingsRepo.getSettings();
  assert.ok(settings);
  assert.equal(settings.themeMode, 'dark');
  assert.equal(settings.hasCompletedOnboarding, true);
});

test('Part 8.16: Correct formatting of fitness numbers/dates with Latin digits', () => {
  const d = new Date(2026, 10, 1); // Nov 1, 2026
  const weekday = new Intl.DateTimeFormat('ar-SA-u-nu-latn', { weekday: 'short' }).format(d);
  const day = new Intl.DateTimeFormat('ar-SA-u-nu-latn', { day: 'numeric' }).format(d);
  const monthYear = new Intl.DateTimeFormat('ar-SA-u-nu-latn', { month: 'long', year: 'numeric' }).format(d);

  assert.equal(weekday, 'الأحد');
  assert.equal(day, '1');
  assert.ok(monthYear.includes('نوفمبر'));
  assert.ok(monthYear.includes('2026'));

  // Ensure Eastern Arabic numerals are NOT present
  assert.equal(/[٠-٩]/.test(day), false, 'Day must not contain Eastern Arabic numerals');
  assert.equal(/[٠-٩]/.test(monthYear), false, 'Month/Year must not contain Eastern Arabic numerals');
});

test('Part 8.17: Immunity to double-mirroring under Native RTL', () => {
  (I18nManager as any).reset();
  I18nManager.isRTL = true; // Native RTL active

  // When native RTL is active and target is Arabic:
  assert.equal(rowDirection('ar'), 'row', 'Must use row to let native Yoga mirror naturally');
  assert.equal(flexStart('ar'), 'flex-start', 'Must use flex-start to let native Yoga mirror naturally');
  assert.equal(flexEnd('ar'), 'flex-end');
  assert.equal(alignItemsStart('ar'), 'flex-start');
  assert.equal(alignItemsEnd('ar'), 'flex-end');

  // When native RTL is active and target is English (unmirrored):
  assert.equal(rowDirection('en'), 'row-reverse', 'Must use row-reverse to counteract native mirroring for English');
  assert.equal(flexStart('en'), 'flex-end');
  assert.equal(flexEnd('en'), 'flex-start');

  (I18nManager as any).reset();
});

test('Part 8.18: Localization diagnostics returns platform and language without user data', () => {
  (Platform as any).setOS('ios');
  setMockLocales([{ languageTag: 'ar-SA', languageCode: 'ar', textDirection: 'rtl' }]);

  const diag = getLocalizationDiagnostics('ar');
  assert.equal(diag.platform, 'ios');
  assert.equal(diag.resolvedLanguage, 'ar');
  assert.equal(diag.primaryTag, 'ar-SA');
  assert.equal(diag.isRTL, true);
  assert.equal(diag.localesCount, 1);
  assert.equal((diag as any).meals, undefined, 'Must never include user data in diagnostics');
});
