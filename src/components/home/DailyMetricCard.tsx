import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { activeTextAlign, activeWritingDirection } from '../../utils/rtl';

type DailyMetricCardProps = {
  title: string;
  value: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  progress?: number;
  bars?: number[];
};

export function DailyMetricCard({ title, value, subtitle, icon, accent, progress = 0, bars }: DailyMetricCardProps) {
  const directionalText = {
    textAlign: activeTextAlign(),
    writingDirection: activeWritingDirection(),
  } as const;
  const safeProgress = Math.min(1, Math.max(0, progress));

  return (
    <View style={styles.card}>
      <Text style={[styles.title, directionalText]} numberOfLines={1}>
        {title}
      </Text>
      {bars?.length ? (
        <View style={styles.chart}>
          {bars.map((bar, index) => (
            <View
              key={`${bar}-${index}`}
              style={[
                styles.chartBar,
                {
                  height: `${Math.max(18, Math.min(100, bar))}%`,
                  backgroundColor: index % 2 === 0 ? accent : colors.blue,
                },
              ]}
            />
          ))}
        </View>
      ) : (
        <View style={[styles.ringOuter, { borderColor: colors.cardMuted }]}>
          <View style={[styles.ringProgress, { borderColor: accent, opacity: safeProgress > 0 ? 1 : 0.28 }]} />
          <View style={styles.ringCenter}>
            <Ionicons name={icon} size={17} color={accent} />
          </View>
        </View>
      )}
      <Text style={[styles.value, directionalText]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.subtitle, directionalText]} numberOfLines={1}>
        {subtitle}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 116,
    minHeight: 120,
    borderRadius: radius.sm,
    padding: spacing.md,
    justifyContent: 'space-between',
    backgroundColor: colors.card,
  },
  title: {
    ...typography.body,
    fontWeight: '800',
    color: colors.text,
  },
  ringOuter: {
    width: 68,
    height: 68,
    alignSelf: 'center',
    borderRadius: 34,
    borderWidth: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringProgress: {
    position: 'absolute',
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 9,
  },
  ringCenter: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardSoft,
  },
  chart: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
    paddingTop: spacing.sm,
  },
  chartBar: {
    flex: 1,
    borderRadius: radius.pill,
  },
  value: {
    ...typography.h3,
    color: colors.text,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
