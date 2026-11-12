import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import { AppHeader } from '../components/AppHeader';
import { StatCard } from '../components/StatCard';
import type { Translator } from '../i18n';
import { themeColors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import type { Workout } from '../types';
import { activeRowStyle, activeTextAlign, activeWritingDirection } from '../utils/rtl';

export type DeleteState = 'idle' | 'confirming' | 'deleting' | 'success' | 'error';

type WorkoutDetailsScreenProps = {
  t: Translator;
  workout: Workout;
  onEdit?: (workout: Workout) => void;
  onDelete?: (workout: Workout) => Promise<void> | void;
};

export function WorkoutDetailsScreen({ t, workout, onEdit, onDelete }: WorkoutDetailsScreenProps) {
  const colors = themeColors();
  const [deleteState, setDeleteState] = useState<DeleteState>('idle');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const isDeleting = deleteState === 'deleting';
  const totalMinutes = workout.exercises.reduce((sum, exercise) => sum + exercise.duration, 0);
  const directionalText = {
    textAlign: activeTextAlign(),
    writingDirection: activeWritingDirection(),
  } as const;

  const executeDelete = async () => {
    if (isDeleting || !onDelete) return;
    setDeleteState('deleting');
    setDeleteError(null);

    try {
      await onDelete(workout);
      setDeleteState('success');
    } catch (err) {
      setDeleteState('error');
      const message = err instanceof Error ? err.message : t('workouts.deleteWorkoutMessage');
      setDeleteError(message);
    }
  };

  const confirmDelete = () => {
    if (isDeleting) return;
    setDeleteState('confirming');
    setDeleteError(null);

    const workoutName = workout.title || workout.name || '';
    const message = workoutName
      ? `${workoutName}\n${t('workouts.deleteWorkoutMessage')}`
      : t('workouts.deleteWorkoutMessage');

    Alert.alert(
      t('workouts.deleteWorkout'),
      message,
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
          onPress: () => {
            setDeleteState('idle');
          },
        },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            await executeDelete();
          },
        },
      ],
      {
        cancelable: true,
        onDismiss: () => {
          setDeleteState((prev) => (prev === 'confirming' ? 'idle' : prev));
        },
      }
    );
  };

  return (
    <ScrollView style={[styles.screen, { backgroundColor: colors.background }]} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <AppHeader
        title={workout.title}
        subtitle={t('workouts.detailsTitle')}
        action={
          onEdit ? (
            <AppButton
              title={t('common.edit')}
              icon="create-outline"
              variant="secondary"
              disabled={isDeleting}
              onPress={() => onEdit(workout)}
            />
          ) : undefined
        }
      />

      {deleteError ? (
        <View style={[styles.errorBanner, { backgroundColor: colors.card, borderColor: colors.danger }]}>
          <View style={[styles.errorContent, activeRowStyle()]}>
            <Ionicons name="alert-circle-outline" size={20} color={colors.danger} />
            <Text style={[styles.errorText, directionalText, { color: colors.text }]} numberOfLines={2}>
              {deleteError}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('workouts.retryDeletion')}
              onPress={confirmDelete}
              style={styles.retryButton}
            >
              <Text style={[styles.retryText, { color: colors.danger }]}>{t('common.delete')}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('workouts.dismissError')}
              onPress={() => {
                setDeleteError(null);
                setDeleteState('idle');
              }}
              style={styles.errorDismiss}
            >
              <Ionicons name="close-circle-outline" size={20} color={colors.textMuted} />
            </Pressable>
          </View>
        </View>
      ) : null}

      <StatCard label={t('workouts.duration')} value={`${totalMinutes} ${t('common.minutes')}`} />
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

      {onDelete ? (
        <View style={styles.dangerZone}>
          <AppButton
            title={isDeleting ? t('common.loading') : t('workouts.deleteWorkout')}
            icon="trash-outline"
            variant="danger"
            disabled={isDeleting}
            onPress={confirmDelete}
            style={styles.deleteButton}
          />
        </View>
      ) : null}
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
  dangerZone: {
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150, 150, 150, 0.2)',
  },
  deleteButton: {
    minHeight: 48,
  },
  errorBanner: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  errorContent: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  errorText: {
    flex: 1,
    ...typography.caption,
  },
  retryButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  retryText: {
    ...typography.caption,
    fontWeight: '700',
  },
  errorDismiss: {
    padding: spacing.xs,
  },
});
