import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAppTheme } from '../../hooks/useAppTheme';
import { useLanguage } from '../../hooks/useLanguage';

type IconName = keyof typeof Ionicons.glyphMap;

type ListItemProps = {
  title: string;
  subtitle?: string;
  meta?: string;
  icon?: IconName;
  onPress?: () => void;
};

export function ListItem({ title, subtitle, meta, icon, onPress }: ListItemProps) {
  const theme = useAppTheme();
  const { rowDirection, textAlign, writingDirection, isRTL } = useLanguage();

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      style={({ pressed }) => [
        styles.item,
        {
          flexDirection: rowDirection,
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          opacity: pressed && onPress ? 0.75 : 1,
        },
      ]}
    >
      {icon ? (
        <View style={[styles.iconWrap, { backgroundColor: theme.colors.primaryMuted }]}>
          <Ionicons name={icon} size={20} color={theme.colors.primary} />
        </View>
      ) : null}
      <View style={styles.text}>
        <Text style={[styles.title, { color: theme.colors.text, textAlign, writingDirection }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[styles.subtitle, { color: theme.colors.textMuted, textAlign, writingDirection }]}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {meta ? (
        <Text style={[styles.meta, { color: theme.colors.primary, writingDirection }]} numberOfLines={1}>
          {meta}
        </Text>
      ) : null}
      {onPress ? (
        <Ionicons
          name={isRTL ? 'chevron-back' : 'chevron-forward'}
          size={18}
          color={theme.colors.textMuted}
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
  },
  meta: {
    maxWidth: 96,
    fontSize: 13,
    fontWeight: '800',
  },
});
