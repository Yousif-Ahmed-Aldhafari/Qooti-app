import { darkTheme } from './darkTheme';
import { lightTheme } from './lightTheme';
import type { AppTheme, ThemeColors, ThemeMode } from './theme';

let activeThemeMode: ThemeMode = 'dark';

const themes: Record<ThemeMode, AppTheme> = {
  light: lightTheme,
  dark: darkTheme,
};

export function setActiveTheme(mode: ThemeMode): void {
  activeThemeMode = mode;
}

export function getActiveThemeMode(): ThemeMode {
  return activeThemeMode;
}

export function getActiveTheme(): AppTheme {
  return themes[activeThemeMode];
}

export function themeColors(): ThemeColors {
  return getActiveTheme().colors;
}

export function getTheme(mode: ThemeMode): AppTheme {
  return themes[mode];
}

export const colors = new Proxy({} as ThemeColors, {
  get(_target, property: string) {
    return themeColors()[property as keyof ThemeColors];
  },
});

export type { AppTheme, ThemeColors, ThemeMode };
