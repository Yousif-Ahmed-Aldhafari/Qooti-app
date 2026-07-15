import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';

import { GlassCard } from '../GlassCard';
import { themeColors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { activeRowStyle, activeWritingDirection } from '../../utils/rtl';

type DonutStat = {
  title: string;
  value: string;
  subtitle: string;
  accent: string;
  progress: number;
  centerValue?: string;
  icon?: keyof typeof Ionicons.glyphMap;
};

type CombinedDonutStatsCardProps = {
  progressStat: DonutStat;
  caloriesStat: DonutStat;
  workoutStat: DonutStat;
};

const donutSize = {
  large: 74,
  small: 46,
} as const;

const donutStroke = {
  large: 9,
  small: 6,
} as const;

export function CombinedDonutStatsCard({ progressStat, caloriesStat, workoutStat }: CombinedDonutStatsCardProps) {
  return (
    <GlassCard style={styles.card} contentStyle={[styles.content, activeRowStyle()]} blur>
      <DonutSection stat={progressStat} variant="large" />
      <View style={[styles.divider, { backgroundColor: themeColors().glassBorder }]} />
      <DonutSection stat={caloriesStat} variant="small" />
      <DonutSection stat={workoutStat} variant="small" />
    </GlassCard>
  );
}

function DonutSection({ stat, variant }: { stat: DonutStat; variant: 'large' | 'small' }) {
  const colors = themeColors();
  const large = variant === 'large';
  const centeredText = {
    textAlign: 'center' as const,
    writingDirection: activeWritingDirection(),
  };

  return (
    <View style={[styles.section, large ? styles.progressSection : styles.smallSection]}>
      <Text
        style={[styles.title, large ? styles.progressTitle : styles.smallTitle, centeredText, { color: colors.text }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {stat.title}
      </Text>
      <DonutRing stat={stat} variant={variant} />
      <Text
        style={[styles.value, large ? styles.progressValue : styles.smallValue, centeredText, { color: colors.text }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={large ? 0.82 : 0.72}
      >
        {stat.value}
      </Text>
      <Text
        style={[styles.subtitle, large ? styles.progressSubtitle : styles.smallSubtitle, centeredText, { color: colors.textMuted }]}
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.78}
      >
        {stat.subtitle}
      </Text>
    </View>
  );
}

function DonutRing({ stat, variant }: { stat: DonutStat; variant: 'large' | 'small' }) {
  const colors = themeColors();
  const size = donutSize[variant];
  const stroke = donutStroke[variant];
  const radiusValue = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radiusValue;
  const center = size / 2;
  const safeProgress = Math.min(1, Math.max(0, stat.progress));
  const strokeDashoffset = circumference * (1 - safeProgress);
  const centerSize = variant === 'large' ? 42 : 26;

  return (
    <View style={[styles.ring, { width: size, height: size, borderRadius: size / 2 }]}>
      <Svg width={size} height={size} style={styles.ringSvg}>
        <Circle cx={center} cy={center} r={radiusValue} stroke={colors.donutTrack} strokeWidth={stroke} fill="none" />
        <Circle
          cx={center}
          cy={center}
          r={radiusValue}
          stroke={stat.accent}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeOpacity={safeProgress > 0 ? 1 : 0}
          fill="none"
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      <View
        style={[
          styles.ringCenter,
          {
            backgroundColor: colors.cardSoft,
            width: centerSize,
            height: centerSize,
            borderRadius: centerSize / 2,
          },
        ]}
      >
        {stat.centerValue ? (
          <Text
            style={[styles.centerValue, variant === 'large' ? styles.largeCenterValue : styles.smallCenterValue, { color: stat.accent }]}
            numberOfLines={1}
          >
            {stat.centerValue}
          </Text>
        ) : (
          <Ionicons name={stat.icon ?? 'ellipse-outline'} size={variant === 'large' ? 18 : 14} color={stat.accent} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
  },
  content: {
    alignItems: 'stretch',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
  },
  section: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
  },
  progressSection: {
    flex: 1.45,
    gap: spacing.sm,
  },
  smallSection: {
    flex: 0.8,
    gap: spacing.xs,
  },
  divider: {
    width: 1,
    opacity: 0.72,
  },
  title: {
    alignSelf: 'center',
    width: '100%',
    fontWeight: '800',
  },
  progressTitle: {
    ...typography.body,
  },
  smallTitle: {
    ...typography.tab,
  },
  ring: {
    alignItems: 'center',
    alignSelf: 'center',
    justifyContent: 'center',
  },
  ringSvg: {
    left: 0,
    position: 'absolute',
    top: 0,
  },
  ringCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerValue: {
    fontWeight: '900',
    textAlign: 'center',
    width: '100%',
  },
  largeCenterValue: {
    fontSize: 13,
    lineHeight: 17,
  },
  smallCenterValue: {
    fontSize: 10,
    lineHeight: 13,
  },
  value: {
    alignSelf: 'center',
    fontWeight: '900',
    width: '100%',
  },
  progressValue: {
    ...typography.h3,
  },
  smallValue: {
    fontSize: 11,
    lineHeight: 14,
  },
  subtitle: {
    alignSelf: 'center',
    width: '100%',
  },
  progressSubtitle: {
    ...typography.caption,
  },
  smallSubtitle: {
    ...typography.tab,
  },
});
