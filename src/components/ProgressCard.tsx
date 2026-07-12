import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { activeTextAlign, activeWritingDirection } from '../utils/rtl';

type ProgressCardProps = {
  title: string;
  value: string;
  helper: string;
  accent?: string;
};

export function ProgressCard({ title, value, helper, accent = colors.purple }: ProgressCardProps) {
  const directionalText = {
    textAlign: activeTextAlign(),
    writingDirection: activeWritingDirection(),
  } as const;

  return (
    <View style={[styles.card, { borderColor: accent }]}>
      <Text style={[styles.title, directionalText]}>{title}</Text>
      <Text style={[styles.value, directionalText, { color: accent }]}>{value}</Text>
      <Text style={[styles.helper, directionalText]}>{helper}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 150,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    ...typography.caption,
    color: colors.textMuted,
  },
  value: {
    ...typography.h2,
  },
  helper: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
