import { useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
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
import type { Workout } from '../types';
import { parseInputNumber } from '../utils/nutrition';
import { activeRowStyle } from '../utils/rtl';

type AddWorkoutScreenProps = {
  t: Translator;
  onSave: (workout: Workout) => void;
};

export function AddWorkoutScreen({ t, onSave }: AddWorkoutScreenProps) {
  const colors = themeColors();
  const [workoutName, setWorkoutName] = useState('');
  const [exerciseName, setExerciseName] = useState('');
  const [sets, setSets] = useState('3');
  const [reps, setReps] = useState('10');
  const [weight, setWeight] = useState('0');
  const [duration, setDuration] = useState('30');
  const [notes, setNotes] = useState('');
  const [workoutNameError, setWorkoutNameError] = useState('');
  const [exerciseNameError, setExerciseNameError] = useState('');

  function handleSave() {
    let hasError = false;
    if (!workoutName.trim()) {
      setWorkoutNameError(t('common.requiredMessage') || 'Required');
      hasError = true;
    } else {
      setWorkoutNameError('');
    }

    if (!exerciseName.trim()) {
      setExerciseNameError(t('common.requiredMessage') || 'Required');
      hasError = true;
    } else {
      setExerciseNameError('');
    }

    if (hasError) {
      return;
    }

    onSave({
      id: `workout-${Date.now()}`,
      title: workoutName.trim(),
      date: new Date().toISOString().slice(0, 10),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      exercises: [
        {
          id: `exercise-${Date.now()}`,
          exerciseName: exerciseName.trim(),
          sets: parseInputNumber(sets),
          reps: parseInputNumber(reps),
          weight: parseInputNumber(weight),
          duration: parseInputNumber(duration),
          notes: notes.trim(),
        },
      ],
    });
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
            <AppHeader title={t('workouts.addTitle')} subtitle={t('workouts.subtitle')} />
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
              <AppInput
                label={t('workouts.exerciseName')}
                placeholder={t('workouts.exercisePlaceholder')}
                value={exerciseName}
                error={exerciseNameError}
                onChangeText={(text) => {
                  setExerciseName(text);
                  if (exerciseNameError) setExerciseNameError('');
                }}
              />
              <View style={[styles.row, activeRowStyle()]}>
                <AppInput
                  label={t('workouts.sets')}
                  keyboardType="number-pad"
                  value={sets}
                  onChangeText={setSets}
                  containerStyle={styles.input}
                />
                <AppInput
                  label={t('workouts.reps')}
                  keyboardType="number-pad"
                  value={reps}
                  onChangeText={setReps}
                  containerStyle={styles.input}
                />
              </View>
              <View style={[styles.row, activeRowStyle()]}>
                <AppInput
                  label={t('workouts.weight')}
                  keyboardType="decimal-pad"
                  value={weight}
                  onChangeText={setWeight}
                  containerStyle={styles.input}
                />
                <AppInput
                  label={t('workouts.duration')}
                  keyboardType="decimal-pad"
                  value={duration}
                  onChangeText={setDuration}
                  containerStyle={styles.input}
                />
              </View>
              <AppInput label={t('workouts.notes')} multiline value={notes} onChangeText={setNotes} />
            </AppCard>
            <AppButton title={t('common.save')} icon="save-outline" onPress={handleSave} />
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
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  input: {
    flex: 1,
    minWidth: 0,
  },
});
