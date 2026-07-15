import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useBottomNav } from '../context/BottomNavContext';
import type { TabKey } from '../types';
import { getActiveTheme, themeColors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { activeRowStyle } from '../utils/rtl';

type BottomTabsProps = {
  activeTab: TabKey;
  labels: Record<TabKey, string>;
  onChange: (tab: TabKey) => void;
};

const icons: Record<TabKey, keyof typeof Ionicons.glyphMap> = {
  home: 'home-outline',
  meals: 'restaurant-outline',
  workouts: 'barbell-outline',
  progress: 'analytics-outline',
  profile: 'person-outline',
};

const tabs: TabKey[] = ['home', 'meals', 'workouts', 'progress', 'profile'];

export function BottomTabs({ activeTab, labels, onChange }: BottomTabsProps) {
  const colors = themeColors();
  const theme = getActiveTheme();
  const insets = useSafeAreaInsets();
  const { isBottomNavCompact } = useBottomNav();
  const navProgress = useRef(new Animated.Value(isBottomNavCompact ? 1 : 0)).current;
  const bottomOffset = Platform.OS === 'ios' ? Math.max(insets.bottom - 8, 2) : 4;
  const navHeight = navProgress.interpolate({ inputRange: [0, 1], outputRange: [60, 48] });
  const navRadius = navProgress.interpolate({ inputRange: [0, 1], outputRange: [28, 24] });
  const navPaddingX = navProgress.interpolate({ inputRange: [0, 1], outputRange: [spacing.md, spacing.sm] });
  const iconWrapSize = navProgress.interpolate({ inputRange: [0, 1], outputRange: [42, 36] });
  const iconScale = navProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.875] });

  useEffect(() => {
    Animated.timing(navProgress, {
      toValue: isBottomNavCompact ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [isBottomNavCompact, navProgress]);

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          bottom: bottomOffset,
          borderRadius: navRadius,
          height: navHeight,
          shadowColor: colors.shadow,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.glass,
          activeRowStyle(),
          {
            backgroundColor: colors.glassTabBackground,
            borderRadius: navRadius,
            borderColor: colors.glassBorder,
            paddingHorizontal: navPaddingX,
          },
        ]}
      >
        <BlurView
          intensity={theme.isDark ? 36 : 54}
          tint={theme.isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        {tabs.map((tab) => {
          const active = tab === activeTab;
          return (
            <Pressable
              key={tab}
              accessibilityLabel={labels[tab]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => onChange(tab)}
              style={({ pressed }) => [styles.tab, { opacity: pressed ? 0.76 : 1 }]}
            >
              <Animated.View
                style={[
                  styles.iconWrap,
                  active ? { backgroundColor: colors.primaryMuted } : null,
                  { height: iconWrapSize, width: iconWrapSize, transform: [{ scale: iconScale }] },
                ]}
              >
                <Ionicons name={icons[tab]} size={24} color={active ? colors.primary : colors.textMuted} />
              </Animated.View>
            </Pressable>
          );
        })}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    start: spacing.lg,
    end: spacing.lg,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  glass: {
    flex: 1,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'space-around',
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  iconWrap: {
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
