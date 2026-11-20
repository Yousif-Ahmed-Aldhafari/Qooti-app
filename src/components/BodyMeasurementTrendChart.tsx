/**
 * Interactive Body Measurement Trend Chart Component
 * Phase 5 - Task 5.4
 *
 * Visualizes genuine circumference observations for selectable anatomical sites.
 * Dual-platform HIG & Material Design 3 compliant.
 */

import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ScrollView,
  LayoutChangeEvent,
} from 'react-native';
import Svg, {
  Line,
  Path,
  Circle,
  Text as SvgText,
  G,
} from 'react-native-svg';

import { themeColors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { activeRowStyle, activeTextAlign, activeWritingDirection } from '../utils/rtl';
import {
  MEASUREMENT_FIELDS,
  MeasurementFieldKey,
  formatMeasurement,
} from '../utils/measurements';
import {
  SiteMeasurementAnalyticsSummary,
} from '../utils/biometricAnalytics';
import { MeasurementUnits } from '../models/settings';

export interface BodyMeasurementTrendChartProps {
  summary: SiteMeasurementAnalyticsSummary;
  selectedSite: MeasurementFieldKey;
  onSelectSite: (site: MeasurementFieldKey) => void;
  unit: 'metric' | 'imperial' | MeasurementUnits;
  t: (key: string, params?: Record<string, any>) => string;
}

export function BodyMeasurementTrendChart({
  summary,
  selectedSite,
  onSelectSite,
  unit,
  t,
}: BodyMeasurementTrendChartProps) {
  const colors = themeColors();
  const [containerWidth, setContainerWidth] = useState(340);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const isInch = unit === 'imperial';
  const unitLabel = isInch ? t('progress.unitIn') : t('progress.unitCm');

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - containerWidth) > 5) {
      setContainerWidth(w);
    }
  };

  const chartHeight = 200;
  const paddingLeft = 45;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 30;

  const plotWidth = Math.max(containerWidth - paddingLeft - paddingRight, 100);
  const plotHeight = Math.max(chartHeight - paddingTop - paddingBottom, 70);

  const points = summary.points;

  // Geometry calculations
  const { pointsWithCoords, trendLinePath, domainMin, domainMax } = useMemo(() => {
    if (!points || points.length === 0) {
      return {
        pointsWithCoords: [],
        trendLinePath: '',
        domainMin: 0,
        domainMax: 100,
      };
    }

    const values = points.map((p) => p.valueCm);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const span = rawMax - rawMin;

    const padY = Math.max(span * 0.18, 1.0);
    const domainMin = Math.max(rawMin - padY, 0);
    const domainMax = rawMax + padY;
    const effectiveSpan = Math.max(domainMax - domainMin, 0.5);

    const getY = (v: number) => {
      const ratio = (v - domainMin) / effectiveSpan;
      return paddingTop + (1 - ratio) * plotHeight;
    };

    const firstTime = Date.parse(points[0].date);
    const lastTime = Date.parse(points[points.length - 1].date);
    const totalTimeSpan = lastTime - firstTime;

    const getX = (dateStr: string, idx: number) => {
      if (points.length === 1 || totalTimeSpan <= 0) {
        return paddingLeft + plotWidth / 2;
      }
      const t = Date.parse(dateStr);
      const ratio = (t - firstTime) / totalTimeSpan;
      return paddingLeft + ratio * plotWidth;
    };

    const pointsWithCoords = points.map((p, idx) => ({
      ...p,
      x: getX(p.date, idx),
      y: getY(p.valueCm),
    }));

    let trendLinePath = '';
    if (pointsWithCoords.length > 0) {
      trendLinePath = `M ${pointsWithCoords[0].x} ${pointsWithCoords[0].y}`;
      for (let i = 1; i < pointsWithCoords.length; i++) {
        trendLinePath += ` L ${pointsWithCoords[i].x} ${pointsWithCoords[i].y}`;
      }
    }

    return {
      pointsWithCoords,
      trendLinePath,
      domainMin,
      domainMax,
    };
  }, [points, plotWidth, plotHeight]);

  const directionalText = {
    textAlign: activeTextAlign(),
    writingDirection: activeWritingDirection(),
  } as const;

  const activeSelectedPoint =
    selectedIndex != null && selectedIndex >= 0 && selectedIndex < pointsWithCoords.length
      ? pointsWithCoords[selectedIndex]
      : pointsWithCoords.length > 0
        ? pointsWithCoords[pointsWithCoords.length - 1]
        : null;

  const selectedSiteDef = MEASUREMENT_FIELDS.find((f) => f.key === selectedSite);
  const selectedSiteLabel = selectedSiteDef ? t(selectedSiteDef.labelKey) : selectedSite;

  const accessibilitySummary = useMemo(() => {
    if (!points || points.length === 0) {
      return `${selectedSiteLabel}: ${t('progress.noMeasurementData')}`;
    }
    const first = points[0];
    const last = points[points.length - 1];
    const firstVal = formatMeasurement(first.valueCm, unit, 1);
    const lastVal = formatMeasurement(last.valueCm, unit, 1);
    return `${selectedSiteLabel}: ${points.length} ${t('progress.measurementsCount')}. ${first.date}: ${firstVal} ${unitLabel}, ${last.date}: ${lastVal} ${unitLabel}. ${t('progress.netChange')}: ${summary.netChangeFormatted}.`;
  }, [selectedSiteLabel, points, unit, unitLabel, summary.netChangeFormatted, t]);

  const effectiveSpan = Math.max(domainMax - domainMin, 0.5);

  return (
    <View style={styles.container} onLayout={onLayout}>
      {/* Site Selector Horizontal Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.siteChipScroll, activeRowStyle()]}
      >
        {MEASUREMENT_FIELDS.map((field) => {
          const isSelected = field.key === selectedSite;
          return (
            <Pressable
              key={field.key}
              style={[
                styles.siteChip,
                {
                  backgroundColor: isSelected ? colors.accent : colors.surface,
                  borderColor: isSelected ? colors.accent : colors.border,
                },
              ]}
              onPress={() => {
                setSelectedIndex(null);
                onSelectSite(field.key);
              }}
              accessible={true}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={t(field.labelKey)}
            >
              <Text
                style={[
                  styles.siteChipText,
                  {
                    color: isSelected ? '#FFFFFF' : colors.textSecondary,
                    fontWeight: isSelected ? '700' : '500',
                  },
                ]}
              >
                {t(field.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Selected Observation & Summary Bar */}
      {activeSelectedPoint ? (
        <View style={[styles.tooltipBanner, activeRowStyle(), { backgroundColor: colors.surface }]}>
          <View style={styles.tooltipColumn}>
            <Text style={[styles.tooltipLabel, directionalText, { color: colors.textMuted }]}>
              {activeSelectedPoint.date}
              {activeSelectedPoint.time ? ` • ${activeSelectedPoint.time}` : ''}
            </Text>
            <Text style={[styles.tooltipValue, directionalText, { color: colors.text }]}>
              {`${formatMeasurement(activeSelectedPoint.valueCm, unit, 1)} ${unitLabel}`}
              {activeSelectedPoint.observationCount > 1
                ? ` (${activeSelectedPoint.observationCount} ${t('progress.readings')})`
                : ''}
            </Text>
          </View>

          {summary.hasEnoughDataForTrend ? (
            <View style={styles.summaryColumn}>
              <Text style={[styles.tooltipLabel, directionalText, { color: colors.textMuted }]}>
                {t('progress.netChange')}
              </Text>
              <Text style={[styles.summaryChangeValue, directionalText, { color: colors.accent }]}>
                {summary.netChangeFormatted}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Empty State */}
      {summary.isEmpty ? (
        <View
          style={[styles.emptyContainer, { borderColor: colors.border }]}
          accessible={true}
          accessibilityLabel={accessibilitySummary}
        >
          <Text style={[styles.emptyText, directionalText, { color: colors.textSecondary }]}>
            {t('progress.noSiteMeasurementData', { site: selectedSiteLabel })}
          </Text>
        </View>
      ) : (
        /* SVG Plot */
        <View
          style={styles.svgWrapper}
          accessible={true}
          accessibilityRole="image"
          accessibilityLabel={accessibilitySummary}
        >
          <Svg width={containerWidth} height={chartHeight}>
            {/* Grid lines and Y labels */}
            {[0, 0.5, 1].map((ratio) => {
              const y = paddingTop + ratio * plotHeight;
              const cmVal = domainMax - ratio * effectiveSpan;
              const formatted = formatMeasurement(cmVal, unit, 0);
              return (
                <G key={`grid-meas-${ratio}`}>
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

            {/* Observed Site Circumference Series Line */}
            {trendLinePath ? (
              <Path
                d={trendLinePath}
                stroke={colors.lavender}
                strokeWidth="2.5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}

            {/* Data Points (Circles) */}
            {pointsWithCoords.map((pt, idx) => {
              const isSelected = activeSelectedPoint?.date === pt.date;
              return (
                <G key={`pt-meas-${pt.date}-${idx}`}>
                  <Circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isSelected ? 6 : 4}
                    fill={isSelected ? colors.accent : colors.lavender}
                    stroke={colors.card}
                    strokeWidth="2"
                    onPress={() => setSelectedIndex(idx)}
                  />
                </G>
              );
            })}

            {/* Date Axis X Labels */}
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

          {/* Touch overlay hit areas */}
          {pointsWithCoords.map((pt, idx) => (
            <Pressable
              key={`touch-meas-${pt.date}-${idx}`}
              style={[
                styles.touchTarget,
                {
                  left: pt.x - 20,
                  top: pt.y - 20,
                },
              ]}
              onPress={() => setSelectedIndex(idx)}
              accessible={true}
              accessibilityLabel={`${pt.date}: ${formatMeasurement(pt.valueCm, unit, 1)} ${unitLabel}`}
              accessibilityRole="button"
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: spacing.xs,
  },
  siteChipScroll: {
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
  },
  siteChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    minHeight: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  siteChipText: {
    ...typography.caption,
    fontSize: 12,
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
  summaryColumn: {
    alignItems: 'flex-end',
    gap: 2,
  },
  summaryChangeValue: {
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
    height: 140,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  emptyText: {
    ...typography.body,
    textAlign: 'center',
  },
});
