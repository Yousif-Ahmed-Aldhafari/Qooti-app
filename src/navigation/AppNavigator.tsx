import { useEffect, useMemo, useState } from 'react';
import { Alert, DevSettings, I18nManager, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomTabs } from '../components/BottomTabs';
import { BottomNavProvider } from '../context/BottomNavContext';
import { sampleSleepEntries, sampleWaterEntries, sampleProgress } from '../data/sampleData';
import { translate } from '../i18n';
import { AddMealScreen } from '../screens/AddMealScreen';
import { AddWorkoutScreen } from '../screens/AddWorkoutScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { MealDetailsScreen } from '../screens/MealDetailsScreen';
import { MealsScreen } from '../screens/MealsScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { ProgressScreen } from '../screens/ProgressScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { SplashScreen } from '../screens/SplashScreen';
import { WorkoutDetailsScreen } from '../screens/WorkoutDetailsScreen';
import { WorkoutsScreen } from '../screens/WorkoutsScreen';
import { useApp } from '../store/AppContext';
import {
  resolveThemePreference,
  setActiveTheme,
  themeColors,
  type ThemePreference,
} from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import type { Language, Meal, ScreenKey, TabKey, Workout } from '../types';
import { applyRTL, direction, isRTL, rowStyle, textAlign, writingDirection } from '../utils/rtl';

const mainTabs: TabKey[] = ['home', 'meals', 'workouts', 'progress', 'profile'];

function isMainTab(screen: ScreenKey): screen is TabKey {
  return mainTabs.includes(screen as TabKey);
}

function logDirectionDebug(selectedLanguage: Language) {
  if (typeof __DEV__ !== 'undefined' && !__DEV__) {
    return;
  }

  const shouldBeRTL = isRTL(selectedLanguage);
  console.log('selectedLanguage:', selectedLanguage);
  console.log('isRTL:', shouldBeRTL);
  console.log('I18nManager.isRTL:', I18nManager.isRTL);
  console.log('resolved direction:', shouldBeRTL ? 'rtl' : 'ltr');
}

