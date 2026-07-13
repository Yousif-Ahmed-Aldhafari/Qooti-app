import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';

import { getActiveTheme, themeColors } from '../theme/colors';
import { radius } from '../theme/radius';

type GlassCardProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  blur?: boolean;
};

export function GlassCard({ children, style, contentStyle, blur = false }: GlassCardProps) {
  const colors = themeColors();
  const theme = getActiveTheme();

  return (
    <View
      style={[
        styles.shell,
        {
          backgroundColor: colors.glassBackground,
          borderColor: colors.glassBorder,
          shadowColor: colors.shadow,
        },
        style,
      ]}
    >
      {blur ? (
        <BlurView
          intensity={theme.isDark ? 28 : 42}
          tint={theme.isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <View style={contentStyle}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: radius.lg,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.14,
    shadowRadius: 26,
    elevation: 7,
  },
});
