import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppButton } from '../components/AppButton';
import { AppHeader } from '../components/AppHeader';
import { EmptyState } from '../components/EmptyState';
import { MealCard } from '../components/MealCard';
import { useBottomNavScrollHandler } from '../context/BottomNavContext';
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
import { calculateDailyNutrition, formatLocalDate } from '../utils/nutrition';
import { resolveEffectiveNutritionTargets } from '../utils/nutritionTargets';
import { activeRowStyle, activeTextAlign, activeWritingDirection } from '../utils/rtl';

type MealsScreenProps = {
  t: Translator;
  meals: Meal[];
  onAddMeal: (initialDate?: string) => void;
  onMealPress: (meal: Meal) => void;
  profile?: UserProfile;
  language?: 'en' | 'ar';
  initialDate?: string;
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
  initialDate,
}: MealsScreenProps) {
  const colors = themeColors();
  const isRTL = language === 'ar';
  const handleBottomNavScroll = useBottomNavScrollHandler();

  const directionalText = {
    textAlign: activeTextAlign(),
    writingDirection: activeWritingDirection(),
  } as const;

  const todayKey = useMemo(() => formatLocalDate(new Date()), []);
  const [selectedDate, setSelectedDate] = useState<string>(initialDate || todayKey);

  // Filter meals for the selected local calendar day
  const selectedDateMeals = useMemo(() => {
    return meals.filter((m) => {
      if (!m.date) return true; // Legacy meals without date included on all days
      const localDate = m.date.slice(0, 10);
      return localDate === selectedDate;
    });
  }, [meals, selectedDate]);

  // Calculate actual daily nutrition totals for selected day
  const dailyTotals = useMemo(
    () => calculateDailyNutrition(selectedDateMeals),
    [selectedDateMeals]
  );
  const effectiveTargets = useMemo(() => resolveEffectiveNutritionTargets(profile), [profile]);

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
    setSelectedDate((prev) => getPreviousCalendarDate(prev));
  }

  function handleNextDay() {
    setSelectedDate((prev) => getNextCalendarDate(prev));
  }

  function handleJumpToToday() {
    setSelectedDate(todayKey);
  }

  // Localized date header label
  const dateHeaderLabel = useMemo(() => {
    const formatted = formatDisplayDate(selectedDate, language);
    const yesterdayKey = getPreviousCalendarDate(todayKey);
    const tomorrowKey = getNextCalendarDate(todayKey);

    if (selectedDate === todayKey) {
      return `${t('meals.today') || 'Today'} · ${formatted}`;
    }
    if (selectedDate === yesterdayKey) {
      return `${t('meals.yesterday') || 'Yesterday'} · ${formatted}`;
    }
    if (selectedDate === tomorrowKey) {
      return `${t('meals.tomorrow') || 'Tomorrow'} · ${formatted}`;
    }
    return formatted;
  }, [selectedDate, todayKey, language, t]);

  const isToday = selectedDate === todayKey;

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
            onPress={() => onAddMeal(selectedDate)}
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

      {/* Daily Nutrition Summary Card for Selected Date */}
      {effectiveTargets.hasActiveTarget ? (
        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.summaryTitle, directionalText, { color: colors.text }]}>
            {t('nutrition.title')}
          </Text>
          <View style={[styles.summaryRow, activeRowStyle()]}>
            <Text style={[styles.summaryMetric, directionalText, { color: colors.accent }]}>
              {`${Math.round(dailyTotals.calories)} / ${effectiveTargets.calories} ${t('common.kcal')}`}
            </Text>
            <Text style={[styles.summarySub, directionalText, { color: colors.textMuted }]}>
              {`${Math.round(dailyTotals.protein)}g ${t('common.protein')} · ${Math.round(dailyTotals.carbs)}g ${t('common.carbs')} · ${Math.round(dailyTotals.fats)}g ${t('common.fats')}`}
            </Text>
          </View>
        </View>
      ) : (
        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.summaryTitle, directionalText, { color: colors.text }]}>
            {t('nutrition.title')}
          </Text>
          <View style={[styles.summaryRow, activeRowStyle()]}>
            <Text style={[styles.summaryMetric, directionalText, { color: colors.accent }]}>
              {`${Math.round(dailyTotals.calories)} ${t('common.kcal')}`}
            </Text>
            <Text style={[styles.summarySub, directionalText, { color: colors.textMuted }]}>
              {`${Math.round(dailyTotals.protein)}g ${t('common.protein')} · ${Math.round(dailyTotals.carbs)}g ${t('common.carbs')} · ${Math.round(dailyTotals.fats)}g ${t('common.fats')}`}
            </Text>
          </View>
        </View>
      )}

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
          onAction={() => onAddMeal(selectedDate)}
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
});
