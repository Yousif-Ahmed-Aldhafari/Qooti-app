import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { themeColors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { activeRowDirection, activeTextAlign, activeWritingDirection } from '../../utils/rtl';

type HomeHeaderProps = {
  avatarInitials: string;
  greeting: string;
  subtitle: string;
  onActionPress: () => void;
};

export function HomeHeader({ avatarInitials, greeting, subtitle, onActionPress }: HomeHeaderProps) {
  const colors = themeColors();
  const directionalText = {
    textAlign: activeTextAlign(),
    writingDirection: activeWritingDirection(),
  } as const;

  return (
    <View style={[styles.wrap, { flexDirection: activeRowDirection() }]}>
      <View style={[styles.identity, { flexDirection: activeRowDirection() }]}>
        <View style={[styles.avatar, { backgroundColor: colors.orange }]}>
          <Text style={[styles.avatarText, { color: colors.black }]}>{avatarInitials}</Text>
        </View>
        <View style={styles.copy}>
          <Text style={[styles.greeting, directionalText, { color: colors.text }]} numberOfLines={1}>
            {greeting}
          </Text>
          <Text style={[styles.subtitle, directionalText, { color: colors.textMuted }]} numberOfLines={2}>
            {subtitle}
          </Text>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={onActionPress}
        style={({ pressed }) => [styles.action, { borderColor: colors.text, backgroundColor: colors.background, opacity: pressed ? 0.72 : 1 }]}
      >
        <Ionicons name="chatbubble-ellipses-outline" size={25} color={colors.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  identity: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...typography.h3,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  greeting: {
    ...typography.h2,
  },
  subtitle: {
    ...typography.body,
  },
  action: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
