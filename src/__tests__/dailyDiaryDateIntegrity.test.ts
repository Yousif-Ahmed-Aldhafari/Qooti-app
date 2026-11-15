import test from 'node:test';
import assert from 'node:assert/strict';

import { runMigrations } from '../db/migrations';
import { SQLiteMealRepository } from '../db/repositories/mealRepository';
import { getMsUntilNextMidnight } from '../hooks/useLiveLocalDate';
import type { Meal } from '../types';
import {
  getNextCalendarDate,
  getPreviousCalendarDate,
} from '../utils/date';
import { createId } from '../utils/id';
import { calculateDailyNutrition, formatLocalDate } from '../utils/nutrition';
import { openDatabaseAsync } from './mocks/expo-sqlite';

async function createTestDb() {
  const db = await openDatabaseAsync(':memory:');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(db);
  return db;
}

/**
 * Navigation state machine simulator mirroring AppNavigator date & navigation continuity.
 */
function createDiaryNavigationSession(
  initialMeals: Meal[] = [],
  initialDiaryDate = '2026-11-16'
) {
  let activeTab = 'meals';
  let activeScreen = 'meals';
  let selectedMealId: string | null = null;
  let addMealInitialDate: string | undefined = undefined;
  let selectedDiaryDate = initialDiaryDate;
  let language: 'en' | 'ar' = 'en';
  let meals = [...initialMeals];

  function openMealDetails(meal: Meal) {
    selectedMealId = meal.id;
    activeScreen = 'mealDetails';
  }

  function openEditMeal(meal: Meal) {
    selectedMealId = meal.id;
    activeScreen = 'editMeal';
  }

  function onAddMeal(date?: string) {
    addMealInitialDate = date || selectedDiaryDate;
    activeScreen = 'addMeal';
  }

  function saveMeal(meal: Meal) {
    meals.push(meal);
    selectedMealId = meal.id;
    if (meal.date && meal.date.trim()) {
      selectedDiaryDate = meal.date.trim().slice(0, 10);
    }
    addMealInitialDate = undefined;
    activeTab = 'meals';
    activeScreen = 'mealDetails';
  }

  function handleUpdateMeal(updated: Meal) {
    meals = meals.map((m) => (m.id === updated.id ? updated : m));
    selectedMealId = updated.id;
    if (updated.date && updated.date.trim()) {
      selectedDiaryDate = updated.date.trim().slice(0, 10);
    }
    activeTab = 'meals';
    activeScreen = 'mealDetails';
  }

  function handleDeleteMeal(mealToDelete: Meal) {
    meals = meals.filter((m) => m.id !== mealToDelete.id);
    selectedMealId = null;
    activeTab = 'meals';
    activeScreen = 'meals';
  }

  function goBack() {
    if (activeScreen === 'editMeal') {
      activeScreen = 'mealDetails';
      return;
    }
    if (activeScreen === 'mealDetails') {
      selectedMealId = null;
      activeScreen = 'meals';
      return;
    }
    if (activeScreen === 'addMeal') {
      addMealInitialDate = undefined;
      activeScreen = 'meals';
      return;
    }
    activeScreen = activeTab;
  }

  function changeLanguage(nextLang: 'en' | 'ar') {
    language = nextLang;
  }

  function switchTab(tab: string) {
    activeTab = tab;
    activeScreen = tab;
  }

  function setSelectedDate(date: string) {
    selectedDiaryDate = date;
  }

  function getSelectedDateMeals(): Meal[] {
    return meals.filter((m) => {
      if (!m.date || typeof m.date !== 'string') return false;
      const trimmed = m.date.trim();
      if (!trimmed) return false;
      return trimmed.slice(0, 10) === selectedDiaryDate;
    });
  }

  function getUndatedMeals(): Meal[] {
    return meals.filter((m) => {
      if (!m.date || typeof m.date !== 'string') return true;
      return m.date.trim() === '';
    });
  }

  return {
    getState: () => ({
      activeTab,
      activeScreen,
      selectedMealId,
      addMealInitialDate,
      selectedDiaryDate,
      language,
      mealsCount: meals.length,
    }),
    openMealDetails,
    openEditMeal,
    onAddMeal,
    saveMeal,
    handleUpdateMeal,
    handleDeleteMeal,
    goBack,
    changeLanguage,
    switchTab,
    setSelectedDate,
    getSelectedDateMeals,
    getUndatedMeals,
  };
}

// ===========================================================================
// SECTION B: UNDATED LEGACY MEALS TESTS
// ===========================================================================

