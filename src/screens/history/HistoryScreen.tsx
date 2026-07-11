import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Card } from '../../components/common/Card';
import { EmptyState } from '../../components/common/EmptyState';
import { ListItem } from '../../components/common/ListItem';
import { Screen } from '../../components/common/Screen';
import { SectionHeader } from '../../components/common/SectionHeader';
import { SegmentedControl } from '../../components/common/SegmentedControl';
import { SummaryBox } from '../../components/common/SummaryBox';
import { useApp } from '../../store/AppContext';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useLanguage } from '../../hooks/useLanguage';
import type { RootStackParamList } from '../../navigation/types';
import { compareDateTimeDesc, formatDisplayDate, formatShortDate } from '../../utils/date';
import { weeklyMealSummary, weeklyWorkoutSummary } from '../../utils/health';

type Navigation = NativeStackNavigationProp<RootStackParamList>;
type HistoryFilter = 'all' | 'meals' | 'workouts';

type HistoryEntry = {
  id: string;
  type: 'meal' | 'workout';
  date: string;
  time: string;
  title: string;
  subtitle: string;
};

export function HistoryScreen() {
  const navigation = useNavigation<Navigation>();
  const { meals, workouts } = useApp();
  const theme = useAppTheme();
  const { t, language, contentDirectionStyle, textDirectionStyle, rowDirectionStyle } = useLanguage();
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const mealSummary = weeklyMealSummary(meals);
  const workoutSummary = weeklyWorkoutSummary(workouts);
  const entries = useMemo<HistoryEntry[]>(() => {
    const mealEntries = meals.map((meal) => ({
      id: meal.id,
      type: 'meal' as const,
      date: meal.date,
      time: meal.time,
      title: meal.name,
      subtitle: `${formatDisplayDate(meal.date, language)} - ${Math.round(meal.totalCalories)} ${t('macros.kcal')}`,
    }));
    const workoutEntries = workouts.map((workout) => ({
      id: workout.id,
      type: 'workout' as const,
      date: workout.date,
      time: workout.time,
      title: workout.name,
      subtitle: `${formatDisplayDate(workout.date, language)} - ${t('workouts.exerciseCount', {
        count: workout.exercises.length,
      })}`,
    }));

    return [...mealEntries, ...workoutEntries]
      .filter((entry) => filter === 'all' || `${entry.type}s` === filter)
      .sort(compareDateTimeDesc);
  }, [filter, language, meals, t, workouts]);

  return (
    <Screen>
      <SectionHeader title={t('history.title')} />
      <SegmentedControl
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: t('history.all') },
          { value: 'meals', label: t('history.meals') },
          { value: 'workouts', label: t('history.workouts') },
        ]}
      />

      <SectionHeader title={t('history.lastSevenDays')} />
      <View style={[styles.weekGrid, rowDirectionStyle]}>
        {mealSummary.map((mealDay) => {
          const workoutDay = workoutSummary.find((item) => item.date === mealDay.date);

          return (
            <View
              key={mealDay.date}
              style={[
                styles.dayBox,
                contentDirectionStyle,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              ]}
            >
              <Text style={[styles.dayLabel, textDirectionStyle, { color: theme.colors.text }]}>
                {formatShortDate(mealDay.date, language)}
              </Text>
              <Text style={[styles.dayMeta, textDirectionStyle, { color: theme.colors.textMuted }]}>
                {Math.round(mealDay.calories)} {t('macros.kcal')}
              </Text>
              <Text style={[styles.dayMeta, textDirectionStyle, { color: theme.colors.textMuted }]}>
                {workoutDay?.workoutCount ?? 0} {t('navigation.workouts')}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={[styles.grid, rowDirectionStyle]}>
        <SummaryBox
          label={t('history.dailyCalories')}
          value={Math.round(mealSummary[mealSummary.length - 1]?.calories ?? 0)}
          helper={t('common.today')}
          icon="flame-outline"
          tone="warning"
        />
        <SummaryBox
          label={t('history.dailyWorkouts')}
          value={workoutSummary[workoutSummary.length - 1]?.workoutCount ?? 0}
          helper={t('common.today')}
          icon="barbell-outline"
          tone="success"
        />
      </View>

      <SectionHeader title={t('history.title')} />
      {entries.length ? (
        <Card>
          {entries.map((entry) => (
            <ListItem
              key={`${entry.type}-${entry.id}`}
              title={entry.title}
              subtitle={entry.subtitle}
              icon={entry.type === 'meal' ? 'restaurant-outline' : 'barbell-outline'}
              onPress={() =>
                entry.type === 'meal'
                  ? navigation.navigate('MealDetails', { mealId: entry.id })
                  : navigation.navigate('WorkoutDetails', { workoutId: entry.id })
              }
            />
          ))}
        </Card>
      ) : (
        <EmptyState title={t('history.emptyTitle')} message={t('history.emptyMessage')} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  weekGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayBox: {
    width: '31.8%',
    minWidth: 96,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    gap: 4,
  },
  dayLabel: {
    fontSize: 13,
    fontWeight: '900',
  },
  dayMeta: {
    fontSize: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
});
