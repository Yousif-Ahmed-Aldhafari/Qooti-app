import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import { AppHeader } from '../components/AppHeader';
import { AppInput } from '../components/AppInput';
import type { Translator } from '../i18n';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import type { Workout } from '../types';
import { parseInputNumber } from '../utils/nutrition';
import { activeRowDirection } from '../utils/rtl';

type AddWorkoutScreenProps = {
  t: Translator;
  onSave: (workout: Workout) => void;
};

export function AddWorkoutScreen({ t, onSave }: AddWorkoutScreenProps) {
  const [workoutName, setWorkoutName] = useState('');
  const [exerciseName, setExerciseName] = useState('');
  const [sets, setSets] = useState('3');
  const [reps, setReps] = useState('10');
  const [weight, setWeight] = useState('0');
  const [duration, setDuration] = useState('30');
  const [notes, setNotes] = useState('');

  function handleSave() {
    if (!workoutName.trim() || !exerciseName.trim()) {
      Alert.alert(t('common.requiredTitle'), t('common.requiredMessage'));
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
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <AppHeader title={t('workouts.addTitle')} subtitle={t('workouts.subtitle')} />
      <AppCard>
        <AppInput label={t('workouts.workoutName')} placeholder={t('workouts.workoutPlaceholder')} value={workoutName} onChangeText={setWorkoutName} />
        <AppInput label={t('workouts.exerciseName')} placeholder={t('workouts.exercisePlaceholder')} value={exerciseName} onChangeText={setExerciseName} />
        <View style={[styles.row, { flexDirection: activeRowDirection() }]}>
          <AppInput label={t('workouts.sets')} keyboardType="number-pad" value={sets} onChangeText={setSets} style={styles.input} />
          <AppInput label={t('workouts.reps')} keyboardType="number-pad" value={reps} onChangeText={setReps} style={styles.input} />
        </View>
        <View style={[styles.row, { flexDirection: activeRowDirection() }]}>
          <AppInput label={t('workouts.weight')} keyboardType="decimal-pad" value={weight} onChangeText={setWeight} style={styles.input} />
          <AppInput label={t('workouts.duration')} keyboardType="decimal-pad" value={duration} onChangeText={setDuration} style={styles.input} />
        </View>
        <AppInput label={t('workouts.notes')} multiline value={notes} onChangeText={setNotes} />
      </AppCard>
      <AppButton title={t('common.save')} icon="save-outline" onPress={handleSave} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.xl,
    paddingBottom: 120,
    gap: spacing.lg,
  },
  row: {
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  input: {
    minWidth: 120,
    flex: 1,
  },
});
