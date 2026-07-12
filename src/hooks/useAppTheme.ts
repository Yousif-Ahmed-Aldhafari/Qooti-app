import { useColorScheme } from 'react-native';

import { getTheme, resolveThemePreference } from '../theme/colors';
import { useApp } from '../store/AppContext';

export function useAppTheme() {
  const systemColorScheme = useColorScheme();
  const { settings } = useApp();
  const resolvedTheme = resolveThemePreference(settings.themeMode, systemColorScheme);

  return getTheme(resolvedTheme);
}
