import { ScrollView, StyleSheet } from 'react-native';

import { AppButton } from '../components/AppButton';
import { AppHeader } from '../components/AppHeader';
import { EmptyState } from '../components/EmptyState';
import { WorkoutCard } from '../components/WorkoutCard';
import { useBottomNavScrollHandler } from '../context/BottomNavContext';
import type { Translator } from '../i18n';
import { themeColors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import type { Workout } from '../types';

type WorkoutsScreenProps = {
  t: Translator;
  workouts: Workout[];
  onAddWorkout: () => void;
  onWorkoutPress: (workout: Workout) => void;
};

export function WorkoutsScreen({ t, workouts, onAddWorkout, onWorkoutPress }: WorkoutsScreenProps) {
  const colors = themeColors();
  const handleBottomNavScroll = useBottomNavScrollHandler();

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      onScroll={handleBottomNavScroll}
      scrollEventThrottle={16}
    >
      <AppHeader title={t('workouts.title')} subtitle={t('workouts.subtitle')} action={<AppButton title={t('common.add')} icon="add" onPress={onAddWorkout} />} />
      {workouts.length ? (
        workouts.map((workout) => (
          <WorkoutCard key={workout.id} workout={workout} minutesLabel={t('common.minutes')} exerciseLabel={t('workouts.exerciseLabel')} onPress={() => onWorkoutPress(workout)} />
        ))
      ) : (
        <EmptyState
          icon="barbell-outline"
          title={t('workouts.emptyTitle')}
          description={t('workouts.emptyMessage')}
          actionTitle={t('workouts.addTitle')}
          actionIcon="add"
          onAction={onAddWorkout}
        />
      )}
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
});
