import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppCard } from '../components/AppCard';
import { AppHeader } from '../components/AppHeader';
import { ProgressCard } from '../components/ProgressCard';
import { StatCard } from '../components/StatCard';
import { useBottomNavScrollHandler } from '../context/BottomNavContext';
import type { Translator } from '../i18n';
import { themeColors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import type { ProgressEntry, UserProfile } from '../types';
import { activeRowStyle, activeTextAlign, activeWritingDirection } from '../utils/rtl';

type ProgressScreenProps = {
  t: Translator;
  profile: UserProfile;
  progress: ProgressEntry[];
};

export function ProgressScreen({ t, profile, progress }: ProgressScreenProps) {
  const colors = themeColors();
  const handleBottomNavScroll = useBottomNavScrollHandler();
  const latest = progress[progress.length - 1];
  const workoutDays = progress.reduce((sum, entry) => sum + entry.workouts, 0);
  const averageCalories = progress.length
    ? Math.round(progress.reduce((sum, entry) => sum + entry.calories, 0) / progress.length)
    : 0;
  const maxCalories = Math.max(...progress.map((entry) => entry.calories), 1);
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
      <AppHeader title={t('progress.title')} subtitle={t('progress.subtitle')} />

      <View style={[styles.statsRow, activeRowStyle()]}>
        <StatCard label={t('progress.averageCalories')} value={`${averageCalories} ${t('common.kcal')}`} />
        <StatCard label={t('progress.workoutDays')} value={workoutDays} accent={colors.purple} />
      </View>

      <AppCard>
        <Text style={[styles.sectionTitle, directionalText, { color: colors.text }]}>{t('progress.weeklyTrend')}</Text>
        <View style={[styles.chart, activeRowStyle()]}>
          {progress.map((entry) => (
            <View key={entry.id} style={styles.barColumn}>
              <View style={[styles.barTrack, { backgroundColor: colors.cardMuted }]}>
                <View style={[styles.barFill, { height: `${Math.max((entry.calories / maxCalories) * 100, 10)}%`, backgroundColor: colors.accent }]} />
              </View>
              <Text style={[styles.barLabel, { color: colors.textMuted }]}>{entry.label}</Text>
            </View>
          ))}
        </View>
      </AppCard>

      <View style={[styles.progressRow, activeRowStyle()]}>
        <ProgressCard
          title={t('progress.weight')}
          value={`${latest?.weightKg ?? profile.weightKg} ${t('common.kg')}`}
          helper={t('progress.latestWeight')}
          accent={colors.lavender}
        />
        <ProgressCard
          title={t('profile.goal')}
          value={`${profile.targetCalories} ${t('common.kcal')}`}
          helper={t('progress.goalHelper')}
          accent={colors.accent}
        />
      </View>

      <Text style={[styles.helper, directionalText, { color: colors.textMuted }]}>{t('progress.daysTracked', { count: progress.length })}</Text>
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
  statsRow: {
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
  },
  chart: {
    height: 180,
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingTop: spacing.lg,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.sm,
  },
  barTrack: {
    width: '100%',
    maxWidth: 28,
    height: 130,
    borderRadius: radius.pill,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: radius.pill,
  },
  barLabel: {
    ...typography.caption,
    textAlign: 'center',
  },
  progressRow: {
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  helper: {
    ...typography.caption,
  },
});
