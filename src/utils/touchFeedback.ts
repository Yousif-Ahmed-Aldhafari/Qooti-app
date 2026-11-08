import type { ColorValue, Insets, PressableAndroidRippleConfig } from 'react-native';
import { Platform } from 'react-native';

export type PressableFeedbackOptions = {
  rippleColor?: ColorValue;
  borderless?: boolean;
  activeOpacity?: number;
  disabled?: boolean;
};

/**
 * Returns platform-appropriate press feedback for Pressable components:
 * - On Android: Bounded or borderless ripple, with no opacity change when ripple is active.
 * - On iOS: Smooth opacity change on press (defaulting to 0.76).
 * - When disabled: No ripple and full opacity (or handled via parent disabled styling).
 */
export function getPressFeedback({
  rippleColor,
  borderless = false,
  activeOpacity = 0.76,
  disabled = false,
}: PressableFeedbackOptions = {}) {
  const isAndroid = Platform.OS === 'android';

  const androidRipple: PressableAndroidRippleConfig | undefined =
    isAndroid && !disabled && rippleColor
      ? {
          color: rippleColor,
          borderless,
        }
      : undefined;

  const styleModifier = ({ pressed }: { pressed: boolean }) => {
    if (disabled) {
      return { opacity: 0.5 };
    }
    // On iOS, apply opacity dimming. On Android, if ripple is configured, avoid double-feedback.
    if (pressed) {
      return isAndroid && rippleColor ? { opacity: 1 } : { opacity: activeOpacity };
    }
    return { opacity: 1 };
  };

  return {
    android_ripple: androidRipple,
    styleModifier,
  };
}

/**
 * Standard minimum touch target sizes:
 * - Android Material Design 3: 48x48dp
 * - iOS Apple HIG: 44x44pt
 */
export const MIN_TOUCH_TARGET = {
  android: 48,
  ios: 44,
} as const;

export function getMinTouchTarget(platform: string = Platform.OS): number {
  return platform === 'ios' ? MIN_TOUCH_TARGET.ios : MIN_TOUCH_TARGET.android;
}

/**
 * Computes an Insets hitSlop object to expand smaller visual elements (e.g., 36-40dp icons)
 * to satisfy the platform minimum touch target (44pt on iOS, 48dp on Android).
 */
export function calculateHitSlop(
  currentWidth: number,
  currentHeight: number,
  platform: string = Platform.OS,
): Insets | undefined {
  const minTarget = getMinTouchTarget(platform);
  const deltaX = Math.max(0, minTarget - currentWidth);
  const deltaY = Math.max(0, minTarget - currentHeight);

  if (deltaX === 0 && deltaY === 0) {
    return undefined;
  }

  const horizontal = Math.ceil(deltaX / 2);
  const vertical = Math.ceil(deltaY / 2);

  return {
    top: vertical,
    bottom: vertical,
    left: horizontal,
    right: horizontal,
  };
}
