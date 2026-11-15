import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from 'react-native';

import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import { AppHeader } from '../components/AppHeader';
import { AppInput } from '../components/AppInput';
import type { Translator } from '../i18n';
import { themeColors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import type { Meal } from '../types';
import { createId } from '../utils/id';
import { formatLocalDate, formatLocalTime, parseStrictNutrient, parseStrictQuantity } from '../utils/nutrition';
import { validateMealDate, validateMealTime } from '../models/meal';
import { activeRowStyle, activeTextAlign, activeWritingDirection } from '../utils/rtl';

type MealItemEditState = {
  id: string;
  foodName: string;
  quantity: string;
  calories: string;
  protein: string;
  carbs: string;
  fats: string;
  unit: string;
};

type MealItemErrorMap = {
  foodName?: string;
  quantity?: string;
  calories?: string;
  protein?: string;
  carbs?: string;
  fats?: string;
};

type EditMealScreenProps = {
  t: Translator;
  meal: Meal;
  onSave: (meal: Meal) => Promise<void> | void;
  onCancel: () => void;
};

export function EditMealScreen({ t, meal, onSave, onCancel }: EditMealScreenProps) {
  const { width } = useWindowDimensions();
  const isCompact = width < 340;
  const colors = themeColors();

  const [title, setTitle] = useState(meal.title || meal.name || '');
  const [date, setDate] = useState(meal.date || formatLocalDate());
  const [time, setTime] = useState(meal.time || formatLocalTime());

  // Initialize items from meal, preserving item IDs. If itemless legacy meal, provide 1 item based on meal totals.
  const [items, setItems] = useState<MealItemEditState[]>(() => {
    if (meal.items && meal.items.length > 0) {
      return meal.items.map((item) => ({
        id: item.id,
        foodName: item.foodName || item.name || '',
        quantity: String(item.quantity ?? 1),
        calories: String(item.calories ?? 0),
        protein: String(item.protein ?? 0),
        carbs: String(item.carbs ?? 0),
        fats: String(item.fats ?? item.fat ?? 0),
        unit: item.unit || 'g',
      }));
    }
    return [
      {
        id: createId('meal-item'),
        foodName: meal.title || meal.name || '',
        quantity: '1',
        calories: String(meal.totalCalories ?? 0),
        protein: String(meal.totalProtein ?? 0),
        carbs: String(meal.totalCarbs ?? 0),
        fats: String(meal.totalFat ?? meal.totalFats ?? 0),
        unit: 'g',
      },
    ];
  });

  const [titleError, setTitleError] = useState('');
  const [dateError, setDateError] = useState('');
  const [timeError, setTimeError] = useState('');
  const [itemErrors, setItemErrors] = useState<Record<string, MealItemErrorMap>>({});
  const [saveError, setSaveError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const directionalText = {
    textAlign: activeTextAlign(),
    writingDirection: activeWritingDirection(),
  } as const;

  // Dirty tracking
  const isDirty = useMemo(() => {
    if (title !== (meal.title || meal.name || '')) return true;
    if (date !== (meal.date || '')) return true;
    if (time !== (meal.time || '')) return true;

    const originalItems = meal.items || [];
    if (items.length !== originalItems.length) return true;

    for (let i = 0; i < items.length; i++) {
      const current = items[i];
      const orig = originalItems[i];
      if (!orig) return true;
      if (current.foodName !== (orig.foodName || orig.name || '')) return true;
      if (current.quantity !== String(orig.quantity ?? 1)) return true;
      if (current.calories !== String(orig.calories ?? 0)) return true;
      if (current.protein !== String(orig.protein ?? 0)) return true;
      if (current.carbs !== String(orig.carbs ?? 0)) return true;
      if (current.fats !== String(orig.fats ?? orig.fat ?? 0)) return true;
    }

    return false;
  }, [title, date, time, items, meal]);

  const handleCancel = useCallback(() => {
    if (isDirty) {
      Alert.alert(
        t('meals.discardChangesTitle') || 'Discard changes?',
        t('meals.discardChangesMessage') || 'Discard your unsaved meal changes?',
        [
          { text: t('common.cancel') || 'Cancel', style: 'cancel' },
          {
            text: t('common.delete') || 'Discard',
            style: 'destructive',
            onPress: onCancel,
          },
        ]
      );
    } else {
      onCancel();
    }
  }, [isDirty, onCancel, t]);

  // Android hardware back protection
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleCancel();
      return true;
    });
    return () => sub.remove();
  }, [handleCancel]);

  function updateItemField(id: string, field: keyof MealItemEditState, value: string) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
    // Clear field-specific error
    setItemErrors((prev) => {
      const currentMap = prev[id];
      if (!currentMap) return prev;
      const nextMap = { ...currentMap };
      delete nextMap[field as keyof MealItemErrorMap];
      return { ...prev, [id]: nextMap };
    });
  }

  async function handleSave() {
    if (isSaving) return;

    let hasError = false;

    // Validate title
    if (!title.trim()) {
      setTitleError(t('common.requiredMessage') || 'Required');
      hasError = true;
    } else {
      setTitleError('');
    }

    // Validate date format and calendar validity
    const trimmedDate = date.trim();
    try {
      validateMealDate(trimmedDate);
      setDateError('');
    } catch (err: any) {
      setDateError(err.message || t('common.invalidDate') || 'YYYY-MM-DD required');
      hasError = true;
    }

    // Validate time format (24-hr HH:mm or legacy format)
    const trimmedTime = time.trim();
    try {
      validateMealTime(trimmedTime);
      setTimeError('');
    } catch (err: any) {
      setTimeError(err.message || t('common.invalidTime') || 'HH:mm required');
      hasError = true;
    }

    // Persist new times as zero-padded HH:mm
    let standardizedTime = trimmedTime;
    if (/^[0-9]:[0-5]\d$/.test(trimmedTime)) {
      standardizedTime = `0${trimmedTime}`;
    }

    // Validate each food item
    const newItemErrors: Record<string, MealItemErrorMap> = {};
    const parsedItems: Meal['items'] = [];

    for (const item of items) {
      const errors: MealItemErrorMap = {};

      if (!item.foodName.trim()) {
        errors.foodName = t('common.requiredMessage') || 'Required';
        hasError = true;
      }

      const qResult = parseStrictQuantity(item.quantity);
      if (!qResult.isValid) {
        errors.quantity = t(qResult.errorMessageKey as any) || qResult.defaultMessage || 'Must be > 0';
        hasError = true;
      }

      const calResult = parseStrictNutrient(item.calories, { allowEmpty: true });
      if (!calResult.isValid) {
        errors.calories = t(calResult.errorMessageKey as any) || calResult.defaultMessage || 'Must be >= 0';
        hasError = true;
      }

      const pResult = parseStrictNutrient(item.protein, { allowEmpty: true });
      if (!pResult.isValid) {
        errors.protein = t(pResult.errorMessageKey as any) || pResult.defaultMessage || 'Must be >= 0';
        hasError = true;
      }

      const cResult = parseStrictNutrient(item.carbs, { allowEmpty: true });
      if (!cResult.isValid) {
        errors.carbs = t(cResult.errorMessageKey as any) || cResult.defaultMessage || 'Must be >= 0';
        hasError = true;
      }

      const fResult = parseStrictNutrient(item.fats, { allowEmpty: true });
      if (!fResult.isValid) {
        errors.fats = t(fResult.errorMessageKey as any) || fResult.defaultMessage || 'Must be >= 0';
        hasError = true;
      }

      if (Object.keys(errors).length > 0) {
        newItemErrors[item.id] = errors;
      }

      parsedItems.push({
        id: item.id,
        foodName: item.foodName.trim(),
        quantity: qResult.value,
        calories: calResult.value,
        protein: pResult.value,
        carbs: cResult.value,
        fats: fResult.value,
        unit: item.unit || 'g',
      });
    }
    setItemErrors(newItemErrors);

    if (hasError) {
      return;
    }

    setIsSaving(true);
    setSaveError('');

    try {
      const updatedMeal: Meal = {
        id: meal.id,
        title: title.trim(),
        date: trimmedDate,
        time: standardizedTime,
        items: parsedItems,
      };

      await onSave(updatedMeal);
    } catch (err) {
      setIsSaving(false);
      const message = err instanceof Error ? err.message : t('meals.saveError') || 'Failed to save meal';
      setSaveError(message);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.keyboardRoot}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
    >
      <ScrollView
        style={[styles.screen, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={styles.innerForm}>
            <AppHeader
              title={t('meals.editTitle')}
              subtitle={meal.title || meal.name || ''}
              action={<AppButton title={t('common.cancel')} variant="secondary" onPress={handleCancel} />}
            />

            {saveError ? (
              <View style={[styles.errorBanner, { backgroundColor: colors.card, borderColor: colors.danger }]}>
                <Text style={[styles.errorBannerText, directionalText, { color: colors.danger }]}>
                  {saveError}
                </Text>
              </View>
            ) : null}

            {/* Meal Metadata Card */}
            <AppCard>
              <AppInput
                label={t('meals.mealName')}
                placeholder={t('meals.mealNamePlaceholder')}
                value={title}
                error={titleError}
                onChangeText={(text) => {
                  setTitle(text);
                  if (titleError) setTitleError('');
                }}
              />
              <View style={[styles.inputRow, activeRowStyle()]}>
                <AppInput
                  label={t('common.date') || 'Date'}
                  placeholder="YYYY-MM-DD"
                  value={date}
                  error={dateError}
                  onChangeText={(text) => {
                    setDate(text);
                    if (dateError) setDateError('');
                  }}
                  containerStyle={styles.halfInput}
                />
                <AppInput
                  label={t('common.time') || 'Time'}
                  placeholder="HH:mm"
                  value={time}
                  error={timeError}
                  onChangeText={(text) => {
                    setTime(text);
                    if (timeError) setTimeError('');
                  }}
                  containerStyle={styles.halfInput}
                />
              </View>
            </AppCard>

            {/* Food Items Cards */}
            {items.map((item, idx) => {
              const errs = itemErrors[item.id] || {};
              const itemTitleLabel =
                items.length > 1
                  ? `${t('meals.foodName')} #${idx + 1}`
                  : t('meals.foodName');

              return (
                <AppCard key={item.id}>
                  <Text style={[styles.itemHeaderTitle, directionalText, { color: colors.text }]}>
                    {itemTitleLabel}
                  </Text>
                  <AppInput
                    label={t('meals.foodName')}
                    placeholder={t('meals.foodPlaceholder')}
                    value={item.foodName}
                    error={errs.foodName}
                    onChangeText={(text) => updateItemField(item.id, 'foodName', text)}
                  />
                  <View style={[styles.inputRow, activeRowStyle()]}>
                    <AppInput
                      label={t('meals.quantity')}
                      keyboardType="decimal-pad"
                      value={item.quantity}
                      error={errs.quantity}
                      onChangeText={(text) => updateItemField(item.id, 'quantity', text)}
                      containerStyle={styles.halfInput}
                    />
                    <AppInput
                      label={t('meals.calories')}
                      keyboardType="decimal-pad"
                      value={item.calories}
                      error={errs.calories}
                      onChangeText={(text) => updateItemField(item.id, 'calories', text)}
                      containerStyle={styles.halfInput}
                    />
                  </View>
                  {isCompact ? (
                    <>
                      <View style={[styles.inputRow, activeRowStyle()]}>
                        <AppInput
                          label={t('meals.protein')}
                          keyboardType="decimal-pad"
                          value={item.protein}
                          error={errs.protein}
                          onChangeText={(text) => updateItemField(item.id, 'protein', text)}
                          containerStyle={styles.halfInput}
                        />
                        <AppInput
                          label={t('meals.carbs')}
                          keyboardType="decimal-pad"
                          value={item.carbs}
                          error={errs.carbs}
                          onChangeText={(text) => updateItemField(item.id, 'carbs', text)}
                          containerStyle={styles.halfInput}
                        />
                      </View>
                      <View style={[styles.inputRow, activeRowStyle()]}>
                        <AppInput
                          label={t('meals.fats')}
                          keyboardType="decimal-pad"
                          value={item.fats}
                          error={errs.fats}
                          onChangeText={(text) => updateItemField(item.id, 'fats', text)}
                          containerStyle={styles.halfInput}
                        />
                      </View>
                    </>
                  ) : (
                    <View style={[styles.macroRow, activeRowStyle()]}>
                      <AppInput
                        label={t('meals.protein')}
                        keyboardType="decimal-pad"
                        value={item.protein}
                        error={errs.protein}
                        onChangeText={(text) => updateItemField(item.id, 'protein', text)}
                        containerStyle={styles.macroColumn}
                        style={styles.macroInputField}
                      />
                      <AppInput
                        label={t('meals.carbs')}
                        keyboardType="decimal-pad"
                        value={item.carbs}
                        error={errs.carbs}
                        onChangeText={(text) => updateItemField(item.id, 'carbs', text)}
                        containerStyle={styles.macroColumn}
                        style={styles.macroInputField}
                      />
                      <AppInput
                        label={t('meals.fats')}
                        keyboardType="decimal-pad"
                        value={item.fats}
                        error={errs.fats}
                        onChangeText={(text) => updateItemField(item.id, 'fats', text)}
                        containerStyle={styles.macroColumn}
                        style={styles.macroInputField}
                      />
                    </View>
                  )}
                </AppCard>
              );
            })}

            <AppButton
              title={isSaving ? t('common.save') : t('common.save')}
              icon="save-outline"
              disabled={isSaving}
              onPress={handleSave}
            />
          </View>
        </TouchableWithoutFeedback>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardRoot: {
    flex: 1,
  },
  screen: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: spacing.xl,
    paddingBottom: 140,
  },
  innerForm: {
    gap: spacing.lg,
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  halfInput: {
    flex: 1,
    minWidth: 0,
  },
  macroRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  macroColumn: {
    flex: 1,
    minWidth: 0,
  },
  macroInputField: {
    paddingHorizontal: spacing.sm,
  },
  errorBanner: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  errorBannerText: {
    ...typography.caption,
    fontWeight: '600',
  },
  itemHeaderTitle: {
    ...typography.caption,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
});
