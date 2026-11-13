import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import { StatCard } from '../components/StatCard';
import type { Translator } from '../i18n';
import type { WorkoutSession, WorkoutSet } from '../models/workoutSession';
import { themeColors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { activeRowStyle, activeTextAlign, activeWritingDirection } from '../utils/rtl';
import { calculateSessionPerformanceSummary } from '../utils/workoutAnalytics';

type ActiveWorkoutScreenProps = {
  t: Translator;
  session: WorkoutSession;
  language?: 'en' | 'ar';
  onPause: () => Promise<void> | void;
  onResume: () => Promise<void> | void;
  onCompleteSet: (
    setId: string,
    reps: number,
    weight: number,
    rpe?: number | null,
    notes?: string
  ) => Promise<void> | void;
  onSkipSet: (setId: string, notes?: string) => Promise<void> | void;
  onAddSet: (sessionExerciseId: string, reps: number, weight: number) => Promise<void> | void;
  onSetRestTarget?: (targetAt: string | null) => Promise<WorkoutSession | null> | void;
  onFinish: (notes?: string) => Promise<void> | void;
  onDiscard: () => Promise<void> | void;
  onLeave: () => void;
};

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function ActiveWorkoutScreen({
  t,
  session,
  language = 'en',
  onPause,
  onResume,
  onCompleteSet,
  onSkipSet,
  onAddSet,
  onSetRestTarget,
  onFinish,
  onDiscard,
  onLeave,
}: ActiveWorkoutScreenProps) {
  const colors = themeColors();
  const [now, setNow] = useState(() => Date.now());
  const [restTargetMs, setRestTargetMs] = useState<number | null>(() => {
    if (session.restTargetAt) {
      const parsed = Date.parse(session.restTargetAt);
      if (!Number.isNaN(parsed) && parsed > Date.now()) {
        return parsed;
      }
    }
    return null;
  });
  const restTargetMsRef = useRef<number | null>(restTargetMs);
  restTargetMsRef.current = restTargetMs;

  const persistenceQueueRef = useRef<Promise<void>>(Promise.resolve());
  const restSeqRef = useRef<number>(0);

  const persistRestTarget = useCallback(
    (targetMs: number | null) => {
      const seq = ++restSeqRef.current;
      const isoString = targetMs !== null ? new Date(targetMs).toISOString() : null;

      persistenceQueueRef.current = persistenceQueueRef.current
        .then(async () => {
          if (seq !== restSeqRef.current) {
            return;
          }
          if (onSetRestTarget) {
            await onSetRestTarget(isoString);
          }
        })
        .catch((err) => {
          if (seq === restSeqRef.current) {
            console.warn('[ActiveWorkoutScreen] Failed to persist rest target:', err);
          }
        });
    },
    [onSetRestTarget]
  );

  // Sync if session.restTargetAt changes externally, or cleanup if already expired
  useEffect(() => {
    if (session.restTargetAt) {
      const parsed = Date.parse(session.restTargetAt);
      if (!Number.isNaN(parsed)) {
        if (parsed > Date.now()) {
          restTargetMsRef.current = parsed;
          setRestTargetMs(parsed);
        } else {
          restTargetMsRef.current = null;
          setRestTargetMs(null);
          persistRestTarget(null);
        }
      }
    }
  }, [session.restTargetAt, persistRestTarget]);

  // Recalculate remaining time and expire target on app foregrounding without setInterval reliance
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        const currentTime = Date.now();
        setNow(currentTime);
        if (restTargetMsRef.current !== null && restTargetMsRef.current <= currentTime) {
          restTargetMsRef.current = null;
          setRestTargetMs(null);
          persistRestTarget(null);
        }
      }
    });
    return () => subscription.remove();
  }, [persistRestTarget]);

  const [restDurationSec] = useState<number>(90);
  const [summaryModalVisible, setSummaryModalVisible] = useState(false);
  const [sessionNotes, setSessionNotes] = useState(session.notes || '');
  const [isFinishing, setIsFinishing] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);
  const [submittingSetId, setSubmittingSetId] = useState<string | null>(null);
  const [setErrors, setSetErrors] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<string | null>(null);

  // Set-level editable draft inputs: key = setId
  const [setInputs, setSetInputs] = useState<
    Record<string, { weight: string; reps: string; rpe: string }>
  >(() => {
    const initial: Record<string, { weight: string; reps: string; rpe: string }> = {};
    for (const ex of session.exercises || []) {
      for (const st of ex.sets || []) {
        initial[st.id] = {
          weight: String(st.actualWeightKg ?? st.plannedWeightKg ?? 0),
          reps: String(st.actualReps ?? st.plannedReps ?? 10),
          rpe: st.rpe !== undefined && st.rpe !== null ? String(st.rpe) : '',
        };
      }
    }
    return initial;
  });

  // Rest timer countdown
  const restRemainingSec = useMemo(() => {
    if (!restTargetMs) return 0;
    return Math.max(0, Math.ceil((restTargetMs - now) / 1000));
  }, [restTargetMs, now]);

  // Timer expiration: clear active rest state and clean up persisted state
  useEffect(() => {
    if (restTargetMs !== null && restRemainingSec === 0) {
      restTargetMsRef.current = null;
      setRestTargetMs(null);
      persistRestTarget(null);
    }
  }, [restTargetMs, restRemainingSec, persistRestTarget]);

  const handleAdd30s = useCallback(() => {
    const currentBase =
      restTargetMsRef.current && restTargetMsRef.current > Date.now()
        ? restTargetMsRef.current
        : Date.now();
    const nextTarget = currentBase + 30000;
    restTargetMsRef.current = nextTarget;
    setRestTargetMs(nextTarget);
    persistRestTarget(nextTarget);
  }, [persistRestTarget]);

  const handleSkipRest = useCallback(() => {
    restTargetMsRef.current = null;
    setRestTargetMs(null);
    persistRestTarget(null);
  }, [persistRestTarget]);

  // Ticking effect for elapsed time and rest countdown
  useEffect(() => {
    const shouldTick = session.status === 'active' || (restTargetMs !== null && restRemainingSec > 0);
    if (!shouldTick) return;
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [session.status, restTargetMs, restRemainingSec]);

  // Elapsed time calculation: strictly derived from accumulated + (now - lastResumedAt)
  const elapsedMs = useMemo(() => {
    let total = session.accumulatedElapsedMs || 0;
    if (session.status === 'active' && session.lastResumedAt) {
      const resumedTime = Date.parse(session.lastResumedAt);
      if (!Number.isNaN(resumedTime)) {
        total += Math.max(0, now - resumedTime);
      }
    }
    return total;
  }, [session.accumulatedElapsedMs, session.lastResumedAt, session.status, now]);

  const directionalText = {
    textAlign: activeTextAlign(),
    writingDirection: activeWritingDirection(),
  } as const;

  const summary = useMemo(() => calculateSessionPerformanceSummary(session), [session]);

  const handlePauseResumeAction = async () => {
    setActionError(null);
    try {
      if (session.status === 'active') {
        await onPause();
      } else {
        await onResume();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('workouts.sessionActionError');
      setActionError(msg);
      Alert.alert(t('common.error'), msg);
    }
  };

  const handleCompleteSetAction = async (st: WorkoutSet) => {
    if (submittingSetId) return;

    const inputs = setInputs[st.id] || {
      weight: String(st.plannedWeightKg),
      reps: String(st.plannedReps),
      rpe: '',
    };

    const trimmedReps = inputs.reps.trim();
    const trimmedWeight = inputs.weight.trim();
    const trimmedRpe = inputs.rpe.trim();

    // Validate reps: non-negative integer
    if (!/^\d+$/.test(trimmedReps)) {
      setSetErrors((prev) => ({
        ...prev,
        [st.id]: t('workouts.invalidReps'),
      }));
      return;
    }

    // Validate weight: non-negative finite number
    const weightNum = parseFloat(trimmedWeight);
    if (
      isNaN(weightNum) ||
      !Number.isFinite(weightNum) ||
      weightNum < 0 ||
      !/^\d+(\.\d+)?$/.test(trimmedWeight)
    ) {
      setSetErrors((prev) => ({
        ...prev,
        [st.id]: t('workouts.invalidWeight'),
      }));
      return;
    }

    // Validate rpe if provided
    let rpeNum: number | null = null;
    if (trimmedRpe) {
      rpeNum = parseFloat(trimmedRpe);
      if (isNaN(rpeNum) || !Number.isFinite(rpeNum) || rpeNum < 1 || rpeNum > 10) {
        setSetErrors((prev) => ({
          ...prev,
          [st.id]: t('workouts.invalidRpe'),
        }));
        return;
      }
    }

    const repsNum = parseInt(trimmedReps, 10);

    // Clear previous error for this set
    setSetErrors((prev) => {
      const next = { ...prev };
      delete next[st.id];
      return next;
    });

    setSubmittingSetId(st.id);
    try {
      await onCompleteSet(st.id, repsNum, weightNum, rpeNum);
      // Trigger rest countdown and persist ONLY after onCompleteSet resolves successfully
      const nextTarget = Date.now() + restDurationSec * 1000;
      restTargetMsRef.current = nextTarget;
      setRestTargetMs(nextTarget);
      persistRestTarget(nextTarget);
    } catch (err) {
      // Draft inputs are preserved in setInputs
      setSetErrors((prev) => ({
        ...prev,
        [st.id]: err instanceof Error ? err.message : t('workouts.sessionActionError'),
      }));
    } finally {
      setSubmittingSetId(null);
    }
  };

  const handleSkipSetAction = async (st: WorkoutSet) => {
    if (submittingSetId) return;
    try {
      await onSkipSet(st.id);
      setSetErrors((prev) => {
        const next = { ...prev };
        delete next[st.id];
        return next;
      });
    } catch (err) {
      setSetErrors((prev) => ({
        ...prev,
        [st.id]: err instanceof Error ? err.message : t('workouts.sessionActionError'),
      }));
    }
  };

  const handleAddSetAction = async (sessionExerciseId: string, lastSet?: WorkoutSet) => {
    const plannedReps = lastSet ? lastSet.plannedReps : 10;
    const plannedWeight = lastSet ? lastSet.plannedWeightKg : 0;
    try {
      await onAddSet(sessionExerciseId, plannedReps, plannedWeight);
    } catch (err) {
      Alert.alert(t('common.error'), err instanceof Error ? err.message : t('workouts.sessionActionError'));
    }
  };

  const confirmLeave = () => {
    Alert.alert(
      t('workouts.leaveWorkoutTitle'),
      t('workouts.leaveWorkoutMessage'),
      [
        { text: t('workouts.stay'), style: 'cancel' },
        { text: t('workouts.leave'), onPress: onLeave },
      ],
      { cancelable: true }
    );
  };

  const confirmDiscard = () => {
    if (isDiscarding) return;
    Alert.alert(
      t('workouts.discardSessionConfirm'),
      t('workouts.discardSessionMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            setIsDiscarding(true);
            try {
              await onDiscard();
            } catch (err) {
              Alert.alert(
                t('common.error'),
                err instanceof Error ? err.message : t('workouts.sessionActionError')
              );
            } finally {
              setIsDiscarding(false);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleConfirmFinish = async () => {
    if (isFinishing) return;
    setIsFinishing(true);
    try {
      await onFinish(sessionNotes.trim());
      setSummaryModalVisible(false);
    } catch (err) {
      Alert.alert(
        t('common.error'),
        err instanceof Error ? err.message : t('workouts.sessionActionError')
      );
    } finally {
      setIsFinishing(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardRoot}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
    >
      <ScrollView
        style={[styles.screen, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Bar */}
        <View style={[styles.headerContainer, activeRowStyle()]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('workouts.leave')}
            onPress={confirmLeave}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>

          <View style={styles.headerTitleWrap}>
            <Text
              style={[styles.headerTitle, directionalText, { color: colors.text }]}
              numberOfLines={1}
            >
              {session.title}
            </Text>
            <View style={[styles.timerBadgeRow, activeRowStyle()]}>
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor:
                      session.status === 'active' ? colors.accent : colors.warning,
                  },
                ]}
              />
              <Text style={[styles.timerText, { color: colors.text }]}>
                {formatElapsed(elapsedMs)}
              </Text>
              <Text
                style={[
                  styles.statusText,
                  {
                    color:
                      session.status === 'active' ? colors.accent : colors.warning,
                  },
                ]}
              >
                {session.status === 'active'
                  ? t('workouts.activeWorkout')
                  : t('workouts.pauseWorkout')}
              </Text>
            </View>
          </View>

          <AppButton
            title={session.status === 'active' ? t('workouts.pauseWorkout') : t('workouts.resume')}
            icon={session.status === 'active' ? 'pause-outline' : 'play-outline'}
            variant="secondary"
            onPress={handlePauseResumeAction}
          />
        </View>

        {/* Recoverable Action Error Banner */}
        {actionError ? (
          <View
            style={[
              styles.errorBanner,
              activeRowStyle(),
              { backgroundColor: `${colors.danger}18`, borderColor: colors.danger },
            ]}
          >
            <Ionicons name="alert-circle" size={20} color={colors.danger} />
            <Text
              style={[
                styles.errorBannerText,
                directionalText,
                { color: colors.danger },
              ]}
            >
              {actionError}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              onPress={() => setActionError(null)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={18} color={colors.danger} />
            </Pressable>
          </View>
        ) : null}

        {/* Floating Rest Timer Card */}
        {restRemainingSec > 0 ? (
          <AppCard style={[styles.restCard, { borderColor: colors.purple }]}>
            <View style={[styles.restRow, activeRowStyle()]}>
              <View style={[styles.restInfo, activeRowStyle()]}>
                <Ionicons name="timer-outline" size={22} color={colors.purple} />
                <View style={styles.restTextWrap}>
                  <Text style={[styles.restLabel, directionalText, { color: colors.textMuted }]}>
                    {t('workouts.restTimer')}
                  </Text>
                  <Text style={[styles.restCountdown, { color: colors.purple }]}>
                    {restRemainingSec}s
                  </Text>
                </View>
              </View>
              <View style={[styles.restActions, activeRowStyle()]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('workouts.add30s')}
                  onPress={handleAdd30s}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={[styles.restActionButton, { backgroundColor: colors.cardMuted }]}
                >
                  <Text style={[styles.restActionText, { color: colors.text }]}>
                    {t('workouts.add30s')}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('workouts.skipRest')}
                  onPress={handleSkipRest}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={[styles.restActionButton, { backgroundColor: colors.cardMuted }]}
                >
                  <Text style={[styles.restActionText, { color: colors.textMuted }]}>
                    {t('workouts.skipRest')}
                  </Text>
                </Pressable>
              </View>
            </View>
          </AppCard>
        ) : null}

        {/* Exercises List */}
        {(session.exercises || []).map((ex, exIdx) => {
          const completedCount = ex.sets.filter((s) => s.status === 'completed').length;
          const totalCount = ex.sets.length;

          return (
            <AppCard key={ex.id} style={styles.exerciseCard}>
              <View style={[styles.exerciseHeader, activeRowStyle()]}>
                <View style={styles.exerciseTitleWrap}>
                  <Text
                    style={[styles.exerciseName, directionalText, { color: colors.text }]}
                  >
                    {exIdx + 1}. {ex.exerciseName}
                  </Text>
                  <View style={[styles.badgeRow, activeRowStyle()]}>
                    {(ex.targetMuscles || []).map((m) => (
                      <View
                        key={m}
                        style={[styles.muscleBadge, { backgroundColor: colors.cardMuted }]}
                      >
                        <Text style={[styles.muscleBadgeText, { color: colors.textMuted }]}>
                          {m}
                        </Text>
                      </View>
                    ))}
                    {ex.catalogId ? (
                      <View
                        style={[styles.catalogBadge, { backgroundColor: colors.accentMuted }]}
                      >
                        <Text style={[styles.catalogBadgeText, { color: colors.accent }]}>
                          Catalog
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <Text style={[styles.exerciseProgressText, { color: colors.accent }]}>
                  {completedCount}/{totalCount}
                </Text>
              </View>

              {/* Sets Table */}
              <View style={styles.setTable}>
                <View style={[styles.setTableHeader, activeRowStyle()]}>
                  <Text style={[styles.colHeader, styles.colSet, { color: colors.textMuted }]}>
                    {t('workouts.setUnit')}
                  </Text>
                  <Text style={[styles.colHeader, styles.colTarget, { color: colors.textMuted }]}>
                    {t('workouts.target')}
                  </Text>
                  <Text style={[styles.colHeader, styles.colInput, { color: colors.textMuted }]}>
                    {t('workouts.weight')} ({t('workouts.kg')})
                  </Text>
                  <Text style={[styles.colHeader, styles.colInput, { color: colors.textMuted }]}>
                    {t('workouts.reps')}
                  </Text>
                  <Text style={[styles.colHeader, styles.colAction, { color: colors.textMuted }]}>
                    ✓
                  </Text>
                </View>

                {ex.sets.map((st) => {
                  const inputs = setInputs[st.id] || {
                    weight: String(st.plannedWeightKg),
                    reps: String(st.plannedReps),
                    rpe: '',
                  };
                  const isCompleted = st.status === 'completed';
                  const isSkipped = st.status === 'skipped';

                  return (
                    <View key={st.id} style={styles.setRowWrapper}>
                      <View
                        style={[
                          styles.setRow,
                          activeRowStyle(),
                          isCompleted && { backgroundColor: `${colors.accent}12` },
                          isSkipped && { opacity: 0.5 },
                        ]}
                      >
                        <Text style={[styles.colSetText, { color: colors.text }]}>
                          {st.setNumber}
                        </Text>

                        <Text style={[styles.colTargetText, { color: colors.textMuted }]}>
                          {st.plannedWeightKg > 0 ? `${st.plannedWeightKg}kg × ` : ''}
                          {st.plannedReps}
                        </Text>

                        <TextInput
                          style={[
                            styles.inputField,
                            {
                              color: colors.text,
                              backgroundColor: colors.cardMuted,
                              borderColor: isCompleted ? colors.accent : colors.border,
                            },
                          ]}
                          keyboardType="decimal-pad"
                          value={inputs.weight}
                          editable={!isCompleted}
                          onChangeText={(val) =>
                            setSetInputs((prev) => ({
                              ...prev,
                              [st.id]: { ...(prev[st.id] || inputs), weight: val },
                            }))
                          }
                        />

                        <TextInput
                          style={[
                            styles.inputField,
                            {
                              color: colors.text,
                              backgroundColor: colors.cardMuted,
                              borderColor: isCompleted ? colors.accent : colors.border,
                            },
                          ]}
                          keyboardType="number-pad"
                          value={inputs.reps}
                          editable={!isCompleted}
                          onChangeText={(val) =>
                            setSetInputs((prev) => ({
                              ...prev,
                              [st.id]: { ...(prev[st.id] || inputs), reps: val },
                            }))
                          }
                        />

                        <View style={[styles.colActionWrap, activeRowStyle()]}>
                          {isCompleted ? (
                            <Ionicons
                              name="checkmark-circle"
                              size={28}
                              color={colors.accent}
                              accessibilityLabel={t('workouts.completed')}
                            />
                          ) : (
                            <>
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={t('workouts.completed')}
                                disabled={submittingSetId !== null}
                                onPress={() => handleCompleteSetAction(st)}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                style={[
                                  styles.checkButton,
                                  {
                                    backgroundColor: colors.accent,
                                    opacity: submittingSetId !== null ? 0.6 : 1,
                                  },
                                ]}
                              >
                                <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                              </Pressable>
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={t('workouts.skipped')}
                                disabled={submittingSetId !== null}
                                onPress={() => handleSkipSetAction(st)}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                style={[
                                  styles.skipButton,
                                  { opacity: submittingSetId !== null ? 0.5 : 1 },
                                ]}
                              >
                                <Ionicons
                                  name="play-skip-forward-outline"
                                  size={18}
                                  color={colors.textMuted}
                                />
                              </Pressable>
                            </>
                          )}
                        </View>
                      </View>
                      {setErrors[st.id] ? (
                        <Text
                          style={[
                            styles.inlineErrorText,
                            directionalText,
                            { color: colors.danger },
                          ]}
                        >
                          {setErrors[st.id]}
                        </Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>

              <AppButton
                title={t('workouts.addSet')}
                icon="add-outline"
                variant="secondary"
                onPress={() => handleAddSetAction(ex.id, ex.sets[ex.sets.length - 1])}
                style={styles.addSetButton}
              />
            </AppCard>
          );
        })}

        {/* Bottom Actions */}
        <View style={styles.bottomActions}>
          <AppButton
            title={t('workouts.finishWorkout')}
            icon="trophy-outline"
            variant="primary"
            onPress={() => setSummaryModalVisible(true)}
          />
          <AppButton
            title={t('workouts.discardSession')}
            icon="trash-outline"
            variant="danger"
            onPress={confirmDiscard}
          />
        </View>
      </ScrollView>

      {/* Workout Summary Modal */}
      <Modal
        visible={summaryModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSummaryModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.summaryModalCard, { backgroundColor: colors.card }]}>
            <View style={[styles.modalHeader, activeRowStyle()]}>
              <Ionicons name="trophy-outline" size={26} color={colors.accent} />
              <Text style={[styles.summaryTitle, directionalText, { color: colors.text }]}>
                {t('workouts.summary')}
              </Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.summaryScroll}>
              <View style={styles.summaryStatsRow}>
                <StatCard
                  label={t('workouts.elapsedTime')}
                  value={`${summary.actualDurationMinutes} ${t('workouts.minutesShort')}`}
                />
                <StatCard
                  label={t('workouts.completedSets')}
                  value={`${summary.totalCompletedSets} / ${summary.totalPlannedSets}`}
                />
              </View>

              <View style={styles.summaryStatsRow}>
                <StatCard
                  label={t('workouts.actualVolume')}
                  value={`${summary.actualRecordedVolumeKg} ${t('common.kg')}`}
                />
                <StatCard
                  label={t('workouts.totalReps')}
                  value={String(summary.totalCompletedReps)}
                />
              </View>

              {summary.hasIncompleteSets ? (
                <View
                  style={[
                    styles.warningCard,
                    { backgroundColor: `${colors.warning}18`, borderColor: colors.warning },
                  ]}
                >
                  <Ionicons name="warning-outline" size={20} color={colors.warning} />
                  <Text
                    style={[styles.warningText, directionalText, { color: colors.warning }]}
                  >
                    {t('workouts.incompleteSetsWarning', {
                      count: summary.totalPendingSets + summary.totalSkippedSets,
                    })}
                  </Text>
                </View>
              ) : null}

              <Text
                style={[styles.notesLabel, directionalText, { color: colors.textMuted }]}
              >
                {t('workouts.sessionNotes')}
              </Text>
              <TextInput
                style={[
                  styles.summaryNotesInput,
                  directionalText,
                  {
                    color: colors.text,
                    backgroundColor: colors.cardMuted,
                    borderColor: colors.border,
                  },
                ]}
                placeholder={t('workouts.notes')}
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
                value={sessionNotes}
                onChangeText={setSessionNotes}
              />
            </ScrollView>

            <View style={styles.summaryModalActions}>
              <AppButton
                title={t('workouts.saveAndFinish')}
                icon="checkmark-outline"
                variant="primary"
                disabled={isFinishing}
                onPress={handleConfirmFinish}
              />
              <AppButton
                title={t('workouts.keepEditing')}
                variant="secondary"
                disabled={isFinishing}
                onPress={() => setSummaryModalVisible(false)}
              />
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardRoot: {
    flex: 1,
  },
  screen: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  headerContainer: {
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  errorBanner: {
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginVertical: spacing.xs,
    gap: spacing.xs,
  },
  errorBannerText: {
    ...typography.caption,
    flex: 1,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    ...typography.h3,
  },
  timerBadgeRow: {
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  timerText: {
    ...typography.body,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  statusText: {
    ...typography.caption,
  },
  restCard: {
    padding: spacing.sm,
    borderWidth: 1.5,
  },
  restRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  restInfo: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  restTextWrap: {},
  restLabel: {
    ...typography.caption,
  },
  restCountdown: {
    ...typography.h3,
    fontVariant: ['tabular-nums'],
  },
  restActions: {
    gap: spacing.xs,
  },
  restActionButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: radius.sm,
    minHeight: 44,
    minWidth: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  restActionText: {
    ...typography.caption,
  },
  exerciseCard: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  exerciseHeader: {
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  exerciseTitleWrap: {
    flex: 1,
  },
  exerciseName: {
    ...typography.body,
    fontWeight: '700',
  },
  badgeRow: {
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: 4,
  },
  muscleBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  muscleBadgeText: {
    ...typography.caption,
    fontSize: 11,
  },
  catalogBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  catalogBadgeText: {
    ...typography.caption,
    fontSize: 11,
  },
  exerciseProgressText: {
    ...typography.body,
    fontWeight: '700',
  },
  setTable: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  setTableHeader: {
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#88888840',
  },
  colHeader: {
    ...typography.caption,
    textAlign: 'center',
  },
  colSet: {
    width: 32,
  },
  colTarget: {
    flex: 1.2,
  },
  colInput: {
    width: 60,
  },
  colAction: {
    width: 64,
  },
  setRowWrapper: {
    width: '100%',
  },
  inlineErrorText: {
    ...typography.caption,
    marginTop: 2,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  setRow: {
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  colSetText: {
    width: 32,
    textAlign: 'center',
    ...typography.body,
    fontWeight: '700',
  },
  colTargetText: {
    flex: 1.2,
    ...typography.caption,
    textAlign: 'center',
  },
  inputField: {
    width: 56,
    height: 40,
    borderWidth: 1,
    borderRadius: radius.sm,
    textAlign: 'center',
    ...typography.body,
    fontWeight: '600',
    marginHorizontal: 2,
  },
  colActionWrap: {
    width: 64,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  checkButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipButton: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addSetButton: {
    marginTop: spacing.xs,
  },
  bottomActions: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: '#00000080',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  summaryModalCard: {
    width: '100%',
    maxHeight: '85%',
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  modalHeader: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  summaryTitle: {
    ...typography.h3,
  },
  summaryScroll: {
    maxHeight: 380,
  },
  summaryStatsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    marginVertical: spacing.sm,
  },
  warningText: {
    flex: 1,
    ...typography.caption,
  },
  notesLabel: {
    ...typography.caption,
    marginTop: spacing.sm,
    marginBottom: 4,
  },
  summaryNotesInput: {
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.sm,
    minHeight: 70,
    ...typography.body,
    textAlignVertical: 'top',
  },
  summaryModalActions: {
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
});
