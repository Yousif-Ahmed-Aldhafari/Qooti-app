import { StyleSheet, Text, View } from 'react-native';

import type { Exercise } from '../../models/workout';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useLanguage } from '../../hooks/useLanguage';

type ExerciseRowProps = {
  exercise: Exercise;
};

export function ExerciseRow({ exercise }: ExerciseRowProps) {
  const theme = useAppTheme();
  const { contentDirectionStyle, rowDirectionStyle, textDirectionStyle, t } = useLanguage();
  const detailParts = [
    `${exercise.sets} x ${exercise.reps}`,
    exercise.weight ? `${exercise.weight} ${t('workouts.kg')}` : '',
    exercise.duration ? `${exercise.duration} ${t('workouts.minutes')}` : '',
  ].filter(Boolean);

  return (
    <View style={[styles.row, contentDirectionStyle, { borderColor: theme.colors.border }]}>
      <View style={[styles.top, rowDirectionStyle]}>
        <View style={styles.text}>
          <Text style={[styles.name, textDirectionStyle, { color: theme.colors.text }]} numberOfLines={1}>
            {exercise.name || t('workouts.exerciseName')}
          </Text>
          <Text style={[styles.meta, textDirectionStyle, { color: theme.colors.textMuted }]}>
            {detailParts.join(' - ')}
          </Text>
        </View>
      </View>
      {exercise.notes ? (
        <Text style={[styles.notes, textDirectionStyle, { color: theme.colors.textMuted }]}>
          {exercise.notes}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignSelf: 'stretch',
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
    alignSelf: 'stretch',
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
