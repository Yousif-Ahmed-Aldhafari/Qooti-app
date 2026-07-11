import { StyleSheet, Text, View } from 'react-native';

import type { Exercise } from '../../models/workout';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useLanguage } from '../../hooks/useLanguage';

type ExerciseRowProps = {
  exercise: Exercise;
};

export function ExerciseRow({ exercise }: ExerciseRowProps) {
  const theme = useAppTheme();
  const { rowDirection, textAlign, writingDirection, t } = useLanguage();
  const detailParts = [
    `${exercise.sets} x ${exercise.reps}`,
    exercise.weight ? `${exercise.weight} ${t('workouts.kg')}` : '',
    exercise.duration ? `${exercise.duration} ${t('workouts.minutes')}` : '',
  ].filter(Boolean);

  return (
    <View style={[styles.row, { borderColor: theme.colors.border }]}>
      <View style={[styles.top, { flexDirection: rowDirection }]}>
        <View style={styles.text}>
          <Text style={[styles.name, { color: theme.colors.text, textAlign, writingDirection }]} numberOfLines={1}>
            {exercise.name || t('workouts.exerciseName')}
          </Text>
          <Text style={[styles.meta, { color: theme.colors.textMuted, textAlign, writingDirection }]}>
            {detailParts.join(' - ')}
          </Text>
        </View>
      </View>
      {exercise.notes ? (
        <Text style={[styles.notes, { color: theme.colors.textMuted, textAlign, writingDirection }]}>
          {exercise.notes}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    borderTopWidth: 1,
    paddingVertical: 12,
    gap: 6,
  },
  top: {
    alignItems: 'center',
    gap: 10,
  },
  text: {
    flex: 1,
    gap: 4,
  },
  name: {
    fontSize: 15,
    fontWeight: '800',
  },
  meta: {
    fontSize: 13,
  },
  notes: {
    fontSize: 13,
    lineHeight: 19,
  },
});
