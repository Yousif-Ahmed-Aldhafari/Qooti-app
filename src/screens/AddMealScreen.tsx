import { useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
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
import { spacing } from '../theme/spacing';
import type { Meal } from '../types';
import { parseInputNumber } from '../utils/nutrition';
import { activeRowStyle } from '../utils/rtl';

type AddMealScreenProps = {
  t: Translator;
  onSave: (meal: Meal) => void;
};

export function AddMealScreen({ t, onSave }: AddMealScreenProps) {
  const { width } = useWindowDimensions();
  const isCompact = width < 340;
  const colors = themeColors();
  const [mealName, setMealName] = useState('');
  const [foodName, setFoodName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fats, setFats] = useState('');
  const [mealNameError, setMealNameError] = useState('');
  const [foodNameError, setFoodNameError] = useState('');

  function handleSave() {
    let hasError = false;
    if (!mealName.trim()) {
      setMealNameError(t('common.requiredMessage') || 'Required');
      hasError = true;
    } else {
      setMealNameError('');
    }

    if (!foodName.trim()) {
      setFoodNameError(t('common.requiredMessage') || 'Required');
      hasError = true;
    } else {
      setFoodNameError('');
    }

    if (hasError) {
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
                  onChangeText={setQuantity}
                  containerStyle={styles.halfInput}
                />
                <AppInput
                  label={t('meals.calories')}
                  keyboardType="decimal-pad"
                  value={calories}
                  onChangeText={setCalories}
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
                      onChangeText={setProtein}
                      containerStyle={styles.halfInput}
                    />
                    <AppInput
                      label={t('meals.carbs')}
                      keyboardType="decimal-pad"
                      value={carbs}
                      onChangeText={setCarbs}
                      containerStyle={styles.halfInput}
                    />
                  </View>
                  <View style={[styles.inputRow, activeRowStyle()]}>
                    <AppInput
                      label={t('meals.fats')}
                      keyboardType="decimal-pad"
                      value={fats}
                      onChangeText={setFats}
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
                    onChangeText={setProtein}
                    containerStyle={styles.macroColumn}
                    style={styles.macroInputField}
                  />
                  <AppInput
                    label={t('meals.carbs')}
                    keyboardType="decimal-pad"
                    value={carbs}
                    onChangeText={setCarbs}
                    containerStyle={styles.macroColumn}
                    style={styles.macroInputField}
                  />
                  <AppInput
                    label={t('meals.fats')}
                    keyboardType="decimal-pad"
                    value={fats}
                    onChangeText={setFats}
                    containerStyle={styles.macroColumn}
                    style={styles.macroInputField}
                  />
                </View>
              )}
            </AppCard>
            <AppButton title={t('common.save')} icon="save-outline" onPress={handleSave} />
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
});
