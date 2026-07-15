import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { GlassCard } from '../GlassCard';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { themeColors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { activeWritingDirection } from '../../utils/rtl';

type DonutStatCardProps = {
  title: string;
  value: string;
  subtitle?: string;
  progress: number;
  color: string;
  fullWidth?: boolean;
};

const donutSize = 74;
const donutStroke = 9;
const donutCenterSize = 42;

export function DonutStatCard({ title, value, subtitle, progress, color, fullWidth = false }: DonutStatCardProps) {
  const colors = themeColors();
  const safeProgress = clampProgress(progress);
  const centeredText = {
    textAlign: 'center' as const,
    writingDirection: activeWritingDirection(),
  };

  return (
    <GlassCard style={[styles.card, fullWidth ? styles.fullWidthCard : styles.halfWidthCard]} contentStyle={styles.content} blur>
      <Text style={[styles.title, centeredText, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
        {title}
      </Text>

      <DonutRing progress={safeProgress} color={color} />

      <Text style={[styles.value, centeredText, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
        {value}
      </Text>

      {subtitle ? (
        <Text style={[styles.subtitle, centeredText, { color: colors.textMuted }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.78}>
          {subtitle}
        </Text>
      ) : null}
    </GlassCard>
  );
}

function DonutRing({ progress, color }: { progress: number; color: string }) {
  const colors = themeColors();
  const radiusValue = (donutSize - donutStroke) / 2;
  const circumference = 2 * Math.PI * radiusValue;
  const center = donutSize / 2;
  const strokeDashoffset = circumference * (1 - progress);
  const progressLabel = `${Math.round(progress * 100)}%`;

  return (
    <View style={styles.ring}>
      <Svg width={donutSize} height={donutSize} style={styles.ringSvg}>
        <Circle cx={center} cy={center} r={radiusValue} stroke={colors.donutTrack} strokeWidth={donutStroke} fill="none" />
        <Circle
          cx={center}
          cy={center}
          r={radiusValue}
          stroke={color}
          strokeWidth={donutStroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeOpacity={progress > 0 ? 1 : 0}
          fill="none"
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      <View style={[styles.ringCenter, { backgroundColor: colors.cardSoft }]}>
        <Text style={[styles.centerValue, { color }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.74}>
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
    minHeight: 194,
  },
  fullWidthCard: {
    width: '100%',
  },
  halfWidthCard: {
    flex: 1,
    minWidth: 0,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 194,
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  title: {
    ...typography.body,
    alignSelf: 'center',
    fontWeight: '800',
    width: '100%',
  },
  ring: {
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: donutSize / 2,
    height: donutSize,
    justifyContent: 'center',
    width: donutSize,
  },
  ringSvg: {
    left: 0,
    position: 'absolute',
    top: 0,
  },
  ringCenter: {
    alignItems: 'center',
    borderRadius: donutCenterSize / 2,
    height: donutCenterSize,
    justifyContent: 'center',
    width: donutCenterSize,
  },
  centerValue: {
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 17,
    textAlign: 'center',
    width: '100%',
  },
  value: {
    ...typography.h3,
    alignSelf: 'center',
    fontWeight: '900',
    width: '100%',
  },
  subtitle: {
    ...typography.caption,
    alignSelf: 'center',
    width: '100%',
  },
});
