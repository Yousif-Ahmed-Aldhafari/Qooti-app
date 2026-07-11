import { useColorScheme } from 'react-native';

import { getTheme } from '../theme/colors';
import { useApp } from '../store/AppContext';

export function useAppTheme() {
  const systemTheme = useColorScheme();
  const { settings } = useApp();
  const selectedTheme =
    settings.themeMode === 'system' ? (systemTheme === 'dark' ? 'dark' : 'light') : settings.themeMode;

  return getTheme(selectedTheme);
}
