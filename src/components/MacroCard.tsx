import { StyleSheet, Text, View } from 'react-native';

import { themeColors } from '../theme/colors';
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

export function MacroCard({ label, value, target, unit, accent }: MacroCardProps) {
  const colors = themeColors();
  const tone = accent ?? colors.accent;
  const directionalText = {
    textAlign: activeTextAlign(),
    writingDirection: activeWritingDirection(),
  } as const;

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <Text style={[styles.label, directionalText, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.value, directionalText, { color: colors.text }]}>
        {Math.round(value)} <Text style={[styles.unit, { color: colors.textMuted }]}>{unit}</Text>
      </Text>
      <View style={[styles.track, { backgroundColor: colors.cardMuted }]}>
        <View style={[styles.fill, { width: `${progressRatio(value, target) * 100}%`, backgroundColor: tone }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 148,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  label: {
    ...typography.caption,
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
