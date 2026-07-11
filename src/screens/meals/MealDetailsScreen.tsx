import { Alert, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import { AppButton } from '../../components/common/AppButton';
import { Card } from '../../components/common/Card';
import { EmptyState } from '../../components/common/EmptyState';
import { Screen } from '../../components/common/Screen';
import { SectionHeader } from '../../components/common/SectionHeader';
import { FoodItemRow } from '../../components/meals/FoodItemRow';
import { NutritionMacroDisplay } from '../../components/meals/NutritionMacroDisplay';
import { useApp } from '../../store/AppContext';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useLanguage } from '../../hooks/useLanguage';
import type { RootStackParamList } from '../../navigation/types';
import { formatDisplayDate } from '../../utils/date';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'MealDetails'>;
type MealDetailsRoute = RouteProp<RootStackParamList, 'MealDetails'>;

export function MealDetailsScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<MealDetailsRoute>();
  const { meals, deleteMeal } = useApp();
  const theme = useAppTheme();
  const { t, language, textAlign, writingDirection, rowDirection } = useLanguage();
  const meal = meals.find((item) => item.id === route.params.mealId);

  if (!meal) {
    return (
      <Screen>
        <EmptyState title={t('common.notFound')} message={t('meals.emptyMessage')} />
      </Screen>
    );
  }

  const currentMeal = meal;

  function confirmDelete() {
    Alert.alert(t('meals.deleteMeal'), t('meals.deleteMealMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          deleteMeal(currentMeal.id);
          navigation.goBack();
        },
      },
    ]);
  }

  return (
    <Screen>
      <Card>
        <Text style={[styles.title, { color: theme.colors.text, textAlign, writingDirection }]}>
          {meal.name}
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted, textAlign, writingDirection }]}>
          {formatDisplayDate(meal.date, language)} - {meal.time}
        </Text>
      </Card>

      <SectionHeader title={t('meals.mealTotals')} />
      <NutritionMacroDisplay
        totals={{
          calories: meal.totalCalories,
          protein: meal.totalProtein,
          carbs: meal.totalCarbs,
          fat: meal.totalFat,
        }}
      />

      <SectionHeader title={t('meals.foodItems')} />
      <Card>
        {meal.items.length ? (
          meal.items.map((item) => <FoodItemRow key={item.id} item={item} />)
        ) : (
          <Text style={[styles.emptyText, { color: theme.colors.textMuted, textAlign, writingDirection }]}>
            {t('meals.noItems')}
          </Text>
        )}
      </Card>

      <View style={[styles.actions, { flexDirection: rowDirection }]}>
        <AppButton
          title={t('common.edit')}
          icon="create-outline"
          variant="secondary"
          onPress={() => navigation.navigate('AddEditMeal', { mealId: currentMeal.id })}
          style={styles.action}
        />
        <AppButton
          title={t('common.delete')}
          icon="trash-outline"
          variant="danger"
          onPress={confirmDelete}
          style={styles.action}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 26,
    fontWeight: '900',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 21,
  },
  actions: {
    gap: 10,
  },
  action: {
    flex: 1,
  },
});
