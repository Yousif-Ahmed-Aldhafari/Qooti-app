import { useRef, useState } from 'react';
import {
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
import { activeRowStyle, activeTextAlign, activeWritingDirection } from '../utils/rtl';

type AddMealScreenProps = {
  t: Translator;
  onSave: (meal: Meal) => Promise<void> | void;
};

export function AddMealScreen({ t, onSave }: AddMealScreenProps) {
  const { width } = useWindowDimensions();
  const isCompact = width < 340;
  const colors = themeColors();

  // Stable draft IDs across validation attempts and retries
  const draftMealIdRef = useRef(createId('meal'));
  const draftItemIdRef = useRef(createId('meal-item'));

  const [mealName, setMealName] = useState('');
  const [foodName, setFoodName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fats, setFats] = useState('');

  const [mealNameError, setMealNameError] = useState('');
  const [foodNameError, setFoodNameError] = useState('');
  const [quantityError, setQuantityError] = useState('');
  const [caloriesError, setCaloriesError] = useState('');
  const [proteinError, setProteinError] = useState('');
  const [carbsError, setCarbsError] = useState('');
  const [fatsError, setFatsError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const directionalText = {
    textAlign: activeTextAlign(),
    writingDirection: activeWritingDirection(),
  } as const;

  async function handleSave() {
    if (isSaving) return;

    let hasError = false;

    // Validate meal title
    if (!mealName.trim()) {
      setMealNameError(t('common.requiredMessage') || 'Required');
      hasError = true;
    } else {
      setMealNameError('');
    }

    // Validate food name
    if (!foodName.trim()) {
      setFoodNameError(t('common.requiredMessage') || 'Required');
      hasError = true;
    } else {
      setFoodNameError('');
    }

    // Validate quantity (> 0, finite)
    const quantityResult = parseStrictQuantity(quantity);
    if (!quantityResult.isValid) {
      setQuantityError(t(quantityResult.errorMessageKey as any) || quantityResult.defaultMessage || 'Must be > 0');
      hasError = true;
    } else {
      setQuantityError('');
    }

    // Validate calories (>= 0, finite)
    const caloriesResult = parseStrictNutrient(calories, { allowEmpty: true });
    if (!caloriesResult.isValid) {
      setCaloriesError(t(caloriesResult.errorMessageKey as any) || caloriesResult.defaultMessage || 'Must be >= 0');
      hasError = true;
    } else {
      setCaloriesError('');
    }

    // Validate protein (>= 0, finite)
    const proteinResult = parseStrictNutrient(protein, { allowEmpty: true });
    if (!proteinResult.isValid) {
      setProteinError(t(proteinResult.errorMessageKey as any) || proteinResult.defaultMessage || 'Must be >= 0');
      hasError = true;
    } else {
      setProteinError('');
    }

    // Validate carbs (>= 0, finite)
    const carbsResult = parseStrictNutrient(carbs, { allowEmpty: true });
    if (!carbsResult.isValid) {
      setCarbsError(t(carbsResult.errorMessageKey as any) || carbsResult.defaultMessage || 'Must be >= 0');
      hasError = true;
    } else {
      setCarbsError('');
    }

    // Validate fats (>= 0, finite)
    const fatsResult = parseStrictNutrient(fats, { allowEmpty: true });
    if (!fatsResult.isValid) {
      setFatsError(t(fatsResult.errorMessageKey as any) || fatsResult.defaultMessage || 'Must be >= 0');
      hasError = true;
    } else {
      setFatsError('');
    }

    if (hasError) {
      return;
    }

    setIsSaving(true);
    setSaveError('');

    try {
      const now = new Date();
      await onSave({
        id: draftMealIdRef.current,
        title: mealName.trim(),
        date: formatLocalDate(now),
        time: formatLocalTime(now),
        items: [
          {
            id: draftItemIdRef.current,
            foodName: foodName.trim(),
            quantity: quantityResult.value,
            calories: caloriesResult.value,
            protein: proteinResult.value,
            carbs: carbsResult.value,
            fats: fatsResult.value,
            unit: 'g',
          },
        ],
      });
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
            <AppHeader title={t('meals.addTitle')} subtitle={t('meals.subtitle')} />

            {saveError ? (
              <View style={[styles.errorBanner, { backgroundColor: colors.card, borderColor: colors.danger }]}>
                <Text style={[styles.errorBannerText, directionalText, { color: colors.danger }]}>
                  {saveError}
                </Text>
              </View>
            ) : null}

            <AppCard>
              <AppInput
                label={t('meals.mealName')}
                placeholder={t('meals.mealNamePlaceholder')}
                value={mealName}
                error={mealNameError}
                onChangeText={(text) => {
                  setMealName(text);
                  if (mealNameError) setMealNameError('');
                }}
              />
              <AppInput
                label={t('meals.foodName')}
                placeholder={t('meals.foodPlaceholder')}
                value={foodName}
                error={foodNameError}
                onChangeText={(text) => {
                  setFoodName(text);
                  if (foodNameError) setFoodNameError('');
                }}
              />
              <View style={[styles.inputRow, activeRowStyle()]}>
                <AppInput
                  label={t('meals.quantity')}
                  keyboardType="decimal-pad"
                  value={quantity}
                  error={quantityError}
                  onChangeText={(text) => {
                    setQuantity(text);
                    if (quantityError) setQuantityError('');
                  }}
                  containerStyle={styles.halfInput}
                />
                <AppInput
                  label={t('meals.calories')}
                  keyboardType="decimal-pad"
                  value={calories}
                  error={caloriesError}
                  onChangeText={(text) => {
                    setCalories(text);
                    if (caloriesError) setCaloriesError('');
                  }}
                  containerStyle={styles.halfInput}
                />
              </View>
              {isCompact ? (
                <>
                  <View style={[styles.inputRow, activeRowStyle()]}>
                    <AppInput
                      label={t('meals.protein')}
                      keyboardType="decimal-pad"
                      value={protein}
                      error={proteinError}
                      onChangeText={(text) => {
                        setProtein(text);
                        if (proteinError) setProteinError('');
                      }}
                      containerStyle={styles.halfInput}
                    />
                    <AppInput
                      label={t('meals.carbs')}
                      keyboardType="decimal-pad"
                      value={carbs}
                      error={carbsError}
                      onChangeText={(text) => {
                        setCarbs(text);
                        if (carbsError) setCarbsError('');
                      }}
                      containerStyle={styles.halfInput}
                    />
                  </View>
                  <View style={[styles.inputRow, activeRowStyle()]}>
                    <AppInput
                      label={t('meals.fats')}
                      keyboardType="decimal-pad"
                      value={fats}
                      error={fatsError}
                      onChangeText={(text) => {
                        setFats(text);
                        if (fatsError) setFatsError('');
                      }}
                      containerStyle={styles.halfInput}
                    />
                  </View>
                </>
              ) : (
                <View style={[styles.macroRow, activeRowStyle()]}>
                  <AppInput
                    label={t('meals.protein')}
                    keyboardType="decimal-pad"
                    value={protein}
                    error={proteinError}
                    onChangeText={(text) => {
                      setProtein(text);
                      if (proteinError) setProteinError('');
                    }}
                    containerStyle={styles.macroColumn}
                    style={styles.macroInputField}
                  />
                  <AppInput
                    label={t('meals.carbs')}
                    keyboardType="decimal-pad"
                    value={carbs}
                    error={carbsError}
                    onChangeText={(text) => {
                      setCarbs(text);
                      if (carbsError) setCarbsError('');
                    }}
                    containerStyle={styles.macroColumn}
                    style={styles.macroInputField}
                  />
                  <AppInput
                    label={t('meals.fats')}
                    keyboardType="decimal-pad"
                    value={fats}
                    error={fatsError}
                    onChangeText={(text) => {
                      setFats(text);
                      if (fatsError) setFatsError('');
                    }}
                    containerStyle={styles.macroColumn}
                    style={styles.macroInputField}
                  />
                </View>
              )}
            </AppCard>
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
});
