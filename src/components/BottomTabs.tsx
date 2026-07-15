import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useBottomNav } from '../context/BottomNavContext';
import type { TabKey } from '../types';
import { getActiveTheme, themeColors } from '../theme/colors';
import { radius } from '../theme/radius';
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
const normalNavHorizontalInset = 16;
const compactNavHorizontalInset = 42;
const normalNavHeight = 64;
const compactNavHeight = 52;
const normalNavRadius = normalNavHeight / 2;
const compactNavRadius = 18;
const normalNavPaddingX = 4;
const compactNavPaddingX = 0;
const tabVerticalPadding = 2;
const normalActiveButtonRadius = (normalNavHeight - (tabVerticalPadding * 2)) / 2;
const compactActiveButtonRadius = (compactNavHeight - (tabVerticalPadding * 2)) / 2;
const normalIconContainerSize = 44;
const compactIconContainerSize = 34;
const normalIconSize = 24;
const compactIconSize = 20;

export function BottomTabs({ activeTab, labels, onChange }: BottomTabsProps) {
  const colors = themeColors();
  const theme = getActiveTheme();
  const insets = useSafeAreaInsets();
  const { isBottomNavCompact } = useBottomNav();
  const navProgress = useRef(new Animated.Value(isBottomNavCompact ? 1 : 0)).current;
  const bottomOffset = Platform.OS === 'ios' ? Math.max(insets.bottom - 8, 2) : 4;
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

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
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
  tabPressable: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 0,
    paddingVertical: tabVerticalPadding,
  },
  tabItem: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  iconWrap: {
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
