import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { CombinedProgressStatsCard } from '../components/home/CombinedProgressStatsCard';
import { DailyGoalBanner } from '../components/home/DailyGoalBanner';
import { DateSelector, type DateOption } from '../components/home/DateSelector';
import { GoalProgressCard } from '../components/home/GoalProgressCard';
import { HomeHeader } from '../components/home/HomeHeader';
import { LatestActivityList, type HomeActivity } from '../components/home/LatestActivityList';
import { PeriodSelector, type PeriodKey } from '../components/home/PeriodSelector';
import { QuickActionCard } from '../components/home/QuickActionCard';
import { useBottomNavScrollHandler } from '../context/BottomNavContext';
import type { Translator } from '../i18n';
import { themeColors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import type { Meal, SleepEntry, UserProfile, WaterEntry, Workout } from '../types';
import { calculateDailyNutrition, estimateWeightGainKg, formatWeightGainKg, progressRatio, workoutMinutes } from '../utils/nutrition';
import { activeIsRTL, activeRowStyle, activeTextAlign, activeWritingDirection } from '../utils/rtl';

type HomeScreenProps = {
  t: Translator;
  profile: UserProfile;
  meals: Meal[];
  workouts: Workout[];
  sleepEntries?: SleepEntry[];
  waterEntries?: WaterEntry[];
  onAddMeal: () => void;
  onAddWorkout: () => void;
  onMealPress: (meal: Meal) => void;
  onWorkoutPress: (workout: Workout) => void;
};

const dayMs = 24 * 60 * 60 * 1000;
const muscleTranslationKeys: Record<string, string> = {
  arms: 'arms',
  back: 'back',
  chest: 'chest',
  core: 'core',
  glutes: 'glutes',
  legs: 'legs',
  shoulders: 'shoulders',
};

export function HomeScreen({
  t,
  profile,
  meals,
  workouts,
  sleepEntries = [],
  waterEntries = [],
  onAddMeal,
  onAddWorkout,
  onMealPress,
  onWorkoutPress,
}: HomeScreenProps) {
  const colors = themeColors();
  const handleBottomNavScroll = useBottomNavScrollHandler();
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
  const filteredSleepEntries = useMemo(
    () => sleepEntries.filter((entry) => isInSelectedPeriod(resolveStoredDate(entry.date), selectedDate, period)),
    [sleepEntries, period, selectedDateKey],
  );
  const filteredWaterEntries = useMemo(
    () => waterEntries.filter((entry) => isInSelectedPeriod(resolveStoredDate(entry.date), selectedDate, period)),
    [waterEntries, period, selectedDateKey],
  );

  const totals = calculateDailyNutrition(filteredMeals);
  const goalDayCount = getGoalDayCount(period);
  const dailyCaloriesGoal = profile.targetCalories || 2200;
  const dailyMaintenanceCalories = profile.targetCalories || 2200;
  const dailyMealsGoal = 3;
  const dailyWorkoutGoal = 1;
  const dailySleepGoalHours = profile.sleepGoalHours || 8;
  const dailyWaterGoalLiters = profile.waterGoalLiters || 3;
  const calorieTarget = dailyCaloriesGoal * goalDayCount;
  const proteinTarget = profile.targetProtein * goalDayCount;
  const sleepTarget = dailySleepGoalHours * goalDayCount;
  const waterTarget = dailyWaterGoalLiters * goalDayCount;
  const maintenancePeriodDays = getMaintenancePeriodDayCount(period);
  const expectedWeightGain = estimateWeightGainKg(totals.calories - (dailyMaintenanceCalories * maintenancePeriodDays));
  const expectedWeightGainLabel = getExpectedGainLabel(t, period);
  const muscleGainRatio = filteredWorkouts.length > 0 ? 0.6 : 0.35;
  const estimatedMuscleGain = Math.max(expectedWeightGain, 0) * muscleGainRatio;
  const estimatedFatGain = Math.max(expectedWeightGain - estimatedMuscleGain, 0);
  const targetedBodyLabel = getTargetedBodyLabel(filteredWorkouts, t, period, rtl);
  const exerciseCount = filteredWorkouts.reduce((sum, workout) => sum + workout.exercises.length, 0);
  const sleepHours = sumSleepHours(filteredSleepEntries);
  const waterLiters = sumWaterLiters(filteredWaterEntries);
  const mealCount = filteredMeals.length;
  const mealTarget = dailyMealsGoal * goalDayCount;
  const workoutTarget = dailyWorkoutGoal * goalDayCount;
  const caloriesProgress = progressRatio(totals.calories, calorieTarget);
  const workoutProgress = progressRatio(filteredWorkouts.length, workoutTarget);
  const sleepProgress = progressRatio(sleepHours, sleepTarget);
  const waterProgress = progressRatio(waterLiters, waterTarget);
  const mealsProgress = progressRatio(mealCount, mealTarget);
  const overallProgress = (caloriesProgress + workoutProgress + mealsProgress + sleepProgress + waterProgress) / 5;
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
    { key: 'today' as const, label: t('home.period.today') },
    { key: 'week' as const, label: t('home.period.week') },
    { key: 'month' as const, label: t('home.period.month') },
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
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      onScroll={handleBottomNavScroll}
      scrollEventThrottle={16}
    >
      <HomeHeader
        avatarInitials={profile.avatarInitials}
        greeting={t('home.headerGreeting', { name: firstName })}
        subtitle={t('home.headerSubtitle')}
        onActionPress={() => undefined}
      />

      <PeriodSelector options={periodOptions} selected={period} onChange={setPeriod} />

      <CombinedProgressStatsCard
        isRTL={rtl}
        progressStat={{
          title: t('home.metrics.progress'),
          value: formatWeightGainKg(expectedWeightGain, t('common.kg')),
          subtitle: expectedWeightGainLabel,
          accent: colors.progress,
          progress: overallProgress,
        }}
        caloriesStat={{
          title: t('home.metrics.calories'),
          value: `${Math.round(totals.calories)}/${calorieTarget}`,
          subtitle: t('common.kcal'),
          accent: colors.calories,
          progress: caloriesProgress,
        }}
        workoutStat={{
          title: t('home.metrics.workout'),
          value: `${filteredWorkouts.length}/${workoutTarget}`,
          subtitle: t('home.metrics.exercises', { count: exerciseCount }),
          accent: colors.workout,
          progress: workoutProgress,
        }}
        sleepStat={{
          title: t('home.metrics.sleep'),
          value: `${formatDecimal(sleepHours)}${t('common.hoursShort')} / ${formatDecimal(sleepTarget)}${t('common.hoursShort')}`,
          subtitle: t('home.metrics.sleepGoal'),
          accent: colors.sleep,
          progress: sleepProgress,
        }}
        waterStat={{
          title: t('home.metrics.water'),
          value: `${formatDecimal(waterLiters)}${t('common.litersShort')} / ${formatDecimal(waterTarget)}${t('common.litersShort')}`,
          subtitle: t('home.metrics.waterGoal'),
          accent: colors.water,
          progress: waterProgress,
        }}
        progressInfo={[
          {
            label: t('home.metrics.muscles'),
            value: formatWeightGainKg(estimatedMuscleGain, t('common.kg')),
            icon: 'arm-flex-outline',
            iconFamily: 'materialCommunity',
            accent: colors.workout,
            subtitle: t('home.metrics.estimatedLeanGain'),
          },
          {
            label: t('home.metrics.fat'),
            value: formatWeightGainKg(estimatedFatGain, t('common.kg')),
            icon: 'water-outline',
            accent: colors.calories,
            subtitle: t('home.metrics.estimatedFatGain'),
          },
          {
            label: t('home.metrics.body'),
            value: targetedBodyLabel,
            icon: 'body-outline',
            accent: colors.progress,
            subtitle: t('home.metrics.targetedMuscles'),
          },
        ]}
      />

      <DateSelector
        title={formatMonthYear(selectedDate, rtl)}
        dates={dateOptions}
        selectedDate={selectedDateKey}
        onSelect={handleDateSelect}
      />

      <Text style={[styles.sectionTitle, directionalText, { color: colors.text }]}>{t('home.todayPlan')}</Text>
      <View style={[styles.quickRow, activeRowStyle()]}>
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
          <View style={[styles.emptyGoal, { backgroundColor: colors.card }]}>
            <Text style={[styles.emptyGoalText, directionalText, { color: colors.textMuted }]}>{t('home.goals.empty')}</Text>
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
  const colors = themeColors();
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

function getGoalDayCount(period: PeriodKey): number {
  if (period === 'week') {
    return 7;
  }

  if (period === 'month') {
    return 30;
  }

  return 1;
}

function getMaintenancePeriodDayCount(period: PeriodKey): number {
  if (period === 'week') {
    return 7;
  }

  if (period === 'month') {
    return 30;
  }

  return 1;
}

function getExpectedGainLabel(t: Translator, period: PeriodKey): string {
  if (period === 'week') {
    return t('home.metrics.expectedGainThisWeek');
  }

  if (period === 'month') {
    return t('home.metrics.expectedGainThisMonth');
  }

  return t('home.metrics.expectedGainToday');
}

function sumSleepHours(entries: SleepEntry[]): number {
  return entries.reduce((sum, entry) => sum + safeNonNegative(entry.hours), 0);
}

function sumWaterLiters(entries: WaterEntry[]): number {
  return entries.reduce((sum, entry) => sum + safeNonNegative(entry.liters), 0);
}

function safeNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(value, 0) : 0;
}

function formatDecimal(value: number): string {
  const safeValue = safeNonNegative(value);
  return Number.isInteger(safeValue) ? String(safeValue) : safeValue.toFixed(1);
}

function getTargetedBodyLabel(workouts: Workout[], t: Translator, period: PeriodKey, rtl: boolean): string {
  const muscles = uniqueMuscles(workouts.flatMap((workout) => workout.exercises.flatMap(getExerciseMuscles)));

  if (muscles.length) {
    return muscles
      .slice(0, period === 'today' ? 2 : 3)
      .map((muscle) => translateMuscleName(muscle, t))
      .join(rtl ? '، ' : ', ');
  }

  if (workouts.length === 0 && period !== 'month') {
    return t('home.metrics.noWorkoutYet');
  }

  return t('home.metrics.fullBody');
}

function getExerciseMuscles(exercise: Workout['exercises'][number]): string[] {
  if (exercise.targetMuscles?.length) {
    return exercise.targetMuscles;
  }

  const name = exercise.exerciseName.toLowerCase();
  const muscles: string[] = [];

  if (/bench|chest|press|push/.test(name)) {
    muscles.push('chest', 'arms');
  }

  if (/row|pull|lat|back/.test(name)) {
    muscles.push('back', 'arms');
  }

  if (/run|squat|lunge|leg/.test(name)) {
    muscles.push('legs');
  }

  if (/shoulder|overhead/.test(name)) {
    muscles.push('shoulders');
  }

  if (/core|plank|abs/.test(name)) {
    muscles.push('core');
  }

  return muscles;
}

function uniqueMuscles(muscles: string[]): string[] {
  return muscles.reduce<string[]>((unique, muscle) => {
    const normalized = muscle.trim().toLowerCase();

    if (normalized && !unique.includes(normalized)) {
      unique.push(normalized);
    }

    return unique;
  }, []);
}

function translateMuscleName(muscle: string, t: Translator): string {
  const muscleKey = muscleTranslationKeys[muscle.trim().toLowerCase()];
  return muscleKey ? t(`home.muscleGroups.${muscleKey}`) : muscle;
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

  return dates;
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
  },
  content: {
    padding: spacing.xl,
    paddingBottom: 128,
    gap: spacing.xl,
  },
  sectionTitle: {
    ...typography.h3,
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
  },
  emptyGoalText: {
    ...typography.body,
  },
});
