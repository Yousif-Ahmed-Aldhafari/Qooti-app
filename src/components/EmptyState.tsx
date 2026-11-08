import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { themeColors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { activeTextAlign, activeWritingDirection } from '../utils/rtl';
import { AppButton } from './AppButton';

type EmptyStateProps = {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  actionTitle?: string;
  actionIcon?: keyof typeof Ionicons.glyphMap;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

export function EmptyState({
  icon = 'file-tray-outline',
  title,
  description,
  actionTitle,
  actionIcon = 'add',
  onAction,
  style,
  children,
}: EmptyStateProps) {
  const colors = themeColors();
  const directionalText = {
    textAlign: activeTextAlign(),
    writingDirection: activeWritingDirection(),
  } as const;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.card, borderColor: colors.border },
        style,
      ]}
    >
      <View style={[styles.iconCircle, { backgroundColor: colors.cardMuted }]}>
        <Ionicons name={icon} size={36} color={colors.accent} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.title, directionalText, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.description, directionalText, { color: colors.textMuted }]}>
          {description}
        </Text>
      </View>
      {actionTitle && onAction ? (
        <View style={styles.actionWrap}>
          <AppButton title={actionTitle} icon={actionIcon} onPress={onAction} />
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    marginVertical: spacing.md,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    alignItems: 'center',
    gap: spacing.xs,
    width: '100%',
  },
  title: {
    ...typography.h3,
    textAlign: 'center',
  },
  description: {
    ...typography.body,
    textAlign: 'center',
    lineHeight: 22,
  },
  actionWrap: {
    width: '100%',
    maxWidth: 240,
    marginTop: spacing.xs,
  },
});
