import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAppTheme } from '../../hooks/useAppTheme';

type IconName = keyof typeof Ionicons.glyphMap;

type IconButtonProps = {
  icon: IconName;
  label: string;
  onPress: () => void;
  tone?: 'default' | 'danger';
};

export function IconButton({ icon, label, onPress, tone = 'default' }: IconButtonProps) {
  const theme = useAppTheme();
  const color = tone === 'danger' ? theme.colors.danger : theme.colors.primary;

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={20} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
