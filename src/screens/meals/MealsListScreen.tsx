import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { AppHeader } from '../../components/common/AppHeader';
import { MacroCard } from '../../components/common/MacroCard';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { EmptyState } from '../../components/common/EmptyState';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useLanguage } from '../../hooks/useLanguage';
import type { RootStackParamList } from '../../navigation/types';
import { useApp } from '../../store/AppContext';
import { compareDateTimeDesc, formatDisplayDate } from '../../utils/date';
import { mealsForToday, nutritionTotalsForMeals } from '../../utils/health';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

export function MealsListScreen() {
  const navigation = useNavigation<Navigation>();
  const { meals, profile } = useApp();
  const theme = useAppTheme();
  const { language, rowDirectionStyle, t, textDirectionStyle } = useLanguage();
  const todayMeals = mealsForToday(meals).sort(compareDateTimeDesc);
  const totals = nutritionTotalsForMeals(todayMeals);
  const sortedMeals = [...meals].sort(compareDateTimeDesc);

  return (
    <ScreenContainer>
      <AppHeader title={t('meals.title')} subtitle={t('meals.subtitle')} />

      <AppCard tone="accent">
        <View style={[styles.summaryTop, rowDirectionStyle]}>
          <View style={styles.summaryCopy}>
            <Text style={[styles.summaryLabel, textDirectionStyle, { color: theme.colors.textMuted }]}>
              {t('nutrition.calorieBudget')}
            </Text>
            <Text style={[styles.summaryValue, textDirectionStyle, { color: theme.colors.text }]}>
              {Math.round(totals.calories)} / {profile.targetCalories} {t('macros.kcal')}
            </Text>
          </View>
          <AppButton
            title={t('common.add')}
            icon="add"
            onPress={() => navigation.navigate('AddEditMeal')}
            style={styles.smallButton}
          />
        </View>
      </AppCard>

      <View style={[styles.macroGrid, rowDirectionStyle]}>
        <MacroCard label={t('macros.protein')} value={totals.protein} goal={profile.targetProtein} unit={t('macros.grams')} icon="barbell-outline" />
        <MacroCard label={t('macros.carbs')} value={totals.carbs} goal={profile.targetCarbs} unit={t('macros.grams')} icon="leaf-outline" color={theme.colors.accent} />
        <MacroCard label={t('macros.fat')} value={totals.fat} goal={profile.targetFat} unit={t('macros.grams')} icon="water-outline" color={theme.colors.secondary} />
      </View>

      <View style={[styles.actions, rowDirectionStyle]}>
        <AppButton title={t('navigation.nutritionSummary')} icon="pie-chart-outline" variant="secondary" onPress={() => navigation.navigate('NutritionSummary')} style={styles.action} />
        <AppButton title={t('navigation.foodSearch')} icon="search" variant="ghost" onPress={() => navigation.navigate('FoodSearch')} style={styles.action} />
      </View>

      {sortedMeals.length ? (
        <View style={styles.list}>
          {sortedMeals.map((meal) => (
            <Pressable
              accessibilityRole="button"
              key={meal.id}
              onPress={() => navigation.navigate('MealDetails', { mealId: meal.id })}
              style={({ pressed }) => [
                styles.mealCard,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <View style={[styles.mealRow, rowDirectionStyle]}>
                <View style={[styles.mealIcon, { backgroundColor: theme.colors.primaryMuted }]}>
                  <Ionicons name="restaurant-outline" size={22} color={theme.colors.primary} />
                </View>
                <View style={styles.mealCopy}>
                  <Text style={[styles.mealTitle, textDirectionStyle, { color: theme.colors.text }]} numberOfLines={1}>
                    {meal.name}
                  </Text>
                  <Text style={[styles.mealMeta, textDirectionStyle, { color: theme.colors.textMuted }]}>
                    {formatDisplayDate(meal.date, language)} · {meal.time} · {t('meals.itemsCount', { count: meal.items.length })}
                  </Text>
                </View>
                <Text style={[styles.calories, { color: theme.colors.primary }]}>
                  {Math.round(meal.totalCalories)}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : (
        <EmptyState
          icon="restaurant-outline"
          title={t('meals.emptyTitle')}
          message={t('meals.emptyMessage')}
          actionLabel={t('meals.addTitle')}
          onAction={() => navigation.navigate('AddEditMeal')}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  summaryTop: {
    alignItems: 'center',
    gap: 12,
  },
  summaryCopy: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: '800',
  },
  summaryValue: {
    marginTop: 4,
    fontSize: 24,
    fontWeight: '900',
  },
  smallButton: {
    minHeight: 44,
  },
  macroGrid: {
    flexWrap: 'wrap',
    gap: 12,
  },
  actions: {
    gap: 12,
  },
  action: {
    flex: 1,
  },
  list: {
    gap: 12,
  },
  mealCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 14,
  },
  mealRow: {
    alignItems: 'center',
    gap: 12,
  },
  mealIcon: {
    width: 50,
    height: 50,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealCopy: {
    flex: 1,
    gap: 5,
  },
  mealTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  mealMeta: {
    fontSize: 12,
    fontWeight: '700',
  },
  calories: {
    fontSize: 18,
    fontWeight: '900',
  },
});
