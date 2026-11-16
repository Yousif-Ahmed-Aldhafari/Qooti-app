import { useMemo } from 'react';
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
import type { Meal, ProgressEntry, UserProfile } from '../types';
import { getDailyNutritionSummary } from '../utils/nutrition';
import { resolveEffectiveNutritionTargets } from '../utils/nutritionTargets';
import { activeRowStyle, activeTextAlign, activeWritingDirection } from '../utils/rtl';

type ProgressScreenProps = {
  t: Translator;
  profile: UserProfile;
  progress: ProgressEntry[];
  meals?: Meal[];
};

export function ProgressScreen({ t, profile, progress, meals }: ProgressScreenProps) {
  const colors = themeColors();
  const handleBottomNavScroll = useBottomNavScrollHandler();
  const effectiveTargets = useMemo(() => resolveEffectiveNutritionTargets(profile), [profile]);
  const latest = progress[progress.length - 1];
  const workoutDays = progress.reduce((sum, entry) => sum + entry.workouts, 0);

  // Derive authoritative real calorie aggregates from meals when available
  const enrichedDays = useMemo(() => {
    return progress.map((entry) => {
      if (meals !== undefined) {
        const summary = entry.date ? getDailyNutritionSummary(meals, entry.date) : null;
        const hasLogs = summary ? summary.hasLoggedMeals : false;
        return {
          ...entry,
          realCalories: hasLogs ? summary!.calories : 0,
          hasLogs,
        };
      }
      return {
        ...entry,
        realCalories: entry.calories,
        hasLogs: entry.calories > 0,
      };
    });
  }, [progress, meals]);

  const loggedDays = useMemo(
    () => enrichedDays.filter((d) => d.hasLogs),
    [enrichedDays]
  );

  const averageCalories = loggedDays.length > 0
    ? Math.round(loggedDays.reduce((sum, d) => sum + d.realCalories, 0) / loggedDays.length)
    : null;

  const maxCalories = Math.max(...enrichedDays.map((entry) => entry.realCalories), 1);
  const directionalText = {
    textAlign: activeTextAlign(),
    writingDirection: activeWritingDirection(),
  } as const;

  const chartA11yLabel = `${t('progress.weeklyTrend')}: ${enrichedDays
    .map((p) =>
      p.hasLogs
        ? `${p.label} ${Math.round(p.realCalories)} ${t('common.kcal')}`
        : `${p.label} (${t('nutrition.unloggedDay') || 'No logs'})`
    )
    .join(', ')}`;

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
        <StatCard
          label={t('progress.averageCalories')}
          value={averageCalories != null ? `${averageCalories} ${t('common.kcal')}` : `-- ${t('common.kcal')}`}
        />
        <StatCard label={t('progress.workoutDays')} value={workoutDays} accent={colors.purple} />
      </View>

      <AppCard>
        <Text style={[styles.sectionTitle, directionalText, { color: colors.text }]}>{t('progress.weeklyTrend')}</Text>
        <View
          style={[styles.chart, activeRowStyle()]}
          accessible={true}
          accessibilityLabel={chartA11yLabel}
        >
          {enrichedDays.map((entry) => {
            const isLogged = entry.hasLogs;
            const heightPercent = isLogged
              ? Math.max((entry.realCalories / maxCalories) * 100, 10)
              : 0;

            return (
              <View key={entry.id} style={styles.barColumn}>
                <View style={[styles.barTrack, { backgroundColor: colors.cardMuted }]}>
                  {isLogged ? (
                    <View
                      style={[
                        styles.barFill,
                        {
                          height: `${heightPercent}%`,
                          backgroundColor: colors.accent,
                        },
                      ]}
                    />
                  ) : (
                    <View
                      style={[
                        styles.unloggedPlaceholder,
                        { backgroundColor: `${colors.border}60` },
                      ]}
                    />
                  )}
                </View>
                <Text style={[styles.barLabel, { color: isLogged ? colors.text : colors.textMuted }]}>
                  {entry.label}
                </Text>
              </View>
            );
          })}
        </View>
        {loggedDays.length === 0 && (
          <Text style={[styles.noLogsNote, directionalText, { color: colors.textMuted }]}>
            {t('nutrition.noLogsForWeek') || 'No meals logged this week'}
          </Text>
        )}
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
          value={
            effectiveTargets.hasActiveTarget
              ? `${effectiveTargets.calories} ${t('common.kcal')}`
              : `-- ${t('common.kcal')}`
          }
          helper={
            effectiveTargets.hasActiveTarget
              ? effectiveTargets.isCustomOverride
                ? t('targets.customTarget')
                : t('targets.activeGoal')
              : t('personalization.unconfirmedStatus')
          }
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
  unloggedPlaceholder: {
    width: '100%',
    height: 4,
    borderRadius: radius.pill,
    alignSelf: 'center',
    marginBottom: 4,
  },
  noLogsNote: {
    ...typography.caption,
    textAlign: 'center',
    marginTop: spacing.xs,
    fontStyle: 'italic',
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