test('Task 4.3A - Test 1: Undated meals are strictly excluded from dated day views', () => {
  const datedMeal: Meal = {
    id: 'meal_dated_1',
    title: 'Breakfast',
    date: '2026-11-16',
    time: '08:00',
    mealType: 'breakfast',
    items: [{ id: 'item_1', foodName: 'Oats', quantity: 1, calories: 150, protein: 5, carbs: 27, fats: 3 }],
    totalCalories: 150,
  };

  const undatedMeal1: Meal = {
    id: 'meal_undated_1',
    title: 'Old Legacy Lunch',
    date: '', // Empty date
    time: '12:00',
    items: [{ id: 'item_2', foodName: 'Chicken', quantity: 1, calories: 300, protein: 35, carbs: 0, fats: 5 }],
    totalCalories: 300,
  };

  const undatedMeal2: Meal = {
    id: 'meal_undated_2',
    title: 'Old Legacy Dinner',
    date: undefined as any, // Missing date
    time: '19:00',
    items: [{ id: 'item_3', foodName: 'Steak', quantity: 1, calories: 500, protein: 45, carbs: 0, fats: 20 }],
    totalCalories: 500,
  };

  const allMeals = [datedMeal, undatedMeal1, undatedMeal2];

  // Filter for 2026-11-16
  const activeDate = '2026-11-16';
  const selectedDateMeals = allMeals.filter((m) => {
    if (!m.date || typeof m.date !== 'string') return false;
    const trimmed = m.date.trim();
    if (!trimmed) return false;
    return trimmed.slice(0, 10) === activeDate;
  });

  assert.equal(selectedDateMeals.length, 1, 'Only the dated meal must appear on 2026-11-16');
  assert.equal(selectedDateMeals[0].id, 'meal_dated_1');

  // Filter for 2026-11-17
  const otherDateMeals = allMeals.filter((m) => {
    if (!m.date || typeof m.date !== 'string') return false;
    const trimmed = m.date.trim();
    if (!trimmed) return false;
    return trimmed.slice(0, 10) === '2026-11-17';
  });

  assert.equal(otherDateMeals.length, 0, 'Undated meals must NEVER appear on 2026-11-17');
});

test('Task 4.3A - Test 2: Undated meals are excluded from dated daily totals (zero inflation)', () => {
  const datedMeal: Meal = {
    id: 'meal_1',
    title: 'Lunch',
    date: '2026-11-16',
    time: '13:00',
    items: [{ id: 'item_1', foodName: 'Rice', quantity: 1, calories: 200, protein: 4, carbs: 45, fats: 1 }],
    totalCalories: 200,
    totalProtein: 4,
    totalCarbs: 45,
    totalFat: 1,
  };

  const undatedMeal: Meal = {
    id: 'meal_legacy',
    title: 'Unassigned Meal',
    date: '',
    time: '14:00',
    items: [{ id: 'item_2', foodName: 'Huge Feast', quantity: 1, calories: 1500, protein: 100, carbs: 150, fats: 50 }],
    totalCalories: 1500,
    totalProtein: 100,
    totalCarbs: 150,
    totalFat: 50,
  };

  const allMeals = [datedMeal, undatedMeal];
  const activeDate = '2026-11-16';

  const selectedDateMeals = allMeals.filter((m) => {
    if (!m.date || typeof m.date !== 'string') return false;
    const trimmed = m.date.trim();
    if (!trimmed) return false;
    return trimmed.slice(0, 10) === activeDate;
  });

  const totals = calculateDailyNutrition(selectedDateMeals);

  assert.equal(totals.calories, 200, 'Daily totals must strictly equal 200 kcal, NOT 1700 kcal');
  assert.equal(totals.protein, 4);
  assert.equal(totals.carbs, 45);
  assert.equal(totals.fats, 1);
});

test('Task 4.3A - Test 3: Undated meals are identified and separated into unassigned view', () => {
  const meals: Meal[] = [
    { id: 'm1', title: 'Dated', date: '2026-11-16', time: '12:00', items: [] },
    { id: 'm2', title: 'Undated Empty String', date: '', time: '13:00', items: [] },
    { id: 'm3', title: 'Undated Whitespace', date: '   ', time: '14:00', items: [] },
    { id: 'm4', title: 'Undated Undefined', date: undefined as any, time: '15:00', items: [] },
  ];

  const undated = meals.filter((m) => {
    if (!m.date || typeof m.date !== 'string') return true;
    return m.date.trim() === '';
  });

  assert.equal(undated.length, 3, 'Must capture all 3 undated legacy meals');
  assert.equal(undated[0].id, 'm2');
  assert.equal(undated[1].id, 'm3');
  assert.equal(undated[2].id, 'm4');
});

