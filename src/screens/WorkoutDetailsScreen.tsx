import { ScrollView, StyleSheet, Text } from 'react-native';

import { AppCard } from '../components/AppCard';
import { AppHeader } from '../components/AppHeader';
import { StatCard } from '../components/StatCard';
import type { Translator } from '../i18n';
import { themeColors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import type { Workout } from '../types';
import { activeTextAlign, activeWritingDirection } from '../utils/rtl';

type WorkoutDetailsScreenProps = {
  t: Translator;
  workout: Workout;
};

export function WorkoutDetailsScreen({ t, workout }: WorkoutDetailsScreenProps) {
  const colors = themeColors();
  const totalMinutes = workout.exercises.reduce((sum, exercise) => sum + exercise.duration, 0);
  const directionalText = {
    textAlign: activeTextAlign(),
    writingDirection: activeWritingDirection(),
  } as const;

  return (
    <ScrollView style={[styles.screen, { backgroundColor: colors.background }]} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <AppHeader title={workout.title} subtitle={t('workouts.detailsTitle')} />
      <StatCard label={t('workouts.duration')} value={`${totalMinutes || 45} ${t('common.minutes')}`} />
      {workout.exercises.map((exercise) => (
        <AppCard key={exercise.id}>
          <Text style={[styles.exerciseTitle, directionalText, { color: colors.text }]}>{exercise.exerciseName}</Text>
          <Text style={[styles.exerciseMeta, directionalText, { color: colors.textSecondary }]}>
            {exercise.sets} {t('workouts.sets')} - {exercise.reps} {t('workouts.reps')} - {exercise.weight} {t('common.kg')}
          </Text>
          {exercise.notes ? <Text style={[styles.notes, directionalText, { color: colors.textMuted }]}>{exercise.notes}</Text> : null}
        </AppCard>
      ))}
      {workout.exercises.length ? null : <Text style={[styles.notes, directionalText, { color: colors.textMuted }]}>{t('workouts.emptyMessage')}</Text>}
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
  exerciseTitle: {
    ...typography.h3,
  },
  exerciseMeta: {
    ...typography.body,
  },
  notes: {
    ...typography.body,
  },
});
