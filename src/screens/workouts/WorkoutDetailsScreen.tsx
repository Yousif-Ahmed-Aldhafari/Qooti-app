import { Alert, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { AppHeader } from '../../components/common/AppHeader';
import { EmptyState } from '../../components/common/EmptyState';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ExerciseRow } from '../../components/workouts/ExerciseRow';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useLanguage } from '../../hooks/useLanguage';
import type { RootStackParamList } from '../../navigation/types';
import { useApp } from '../../store/AppContext';
import { formatDisplayDate } from '../../utils/date';
import { totalSets, workoutDuration } from '../../utils/health';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'WorkoutDetails'>;
type WorkoutDetailsRoute = RouteProp<RootStackParamList, 'WorkoutDetails'>;

export function WorkoutDetailsScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<WorkoutDetailsRoute>();
  const { deleteWorkout, workouts } = useApp();
  const theme = useAppTheme();
  const { language, rowDirectionStyle, t, textDirectionStyle } = useLanguage();
  const workout = workouts.find((item) => item.id === route.params.workoutId);

  if (!workout) {
    return (
      <ScreenContainer>
        <EmptyState title={t('common.notFound')} message={t('workouts.emptyMessage')} />
      </ScreenContainer>
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
    <ScreenContainer>
      <AppHeader title={currentWorkout.name} subtitle={`${formatDisplayDate(currentWorkout.date, language)} · ${currentWorkout.time}`} />

      <View style={[styles.stats, rowDirectionStyle]}>
        <AppCard style={styles.statCard}>
          <Text style={[styles.statValue, textDirectionStyle, { color: theme.colors.text }]}>
            {currentWorkout.exercises.length}
          </Text>
          <Text style={[styles.statLabel, textDirectionStyle, { color: theme.colors.textMuted }]}>
            {t('workouts.exerciseUnit')}
          </Text>
        </AppCard>
        <AppCard style={styles.statCard}>
          <Text style={[styles.statValue, textDirectionStyle, { color: theme.colors.text }]}>
            {totalSets(currentWorkout)}
          </Text>
          <Text style={[styles.statLabel, textDirectionStyle, { color: theme.colors.textMuted }]}>
            {t('workouts.setUnit')}
          </Text>
        </AppCard>
        <AppCard style={styles.statCard}>
          <Text style={[styles.statValue, textDirectionStyle, { color: theme.colors.text }]}>
            {workoutDuration(currentWorkout) || 45}
          </Text>
          <Text style={[styles.statLabel, textDirectionStyle, { color: theme.colors.textMuted }]}>
            {t('workouts.minutesShort')}
          </Text>
        </AppCard>
      </View>

      <AppCard>
        <Text style={[styles.sectionTitle, textDirectionStyle, { color: theme.colors.text }]}>
          {t('workouts.exercises')}
        </Text>
        {currentWorkout.exercises.length ? (
          currentWorkout.exercises.map((exercise) => <ExerciseRow key={exercise.id} exercise={exercise} />)
        ) : (
          <Text style={[styles.empty, textDirectionStyle, { color: theme.colors.textMuted }]}>
            {t('workouts.noExercises')}
          </Text>
        )}
        {currentWorkout.notes ? (
          <Text style={[styles.notes, textDirectionStyle, { color: theme.colors.textMuted }]}>{currentWorkout.notes}</Text>
        ) : null}
      </AppCard>

      <View style={[styles.actions, rowDirectionStyle]}>
        <AppButton title={t('common.delete')} icon="trash-outline" variant="danger" onPress={confirmDelete} style={styles.action} />
        <AppButton title={t('workouts.addExercise')} icon="add" variant="secondary" onPress={() => navigation.navigate('AddExercise')} style={styles.action} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  stats: {
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: 96,
    padding: 14,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '900',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  empty: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 21,
  },
  notes: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 22,
  },
  actions: {
    gap: 12,
  },
  action: {
    flex: 1,
  },
});
