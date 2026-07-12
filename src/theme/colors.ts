export type AppTheme = {
  isDark: boolean;
  colors: {
    background: string;
    backgroundAlt: string;
    surface: string;
    surfaceMuted: string;
    text: string;
    textMuted: string;
    border: string;
    primary: string;
    primaryMuted: string;
    secondary: string;
    secondaryMuted: string;
    accent: string;
    accentMuted: string;
    success: string;
    warning: string;
    danger: string;
    tabBar: string;
    shadow: string;
  };
};

export const colors = {
  background: '#181A1B',
  backgroundElevated: '#202324',
  card: '#3E4041',
  cardSoft: '#2B2E30',
  cardMuted: '#26292A',
  text: '#FFFFFF',
  textSecondary: '#C6C7C8',
  textMuted: '#A3A3A3',
  border: '#4B4E50',
  accent: '#D0FF63',
  limeSoft: '#E3F28C',
  accentDark: '#9EDB26',
  purple: '#8C96F2',
  lavender: '#D4B9EF',
  orange: '#FFB85C',
  blue: '#66D9EF',
  green: '#5CE1A8',
  red: '#FF6B7A',
  black: '#0D0F10',
  white: '#FFFFFF',
  shadow: '#000000',
} as const;

export const lightTheme: AppTheme = {
  isDark: false,
  colors: {
    background: '#FCFBF9',
    backgroundAlt: '#F4F6FA',
    surface: '#FFFFFF',
    surfaceMuted: '#F0F4FB',
    text: '#1B1A1A',
    textMuted: '#7A8393',
    border: '#E7ECF4',
    primary: '#3080E3',
    primaryMuted: '#EAF3FF',
    secondary: '#6D5DF6',
    secondaryMuted: '#EFEDFF',
    accent: '#FFBA52',
    accentMuted: '#FFF3DE',
    success: '#24B47E',
    warning: '#FF9F43',
    danger: '#F25767',
    tabBar: '#FFFFFF',
    shadow: '#1B1A1A',
  },
};

export const darkTheme: AppTheme = {
  isDark: true,
  colors: {
    background: '#111827',
    backgroundAlt: '#0F172A',
    surface: '#172033',
    surfaceMuted: '#222E45',
    text: '#F8FAFC',
    textMuted: '#AAB4C5',
    border: '#2D3A54',
    primary: '#6BA8FF',
    primaryMuted: '#1C3557',
    secondary: '#A59BFF',
    secondaryMuted: '#302B58',
    accent: '#FFD27A',
    accentMuted: '#43351E',
    success: '#5CD6A4',
    warning: '#FFBE6B',
    danger: '#FF7B8A',
    tabBar: '#172033',
    shadow: '#000000',
  },
};

export function getTheme(mode: 'light' | 'dark'): AppTheme {
  return mode === 'dark' ? darkTheme : lightTheme;
}
