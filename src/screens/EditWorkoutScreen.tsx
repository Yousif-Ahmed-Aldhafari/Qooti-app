import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import { AppHeader } from '../components/AppHeader';
import { AppInput } from '../components/AppInput';
import type { Translator } from '../i18n';
import { themeColors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import type { Exercise, Workout } from '../types';
import { activeRowStyle, activeTextAlign, activeWritingDirection } from '../utils/rtl';

type ExerciseEditItem = {
  id: string;
  exerciseName: string;
  sets: string;
  reps: string;
  weight: string;
  duration: string;
  notes: string;
  targetMuscles?: string[];
};

type ExerciseErrorMap = {
  exerciseName?: string;
  sets?: string;
  reps?: string;
  weight?: string;
  duration?: string;
};

type EditWorkoutScreenProps = {
  t: Translator;
  workout: Workout;
  onSave: (workout: Workout) => Promise<void> | void;
  onCancel: () => void;
};

export function EditWorkoutScreen({ t, workout, onSave, onCancel }: EditWorkoutScreenProps) {
  const colors = themeColors();

  const [title, setTitle] = useState(workout.title || workout.name || '');
  const [date, setDate] = useState(workout.date || '');
  const [time, setTime] = useState(workout.time || '');
  const [notes, setNotes] = useState(workout.notes || '');

  const [exercises, setExercises] = useState<ExerciseEditItem[]>(() =>
    (workout.exercises || []).map((ex) => ({
      id: ex.id,
      exerciseName: ex.exerciseName || ex.name || '',
      sets: String(ex.sets ?? 0),
      reps: String(ex.reps ?? 0),
      weight: String(ex.weight ?? 0),
      duration: String(ex.duration ?? 0),
      notes: ex.notes || '',
      targetMuscles: ex.targetMuscles,
    }))
  );

  const [titleError, setTitleError] = useState('');
  const [dateError, setDateError] = useState('');
  const [timeError, setTimeError] = useState('');
  const [exerciseErrors, setExerciseErrors] = useState<Record<string, ExerciseErrorMap>>({});
  const [saveError, setSaveError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const directionalText = {
    textAlign: activeTextAlign(),
    writingDirection: activeWritingDirection(),
  } as const;

  const isDirty = useMemo(() => {
    if (title !== (workout.title || workout.name || '')) return true;
    if (date !== (workout.date || '')) return true;
    if (time !== (workout.time || '')) return true;
    if (notes !== (workout.notes || '')) return true;

    const originalExercises = workout.exercises || [];
    if (exercises.length !== originalExercises.length) return true;

    for (let i = 0; i < exercises.length; i++) {
      const cur = exercises[i];
      const orig = originalExercises[i];
      if (!orig) return true;
      if (cur.id !== orig.id) return true;
      if (cur.exerciseName !== (orig.exerciseName || orig.name || '')) return true;
      if (cur.sets !== String(orig.sets ?? 0)) return true;
      if (cur.reps !== String(orig.reps ?? 0)) return true;
      if (cur.weight !== String(orig.weight ?? 0)) return true;
      if (cur.duration !== String(orig.duration ?? 0)) return true;
      if (cur.notes !== (orig.notes || '')) return true;
    }
    return false;
  }, [date, exercises, notes, time, title, workout]);

  const handleCancel = useCallback(() => {
    if (!isDirty) {
      onCancel();
      return;
    }

    Alert.alert(
      t('workouts.discardChangesTitle'),
      t('workouts.discardChangesMessage'),
      [
        { text: t('workouts.keepEditing'), style: 'cancel' },
        {
          text: t('workouts.discardChanges'),
          style: 'destructive',
          onPress: onCancel,
        },
      ]
    );
  }, [isDirty, onCancel, t]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      handleCancel();
      return true;
    });
    return () => subscription.remove();
  }, [handleCancel]);

  function handleAddExercise() {
    const newEx: ExerciseEditItem = {
      id: `exercise-${Date.now()}-${exercises.length}`,
      exerciseName: '',
      sets: '3',
      reps: '10',
      weight: '0',
      duration: '0',
      notes: '',
    };
    setExercises((prev) => [...prev, newEx]);
  }

  function handleRemoveExercise(id: string) {
    setExercises((prev) => prev.filter((ex) => ex.id !== id));
    setExerciseErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function updateExerciseField(id: string, field: keyof ExerciseEditItem, value: string) {
    setExercises((prev) =>
      prev.map((ex) => (ex.id === id ? { ...ex, [field]: value } : ex))
    );

    // Clear validation error on change
    if (exerciseErrors[id] && exerciseErrors[id][field as keyof ExerciseErrorMap]) {
      setExerciseErrors((prev) => ({
        ...prev,
        [id]: {
          ...prev[id],
          [field]: undefined,
        },
      }));
    }
    if (saveError) setSaveError('');
  }

  async function handleSave() {
    let hasError = false;
    setSaveError('');

    // 1. Validate workout title
    if (!title.trim()) {
      setTitleError(t('common.requiredMessage'));
      hasError = true;
    } else {
      setTitleError('');
    }

    // 2. Validate date
    if (!date.trim() || Number.isNaN(new Date(date.trim()).getTime())) {
      setDateError(t('common.requiredMessage'));
      hasError = true;
    } else {
      setDateError('');
    }

    // 3. Validate time
    if (!time.trim()) {
      setTimeError(t('common.requiredMessage'));
      hasError = true;
    } else {
      setTimeError('');
    }

    // 4. Validate each exercise
    const newErrors: Record<string, ExerciseErrorMap> = {};
    const parsedExercises: Exercise[] = [];

    for (let i = 0; i < exercises.length; i++) {
      const ex = exercises[i];
      const exError: ExerciseErrorMap = {};

      if (!ex.exerciseName.trim()) {
        exError.exerciseName = t('common.requiredMessage');
        hasError = true;
      }

      const parsedSets = Number(ex.sets);
      if (
        !Number.isFinite(parsedSets) ||
        !Number.isInteger(parsedSets) ||
        parsedSets < 0
      ) {
        exError.sets = t('common.requiredMessage');
        hasError = true;
      }

      const parsedReps = Number(ex.reps);
      if (
        !Number.isFinite(parsedReps) ||
        !Number.isInteger(parsedReps) ||
        parsedReps < 0
      ) {
        exError.reps = t('common.requiredMessage');
        hasError = true;
      }

      const parsedWeight = Number(ex.weight);
      if (!Number.isFinite(parsedWeight) || parsedWeight < 0) {
        exError.weight = t('common.requiredMessage');
        hasError = true;
      }

      const parsedDuration = Number(ex.duration);
      if (!Number.isFinite(parsedDuration) || parsedDuration < 0) {
        exError.duration = t('common.requiredMessage');
        hasError = true;
      }

      if (Object.keys(exError).length > 0) {
        newErrors[ex.id] = exError;
      }

      parsedExercises.push({
        id: ex.id,
        exerciseName: ex.exerciseName.trim(),
        name: ex.exerciseName.trim(),
        sets: parsedSets,
        reps: parsedReps,
        weight: parsedWeight,
        duration: parsedDuration,
        notes: ex.notes.trim(),
        targetMuscles: ex.targetMuscles,
      });
    }

    setExerciseErrors(newErrors);

    if (hasError) {
      return;
    }

    const updatedWorkout: Workout = {
      id: workout.id,
      title: title.trim(),
      name: title.trim(),
      date: date.trim(),
      time: time.trim(),
      notes: notes.trim(),
      exercises: parsedExercises,
    };

    setIsSaving(true);
    try {
      await onSave(updatedWorkout);
    } catch (err) {
      console.error('[EditWorkoutScreen] Failed to save workout edits:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to save changes.');
      setIsSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.keyboardRoot}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
    >
      <ScrollView
        style={[styles.screen, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={styles.innerForm}>
            <AppHeader
              title={t('workouts.editTitle')}
              subtitle={workout.title}
              action={
                <AppButton
                  title={t('common.cancel')}
                  variant="secondary"
                  onPress={handleCancel}
                />
              }
            />

            {saveError ? (
              <AppCard style={styles.errorBanner}>
                <Text style={[styles.errorText, directionalText, { color: '#EF4444' }]}>
                  {saveError}
                </Text>
              </AppCard>
            ) : null}

            {/* Workout Details Card */}
            <AppCard>
              <Text style={[styles.sectionTitle, directionalText, { color: colors.text }]}>
                {t('workouts.detailsTitle')}
              </Text>
              <AppInput
                label={t('workouts.workoutName')}
                placeholder={t('workouts.workoutPlaceholder')}
                value={title}
                error={titleError}
                onChangeText={(text) => {
                  setTitle(text);
                  if (titleError) setTitleError('');
                  if (saveError) setSaveError('');
                }}
              />
              <View style={[styles.row, activeRowStyle()]}>
                <AppInput
                  label={t('common.date')}
                  value={date}
                  error={dateError}
                  onChangeText={(text) => {
                    setDate(text);
                    if (dateError) setDateError('');
                    if (saveError) setSaveError('');
                  }}
                  containerStyle={styles.halfInput}
                />
                <AppInput
                  label={t('common.time')}
                  value={time}
                  error={timeError}
                  onChangeText={(text) => {
                    setTime(text);
                    if (timeError) setTimeError('');
                    if (saveError) setSaveError('');
                  }}
                  containerStyle={styles.halfInput}
                />
              </View>
              <AppInput
                label={t('workouts.notes')}
                multiline
                value={notes}
                onChangeText={(text) => {
                  setNotes(text);
                  if (saveError) setSaveError('');
                }}
              />
            </AppCard>

            {/* Exercises Section */}
            <View style={[styles.exerciseHeaderRow, activeRowStyle()]}>
              <Text style={[styles.sectionTitle, directionalText, { color: colors.text }]}>
                {t('workouts.exercises')} ({exercises.length})
              </Text>
              <AppButton
                title={t('workouts.addExercise')}
                icon="add"
                variant="secondary"
                onPress={handleAddExercise}
              />
            </View>

            {exercises.map((exercise, index) => {
              const errs = exerciseErrors[exercise.id] || {};
              return (
                <AppCard key={exercise.id} style={styles.exerciseCard}>
                  <View style={[styles.exerciseCardHeader, activeRowStyle()]}>
                    <Text style={[styles.exerciseIndex, directionalText, { color: colors.primary }]}>
                      #{index + 1}
                    </Text>
                    {exercises.length > 0 ? (
                      <AppButton
                        title={t('common.remove')}
                        icon="trash-outline"
                        variant="ghost"
                        onPress={() => handleRemoveExercise(exercise.id)}
                      />
                    ) : null}
                  </View>

                  <AppInput
                    label={t('workouts.exerciseName')}
                    placeholder={t('workouts.exercisePlaceholder')}
                    value={exercise.exerciseName}
                    error={errs.exerciseName}
                    onChangeText={(val) => updateExerciseField(exercise.id, 'exerciseName', val)}
                  />

                  <View style={[styles.row, activeRowStyle()]}>
                    <AppInput
                      label={t('workouts.sets')}
                      keyboardType="number-pad"
                      value={exercise.sets}
                      error={errs.sets}
                      onChangeText={(val) => updateExerciseField(exercise.id, 'sets', val)}
                      containerStyle={styles.halfInput}
                    />
                    <AppInput
                      label={t('workouts.reps')}
                      keyboardType="number-pad"
                      value={exercise.reps}
                      error={errs.reps}
                      onChangeText={(val) => updateExerciseField(exercise.id, 'reps', val)}
                      containerStyle={styles.halfInput}
                    />
                  </View>

                  <View style={[styles.row, activeRowStyle()]}>
                    <AppInput
                      label={t('workouts.weight')}
                      keyboardType="decimal-pad"
                      value={exercise.weight}
                      error={errs.weight}
                      onChangeText={(val) => updateExerciseField(exercise.id, 'weight', val)}
                      containerStyle={styles.halfInput}
                    />
                    <AppInput
                      label={t('workouts.duration')}
                      keyboardType="decimal-pad"
                      value={exercise.duration}
                      error={errs.duration}
                      onChangeText={(val) => updateExerciseField(exercise.id, 'duration', val)}
                      containerStyle={styles.halfInput}
                    />
                  </View>

                  <AppInput
                    label={t('workouts.exerciseNotes')}
                    value={exercise.notes}
                    onChangeText={(val) => updateExerciseField(exercise.id, 'notes', val)}
                  />
                </AppCard>
              );
            })}

            {/* Bottom Actions */}
            <View style={[styles.actionsRow, activeRowStyle()]}>
              <View style={styles.actionBtn}>
                <AppButton
                  title={t('common.cancel')}
                  variant="secondary"
                  onPress={handleCancel}
                />
              </View>
              <View style={styles.actionBtn}>
                <AppButton
                  title={isSaving ? t('common.loading') : t('common.save')}
                  icon="save-outline"
                  onPress={handleSave}
                  disabled={isSaving}
                />
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardRoot: {
    flex: 1,
  },
  screen: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: spacing.xl,
    paddingBottom: 140,
  },
  innerForm: {
    gap: spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.xs,
  },
  exerciseHeaderRow: {
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  exerciseCard: {
    gap: spacing.sm,
  },
  exerciseCardHeader: {
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  exerciseIndex: {
    ...typography.h3,
    fontWeight: '700',
  },
  row: {
    gap: spacing.md,
  },
  halfInput: {
    flex: 1,
    minWidth: 0,
  },
  actionsRow: {
    gap: spacing.md,
    marginTop: spacing.md,
  },
  actionBtn: {
    flex: 1,
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderColor: '#EF4444',
    borderWidth: 1,
    padding: spacing.md,
  },
  errorText: {
    ...typography.body,
    fontWeight: '600',
  },
});
