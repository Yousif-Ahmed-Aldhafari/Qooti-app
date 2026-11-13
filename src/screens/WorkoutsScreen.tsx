import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import { AppHeader } from '../components/AppHeader';
import { EmptyState } from '../components/EmptyState';
import { StatCard } from '../components/StatCard';
import { WorkoutCard } from '../components/WorkoutCard';
import { useBottomNavScrollHandler } from '../context/BottomNavContext';
import type { Translator } from '../i18n';
import { themeColors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import type { Language, Workout, WorkoutSession } from '../types';
import { activeRowStyle, activeTextAlign, activeWritingDirection } from '../utils/rtl';
import {
  calculateWorkoutProgressionSummary,
  filterWorkoutsByPeriod,
  type AnalyticsPeriod,
} from '../utils/workoutAnalytics';

type WorkoutsScreenProps = {
  t: Translator;
  workouts: Workout[];
  onAddWorkout: () => void;
  onWorkoutPress: (workout: Workout) => void;
  language?: Language;
  activeSession?: WorkoutSession | null;
  onResumeSession?: () => void;
};

export function WorkoutsScreen({
  t,
  workouts,
  onAddWorkout,
  onWorkoutPress,
  language = 'en',
  activeSession,
  onResumeSession,
}: WorkoutsScreenProps) {
  const colors = themeColors();
  const handleBottomNavScroll = useBottomNavScrollHandler();
  const [selectedPeriod, setSelectedPeriod] = useState<AnalyticsPeriod>('all');

  const directionalText = {
    textAlign: activeTextAlign(),
    writingDirection: activeWritingDirection(),
  } as const;

  const periods: { key: AnalyticsPeriod; label: string }[] = useMemo(
    () => [
      { key: 'all', label: t('workouts.filterAll') },
      { key: '7d', label: t('workouts.filter7d') },
      { key: '30d', label: t('workouts.filter30d') },
      { key: '90d', label: t('workouts.filter90d') },
    ],
    [t]
  );

  const filteredWorkouts = useMemo(
    () => filterWorkoutsByPeriod(workouts, selectedPeriod),
    [workouts, selectedPeriod]
  );

  const summary = useMemo(
    () => calculateWorkoutProgressionSummary(workouts, selectedPeriod),
    [workouts, selectedPeriod]
  );

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      onScroll={handleBottomNavScroll}
      scrollEventThrottle={16}
    >
      <AppHeader
        title={t('workouts.title')}
        subtitle={t('workouts.subtitle')}
        action={<AppButton title={t('common.add')} icon="add" onPress={onAddWorkout} />}
      />

      {activeSession && (activeSession.status === 'active' || activeSession.status === 'paused') && onResumeSession ? (
        <AppCard style={[styles.activeBanner, { borderColor: colors.accent }]}>
          <View style={[styles.activeBannerRow, activeRowStyle()]}>
            <View style={styles.activeBannerTextCol}>
              <View style={[styles.activeIndicatorRow, activeRowStyle()]}>
                <View
                  style={[
                    styles.activeDot,
                    { backgroundColor: activeSession.status === 'active' ? colors.accent : colors.warning },
                  ]}
                />
                <Text style={[styles.activeBannerSubtitle, directionalText, { color: colors.accent }]}>
                  {activeSession.status === 'active' ? t('workouts.activeWorkout') : t('workouts.pauseWorkout')}
                </Text>
              </View>
              <Text style={[styles.activeBannerTitle, directionalText, { color: colors.text }]} numberOfLines={1}>
                {activeSession.title}
              </Text>
            </View>
            <AppButton
              title={t('workouts.resume')}
              icon="play"
              onPress={onResumeSession}
            />
          </View>
        </AppCard>
      ) : null}

      {workouts.length > 0 ? (
        <>
          {/* Period Filter Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.filtersRow, activeRowStyle()]}
          >
            {periods.map((p) => {
              const isSelected = selectedPeriod === p.key;
              return (
                <Pressable
                  key={p.key}
                  accessibilityRole="button"
                  accessibilityLabel={p.label}
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => setSelectedPeriod(p.key)}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: isSelected ? colors.primary : colors.card,
                      borderColor: isSelected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      { color: isSelected ? colors.buttonText : colors.text },
                    ]}
                  >
                    {p.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Period Summary Stats */}
          <View style={[styles.statsRow, activeRowStyle()]}>
            <StatCard
              label={t('navigation.workouts')}
              value={summary.totalWorkouts}
              accent={colors.purple}
            />
            <StatCard
              label={t('workouts.duration')}
              value={`${summary.totalDurationMinutes} ${t('common.minutes')}`}
            />
          </View>

          <StatCard
            label={t('workouts.totalVolume')}
            value={`${summary.totalVolumeKg} ${t('common.kg')}`}
            accent={colors.accent}
          />

          {/* Filtered Workouts List */}
          {filteredWorkouts.length > 0 ? (
            filteredWorkouts.map((workout) => (
              <WorkoutCard
                key={workout.id}
                workout={workout}
                minutesLabel={t('common.minutes')}
                exerciseLabel={t('workouts.exerciseLabel')}
                onPress={() => onWorkoutPress(workout)}
                language={language}
                volumeUnit={t('common.kg')}
                bodyweightLabel={t('workouts.bodyweightLabel')}
              />
            ))
          ) : (
            <AppCard style={styles.periodEmptyCard}>
              <Text style={[styles.periodEmptyText, directionalText, { color: colors.textMuted }]}>
                {t('workouts.noWorkoutsInPeriod')}
              </Text>
              <AppButton
                title={t('workouts.filterAll')}
                variant="secondary"
                onPress={() => setSelectedPeriod('all')}
                style={styles.resetFilterButton}
              />
            </AppCard>
          )}
        </>
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
  activeBanner: {
    padding: spacing.md,
    borderWidth: 1.5,
  },
  activeBannerRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  activeBannerTextCol: {
    flex: 1,
    gap: spacing.xs,
  },
  activeIndicatorRow: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activeBannerSubtitle: {
    ...typography.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  activeBannerTitle: {
    ...typography.h3,
    fontSize: 16,
    fontWeight: '700',
  },
  filtersRow: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    minHeight: 38,
    minWidth: 54,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterChipText: {
    ...typography.caption,
    fontWeight: '600',
  },
  statsRow: {
    gap: spacing.md,
  },
  periodEmptyCard: {
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  periodEmptyText: {
    ...typography.body,
    textAlign: 'center',
  },
  resetFilterButton: {
    minHeight: 44,
  },
});
