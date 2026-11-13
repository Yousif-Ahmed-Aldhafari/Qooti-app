import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, BackHandler, I18nManager, Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomTabs } from '../components/BottomTabs';
import { BottomNavProvider } from '../context/BottomNavContext';
import { sampleSleepEntries, sampleWaterEntries } from '../data/sampleData';
import { ActiveWorkoutScreen } from '../screens/ActiveWorkoutScreen';
import { AddMealScreen } from '../screens/AddMealScreen';
import { AddWorkoutScreen } from '../screens/AddWorkoutScreen';
import { EditWorkoutScreen } from '../screens/EditWorkoutScreen';
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
import { getLocalizationDiagnostics } from '../services/localizationService';
import { saveSettings } from '../services/settingsService';
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
import { applyRTL, flexStart, isRTL, rowStyle, textAlign, writingDirection } from '../utils/rtl';
import { createQuickAddWorkoutDraft } from '../utils/workoutAnalytics';

const mainTabs: TabKey[] = ['home', 'meals', 'workouts', 'progress', 'profile'];

function isMainTab(screen: ScreenKey): screen is TabKey {
  return mainTabs.includes(screen as TabKey);
}

function logDirectionDebug(selectedLanguage: Language) {
  if (typeof __DEV__ !== 'undefined' && !__DEV__) {
    return;
  }

  const diag = getLocalizationDiagnostics(selectedLanguage);
  console.log('[i18n-debug] platform:', diag.platform);
  console.log('[i18n-debug] authoritativeLanguage:', diag.resolvedLanguage);
  console.log('[i18n-debug] primaryTag:', diag.primaryTag);
  console.log('[i18n-debug] isRTL:', diag.isRTL);
  console.log('[i18n-debug] I18nManager.isRTL:', I18nManager.isRTL);
}

