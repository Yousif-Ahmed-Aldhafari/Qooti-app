export type ResolvedTheme = 'light' | 'dark';
export type ThemePreference = ResolvedTheme | 'system';
export type ThemeMode = ResolvedTheme;
export type SystemColorScheme = ResolvedTheme | null | undefined;

export type ThemeColors = {
  background: string;
  backgroundAlt: string;
  backgroundElevated: string;
  surface: string;
  surfaceMuted: string;
  card: string;
  cardSoft: string;
  cardMuted: string;
  inputBackground: string;
  filterInactiveBackground: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  primary: string;
  primaryMuted: string;
  secondary: string;
  secondaryMuted: string;
  accent: string;
  accentMuted: string;
  limeSoft: string;
  accentDark: string;
  purple: string;
  lavender: string;
  orange: string;
  blue: string;
  green: string;
  red: string;
  success: string;
  warning: string;
  danger: string;
  tabBar: string;
  buttonText: string;
  black: string;
  white: string;
  shadow: string;
};

export type AppTheme = {
  mode: ResolvedTheme;
  isDark: boolean;
  colors: ThemeColors;
};
