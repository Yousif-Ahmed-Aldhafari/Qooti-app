import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppNavigator } from './src/navigation/AppNavigator';
import { AppProvider } from './src/store/AppContext';
import { applyAppDirection } from './src/utils/languageDirection';
import { defaultSettings, loadSettings } from './src/services/settingsService';

export default function App() {
  const [hasAppliedDirection, setHasAppliedDirection] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function bootstrapDirection() {
      const savedSettings = await loadSettings();
      applyAppDirection(savedSettings?.selectedLanguage ?? defaultSettings.selectedLanguage);

      if (isMounted) {
        setHasAppliedDirection(true);
      }
    }

    bootstrapDirection();

    return () => {
      isMounted = false;
    };
  }, []);

  if (!hasAppliedDirection) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <AppProvider>
        <AppNavigator />
        <StatusBar style="auto" />
      </AppProvider>
    </SafeAreaProvider>
  );
}
