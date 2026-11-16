import { useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppButton } from './AppButton';
import { AppInput } from './AppInput';
import type { Translator } from '../i18n';
import type { Meal, MealType } from '../models/meal';
import { themeColors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { createId } from '../utils/id';
import { formatLocalDate, formatLocalTime, parseStrictNutrientInput } from '../utils/nutrition';
import { activeRowStyle, activeTextAlign, activeWritingDirection } from '../utils/rtl';

const MEAL_SLOTS: { type: MealType; key: string; icon: string }[] = [
  { type: 'breakfast', key: 'meals.breakfast', icon: 'sunny-outline' },
  { type: 'lunch', key: 'meals.lunch', icon: 'restaurant-outline' },
  { type: 'dinner', key: 'meals.dinner', icon: 'moon-outline' },
  { type: 'snack', key: 'meals.snack', icon: 'cafe-outline' },
  { type: 'other', key: 'meals.other', icon: 'fast-food-outline' },
];

export type QuickAddMealModalProps = {
  visible: boolean;
  onClose: () => void;
  onSaveQuickMeal: (meal: Meal) => Promise<void> | void;
  t: Translator;
  language?: 'en' | 'ar';
  initialDate?: string;
  initialMealType?: MealType;
};

export function QuickAddMealModal({
  visible,
  onClose,
  onSaveQuickMeal,
  t,
  initialDate,
  initialMealType = 'snack',
}: QuickAddMealModalProps) {
  const colors = themeColors();
  const directionalText = {
    textAlign: activeTextAlign(),
    writingDirection: activeWritingDirection(),
  } as const;

  const [selectedSlot, setSelectedSlot] = useState<MealType>(initialMealType);
  const [title, setTitle] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fats, setFats] = useState('');
  const [notes, setNotes] = useState('');

  const [caloriesError, setCaloriesError] = useState('');
  const [proteinError, setProteinError] = useState('');
  const [carbsError, setCarbsError] = useState('');
  const [fatsError, setFatsError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function resetForm() {
    setSelectedSlot(initialMealType);
    setTitle('');
    setCalories('');
    setProtein('');
    setCarbs('');
    setFats('');
    setNotes('');
    setCaloriesError('');
    setProteinError('');
    setCarbsError('');
    setFatsError('');
    setIsSubmitting(false);
  }

  function getDefaultTitle(slot: MealType): string {
    switch (slot) {
      case 'breakfast':
        return t('meals.breakfast') || 'Breakfast';
      case 'lunch':
        return t('meals.lunch') || 'Lunch';
      case 'dinner':
        return t('meals.dinner') || 'Dinner';
      case 'snack':
        return t('meals.quickSnack') || t('meals.snack') || 'Quick Snack';
      case 'other':
      default:
        return t('meals.quickMeal') || 'Quick Meal';
    }
  }

  function handleDismiss() {
    if (isSubmitting) return;
    resetForm();
    onClose();
  }

  async function handleSave() {
    if (isSubmitting) return;

    let hasError = false;

    // Validate Calories (Required, positive, finite, max 100,000)
    const calResult = parseStrictNutrientInput(calories);
    if (calResult.isEmpty) {
      setCaloriesError(t('common.requiredMessage') || 'Required');
      hasError = true;
    } else if (!calResult.isValid) {
      setCaloriesError(calResult.errorMessageKey ? t(calResult.errorMessageKey as any) : (calResult.defaultMessage || 'Invalid calories'));
      hasError = true;
    } else {
      setCaloriesError('');
    }

    // Validate Protein (Optional, non-negative)
    let parsedProtein = 0;
    if (protein.trim()) {
      const pResult = parseStrictNutrientInput(protein, { allowZero: true });
      if (!pResult.isValid) {
        setProteinError(pResult.errorMessageKey ? t(pResult.errorMessageKey as any) : (pResult.defaultMessage || 'Invalid protein'));
        hasError = true;
      } else {
        setProteinError('');
        parsedProtein = pResult.value;
      }
    } else {
      setProteinError('');
    }

    // Validate Carbs (Optional, non-negative)
    let parsedCarbs = 0;
    if (carbs.trim()) {
      const cResult = parseStrictNutrientInput(carbs, { allowZero: true });
      if (!cResult.isValid) {
        setCarbsError(cResult.errorMessageKey ? t(cResult.errorMessageKey as any) : (cResult.defaultMessage || 'Invalid carbs'));
        hasError = true;
      } else {
        setCarbsError('');
        parsedCarbs = cResult.value;
      }
    } else {
      setCarbsError('');
    }

    // Validate Fats (Optional, non-negative)
    let parsedFats = 0;
    if (fats.trim()) {
      const fResult = parseStrictNutrientInput(fats, { allowZero: true });
      if (!fResult.isValid) {
        setFatsError(fResult.errorMessageKey ? t(fResult.errorMessageKey as any) : (fResult.defaultMessage || 'Invalid fats'));
        hasError = true;
      } else {
        setFatsError('');
        parsedFats = fResult.value;
      }
    } else {
      setFatsError('');
    }

    if (hasError) return;

    const finalTitle = title.trim() || getDefaultTitle(selectedSlot);
    const dateToUse = initialDate || formatLocalDate(new Date());
    const timeToUse = formatLocalTime(new Date());

    const quickMeal: Meal = {
      id: createId('meal'),
      title: finalTitle,
      name: finalTitle,
      date: dateToUse,
      time: timeToUse,
      mealType: selectedSlot,
      totalCalories: calResult.value,
      totalProtein: parsedProtein,
      totalCarbs: parsedCarbs,
      totalFat: parsedFats,
      totalFats: parsedFats,
      notes: notes.trim() || undefined,
      items: [], // Itemless meal
      isFavorite: false,
    };

    setIsSubmitting(true);
    try {
      await onSaveQuickMeal(quickMeal);
      resetForm();
      onClose();
    } catch {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleDismiss}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.backdrop}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.keyboardAvoid}
          >
            <SafeAreaView style={[styles.modalSheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
              {/* Header */}
              <View style={[styles.header, activeRowStyle(), { borderBottomColor: colors.border }]}>
                <View style={styles.headerTitleWrap}>
                  <Text style={[styles.headerTitle, directionalText, { color: colors.text }]}>
                    {t('meals.quickAddTitle') || 'Quick Add Calories'}
                  </Text>
                  <Text style={[styles.headerSubtitle, directionalText, { color: colors.textMuted }]}>
                    {t('meals.quickAddSubtitle') || 'Log calories directly without item breakdown.'}
                  </Text>
                </View>
                <Pressable
                  onPress={handleDismiss}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.cancel')}
                  style={styles.closeBtn}
                >
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </Pressable>
              </View>

              <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {/* Meal Slot Selection */}
                <Text style={[styles.fieldLabel, directionalText, { color: colors.textSecondary }]}>
                  {t('meals.mealSlot') || 'Meal slot'}
                </Text>
                <View style={[styles.slotChipsWrap, activeRowStyle()]}>
                  {MEAL_SLOTS.map((slot) => {
                    const isSelected = selectedSlot === slot.type;
                    return (
                      <Pressable
                        key={slot.type}
                        onPress={() => setSelectedSlot(slot.type)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        style={[
                          styles.slotChip,
                          activeRowStyle(),
                          {
                            backgroundColor: isSelected ? colors.primary : colors.card,
                            borderColor: isSelected ? colors.primary : colors.border,
                          },
                        ]}
                      >
                        <Ionicons
                          name={slot.icon as any}
                          size={16}
                          color={isSelected ? colors.background : colors.textSecondary}
                          style={{ marginEnd: 4 }}
                        />
                        <Text
                          style={[
                            styles.slotChipText,
                            { color: isSelected ? colors.background : colors.text },
                          ]}
                        >
                          {t(slot.key as any) || slot.type}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Meal Title / Optional Description */}
                <AppInput
                  label={t('meals.mealName') || 'Meal name'}
                  placeholder={getDefaultTitle(selectedSlot)}
                  value={title}
                  onChangeText={setTitle}
                  editable={!isSubmitting}
                />

                {/* Calories Input (Required) */}
                <AppInput
                  label={`${t('common.calories') || 'Calories'} (${t('common.kcal') || 'kcal'}) *`}
                  placeholder="e.g. 450"
                  value={calories}
                  onChangeText={(val) => {
                    setCalories(val);
                    if (caloriesError) setCaloriesError('');
                  }}
                  keyboardType="numeric"
                  error={caloriesError}
                  editable={!isSubmitting}
                />

                {/* Quick Macros Grid (Optional) */}
                <Text style={[styles.fieldLabel, directionalText, { color: colors.textSecondary, marginTop: spacing.xs }]}>
                  {t('nutrition.macrosBreakdown') || 'Macros (Optional)'}
                </Text>
                <View style={[styles.macroRow, activeRowStyle()]}>
                  <View style={styles.macroCol}>
                    <AppInput
                      label={`${t('common.protein') || 'Protein'} (g)`}
                      placeholder="0"
                      value={protein}
                      onChangeText={(val) => {
                        setProtein(val);
                        if (proteinError) setProteinError('');
                      }}
                      keyboardType="numeric"
                      error={proteinError}
                      editable={!isSubmitting}
                    />
                  </View>
                  <View style={styles.macroCol}>
                    <AppInput
                      label={`${t('common.carbs') || 'Carbs'} (g)`}
                      placeholder="0"
                      value={carbs}
                      onChangeText={(val) => {
                        setCarbs(val);
                        if (carbsError) setCarbsError('');
                      }}
                      keyboardType="numeric"
                      error={carbsError}
                      editable={!isSubmitting}
                    />
                  </View>
                  <View style={styles.macroCol}>
                    <AppInput
                      label={`${t('common.fats') || 'Fats'} (g)`}
                      placeholder="0"
                      value={fats}
                      onChangeText={(val) => {
                        setFats(val);
                        if (fatsError) setFatsError('');
                      }}
                      keyboardType="numeric"
                      error={fatsError}
                      editable={!isSubmitting}
                    />
                  </View>
                </View>

                {/* Optional Notes */}
                <AppInput
                  label={t('common.notes') || 'Notes'}
                  placeholder={t('meals.notesPlaceholder') || 'Optional notes...'}
                  value={notes}
                  onChangeText={setNotes}
                  editable={!isSubmitting}
                />

                {/* Actions */}
                <View style={[styles.actionsRow, activeRowStyle()]}>
                  <AppButton
                    title={t('common.cancel')}
                    variant="secondary"
                    onPress={handleDismiss}
                    disabled={isSubmitting}
                    style={styles.actionBtn}
                  />
                  <AppButton
                    title={isSubmitting ? (t('common.saving') || 'Saving...') : (t('common.save') || 'Save')}
                    variant="primary"
                    onPress={handleSave}
                    disabled={isSubmitting}
                    style={styles.actionBtn}
                  />
                </View>
              </ScrollView>
            </SafeAreaView>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  keyboardAvoid: {
    width: '100%',
    maxHeight: '90%',
  },
  modalSheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    maxHeight: '100%',
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitleWrap: {
    flex: 1,
    marginEnd: spacing.sm,
  },
  headerTitle: {
    ...typography.h3,
    fontSize: 18,
  },
  headerSubtitle: {
    ...typography.caption,
    marginTop: 2,
  },
  closeBtn: {
    padding: spacing.xs,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  fieldLabel: {
    ...typography.caption,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  slotChipsWrap: {
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  slotChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  slotChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  macroRow: {
    gap: spacing.sm,
  },
  macroCol: {
    flex: 1,
  },
  actionsRow: {
    marginTop: spacing.sm,
    gap: spacing.md,
  },
  actionBtn: {
    flex: 1,
  },
});
