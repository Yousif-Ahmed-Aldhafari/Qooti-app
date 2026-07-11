import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import { AppButton } from '../../components/common/AppButton';
import { Card } from '../../components/common/Card';
import { FormInput } from '../../components/common/FormInput';
import { Screen } from '../../components/common/Screen';
import { SectionHeader } from '../../components/common/SectionHeader';
import { useApp } from '../../store/AppContext';
import { useLanguage } from '../../hooks/useLanguage';
import type { Exercise, Workout } from '../../models/workout';
import type { RootStackParamList } from '../../navigation/types';
import { currentTime, todayISO } from '../../utils/date';
import { createId } from '../../utils/id';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'AddEditWorkout'>;
type WorkoutRoute = RouteProp<RootStackParamList, 'AddEditWorkout'>;

function parseNumber(value: string): number {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function blankExercise(): Exercise {
  return {
    id: createId('exercise'),
    name: '',
    sets: 3,
    reps: 10,
    weight: 0,
    duration: 0,
    notes: '',
  };
}

export function AddEditWorkoutScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<WorkoutRoute>();
  const { workouts, addWorkout, updateWorkout } = useApp();
  const { t, rowDirection } = useLanguage();
  const existingWorkout = workouts.find((workout) => workout.id === route.params?.workoutId);
  const [name, setName] = useState(existingWorkout?.name ?? '');
  const [date, setDate] = useState(existingWorkout?.date ?? todayISO());
  const [time, setTime] = useState(existingWorkout?.time ?? currentTime());
  const [notes, setNotes] = useState(existingWorkout?.notes ?? '');
  const [exercises, setExercises] = useState<Exercise[]>(
    existingWorkout?.exercises.length ? existingWorkout.exercises : [blankExercise()],
  );

  function updateExercise(id: string, field: keyof Exercise, value: string) {
    setExercises((currentExercises) =>
      currentExercises.map((exercise) => {
        if (exercise.id !== id) {
          return exercise;
        }

        if (['sets', 'reps', 'weight', 'duration'].includes(field)) {
          return { ...exercise, [field]: parseNumber(value) };
        }

        return { ...exercise, [field]: value };
      }),
    );
  }

  function removeExercise(id: string) {
    setExercises((currentExercises) =>
      currentExercises.length === 1
        ? [blankExercise()]
        : currentExercises.filter((exercise) => exercise.id !== id),
    );
  }

  function handleSave() {
    const trimmedName = name.trim();

    if (!trimmedName) {
      Alert.alert(t('common.requiredTitle'), t('common.requiredMessage'));
      return;
    }

    const cleanExercises = exercises.map((exercise) => ({
      ...exercise,
      name: exercise.name.trim() || t('workouts.exerciseName'),
      notes: exercise.notes.trim(),
    }));
    const workout: Workout = {
      id: existingWorkout?.id ?? createId('workout'),
      name: trimmedName,
      date: date.trim() || todayISO(),
      time: time.trim() || currentTime(),
      notes: notes.trim(),
      exercises: cleanExercises,
    };

    if (existingWorkout) {
      updateWorkout(workout);
    } else {
      addWorkout(workout);
    }

    navigation.replace('WorkoutDetails', { workoutId: workout.id });
  }

  return (
    <Screen>
      <Card>
        <FormInput
          label={t('workouts.workoutName')}
          placeholder={t('workouts.workoutNamePlaceholder')}
          value={name}
          onChangeText={setName}
        />
        <View style={[styles.inlineFields, { flexDirection: rowDirection }]}>
          <FormInput label={t('common.date')} value={date} onChangeText={setDate} style={styles.inlineInput} />
          <FormInput label={t('common.time')} value={time} onChangeText={setTime} style={styles.inlineInput} />
        </View>
        <FormInput
          label={t('workouts.sessionNotes')}
          value={notes}
          onChangeText={setNotes}
          multiline
          placeholder={t('common.optional')}
        />
      </Card>

      <SectionHeader
        title={t('workouts.exercises')}
        action={
          <AppButton
            title={t('common.add')}
            icon="add"
            variant="secondary"
            onPress={() => setExercises((currentExercises) => [...currentExercises, blankExercise()])}
            style={styles.smallButton}
          />
        }
      />

      {exercises.map((exercise, index) => (
        <Card key={exercise.id}>
          <SectionHeader
            title={`${t('workouts.exerciseName')} ${index + 1}`}
            action={
              <AppButton
                title={t('common.remove')}
                icon="trash-outline"
                variant="ghost"
                onPress={() => removeExercise(exercise.id)}
                style={styles.smallButton}
              />
            }
          />
          <FormInput
            label={t('workouts.exerciseName')}
            placeholder={t('workouts.exerciseNamePlaceholder')}
            value={exercise.name}
            onChangeText={(value) => updateExercise(exercise.id, 'name', value)}
          />
          <View style={[styles.inlineFields, { flexDirection: rowDirection }]}>
            <FormInput
              label={t('workouts.sets')}
              keyboardType="number-pad"
              value={String(exercise.sets)}
              onChangeText={(value) => updateExercise(exercise.id, 'sets', value)}
              style={styles.inlineInput}
            />
            <FormInput
              label={t('workouts.reps')}
              keyboardType="number-pad"
              value={String(exercise.reps)}
              onChangeText={(value) => updateExercise(exercise.id, 'reps', value)}
              style={styles.inlineInput}
            />
          </View>
          <View style={[styles.inlineFields, { flexDirection: rowDirection }]}>
            <FormInput
              label={t('workouts.weight')}
              keyboardType="decimal-pad"
              value={String(exercise.weight)}
              onChangeText={(value) => updateExercise(exercise.id, 'weight', value)}
              style={styles.inlineInput}
            />
            <FormInput
              label={t('workouts.duration')}
              keyboardType="decimal-pad"
              value={String(exercise.duration)}
              onChangeText={(value) => updateExercise(exercise.id, 'duration', value)}
              style={styles.inlineInput}
            />
          </View>
          <FormInput
            label={t('workouts.exerciseNotes')}
            value={exercise.notes}
            onChangeText={(value) => updateExercise(exercise.id, 'notes', value)}
            multiline
            placeholder={t('common.optional')}
          />
        </Card>
      ))}

      <AppButton
        title={existingWorkout ? t('common.update') : t('common.save')}
        icon="save-outline"
        onPress={handleSave}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  inlineFields: {
    flexWrap: 'wrap',
    gap: 10,
  },
  inlineInput: {
    minWidth: 130,
  },
  smallButton: {
    minHeight: 40,
    paddingHorizontal: 12,
  },
});