export function AppNavigator() {
  const {
    isReady: isAppReady,
    persistenceError,
    clearPersistenceError,
    meals,
    workouts,
    profile,
    progressEntries,
    settings,
    setLanguage: updateLanguage,
    updateSettings,
    updateProfile,
    completeOnboarding: finishOnboardingInContext,
    addMeal,
    addWorkout,
    updateWorkout,
    deleteWorkout,
    activeSession,
    interruptedSessions,
    startActiveWorkout,
    pauseActiveWorkout,
    resumeActiveWorkout,
    completeSetInSession,
    skipSetInSession,
    addSetToSession,
    finishActiveWorkout,
    discardActiveWorkout,
    updateActiveSessionRestTarget,
    resumeInterruptedSession,
    archiveInterruptedSession,
    discardInterruptedSession,
    migrationConflict,
    resolveMigrationConflict,
    t,
  } = useApp();

  const [showSplash, setShowSplash] = useState(true);
  const [isSwitchingLanguage, setIsSwitchingLanguage] = useState(false);
  const isTransitioningRef = useRef(false);
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [activeScreen, setActiveScreen] = useState<ScreenKey>('home');
  const [selectedMealId, setSelectedMealId] = useState<string | null>(null);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null);
  const [quickAddTemplate, setQuickAddTemplate] = useState<Workout | null>(null);

  const language = settings.selectedLanguage;
  const themePreference: ThemePreference = settings.themeMode;
  const hasOnboarded = settings.hasCompletedOnboarding;

  const selectedMeal = useMemo(() => {
    if (selectedMealId) {
      const match = meals.find((m) => m.id === selectedMealId);
      if (match) {
        return match;
      }
    }
    return null;
  }, [meals, selectedMealId]);

  const selectedWorkout = useMemo(() => {
    if (selectedWorkoutId) {
      const match = workouts.find((w) => w.id === selectedWorkoutId);
      if (match) {
        return match;
      }
    }
    return null;
  }, [workouts, selectedWorkoutId]);

  // Derive effective screen: safely fall back to parent list if selected entity is missing
  const effectiveScreen: ScreenKey = useMemo(() => {
    if (activeScreen === 'mealDetails' && !selectedMeal) {
      return 'meals';
    }
    if ((activeScreen === 'workoutDetails' || activeScreen === 'editWorkout') && !selectedWorkout) {
      return 'workouts';
    }
    if (activeScreen === 'activeWorkout' && !activeSession) {
      return 'workouts';
    }
    return activeScreen;
  }, [activeScreen, selectedMeal, selectedWorkout, activeSession]);

  // Android hardware back handler: prevents accidental app exits on sub-screens
  useEffect(() => {
    const onHardwareBack = () => {
      // 1. If currently on edit workout, back returns to workout details
      if (effectiveScreen === 'editWorkout') {
        setActiveScreen('workoutDetails');
        return true;
      }
      // 1b. If currently on quick-add draft, back returns to source workout details
      if (effectiveScreen === 'addWorkout' && quickAddTemplate) {
        setQuickAddTemplate(null);
        setActiveScreen('workoutDetails');
        return true;
      }
      // 1c. If currently on active workout, back leaves session running safely in background
      if (effectiveScreen === 'activeWorkout') {
        setActiveTab('workouts');
        setActiveScreen('workouts');
        return true;
      }
      // 2. If currently on a detail or form screen, back goes to the active tab
      if (!isMainTab(effectiveScreen)) {
        setActiveScreen(activeTab);
        return true;
      }
      // 3. If on a main tab other than 'home', back navigates to 'home' before exit
      if (activeTab !== 'home') {
        setActiveTab('home');
        setActiveScreen('home');
        return true;
      }
      // 4. Already on 'home': allow OS default (exit application)
      return false;
    };

    const backSubscription = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
    return () => backSubscription.remove();
  }, [activeTab, effectiveScreen, quickAddTemplate]);

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

  useEffect(() => {
    if (isAppReady) {
      logDirectionDebug(language);
    }
  }, [isAppReady, language]);

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
    if (nextLanguage === language || isTransitioningRef.current) {
      return;
    }
    isTransitioningRef.current = true;
    setIsSwitchingLanguage(true);

    try {
      // 1. Complete the SQLite language save before switching authoritative language (Correction 7)
      await saveSettings({ ...settings, selectedLanguage: nextLanguage });

      // 2. Switch authoritative language in AppContext state
      updateLanguage(nextLanguage);
      applyRTL(nextLanguage);
      logDirectionDebug(nextLanguage);
    } catch (err) {
      console.warn('[changeLanguage] Failed to persist settings immediately:', err);
    } finally {
      // Dismiss splash when state is ready (Correction 6)
      setIsSwitchingLanguage(false);
      isTransitioningRef.current = false;
    }
  }

  async function changeTheme(nextThemePreference: ThemePreference) {
    updateSettings({ themeMode: nextThemePreference });
  }

  function openMealDetails(meal: Meal) {
    setSelectedMealId(meal.id);
    setActiveScreen('mealDetails');
  }

  function saveMeal(meal: Meal) {
    addMeal(meal);
    setSelectedMealId(meal.id);
    setActiveTab('meals');
    setActiveScreen('mealDetails');
  }

  function openWorkoutDetails(workout: Workout) {
    setSelectedWorkoutId(workout.id);
    setActiveScreen('workoutDetails');
  }

  async function saveWorkout(workout: Workout) {
    await addWorkout(workout);
    setSelectedWorkoutId(workout.id);
    setActiveTab('workouts');
    setActiveScreen('workoutDetails');
  }

  function openEditWorkout(workout: Workout) {
    setSelectedWorkoutId(workout.id);
    setActiveScreen('editWorkout');
  }

  function handleRepeatWorkout(workout: Workout) {
    const draft = createQuickAddWorkoutDraft(workout);
    setQuickAddTemplate(draft);
    setActiveScreen('addWorkout');
  }

  async function handleStartWorkout(workout: Workout) {
    if (activeSession && (activeSession.status === 'active' || activeSession.status === 'paused')) {
      if (activeSession.sourceWorkoutId === workout.id) {
        setActiveScreen('activeWorkout');
        return;
      }
      Alert.alert(
        t('workouts.sessionConflictTitle'),
        t('workouts.sessionConflictMessage', { title: activeSession.title }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('workouts.resumeWorkout'),
            onPress: () => setActiveScreen('activeWorkout'),
          },
          {
            text: t('workouts.discardAndStartNew'),
            style: 'destructive',
            onPress: async () => {
              await discardActiveWorkout();
              await startActiveWorkout(workout);
              setActiveScreen('activeWorkout');
            },
          },
        ],
        { cancelable: true }
      );
      return;
    }

    await startActiveWorkout(workout);
    setActiveScreen('activeWorkout');
  }

  async function handleUpdateWorkout(updatedWorkout: Workout) {
    await updateWorkout(updatedWorkout);
    setSelectedWorkoutId(updatedWorkout.id);
    setActiveScreen('workoutDetails');
  }

  async function handleDeleteWorkout(workoutToDelete: Workout) {
    await deleteWorkout(workoutToDelete.id);
    setSelectedWorkoutId(null);
    setActiveScreen('workouts');
  }

  function goBack() {
    if (effectiveScreen === 'editWorkout') {
      setActiveScreen('workoutDetails');
      return;
    }
    if (effectiveScreen === 'addWorkout' && quickAddTemplate) {
      setQuickAddTemplate(null);
      if (selectedWorkoutId) {
        setActiveScreen('workoutDetails');
        return;
      }
    }
    setActiveScreen(activeTab);
  }

  function renderActiveScreen() {
    if (!hasOnboarded) {
      return (
        <OnboardingScreen
          key={language}
          t={t}
          profile={profile}
          onUpdateProfile={updateProfile}
          onDone={finishOnboarding}
        />
      );
    }

    switch (effectiveScreen) {
      case 'home':
        return (
          <HomeScreen
            key={language}
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
        return (
          <MealsScreen
            key={language}
            t={t}
            meals={meals}
            profile={profile}
            onAddMeal={() => setActiveScreen('addMeal')}
            onMealPress={openMealDetails}
          />
        );
      case 'addMeal':
        return <AddMealScreen key={language} t={t} onSave={saveMeal} />;
      case 'mealDetails':
        if (!selectedMeal) {
          return <MealsScreen key={language} t={t} meals={meals} onAddMeal={() => setActiveScreen('addMeal')} onMealPress={openMealDetails} />;
        }
        return <MealDetailsScreen key={language} t={t} meal={selectedMeal} profile={profile} />;
      case 'workouts':
        return (
          <WorkoutsScreen
            key={language}
            t={t}
            language={language}
            workouts={workouts}
            activeSession={activeSession}
            onResumeSession={() => setActiveScreen('activeWorkout')}
            interruptedSessions={interruptedSessions}
            onResumeInterruptedSession={async (sessionId, currentAction) => {
              await resumeInterruptedSession(sessionId, currentAction);
              setActiveScreen('activeWorkout');
            }}
            onArchiveInterruptedSession={archiveInterruptedSession}
            onDiscardInterruptedSession={discardInterruptedSession}
            onAddWorkout={() => {
              setQuickAddTemplate(null);
              setActiveScreen('addWorkout');
            }}
            onWorkoutPress={openWorkoutDetails}
          />
        );
      case 'addWorkout':
        return (
          <AddWorkoutScreen
            key={`${language}-${quickAddTemplate ? quickAddTemplate.id : 'new'}`}
            t={t}
            language={language}
            initialWorkout={quickAddTemplate}
            onSave={async (workout) => {
              await saveWorkout(workout);
              setQuickAddTemplate(null);
            }}
            onCancel={() => {
              setQuickAddTemplate(null);
              if (selectedWorkoutId) {
                setActiveScreen('workoutDetails');
              } else {
                setActiveScreen('workouts');
              }
            }}
          />
        );
      case 'workoutDetails':
        if (!selectedWorkout) {
          return (
            <WorkoutsScreen
              key={language}
              t={t}
              language={language}
              workouts={workouts}
              onAddWorkout={() => {
                setQuickAddTemplate(null);
                setActiveScreen('addWorkout');
              }}
              onWorkoutPress={openWorkoutDetails}
            />
          );
        }
        return (
          <WorkoutDetailsScreen
            key={language}
            t={t}
            workout={selectedWorkout}
            onEdit={openEditWorkout}
            onDelete={handleDeleteWorkout}
            onRepeat={handleRepeatWorkout}
            onStartWorkout={handleStartWorkout}
          />
        );
      case 'activeWorkout':
        if (!activeSession) {
          return (
            <WorkoutsScreen
              key={language}
              t={t}
              language={language}
              workouts={workouts}
              onAddWorkout={() => {
                setQuickAddTemplate(null);
                setActiveScreen('addWorkout');
              }}
              onWorkoutPress={openWorkoutDetails}
            />
          );
        }
        return (
          <ActiveWorkoutScreen
            key={`${language}-${activeSession.id}`}
            t={t}
            language={language}
            session={activeSession}
            onPause={pauseActiveWorkout}
            onResume={resumeActiveWorkout}
            onCompleteSet={completeSetInSession}
            onSkipSet={skipSetInSession}
            onAddSet={addSetToSession}
            onSetRestTarget={updateActiveSessionRestTarget}
            onFinish={async (notes) => {
              await finishActiveWorkout(notes);
              setActiveTab('workouts');
              setActiveScreen('workouts');
            }}
            onDiscard={async () => {
              await discardActiveWorkout();
              setActiveTab('workouts');
              setActiveScreen('workouts');
            }}
            onLeave={() => {
              setActiveTab('workouts');
              setActiveScreen('workouts');
            }}
          />
        );
      case 'editWorkout':
        if (!selectedWorkout) {
          return <WorkoutsScreen key={language} t={t} workouts={workouts} onAddWorkout={() => setActiveScreen('addWorkout')} onWorkoutPress={openWorkoutDetails} />;
        }
        return (
          <EditWorkoutScreen
            key={`${language}-${selectedWorkout.id}`}
            t={t}
            language={language}
            workout={selectedWorkout}
            onSave={handleUpdateWorkout}
            onCancel={() => setActiveScreen('workoutDetails')}
          />
        );
      case 'progress':
        return <ProgressScreen key={language} t={t} profile={profile} progress={progressEntries} />;
      case 'profile':
        return (
          <ProfileScreen
            key={language}
            t={t}
            profile={profile}
            onSettingsPress={() => setActiveScreen('settings')}
            onUpdateProfile={updateProfile}
          />
        );
      case 'settings':
        return (
          <SettingsScreen
            key={language}
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

  const showTabs = hasOnboarded && isMainTab(effectiveScreen);
  const showBack = hasOnboarded && !isMainTab(effectiveScreen) && effectiveScreen !== 'activeWorkout';
  const rtl = isRTL(language);
  setActiveTheme(resolvedTheme);
  const palette = themeColors();
  const directionalText = {
    textAlign: textAlign(language),
    writingDirection: writingDirection(language),
  } as const;

  if (migrationConflict) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: palette.background }]} edges={['top', 'bottom']}>
        <View style={styles.conflictContainer}>
          <Ionicons name="alert-circle" size={48} color={palette.warning} />
          <Text style={[styles.conflictTitle, directionalText, { color: palette.text }]}>
            {t('workouts.preMigrationConflictTitle')}
          </Text>
          <Text style={[styles.conflictSubtitle, directionalText, { color: palette.textMuted }]}>
            {t('workouts.preMigrationConflictMessage')}
          </Text>
          <ScrollView style={styles.conflictScroll} contentContainerStyle={styles.conflictScrollContent}>
            {migrationConflict.conflicts.map((session) => (
              <View
                key={session.id}
                style={[
                  styles.conflictCard,
                  {
                    backgroundColor: palette.card,
                    borderColor: palette.border,
                  },
                ]}
              >
                <Text style={[styles.conflictSessionTitle, directionalText, { color: palette.text }]}>
                  {session.title || 'Untitled Workout'}
                </Text>
                <Text style={[styles.conflictSessionMeta, directionalText, { color: palette.textMuted }]}>
                  {session.startedAt}
                </Text>
                <View style={[styles.conflictActionsRow, { flexDirection: 'row', gap: 8, marginTop: 8 }]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('workouts.resume')}
                    style={[styles.conflictActionBtn, { backgroundColor: palette.accent, flex: 1 }]}
                    onPress={() =>
                      resolveMigrationConflict({
                        resumeSessionId: session.id,
                        actionForOthers: 'keep_interrupted',
                      })
                    }
                  >
                    <Text style={styles.conflictActionBtnText}>
                      {t('workouts.resume')}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('workouts.archiveSession')}
                    style={[styles.conflictActionBtn, { backgroundColor: palette.cardMuted, flex: 1 }]}
                    onPress={() =>
                      resolveMigrationConflict({
                        sessionResolutions: { [session.id]: 'archive' },
                        actionForOthers: 'keep_interrupted',
                      })
                    }
                  >
                    <Text style={[styles.conflictActionBtnText, { color: palette.text }]}>
                      {t('workouts.archiveSession')}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </ScrollView>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('workouts.keepAllRecoverable')}
            style={styles.conflictKeepAllBtn}
            onPress={() => resolveMigrationConflict({ actionForOthers: 'keep_interrupted' })}
          >
            <Text style={[styles.conflictKeepAllText, { color: palette.accent }]}>
              {t('workouts.keepAllRecoverable')}
            </Text>
          </Pressable>
        </View>
        <StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'} />
      </SafeAreaView>
    );
  }

  if (!isAppReady || showSplash || isSwitchingLanguage) {
    return (
      <View style={[styles.root, { backgroundColor: palette.background }]}>
        <SplashScreen t={t} />
        <StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'} />
      </View>
    );
  }

  return (
    <BottomNavProvider>
      <SafeAreaView style={[styles.root, { backgroundColor: palette.background }]} edges={['top']}>
        <View style={[styles.screenSlot, { backgroundColor: palette.background }]}>
          {persistenceError ? (
            <View style={[styles.errorBanner, { backgroundColor: palette.card, borderColor: '#F59E0B' }]}>
              <View style={[styles.errorContent, rowStyle(language)]}>
                <Ionicons name="warning-outline" size={20} color="#F59E0B" />
                <Text style={[styles.errorText, directionalText, { color: palette.text }]} numberOfLines={2}>
                  {persistenceError}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('workouts.dismissStorageError')}
                  onPress={clearPersistenceError}
                  style={styles.errorDismiss}
                >
                  <Ionicons name="close-circle-outline" size={20} color={palette.textMuted} />
                </Pressable>
              </View>
            </View>
          ) : null}
          {showBack ? (
            <Pressable
              accessibilityRole="button"
              onPress={goBack}
              style={({ pressed }) => [
                styles.backButton,
                {
                  alignSelf: flexStart(language),
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

        {showTabs ? <BottomTabs key={language} language={language} activeTab={activeTab} labels={tabLabels} onChange={selectTab} /> : null}
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
  errorBanner: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  errorContent: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  errorText: {
    flex: 1,
    ...typography.caption,
  },
  errorDismiss: {
    padding: spacing.xs,
  },
  conflictContainer: {
    flex: 1,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
    justifyContent: 'center',
  },
  conflictTitle: {
    ...typography.h2,
    fontWeight: '700',
    textAlign: 'center',
  },
  conflictSubtitle: {
    ...typography.body,
    textAlign: 'center',
  },
  conflictScroll: {
    width: '100%',
    maxHeight: 320,
    marginTop: spacing.md,
  },
  conflictScrollContent: {
    gap: spacing.md,
  },
  conflictCard: {
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.xs,
  },
  conflictSessionTitle: {
    ...typography.h3,
    fontSize: 16,
    fontWeight: '700',
  },
  conflictSessionMeta: {
    ...typography.caption,
  },
  conflictActionBtn: {
    marginTop: spacing.sm,
    minHeight: 44,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  conflictActionBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  conflictActionsRow: {
    gap: spacing.sm,
  },
  conflictKeepAllBtn: {
    minHeight: 44,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  conflictKeepAllText: {
    ...typography.body,
    fontWeight: '600',
  },
});