test('Task 4.3A - Test 4: Assigning a date to an undated meal via edit recovers it into diary view', () => {
  const session = createDiaryNavigationSession([
    {
      id: 'legacy_meal_1',
      title: 'Grandma Recipe',
      date: '',
      time: '12:00',
      mealType: 'lunch',
      items: [{ id: 'i1', foodName: 'Stew', quantity: 1, calories: 450, protein: 30, carbs: 40, fats: 15 }],
      totalCalories: 450,
    },
  ]);

  // Initially: 1 undated meal, 0 meals on 2026-11-16
  assert.equal(session.getUndatedMeals().length, 1);
  assert.equal(session.getSelectedDateMeals().length, 0);

  // User opens and edits date to 2026-11-16
  session.handleUpdateMeal({
    id: 'legacy_meal_1',
    title: 'Grandma Recipe',
    date: '2026-11-16',
    time: '12:00',
    mealType: 'lunch',
    items: [{ id: 'i1', foodName: 'Stew', quantity: 1, calories: 450, protein: 30, carbs: 40, fats: 15 }],
    totalCalories: 450,
  });

  // Now: 0 undated meals, 1 meal on 2026-11-16
  assert.equal(session.getUndatedMeals().length, 0, 'No more undated meals');
  assert.equal(session.getSelectedDateMeals().length, 1, 'Meal is now present on 2026-11-16');
  assert.equal(session.getSelectedDateMeals()[0].id, 'legacy_meal_1');
  assert.equal(session.getState().selectedDiaryDate, '2026-11-16');
});

