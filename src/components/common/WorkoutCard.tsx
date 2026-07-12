import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { Workout } from '../../models/workout';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useLanguage } from '../../hooks/useLanguage';
import { totalSets, workoutDuration } from '../../utils/health';

type WorkoutCardProps = {
  workout: Workout;
  onPress?: () => void;
};

export function WorkoutCard({ workout, onPress }: WorkoutCardProps) {
  const theme = useAppTheme();
  const { isRTL, rowDirectionStyle, textDirectionStyle, t } = useLanguage();

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          opacity: pressed ? 0.78 : 1,
          shadowColor: theme.colors.shadow,
        },
      ]}
    >
      <View style={[styles.row, rowDirectionStyle]}>
        <View style={[styles.icon, { backgroundColor: theme.colors.accentMuted }]}>
          <Ionicons name="barbell-outline" size={22} color={theme.colors.warning} />
        </View>
        <View style={styles.copy}>
          <Text style={[styles.title, textDirectionStyle, { color: theme.colors.text }]} numberOfLines={1}>
            {workout.name}
          </Text>
          <Text style={[styles.meta, textDirectionStyle, { color: theme.colors.textMuted }]}>
            {workout.time} · {workout.exercises.length} {t('workouts.exerciseUnit')} · {totalSets(workout)}{' '}
            {t('workouts.setUnit')}
          </Text>
        </View>
        <View style={[styles.duration, { backgroundColor: theme.colors.primaryMuted }]}>
          <Text style={[styles.durationText, { color: theme.colors.primary }]}>
            {workoutDuration(workout) || 45}
          </Text>
          <Text style={[styles.durationUnit, { color: theme.colors.primary }]}>{t('workouts.minutesShort')}</Text>
        </View>
        {onPress ? (
          <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={18} color={theme.colors.textMuted} />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    borderRadius: 24,
    borderWidth: 1,
    padding: 14,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.07,
    shadowRadius: 20,
    elevation: 3,
  },
  row: {
    alignItems: 'center',
    gap: 12,
  },
  icon: {
    width: 50,
    height: 50,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 5,
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
  },
  meta: {
    fontSize: 12,
    fontWeight: '700',
  },
  duration: {
    minWidth: 48,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 7,
    alignItems: 'center',
  },
  durationText: {
    fontSize: 16,
    fontWeight: '900',
  },
  durationUnit: {
    fontSize: 10,
    fontWeight: '800',
  },
});
