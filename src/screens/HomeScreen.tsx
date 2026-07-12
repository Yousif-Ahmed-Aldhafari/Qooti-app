import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { DailyGoalBanner } from '../components/home/DailyGoalBanner';
import { DailyMetricCard } from '../components/home/DailyMetricCard';
import { DateSelector, type DateOption } from '../components/home/DateSelector';
import { GoalProgressCard } from '../components/home/GoalProgressCard';
import { HomeHeader } from '../components/home/HomeHeader';
import { LatestActivityList, type HomeActivity } from '../components/home/LatestActivityList';
import { PeriodSelector, type PeriodKey } from '../components/home/PeriodSelector';
import { QuickActionCard } from '../components/home/QuickActionCard';
import type { Translator } from '../i18n';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import type { Meal, UserProfile, Workout } from '../types';
import { calculateDailyNutrition, progressRatio, workoutMinutes } from '../utils/nutrition';
import { activeIsRTL, activeRowDirection, activeTextAlign, activeWritingDirection } from '../utils/rtl';

type HomeScreenProps = {
  t: Translator;
  profile: UserProfile;
  meals: Meal[];
  workouts: Workout[];
  onAddMeal: () => void;
  onAddWorkout: () => void;
  onMealPress: (meal: Meal) => void;
  onWorkoutPress: (workout: Workout) => void;
};

const dayMs = 24 * 60 * 60 * 1000;

