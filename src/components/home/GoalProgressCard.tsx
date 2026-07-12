import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { activeRowDirection, activeTextAlign, activeWritingDirection } from '../../utils/rtl';

type GoalProgressCardProps = {
  title: string;
  target: string;
  percentLabel: string;
  remaining: string;
  progress: number;
  accent: string;
};

export function GoalProgressCard({ title, target, percentLabel, remaining, progress, accent }: GoalProgressCardProps) {
  const directionalText = {
    textAlign: activeTextAlign(),
    writingDirection: activeWritingDirection(),
  } as const;
  const safeProgress = Math.min(1, Math.max(0, progress));

  return (
    <View style={[styles.card, { backgroundColor: accent }]}>
      <View style={[styles.header, { flexDirection: activeRowDirection() }]}>
        <Text style={[styles.title, directionalText]}>{title}</Text>
        <View style={[styles.targetRow, { flexDirection: activeRowDirection() }]}>
          <Ionicons name="calendar-outline" size={16} color={colors.black} />
          <Text style={styles.target}>{target}</Text>
        </View>
      </View>
      <Text style={[styles.percent, directionalText]}>{percentLabel}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${safeProgress * 100}%` }]} />
      </View>
      <View style={styles.remainingPill}>
        <Text style={styles.remaining}>{remaining}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 152,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
  },
  header: {
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.black,
  },
  targetRow: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  target: {
    ...typography.caption,
    color: colors.black,
  },
  percent: {
    ...typography.body,
    color: colors.black,
  },
  track: {
    height: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.black,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.black,
  },
  remainingPill: {
    minHeight: 28,
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.black,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  remaining: {
    ...typography.caption,
    color: colors.black,
  },
});
