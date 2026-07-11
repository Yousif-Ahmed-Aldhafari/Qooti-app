import { Alert, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import { AppButton } from '../../components/common/AppButton';
import { Card } from '../../components/common/Card';
import { EmptyState } from '../../components/common/EmptyState';
import { Screen } from '../../components/common/Screen';
import { SectionHeader } from '../../components/common/SectionHeader';
import { ExerciseRow } from '../../components/workouts/ExerciseRow';
import { useApp } from '../../store/AppContext';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useLanguage } from '../../hooks/useLanguage';
import type { RootStackParamList } from '../../navigation/types';
import { formatDisplayDate } from '../../utils/date';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'WorkoutDetails'>;
type WorkoutDetailsRoute = RouteProp<RootStackParamList, 'WorkoutDetails'>;

export function WorkoutDetailsScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<WorkoutDetailsRoute>();
  const { workouts, deleteWorkout } = useApp();
  const theme = useAppTheme();
  const { t, language, textAlign, writingDirection, rowDirection } = useLanguage();
  const workout = workouts.find((item) => item.id === route.params.workoutId);

  if (!workout) {
    return (
      <Screen>
        <EmptyState title={t('common.notFound')} message={t('workouts.emptyMessage')} />
      </Screen>
    );
  }

  const currentWorkout = workout;

  function confirmDelete() {
    Alert.alert(t('workouts.deleteWorkout'), t('workouts.deleteWorkoutMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          deleteWorkout(currentWorkout.id);
          navigation.goBack();
        },
      },
    ]);
  }

  return (
    <Screen>
      <Card>
        <Text style={[styles.title, { color: theme.colors.text, textAlign, writingDirection }]}>
          {workout.name}
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted, textAlign, writingDirection }]}>
          {formatDisplayDate(workout.date, language)} - {workout.time}
        </Text>
        {workout.notes ? (
          <Text style={[styles.notes, { color: theme.colors.text, textAlign, writingDirection }]}>
            {workout.notes}
          </Text>
        ) : null}
      </Card>

      <SectionHeader title={t('workouts.exercises')} />
      <Card>
        {workout.exercises.length ? (
          workout.exercises.map((exercise) => <ExerciseRow key={exercise.id} exercise={exercise} />)
        ) : (
          <Text style={[styles.emptyText, { color: theme.colors.textMuted, textAlign, writingDirection }]}>
            {t('workouts.noExercises')}
          </Text>
        )}
      </Card>

      <View style={[styles.actions, { flexDirection: rowDirection }]}>
        <AppButton
          title={t('common.edit')}
          icon="create-outline"
          variant="secondary"
          onPress={() => navigation.navigate('AddEditWorkout', { workoutId: currentWorkout.id })}
          style={styles.action}
        />
        <AppButton
          title={t('common.delete')}
          icon="trash-outline"
          variant="danger"
          onPress={confirmDelete}
          style={styles.action}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 26,
    fontWeight: '900',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
  },
  notes: {
    fontSize: 14,
    lineHeight: 21,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 21,
  },
  actions: {
    gap: 10,
  },
  action: {
    flex: 1,
  },
});