export function HomeScreen({ t, profile, meals, workouts, onAddMeal, onAddWorkout, onMealPress, onWorkoutPress }: HomeScreenProps) {
  const [period, setPeriod] = useState<PeriodKey>('today');
  const [selectedDateKey, setSelectedDateKey] = useState(toDateKey(new Date()));
  const selectedDate = dateFromKey(selectedDateKey);
  const firstName = profile.name.split(' ')[0] || profile.name;
  const rtl = activeIsRTL();
  const directionalText = {
    textAlign: activeTextAlign(),
    writingDirection: activeWritingDirection(),
  } as const;

  const filteredMeals = useMemo(
    () => meals.filter((meal) => isInSelectedPeriod(resolveStoredDate(meal.date), selectedDate, period)),
    [meals, period, selectedDateKey],
  );
  const filteredWorkouts = useMemo(
    () => workouts.filter((workout) => isInSelectedPeriod(resolveStoredDate(workout.date), selectedDate, period)),
    [workouts, period, selectedDateKey],
  );

  const totals = calculateDailyNutrition(filteredMeals);
  const periodDays = getPeriodDayCount(selectedDate, period);
  const calorieTarget = profile.targetCalories * periodDays;
  const proteinTarget = profile.targetProtein * periodDays;
  const carbsTarget = profile.targetCarbs * periodDays;
  const fatsTarget = profile.targetFats * periodDays;
  const duration = workoutMinutes(filteredWorkouts);
  const exerciseCount = filteredWorkouts.reduce((sum, workout) => sum + workout.exercises.length, 0);
  const mealCount = filteredMeals.length;
  const latestActivities = buildActivities({
    meals: filteredMeals,
    workouts: filteredWorkouts,
    t,
    onMealPress,
    onWorkoutPress,
  });

  const dateOptions = useMemo(
    () => buildDateOptions(selectedDate, rtl),
    [rtl, selectedDateKey],
  );
  const periodOptions = [
    { key: 'today' as const, label: t('home.period.today'), accent: colors.lavender },
    { key: 'week' as const, label: t('home.period.week'), accent: colors.orange },
    { key: 'month' as const, label: t('home.period.month'), accent: colors.blue },
  ];
  const macroBars = [
    progressRatio(totals.protein, proteinTarget) * 100,
    progressRatio(totals.carbs, carbsTarget) * 100,
    progressRatio(totals.fats, fatsTarget) * 100,
  ];
  const goals = [
    {
      id: 'calories',
      title: t('home.goals.calories'),
      target: t('home.goals.dailyTarget'),
      progress: progressRatio(totals.calories, calorieTarget),
      remaining: t('home.goals.caloriesRemaining', { amount: Math.max(0, Math.round(calorieTarget - totals.calories)) }),
      accent: colors.limeSoft,
    },
    {
      id: 'protein',
      title: t('home.goals.protein'),
      target: t('home.goals.dailyTarget'),
      progress: progressRatio(totals.protein, proteinTarget),
      remaining: t('home.goals.proteinRemaining', { amount: Math.max(0, Math.round(proteinTarget - totals.protein)) }),
      accent: colors.accent,
    },
  ].filter((goal) => goal.id === 'calories' ? calorieTarget > 0 : proteinTarget > 0);

  function handleDateSelect(date: string) {
    setSelectedDateKey(date);
    setPeriod('today');
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <HomeHeader
        avatarInitials={profile.avatarInitials}
        greeting={t('home.headerGreeting', { name: firstName })}
        subtitle={t('home.headerSubtitle')}
        onActionPress={() => undefined}
      />

      <PeriodSelector options={periodOptions} selected={period} onChange={setPeriod} />

      <View style={[styles.metricRow, { flexDirection: activeRowDirection() }]}>
        <DailyMetricCard
          title={t('home.metrics.calories')}
          value={`${Math.round(totals.calories)} / ${calorieTarget}`}
          subtitle={t('common.kcal')}
          icon="flame"
          accent={colors.accent}
          progress={progressRatio(totals.calories, calorieTarget)}
        />
        <DailyMetricCard
          title={t('home.metrics.macros')}
          value={`${Math.round(totals.protein)}${t('common.grams')} / ${Math.round(totals.carbs)}${t('common.grams')}`}
          subtitle={`${Math.round(totals.fats)}${t('common.grams')} ${t('common.fats')}`}
          icon="nutrition-outline"
          accent={colors.blue}
          bars={macroBars}
        />
        <DailyMetricCard
          title={t('home.metrics.workout')}
          value={`${duration} ${t('common.minutes')}`}
          subtitle={t('home.metrics.exercises', { count: exerciseCount })}
          icon="barbell-outline"
          accent={colors.lavender}
          progress={duration > 0 ? 1 : 0}
        />
      </View>

      <DateSelector
        title={formatMonthYear(selectedDate, rtl)}
        dates={dateOptions}
        selectedDate={selectedDateKey}
        onSelect={handleDateSelect}
      />

      <Text style={[styles.sectionTitle, directionalText]}>{t('home.todayPlan')}</Text>
      <View style={[styles.quickRow, { flexDirection: activeRowDirection() }]}>
        <QuickActionCard
          title={t('home.addMeal')}
          subtitle={t('home.addMealSubtitle')}
          actionLabel={t('common.add')}
          icon="restaurant-outline"
          accent={colors.lavender}
          onPress={onAddMeal}
        />
        <QuickActionCard
          title={t('home.addWorkout')}
          subtitle={t('home.addWorkoutSubtitle')}
          actionLabel={t('common.add')}
          icon="barbell-outline"
          accent={colors.purple}
          onPress={onAddWorkout}
        />
      </View>

      <DailyGoalBanner
        title={t('home.dailyGoal.title')}
        calorieValue={`${Math.round(totals.calories)} / ${calorieTarget} ${t('common.kcal')}`}
        proteinValue={`${Math.round(totals.protein)} / ${proteinTarget} ${t('common.grams')}`}
        mealsValue={t('home.dailyGoal.meals', { count: mealCount })}
        workoutValue={t('home.dailyGoal.workouts', { count: filteredWorkouts.length })}
      />

      <LatestActivityList title={t('home.latestActivity')} emptyTitle={t('home.activity.empty')} activities={latestActivities} />

      <View style={styles.goals}>
        {goals.length ? (
          goals.map((goal) => (
            <GoalProgressCard
              key={goal.id}
              title={goal.title}
              target={goal.target}
              progress={goal.progress}
              percentLabel={t('home.goals.percentComplete', { amount: Math.round(goal.progress * 100) })}
              remaining={goal.remaining}
              accent={goal.accent}
            />
          ))
        ) : (
          <View style={styles.emptyGoal}>
            <Text style={[styles.emptyGoalText, directionalText]}>{t('home.goals.empty')}</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function buildActivities({
  meals,
  workouts,
  t,
  onMealPress,
  onWorkoutPress,
}: {
  meals: Meal[];
  workouts: Workout[];
  t: Translator;
  onMealPress: (meal: Meal) => void;
  onWorkoutPress: (workout: Workout) => void;
}): HomeActivity[] {
  const mealActivities = meals.map((meal) => {
    const calories = meal.items.reduce((sum, item) => sum + item.calories, 0);

    return {
      id: `meal-${meal.id}`,
      title: t('home.activity.mealAdded', { name: meal.title }),
      time: meal.time,
      meta: `${Math.round(calories)} ${t('common.kcal')}`,
      icon: 'restaurant-outline' as const,
      accent: colors.accent,
      onPress: () => onMealPress(meal),
    };
  });

  const workoutActivities = workouts.map((workout) => {
    const minutes = workoutMinutes([workout]);

    return {
      id: `workout-${workout.id}`,
      title: t('home.activity.workoutCompleted', { name: workout.title }),
      time: workout.time,
      meta: `${minutes} ${t('common.minutes')} - ${workout.exercises.length} ${t('workouts.exerciseLabel')}`,
      icon: 'barbell-outline' as const,
      accent: colors.purple,
      onPress: () => onWorkoutPress(workout),
    };
  });

  return [...mealActivities, ...workoutActivities].sort((left, right) => right.time.localeCompare(left.time)).slice(0, 4);
}

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateFromKey(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00`);
}

function resolveStoredDate(value: string): Date {
  const normalized = value.trim().toLowerCase();
  const today = new Date();

  if (normalized === 'today' || normalized === 'اليوم') {
    return today;
  }

  if (normalized === 'yesterday' || normalized === 'أمس') {
    return shiftDate(today, -1);
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(normalized)) {
    return dateFromKey(normalized.slice(0, 10));
  }

  return today;
}

function shiftDate(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(date: Date): Date {
  const start = new Date(date);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + diff);
  return start;
}

function isInSelectedPeriod(value: Date, selectedDate: Date, period: PeriodKey): boolean {
  const dateKey = toDateKey(value);

  if (period === 'today') {
    return dateKey === toDateKey(selectedDate);
  }

  if (period === 'week') {
    const start = startOfWeek(selectedDate).getTime();
    const end = start + 7 * dayMs;
    const time = dateFromKey(dateKey).getTime();
    return time >= start && time < end;
  }

  return value.getFullYear() === selectedDate.getFullYear() && value.getMonth() === selectedDate.getMonth();
}

function getPeriodDayCount(date: Date, period: PeriodKey): number {
  if (period === 'week') {
    return 7;
  }

  if (period === 'month') {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }

  return 1;
}

function buildDateOptions(center: Date, rtl: boolean): DateOption[] {
  const dates = Array.from({ length: 7 }, (_, index) => {
    const date = shiftDate(center, index - 3);
    const locale = rtl ? 'ar-EG' : 'en-US';

    return {
      key: toDateKey(date),
      dayName: new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date),
      dayNumber: new Intl.DateTimeFormat(locale, { day: 'numeric' }).format(date),
    };
  });

  return rtl ? dates.reverse() : dates;
}

function formatMonthYear(date: Date, rtl: boolean): string {
  return new Intl.DateTimeFormat(rtl ? 'ar-EG' : 'en-US', {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.xl,
    paddingBottom: 128,
    gap: spacing.xl,
  },
  metricRow: {
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
  },
  quickRow: {
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  goals: {
    gap: spacing.lg,
  },
  emptyGoal: {
    borderRadius: 22,
    padding: spacing.lg,
    backgroundColor: colors.card,
  },
  emptyGoalText: {
    ...typography.body,
    color: colors.textMuted,
  },
});
