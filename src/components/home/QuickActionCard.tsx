import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { themeColors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { activeFlexStart, activeIsRTL, activeRowDirection, activeTextAlign, activeWritingDirection } from '../../utils/rtl';

type QuickActionCardProps = {
  title: string;
  subtitle: string;
  actionLabel: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  onPress: () => void;
};

export function QuickActionCard({ title, subtitle, actionLabel, icon, accent, onPress }: QuickActionCardProps) {
  const colors = themeColors();
  const rtl = activeIsRTL();
  const directionalText = {
    textAlign: activeTextAlign(),
    writingDirection: activeWritingDirection(),
  } as const;

  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.card, { backgroundColor: accent, opacity: pressed ? 0.82 : 1 }]}>
      <Ionicons name={icon} size={28} color={colors.black} />
      <View style={styles.copy}>
        <Text style={[styles.title, directionalText]} numberOfLines={2}>
          {title}
        </Text>
        <Text style={[styles.subtitle, directionalText]} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
      <View style={[styles.action, { alignSelf: activeFlexStart(), flexDirection: activeRowDirection() }]}>
        <Text style={[styles.actionText, { writingDirection: activeWritingDirection() }]} numberOfLines={1}>
          {actionLabel}
        </Text>
        <Ionicons name={rtl ? 'arrow-back' : 'arrow-forward'} size={20} color={colors.white} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 148,
    minHeight: 143,
    borderRadius: radius.lg,
    padding: spacing.lg,
    justifyContent: 'space-between',
  },
  copy: {
    gap: spacing.xs,
  },
  title: {
    ...typography.h2,
    color: '#111412',
  },
  subtitle: {
    ...typography.body,
    color: '#2B2E30',
  },
  action: {
    minHeight: 36,
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    backgroundColor: '#2B2E30',
  },
  actionText: {
    ...typography.caption,
    color: '#D7D9DA',
  },
});
