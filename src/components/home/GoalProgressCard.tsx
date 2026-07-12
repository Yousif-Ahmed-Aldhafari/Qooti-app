import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { themeColors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { activeFlexStart, activeRowDirection, activeTextAlign, activeWritingDirection } from '../../utils/rtl';

const onGoalCard = '#111412';

type GoalProgressCardProps = {
  title: string;
  target: string;
  percentLabel: string;
  remaining: string;
  progress: number;
  accent: string;
};

export function GoalProgressCard({ title, target, percentLabel, remaining, progress, accent }: GoalProgressCardProps) {
  const colors = themeColors();
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
      <View style={[styles.remainingPill, { alignSelf: activeFlexStart() }]}>
        <Text style={[styles.remaining, directionalText]}>{remaining}</Text>
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
    color: onGoalCard,
  },
  targetRow: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  target: {
    ...typography.caption,
    color: onGoalCard,
  },
  percent: {
    ...typography.body,
    color: onGoalCard,
  },
  track: {
    height: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: onGoalCard,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: onGoalCard,
  },
  remainingPill: {
    minHeight: 28,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: onGoalCard,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  remaining: {
    ...typography.caption,
    color: onGoalCard,
  },
});
