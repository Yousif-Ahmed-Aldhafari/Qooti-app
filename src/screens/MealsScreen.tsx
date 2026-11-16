import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppButton } from '../components/AppButton';
import { AppHeader } from '../components/AppHeader';
import { EmptyState } from '../components/EmptyState';
import { MacroCard } from '../components/MacroCard';
import { MacroDistributionBar } from '../components/MacroDistributionBar';
import { MealCard } from '../components/MealCard';
import { useBottomNavScrollHandler } from '../context/BottomNavContext';
import { useLiveLocalDate } from '../hooks/useLiveLocalDate';
import type { Translator } from '../i18n';
import type { MealType } from '../models/meal';
import { themeColors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import type { Meal, UserProfile } from '../types';
import {
  formatDisplayDate,
  getNextCalendarDate,
  getPreviousCalendarDate,
} from '../utils/date';
import {
  calculateMacroDistribution,
  calculateNutritionTargetProgress,
  getDailyNutritionSummary,
} from '../utils/nutrition';
import { resolveEffectiveNutritionTargets } from '../utils/nutritionTargets';
import { activeRowStyle, activeTextAlign, activeWritingDirection } from '../utils/rtl';

type MealsScreenProps = {
  t: Translator;
  meals: Meal[];
  onAddMeal: (initialDate?: string) => void;
  onMealPress: (meal: Meal) => void;
  profile?: UserProfile;
  language?: 'en' | 'ar';
  selectedDate?: string;
  onSelectDate?: (date: string) => void;
  initialDate?: string;
  clock?: () => Date;
};

const MEAL_SLOT_ORDER: { type: MealType | 'other'; key: string; icon: string }[] = [
  { type: 'breakfast', key: 'meals.breakfast', icon: 'sunny-outline' },
  { type: 'lunch', key: 'meals.lunch', icon: 'restaurant-outline' },
  { type: 'dinner', key: 'meals.dinner', icon: 'moon-outline' },
  { type: 'snack', key: 'meals.snack', icon: 'cafe-outline' },
  { type: 'other', key: 'meals.other', icon: 'fast-food-outline' },
];

export function MealsScreen({
  t,
  meals,
  onAddMeal,
  onMealPress,
  profile,
  language = 'en',
  selectedDate: selectedDateProp,
  onSelectDate,
  initialDate,
  clock,
}: MealsScreenProps) {
  const colors = themeColors();
  const isRTL = language === 'ar';
  const handleBottomNavScroll = useBottomNavScrollHandler();

  const directionalText = {
    textAlign: activeTextAlign(),
    writingDirection: activeWritingDirection(),
  } as const;

  // Live local date tracking with background/resume and midnight rollover
  const liveTodayKey = useLiveLocalDate(undefined, clock);
  const todayKey = liveTodayKey;

  const [internalSelectedDate, setInternalSelectedDate] = useState<string>(
    selectedDateProp || initialDate || todayKey
  );

  const activeDate = selectedDateProp ?? internalSelectedDate;

  function handleSelectDate(newDate: string) {
    if (onSelectDate) {
      onSelectDate(newDate);
    }
    setInternalSelectedDate(newDate);
  }

  // Filter meals strictly for the active local calendar day (excluding undated meals)
  const selectedDateMeals = useMemo(() => {
    return meals.filter((m) => {
      if (!m.date || typeof m.date !== 'string') return false;
      const trimmed = m.date.trim();
      if (!trimmed) return false;
      return trimmed.slice(0, 10) === activeDate;
    });
  }, [meals, activeDate]);

  // Separate undated legacy records for recovery without corrupting daily totals
  const undatedMeals = useMemo(() => {
    return meals.filter((m) => {
      if (!m.date || typeof m.date !== 'string') return true;
      return m.date.trim() === '';
    });
  }, [meals]);

  // Pure authoritative daily nutrition summary for selected date
  const dailySummary = useMemo(
    () => getDailyNutritionSummary(meals, activeDate),
    [meals, activeDate]
  );
  const effectiveTargets = useMemo(() => resolveEffectiveNutritionTargets(profile), [profile]);
  const targetProgress = useMemo(
    () => calculateNutritionTargetProgress(dailySummary, effectiveTargets),
    [dailySummary, effectiveTargets]
  );
  const macroDistribution = useMemo(
    () => calculateMacroDistribution(dailySummary),
    [dailySummary]
  );

  // Group meals by mealType
  const groupedMeals = useMemo(() => {
    const groups: Record<string, Meal[]> = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: [],
      other: [],
    };

    for (const meal of selectedDateMeals) {
      const type = (meal.mealType as MealType) || 'other';
      if (groups[type]) {
        groups[type].push(meal);
      } else {
        groups.other.push(meal);
      }
    }

    return groups;
  }, [selectedDateMeals]);

  // Date Navigation Handlers
  function handlePreviousDay() {
    handleSelectDate(getPreviousCalendarDate(activeDate));
  }

  function handleNextDay() {
    handleSelectDate(getNextCalendarDate(activeDate));
  }

  function handleJumpToToday() {
    handleSelectDate(todayKey);
  }

  // Localized date header label
  const dateHeaderLabel = useMemo(() => {
    const formatted = formatDisplayDate(activeDate, language);
    const yesterdayKey = getPreviousCalendarDate(todayKey);
    const tomorrowKey = getNextCalendarDate(todayKey);

    if (activeDate === todayKey) {
      return `${t('meals.today') || 'Today'} · ${formatted}`;
    }
    if (activeDate === yesterdayKey) {
      return `${t('meals.yesterday') || 'Yesterday'} · ${formatted}`;
    }
    if (activeDate === tomorrowKey) {
      return `${t('meals.tomorrow') || 'Tomorrow'} · ${formatted}`;
    }
    return formatted;
  }, [activeDate, todayKey, language, t]);

  const isToday = activeDate === todayKey;

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
        action={
          <AppButton
            title={t('common.add')}
            icon="add"
            onPress={() => onAddMeal(activeDate)}
          />
        }
      />

      {/* Date Navigation Bar */}
      <View style={[styles.dateNavBar, activeRowStyle(), { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('meals.previousDay') || 'Previous day'}
          onPress={handlePreviousDay}
          style={({ pressed }) => [styles.navArrowBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Ionicons
            name={isRTL ? 'chevron-forward' : 'chevron-back'}
            size={22}
            color={colors.text}
          />
        </Pressable>

        <Pressable
          onPress={handleJumpToToday}
          accessibilityRole="button"
          accessibilityLabel={dateHeaderLabel}
          style={styles.dateLabelWrap}
        >
          <Text style={[styles.dateLabelText, { color: colors.text }]}>
            {dateHeaderLabel}
          </Text>
          {!isToday && (
            <View style={[styles.todayBadge, { backgroundColor: `${colors.primary}20` }]}>
              <Text style={[styles.todayBadgeText, { color: colors.primary }]}>
                {t('meals.today') || 'Today'}
              </Text>
            </View>
          )}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('meals.nextDay') || 'Next day'}
          onPress={handleNextDay}
          style={({ pressed }) => [styles.navArrowBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Ionicons
            name={isRTL ? 'chevron-back' : 'chevron-forward'}
            size={22}
            color={colors.text}
          />
        </Pressable>
      </View>

      {/* Daily Nutrition Dashboard for Selected Date */}
      <View style={[styles.dashboardCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.dashboardHeader, activeRowStyle()]}>
          <Text style={[styles.dashboardTitle, directionalText, { color: colors.text }]}>
            {t('nutrition.title') || 'Daily Nutrition Summary'}
          </Text>
          {effectiveTargets.hasActiveTarget ? (
            <View style={[styles.targetBadge, { backgroundColor: `${colors.primary}15` }]}>
              <Text style={[styles.targetBadgeText, { color: colors.primary }]}>
                {effectiveTargets.isCustomOverride
                  ? (t('targets.customTarget') || 'Custom Goal')
                  : (t('targets.activeGoal') || 'Daily Goal')}
              </Text>
            </View>
          ) : (
            <View style={[styles.targetBadge, { backgroundColor: `${colors.warning}15` }]}>
              <Text style={[styles.targetBadgeText, { color: colors.warning }]}>
                {effectiveTargets.setupPrompt?.titleKey
                  ? (t(effectiveTargets.setupPrompt.titleKey) || 'Unconfirmed')
                  : (t('personalization.unconfirmedStatus') || 'Unconfirmed')}
              </Text>
            </View>
          )}
        </View>

        {!dailySummary.hasLoggedMeals ? (
          <View style={styles.emptyDayWrap}>
            <Text style={[styles.emptyDayTitle, directionalText, { color: colors.textSecondary }]}>
              {t('meals.noMealsForDate') || 'No meals logged for this day.'}
            </Text>
            <Text style={[styles.emptyDaySubtitle, directionalText, { color: colors.textMuted }]}>
              {t('nutrition.emptyMessage') || 'Add your first meal to see nutrition totals.'}
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.calorieHeroWrap}>
              <View style={[styles.calorieHeroRow, activeRowStyle()]}>
                <View>
                  <Text style={[styles.heroConsumedNumber, directionalText, { color: colors.accent }]}>
                    {Math.round(dailySummary.calories)}
                    <Text style={[styles.heroUnit, { color: colors.textMuted }]}>
                      {effectiveTargets.hasActiveTarget && targetProgress.calories.hasTarget
                        ? ` / ${targetProgress.calories.target} ${t('common.kcal') || 'kcal'}`
                        : ` ${t('common.kcal') || 'kcal'}`}
                    </Text>
                  </Text>
                  <Text style={[styles.heroFoodCount, directionalText, { color: colors.textMuted }]}>
                    {`${dailySummary.mealCount} ${t('nutrition.mealsCount', { count: dailySummary.mealCount }) || 'meals'} · ${dailySummary.loggedFoodCount} ${t('nutrition.foodItemsCount', { count: dailySummary.loggedFoodCount }) || 'foods'}`}
                  </Text>
                </View>

                {effectiveTargets.hasActiveTarget && targetProgress.calories.hasTarget && (
                  <View
                    style={[
                      styles.adherenceBadge,
                      {
                        backgroundColor: targetProgress.calories.isExceeded
                          ? `${colors.warning}20`
                          : `${colors.primary}15`,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.adherenceBadgeText,
                        {
                          color: targetProgress.calories.isExceeded ? colors.warning : colors.primary,
                        },
                      ]}
                    >
                      {targetProgress.calories.isExceeded
                        ? (t('nutrition.overTarget', { amount: Math.round(targetProgress.calories.overage ?? 0) }) || `+${Math.round(targetProgress.calories.overage ?? 0)} kcal over`)
                        : targetProgress.calories.isReached
                        ? (t('nutrition.targetReached') || 'Target reached')
                        : (t('nutrition.remaining', { amount: Math.round(targetProgress.calories.remaining ?? 0) }) || `${Math.round(targetProgress.calories.remaining ?? 0)} kcal remaining`)}
                    </Text>
                  </View>
                )}
              </View>

              {effectiveTargets.hasActiveTarget && targetProgress.calories.hasTarget && (
                <View style={[styles.calorieBarTrack, { backgroundColor: colors.cardMuted }]}>
                  <View
                    style={[
                      styles.calorieBarFill,
                      {
                        width: `${(targetProgress.calories.boundedRatio ?? 0) * 100}%`,
                        backgroundColor: targetProgress.calories.isExceeded ? colors.warning : colors.accent,
                      },
                    ]}
                  />
                </View>
              )}
            </View>

            {!effectiveTargets.hasActiveTarget && (
              <View
                style={[
                  styles.unconfirmedBanner,
                  activeRowStyle(),
                  { backgroundColor: `${colors.warning}10`, borderColor: `${colors.warning}30` },
                ]}
              >
                <Ionicons name="information-circle-outline" size={18} color={colors.warning} />
                <Text style={[styles.unconfirmedBannerText, directionalText, { color: colors.textSecondary }]}>
                  {effectiveTargets.setupPrompt?.messageKey
                    ? t(effectiveTargets.setupPrompt.messageKey)
                    : (t('nutrition.unconfirmedTargetsBanner') || 'Targets not yet active. Set up your profile to enable personalized nutrition targets.')}
                </Text>
              </View>
            )}

            <View style={[styles.macroGrid, activeRowStyle()]}>
              <MacroCard
                label={t('common.protein') || 'Protein'}
                value={dailySummary.protein}
                target={targetProgress.protein.hasTarget ? targetProgress.protein.target : null}
                hasTarget={targetProgress.protein.hasTarget}
                unavailableLabel={t('personalization.unconfirmedStatus') || 'Unconfirmed'}
                unit={t('common.grams') || 'g'}
                accent={colors.purple}
              />
              <MacroCard
                label={t('common.carbs') || 'Carbs'}
                value={dailySummary.carbs}
                target={targetProgress.carbs.hasTarget ? targetProgress.carbs.target : null}
                hasTarget={targetProgress.carbs.hasTarget}
                unavailableLabel={t('personalization.unconfirmedStatus') || 'Unconfirmed'}
                unit={t('common.grams') || 'g'}
                accent={colors.primary}
              />
              <MacroCard
                label={t('common.fats') || 'Fats'}
                value={dailySummary.fats}
                target={targetProgress.fats.hasTarget ? targetProgress.fats.target : null}
                hasTarget={targetProgress.fats.hasTarget}
                unavailableLabel={t('personalization.unconfirmedStatus') || 'Unconfirmed'}
                unit={t('common.grams') || 'g'}
                accent={colors.orange}
              />
            </View>

            <View style={[styles.distributionWrap, { borderTopColor: colors.border }]}>
              <MacroDistributionBar
                distribution={macroDistribution}
                t={t}
                showFootnote={true}
              />
            </View>
          </>
        )}
      </View>

      {/* Meals Grouped by Slot */}
      {selectedDateMeals.length > 0 ? (
        MEAL_SLOT_ORDER.map((slot) => {
          const slotMeals = groupedMeals[slot.type] || [];
          if (slotMeals.length === 0) return null;

          // Slot subtotal calories
          const slotCalories = slotMeals.reduce((acc, m) => {
            if (m.totalCalories !== undefined) return acc + m.totalCalories;
            if (m.items) return acc + m.items.reduce((sum, it) => sum + it.calories, 0);
            return acc;
          }, 0);

          return (
            <View key={slot.type} style={styles.slotSection}>
              {/* Slot Header */}
              <View style={[styles.slotHeaderRow, activeRowStyle()]}>
                <View style={[styles.slotTitleWithIcon, activeRowStyle()]}>
                  <Ionicons name={slot.icon as any} size={18} color={colors.primary} style={{ marginEnd: 6 }} />
                  <Text style={[styles.slotHeaderText, directionalText, { color: colors.text }]}>
                    {t(slot.key as any) || slot.type}
                  </Text>
                </View>
                <Text style={[styles.slotCaloriesSubtotal, directionalText, { color: colors.textMuted }]}>
                  {`${Math.round(slotCalories)} ${t('common.kcal')}`}
                </Text>
              </View>

              {/* Slot Meals */}
              {slotMeals.map((meal) => (
                <MealCard
                  key={meal.id}
                  meal={meal}
                  caloriesLabel={t('common.kcal')}
                  itemLabel={t('meals.itemLabel')}
                  onPress={() => onMealPress(meal)}
                />
              ))}
            </View>
          );
        })
      ) : (
        <EmptyState
          icon="calendar-outline"
          title={t('meals.noMealsForDate') || 'No meals logged for this day'}
          description={t('meals.emptyMessage') || 'Add a meal to see nutrition totals.'}
          actionTitle={t('meals.addTitle') || 'Add meal'}
          actionIcon="add"
          onAction={() => onAddMeal(activeDate)}
        />
      )}

      {/* Recoverable Unassigned Date Legacy Meals Section */}
      {undatedMeals.length > 0 && (
        <View
          accessibilityRole="region"
          accessibilityLabel={t('meals.unassignedDateTitle') || 'Unassigned Date Meals'}
          style={[styles.unassignedCard, { backgroundColor: `${colors.accent}10`, borderColor: `${colors.accent}40` }]}
        >
          <View style={[styles.unassignedHeader, activeRowStyle()]}>
            <View style={[styles.unassignedTitleGroup, activeRowStyle()]}>
              <Ionicons name="help-circle-outline" size={20} color={colors.accent} style={{ marginEnd: 6 }} />
              <Text style={[styles.unassignedTitle, directionalText, { color: colors.text }]}>
                {t('meals.unassignedDateTitle') || 'Unassigned Date Meals'}
              </Text>
            </View>
            <View style={[styles.unassignedBadge, { backgroundColor: colors.accent }]}>
              <Text style={styles.unassignedBadgeText}>{undatedMeals.length}</Text>
            </View>
          </View>
          <Text style={[styles.unassignedDescription, directionalText, { color: colors.textMuted }]}>
            {t('meals.unassignedDateDescription') || 'These legacy meals do not have an assigned calendar date. Tap to edit and assign them to a day.'}
          </Text>
          <View style={styles.unassignedList}>
            {undatedMeals.map((meal) => (
              <MealCard
                key={meal.id}
                meal={meal}
                caloriesLabel={t('common.kcal')}
                itemLabel={t('meals.itemLabel')}
                onPress={() => onMealPress(meal)}
              />
            ))}
          </View>
        </View>
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
  dateNavBar: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    minHeight: 48,
  },
  navArrowBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flex: 1,
    minHeight: 44,
  },
  dateLabelText: {
    fontSize: 15,
    fontWeight: '700',
  },
  todayBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  todayBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  dashboardCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.md,
  },
  dashboardHeader: {
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dashboardTitle: {
    ...typography.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  targetBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  targetBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  emptyDayWrap: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  emptyDayTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyDaySubtitle: {
    ...typography.caption,
    textAlign: 'center',
  },
  calorieHeroWrap: {
    gap: spacing.sm,
  },
  calorieHeroRow: {
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  heroConsumedNumber: {
    ...typography.h2,
    fontWeight: '800',
  },
  heroUnit: {
    ...typography.h3,
    fontWeight: '500',
  },
  heroFoodCount: {
    ...typography.caption,
    marginTop: 2,
  },
  adherenceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  adherenceBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  calorieBarTrack: {
    height: 8,
    borderRadius: radius.pill,
    overflow: 'hidden',
    width: '100%',
  },
  calorieBarFill: {
    height: '100%',
    borderRadius: radius.pill,
  },
  unconfirmedBanner: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  unconfirmedBannerText: {
    ...typography.caption,
    flex: 1,
    fontSize: 12,
  },
  macroGrid: {
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  distributionWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
  },
  slotSection: {
    gap: spacing.sm,
  },
  slotHeaderRow: {
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  slotTitleWithIcon: {
    alignItems: 'center',
  },
  slotHeaderText: {
    fontSize: 15,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  slotCaloriesSubtotal: {
    fontSize: 13,
    fontWeight: '600',
  },
  unassignedCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  unassignedHeader: {
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  unassignedTitleGroup: {
    alignItems: 'center',
    flex: 1,
  },
  unassignedTitle: {
    ...typography.h3,
    fontSize: 15,
  },
  unassignedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  unassignedBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  unassignedDescription: {
    ...typography.caption,
    fontSize: 12,
  },
  unassignedList: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
});
