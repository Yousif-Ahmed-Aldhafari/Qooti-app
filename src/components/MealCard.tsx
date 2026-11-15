import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { Language, Meal } from '../types';
import { themeColors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { calculateMealTotals } from '../utils/nutrition';
import { rowStyle, textAlign, writingDirection } from '../utils/rtl';
import { getPressFeedback } from '../utils/touchFeedback';

type MealCardProps = {
  meal: Meal;
  caloriesLabel: string;
  itemLabel: string;
  onPress: () => void;
  language?: Language;
};

export function MealCard({ meal, caloriesLabel, itemLabel, onPress, language }: MealCardProps) {
  const colors = themeColors();
  const hasItems = Array.isArray(meal.items) && meal.items.length > 0;
  const totals = hasItems
    ? calculateMealTotals(meal.items)
    : {
        calories: meal.totalCalories ?? 0,
        protein: meal.totalProtein ?? 0,
        carbs: meal.totalCarbs ?? 0,
        fats: meal.totalFat ?? meal.totalFats ?? 0,
        fat: meal.totalFat ?? meal.totalFats ?? 0,
      };

  const itemCount = Array.isArray(meal.items) ? meal.items.length : 1;
  const timeDisplay = meal.time ? `${meal.time}` : '';
  const metaText = timeDisplay
    ? `${timeDisplay} · ${itemCount} ${itemLabel}`
    : `${itemCount} ${itemLabel}`;

  const directionalText = {
    textAlign: textAlign(language),
    writingDirection: writingDirection(language),
  } as const;

  const { android_ripple, styleModifier } = getPressFeedback({
    rippleColor: `${colors.border}4D`,
    activeOpacity: 0.78,
  });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${meal.title || meal.name || ''}, ${timeDisplay}, ${Math.round(totals.calories)} ${caloriesLabel}`}
      android_ripple={android_ripple}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        rowStyle(language),
        { backgroundColor: colors.card },
        styleModifier({ pressed }),
      ]}
    >
      <View style={[styles.icon, { backgroundColor: colors.accent }]}>
        <Ionicons name="restaurant-outline" color={colors.buttonText} size={22} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.title, directionalText, { color: colors.text }]} numberOfLines={1}>
          {meal.title || meal.name || ''}
        </Text>
        <Text style={[styles.meta, directionalText, { color: colors.textMuted }]} numberOfLines={1}>
          {metaText}
        </Text>
      </View>
      <Text style={[styles.calories, directionalText, { color: colors.accent }]}>
        {Math.round(totals.calories)} {caloriesLabel}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 76,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.md,
    overflow: 'hidden',
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    ...typography.h3,
  },
  meta: {
    ...typography.caption,
  },
  calories: {
    ...typography.caption,
  },
});