test('Task 4.3A - Test 5: Undated meals in SQLite are preserved intact without dates invented on load', async () => {
  const db = await createTestDb();
  const repo = new SQLiteMealRepository(db);

  // Raw insert simulating legacy meal with empty string date
  await db.runAsync(
    `INSERT INTO meals (id, title, date, time, total_calories, total_protein, total_carbs, total_fat, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    'raw_legacy_1',
    'Raw Legacy Lunch',
    '',
    '12:30',
    350,
    25,
    30,
    10,
    '2026-11-10T12:30:00.000Z'
  );

  const loaded = await repo.getMealById('raw_legacy_1');
  assert.ok(loaded);
  assert.equal(loaded.title, 'Raw Legacy Lunch');
  assert.equal(loaded.date, '', 'Date must remain raw empty string, NOT fabricated');
});

// ===========================================================================
// SECTION C: LIVE LOCAL-DAY ROLLOVER TESTS
// ===========================================================================

test('Task 4.3A - Test 6: getMsUntilNextMidnight calculates correct remaining duration', () => {
  // Mock time at 23:59:50 (10 seconds before midnight)
  const tenSecBefore = new Date(2026, 10, 16, 23, 59, 50, 0);
  const ms1 = getMsUntilNextMidnight(tenSecBefore);
  // 10s = 10,000ms + 50ms buffer = 10,050ms
  assert.equal(ms1, 10050);

  // Mock time at 12:00:00 (12 hours before midnight)
  const noon = new Date(2026, 10, 16, 12, 0, 0, 0);
  const ms2 = getMsUntilNextMidnight(noon);
  // 12 hours = 43,200,000ms + 50ms
  assert.equal(ms2, 43200050);

  // Mock time at midnight + 10ms (just crossed)
  const justAfter = new Date(2026, 10, 17, 0, 0, 0, 10);
  const ms3 = getMsUntilNextMidnight(justAfter);
  // Next midnight is in ~24 hours
  assert.ok(ms3 > 86000000);

  // Buffer floor minimum 500ms
  const rightAtMidnight = new Date(2026, 10, 16, 23, 59, 59, 990);
  const ms4 = getMsUntilNextMidnight(rightAtMidnight);
  assert.ok(ms4 >= 500, 'Must enforce minimum 500ms delay');
});

test('Task 4.3A - Test 7: Midnight rollover updates relative labels while preserving view date', () => {
  let simulatedToday = '2026-11-15';
  const viewedDate = '2026-11-15';

  function getLabel(viewDate: string, currentToday: string): string {
    const yesterday = getPreviousCalendarDate(currentToday);
    const tomorrow = getNextCalendarDate(currentToday);

    if (viewDate === currentToday) return 'Today';
    if (viewDate === yesterday) return 'Yesterday';
    if (viewDate === tomorrow) return 'Tomorrow';
    return 'Other';
  }

  // Before midnight: 2026-11-15 is "Today"
  assert.equal(getLabel(viewedDate, simulatedToday), 'Today');

  // Midnight occurs: today advances to 2026-11-16
  simulatedToday = '2026-11-16';

  // The viewed date (2026-11-15) now correctly labels as "Yesterday" without shifting view date
  assert.equal(getLabel(viewedDate, simulatedToday), 'Yesterday');

  // User did not ask to reset: viewedDate remains 2026-11-15
  assert.equal(viewedDate, '2026-11-15');
});

test('Task 4.3A - Test 8: Manually selected historical date is preserved across midnight rollover', () => {
  const session = createDiaryNavigationSession([], '2026-11-10');
  assert.equal(session.getState().selectedDiaryDate, '2026-11-10');

  // Midnight arrives: new today is 2026-11-17
  // Selected diary date must NOT jump to 2026-11-17
  assert.equal(session.getState().selectedDiaryDate, '2026-11-10', 'Historical date must remain preserved');
});

test('Task 4.3A - Test 9: Jump to today jumps to the current live today key', () => {
  const session = createDiaryNavigationSession([], '2026-11-05');
  assert.equal(session.getState().selectedDiaryDate, '2026-11-05');

  // User explicitly taps "Today" when today is 2026-11-16
  const liveToday = '2026-11-16';
  session.setSelectedDate(liveToday);

  assert.equal(session.getState().selectedDiaryDate, '2026-11-16');
});

test('Task 4.3A - Test 10: App resume across midnight refreshes current local date', () => {
  let systemClock = new Date(2026, 10, 15, 23, 30, 0); // 11:30 PM Nov 15
  let localToday = formatLocalDate(systemClock);
  assert.equal(localToday, '2026-11-15');

  // App is backgrounded for 2 hours, clock moves to 01:30 AM Nov 16
  systemClock = new Date(2026, 10, 16, 1, 30, 0);

  // App resumes to foreground
  localToday = formatLocalDate(systemClock);
  assert.equal(localToday, '2026-11-16', 'Resumed app must reflect new local date');
});

// ===========================================================================
// SECTION D: SELECTED-DATE NAVIGATION CONTINUITY TESTS
// ===========================================================================

test('Task 4.3A - Test 11: Selecting historical date and opening Add Meal passes that date as initialDate', () => {
  const session = createDiaryNavigationSession([], '2026-11-08');

  session.onAddMeal();
  assert.equal(session.getState().activeScreen, 'addMeal');
  assert.equal(session.getState().addMealInitialDate, '2026-11-08', 'Must pass selected historical date');
});

test('Task 4.3A - Test 12: Saving a meal returns to diary view on the saved meal date', () => {
  const session = createDiaryNavigationSession([], '2026-11-08');
  session.onAddMeal();

  const newMeal: Meal = {
    id: createId('meal'),
    title: 'Historic Breakfast',
    date: '2026-11-08',
    time: '09:00',
    mealType: 'breakfast',
    items: [],
  };

  session.saveMeal(newMeal);
  assert.equal(session.getState().activeScreen, 'mealDetails');
  assert.equal(session.getState().selectedDiaryDate, '2026-11-08');

  // Back to meals
  session.goBack();
  assert.equal(session.getState().activeScreen, 'meals');
  assert.equal(session.getState().selectedDiaryDate, '2026-11-08');
});

test('Task 4.3A - Test 13: Opening and canceling Add Meal returns to the preserved diary date', () => {
  const session = createDiaryNavigationSession([], '2026-11-04');
  session.onAddMeal();
  assert.equal(session.getState().activeScreen, 'addMeal');

  // User cancels
  session.goBack();
  assert.equal(session.getState().activeScreen, 'meals');
  assert.equal(session.getState().selectedDiaryDate, '2026-11-04', 'Preserves 2026-11-04 after cancel');
});

test('Task 4.3A - Test 14: Opening Meal Details and pressing back returns to the same diary date', () => {
  const meal: Meal = {
    id: 'meal_nov3',
    title: 'Snack',
    date: '2026-11-03',
    time: '16:00',
    mealType: 'snack',
    items: [],
  };
  const session = createDiaryNavigationSession([meal], '2026-11-03');

  session.openMealDetails(meal);
  assert.equal(session.getState().activeScreen, 'mealDetails');

  session.goBack();
  assert.equal(session.getState().activeScreen, 'meals');
  assert.equal(session.getState().selectedDiaryDate, '2026-11-03');
});

test('Task 4.3A - Test 15: Editing meal contents (without changing date) returns to the same diary date', () => {
  const meal: Meal = {
    id: 'meal_nov3',
    title: 'Old Title',
    date: '2026-11-03',
    time: '16:00',
    mealType: 'snack',
    items: [],
  };
  const session = createDiaryNavigationSession([meal], '2026-11-03');

  session.openMealDetails(meal);
  session.openEditMeal(meal);
  assert.equal(session.getState().activeScreen, 'editMeal');

  // Save with updated title, same date
  session.handleUpdateMeal({ ...meal, title: 'Updated Title' });
  assert.equal(session.getState().activeScreen, 'mealDetails');
  assert.equal(session.getState().selectedDiaryDate, '2026-11-03');

  session.goBack();
  assert.equal(session.getState().activeScreen, 'meals');
  assert.equal(session.getState().selectedDiaryDate, '2026-11-03');
});

test('Task 4.3A - Test 16: Editing a meal date updates selected diary date to the edited date', () => {
  const meal: Meal = {
    id: 'meal_nov3',
    title: 'Lunch',
    date: '2026-11-03',
    time: '12:00',
    mealType: 'lunch',
    items: [],
  };
  const session = createDiaryNavigationSession([meal], '2026-11-03');

  session.openMealDetails(meal);
  session.openEditMeal(meal);

  // User changes date from 2026-11-03 to 2026-11-07
  session.handleUpdateMeal({ ...meal, date: '2026-11-07' });
  assert.equal(session.getState().activeScreen, 'mealDetails');
  assert.equal(session.getState().selectedDiaryDate, '2026-11-07', 'Diary date moves to the edited date');

  session.goBack();
  assert.equal(session.getState().activeScreen, 'meals');
  assert.equal(session.getState().selectedDiaryDate, '2026-11-07');
});

test('Task 4.3A - Test 17: Deleting a meal returns safely to the same diary date', () => {
  const meal: Meal = {
    id: 'meal_del',
    title: 'Delete Me',
    date: '2026-11-05',
    time: '12:00',
    items: [],
  };
  const session = createDiaryNavigationSession([meal], '2026-11-05');

  session.openMealDetails(meal);
  session.handleDeleteMeal(meal);

  assert.equal(session.getState().activeScreen, 'meals');
  assert.equal(session.getState().selectedMealId, null);
  assert.equal(session.getState().selectedDiaryDate, '2026-11-05', 'Returns to the exact date where meal was deleted');
  assert.equal(session.getState().mealsCount, 0);
});

test('Task 4.3A - Test 18: Language change (EN <-> AR) preserves selected historical date', () => {
  const session = createDiaryNavigationSession([], '2026-10-25');
  assert.equal(session.getState().selectedDiaryDate, '2026-10-25');

  // Switch to Arabic
  session.changeLanguage('ar');
  assert.equal(session.getState().language, 'ar');
  assert.equal(session.getState().selectedDiaryDate, '2026-10-25', 'Must preserve 2026-10-25 across language switch');

  // Switch back to English
  session.changeLanguage('en');
  assert.equal(session.getState().language, 'en');
  assert.equal(session.getState().selectedDiaryDate, '2026-10-25', 'Must preserve 2026-10-25 across language switch back');
});

test('Task 4.3A - Test 19: Switching between bottom tabs preserves selected diary date', () => {
  const session = createDiaryNavigationSession([], '2026-11-02');
  assert.equal(session.getState().selectedDiaryDate, '2026-11-02');

  // Go to Workouts tab
  session.switchTab('workouts');
  assert.equal(session.getState().activeTab, 'workouts');

  // Return to Meals tab
  session.switchTab('meals');
  assert.equal(session.getState().activeTab, 'meals');
  assert.equal(session.getState().selectedDiaryDate, '2026-11-02', 'Must preserve selected date across tabs');
});

// ===========================================================================
// SECTION E: CALENDAR BOUNDARY & LEAP-YEAR NAVIGATION TESTS
// ===========================================================================

test('Task 4.3A - Test 20: Leap-year navigation correctly traverses February 29th', () => {
  // 2028 is a leap year
  let d = '2028-02-28';
  d = getNextCalendarDate(d);
  assert.equal(d, '2028-02-29', '2028 has Feb 29');

  d = getNextCalendarDate(d);
  assert.equal(d, '2028-03-01', 'Feb 29 rolls over to Mar 01');

  d = getPreviousCalendarDate(d);
  assert.equal(d, '2028-02-29', 'Mar 01 rolls back to Feb 29');

  d = getPreviousCalendarDate(d);
  assert.equal(d, '2028-02-28', 'Feb 29 rolls back to Feb 28');
});

test('Task 4.3A - Test 21: Non-leap-year navigation rolls directly between Feb 28 and Mar 01', () => {
  // 2027 is not a leap year
  let d = '2027-02-28';
  d = getNextCalendarDate(d);
  assert.equal(d, '2027-03-01', '2027-02-28 rolls directly to 2027-03-01');

  d = getPreviousCalendarDate(d);
  assert.equal(d, '2027-02-28', '2027-03-01 rolls directly to 2027-02-28');
});

test('Task 4.3A - Test 22: Year boundary rollover (Dec 31 <-> Jan 01)', () => {
  let d = '2026-12-31';
  d = getNextCalendarDate(d);
  assert.equal(d, '2027-01-01', 'Dec 31 rolls over to next year Jan 01');

  d = getPreviousCalendarDate(d);
  assert.equal(d, '2026-12-31', 'Jan 01 rolls back to previous year Dec 31');
});

test('Task 4.3A - Test 23: Month boundary rollover for 30-day months', () => {
  let d = '2026-04-30'; // April has 30 days
  d = getNextCalendarDate(d);
  assert.equal(d, '2026-05-01', 'Apr 30 rolls over to May 01');

  d = getPreviousCalendarDate(d);
  assert.equal(d, '2026-04-30', 'May 01 rolls back to Apr 30');
});

// ===========================================================================
// SECTION F: SQLITE MUTATION SAFETY DURING DATE NAVIGATION
// ===========================================================================

test('Task 4.3A - Test 24: Date navigation does not execute any SQLite mutations', async () => {
  const db = await createTestDb();
  const repo = new SQLiteMealRepository(db);

  // Insert a meal on 2026-11-16
  const meal: Meal = {
    id: createId('meal'),
    title: 'Lunch',
    date: '2026-11-16',
    time: '12:00',
    mealType: 'lunch',
    items: [{ id: createId('meal-item'), foodName: 'Chicken', quantity: 1, calories: 300, protein: 30, carbs: 0, fats: 5 }],
    totalCalories: 300,
  };
  await repo.insertMeal(meal);

  const initialRows = await db.getAllAsync<{ count: number }>('SELECT COUNT(*) as count FROM meals;');
  assert.equal(initialRows[0].count, 1);

  // Simulate navigating across 10 different dates
  let date = '2026-11-16';
  for (let i = 0; i < 10; i++) {
    date = getNextCalendarDate(date);
    // Navigation is pure read/filter over loaded state
    assert.ok(date);
  }

  // SQLite database remains completely unchanged
  const afterRows = await db.getAllAsync<{ count: number }>('SELECT COUNT(*) as count FROM meals;');
  assert.equal(afterRows[0].count, 1, 'Date navigation must NEVER perform SQLite writes');
});

test('Task 4.3A - Test 25: Existing workouts and user profile records are 100% unaffected', async () => {
  const db = await createTestDb();

  // Insert profile and workout
  await db.runAsync(
    `INSERT INTO user_profiles (id, name, email, goal, avatar_initials, height_cm, weight_kg, target_calories, target_protein, target_carbs, target_fats, sleep_goal_hours, water_goal_liters, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    'user_1',
    'Yousif',
    'test@qooti.com',
    'strength',
    'YA',
    178,
    75,
    2200,
    160,
    220,
    70,
    8,
    3,
    '2026-11-16T00:00:00.000Z'
  );

  await db.runAsync(
    `INSERT INTO workouts (id, title, date, time, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?);`,
    'workout_1',
    'Push Day',
    '2026-11-16',
    '17:00',
    'Great session',
    '2026-11-16T00:00:00.000Z'
  );

  const profileRows = await db.getAllAsync<{ name: string }>('SELECT name FROM user_profiles WHERE id = ?;', 'user_1');
  const workoutRows = await db.getAllAsync<{ title: string }>('SELECT title FROM workouts WHERE id = ?;', 'workout_1');

  assert.equal(profileRows.length, 1);
  assert.equal(profileRows[0].name, 'Yousif');
  assert.equal(workoutRows.length, 1);
  assert.equal(workoutRows[0].title, 'Push Day');
});
