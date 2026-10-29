import { useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { AppHeader } from '../../components/common/AppHeader';
import { AppInput } from '../../components/common/AppInput';
import { MacroCard } from '../../components/common/MacroCard';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useLanguage } from '../../hooks/useLanguage';
import type { Meal, MealItem } from '../../models/meal';
import type { RootStackParamList } from '../../navigation/types';
import { useApp } from '../../store/AppContext';
import { currentTime, todayISO } from '../../utils/date';
import { calculateMealTotals } from '../../utils/health';
import { createId } from '../../utils/id';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'AddEditMeal'>;
type MealRoute = RouteProp<RootStackParamList, 'AddEditMeal'>;

function parseNumber(value: string): number {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function AddEditMealScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<MealRoute>();
  const { addMeal, meals, profile, updateMeal } = useApp();
  const theme = useAppTheme();
  const { rowDirectionStyle, t } = useLanguage();
  const existingMeal = meals.find((meal) => meal.id === route.params?.mealId);
  const firstItem = existingMeal?.items[0];
  const [mealName, setMealName] = useState(existingMeal?.name ?? '');
  const [date, setDate] = useState(existingMeal?.date ?? todayISO());
  const [time, setTime] = useState(existingMeal?.time ?? currentTime());
  const [foodName, setFoodName] = useState(firstItem?.name ?? '');
  const [quantity, setQuantity] = useState(String(firstItem?.quantity ?? 1));
  const [calories, setCalories] = useState(String(firstItem?.calories ?? 0));
  const [protein, setProtein] = useState(String(firstItem?.protein ?? 0));
  const [carbs, setCarbs] = useState(String(firstItem?.carbs ?? 0));
  const [fat, setFat] = useState(String(firstItem?.fat ?? 0));
  const previewItem = useMemo<MealItem>(
    () => ({
      id: firstItem?.id ?? createId('food'),
      foodName,
      name: foodName,
      quantity: parseNumber(quantity),
      unit: 'serving',
      calories: parseNumber(calories),
      protein: parseNumber(protein),
      carbs: parseNumber(carbs),
      fats: parseNumber(fat),
      fat: parseNumber(fat),
    }),
    [calories, carbs, fat, firstItem?.id, foodName, protein, quantity],
  );
  const totals = calculateMealTotals([previewItem]);

  function handleSave() {
    if (!mealName.trim() || !foodName.trim()) {
      Alert.alert(t('common.requiredTitle'), t('common.requiredMessage'));
      return;
    }

    const item = { ...previewItem, foodName: foodName.trim(), name: foodName.trim(), unit: 'serving' };
    const meal: Meal = {
      id: existingMeal?.id ?? createId('meal'),
      title: mealName.trim(),
      name: mealName.trim(),
      date: date.trim() || todayISO(),
      time: time.trim() || currentTime(),
      items: [item],
      totalCalories: totals.calories,
      totalProtein: totals.protein,
      totalCarbs: totals.carbs,
      totalFat: totals.fat,
      totalFats: totals.fat,
    };

    if (existingMeal) {
      updateMeal(meal);
    } else {
      addMeal(meal);
    }

    navigation.replace('MealDetails', { mealId: meal.id });
  }

  return (
    <ScreenContainer>
      <AppHeader title={existingMeal ? t('meals.editTitle') : t('meals.addTitle')} subtitle={t('meals.subtitle')} />

      <AppCard>
        <AppInput label={t('meals.mealName')} placeholder={t('meals.mealNamePlaceholder')} value={mealName} onChangeText={setMealName} />
        <View style={[styles.inline, rowDirectionStyle]}>
          <AppInput label={t('common.date')} value={date} onChangeText={setDate} style={styles.inlineInput} />
          <AppInput label={t('common.time')} value={time} onChangeText={setTime} style={styles.inlineInput} />
        </View>
        <AppInput label={t('meals.foodName')} placeholder={t('meals.foodNamePlaceholder')} value={foodName} onChangeText={setFoodName} />
        <View style={[styles.inline, rowDirectionStyle]}>
          <AppInput label={t('meals.quantity')} keyboardType="decimal-pad" value={quantity} onChangeText={setQuantity} style={styles.inlineInput} />
          <AppInput label={t('meals.calories')} keyboardType="decimal-pad" value={calories} onChangeText={setCalories} style={styles.inlineInput} />
        </View>
        <View style={[styles.inline, rowDirectionStyle]}>
          <AppInput label={t('meals.protein')} keyboardType="decimal-pad" value={protein} onChangeText={setProtein} style={styles.inlineInput} />
          <AppInput label={t('meals.carbs')} keyboardType="decimal-pad" value={carbs} onChangeText={setCarbs} style={styles.inlineInput} />
          <AppInput label={t('meals.fat')} keyboardType="decimal-pad" value={fat} onChangeText={setFat} style={styles.inlineInput} />
        </View>
      </AppCard>

      <View style={[styles.macroGrid, rowDirectionStyle]}>
        <MacroCard label={t('macros.calories')} value={totals.calories} goal={profile.targetCalories} unit={t('macros.kcal')} icon="flame-outline" color={theme.colors.warning} />
        <MacroCard label={t('macros.protein')} value={totals.protein} goal={profile.targetProtein} unit={t('macros.grams')} icon="barbell-outline" />
      </View>

      <AppButton title={existingMeal ? t('common.update') : t('common.save')} icon="save-outline" onPress={handleSave} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  inline: {
    flexWrap: 'wrap',
    gap: 12,
  },
  inlineInput: {
    flex: 1,
    minWidth: 120,
  },
  macroGrid: {
    flexWrap: 'wrap',
    gap: 12,
  },
});
