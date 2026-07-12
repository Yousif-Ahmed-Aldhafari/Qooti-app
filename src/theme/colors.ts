import { darkTheme } from './darkTheme';
import { lightTheme } from './lightTheme';
import type { AppTheme, ResolvedTheme, SystemColorScheme, ThemeColors, ThemeMode, ThemePreference } from './theme';

let activeThemeMode: ResolvedTheme = 'light';

const themes: Record<ResolvedTheme, AppTheme> = {
  light: lightTheme,
  dark: darkTheme,
};

export function resolveThemePreference(
  themePreference: ThemePreference,
  systemColorScheme: SystemColorScheme,
): ResolvedTheme {
  if (themePreference === 'system') {
    return systemColorScheme === 'dark' ? 'dark' : 'light';
  }

  return themePreference;
}

export function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function setActiveTheme(mode: ResolvedTheme): void {
  activeThemeMode = mode;
}

export function getActiveThemeMode(): ResolvedTheme {
  return activeThemeMode;
}

export function getActiveTheme(): AppTheme {
  return themes[activeThemeMode];
}

export function themeColors(): ThemeColors {
  return getActiveTheme().colors;
}

export function getTheme(mode: ResolvedTheme): AppTheme {
  return themes[mode];
}

export const colors = new Proxy({} as ThemeColors, {
  get(_target, property: string) {
    return themeColors()[property as keyof ThemeColors];
  },
});

export type { AppTheme, ResolvedTheme, ThemeColors, ThemeMode, ThemePreference };
