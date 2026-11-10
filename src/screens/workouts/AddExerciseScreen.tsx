import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { AppHeader } from '../../components/common/AppHeader';
import { AppInput } from '../../components/common/AppInput';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { useLanguage } from '../../hooks/useLanguage';
import type { Workout } from '../../models/workout';
import type { RootStackParamList } from '../../navigation/types';
import { useApp } from '../../store/AppContext';
import { currentTime, todayISO } from '../../utils/date';
import { createId } from '../../utils/id';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'AddExercise'>;

function parseNumber(value: string): number {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function AddExerciseScreen() {
  const navigation = useNavigation<Navigation>();
  const { addWorkout } = useApp();
  const { rowDirectionStyle, t } = useLanguage();
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

    const workout: Workout = {
      id: createId('workout'),
      title: workoutName.trim(),
      name: workoutName.trim(),
      date: todayISO(),
      time: currentTime(),
      notes: notes.trim(),
      exercises: [
        {
          id: createId('exercise'),
          exerciseName: exerciseName.trim(),
          name: exerciseName.trim(),
          sets: parseNumber(sets),
          reps: parseNumber(reps),
          weight: parseNumber(weight),
          duration: parseNumber(duration),
          notes: notes.trim(),
        },
      ],
    };

    addWorkout(workout);
    navigation.replace('WorkoutDetails', { workoutId: workout.id });
  }

  return (
    <ScreenContainer>
      <AppHeader title={t('workouts.addExercise')} subtitle={t('workouts.subtitle')} />

      <AppCard>
        <AppInput label={t('workouts.workoutName')} placeholder={t('workouts.workoutNamePlaceholder')} value={workoutName} onChangeText={setWorkoutName} />
        <AppInput label={t('workouts.exerciseName')} placeholder={t('workouts.exerciseNamePlaceholder')} value={exerciseName} onChangeText={setExerciseName} />
        <View style={[styles.inline, rowDirectionStyle]}>
          <AppInput label={t('workouts.sets')} keyboardType="number-pad" value={sets} onChangeText={setSets} style={styles.inlineInput} />
          <AppInput label={t('workouts.reps')} keyboardType="number-pad" value={reps} onChangeText={setReps} style={styles.inlineInput} />
        </View>
        <View style={[styles.inline, rowDirectionStyle]}>
          <AppInput label={t('workouts.weight')} keyboardType="decimal-pad" value={weight} onChangeText={setWeight} style={styles.inlineInput} />
          <AppInput label={t('workouts.duration')} keyboardType="decimal-pad" value={duration} onChangeText={setDuration} style={styles.inlineInput} />
        </View>
        <AppInput label={t('workouts.sessionNotes')} multiline placeholder={t('common.optional')} value={notes} onChangeText={setNotes} />
      </AppCard>

      <AppButton title={t('common.save')} icon="save-outline" onPress={handleSave} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  inline: {
    flexWrap: 'wrap',
    gap: 12,
  },
  inlineInput: {
    flex: 1,
    minWidth: 120,
  },
});
