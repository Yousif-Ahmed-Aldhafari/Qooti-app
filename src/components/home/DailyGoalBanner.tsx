import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { getActiveTheme, themeColors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { activeFlexStart, activeIsRTL, activeRowStyle, activeTextAlign, activeWritingDirection } from '../../utils/rtl';

type DailyGoalBannerProps = {
  title: string;
  calorieValue: string;
  proteinValue: string;
  mealsValue: string;
  workoutValue: string;
};

export function DailyGoalBanner({ title, calorieValue, proteinValue, mealsValue, workoutValue }: DailyGoalBannerProps) {
  const colors = themeColors();
  const theme = getActiveTheme();
  const rtl = activeIsRTL();
  const directionalText = {
    textAlign: activeTextAlign(),
    writingDirection: activeWritingDirection(),
  } as const;

  return (
    <View style={[styles.card, { backgroundColor: theme.isDark ? colors.black : colors.accentDark }]}>
      <View style={[styles.accentPanel, rtl ? styles.accentPanelRTL : styles.accentPanelLTR]} />
      <View style={[styles.accentStripe, rtl ? styles.accentStripeRTL : styles.accentStripeLTR]} />
      <View style={[styles.content, { alignSelf: activeFlexStart() }]}>
        <Text style={[styles.title, directionalText]}>{title}</Text>
        <View style={[styles.metrics, activeRowStyle()]}>
          <BannerMetric icon="flame" value={calorieValue} color={colors.orange} />
          <BannerMetric icon="nutrition-outline" value={proteinValue} color={colors.accent} />
        </View>
        <View style={[styles.metrics, activeRowStyle()]}>
          <BannerMetric icon="restaurant-outline" value={mealsValue} color={colors.lavender} />
          <BannerMetric icon="barbell-outline" value={workoutValue} color={colors.blue} />
        </View>
      </View>
      <View style={[styles.visual, rtl ? styles.visualRTL : styles.visualLTR]}>
        <Ionicons name="fitness-outline" size={92} color={colors.limeSoft} />
      </View>
    </View>
  );
}

function BannerMetric({ icon, value, color }: { icon: keyof typeof Ionicons.glyphMap; value: string; color: string }) {
  return (
    <View style={[styles.bannerMetric, activeRowStyle()]}>
      <Ionicons name={icon} size={16} color={color} />
      <Text style={styles.metricText} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 190,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  accentPanel: {
    position: 'absolute',
    width: 170,
    height: 220,
    top: -12,
    transform: [{ rotate: '12deg' }],
    backgroundColor: 'rgba(92, 107, 216, 0.3)',
  },
  accentPanelLTR: {
    right: -40,
  },
  accentPanelRTL: {
    left: -40,
  },
  accentStripe: {
    position: 'absolute',
    width: 148,
    height: 18,
    bottom: 28,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(208, 255, 99, 0.2)',
  },
  accentStripeLTR: {
    right: 18,
  },
  accentStripeRTL: {
    left: 18,
  },
  content: {
    width: '66%',
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    ...typography.h3,
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  metrics: {
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  bannerMetric: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  metricText: {
    ...typography.caption,
    color: '#FFFFFF',
  },
  visual: {
    position: 'absolute',
    bottom: spacing.lg,
    width: 112,
    height: 112,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  visualLTR: {
    right: spacing.lg,
  },
  visualRTL: {
    left: spacing.lg,
  },
});
