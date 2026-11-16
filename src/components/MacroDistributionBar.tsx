import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { themeColors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import type { MacroDistribution } from '../utils/nutrition';
import { activeRowStyle, activeTextAlign, activeWritingDirection } from '../utils/rtl';

export interface MacroDistributionBarProps {
  distribution: MacroDistribution;
  t: (key: string, values?: Record<string, string | number>) => string;
  style?: StyleProp<ViewStyle>;
  showFootnote?: boolean;
}

export function MacroDistributionBar({
  distribution,
  t,
  style,
  showFootnote = true,
}: MacroDistributionBarProps) {
  const colors = themeColors();
  const directionalText = {
    textAlign: activeTextAlign(),
    writingDirection: activeWritingDirection(),
  } as const;

  const hasData = distribution.totalMacroKcal > 0;

  // Colors for each macronutrient
  const proteinColor = colors.purple;
  const carbsColor = colors.primary;
  const fatsColor = colors.orange;

  const accessibilityLabel = hasData
    ? `${t('nutrition.macroDistribution') || 'Macronutrient distribution'}: ${t('common.protein') || 'Protein'} ${distribution.proteinPct}%, ${t('common.carbs') || 'Carbs'} ${distribution.carbsPct}%, ${t('common.fats') || 'Fats'} ${distribution.fatsPct}%.`
    : (t('nutrition.noMacroData') || 'No macronutrient intake recorded');

  return (
    <View
      style={[styles.container, style]}
      accessible={true}
      accessibilityLabel={accessibilityLabel}
    >
      <View style={[styles.headerRow, activeRowStyle()]}>
        <Text style={[styles.title, directionalText, { color: colors.text }]}>
          {t('nutrition.macroDistribution') || 'Macronutrient distribution'}
        </Text>
        {hasData && (
          <Text style={[styles.totalKcal, directionalText, { color: colors.textMuted }]}>
            {`${Math.round(distribution.totalMacroKcal)} ${t('common.kcal') || 'kcal'}`}
          </Text>
        )}
      </View>

      {/* Segmented Progress Bar */}
      <View style={[styles.barTrack, activeRowStyle(), { backgroundColor: colors.cardMuted }]}>
        {hasData ? (
          <>
            {distribution.proteinPct > 0 && (
              <View
                style={[
                  styles.barSegment,
                  { width: `${distribution.proteinPct}%`, backgroundColor: proteinColor },
                ]}
              />
            )}
            {distribution.carbsPct > 0 && (
              <View
                style={[
                  styles.barSegment,
                  { width: `${distribution.carbsPct}%`, backgroundColor: carbsColor },
                ]}
              />
            )}
            {distribution.fatsPct > 0 && (
              <View
                style={[
                  styles.barSegment,
                  { width: `${distribution.fatsPct}%`, backgroundColor: fatsColor },
                ]}
              />
            )}
          </>
        ) : (
          <View style={[styles.emptySegment, { backgroundColor: colors.cardMuted }]} />
        )}
      </View>

      {/* Legend & Gram / Energy Breakdown */}
      {hasData ? (
        <View style={[styles.legendRow, activeRowStyle()]}>
          <View style={[styles.legendItem, activeRowStyle()]}>
            <View style={[styles.legendDot, { backgroundColor: proteinColor }]} />
            <Text style={[styles.legendLabel, directionalText, { color: colors.textSecondary }]}>
              {`${t('common.protein') || 'Protein'} ${distribution.proteinPct}%`}
            </Text>
            <Text style={[styles.legendSub, directionalText, { color: colors.textMuted }]}>
              {`(${Math.round(distribution.proteinKcal)} ${t('common.kcal') || 'kcal'})`}
            </Text>
          </View>

          <View style={[styles.legendItem, activeRowStyle()]}>
            <View style={[styles.legendDot, { backgroundColor: carbsColor }]} />
            <Text style={[styles.legendLabel, directionalText, { color: colors.textSecondary }]}>
              {`${t('common.carbs') || 'Carbs'} ${distribution.carbsPct}%`}
            </Text>
            <Text style={[styles.legendSub, directionalText, { color: colors.textMuted }]}>
              {`(${Math.round(distribution.carbsKcal)} ${t('common.kcal') || 'kcal'})`}
            </Text>
          </View>

          <View style={[styles.legendItem, activeRowStyle()]}>
            <View style={[styles.legendDot, { backgroundColor: fatsColor }]} />
            <Text style={[styles.legendLabel, directionalText, { color: colors.textSecondary }]}>
              {`${t('common.fats') || 'Fats'} ${distribution.fatsPct}%`}
            </Text>
            <Text style={[styles.legendSub, directionalText, { color: colors.textMuted }]}>
              {`(${Math.round(distribution.fatsKcal)} ${t('common.kcal') || 'kcal'})`}
            </Text>
          </View>
        </View>
      ) : (
        <Text style={[styles.noDataText, directionalText, { color: colors.textMuted }]}>
          {t('nutrition.noMacroData') || 'No macronutrient intake recorded for this day.'}
        </Text>
      )}

      {/* Footnote / Explanation */}
      {showFootnote && hasData && (
        <Text style={[styles.footnote, directionalText, { color: colors.textMuted }]}>
          {t('nutrition.macroEnergyEstimate', { calories: Math.round(distribution.totalMacroKcal) }) ||
            `Estimated macro energy: ${Math.round(distribution.totalMacroKcal)} kcal (via Atwater 4/4/9 factors).`}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  headerRow: {
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    ...typography.caption,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  totalKcal: {
    ...typography.caption,
    fontWeight: '500',
  },
  barTrack: {
    height: 12,
    borderRadius: radius.pill,
    overflow: 'hidden',
    width: '100%',
  },
  barSegment: {
    height: '100%',
  },
  emptySegment: {
    width: '100%',
    height: '100%',
  },
  legendRow: {
    flexWrap: 'wrap',
    gap: spacing.md,
    alignItems: 'center',
    paddingTop: spacing.xs,
  },
  legendItem: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
  },
  legendLabel: {
    ...typography.caption,
    fontWeight: '600',
  },
  legendSub: {
    ...typography.caption,
  },
  noDataText: {
    ...typography.caption,
    fontStyle: 'italic',
  },
  footnote: {
    ...typography.caption,
    fontSize: 11,
    marginTop: spacing.xs,
  },
});
