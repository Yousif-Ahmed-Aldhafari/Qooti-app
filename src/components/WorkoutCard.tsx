import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { Workout } from '../types';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { activeRowDirection, activeTextAlign, activeWritingDirection } from '../utils/rtl';

type WorkoutCardProps = {
  workout: Workout;
  minutesLabel: string;
  exerciseLabel: string;
  onPress: () => void;
};

export function WorkoutCard({ workout, minutesLabel, exerciseLabel, onPress }: WorkoutCardProps) {
  const minutes = workout.exercises.reduce((sum, exercise) => sum + exercise.duration, 0);
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
        <Ionicons name="barbell-outline" color={colors.text} size={23} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.title, directionalText]} numberOfLines={1}>
          {workout.title}
        </Text>
        <Text style={[styles.meta, directionalText]} numberOfLines={1}>
          {workout.time} - {workout.exercises.length} {exerciseLabel}
        </Text>
      </View>
      <View style={styles.pill}>
        <Text style={[styles.pillText, directionalText]}>
          {minutes || 45} {minutesLabel}
        </Text>
      </View>
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
    backgroundColor: colors.purple,
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
  pill: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.cardMuted,
  },
  pillText: {
    ...typography.caption,
    color: colors.accent,
  },
});
