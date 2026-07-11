import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAppTheme } from '../../hooks/useAppTheme';
import { useLanguage } from '../../hooks/useLanguage';
import { AppButton } from './AppButton';

type IconName = keyof typeof Ionicons.glyphMap;

type EmptyStateProps = {
  icon?: IconName;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ icon = 'file-tray-outline', title, message, actionLabel, onAction }: EmptyStateProps) {
  const theme = useAppTheme();
  const { textAlign, writingDirection } = useLanguage();

  return (
    <View style={[styles.container, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
      <View style={[styles.iconWrap, { backgroundColor: theme.colors.primaryMuted }]}>
        <Ionicons name={icon} size={28} color={theme.colors.primary} />
      </View>
      <Text style={[styles.title, { color: theme.colors.text, textAlign, writingDirection }]}>{title}</Text>
      <Text style={[styles.message, { color: theme.colors.textMuted, textAlign, writingDirection }]}>
        {message}
      </Text>
      {actionLabel && onAction ? <AppButton title={actionLabel} onPress={onAction} icon="add" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  message: {
    fontSize: 14,
    lineHeight: 21,
  },
});
