import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { AppButton } from '../../components/common/AppButton';
import { Card } from '../../components/common/Card';
import { ListItem } from '../../components/common/ListItem';
import { Screen } from '../../components/common/Screen';
import { SectionHeader } from '../../components/common/SectionHeader';
import { SummaryBox } from '../../components/common/SummaryBox';
import { DailyProgressCard } from '../../components/dashboard/DailyProgressCard';
import { useApp } from '../../store/AppContext';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useLanguage } from '../../hooks/useLanguage';
import type { RootStackParamList } from '../../navigation/types';
import { compareDateTimeDesc, formatDisplayDate, todayISO } from '../../utils/date';
import {
  mealsForCurrentWeek,
  mealsForToday,
  nutritionTotalsForMeals,
  workoutsForCurrentWeek,
  workoutsForToday,
} from '../../utils/health';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

export function DashboardScreen() {
  const navigation = useNavigation<Navigation>();
  const { meals, workouts } = useApp();
  const theme = useAppTheme();
  const { t, language, textDirectionStyle, rowDirectionStyle } = useLanguage();
  const todayMeals = mealsForToday(meals).sort(compareDateTimeDesc);
  const todayWorkouts = workoutsForToday(workouts).sort(compareDateTimeDesc);
  const todayTotals = nutritionTotalsForMeals(todayMeals);
  const weekMeals = mealsForCurrentWeek(meals);
  const weekWorkouts = workoutsForCurrentWeek(workouts);
  const weekCalories = Math.round(nutritionTotalsForMeals(weekMeals).calories);

  return (
    <Screen>
      <View style={styles.heading}>
        <Text style={[styles.eyebrow, textDirectionStyle, { color: theme.colors.primary }]}>
          {formatDisplayDate(todayISO(), language)}
        </Text>
        <Text style={[styles.title, textDirectionStyle, { color: theme.colors.text }]}>
          {t('dashboard.hello')}
        </Text>
      </View>

      <DailyProgressCard totals={todayTotals} />

      <SectionHeader title={t('dashboard.quickActions')} />
      <View style={[styles.actions, rowDirectionStyle]}>
        <AppButton
          title={t('dashboard.addMeal')}
          icon="restaurant-outline"
          onPress={() => navigation.navigate('AddEditMeal')}
          style={styles.action}
        />
        <AppButton
          title={t('dashboard.addWorkout')}
          icon="barbell-outline"
          variant="secondary"
          onPress={() => navigation.navigate('AddEditWorkout')}
          style={styles.action}
        />
      </View>

      <SectionHeader title={t('dashboard.weeklySummary')} />
      <View style={[styles.grid, rowDirectionStyle]}>
        <SummaryBox
          label={t('dashboard.weeklyCalories')}
          value={weekCalories}
          helper={t('macros.kcal')}
          icon="flame-outline"
          tone="warning"
        />
        <SummaryBox
          label={t('dashboard.weeklyWorkouts')}
          value={weekWorkouts.length}
          helper={t('common.thisWeek')}
          icon="barbell-outline"
          tone="success"
        />
      </View>

      <SectionHeader title={t('dashboard.todayMeals')} />
      <Card>
        {todayMeals.length ? (
          todayMeals.slice(0, 3).map((meal) => (
            <ListItem
              key={meal.id}
              title={meal.name}
              subtitle={`${meal.time} - ${t('meals.itemsCount', { count: meal.items.length })}`}
              meta={`${Math.round(meal.totalCalories)} ${t('macros.kcal')}`}
              icon="restaurant-outline"
              onPress={() => navigation.navigate('MealDetails', { mealId: meal.id })}
            />
          ))
        ) : (
          <Text style={[styles.emptyText, textDirectionStyle, { color: theme.colors.textMuted }]}>
            {t('dashboard.noMealsToday')}
          </Text>
        )}
      </Card>

      <SectionHeader title={t('dashboard.todayWorkouts')} />
      <Card>
        {todayWorkouts.length ? (
          todayWorkouts.slice(0, 3).map((workout) => (
            <ListItem
              key={workout.id}
              title={workout.name}
              subtitle={`${workout.time} - ${t('workouts.exerciseCount', { count: workout.exercises.length })}`}
              icon="barbell-outline"
              onPress={() => navigation.navigate('WorkoutDetails', { workoutId: workout.id })}
            />
          ))
        ) : (
          <Text style={[styles.emptyText, textDirectionStyle, { color: theme.colors.textMuted }]}>
            {t('dashboard.noWorkoutsToday')}
          </Text>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {
    alignSelf: 'stretch',
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 4,
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 36,
  },
  actions: {
    gap: 10,
  },
  action: {
    flex: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 21,
  },
});
