import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { Language, Workout } from '../types';
import { themeColors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { rowStyle, textAlign, writingDirection } from '../utils/rtl';
import { getPressFeedback } from '../utils/touchFeedback';
import { calculateWorkoutVolumeSummary } from '../utils/workoutAnalytics';

type WorkoutCardProps = {
  workout: Workout;
  minutesLabel: string;
  exerciseLabel: string;
  onPress: () => void;
  language?: Language;
  volumeUnit?: string;
  bodyweightLabel?: string;
};

export function WorkoutCard({
  workout,
  minutesLabel,
  exerciseLabel,
  onPress,
  language,
  volumeUnit = 'kg',
  bodyweightLabel = 'Bodyweight',
}: WorkoutCardProps) {
  const colors = themeColors();
  const summary = calculateWorkoutVolumeSummary(workout);
  const minutes = summary.totalDurationMinutes;

  const volumeText = summary.totalVolumeKg > 0
    ? `${summary.totalVolumeKg} ${volumeUnit}`
    : summary.isBodyweightOnly
      ? bodyweightLabel
      : null;

  const directionalText = {
    textAlign: textAlign(language),
    writingDirection: writingDirection(language),
  } as const;

  const { android_ripple, styleModifier } = getPressFeedback({
    rippleColor: `${colors.border}4D`,
    activeOpacity: 0.78,
  });

  const a11yLabel = `${workout.title}, ${workout.date ? `${workout.date}, ` : ''}${workout.time}, ${minutes} ${minutesLabel}${volumeText ? `, ${volumeText}` : ''}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      android_ripple={android_ripple}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        rowStyle(language),
        { backgroundColor: colors.card },
        styleModifier({ pressed }),
      ]}
    >
      <View style={[styles.icon, { backgroundColor: colors.purple }]}>
        <Ionicons name="barbell-outline" color={colors.text} size={23} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.title, directionalText, { color: colors.text }]} numberOfLines={1}>
          {workout.title}
        </Text>
        <Text style={[styles.meta, directionalText, { color: colors.textMuted }]} numberOfLines={1}>
          {workout.time} - {workout.exercises.length} {exerciseLabel}{volumeText ? ` • ${volumeText}` : ''}
        </Text>
      </View>
      <View style={[styles.pill, { backgroundColor: colors.cardMuted }]}>
        <Text style={[styles.pillText, directionalText, { color: colors.accent }]}>
          {minutes} {minutesLabel}
        </Text>
      </View>
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
  pill: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  pillText: {
    ...typography.caption,
  },
});
