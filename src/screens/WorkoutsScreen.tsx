import { ScrollView, StyleSheet, Text } from 'react-native';

import { AppButton } from '../components/AppButton';
import { AppHeader } from '../components/AppHeader';
import { WorkoutCard } from '../components/WorkoutCard';
import { useBottomNavScrollHandler } from '../context/BottomNavContext';
import type { Translator } from '../i18n';
import { themeColors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import type { Workout } from '../types';
import { activeTextAlign, activeWritingDirection } from '../utils/rtl';

type WorkoutsScreenProps = {
  t: Translator;
  workouts: Workout[];
  onAddWorkout: () => void;
  onWorkoutPress: (workout: Workout) => void;
};

export function WorkoutsScreen({ t, workouts, onAddWorkout, onWorkoutPress }: WorkoutsScreenProps) {
  const colors = themeColors();
  const handleBottomNavScroll = useBottomNavScrollHandler();
  const directionalText = {
    textAlign: activeTextAlign(),
    writingDirection: activeWritingDirection(),
  } as const;

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
        <Text style={[styles.empty, directionalText, { color: colors.textMuted }]}>{t('workouts.emptyMessage')}</Text>
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
  empty: {
    ...typography.body,
  },
});
