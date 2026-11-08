import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useBottomNav } from '../context/BottomNavContext';
import { getActiveTheme, themeColors } from '../theme/colors';
import type { Language, TabKey } from '../types';
import { getTabOrder } from '../utils/rtl';

import {
  bottomTabStyles,
  calculateBottomNavOffset,
  compactActiveButtonRadius,
  compactIconContainerSize,
  compactIconSize,
  compactNavHeight,
  compactNavHorizontalInset,
  compactNavPaddingX,
  compactNavRadius,
  normalActiveButtonRadius,
  normalIconContainerSize,
  normalIconSize,
  normalNavHeight,
  normalNavHorizontalInset,
  normalNavPaddingX,
  normalNavRadius,
} from './bottomTabStyles';

type BottomTabsProps = {
  activeTab: TabKey;
  labels: Record<TabKey, string>;
  onChange: (tab: TabKey) => void;
  language?: Language;
};

const icons: Record<TabKey, keyof typeof Ionicons.glyphMap> = {
  home: 'home-outline',
  meals: 'restaurant-outline',
  workouts: 'barbell-outline',
  progress: 'analytics-outline',
  profile: 'person-outline',
};

export function BottomTabs({ activeTab, labels, onChange, language }: BottomTabsProps) {
  const colors = themeColors();
  const theme = getActiveTheme();
  const insets = useSafeAreaInsets();
  const { isBottomNavCompact } = useBottomNav();
  const [navProgress] = useState(() => new Animated.Value(isBottomNavCompact ? 1 : 0));
  const tabs = getTabOrder(language);
  const bottomOffset = calculateBottomNavOffset(insets.bottom, Platform.OS);
  const navHeight = navProgress.interpolate({ inputRange: [0, 1], outputRange: [normalNavHeight, compactNavHeight] });
  const navHorizontalInset = navProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [normalNavHorizontalInset, compactNavHorizontalInset],
  });
  const navRadius = navProgress.interpolate({ inputRange: [0, 1], outputRange: [normalNavRadius, compactNavRadius] });
  const navPaddingX = navProgress.interpolate({ inputRange: [0, 1], outputRange: [normalNavPaddingX, compactNavPaddingX] });
  const tabRadius = navProgress.interpolate({ inputRange: [0, 1], outputRange: [normalActiveButtonRadius, compactActiveButtonRadius] });
  const iconWrapSize = navProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [normalIconContainerSize, compactIconContainerSize],
  });
  const iconScale = navProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, compactIconSize / normalIconSize],
  });

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
          left: navHorizontalInset,
          right: navHorizontalInset,
          shadowColor: colors.shadow,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.glass,
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
              style={({ pressed }) => [styles.tabPressable, { opacity: pressed ? 0.76 : 1 }]}
            >
              <Animated.View
                style={[
                  styles.tabItem,
                  active ? { backgroundColor: colors.activeTabBackground } : null,
                  { borderRadius: tabRadius },
                ]}
              >
                <Animated.View style={[styles.iconWrap, { height: iconWrapSize, width: iconWrapSize }]}>
                  <Animated.View style={{ transform: [{ scale: iconScale }] }}>
                    <Ionicons name={icons[tab]} size={normalIconSize} color={active ? colors.primary : colors.textMuted} />
                  </Animated.View>
                </Animated.View>
              </Animated.View>
            </Pressable>
          );
        })}
      </Animated.View>
    </Animated.View>
  );
}

const styles = bottomTabStyles;
