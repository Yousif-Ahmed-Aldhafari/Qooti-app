import { StyleSheet, Text, View } from 'react-native';

import { themeColors } from '../theme/colors';
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

export function ProgressCard({ title, value, helper, accent }: ProgressCardProps) {
  const colors = themeColors();
  const tone = accent ?? colors.purple;
  const directionalText = {
    textAlign: activeTextAlign(),
    writingDirection: activeWritingDirection(),
  } as const;

  return (
    <View style={[styles.card, { borderColor: tone, backgroundColor: colors.card }]}>
      <Text style={[styles.title, directionalText, { color: colors.textMuted }]}>{title}</Text>
      <Text style={[styles.value, directionalText, { color: tone }]}>{value}</Text>
      <Text style={[styles.helper, directionalText, { color: colors.textSecondary }]}>{helper}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 150,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    ...typography.caption,
  },
  value: {
    ...typography.h2,
  },
  helper: {
    ...typography.caption,
  },
});
