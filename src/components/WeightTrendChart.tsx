/**
 * Interactive Weight Trend Chart Component
 * Phase 5 - Task 5.4
 *
 * Visualizes genuine weight observations, optional 7-day SMA/EMA trend overlays,
 * and goal-weight reference line with interactive touch inspection.
 * Dual-platform HIG & Material Design 3 compliant.
 */

import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  LayoutChangeEvent,
} from 'react-native';
import Svg, {
  Line,
  Path,
  Circle,
  Text as SvgText,
  Defs,
  LinearGradient,
  Stop,
  G,
} from 'react-native-svg';

import { themeColors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { activeRowStyle, activeTextAlign, activeWritingDirection } from '../utils/rtl';
import { formatWeight } from '../utils/weight';
import {
  TrendSeriesPoint,
  MovingAverageType,
  DailyWeightPoint,
} from '../utils/biometricAnalytics';
import { MeasurementUnits } from '../models/settings';

export interface WeightTrendChartProps {
  dailyPoints: DailyWeightPoint[];
  trendSeries: TrendSeriesPoint[];
  unit: 'metric' | 'imperial' | MeasurementUnits;
  movingAverage: MovingAverageType;
  goalWeightKg?: number | null;
  t: (key: string, params?: Record<string, any>) => string;
}

export function WeightTrendChart({
  dailyPoints,
  trendSeries,
  unit,
  movingAverage,
  goalWeightKg,
  t,
}: WeightTrendChartProps) {
  const colors = themeColors();
  const [containerWidth, setContainerWidth] = useState(340);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const isImperial = unit === 'imperial';
  const unitLabel = isImperial ? t('progress.unitLb') : t('progress.unitKg');

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - containerWidth) > 5) {
      setContainerWidth(w);
    }
  };

  const chartHeight = 220;
  const paddingLeft = 45;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 30;

  const plotWidth = Math.max(containerWidth - paddingLeft - paddingRight, 100);
  const plotHeight = Math.max(chartHeight - paddingTop - paddingBottom, 80);

  // Geometry calculations
  const { pointsWithCoords, smaPath, emaPath, trendLinePath, domainMin, domainMax } =
    useMemo(() => {
      if (!trendSeries || trendSeries.length === 0) {
        return {
          pointsWithCoords: [],
          smaPath: '',
          emaPath: '',
          trendLinePath: '',
          domainMin: 0,
          domainMax: 100,
        };
      }

      // Collect values for vertical scaling
      const values: number[] = [];
      for (const p of trendSeries) {
        values.push(p.weightKg);
        if (movingAverage === 'sma' && p.sma7Kg != null) values.push(p.sma7Kg);
        if (movingAverage === 'ema' && p.ema7Kg != null) values.push(p.ema7Kg);
      }
      if (goalWeightKg != null && goalWeightKg > 0) {
        values.push(goalWeightKg);
      }

      const rawMin = Math.min(...values);
      const rawMax = Math.max(...values);
      const span = rawMax - rawMin;

      // Provide reasonable vertical padding so charts don't over-magnify tiny fluctuations
      const padY = Math.max(span * 0.18, 1.2);
      const domainMin = Math.max(rawMin - padY, 0);
      const domainMax = rawMax + padY;
      const effectiveSpan = Math.max(domainMax - domainMin, 0.5);

      const getY = (w: number) => {
        const ratio = (w - domainMin) / effectiveSpan;
        return paddingTop + (1 - ratio) * plotHeight;
      };

      // Calculate X coordinates
      const firstTime = Date.parse(trendSeries[0].date);
      const lastTime = Date.parse(trendSeries[trendSeries.length - 1].date);
      const totalTimeSpan = lastTime - firstTime;

      const getX = (dateStr: string, idx: number) => {
        if (trendSeries.length === 1 || totalTimeSpan <= 0) {
          return paddingLeft + plotWidth / 2;
        }
        const t = Date.parse(dateStr);
        const ratio = (t - firstTime) / totalTimeSpan;
        return paddingLeft + ratio * plotWidth;
      };

      const pointsWithCoords = trendSeries.map((p, idx) => {
        const x = getX(p.date, idx);
        const y = getY(p.weightKg);
        const smaY = p.sma7Kg != null ? getY(p.sma7Kg) : undefined;
        const emaY = p.ema7Kg != null ? getY(p.ema7Kg) : undefined;
        return {
          ...p,
          x,
          y,
          smaY,
          emaY,
          dailyPoint: dailyPoints[idx],
        };
      });

      // Construct SVG line paths
      let trendLinePath = '';
      if (pointsWithCoords.length > 0) {
        trendLinePath = `M ${pointsWithCoords[0].x} ${pointsWithCoords[0].y}`;
        for (let i = 1; i < pointsWithCoords.length; i++) {
          trendLinePath += ` L ${pointsWithCoords[i].x} ${pointsWithCoords[i].y}`;
        }
      }

      let smaPath = '';
      if (movingAverage === 'sma' && pointsWithCoords.length > 0) {
        let firstSma = true;
        for (const pt of pointsWithCoords) {
          if (pt.smaY != null) {
            if (firstSma) {
              smaPath += `M ${pt.x} ${pt.smaY}`;
              firstSma = false;
            } else {
              smaPath += ` L ${pt.x} ${pt.smaY}`;
            }
          }
        }
      }

      let emaPath = '';
      if (movingAverage === 'ema' && pointsWithCoords.length > 0) {
        let firstEma = true;
        for (const pt of pointsWithCoords) {
          if (pt.emaY != null) {
            if (firstEma) {
              emaPath += `M ${pt.x} ${pt.emaY}`;
              firstEma = false;
            } else {
              emaPath += ` L ${pt.x} ${pt.emaY}`;
            }
          }
        }
      }

      return {
        pointsWithCoords,
        smaPath,
        emaPath,
        trendLinePath,
        domainMin,
        domainMax,
      };
    }, [trendSeries, dailyPoints, movingAverage, goalWeightKg, plotWidth, plotHeight]);

  const directionalText = {
    textAlign: activeTextAlign(),
    writingDirection: activeWritingDirection(),
  } as const;

  // Selected observation data
  const activeSelectedPoint =
    selectedIndex != null && selectedIndex >= 0 && selectedIndex < pointsWithCoords.length
      ? pointsWithCoords[selectedIndex]
      : pointsWithCoords.length > 0
        ? pointsWithCoords[pointsWithCoords.length - 1]
        : null;

  // Accessibility Summary
  const accessibilitySummary = useMemo(() => {
    if (!trendSeries || trendSeries.length === 0) {
      return `${t('progress.weightTrend')}: ${t('progress.noWeightData')}`;
    }
    const first = trendSeries[0];
    const last = trendSeries[trendSeries.length - 1];
    const firstVal = formatWeight(first.weightKg, unit, 1);
    const lastVal = formatWeight(last.weightKg, unit, 1);
    return `${t('progress.weightTrend')}: ${trendSeries.length} ${t('progress.measurementsCount')}. ${first.date}: ${firstVal} ${unitLabel}, ${last.date}: ${lastVal} ${unitLabel}.`;
  }, [trendSeries, unit, unitLabel, t]);

  if (!trendSeries || trendSeries.length === 0) {
    return (
      <View
        style={[styles.emptyContainer, { borderColor: colors.border }]}
        accessible={true}
        accessibilityLabel={accessibilitySummary}
      >
        <Text style={[styles.emptyText, directionalText, { color: colors.textSecondary }]}>
          {t('progress.noWeightData')}
        </Text>
      </View>
    );
  }

  // Goal line Y
  const effectiveSpan = Math.max(domainMax - domainMin, 0.5);
  const goalY =
    goalWeightKg != null && goalWeightKg > 0
      ? paddingTop + (1 - (goalWeightKg - domainMin) / effectiveSpan) * plotHeight
      : null;

  return (
    <View
      style={styles.container}
      onLayout={onLayout}
      accessible={true}
      accessibilityRole="image"
      accessibilityLabel={accessibilitySummary}
    >
      {/* Active Selected Observation Tooltip Banner */}
      {activeSelectedPoint ? (
        <View style={[styles.tooltipBanner, activeRowStyle(), { backgroundColor: colors.surface }]}>
          <View style={styles.tooltipColumn}>
            <Text style={[styles.tooltipLabel, directionalText, { color: colors.textMuted }]}>
              {activeSelectedPoint.date}
              {activeSelectedPoint.dailyPoint?.latestTime
                ? ` • ${activeSelectedPoint.dailyPoint.latestTime}`
                : activeSelectedPoint.dailyPoint?.isLegacyDateOnly
                  ? ` • ${t('progress.legacyDateOnly')}`
                  : ''}
            </Text>
            <Text style={[styles.tooltipValue, directionalText, { color: colors.text }]}>
              {`${formatWeight(activeSelectedPoint.weightKg, unit, 1)} ${unitLabel}`}
              {activeSelectedPoint.dailyPoint?.observationCount &&
              activeSelectedPoint.dailyPoint.observationCount > 1
                ? ` (${activeSelectedPoint.dailyPoint.observationCount} ${t('progress.readings')})`
                : ''}
            </Text>
          </View>

          {movingAverage !== 'none' ? (
            <View style={styles.tooltipAverageColumn}>
              <Text style={[styles.tooltipLabel, directionalText, { color: colors.accent }]}>
                {movingAverage === 'sma' ? t('progress.sma7') : t('progress.ema7')}
              </Text>
              <Text style={[styles.tooltipAverageValue, directionalText, { color: colors.accent }]}>
                {movingAverage === 'sma' && activeSelectedPoint.sma7Kg != null
                  ? `${formatWeight(activeSelectedPoint.sma7Kg, unit, 1)} ${unitLabel}`
                  : movingAverage === 'ema' && activeSelectedPoint.ema7Kg != null
                    ? `${formatWeight(activeSelectedPoint.ema7Kg, unit, 1)} ${unitLabel}`
                    : '--'}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* SVG Plot */}
      <View style={styles.svgWrapper}>
        <Svg width={containerWidth} height={chartHeight}>
          <Defs>
            <LinearGradient id="weightAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.purple} stopOpacity="0.25" />
              <Stop offset="1" stopColor={colors.purple} stopOpacity="0.0" />
            </LinearGradient>
          </Defs>

          {/* Grid lines and Y labels */}
          {[0, 0.5, 1].map((ratio) => {
            const y = paddingTop + ratio * plotHeight;
            const wVal = domainMax - ratio * effectiveSpan;
            const formatted = formatWeight(wVal, unit, 0);
            return (
              <G key={`grid-${ratio}`}>
                <Line
                  x1={paddingLeft}
                  y1={y}
                  x2={paddingLeft + plotWidth}
                  y2={y}
                  stroke={colors.border}
                  strokeWidth="1"
                  strokeDasharray="4 4"
                  opacity={0.4}
                />
                <SvgText
                  x={paddingLeft - 8}
                  y={y + 4}
                  fill={colors.textSecondary}
                  fontSize="10"
                  textAnchor="end"
                >
                  {formatted}
                </SvgText>
              </G>
            );
          })}

          {/* Goal weight reference line */}
          {goalY != null && goalY >= paddingTop && goalY <= paddingTop + plotHeight ? (
            <G>
              <Line
                x1={paddingLeft}
                y1={goalY}
                x2={paddingLeft + plotWidth}
                y2={goalY}
                stroke={colors.accent}
                strokeWidth="1.5"
                strokeDasharray="6 4"
              />
              <SvgText
                x={paddingLeft + plotWidth - 4}
                y={goalY - 6}
                fill={colors.accent}
                fontSize="10"
                fontWeight="bold"
                textAnchor="end"
              >
                {t('progress.goal')}
              </SvgText>
            </G>
          ) : null}

          {/* Observed Weight Series Line */}
          {trendLinePath ? (
            <Path
              d={trendLinePath}
              stroke={colors.purple}
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}

          {/* Moving Average Line (SMA or EMA) */}
          {movingAverage === 'sma' && smaPath ? (
            <Path
              d={smaPath}
              stroke={colors.accent}
              strokeWidth="2"
              strokeDasharray="5 3"
              fill="none"
              strokeLinecap="round"
            />
          ) : null}

          {movingAverage === 'ema' && emaPath ? (
            <Path
              d={emaPath}
              stroke={colors.accent}
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
            />
          ) : null}

          {/* Data Points (Circles) */}
          {pointsWithCoords.map((pt, idx) => {
            const isSelected = activeSelectedPoint?.date === pt.date;
            return (
              <G key={`pt-${pt.date}-${idx}`}>
                <Circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isSelected ? 6 : 4}
                  fill={isSelected ? colors.accent : colors.purple}
                  stroke={colors.card}
                  strokeWidth="2"
                  onPress={() => setSelectedIndex(idx)}
                />
              </G>
            );
          })}

          {/* Date Axis X Labels (first and last) */}
          {pointsWithCoords.length > 0 ? (
            <G>
              <SvgText
                x={paddingLeft}
                y={chartHeight - 8}
                fill={colors.textSecondary}
                fontSize="10"
                textAnchor="start"
              >
                {pointsWithCoords[0].date}
              </SvgText>
              {pointsWithCoords.length > 1 ? (
                <SvgText
                  x={paddingLeft + plotWidth}
                  y={chartHeight - 8}
                  fill={colors.textSecondary}
                  fontSize="10"
                  textAnchor="end"
                >
                  {pointsWithCoords[pointsWithCoords.length - 1].date}
                </SvgText>
              ) : null}
            </G>
          ) : null}
        </Svg>

        {/* Touch overlay hit areas for exact touch inspection on mobile */}
        {pointsWithCoords.map((pt, idx) => (
          <Pressable
            key={`touch-${pt.date}-${idx}`}
            style={[
              styles.touchTarget,
              {
                left: pt.x - 20,
                top: pt.y - 20,
              },
            ]}
            onPress={() => setSelectedIndex(idx)}
            accessible={true}
            accessibilityLabel={`${pt.date}: ${formatWeight(pt.weightKg, unit, 1)} ${unitLabel}`}
            accessibilityRole="button"
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: spacing.xs,
  },
  tooltipBanner: {
    padding: spacing.sm,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tooltipColumn: {
    gap: 2,
  },
  tooltipLabel: {
    ...typography.caption,
    fontSize: 11,
  },
  tooltipValue: {
    ...typography.body,
    fontWeight: '700',
    fontSize: 15,
  },
  tooltipAverageColumn: {
    alignItems: 'flex-end',
    gap: 2,
  },
  tooltipAverageValue: {
    ...typography.body,
    fontWeight: '700',
    fontSize: 14,
  },
  svgWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  touchTarget: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    zIndex: 10,
  },
  emptyContainer: {
    height: 160,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  emptyText: {
    ...typography.body,
  },
});
