import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { AppHeader } from '../../components/common/AppHeader';
import { MacroCard } from '../../components/common/MacroCard';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { WorkoutCard } from '../../components/common/WorkoutCard';
import { FoodItemRow } from '../../components/meals/FoodItemRow';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useLanguage } from '../../hooks/useLanguage';
import type { RootStackParamList } from '../../navigation/types';
import { useApp } from '../../store/AppContext';
import { compareDateTimeDesc, formatDisplayDate, todayISO } from '../../utils/date';
import {
  mealsForToday,
  nutritionTotalsForMeals,
  weeklyMealSummary,
  weeklyWorkoutMinutes,
  workoutsForToday,
} from '../../utils/health';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

export function DashboardScreen() {
  const navigation = useNavigation<Navigation>();
  const { meals, profile, workouts } = useApp();
  const theme = useAppTheme();
  const { language, rowDirectionStyle, t, textDirectionStyle } = useLanguage();
  const todayMeals = mealsForToday(meals).sort(compareDateTimeDesc);
  const todayWorkouts = workoutsForToday(workouts).sort(compareDateTimeDesc);
  const totals = nutritionTotalsForMeals(todayMeals);
  const weekCalories = weeklyMealSummary(meals).reduce((sum, day) => sum + day.calories, 0);
  const caloriesLeft = Math.max(0, profile.targetCalories - totals.calories);

  return (
    <ScreenContainer>
      <AppHeader
        eyebrow={formatDisplayDate(todayISO(), language)}
        title={t('dashboard.hello', { name: profile.name.split(' ')[0] })}
        subtitle={t('dashboard.subtitle')}
      />

      <AppCard tone="primary" style={styles.hero}>
        <View style={[styles.heroTop, rowDirectionStyle]}>
          <View style={styles.heroCopy}>
            <Text style={[styles.heroTitle, textDirectionStyle]}>{t('dashboard.heroTitle')}</Text>
            <Text style={[styles.heroSubtitle, textDirectionStyle]}>
              {t('dashboard.heroSubtitle', {
                calories: Math.round(totals.calories),
                goal: profile.targetCalories,
              })}
            </Text>
          </View>
          <View style={styles.heroIcon}>
            <Ionicons name="flame" size={34} color={theme.colors.accent} />
          </View>
        </View>
        <View style={styles.calorieTrack}>
          <View
            style={[
              styles.calorieFill,
              {
                width: `${Math.min(100, (totals.calories / profile.targetCalories) * 100)}%`,
                backgroundColor: theme.colors.accent,
              },
            ]}
          />
        </View>
        <View style={[styles.heroStats, rowDirectionStyle]}>
          <Text style={styles.heroStat}>{Math.round(caloriesLeft)} {t('common.remaining')}</Text>
          <Text style={styles.heroStat}>{Math.round(weekCalories)} {t('dashboard.weeklyCalories')}</Text>
        </View>
      </AppCard>

      <View style={[styles.actions, rowDirectionStyle]}>
        <AppButton
          title={t('dashboard.addMeal')}
          icon="add"
          onPress={() => navigation.navigate('AddEditMeal')}
          style={styles.action}
        />
        <AppButton
          title={t('dashboard.searchFood')}
          icon="search"
          variant="secondary"
          onPress={() => navigation.navigate('FoodSearch')}
          style={styles.action}
        />
      </View>

      <View style={[styles.macroGrid, rowDirectionStyle]}>
        <MacroCard
          label={t('macros.protein')}
          value={totals.protein}
          goal={profile.targetProtein}
          unit={t('macros.grams')}
          icon="barbell-outline"
        />
        <MacroCard
          label={t('macros.carbs')}
          value={totals.carbs}
          goal={profile.targetCarbs}
          unit={t('macros.grams')}
          icon="leaf-outline"
          color={theme.colors.accent}
        />
      </View>

      <AppCard>
        <View style={[styles.sectionTop, rowDirectionStyle]}>
          <Text style={[styles.sectionTitle, textDirectionStyle, { color: theme.colors.text }]}>
            {t('dashboard.todayMeals')}
          </Text>
          <AppButton
            title={t('common.viewAll')}
            icon="restaurant-outline"
            variant="ghost"
            onPress={() => navigation.navigate('NutritionSummary')}
            style={styles.smallButton}
          />
        </View>
        {todayMeals.length ? (
          todayMeals.slice(0, 2).flatMap((meal) => meal.items.slice(0, 2).map((item) => (
            <FoodItemRow key={`${meal.id}-${item.id}`} item={item} />
          )))
        ) : (
          <Text style={[styles.empty, textDirectionStyle, { color: theme.colors.textMuted }]}>
            {t('dashboard.noMealsToday')}
          </Text>
        )}
      </AppCard>

      <AppCard>
        <View style={[styles.sectionTop, rowDirectionStyle]}>
          <Text style={[styles.sectionTitle, textDirectionStyle, { color: theme.colors.text }]}>
            {t('dashboard.todayWorkouts')}
          </Text>
          <Text style={[styles.badge, { color: theme.colors.primary, backgroundColor: theme.colors.primaryMuted }]}>
            {weeklyWorkoutMinutes(workouts)} {t('workouts.minutesShort')}
          </Text>
        </View>
        {todayWorkouts.length ? (
          todayWorkouts.slice(0, 2).map((workout) => (
            <WorkoutCard
              key={workout.id}
              workout={workout}
              onPress={() => navigation.navigate('WorkoutDetails', { workoutId: workout.id })}
            />
          ))
        ) : (
          <Text style={[styles.empty, textDirectionStyle, { color: theme.colors.textMuted }]}>
            {t('dashboard.noWorkoutsToday')}
          </Text>
        )}
      </AppCard>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: {
    padding: 22,
  },
  heroTop: {
    alignItems: 'center',
    gap: 14,
  },
  heroCopy: {
    flex: 1,
  },
  heroIcon: {
    width: 62,
    height: 62,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
  },
  heroSubtitle: {
    color: '#EAF3FF',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 5,
  },
  calorieTrack: {
    height: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
  },
  calorieFill: {
    height: '100%',
    borderRadius: 999,
  },
  heroStats: {
    justifyContent: 'space-between',
    gap: 12,
  },
  heroStat: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  actions: {
    gap: 12,
  },
  action: {
    flex: 1,
  },
  macroGrid: {
    flexWrap: 'wrap',
    gap: 12,
  },
  sectionTop: {
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '900',
  },
  smallButton: {
    minHeight: 40,
    paddingHorizontal: 12,
  },
  badge: {
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: '900',
  },
  empty: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '700',
  },
});
