import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { Meal } from '../types';
import { themeColors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { calculateMealTotals } from '../utils/nutrition';
import { activeRowStyle, activeTextAlign, activeWritingDirection } from '../utils/rtl';

type MealCardProps = {
  meal: Meal;
  caloriesLabel: string;
  itemLabel: string;
  onPress: () => void;
};

export function MealCard({ meal, caloriesLabel, itemLabel, onPress }: MealCardProps) {
  const colors = themeColors();
  const totals = calculateMealTotals(meal.items);
  const directionalText = {
    textAlign: activeTextAlign(),
    writingDirection: activeWritingDirection(),
  } as const;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        activeRowStyle(),
        { backgroundColor: colors.card, opacity: pressed ? 0.78 : 1 },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: colors.accent }]}>
        <Ionicons name="restaurant-outline" color={colors.buttonText} size={22} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.title, directionalText, { color: colors.text }]} numberOfLines={1}>
          {meal.title}
        </Text>
        <Text style={[styles.meta, directionalText, { color: colors.textMuted }]} numberOfLines={1}>
          {meal.time} - {meal.items.length} {itemLabel}
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
