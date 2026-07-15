import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';

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
  variant?: 'large' | 'compact';
};

const ringConfig = {
  large: {
    size: 68,
    stroke: 9,
    centerSize: 38,
    iconSize: 17,
  },
  compact: {
    size: 46,
    stroke: 6,
    centerSize: 26,
    iconSize: 14,
  },
} as const;

export function DailyMetricCard({ title, value, subtitle, centerValue, icon, accent, progress = 0, bars, variant = 'large' }: DailyMetricCardProps) {
  const colors = themeColors();
  const compact = variant === 'compact';
  const ring = ringConfig[variant];
  const ringRadius = (ring.size - ring.stroke) / 2;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringCenter = ring.size / 2;
  const centeredText = {
    textAlign: 'center' as const,
    writingDirection: activeWritingDirection(),
  };
  const safeProgress = Math.min(1, Math.max(0, progress));
  const strokeDashoffset = ringCircumference * (1 - safeProgress);

  return (
    <GlassCard
      style={[styles.card, compact ? styles.compactCard : styles.largeCard]}
      contentStyle={[styles.cardContent, compact ? styles.compactCardContent : null]}
    >
      <Text style={[styles.title, compact ? styles.compactTitle : null, centeredText, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82}>
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
        <View style={[styles.ringOuter, { width: ring.size, height: ring.size, borderRadius: ring.size / 2 }]}>
          <Svg width={ring.size} height={ring.size} style={styles.ringSvg}>
            <Circle
              cx={ringCenter}
              cy={ringCenter}
              r={ringRadius}
              stroke={colors.donutTrack}
              strokeWidth={ring.stroke}
              fill="none"
            />
            <Circle
              cx={ringCenter}
              cy={ringCenter}
              r={ringRadius}
              stroke={accent}
              strokeWidth={ring.stroke}
              strokeLinecap="round"
              strokeDasharray={`${ringCircumference} ${ringCircumference}`}
              strokeDashoffset={strokeDashoffset}
              strokeOpacity={safeProgress > 0 ? 1 : 0}
              fill="none"
              transform={`rotate(-90 ${ringCenter} ${ringCenter})`}
            />
          </Svg>
          <View
            style={[
              styles.ringCenter,
              { backgroundColor: colors.cardSoft, width: ring.centerSize, height: ring.centerSize, borderRadius: ring.centerSize / 2 },
            ]}
          >
            {centerValue ? (
              <Text style={[styles.centerValue, compact ? styles.compactCenterValue : null, centeredText, { color: accent }]} numberOfLines={1}>
                {centerValue}
              </Text>
            ) : (
              <Ionicons name={icon} size={ring.iconSize} color={accent} />
            )}
          </View>
        </View>
      )}
      {value ? (
        <Text style={[styles.value, compact ? styles.compactValue : null, centeredText, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
          {value}
        </Text>
      ) : null}
      {subtitle ? (
        <Text style={[styles.subtitle, compact ? styles.compactSubtitle : null, centeredText, { color: colors.textMuted }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78}>
          {subtitle}
        </Text>
      ) : null}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
  },
  largeCard: {
    width: 148,
    minWidth: 148,
    minHeight: 184,
  },
  compactCard: {
    flex: 1,
    minWidth: 0,
    minHeight: 150,
  },
  cardContent: {
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  compactCardContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  title: {
    ...typography.body,
    fontWeight: '800',
    textAlign: 'center',
    alignSelf: 'center',
    width: '100%',
    marginBottom: spacing.xs,
  },
  compactTitle: {
    ...typography.tab,
    marginBottom: 0,
  },
  ringOuter: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringSvg: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  ringCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerValue: {
    ...typography.caption,
    fontWeight: '900',
    alignSelf: 'center',
    width: '100%',
  },
  compactCenterValue: {
    fontSize: 10,
    lineHeight: 13,
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
  compactValue: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
  },
  subtitle: {
    ...typography.caption,
    alignSelf: 'center',
    width: '100%',
  },
  compactSubtitle: {
    ...typography.tab,
  },
});
