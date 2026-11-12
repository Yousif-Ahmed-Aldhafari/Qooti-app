import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { AppHeader } from '../components/AppHeader';
import { EmptyState } from '../components/EmptyState';
import { MealCard } from '../components/MealCard';
import { useBottomNavScrollHandler } from '../context/BottomNavContext';
import type { Translator } from '../i18n';
import { themeColors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import type { Meal, UserProfile } from '../types';
import { calculateDailyNutrition } from '../utils/nutrition';
import { resolveEffectiveNutritionTargets } from '../utils/nutritionTargets';
import { activeRowStyle, activeTextAlign, activeWritingDirection } from '../utils/rtl';

type MealsScreenProps = {
  t: Translator;
  meals: Meal[];
  onAddMeal: () => void;
  onMealPress: (meal: Meal) => void;
  profile?: UserProfile;
};

export function MealsScreen({ t, meals, onAddMeal, onMealPress, profile }: MealsScreenProps) {
  const colors = themeColors();
  const handleBottomNavScroll = useBottomNavScrollHandler();
  const directionalText = {
    textAlign: activeTextAlign(),
    writingDirection: activeWritingDirection(),
  } as const;

  const todayKey = new Date().toISOString().slice(0, 10);
  const todayMeals = useMemo(
    () => meals.filter((m) => (m.date ? m.date.slice(0, 10) === todayKey : true)),
    [meals, todayKey]
  );
  const todayTotals = useMemo(() => calculateDailyNutrition(todayMeals), [todayMeals]);
  const effectiveTargets = useMemo(() => resolveEffectiveNutritionTargets(profile), [profile]);

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      onScroll={handleBottomNavScroll}
      scrollEventThrottle={16}
    >
      <AppHeader
        title={t('meals.title')}
        subtitle={t('meals.subtitle')}
        action={<AppButton title={t('common.add')} icon="add" onPress={onAddMeal} />}
      />

      {effectiveTargets.hasActiveTarget ? (
        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.summaryTitle, directionalText, { color: colors.text }]}>
            {t('nutrition.title')}
          </Text>
          <View style={[styles.summaryRow, activeRowStyle()]}>
            <Text style={[styles.summaryMetric, directionalText, { color: colors.accent }]}>
              {`${Math.round(todayTotals.calories)} / ${effectiveTargets.calories} ${t('common.kcal')}`}
            </Text>
            <Text style={[styles.summarySub, directionalText, { color: colors.textMuted }]}>
              {`${Math.round(todayTotals.protein)}g ${t('common.protein')} · ${Math.round(todayTotals.carbs)}g ${t('common.carbs')} · ${Math.round(todayTotals.fats)}g ${t('common.fats')}`}
            </Text>
          </View>
        </View>
      ) : null}

      {meals.length ? (
        meals.map((meal) => (
          <MealCard
            key={meal.id}
            meal={meal}
            caloriesLabel={t('common.kcal')}
            itemLabel={t('meals.itemLabel')}
            onPress={() => onMealPress(meal)}
          />
        ))
      ) : (
        <EmptyState
          icon="restaurant-outline"
          title={t('meals.emptyTitle')}
          description={t('meals.emptyMessage')}
          actionTitle={t('meals.addTitle')}
          actionIcon="add"
          onAction={onAddMeal}
        />
      )}
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
  summaryCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.xs,
  },
  summaryTitle: {
    ...typography.caption,
    fontWeight: '700',
  },
  summaryRow: {
    justifyContent: 'space-between',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  summaryMetric: {
    ...typography.h3,
    fontWeight: '700',
  },
  summarySub: {
    ...typography.caption,
    fontSize: 12,
  },
});
