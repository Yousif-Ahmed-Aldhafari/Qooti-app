import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import { AppHeader } from '../components/AppHeader';
import { AppInput } from '../components/AppInput';
import type { Translator } from '../i18n';
import { themeColors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import type { Meal } from '../types';
import { parseInputNumber } from '../utils/nutrition';
import { activeRowStyle } from '../utils/rtl';

type AddMealScreenProps = {
  t: Translator;
  onSave: (meal: Meal) => void;
};

export function AddMealScreen({ t, onSave }: AddMealScreenProps) {
  const colors = themeColors();
  const [mealName, setMealName] = useState('');
  const [foodName, setFoodName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fats, setFats] = useState('');

  function handleSave() {
    if (!mealName.trim() || !foodName.trim()) {
      Alert.alert(t('common.requiredTitle'), t('common.requiredMessage'));
      return;
    }

    onSave({
      id: `meal-${Date.now()}`,
      title: mealName.trim(),
      date: new Date().toISOString().slice(0, 10),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      items: [
        {
          id: `item-${Date.now()}`,
          foodName: foodName.trim(),
          quantity: parseInputNumber(quantity),
          calories: parseInputNumber(calories),
          protein: parseInputNumber(protein),
          carbs: parseInputNumber(carbs),
          fats: parseInputNumber(fats),
        },
      ],
    });
  }

  return (
    <ScrollView style={[styles.screen, { backgroundColor: colors.background }]} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <AppHeader title={t('meals.addTitle')} subtitle={t('meals.subtitle')} />
      <AppCard>
        <AppInput label={t('meals.mealName')} placeholder={t('meals.mealNamePlaceholder')} value={mealName} onChangeText={setMealName} />
        <AppInput label={t('meals.foodName')} placeholder={t('meals.foodPlaceholder')} value={foodName} onChangeText={setFoodName} />
        <View style={[styles.row, activeRowStyle()]}>
          <AppInput label={t('meals.quantity')} keyboardType="decimal-pad" value={quantity} onChangeText={setQuantity} style={styles.input} />
          <AppInput label={t('meals.calories')} keyboardType="decimal-pad" value={calories} onChangeText={setCalories} style={styles.input} />
        </View>
        <View style={[styles.row, activeRowStyle()]}>
          <AppInput label={t('meals.protein')} keyboardType="decimal-pad" value={protein} onChangeText={setProtein} style={styles.input} />
          <AppInput label={t('meals.carbs')} keyboardType="decimal-pad" value={carbs} onChangeText={setCarbs} style={styles.input} />
          <AppInput label={t('meals.fats')} keyboardType="decimal-pad" value={fats} onChangeText={setFats} style={styles.input} />
        </View>
      </AppCard>
      <AppButton title={t('common.save')} icon="save-outline" onPress={handleSave} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: spacing.xl,
    paddingBottom: 120,
    gap: spacing.lg,
  },
  row: {
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  input: {
    minWidth: 100,
    flex: 1,
  },
});
