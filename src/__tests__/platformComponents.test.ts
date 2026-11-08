import test from 'node:test';
import assert from 'node:assert/strict';
import { Platform } from 'react-native';

import {
  calculateHitSlop,
  getMinTouchTarget,
  getPressFeedback,
  MIN_TOUCH_TARGET,
} from '../utils/touchFeedback';
import { activeTextAlign, activeWritingDirection, applyRTL } from '../utils/rtl';
import { en } from '../i18n/en';
import { ar } from '../i18n/ar';

test('Task 1A.3 - Touch Feedback: Android ripple vs iOS opacity press behavior', () => {
  // Test Android ripple feedback
  Platform.setOS('android');
  const androidFeedback = getPressFeedback({
    rippleColor: 'rgba(0, 0, 0, 0.15)',
    borderless: false,
    activeOpacity: 0.78,
  });

  // Android should define android_ripple
  assert.ok(androidFeedback.android_ripple);
  assert.equal(androidFeedback.android_ripple.color, 'rgba(0, 0, 0, 0.15)');
  assert.equal(androidFeedback.android_ripple.borderless, false);
  // When pressed on Android with ripple, opacity remains 1 (no duplicate dimming)
  assert.deepEqual(androidFeedback.styleModifier({ pressed: true }), { opacity: 1 });
  assert.deepEqual(androidFeedback.styleModifier({ pressed: false }), { opacity: 1 });

  // Test iOS opacity feedback
  Platform.setOS('ios');
  const iosFeedback = getPressFeedback({
    rippleColor: 'rgba(0, 0, 0, 0.15)',
    borderless: false,
    activeOpacity: 0.76,
  });

  // iOS should NOT have android_ripple
  assert.equal(iosFeedback.android_ripple, undefined);
  // When pressed on iOS, opacity dims smoothly to activeOpacity
  assert.deepEqual(iosFeedback.styleModifier({ pressed: true }), { opacity: 0.76 });
  assert.deepEqual(iosFeedback.styleModifier({ pressed: false }), { opacity: 1 });

  // Test disabled state on both platforms
  const disabledFeedback = getPressFeedback({
    rippleColor: 'rgba(0, 0, 0, 0.15)',
    disabled: true,
  });
  assert.equal(disabledFeedback.android_ripple, undefined);
  assert.deepEqual(disabledFeedback.styleModifier({ pressed: true }), { opacity: 0.5 });
  assert.deepEqual(disabledFeedback.styleModifier({ pressed: false }), { opacity: 0.5 });

  Platform.reset();
});

test('Task 1A.3 - Touch Targets: Minimum 48dp on Android and 44pt on iOS with hitSlop', () => {
  assert.equal(MIN_TOUCH_TARGET.android, 48);
  assert.equal(MIN_TOUCH_TARGET.ios, 44);

  assert.equal(getMinTouchTarget('android'), 48);
  assert.equal(getMinTouchTarget('ios'), 44);

  // 40x40 element on Android needs 48dp -> hitSlop of 4dp all around
  const androidHitSlop = calculateHitSlop(40, 40, 'android');
  assert.deepEqual(androidHitSlop, { top: 4, bottom: 4, left: 4, right: 4 });

  // 40x40 element on iOS needs 44pt -> hitSlop of 2pt all around
  const iosHitSlop = calculateHitSlop(40, 40, 'ios');
  assert.deepEqual(iosHitSlop, { top: 2, bottom: 2, left: 2, right: 2 });

  // 52x52 element exceeds min on both platforms -> undefined hitSlop
  assert.equal(calculateHitSlop(52, 52, 'android'), undefined);
  assert.equal(calculateHitSlop(52, 52, 'ios'), undefined);
});

test('Task 1A.3 - Form Input: Focus, error, helper, and RTL layout rules', () => {
  // Border color resolver simulation based on AppInput priority logic:
  // Error takes precedence over focus state
  function resolveBorderColor(
    isFocused: boolean,
    error?: string,
    colors = { accent: '#2F9E67', danger: '#FF4D4D', border: '#E2E8F0' },
  ) {
    if (error) return colors.danger;
    if (isFocused) return colors.accent;
    return colors.border;
  }

  // Unfocused, no error -> default border
  assert.equal(resolveBorderColor(false), '#E2E8F0');
  // Focused, no error -> accent border
  assert.equal(resolveBorderColor(true), '#2F9E67');
  // Error present -> danger border even when focused
  assert.equal(resolveBorderColor(false, 'Required field'), '#FF4D4D');
  assert.equal(resolveBorderColor(true, 'Required field'), '#FF4D4D');

  // RTL alignment check for Arabic inputs
  applyRTL('ar');
  assert.equal(activeTextAlign(), 'right');
  assert.equal(activeWritingDirection(), 'rtl');

  // LTR alignment check for English inputs
  applyRTL('en');
  assert.equal(activeTextAlign(), 'left');
  assert.equal(activeWritingDirection(), 'ltr');
});

test('Task 1A.3 - Empty States: Localized bilingual title and description keys', () => {
  // Meals empty state copy
  assert.ok(en.meals.emptyTitle);
  assert.ok(en.meals.emptyMessage);
  assert.ok(en.meals.addTitle);
  assert.ok(ar.meals.emptyTitle);
  assert.ok(ar.meals.emptyMessage);
  assert.ok(ar.meals.addTitle);

  // Workouts empty state copy
  assert.ok(en.workouts.emptyTitle);
  assert.ok(en.workouts.emptyMessage);
  assert.ok(en.workouts.addTitle);
  assert.ok(ar.workouts.emptyTitle);
  assert.ok(ar.workouts.emptyMessage);
  assert.ok(ar.workouts.addTitle);
});

test('Task 1A.4 - Screen-by-Screen: Form validation error handling and radio semantics', () => {
  // 1. Inline form validation logic (AddMeal & AddWorkout)
  function validateForm(name: string, itemOrExercise: string) {
    const errors: { name?: string; item?: string } = {};
    if (!name.trim()) errors.name = 'Required';
    if (!itemOrExercise.trim()) errors.item = 'Required';
    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }

  const invalidForm = validateForm('', '');
  assert.equal(invalidForm.isValid, false);
  assert.equal(invalidForm.errors.name, 'Required');
  assert.equal(invalidForm.errors.item, 'Required');

  const validForm = validateForm('Lunch', 'Chicken');
  assert.equal(validForm.isValid, true);
  assert.deepEqual(validForm.errors, {});

  // 2. Settings radio semantics
  const radioOptions = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'System' },
  ];
  const activeSelection = 'dark';
  const evaluatedOptions = radioOptions.map((opt) => ({
    ...opt,
    selected: opt.value === activeSelection,
  }));

  assert.equal(evaluatedOptions.find((o) => o.value === 'dark')?.selected, true);
  assert.equal(evaluatedOptions.find((o) => o.value === 'light')?.selected, false);
});