export function AppNavigator() {
  const {
    isReady: isAppReady,
    meals,
    workouts,
    profile,
    progressEntries,
    settings,
    setLanguage: updateLanguage,
    updateSettings,
    completeOnboarding: finishOnboardingInContext,
    addMeal,
    addWorkout,
    t,
  } = useApp();

  const [showSplash, setShowSplash] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [activeScreen, setActiveScreen] = useState<ScreenKey>('home');
  const [selectedMealState, setSelectedMealState] = useState<Meal | null>(null);
  const [selectedWorkoutState, setSelectedWorkoutState] = useState<Workout | null>(null);

  const language = settings.selectedLanguage;
  const themePreference: ThemePreference = settings.themeMode;
  const hasOnboarded = settings.hasCompletedOnboarding;

  const selectedMeal = selectedMealState ?? meals[0] ?? null;
  const selectedWorkout = selectedWorkoutState ?? workouts[0] ?? null;

  const systemColorScheme = useColorScheme();
  const resolvedTheme = useMemo(
    () => resolveThemePreference(themePreference, systemColorScheme),
    [systemColorScheme, themePreference],
  );

  const tabLabels = useMemo(
    () => ({
      home: t('tabs.home'),
      meals: t('tabs.meals'),
      workouts: t('tabs.workouts'),
      progress: t('tabs.progress'),
      profile: t('tabs.profile'),
    }),
    [t],
  );

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 950);
    return () => clearTimeout(timer);
  }, []);

  function selectTab(tab: TabKey) {
    setActiveTab(tab);
    setActiveScreen(tab);
  }

  function finishOnboarding() {
    finishOnboardingInContext();
    setActiveTab('home');
    setActiveScreen('home');
  }

  async function changeLanguage(nextLanguage: Language) {
    const restartRequired = applyRTL(nextLanguage);
    logDirectionDebug(nextLanguage);
    updateLanguage(nextLanguage);

    if (restartRequired) {
      Alert.alert(
        translate(nextLanguage, 'settings.restartTitle'),
        translate(nextLanguage, 'settings.restartMessage'),
        [
          {
            text: translate(nextLanguage, 'settings.restartAction'),
            onPress: () => {
              if (typeof DevSettings.reload === 'function') {
                DevSettings.reload();
              }
            },
          },
        ],
      );
    }
  }

  async function changeTheme(nextThemePreference: ThemePreference) {
    updateSettings({ themeMode: nextThemePreference });
  }

  function openMealDetails(meal: Meal) {
    setSelectedMealState(meal);
    setActiveScreen('mealDetails');
  }

  function saveMeal(meal: Meal) {
    addMeal(meal);
    setSelectedMealState(meal);
    setActiveTab('meals');
    setActiveScreen('mealDetails');
  }

  function openWorkoutDetails(workout: Workout) {
    setSelectedWorkoutState(workout);
    setActiveScreen('workoutDetails');
  }

  function saveWorkout(workout: Workout) {
    addWorkout(workout);
    setSelectedWorkoutState(workout);
    setActiveTab('workouts');
    setActiveScreen('workoutDetails');
  }

  function goBack() {
    setActiveScreen(activeTab);
  }

  function renderActiveScreen() {
    if (!hasOnboarded) {
      return <OnboardingScreen t={t} onDone={finishOnboarding} />;
    }

    switch (activeScreen) {
      case 'home':
        return (
          <HomeScreen
            t={t}
            profile={profile}
            meals={meals}
            workouts={workouts}
            sleepEntries={sampleSleepEntries}
            waterEntries={sampleWaterEntries}
            onAddMeal={() => setActiveScreen('addMeal')}
            onAddWorkout={() => setActiveScreen('addWorkout')}
            onMealPress={openMealDetails}
            onWorkoutPress={openWorkoutDetails}
          />
        );
      case 'meals':
        return <MealsScreen t={t} meals={meals} onAddMeal={() => setActiveScreen('addMeal')} onMealPress={openMealDetails} />;
      case 'addMeal':
        return <AddMealScreen t={t} onSave={saveMeal} />;
      case 'mealDetails':
        return selectedMeal ? <MealDetailsScreen t={t} meal={selectedMeal} profile={profile} /> : null;
      case 'workouts':
        return <WorkoutsScreen t={t} workouts={workouts} onAddWorkout={() => setActiveScreen('addWorkout')} onWorkoutPress={openWorkoutDetails} />;
      case 'addWorkout':
        return <AddWorkoutScreen t={t} onSave={saveWorkout} />;
      case 'workoutDetails':
        return selectedWorkout ? <WorkoutDetailsScreen t={t} workout={selectedWorkout} /> : null;
      case 'progress':
        return <ProgressScreen t={t} profile={profile} progress={progressEntries.length ? progressEntries : sampleProgress} />;
      case 'profile':
        return <ProfileScreen t={t} profile={profile} onSettingsPress={() => setActiveScreen('settings')} />;
      case 'settings':
        return (
          <SettingsScreen
            t={t}
            language={language}
            themePreference={themePreference}
            resolvedTheme={resolvedTheme}
            onLanguageChange={changeLanguage}
            onThemeChange={changeTheme}
          />
        );
      default:
        return null;
    }
  }

  const showTabs = hasOnboarded && isMainTab(activeScreen);
  const showBack = hasOnboarded && !isMainTab(activeScreen);
  const layoutDirection = direction(language);
  const rtl = isRTL(language);
  setActiveTheme(resolvedTheme);
  const palette = themeColors();
  const directionalText = {
    textAlign: textAlign(language),
    writingDirection: writingDirection(language),
  } as const;

  if (!isAppReady || showSplash) {
    return (
      <View style={[styles.root, { direction: layoutDirection, backgroundColor: palette.background }]}>
        <SplashScreen t={t} />
        <StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'} />
      </View>
    );
  }

  return (
    <BottomNavProvider>
      <SafeAreaView style={[styles.root, { direction: layoutDirection, backgroundColor: palette.background }]} edges={['top']}>
        <View style={[styles.screenSlot, { backgroundColor: palette.background }]}>
          {showBack ? (
            <Pressable
              accessibilityRole="button"
              onPress={goBack}
              style={({ pressed }) => [
                styles.backButton,
                {
                  alignSelf: 'flex-start',
                  ...rowStyle(language),
                  backgroundColor: palette.cardMuted,
                  opacity: pressed ? 0.72 : 1,
                },
              ]}
            >
              <Ionicons name={rtl ? 'chevron-forward' : 'chevron-back'} size={20} color={palette.text} />
              <Text style={[styles.backText, directionalText, { color: palette.text }]}>{t('common.back')}</Text>
            </Pressable>
          ) : null}
          {renderActiveScreen()}
        </View>

        {showTabs ? <BottomTabs activeTab={activeTab} labels={tabLabels} onChange={selectTab} /> : null}
        <StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'} />
      </SafeAreaView>
    </BottomNavProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  screenSlot: {
    flex: 1,
  },
  backButton: {
    minHeight: 44,
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.pill,
    marginHorizontal: spacing.xl,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  backText: {
    ...typography.caption,
  },
});
