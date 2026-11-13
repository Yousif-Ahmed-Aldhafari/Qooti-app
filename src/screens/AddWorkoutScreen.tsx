import { useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import { AppHeader } from '../components/AppHeader';
import { AppInput } from '../components/AppInput';
import { ExercisePickerModal } from '../components/ExercisePickerModal';
import type { Translator } from '../i18n';
import type { CatalogExercise } from '../models/exerciseCatalog';
import { themeColors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import type { Workout } from '../types';
import { createId } from '../utils/id';
import { parseInputNumber } from '../utils/nutrition';
import { activeRowStyle, activeTextAlign, activeWritingDirection } from '../utils/rtl';
import { toLocalDateString } from '../utils/workoutAnalytics';

type DraftExercise = {
  id: string;
  exerciseName: string;
  sets: string;
  reps: string;
  weight: string;
  duration: string;
  notes: string;
  targetMuscles?: string[];
  catalogId?: string;
};

type ExerciseErrorMap = {
  exerciseName?: string;
  sets?: string;
  reps?: string;
  weight?: string;
  duration?: string;
};

type AddWorkoutScreenProps = {
  t: Translator;
  onSave: (workout: Workout) => Promise<void> | void;
  language?: 'en' | 'ar';
  initialWorkout?: Workout | null;
  onCancel?: () => void;
};

export function AddWorkoutScreen({
  t,
  onSave,
  language = 'en',
  initialWorkout,
  onCancel,
}: AddWorkoutScreenProps) {
  const colors = themeColors();
  const [draftWorkoutId] = useState<string>(() => initialWorkout?.id || createId('workout'));
  const [workoutName, setWorkoutName] = useState(() => initialWorkout?.title || initialWorkout?.name || '');
  const [exercises, setExercises] = useState<DraftExercise[]>(() => {
    if (initialWorkout?.exercises && initialWorkout.exercises.length > 0) {
      return initialWorkout.exercises.map((ex) => ({
        id: ex.id || createId('draft-ex'),
        exerciseName: ex.exerciseName || ex.name || '',
        sets: String(ex.sets ?? 3),
        reps: String(ex.reps ?? 10),
        weight: String(ex.weight ?? 0),
        duration: String(ex.duration ?? 15),
        notes: ex.notes || '',
        targetMuscles: ex.targetMuscles ? [...ex.targetMuscles] : [],
        catalogId: ex.catalogId,
      }));
    }
    return [
      {
        id: createId('draft-ex'),
        exerciseName: '',
        sets: '3',
        reps: '10',
        weight: '0',
        duration: '15',
        notes: '',
      },
    ];
  });

  const [workoutNameError, setWorkoutNameError] = useState('');
  const [exerciseErrors, setExerciseErrors] = useState<Record<string, ExerciseErrorMap>>({});
  const [pickerVisible, setPickerVisible] = useState(false);
  const [activePickerTargetId, setActivePickerTargetId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const directionalText = {
    textAlign: activeTextAlign(),
    writingDirection: activeWritingDirection(),
  } as const;

  function handleAddEmptyExercise() {
    const newEx: DraftExercise = {
      id: createId('draft-ex'),
      exerciseName: '',
      sets: '3',
      reps: '10',
      weight: '0',
      duration: '15',
      notes: '',
    };
    setExercises((prev) => [...prev, newEx]);
  }

  function handleOpenPicker(targetId: string | null = null) {
    setActivePickerTargetId(targetId);
    setPickerVisible(true);
  }

  function handleSelectCatalogExercise(catalogEx: CatalogExercise) {
    const selectedName = language === 'ar' ? catalogEx.nameAr : catalogEx.nameEn;
    const muscles = [catalogEx.primaryMuscle, ...catalogEx.secondaryMuscles];

    if (activePickerTargetId) {
      // Replace existing exercise
      setExercises((prev) =>
        prev.map((ex) => {
          if (ex.id === activePickerTargetId) {
            return {
              ...ex,
              exerciseName: selectedName,
              targetMuscles: muscles,
              catalogId: catalogEx.id,
            };
          }
          return ex;
        })
      );
      // Clear error for this exercise name if any
      setExerciseErrors((prev) => {
        const next = { ...prev };
        if (next[activePickerTargetId]) {
          delete next[activePickerTargetId].exerciseName;
        }
        return next;
      });
    } else {
      // Append as new exercise
      const newEx: DraftExercise = {
        id: createId('draft-ex'),
        exerciseName: selectedName,
        sets: '3',
        reps: '10',
        weight: '0',
        duration: '15',
        notes: '',
        targetMuscles: muscles,
        catalogId: catalogEx.id,
      };
      setExercises((prev) => [...prev, newEx]);
    }
    setActivePickerTargetId(null);
  }

  function handleRemoveExercise(id: string) {
    setExercises((prev) => prev.filter((ex) => ex.id !== id));
    setExerciseErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function handleMoveExercise(index: number, direction: 'up' | 'down') {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= exercises.length) return;

    setExercises((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  }

  function updateExerciseField(id: string, field: keyof DraftExercise, value: string) {
    setExercises((prev) =>
      prev.map((ex) => (ex.id === id ? { ...ex, [field]: value } : ex))
    );

    // Clear error for field
    if (exerciseErrors[id]?.[field as keyof ExerciseErrorMap]) {
      setExerciseErrors((prev) => {
        const current = prev[id];
        if (!current) return prev;
        const updated = { ...current };
        delete updated[field as keyof ExerciseErrorMap];
        return { ...prev, [id]: updated };
      });
    }
  }

  function validate(): boolean {
    let isValid = true;
    const requiredMsg = t('common.requiredMessage') || 'Required';
    const invalidNumberMsg = language === 'ar' ? 'رقم غير صحيح' : 'Invalid number';

    if (!workoutName.trim()) {
      setWorkoutNameError(requiredMsg);
      isValid = false;
    } else {
      setWorkoutNameError('');
    }

    const newErrors: Record<string, ExerciseErrorMap> = {};

    exercises.forEach((ex) => {
      const errMap: ExerciseErrorMap = {};
      if (!ex.exerciseName.trim()) {
        errMap.exerciseName = requiredMsg;
        isValid = false;
      }

      const setsVal = Number(ex.sets);
      if (ex.sets.trim() === '' || Number.isNaN(setsVal) || setsVal < 0 || !Number.isInteger(setsVal)) {
        errMap.sets = invalidNumberMsg;
        isValid = false;
      }

      const repsVal = Number(ex.reps);
      if (ex.reps.trim() === '' || Number.isNaN(repsVal) || repsVal < 0 || !Number.isInteger(repsVal)) {
        errMap.reps = invalidNumberMsg;
        isValid = false;
      }

      const weightVal = Number(ex.weight);
      if (ex.weight.trim() === '' || Number.isNaN(weightVal) || weightVal < 0) {
        errMap.weight = invalidNumberMsg;
        isValid = false;
      }

      const durationVal = Number(ex.duration);
      if (ex.duration.trim() === '' || Number.isNaN(durationVal) || durationVal < 0) {
        errMap.duration = invalidNumberMsg;
        isValid = false;
      }

      if (Object.keys(errMap).length > 0) {
        newErrors[ex.id] = errMap;
      }
    });

    setExerciseErrors(newErrors);
    return isValid;
  }

  async function handleSave() {
    if (isSaving) return;
    if (!validate()) return;

    setIsSaving(true);
    try {
      await onSave({
        id: draftWorkoutId,
        title: workoutName.trim(),
        date: toLocalDateString(new Date()),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        exercises: exercises.map((ex) => ({
          id: ex.id,
          exerciseName: ex.exerciseName.trim(),
          name: ex.exerciseName.trim(),
          sets: parseInputNumber(ex.sets),
          reps: parseInputNumber(ex.reps),
          weight: parseInputNumber(ex.weight),
          duration: parseInputNumber(ex.duration),
          notes: ex.notes.trim(),
          targetMuscles: ex.targetMuscles,
          catalogId: ex.catalogId,
        })),
      });
    } catch {
      // onSave threw - keep isSaving false so user can retry with preserved inputs
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
              title={initialWorkout ? t('workouts.useAsTemplate') : t('workouts.addTitle')}
              subtitle={t('workouts.subtitle')}
              action={
                onCancel ? (
                  <AppButton
                    title={t('common.cancel')}
                    variant="secondary"
                    onPress={onCancel}
                  />
                ) : undefined
              }
            />

            {/* Workout Details Card */}
            <AppCard>
              <AppInput
                label={t('workouts.workoutName')}
                placeholder={t('workouts.workoutPlaceholder')}
                value={workoutName}
                error={workoutNameError}
                onChangeText={(text) => {
                  setWorkoutName(text);
                  if (workoutNameError) setWorkoutNameError('');
                }}
              />
            </AppCard>

            {/* Exercises Header & Action Bar */}
            <View style={[styles.sectionHeaderRow, activeRowStyle()]}>
              <Text style={[styles.sectionTitle, directionalText, { color: colors.text }]}>
                {t('workouts.exercises')} ({exercises.length})
              </Text>
              <View style={[styles.sectionActions, activeRowStyle()]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={language === 'ar' ? 'اختيار من الدليل' : 'From Catalog'}
                  onPress={() => handleOpenPicker(null)}
                  style={[styles.catalogPill, { backgroundColor: colors.primaryMuted, borderColor: colors.primary }]}
                >
                  <Ionicons name="book-outline" size={16} color={colors.primary} />
                  <Text style={[styles.catalogPillText, { color: colors.primary }]}>
                    {language === 'ar' ? 'من الدليل' : 'Catalog'}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('workouts.addExercise')}
                  onPress={handleAddEmptyExercise}
                  style={[styles.catalogPill, { backgroundColor: colors.cardMuted, borderColor: colors.border }]}
                >
                  <Ionicons name="add" size={16} color={colors.text} />
                  <Text style={[styles.catalogPillText, { color: colors.text }]}>
                    {t('common.add')}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Exercises List */}
            {exercises.map((ex, idx) => {
              const errs = exerciseErrors[ex.id] || {};
              return (
                <AppCard key={ex.id} style={styles.exerciseCard}>
                  {/* Exercise Card Header with Reordering & Remove */}
                  <View style={[styles.cardHeader, activeRowStyle()]}>
                    <Text style={[styles.exerciseNumber, { color: colors.accent }]}>
                      #{idx + 1}
                    </Text>
                    <View style={[styles.headerControls, activeRowStyle()]}>
                      {idx > 0 ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={language === 'ar' ? 'تحريك للأعلى' : 'Move up'}
                          onPress={() => handleMoveExercise(idx, 'up')}
                          style={styles.iconButton}
                        >
                          <Ionicons name="chevron-up" size={18} color={colors.textSecondary} />
                        </Pressable>
                      ) : null}
                      {idx < exercises.length - 1 ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={language === 'ar' ? 'تحريك للأسفل' : 'Move down'}
                          onPress={() => handleMoveExercise(idx, 'down')}
                          style={styles.iconButton}
                        >
                          <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
                        </Pressable>
                      ) : null}
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={language === 'ar' ? 'اختيار تمرين بديل من الدليل' : 'Pick from catalog'}
                        onPress={() => handleOpenPicker(ex.id)}
                        style={styles.iconButton}
                      >
                        <Ionicons name="book-outline" size={18} color={colors.primary} />
                      </Pressable>
                      {exercises.length > 1 ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={t('common.remove')}
                          onPress={() => handleRemoveExercise(ex.id)}
                          style={styles.iconButton}
                        >
                          <Ionicons name="trash-outline" size={18} color={colors.danger} />
                        </Pressable>
                      ) : null}
                    </View>
                  </View>

                  <AppInput
                    label={t('workouts.exerciseName')}
                    placeholder={t('workouts.exercisePlaceholder')}
                    value={ex.exerciseName}
                    error={errs.exerciseName}
                    onChangeText={(val) => updateExerciseField(ex.id, 'exerciseName', val)}
                  />

                  <View style={[styles.row, activeRowStyle()]}>
                    <AppInput
                      label={t('workouts.sets')}
                      keyboardType="number-pad"
                      value={ex.sets}
                      error={errs.sets}
                      onChangeText={(val) => updateExerciseField(ex.id, 'sets', val)}
                      containerStyle={styles.input}
                    />
                    <AppInput
                      label={t('workouts.reps')}
                      keyboardType="number-pad"
                      value={ex.reps}
                      error={errs.reps}
                      onChangeText={(val) => updateExerciseField(ex.id, 'reps', val)}
                      containerStyle={styles.input}
                    />
                  </View>

                  <View style={[styles.row, activeRowStyle()]}>
                    <AppInput
                      label={t('workouts.weight')}
                      keyboardType="decimal-pad"
                      value={ex.weight}
                      error={errs.weight}
                      onChangeText={(val) => updateExerciseField(ex.id, 'weight', val)}
                      containerStyle={styles.input}
                    />
                    <AppInput
                      label={t('workouts.duration')}
                      keyboardType="decimal-pad"
                      value={ex.duration}
                      error={errs.duration}
                      onChangeText={(val) => updateExerciseField(ex.id, 'duration', val)}
                      containerStyle={styles.input}
                    />
                  </View>

                  <AppInput
                    label={t('workouts.notes')}
                    multiline
                    value={ex.notes}
                    onChangeText={(val) => updateExerciseField(ex.id, 'notes', val)}
                  />
                </AppCard>
              );
            })}

            {/* Bottom Action Bar */}
            <AppButton title={t('common.save')} icon="save-outline" onPress={handleSave} disabled={isSaving} />
          </View>
        </TouchableWithoutFeedback>
      </ScrollView>

      {/* Catalog Exercise Picker Modal */}
      <ExercisePickerModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelect={handleSelectCatalogExercise}
        t={t}
        language={language}
      />
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
  sectionHeaderRow: {
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  sectionTitle: {
    ...typography.h3,
    fontSize: 18,
  },
  sectionActions: {
    gap: spacing.sm,
    alignItems: 'center',
  },
  catalogPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    minHeight: 36,
  },
  catalogPillText: {
    ...typography.caption,
    fontWeight: '600',
  },
  exerciseCard: {
    gap: spacing.md,
  },
  cardHeader: {
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  exerciseNumber: {
    ...typography.caption,
    fontWeight: '800',
    fontSize: 14,
  },
  headerControls: {
    alignItems: 'center',
    gap: 4,
  },
  iconButton: {
    padding: spacing.xs,
    minHeight: 36,
    minWidth: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  row: {
    gap: spacing.md,
  },
  input: {
    flex: 1,
    minWidth: 0,
  },
});
