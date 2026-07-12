import { StyleSheet, Text, View } from 'react-native';

import { themeColors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { activeTextAlign, activeWritingDirection } from '../utils/rtl';

type StatCardProps = {
  label: string;
  value: string | number;
  accent?: string;
};

export function StatCard({ label, value, accent }: StatCardProps) {
  const colors = themeColors();
  const tone = accent ?? colors.accent;
  const directionalText = {
    textAlign: activeTextAlign(),
    writingDirection: activeWritingDirection(),
  } as const;

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <Text style={[styles.value, directionalText, { color: tone }]}>{value}</Text>
      <Text style={[styles.label, directionalText, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 100,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  value: {
    ...typography.h2,
  },
  label: {
    ...typography.caption,
  },
});
