import { StyleSheet, Text, View } from 'react-native';

import { AppCard } from '../../components/common/AppCard';
import { AppHeader } from '../../components/common/AppHeader';
import { ProgressCard } from '../../components/common/ProgressCard';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useLanguage } from '../../hooks/useLanguage';
import { useApp } from '../../store/AppContext';
import { formatShortDate } from '../../utils/date';

export function ProgressScreen() {
  const { progressEntries } = useApp();
  const theme = useAppTheme();
  const { language, rowDirectionStyle, t, textDirectionStyle } = useLanguage();
  const latest = progressEntries[progressEntries.length - 1] ?? progressEntries[0];
  const averageCalories = progressEntries.length
    ? Math.round(progressEntries.reduce((sum, item) => sum + item.calories, 0) / progressEntries.length)
    : 0;
  const workoutTotal = progressEntries.reduce((sum, item) => sum + item.workouts, 0);
  const maxCalories = Math.max(...progressEntries.map((item) => item.calories), 1);

  return (
    <ScreenContainer>
      <AppHeader title={t('progress.title')} subtitle={t('progress.subtitle')} />

      <View style={[styles.grid, rowDirectionStyle]}>
        <ProgressCard
          label={t('progress.latestWeight')}
          value={`${latest?.weightKg ?? 0}`}
          helper="kg"
          progress={0.72}
        />
        <ProgressCard
          label={t('progress.averageCalories')}
          value={String(averageCalories)}
          helper={t('macros.kcal')}
          progress={averageCalories / 2400}
        />
        <ProgressCard
          label={t('progress.sessions')}
          value={String(workoutTotal)}
          helper={t('common.thisWeek')}
          progress={workoutTotal / 5}
        />
      </View>

      <AppCard>
        <Text style={[styles.sectionTitle, textDirectionStyle, { color: theme.colors.text }]}>
          {t('progress.weeklyTrend')}
        </Text>
        <View style={[styles.chart, rowDirectionStyle]}>
          {progressEntries.map((entry) => (
            <View key={entry.id} style={styles.barWrap}>
              <View style={[styles.barTrack, { backgroundColor: theme.colors.surfaceMuted }]}>
                <View
                  style={[
                    styles.barFill,
                    {
                      height: `${Math.max(12, (entry.calories / maxCalories) * 100)}%`,
                      backgroundColor: entry.workouts ? theme.colors.primary : theme.colors.accent,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.barLabel, { color: theme.colors.textMuted }]}>
                {entry.date ? formatShortDate(entry.date, language) : (entry.label || '')}
              </Text>
            </View>
          ))}
        </View>
      </AppCard>

      <View style={[styles.grid, rowDirectionStyle]}>
        <ProgressCard label={t('progress.nutritionConsistency')} value="86%" helper={t('common.completed')} progress={0.86} />
        <ProgressCard label={t('progress.trainingConsistency')} value="72%" helper={t('common.completed')} progress={0.72} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexWrap: 'wrap',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  chart: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
    minHeight: 180,
  },
  barWrap: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  barTrack: {
    width: '100%',
    maxWidth: 34,
    height: 140,
    borderRadius: 999,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 999,
  },
  barLabel: {
    fontSize: 10,
    fontWeight: '800',
  },
});
