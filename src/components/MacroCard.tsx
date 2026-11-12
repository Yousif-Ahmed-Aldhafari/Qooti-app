import { StyleSheet, Text, View } from 'react-native';

import { themeColors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { progressRatio } from '../utils/nutrition';
import { activeRowStyle, activeTextAlign, activeWritingDirection } from '../utils/rtl';

type MacroCardProps = {
  label: string;
  value: number | null;
  target?: number | null;
  unit: string;
  accent?: string;
  hasTarget?: boolean;
  unavailableLabel?: string;
};

export function MacroCard({
  label,
  value,
  target,
  unit,
  accent,
  hasTarget = true,
  unavailableLabel,
}: MacroCardProps) {
  const colors = themeColors();
  const tone = accent ?? colors.accent;
  const directionalText = {
    textAlign: activeTextAlign(),
    writingDirection: activeWritingDirection(),
  } as const;

  const validTarget =
    hasTarget && target != null && Number.isFinite(target) && target > 0 ? target : null;
  const hasValue = value != null && Number.isFinite(value);
  const fillPercentage = hasValue && validTarget ? progressRatio(value, validTarget) * 100 : 0;

  const a11yLabel = hasValue
    ? validTarget
      ? `${label}: ${Math.round(value)} of ${Math.round(validTarget)} ${unit}`
      : `${label}: ${Math.round(value)} ${unit}${unavailableLabel ? ` (${unavailableLabel})` : ''}`
    : `${label}: ${unavailableLabel ?? '--'}`;

  return (
    <View
      accessible={true}
      accessibilityLabel={a11yLabel}
      style={[
        styles.card,
        {
          backgroundColor: colors.glassBackground,
          borderColor: colors.glassBorder,
          shadowColor: colors.shadow,
        },
      ]}
    >
      <View style={[styles.headerRow, activeRowStyle()]}>
        <Text style={[styles.label, directionalText, { color: colors.textMuted }]}>{label}</Text>
        {!validTarget && unavailableLabel ? (
          <Text style={[styles.badgeText, directionalText, { color: colors.textMuted }]}>
            {unavailableLabel}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.value, directionalText, { color: colors.text }]}>
        {hasValue ? Math.round(value) : '--'}{' '}
        <Text style={[styles.unit, { color: colors.textMuted }]}>{unit}</Text>
      </Text>
      <View style={[styles.track, { backgroundColor: colors.cardMuted }]}>
        {validTarget ? (
          <View style={[styles.fill, { width: `${fillPercentage}%`, backgroundColor: tone }]} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 148,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.sm,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 4,
  },
  headerRow: {
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.xs,
  },
  label: {
    ...typography.caption,
  },
  badgeText: {
    ...typography.caption,
    fontSize: 11,
  },
  value: {
    ...typography.h2,
  },
  unit: {
    ...typography.caption,
  },
  track: {
    height: 7,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
  },
});
