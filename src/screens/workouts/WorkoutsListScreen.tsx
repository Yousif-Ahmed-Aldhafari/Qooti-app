import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { AppHeader } from '../../components/common/AppHeader';
import { EmptyState } from '../../components/common/EmptyState';
import { ProgressCard } from '../../components/common/ProgressCard';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { WorkoutCard } from '../../components/common/WorkoutCard';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useLanguage } from '../../hooks/useLanguage';
import type { RootStackParamList } from '../../navigation/types';
import { useApp } from '../../store/AppContext';
import { compareDateTimeDesc } from '../../utils/date';
import { weeklyWorkoutMinutes, workoutsForToday } from '../../utils/health';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

export function WorkoutsListScreen() {
  const navigation = useNavigation<Navigation>();
  const { workouts } = useApp();
  const theme = useAppTheme();
  const { rowDirectionStyle, t, textDirectionStyle } = useLanguage();
  const sortedWorkouts = [...workouts].sort(compareDateTimeDesc);
  const todayWorkoutCount = workoutsForToday(workouts).length;

  return (
    <ScreenContainer>
      <AppHeader
        title={t('workouts.title')}
        subtitle={t('workouts.subtitle')}
        action={<AppButton title={t('common.add')} icon="add" onPress={() => navigation.navigate('AddExercise')} style={styles.headerButton} />}
      />

      <View style={[styles.grid, rowDirectionStyle]}>
        <ProgressCard label={t('dashboard.todayWorkouts')} value={String(todayWorkoutCount)} helper={t('common.today')} progress={Math.min(1, todayWorkoutCount / 2)} />
        <ProgressCard label={t('dashboard.workoutMinutes')} value={String(weeklyWorkoutMinutes(workouts))} helper={t('common.thisWeek')} progress={Math.min(1, weeklyWorkoutMinutes(workouts) / 180)} />
      </View>

      <AppCard tone="dark">
        <Text style={[styles.darkTitle, textDirectionStyle]}>{t('workouts.weeklySummary')}</Text>
        <Text style={[styles.darkBody, textDirectionStyle]}>
          {weeklyWorkoutMinutes(workouts)} {t('workouts.minutes')} · {sortedWorkouts.length} {t('workouts.exerciseUnit')}
        </Text>
      </AppCard>

      {sortedWorkouts.length ? (
        <View style={styles.list}>
          <Text style={[styles.sectionTitle, textDirectionStyle, { color: theme.colors.text }]}>
            {t('workouts.recent')}
          </Text>
          {sortedWorkouts.map((workout) => (
            <WorkoutCard
              key={workout.id}
              workout={workout}
              onPress={() => navigation.navigate('WorkoutDetails', { workoutId: workout.id })}
            />
          ))}
        </View>
      ) : (
        <EmptyState
          icon="barbell-outline"
          title={t('workouts.emptyTitle')}
          message={t('workouts.emptyMessage')}
          actionLabel={t('workouts.addTitle')}
          onAction={() => navigation.navigate('AddExercise')}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerButton: {
    minHeight: 44,
    paddingHorizontal: 14,
  },
  grid: {
    flexWrap: 'wrap',
    gap: 12,
  },
  darkTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  darkBody: {
    color: '#DDE7F5',
    fontSize: 14,
    fontWeight: '800',
  },
  list: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
});
