import { useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import { AppButton } from '../../components/common/AppButton';
import { Card } from '../../components/common/Card';
import { FormInput } from '../../components/common/FormInput';
import { Screen } from '../../components/common/Screen';
import { SectionHeader } from '../../components/common/SectionHeader';
import { NutritionMacroDisplay } from '../../components/meals/NutritionMacroDisplay';
import { useApp } from '../../store/AppContext';
import { useLanguage } from '../../hooks/useLanguage';
import type { FoodItem, Meal } from '../../models/meal';
import type { RootStackParamList } from '../../navigation/types';
import { currentTime, todayISO } from '../../utils/date';
import { calculateMealTotals } from '../../utils/health';
import { createId } from '../../utils/id';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'AddEditMeal'>;
type MealRoute = RouteProp<RootStackParamList, 'AddEditMeal'>;

function parseNumber(value: string): number {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function blankFoodItem(): FoodItem {
  return {
    id: createId('food'),
    name: '',
    quantity: 1,
    unit: 'serving',
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  };
}

export function AddEditMealScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<MealRoute>();
  const { meals, addMeal, updateMeal } = useApp();
  const { t, rowDirection } = useLanguage();
  const existingMeal = meals.find((meal) => meal.id === route.params?.mealId);
  const [name, setName] = useState(existingMeal?.name ?? '');
  const [date, setDate] = useState(existingMeal?.date ?? todayISO());
  const [time, setTime] = useState(existingMeal?.time ?? currentTime());
  const [items, setItems] = useState<FoodItem[]>(
    existingMeal?.items.length ? existingMeal.items : [blankFoodItem()],
  );
  const totals = useMemo(() => calculateMealTotals(items), [items]);

  function updateItem(id: string, field: keyof FoodItem, value: string) {
    setItems((currentItems) =>
      currentItems.map((item) => {
        if (item.id !== id) {
          return item;
        }

        if (['quantity', 'calories', 'protein', 'carbs', 'fat'].includes(field)) {
          return { ...item, [field]: parseNumber(value) };
        }

        return { ...item, [field]: value };
      }),
    );
  }

  function removeItem(id: string) {
    setItems((currentItems) =>
      currentItems.length === 1 ? [blankFoodItem()] : currentItems.filter((item) => item.id !== id),
    );
  }

  function handleSave() {
    const trimmedName = name.trim();

    if (!trimmedName) {
      Alert.alert(t('common.requiredTitle'), t('common.requiredMessage'));
      return;
    }

    const cleanItems = items.map((item) => ({
      ...item,
      name: item.name.trim() || t('meals.foodName'),
      unit: item.unit.trim() || 'serving',
    }));
    const calculatedTotals = calculateMealTotals(cleanItems);
    const meal: Meal = {
      id: existingMeal?.id ?? createId('meal'),
      name: trimmedName,
      date: date.trim() || todayISO(),
      time: time.trim() || currentTime(),
      items: cleanItems,
      totalCalories: calculatedTotals.calories,
      totalProtein: calculatedTotals.protein,
      totalCarbs: calculatedTotals.carbs,
      totalFat: calculatedTotals.fat,
    };

    if (existingMeal) {
      updateMeal(meal);
    } else {
      addMeal(meal);
    }

    navigation.replace('MealDetails', { mealId: meal.id });
  }

  return (
    <Screen>
      <Card>
        <FormInput
          label={t('meals.mealName')}
          placeholder={t('meals.mealNamePlaceholder')}
          value={name}
          onChangeText={setName}
        />
        <View style={[styles.inlineFields, { flexDirection: rowDirection }]}>
          <FormInput label={t('common.date')} value={date} onChangeText={setDate} style={styles.inlineInput} />
          <FormInput label={t('common.time')} value={time} onChangeText={setTime} style={styles.inlineInput} />
        </View>
      </Card>

      <SectionHeader title={t('meals.mealTotals')} />
      <NutritionMacroDisplay totals={totals} />

      <SectionHeader
        title={t('meals.foodItems')}
        action={
          <AppButton
            title={t('common.add')}
            icon="add"
            variant="secondary"
            onPress={() => setItems((currentItems) => [...currentItems, blankFoodItem()])}
            style={styles.smallButton}
          />
        }
      />

      {items.map((item, index) => (
        <Card key={item.id}>
          <SectionHeader
            title={`${t('meals.foodName')} ${index + 1}`}
            action={
              <AppButton
                title={t('common.remove')}
                icon="trash-outline"
                variant="ghost"
                onPress={() => removeItem(item.id)}
                style={styles.smallButton}
              />
            }
          />
          <FormInput
            label={t('meals.foodName')}
            placeholder={t('meals.foodNamePlaceholder')}
            value={item.name}
            onChangeText={(value) => updateItem(item.id, 'name', value)}
          />
          <View style={[styles.inlineFields, { flexDirection: rowDirection }]}>
            <FormInput
              label={t('meals.quantity')}
              keyboardType="decimal-pad"
              value={String(item.quantity)}
              onChangeText={(value) => updateItem(item.id, 'quantity', value)}
              style={styles.inlineInput}
            />
            <FormInput
              label={t('meals.unit')}
              value={item.unit}
              onChangeText={(value) => updateItem(item.id, 'unit', value)}
              style={styles.inlineInput}
            />
          </View>
          <View style={[styles.inlineFields, { flexDirection: rowDirection }]}>
            <FormInput
              label={t('meals.calories')}
              keyboardType="decimal-pad"
              value={String(item.calories)}
              onChangeText={(value) => updateItem(item.id, 'calories', value)}
              style={styles.inlineInput}
            />
            <FormInput
              label={t('meals.protein')}
              keyboardType="decimal-pad"
              value={String(item.protein)}
              onChangeText={(value) => updateItem(item.id, 'protein', value)}
              style={styles.inlineInput}
            />
          </View>
          <View style={[styles.inlineFields, { flexDirection: rowDirection }]}>
            <FormInput
              label={t('meals.carbs')}
              keyboardType="decimal-pad"
              value={String(item.carbs)}
              onChangeText={(value) => updateItem(item.id, 'carbs', value)}
              style={styles.inlineInput}
            />
            <FormInput
              label={t('meals.fat')}
              keyboardType="decimal-pad"
              value={String(item.fat)}
              onChangeText={(value) => updateItem(item.id, 'fat', value)}
              style={styles.inlineInput}
            />
          </View>
        </Card>
      ))}

      <AppButton title={existingMeal ? t('common.update') : t('common.save')} icon="save-outline" onPress={handleSave} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  inlineFields: {
    flexWrap: 'wrap',
    gap: 10,
  },
  inlineInput: {
    minWidth: 130,
  },
  smallButton: {
    minHeight: 40,
    paddingHorizontal: 12,
  },
});
