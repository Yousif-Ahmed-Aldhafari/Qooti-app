import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { GlassCard } from '../GlassCard';
import { themeColors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { activeRowStyle, activeWritingDirection } from '../../utils/rtl';

type DailyMetricCardProps = {
  title: string;
  value?: string;
  subtitle?: string;
  centerValue?: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  progress?: number;
  bars?: number[];
};

export function DailyMetricCard({ title, value, subtitle, centerValue, icon, accent, progress = 0, bars }: DailyMetricCardProps) {
  const colors = themeColors();
  const centeredText = {
    textAlign: 'center' as const,
    writingDirection: activeWritingDirection(),
  };
  const safeProgress = Math.min(1, Math.max(0, progress));

  return (
    <GlassCard style={styles.card} contentStyle={styles.cardContent}>
      <Text style={[styles.title, centeredText, { color: colors.text }]} numberOfLines={1}>
        {title}
      </Text>
      {bars?.length ? (
        <View style={[styles.chart, activeRowStyle()]}>
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
          <View style={[styles.ringCenter, { backgroundColor: colors.cardSoft }]}>
            {centerValue ? (
              <Text style={[styles.centerValue, centeredText, { color: accent }]} numberOfLines={1}>
                {centerValue}
              </Text>
            ) : (
              <Ionicons name={icon} size={17} color={accent} />
            )}
          </View>
        </View>
      )}
      {value ? (
        <Text style={[styles.value, centeredText, { color: colors.text }]} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {subtitle ? (
        <Text style={[styles.subtitle, centeredText, { color: colors.textMuted }]} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 148,
    minWidth: 148,
    minHeight: 184,
    borderRadius: radius.md,
  },
  cardContent: {
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    ...typography.body,
    fontWeight: '800',
    textAlign: 'center',
    alignSelf: 'center',
    width: '100%',
    marginBottom: spacing.xs,
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
  },
  centerValue: {
    ...typography.caption,
    fontWeight: '900',
    alignSelf: 'center',
    width: '100%',
  },
  chart: {
    height: 48,
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
    alignSelf: 'center',
    width: '100%',
  },
  subtitle: {
    ...typography.caption,
    alignSelf: 'center',
    width: '100%',
  },
});
