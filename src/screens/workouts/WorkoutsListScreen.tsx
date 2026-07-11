import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { AppButton } from '../../components/common/AppButton';
import { EmptyState } from '../../components/common/EmptyState';
import { ListItem } from '../../components/common/ListItem';
import { Screen } from '../../components/common/Screen';
import { SectionHeader } from '../../components/common/SectionHeader';
import { useApp } from '../../store/AppContext';
import { useLanguage } from '../../hooks/useLanguage';
import type { RootStackParamList } from '../../navigation/types';
import { compareDateTimeDesc, formatDisplayDate } from '../../utils/date';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

export function WorkoutsListScreen() {
  const navigation = useNavigation<Navigation>();
  const { workouts } = useApp();
  const { t, language } = useLanguage();
  const sortedWorkouts = [...workouts].sort(compareDateTimeDesc);

  return (
    <Screen>
      <SectionHeader
        title={t('workouts.title')}
        action={
          <AppButton
            title={t('common.add')}
            icon="add"
            onPress={() => navigation.navigate('AddEditWorkout')}
            style={styles.headerButton}
          />
        }
      />

      {sortedWorkouts.length ? (
        <View style={styles.list}>
          {sortedWorkouts.map((workout) => (
            <ListItem
              key={workout.id}
              title={workout.name}
              subtitle={`${formatDisplayDate(workout.date, language)} - ${workout.time} - ${t(
                'workouts.exerciseCount',
                { count: workout.exercises.length },
              )}`}
              icon="barbell-outline"
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
          onAction={() => navigation.navigate('AddEditWorkout')}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerButton: {
    minHeight: 40,
    paddingHorizontal: 14,
  },
  list: {
    gap: 10,
  },
});
