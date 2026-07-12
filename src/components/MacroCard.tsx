import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { progressRatio } from '../utils/nutrition';
import { activeTextAlign, activeWritingDirection } from '../utils/rtl';

type MacroCardProps = {
  label: string;
  value: number;
  target: number;
  unit: string;
  accent?: string;
};

export function MacroCard({ label, value, target, unit, accent = colors.accent }: MacroCardProps) {
  const directionalText = {
    textAlign: activeTextAlign(),
    writingDirection: activeWritingDirection(),
  } as const;

  return (
    <View style={styles.card}>
      <Text style={[styles.label, directionalText]}>{label}</Text>
      <Text style={[styles.value, directionalText]}>
        {Math.round(value)} <Text style={styles.unit}>{unit}</Text>
      </Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progressRatio(value, target) * 100}%`, backgroundColor: accent }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 148,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  label: {
    ...typography.caption,
    color: colors.textMuted,
  },
  value: {
    ...typography.h2,
    color: colors.text,
  },
  unit: {
    ...typography.caption,
    color: colors.textMuted,
  },
  track: {
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.cardMuted,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
  },
});
