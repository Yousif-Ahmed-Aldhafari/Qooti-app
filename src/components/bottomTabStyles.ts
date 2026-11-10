import { StyleSheet } from 'react-native';
import { radius } from '../theme/radius';

export const normalNavHorizontalInset = 16;
export const compactNavHorizontalInset = 42;
export const normalNavHeight = 64;
export const compactNavHeight = 52;
export const normalNavRadius = normalNavHeight / 2;
export const compactNavRadius = compactNavHeight / 2;
export const normalNavPaddingX = 4;
export const compactNavPaddingX = 2;
export const tabVerticalPadding = 2;
export const normalActiveButtonRadius = (normalNavHeight - (tabVerticalPadding * 2)) / 2;
export const compactActiveButtonRadius = (compactNavHeight - (tabVerticalPadding * 2)) / 2;
export const normalIconContainerSize = 44;
export const compactIconContainerSize = 34;
export const normalIconSize = 24;
export const compactIconSize = 20;

export function calculateBottomNavOffset(bottomInset: number, platform: string = 'android'): number {
  if (platform === 'ios') {
    return Math.max(bottomInset - 8, 2);
  }
  // Android & others:
  // If system navigation bar exists (insets.bottom > 0, whether gesture bar ~16-24dp or 3-button ~48dp),
  // lift the floating bar above the system navigation bar with an aesthetic gap (+8dp).
  // If insets.bottom is 0, provide a comfortable default bottom margin (12dp).
  return bottomInset > 0 ? bottomInset + 8 : 12;
}

export const bottomTabStyles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  glass: {
    flex: 1,
    flexDirection: 'row',
    direction: 'ltr',
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
