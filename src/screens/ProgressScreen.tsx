import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AddBodyMeasurementModal } from '../components/AddBodyMeasurementModal';
import { AddBodyWeightModal } from '../components/AddBodyWeightModal';
import { AppCard } from '../components/AppCard';
import { AppHeader } from '../components/AppHeader';
import { BodyMeasurementHistoryList } from '../components/BodyMeasurementHistoryList';
import { ProgressCard } from '../components/ProgressCard';
import { StatCard } from '../components/StatCard';
import { WeightHistoryList } from '../components/WeightHistoryList';
import { useBottomNavScrollHandler } from '../context/BottomNavContext';
import { useLiveLocalDate } from '../hooks/useLiveLocalDate';
import type { Translator } from '../i18n';
import type { BodyMeasurementEntry, BodyWeightEntry } from '../models/biometrics';
import type { Language, MeasurementUnits } from '../models/settings';
import { themeColors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import type { Meal, ProgressEntry, UserProfile } from '../types';
import {
  deriveWaistToHeightRatio,
  deriveWaistToHipRatio,
  formatMeasurement,
  getLatestSiteMeasurements,
  getSiteMeasurementDelta,
  MeasurementFieldKey,
} from '../utils/measurements';
import {
  AnalyticsTimeRange,
  MovingAverageType,
  filterWeightsByTimeRange,
  aggregateDailyWeights,
  computeWeightTrendSeries,
  calculateWeightAnalyticsSummary,
  calculateSiteMeasurementAnalyticsSummary,
} from '../utils/biometricAnalytics';
import { WeightTrendChart } from '../components/WeightTrendChart';
import { BodyMeasurementTrendChart } from '../components/BodyMeasurementTrendChart';
import { buildWeeklyNutritionChartDays, calculateWeeklyNutritionTrend } from '../utils/nutrition';
import { resolveEffectiveNutritionTargets } from '../utils/nutritionTargets';
import { activeRowStyle, activeTextAlign, activeWritingDirection } from '../utils/rtl';
import {
  calculateTargetWeightComparison,
  formatWeight,
  getLatestGenuineWeight,
} from '../utils/weight';

type ProgressScreenProps = {
  t: Translator;
  profile: UserProfile;
  progress: ProgressEntry[];
  meals?: Meal[];
  language?: Language;
  referenceDate?: string;
  clock?: () => Date;
  bodyWeights?: BodyWeightEntry[];
  onRecordWeight?: (entry: BodyWeightEntry) => Promise<void>;
  onUpdateWeight?: (entry: BodyWeightEntry) => Promise<void>;
  onDeleteWeight?: (id: string) => Promise<void>;
  bodyMeasurements?: BodyMeasurementEntry[];
  onRecordMeasurement?: (entry: BodyMeasurementEntry) => Promise<void>;
  onUpdateMeasurement?: (entry: BodyMeasurementEntry) => Promise<void>;
  onDeleteMeasurement?: (id: string) => Promise<void>;
  measurementUnits?: MeasurementUnits;
};

const EMPTY_BODY_WEIGHTS: BodyWeightEntry[] = [];
const EMPTY_BODY_MEASUREMENTS: BodyMeasurementEntry[] = [];

const TIME_RANGES: { key: AnalyticsTimeRange; labelKey: string }[] = [
  { key: '7d', labelKey: 'progress.range7d' },
  { key: '30d', labelKey: 'progress.range30d' },
  { key: '90d', labelKey: 'progress.range90d' },
  { key: '1y', labelKey: 'progress.range1y' },
  { key: 'all', labelKey: 'progress.rangeAll' },
];

const MOVING_AVERAGE_OPTIONS: { key: MovingAverageType; labelKey: string }[] = [
  { key: 'none', labelKey: 'progress.maNone' },
  { key: 'sma', labelKey: 'progress.sma7' },
  { key: 'ema', labelKey: 'progress.ema7' },
];

export function ProgressScreen({
  t,
  profile,
  progress,
  meals,
  language,
  referenceDate,
  clock,
  bodyWeights = EMPTY_BODY_WEIGHTS,
  onRecordWeight,
  onUpdateWeight,
  onDeleteWeight,
  bodyMeasurements = EMPTY_BODY_MEASUREMENTS,
  onRecordMeasurement,
  onUpdateMeasurement,
  onDeleteMeasurement,
  measurementUnits = 'metric',
}: ProgressScreenProps) {
  const colors = themeColors();
  const handleBottomNavScroll = useBottomNavScrollHandler();

  const activeBodyWeights = bodyWeights;
  const activeRecordWeight = onRecordWeight;
  const activeUpdateWeight = onUpdateWeight;
  const activeDeleteWeight = onDeleteWeight;

  const activeBodyMeasurements = bodyMeasurements;
  const activeRecordMeasurement = onRecordMeasurement;
  const activeUpdateMeasurement = onUpdateMeasurement;
  const activeDeleteMeasurement = onDeleteMeasurement;

  const activeUnit: MeasurementUnits = measurementUnits;

  const [isWeightModalVisible, setIsWeightModalVisible] = useState(false);
  const [editingWeight, setEditingWeight] = useState<BodyWeightEntry | null>(null);

  const [isMeasurementModalVisible, setIsMeasurementModalVisible] = useState(false);
  const [editingMeasurement, setEditingMeasurement] = useState<BodyMeasurementEntry | null>(null);

  const [weightTimeRange, setWeightTimeRange] = useState<AnalyticsTimeRange>('30d');
  const [movingAverage, setMovingAverage] = useState<MovingAverageType>('none');
  const [selectedMeasurementSite, setSelectedMeasurementSite] =
    useState<MeasurementFieldKey>('waistCm');
  const [measurementTimeRange, setMeasurementTimeRange] =
    useState<AnalyticsTimeRange>('30d');

  const effectiveTargets = useMemo(() => resolveEffectiveNutritionTargets(profile), [profile]);
  const workoutDays = (progress || []).reduce((sum, entry) => sum + entry.workouts, 0);

  // Live local date handles midnight rollover and foreground AppState resume
  const liveToday = useLiveLocalDate(referenceDate, clock);
  const activeReferenceDate = referenceDate || liveToday;
  const activeLanguage: Language = language || 'en';

  // Build explicit 7-day calendar series ending on activeReferenceDate
  const chartDays = useMemo(
    () => buildWeeklyNutritionChartDays(activeReferenceDate, meals, progress, activeLanguage),
    [activeReferenceDate, meals, progress, activeLanguage]
  );

  const trend = useMemo(
    () => calculateWeeklyNutritionTrend(chartDays),
    [chartDays]
  );

  // Determine current weight from latest genuine weigh-in, fallback to legacy progress row or profile weight
  const latestGenuine = useMemo(
    () => getLatestGenuineWeight(activeBodyWeights),
    [activeBodyWeights]
  );

  const currentWeightKg = useMemo(() => {
    if (latestGenuine && latestGenuine.weightKg >= 10.0) {
      return latestGenuine.weightKg;
    }
    const legacyLatest = progress[progress.length - 1];
    if (legacyLatest && legacyLatest.weightKg >= 10.0) {
      return legacyLatest.weightKg;
    }
    return profile.weightKg;
  }, [latestGenuine, progress, profile.weightKg]);

  const targetComparison = useMemo(
    () => calculateTargetWeightComparison(currentWeightKg, profile.targetWeightKg, activeUnit),
    [currentWeightKg, profile.targetWeightKg, activeUnit]
  );

  const latestWeightHelper = useMemo(() => {
    if (latestGenuine) {
      if (latestGenuine.timePrecision === 'date_only') {
        return `${latestGenuine.date} (${t('progress.timeUnrecorded')})`;
      }
      return `${latestGenuine.date} ${latestGenuine.time}`;
    }
    return t('progress.latestWeight');
  }, [latestGenuine, t]);

  const currentWeightDisplay = useMemo(() => {
    const val = formatWeight(currentWeightKg, activeUnit, 1);
    const unitLabel = activeUnit === 'imperial' ? t('progress.unitLb') : t('progress.unitKg');
    return `${val} ${unitLabel}`;
  }, [currentWeightKg, activeUnit, t]);

  const targetWeightDisplay = useMemo(() => {
    if (!targetComparison.hasTarget || profile.targetWeightKg == null) {
      return `-- ${activeUnit === 'imperial' ? t('progress.unitLb') : t('progress.unitKg')}`;
    }
    const val = formatWeight(profile.targetWeightKg, activeUnit, 1);
    const unitLabel = activeUnit === 'imperial' ? t('progress.unitLb') : t('progress.unitKg');
    return `${val} ${unitLabel}`;
  }, [targetComparison.hasTarget, profile.targetWeightKg, activeUnit, t]);

  const targetWeightHelper = useMemo(() => {
    if (!targetComparison.hasTarget) {
      return t('progress.targetWeight');
    }
    if (targetComparison.isGoalReached) {
      return t('progress.goalReached');
    }
    return targetComparison.deltaFormatted || t('progress.targetWeight');
  }, [targetComparison, t]);

  const siteMeasurements = useMemo(
    () => getLatestSiteMeasurements(activeBodyMeasurements),
    [activeBodyMeasurements]
  );

  const waistData = useMemo(
    () => getSiteMeasurementDelta(activeBodyMeasurements, 'waistCm', activeUnit),
    [activeBodyMeasurements, activeUnit]
  );

  const hipsData = useMemo(
    () => getSiteMeasurementDelta(activeBodyMeasurements, 'hipsCm', activeUnit),
    [activeBodyMeasurements, activeUnit]
  );

  const chestData = useMemo(
    () => getSiteMeasurementDelta(activeBodyMeasurements, 'chestCm', activeUnit),
    [activeBodyMeasurements, activeUnit]
  );

  const filteredWeightEntries = useMemo(
    () => filterWeightsByTimeRange(activeBodyWeights, weightTimeRange, activeReferenceDate),
    [activeBodyWeights, weightTimeRange, activeReferenceDate]
  );

  const dailyWeightPoints = useMemo(
    () => aggregateDailyWeights(filteredWeightEntries, 'final', activeReferenceDate),
    [filteredWeightEntries, activeReferenceDate]
  );

  const weightTrendSeries = useMemo(
    () => computeWeightTrendSeries(dailyWeightPoints),
    [dailyWeightPoints]
  );

  const weightAnalyticsSummary = useMemo(
    () =>
      calculateWeightAnalyticsSummary(
        activeBodyWeights,
        weightTimeRange,
        activeReferenceDate,
        activeUnit,
        profile.targetWeightKg
      ),
    [activeBodyWeights, weightTimeRange, activeReferenceDate, activeUnit, profile.targetWeightKg]
  );

  const siteMeasurementAnalyticsSummary = useMemo(
    () =>
      calculateSiteMeasurementAnalyticsSummary(
        activeBodyMeasurements,
        selectedMeasurementSite,
        measurementTimeRange,
        activeReferenceDate,
        activeUnit
      ),
    [
      activeBodyMeasurements,
      selectedMeasurementSite,
      measurementTimeRange,
      activeReferenceDate,
      activeUnit,
    ]
  );

  const waistToHipRatio = useMemo(
    () =>
      deriveWaistToHipRatio(activeBodyMeasurements, (waistDate, hipsDate) =>
        t('progress.waistAndHipsDisclosure', { waistDate, hipsDate })
      ),
    [activeBodyMeasurements, t]
  );

  const waistToHeightRatio = useMemo(
    () => deriveWaistToHeightRatio(activeBodyMeasurements, profile.heightCm),
    [activeBodyMeasurements, profile.heightCm]
  );

  const hasAnyRecordedMeasurement = useMemo(() => {
    return Object.values(siteMeasurements).some((record) => record != null);
  }, [siteMeasurements]);

  const directionalText = {
    textAlign: activeTextAlign(),
    writingDirection: activeWritingDirection(),
  } as const;

  const chartA11yLabel = trend.isUnavailable
    ? `${t('progress.weeklyTrend')}: ${t('nutrition.mealDataUnavailable') || 'Meal data unavailable'}`
    : `${t('progress.weeklyTrend')}: ${chartDays
        .map((p) =>
          p.hasLogs
            ? `${p.label} ${Math.round(p.calories)} ${t('common.kcal')}`
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

      {/* Stats Row */}
      <View style={[styles.statsRow, activeRowStyle()]}>
        <StatCard
          label={t('progress.averageCalories')}
          value={
            trend.averageCalories != null
              ? `${trend.averageCalories} ${t('common.kcal')}`
              : `-- ${t('common.kcal')}`
          }
        />
        <StatCard label={t('progress.workoutDays')} value={workoutDays} accent={colors.purple} />
      </View>

      {/* Weekly Nutrition Trend Chart */}
      <AppCard>
        <Text style={[styles.sectionTitle, directionalText, { color: colors.text }]}>
          {t('progress.weeklyTrend')}
        </Text>
        <View
          style={[styles.chart, activeRowStyle()]}
          accessible={true}
          accessibilityLabel={chartA11yLabel}
        >
          {chartDays.map((entry) => {
            const isLogged = entry.hasLogs;
            const heightPercent = isLogged
              ? Math.max((entry.calories / trend.maxCalories) * 100, 10)
              : 0;

            return (
              <View key={entry.date} style={styles.barColumn}>
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
        {trend.isUnavailable ? (
          <Text style={[styles.noLogsNote, directionalText, { color: colors.textMuted }]}>
            {t('nutrition.mealDataUnavailable') || 'Meal data unavailable'}
          </Text>
        ) : trend.loggedDaysCount === 0 ? (
          <Text style={[styles.noLogsNote, directionalText, { color: colors.textMuted }]}>
            {t('nutrition.noLogsForWeek') || 'No meals logged this week'}
          </Text>
        ) : null}
      </AppCard>

      {/* Weight & Goals Section */}
      <View style={[styles.progressRow, activeRowStyle()]}>
        <ProgressCard
          title={t('progress.currentWeight') || t('progress.weight')}
          value={currentWeightDisplay}
          helper={latestWeightHelper}
          accent={colors.lavender}
        />
        <ProgressCard
          title={t('progress.targetWeight')}
          value={targetWeightDisplay}
          helper={targetWeightHelper}
          accent={colors.accent}
        />
      </View>

      <View style={[styles.progressRow, activeRowStyle()]}>
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
          accent={colors.purple}
        />
      </View>

      {/* Interactive Weight Trend & Biometric Analytics Section */}
      <AppCard>
        <View style={[styles.analyticsHeaderRow, activeRowStyle()]}>
          <Text style={[styles.sectionTitle, directionalText, { color: colors.text }]}>
            {t('progress.weightAnalytics')}
          </Text>
          <View style={[styles.rangeSelectorRow, activeRowStyle()]}>
            {TIME_RANGES.map((r) => {
              const isSelected = weightTimeRange === r.key;
              return (
                <Pressable
                  key={`weight-range-${r.key}`}
                  style={[
                    styles.rangeChip,
                    {
                      backgroundColor: isSelected ? colors.accent : colors.surface,
                      borderColor: isSelected ? colors.accent : colors.border,
                    },
                  ]}
                  onPress={() => setWeightTimeRange(r.key)}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={t(r.labelKey)}
                >
                  <Text
                    style={[
                      styles.rangeChipText,
                      {
                        color: isSelected ? '#FFFFFF' : colors.textSecondary,
                        fontWeight: isSelected ? '700' : '500',
                      },
                    ]}
                  >
                    {t(r.labelKey)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Weight Analytics Metrics Summary Row */}
        {!weightAnalyticsSummary.isEmpty && weightAnalyticsSummary.hasEnoughDataForTrend ? (
          <View style={[styles.analyticsMetricsRow, activeRowStyle()]}>
            <View style={[styles.analyticsMetricPill, { backgroundColor: colors.surface }]}>
              <Text style={[styles.metricLabel, directionalText, { color: colors.textMuted }]}>
                {t('progress.netChange')}
              </Text>
              <Text style={[styles.metricValue, directionalText, { color: colors.text }]}>
                {weightAnalyticsSummary.netChangeFormatted}
              </Text>
            </View>

            {weightAnalyticsSummary.weeklyRateFormatted ? (
              <View style={[styles.analyticsMetricPill, { backgroundColor: colors.surface }]}>
                <Text style={[styles.metricLabel, directionalText, { color: colors.textMuted }]}>
                  {t('progress.weeklyRate')}
                </Text>
                <Text style={[styles.metricValue, directionalText, { color: colors.purple }]}>
                  {weightAnalyticsSummary.weeklyRateFormatted}
                </Text>
              </View>
            ) : null}

            {weightAnalyticsSummary.isGoalReached != null ? (
              <View style={[styles.analyticsMetricPill, { backgroundColor: colors.surface }]}>
                <Text style={[styles.metricLabel, directionalText, { color: colors.textMuted }]}>
                  {t('progress.targetWeight')}
                </Text>
                <Text
                  style={[
                    styles.metricValue,
                    directionalText,
                    { color: weightAnalyticsSummary.isGoalReached ? colors.accent : colors.lavender },
                  ]}
                >
                  {weightAnalyticsSummary.isGoalReached
                    ? t('progress.goalReached')
                    : targetComparison.deltaFormatted || '--'}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Moving Average Overlay Toggles */}
        {!weightAnalyticsSummary.isEmpty ? (
          <View style={[styles.maToggleRow, activeRowStyle()]}>
            <Text style={[styles.maToggleLabel, directionalText, { color: colors.textSecondary }]}>
              {t('progress.movingAverage')}:
            </Text>
            <View style={[styles.maOptionsGroup, activeRowStyle()]}>
              {MOVING_AVERAGE_OPTIONS.map((opt) => {
                const isSelected = movingAverage === opt.key;
                return (
                  <Pressable
                    key={`ma-opt-${opt.key}`}
                    style={[
                      styles.maChip,
                      {
                        backgroundColor: isSelected ? colors.purple : colors.surface,
                        borderColor: isSelected ? colors.purple : colors.border,
                      },
                    ]}
                    onPress={() => setMovingAverage(opt.key)}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={t(opt.labelKey)}
                  >
                    <Text
                      style={[
                        styles.maChipText,
                        {
                          color: isSelected ? '#FFFFFF' : colors.textSecondary,
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                    >
                      {t(opt.labelKey)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* Interactive Weight Chart */}
        <WeightTrendChart
          dailyPoints={dailyWeightPoints}
          trendSeries={weightTrendSeries}
          unit={activeUnit}
          movingAverage={movingAverage}
          goalWeightKg={profile.targetWeightKg}
          t={t}
        />
      </AppCard>

      {/* Circumference & Body Measurement Trend Section */}
      <AppCard>
        <View style={[styles.analyticsHeaderRow, activeRowStyle()]}>
          <Text style={[styles.sectionTitle, directionalText, { color: colors.text }]}>
            {t('progress.measurementTrend')}
          </Text>
          <View style={[styles.rangeSelectorRow, activeRowStyle()]}>
            {TIME_RANGES.map((r) => {
              const isSelected = measurementTimeRange === r.key;
              return (
                <Pressable
                  key={`meas-range-${r.key}`}
                  style={[
                    styles.rangeChip,
                    {
                      backgroundColor: isSelected ? colors.accent : colors.surface,
                      borderColor: isSelected ? colors.accent : colors.border,
                    },
                  ]}
                  onPress={() => setMeasurementTimeRange(r.key)}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={t(r.labelKey)}
                >
                  <Text
                    style={[
                      styles.rangeChipText,
                      {
                        color: isSelected ? '#FFFFFF' : colors.textSecondary,
                        fontWeight: isSelected ? '700' : '500',
                      },
                    ]}
                  >
                    {t(r.labelKey)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <BodyMeasurementTrendChart
          summary={siteMeasurementAnalyticsSummary}
          selectedSite={selectedMeasurementSite}
          onSelectSite={(site) => setSelectedMeasurementSite(site)}
          unit={activeUnit}
          t={t}
        />
      </AppCard>

      {/* Weight History Section */}
      <AppCard>
        <View style={[styles.weightHeaderRow, activeRowStyle()]}>
          <View style={styles.weightHeaderTitleGroup}>
            <Text style={[styles.sectionTitle, directionalText, { color: colors.text }]}>
              {t('progress.weightHistory')}
            </Text>
            {activeBodyWeights.length > 0 ? (
              <Text style={[styles.historyCountText, directionalText, { color: colors.textMuted }]}>
                {t('progress.historyCount', { count: activeBodyWeights.length })}
              </Text>
            ) : null}
          </View>

          <Pressable
            style={[styles.addWeightButton, { backgroundColor: colors.accent }]}
            onPress={() => {
              setEditingWeight(null);
              setIsWeightModalVisible(true);
            }}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t('progress.addWeight')}
            accessibilityHint={t('progress.logWeight')}
          >
            <Text style={[styles.addWeightButtonText, { color: colors.background }]}>
              + {t('progress.addWeight')}
            </Text>
          </Pressable>
        </View>

        <WeightHistoryList
          weights={activeBodyWeights}
          unit={activeUnit}
          t={t}
          onEditEntry={(entry) => {
            setEditingWeight(entry);
            setIsWeightModalVisible(true);
          }}
          onDeleteEntry={
            activeDeleteWeight
              ? async (id) => {
                  await activeDeleteWeight(id);
                }
              : undefined
          }
        />
      </AppCard>

      <Text style={[styles.helper, directionalText, { color: colors.textMuted }]}>
        {t('progress.daysTracked', { count: progress.length })}
      </Text>

      {/* Add / Edit Body Weight Modal */}
      <AddBodyWeightModal
        visible={isWeightModalVisible}
        onClose={() => {
          setIsWeightModalVisible(false);
          setEditingWeight(null);
        }}
        onSave={async (entry) => {
          if (editingWeight && activeUpdateWeight) {
            await activeUpdateWeight(entry);
          } else if (activeRecordWeight) {
            await activeRecordWeight(entry);
          }
        }}
        onDelete={
          activeDeleteWeight
            ? async (id) => {
                await activeDeleteWeight(id);
              }
            : undefined
        }
        initialEntry={editingWeight}
        defaultUnit={activeUnit}
        t={t}
        referenceDate={activeReferenceDate}
      />

      {/* Latest Measurements Summary (if at least one site measurement exists) */}
      {hasAnyRecordedMeasurement ? (
        <View style={styles.measurementsSummarySection}>
          <Text
            style={[
              styles.sectionTitle,
              directionalText,
              { color: colors.text, marginBottom: spacing.sm },
            ]}
          >
            {t('progress.latestMeasurements')}
          </Text>

          <View style={[styles.progressRow, activeRowStyle()]}>
            {siteMeasurements.waistCm ? (
              <ProgressCard
                title={t('progress.waist')}
                value={`${formatMeasurement(siteMeasurements.waistCm.valueCm, activeUnit, 1)} ${activeUnit === 'imperial' ? t('progress.unitIn') : t('progress.unitCm')}`}
                helper={
                  waistData.hasDelta
                    ? waistData.isUnchanged
                      ? waistData.currentRecord?.isStale
                        ? `${t('progress.noChange')} • ${waistData.currentRecord.date}`
                        : t('progress.noChange')
                      : waistData.currentRecord?.isStale
                        ? `${waistData.deltaFormatted} • ${waistData.currentRecord.date}`
                        : `${waistData.deltaFormatted}`
                    : `${siteMeasurements.waistCm.date} ${siteMeasurements.waistCm.time}`
                }
                accent={colors.purple}
              />
            ) : null}

            {siteMeasurements.hipsCm ? (
              <ProgressCard
                title={t('progress.hips')}
                value={`${formatMeasurement(siteMeasurements.hipsCm.valueCm, activeUnit, 1)} ${activeUnit === 'imperial' ? t('progress.unitIn') : t('progress.unitCm')}`}
                helper={
                  hipsData.hasDelta
                    ? hipsData.isUnchanged
                      ? hipsData.currentRecord?.isStale
                        ? `${t('progress.noChange')} • ${hipsData.currentRecord.date}`
                        : t('progress.noChange')
                      : hipsData.currentRecord?.isStale
                        ? `${hipsData.deltaFormatted} • ${hipsData.currentRecord.date}`
                        : `${hipsData.deltaFormatted}`
                    : `${siteMeasurements.hipsCm.date} ${siteMeasurements.hipsCm.time}`
                }
                accent={colors.accent}
              />
            ) : null}

            {siteMeasurements.chestCm ? (
              <ProgressCard
                title={t('progress.chest')}
                value={`${formatMeasurement(siteMeasurements.chestCm.valueCm, activeUnit, 1)} ${activeUnit === 'imperial' ? t('progress.unitIn') : t('progress.unitCm')}`}
                helper={
                  chestData.hasDelta
                    ? chestData.isUnchanged
                      ? chestData.currentRecord?.isStale
                        ? `${t('progress.noChange')} • ${chestData.currentRecord.date}`
                        : t('progress.noChange')
                      : chestData.currentRecord?.isStale
                        ? `${chestData.deltaFormatted} • ${chestData.currentRecord.date}`
                        : `${chestData.deltaFormatted}`
                    : `${siteMeasurements.chestCm.date} ${siteMeasurements.chestCm.time}`
                }
                accent={colors.lavender}
              />
            ) : null}
          </View>

          {/* Body Ratios Row */}
          {waistToHipRatio.isValid || waistToHeightRatio.isValid ? (
            <View style={[styles.progressRow, activeRowStyle(), { marginTop: spacing.sm }]}>
              {waistToHipRatio.isValid ? (
                <ProgressCard
                  title={t('progress.waistToHipRatio')}
                  value={waistToHipRatio.ratioFormatted || '--'}
                  helper={
                    waistToHipRatio.disclosedDateText
                      ? `${t('progress.ratios')} • ${waistToHipRatio.disclosedDateText}`
                      : t('progress.ratios')
                  }
                  accent={colors.accent}
                />
              ) : null}

              {waistToHeightRatio.isValid ? (
                <ProgressCard
                  title={t('progress.waistToHeightRatio')}
                  value={waistToHeightRatio.ratioFormatted || '--'}
                  helper={
                    waistToHeightRatio.disclosedDateText
                      ? `${t('progress.ratios')} • ${waistToHeightRatio.disclosedDateText}`
                      : t('progress.ratios')
                  }
                  accent={colors.lavender}
                />
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Body Measurement History Section */}
      <AppCard>
        <View style={[styles.weightHeaderRow, activeRowStyle()]}>
          <View style={styles.weightHeaderTitleGroup}>
            <Text style={[styles.sectionTitle, directionalText, { color: colors.text }]}>
              {t('progress.measurementHistory')}
            </Text>
            {activeBodyMeasurements.length > 0 ? (
              <Text style={[styles.historyCountText, directionalText, { color: colors.textMuted }]}>
                {t('progress.measurementHistoryCount', { count: activeBodyMeasurements.length })}
              </Text>
            ) : null}
          </View>

          <Pressable
            style={[styles.addWeightButton, { backgroundColor: colors.accent }]}
            onPress={() => {
              setEditingMeasurement(null);
              setIsMeasurementModalVisible(true);
            }}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t('progress.addMeasurements')}
            accessibilityHint={t('progress.logMeasurements')}
          >
            <Text style={[styles.addWeightButtonText, { color: colors.background }]}>
              + {t('progress.logMeasurements')}
            </Text>
          </Pressable>
        </View>

        <BodyMeasurementHistoryList
          measurements={activeBodyMeasurements}
          unit={activeUnit}
          t={t}
          onEditEntry={(entry) => {
            setEditingMeasurement(entry);
            setIsMeasurementModalVisible(true);
          }}
          onDeleteEntry={
            activeDeleteMeasurement
              ? async (id) => {
                  await activeDeleteMeasurement(id);
                }
              : undefined
          }
        />
      </AppCard>

      {/* Add / Edit Body Measurement Modal */}
      <AddBodyMeasurementModal
        visible={isMeasurementModalVisible}
        onClose={() => {
          setIsMeasurementModalVisible(false);
          setEditingMeasurement(null);
        }}
        onSave={async (entry) => {
          if (editingMeasurement && activeUpdateMeasurement) {
            await activeUpdateMeasurement(entry);
          } else if (activeRecordMeasurement) {
            await activeRecordMeasurement(entry);
          }
        }}
        onDelete={
          activeDeleteMeasurement
            ? async (id) => {
                await activeDeleteMeasurement(id);
              }
            : undefined
        }
        initialEntry={editingMeasurement}
        defaultUnit={activeUnit}
        t={t}
        referenceDate={activeReferenceDate}
      />
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
  weightHeaderRow: {
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  weightHeaderTitleGroup: {
    flex: 1,
    gap: 2,
  },
  historyCountText: {
    ...typography.caption,
  },
  addWeightButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    minHeight: 48,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addWeightButtonText: {
    ...typography.body,
    fontWeight: '700',
    fontSize: 14,
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
  measurementsSummarySection: {
    gap: spacing.xs,
  },
  analyticsHeaderRow: {
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  rangeSelectorRow: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  rangeChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    minHeight: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rangeChipText: {
    ...typography.caption,
    fontSize: 11,
  },
  analyticsMetricsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
    marginBottom: spacing.xs,
  },
  analyticsMetricPill: {
    flex: 1,
    minWidth: 90,
    padding: spacing.xs,
    borderRadius: radius.md,
    alignItems: 'center',
    gap: 2,
  },
  metricLabel: {
    ...typography.caption,
    fontSize: 10,
  },
  metricValue: {
    ...typography.caption,
    fontWeight: '700',
    fontSize: 13,
  },
  maToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: spacing.xs,
    flexWrap: 'wrap',
  },
  maToggleLabel: {
    ...typography.caption,
    fontSize: 11,
  },
  maOptionsGroup: {
    flexDirection: 'row',
    gap: 4,
  },
  maChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    minHeight: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  maChipText: {
    ...typography.caption,
    fontSize: 11,
  },
  helper: {
    ...typography.caption,
  },
});
