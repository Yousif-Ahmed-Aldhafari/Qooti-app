import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { Meal } from '../types';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { calculateMealTotals } from '../utils/nutrition';
import { activeRowDirection, activeTextAlign, activeWritingDirection } from '../utils/rtl';

type MealCardProps = {
  meal: Meal;
  caloriesLabel: string;
  itemLabel: string;
  onPress: () => void;
};

export function MealCard({ meal, caloriesLabel, itemLabel, onPress }: MealCardProps) {
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
        { flexDirection: activeRowDirection(), opacity: pressed ? 0.78 : 1 },
      ]}
    >
      <View style={styles.icon}>
        <Ionicons name="restaurant-outline" color={colors.black} size={22} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.title, directionalText]} numberOfLines={1}>
          {meal.title}
        </Text>
        <Text style={[styles.meta, directionalText]} numberOfLines={1}>
          {meal.time} - {meal.items.length} {itemLabel}
        </Text>
      </View>
      <Text style={[styles.calories, directionalText]}>
        {Math.round(totals.calories)} {caloriesLabel}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 76,
    backgroundColor: colors.card,
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
    backgroundColor: colors.accent,
  },
  copy: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    ...typography.h3,
    color: colors.text,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  calories: {
    ...typography.caption,
    color: colors.accent,
  },
});
