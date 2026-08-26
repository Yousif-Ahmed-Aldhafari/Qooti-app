import { StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';

import { GlassCard } from '../GlassCard';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { themeColors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { activeWritingDirection } from '../../utils/rtl';

type DonutStat = {
  title: string;
  value: string;
  subtitle: string;
  accent: string;
  progress: number;
};

type ProgressInfoItem = {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap | keyof typeof MaterialCommunityIcons.glyphMap;
  iconFamily?: 'ionicons' | 'materialCommunity';
  accent: string;
  subtitle?: string;
};

type CombinedProgressStatsCardProps = {
  progressStat: DonutStat;
  caloriesStat: DonutStat;
  workoutStat: DonutStat;
  progressInfo: ProgressInfoItem[];
  isRTL: boolean;
};

const progressDonutSize = 74;
const progressDonutStroke = 9;
const progressDonutCenterSize = 42;
const compactDonutSize = 56;
const compactDonutStroke = 7;
const compactDonutCenterSize = 34;

export function CombinedProgressStatsCard({
  progressStat,
  caloriesStat,
  workoutStat,
  progressInfo,
  isRTL,
}: CombinedProgressStatsCardProps) {
  const colors = themeColors();

  return (
    <GlassCard style={styles.card} contentStyle={styles.content} blur>
      <View style={[styles.progressContentRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <ProgressDonutSection stat={progressStat} />
        <View style={styles.progressInfoList}>
          {progressInfo.map((item) => (
            <ProgressInfoRow key={item.label} item={item} isRTL={isRTL} />
          ))}
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.glassBorder }]} />

      <View style={styles.metricsGrid}>
        <View style={[styles.metricsGridRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <CompactDonutSection stat={caloriesStat} />
          <CompactDonutSection stat={workoutStat} />
        </View>
      </View>
    </GlassCard>
  );
}

function ProgressDonutSection({ stat }: { stat: DonutStat }) {
  const colors = themeColors();
  const centeredText = {
    textAlign: 'center' as const,
    writingDirection: activeWritingDirection(),
  };

  return (
    <View style={styles.progressDonutSection}>
      <Text style={[styles.title, centeredText, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
        {stat.title}
      </Text>
      <DonutRing stat={stat} size={progressDonutSize} stroke={progressDonutStroke} centerSize={progressDonutCenterSize} />
      <Text style={[styles.progressValue, centeredText, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
        {stat.value}
      </Text>
      <Text style={[styles.subtitle, centeredText, { color: colors.textMuted }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.78}>
        {stat.subtitle}
      </Text>
    </View>
  );
}

function CompactDonutSection({ stat }: { stat: DonutStat }) {
  const colors = themeColors();
  const centeredText = {
    textAlign: 'center' as const,
    writingDirection: activeWritingDirection(),
  };

  return (
    <View style={styles.compactDonutSection}>
      <Text style={[styles.compactTitle, centeredText, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.74}>
        {stat.title}
      </Text>
      <DonutRing stat={stat} size={compactDonutSize} stroke={compactDonutStroke} centerSize={compactDonutCenterSize} />
      <Text style={[styles.compactValue, centeredText, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
        {stat.value}
      </Text>
      <Text style={[styles.compactSubtitle, centeredText, { color: colors.textMuted }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78}>
        {stat.subtitle}
      </Text>
    </View>
  );
}

function ProgressInfoRow({ item, isRTL }: { item: ProgressInfoItem; isRTL: boolean }) {
  const colors = themeColors();
  const naturalText = {
    textAlign: isRTL ? 'right' as const : 'left' as const,
    writingDirection: activeWritingDirection(),
  };

  return (
    <View style={[styles.infoRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
      <View style={styles.infoIconWrap}>
        {item.iconFamily === 'materialCommunity' ? (
          <MaterialCommunityIcons name={item.icon as keyof typeof MaterialCommunityIcons.glyphMap} size={18} color={item.accent} />
        ) : (
          <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={18} color={item.accent} />
        )}
      </View>
      <View style={styles.infoCopy}>
        <Text style={[styles.infoLabel, naturalText, { color: colors.textMuted }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82}>
          {item.label}
        </Text>
        <Text style={[styles.infoValue, naturalText, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
          {item.value}
        </Text>
      </View>
    </View>
  );
}

function DonutRing({ stat, size, stroke, centerSize }: { stat: DonutStat; size: number; stroke: number; centerSize: number }) {
  const colors = themeColors();
  const safeProgress = clampProgress(stat.progress);
  const radiusValue = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radiusValue;
  const center = size / 2;
  const strokeDashoffset = circumference * (1 - safeProgress);
  const progressLabel = `${Math.round(safeProgress * 100)}%`;

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
      <View style={[styles.ringCenter, { backgroundColor: colors.cardSoft, width: centerSize, height: centerSize, borderRadius: centerSize / 2 }]}>
        <Text style={[styles.centerValue, { color: stat.accent }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
          {progressLabel}
        </Text>
      </View>
    </View>
  );
}

function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) {
    return 0;
  }

  return Math.min(1, Math.max(0, progress));
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
  },
  content: {
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
  },
  progressContentRow: {
    alignItems: 'center',
    gap: spacing.md,
    width: '100%',
  },
  progressDonutSection: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
    justifyContent: 'center',
    minWidth: 0,
  },
  progressInfoList: {
    flex: 1,
    gap: spacing.sm,
    minWidth: 0,
  },
  infoRow: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    gap: spacing.xs,
    minHeight: 34,
  },
  infoIconWrap: {
    alignItems: 'center',
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  infoCopy: {
    flex: 1,
    minWidth: 0,
  },
  infoLabel: {
    ...typography.tab,
    fontWeight: '800',
  },
  infoValue: {
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 16,
  },
  divider: {
    height: 1,
    opacity: 0.72,
    width: '100%',
  },
  metricsGrid: {
    gap: spacing.sm,
    width: '100%',
  },
  metricsGridRow: {
    alignItems: 'stretch',
    gap: spacing.sm,
    width: '100%',
  },
  compactDonutSection: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.xs,
    justifyContent: 'center',
    minWidth: 0,
  },
  title: {
    ...typography.body,
    alignSelf: 'center',
    fontWeight: '800',
    width: '100%',
  },
  compactTitle: {
    ...typography.caption,
    alignSelf: 'center',
    fontWeight: '800',
    width: '100%',
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
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 17,
    textAlign: 'center',
    width: '100%',
  },
  progressValue: {
    ...typography.h3,
    alignSelf: 'center',
    fontWeight: '900',
    width: '100%',
  },
  compactValue: {
    ...typography.body,
    alignSelf: 'center',
    fontWeight: '900',
    width: '100%',
  },
  subtitle: {
    ...typography.caption,
    alignSelf: 'center',
    width: '100%',
  },
  compactSubtitle: {
    ...typography.tab,
    alignSelf: 'center',
    width: '100%',
  },
});
