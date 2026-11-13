import { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
  interruptedSessions?: WorkoutSession[];
  onResumeInterruptedSession?: (
    sessionId: string,
    currentAction?: 'archive' | 'discard'
  ) => Promise<void> | void;
  onArchiveInterruptedSession?: (sessionId: string, notes?: string) => Promise<WorkoutSession | void> | void;
  onDiscardInterruptedSession?: (sessionId: string) => Promise<void> | void;
};

export function WorkoutsScreen({
  t,
  workouts,
  onAddWorkout,
  onWorkoutPress,
  language = 'en',
  activeSession,
  onResumeSession,
  interruptedSessions,
  onResumeInterruptedSession,
  onArchiveInterruptedSession,
  onDiscardInterruptedSession,
}: WorkoutsScreenProps) {
  const colors = themeColors();
  const handleBottomNavScroll = useBottomNavScrollHandler();
  const [selectedPeriod, setSelectedPeriod] = useState<AnalyticsPeriod>('all');
  const [recoveryModalVisible, setRecoveryModalVisible] = useState(false);

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

      {interruptedSessions && interruptedSessions.length > 0 ? (
        <AppCard style={[styles.interruptedBanner, { borderColor: colors.warning }]}>
          <View style={[styles.activeBannerRow, activeRowStyle()]}>
            <View style={styles.activeBannerTextCol}>
              <View style={[styles.activeIndicatorRow, activeRowStyle()]}>
                <Ionicons name="alert-circle" size={18} color={colors.warning} />
                <Text style={[styles.activeBannerSubtitle, directionalText, { color: colors.warning }]}>
                  {t('workouts.interruptedWorkoutsBanner', { count: interruptedSessions.length })}
                </Text>
              </View>
            </View>
            <AppButton
              title={t('workouts.reviewInterrupted')}
              icon="refresh"
              variant="secondary"
              onPress={() => setRecoveryModalVisible(true)}
            />
          </View>
        </AppCard>
      ) : null}

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

      <Modal
        visible={recoveryModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setRecoveryModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalHeader, activeRowStyle()]}>
              <View style={styles.modalHeaderTitleWrap}>
                <Text style={[styles.modalTitle, directionalText, { color: colors.text }]}>
                  {t('workouts.recoveryModalTitle')}
                </Text>
                <Text style={[styles.modalSubtitle, directionalText, { color: colors.textMuted }]}>
                  {t('workouts.recoveryModalSubtitle')}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
                onPress={() => setRecoveryModalVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
              {(interruptedSessions || []).map((session) => {
                const totalSets = (session.exercises || []).reduce(
                  (acc, ex) => acc + (ex.sets?.length || 0),
                  0
                );
                const completedSets = (session.exercises || []).reduce(
                  (acc, ex) =>
                    acc + (ex.sets?.filter((s) => s.status === 'completed').length || 0),
                  0
                );
                const elapsedFormatted = `${Math.floor(session.accumulatedElapsedMs / 60000)}m`;

                return (
                  <AppCard key={session.id} style={styles.recoveryCard}>
                    <View style={[styles.recoveryHeaderRow, activeRowStyle()]}>
                      <Text
                        style={[styles.recoverySessionTitle, directionalText, { color: colors.text, flex: 1 }]}
                      >
                        {session.title}
                      </Text>
                      {session.recoveryState === 'ambiguous' ? (
                        <View style={[styles.ambiguousBadge, { backgroundColor: colors.cardMuted }]}>
                          <Text style={[styles.ambiguousBadgeText, { color: colors.textMuted }]}>
                            {t('workouts.recoveryAmbiguousBadge')}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text
                      style={[styles.recoverySessionMeta, directionalText, { color: colors.textMuted }]}
                    >
                      {t('workouts.recoverySetsCompleted', {
                        completed: completedSets,
                        total: totalSets,
                      })}{' '}
                      •{' '}
                      {t('workouts.recoveryDuration', {
                        duration: elapsedFormatted,
                      })}
                    </Text>

                    <View style={[styles.recoveryActionsRow, activeRowStyle()]}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('workouts.resume')}
                        style={[styles.recoveryActionBtn, { backgroundColor: colors.accent }]}
                        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                        onPress={() => {
                          if (
                            activeSession &&
                            (activeSession.status === 'active' || activeSession.status === 'paused')
                          ) {
                            Alert.alert(
                              t('workouts.resumeInterruptedConflictTitle'),
                              t('workouts.resumeInterruptedConflictMessage'),
                              [
                                { text: t('common.cancel'), style: 'cancel' },
                                {
                                  text: t('workouts.archiveAndResume'),
                                  onPress: async () => {
                                    setRecoveryModalVisible(false);
                                    await onResumeInterruptedSession?.(session.id, 'archive');
                                  },
                                },
                                {
                                  text: t('workouts.discardAndResume'),
                                  style: 'destructive',
                                  onPress: async () => {
                                    setRecoveryModalVisible(false);
                                    await onResumeInterruptedSession?.(session.id, 'discard');
                                  },
                                },
                              ]
                            );
                          } else {
                            setRecoveryModalVisible(false);
                            void onResumeInterruptedSession?.(session.id);
                          }
                        }}
                      >
                        <Text
                          style={[styles.recoveryActionText, { color: '#FFFFFF' }]}
                        >
                          {t('workouts.resume')}
                        </Text>
                      </Pressable>

                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('workouts.archiveSession')}
                        style={[styles.recoveryActionBtn, { backgroundColor: colors.cardMuted }]}
                        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                        onPress={async () => {
                          await onArchiveInterruptedSession?.(session.id);
                          if ((interruptedSessions || []).length <= 1) {
                            setRecoveryModalVisible(false);
                          }
                        }}
                      >
                        <Text style={[styles.recoveryActionText, { color: colors.text }]}>
                          {t('workouts.archiveSession')}
                        </Text>
                      </Pressable>

                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('common.delete')}
                        style={[styles.recoveryActionBtn, { backgroundColor: colors.danger + '20' }]}
                        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                        onPress={() => {
                          Alert.alert(
                            t('workouts.discardInterruptedConfirm'),
                            t('workouts.discardInterruptedMessage'),
                            [
                              { text: t('common.cancel'), style: 'cancel' },
                              {
                                text: t('common.delete'),
                                style: 'destructive',
                                onPress: async () => {
                                  await onDiscardInterruptedSession?.(session.id);
                                  if ((interruptedSessions || []).length <= 1) {
                                    setRecoveryModalVisible(false);
                                  }
                                },
                              },
                            ]
                          );
                        }}
                      >
                        <Text style={[styles.recoveryActionText, { color: colors.danger }]}>
                          {t('common.delete')}
                        </Text>
                      </Pressable>
                    </View>
                  </AppCard>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  interruptedBanner: {
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    maxHeight: '80%',
    gap: spacing.lg,
  },
  modalHeader: {
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  modalHeaderTitleWrap: {
    flex: 1,
    gap: spacing.xs,
  },
  modalTitle: {
    ...typography.h3,
    fontWeight: '700',
  },
  modalSubtitle: {
    ...typography.body,
    fontSize: 14,
  },
  modalList: {
    maxHeight: 400,
  },
  recoveryCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  recoveryHeaderRow: {
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  ambiguousBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  ambiguousBadgeText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '600',
  },
  recoverySessionTitle: {
    ...typography.h3,
    fontSize: 16,
    fontWeight: '700',
  },
  recoverySessionMeta: {
    ...typography.caption,
  },
  recoveryActionsRow: {
    gap: spacing.sm,
    flexWrap: 'wrap',
    marginTop: spacing.xs,
  },
  recoveryActionBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    minHeight: 44,
    minWidth: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recoveryActionText: {
    ...typography.caption,
    fontWeight: '600',
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
