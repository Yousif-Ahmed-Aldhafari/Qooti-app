export type AppTheme = {
  isDark: boolean;
  colors: {
    background: string;
    surface: string;
    surfaceMuted: string;
    text: string;
    textMuted: string;
    border: string;
    primary: string;
    primaryMuted: string;
    secondary: string;
    success: string;
    warning: string;
    danger: string;
    tabBar: string;
  };
};

export const lightTheme: AppTheme = {
  isDark: false,
  colors: {
    background: '#F6F7F4',
    surface: '#FFFFFF',
    surfaceMuted: '#EEF2EA',
    text: '#17231E',
    textMuted: '#65716B',
    border: '#DCE3DD',
    primary: '#1F7A5C',
    primaryMuted: '#DCEFE6',
    secondary: '#2D6F8F',
    success: '#2F8B57',
    warning: '#B8791D',
    danger: '#B44545',
    tabBar: '#FFFFFF',
  },
};

export const darkTheme: AppTheme = {
  isDark: true,
  colors: {
    background: '#111815',
    surface: '#18211D',
    surfaceMuted: '#223029',
    text: '#F4F7F2',
    textMuted: '#A9B5AE',
    border: '#304139',
    primary: '#73C8A4',
    primaryMuted: '#244236',
    secondary: '#7EC5E8',
    success: '#78C995',
    warning: '#D9A451',
    danger: '#E07C7C',
    tabBar: '#18211D',
  },
};

export function getTheme(mode: 'light' | 'dark'): AppTheme {
  return mode === 'dark' ? darkTheme : lightTheme;
}
