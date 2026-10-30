import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';

import { translate } from '../i18n';
import type { Language, Settings } from '../models/settings';
import { normalizeMeal, type Meal } from '../models/meal';
import { normalizeProfile, type UserProfile } from '../models/profile';
import { normalizeProgressEntry, type ProgressEntry } from '../models/progress';
import { normalizeWorkout, type Workout } from '../models/workout';
import { getSeedMeals, getSeedProfile, getSeedProgressEntries, getSeedWorkouts } from '../data/seedData';
import { loadMeals, saveMeals } from '../services/mealService';
import { loadProfile, saveProfile } from '../services/profileService';
import { loadProgressEntries, saveProgressEntries } from '../services/progressService';
import { defaultSettings, loadSettings, saveSettings } from '../services/settingsService';
import { loadWorkouts, saveWorkouts } from '../services/workoutService';
import { applyAppDirection } from '../utils/languageDirection';
import { getDatabase, migrateFromAsyncStorage } from '../db';

type AppState = {
  isReady: boolean;
  persistenceError: string | null;
  meals: Meal[];
  workouts: Workout[];
  profile: UserProfile;
  progressEntries: ProgressEntry[];
  settings: Settings;
};

type AppAction =
  | {
      type: 'hydrate';
      meals: Meal[];
      workouts: Workout[];
      profile: UserProfile;
      progressEntries: ProgressEntry[];
      settings: Settings;
    }
  | { type: 'setPersistenceError'; error: string | null }
  | { type: 'addMeal'; meal: Meal }
  | { type: 'updateMeal'; meal: Meal }
  | { type: 'deleteMeal'; mealId: string }
  | { type: 'addWorkout'; workout: Workout }
  | { type: 'updateWorkout'; workout: Workout }
  | { type: 'deleteWorkout'; workoutId: string }
  | { type: 'updateProfile'; profile: Partial<UserProfile> }
  | { type: 'addProgressEntry'; entry: ProgressEntry }
  | { type: 'updateSettings'; settings: Partial<Settings> };

type AppContextValue = AppState & {
  t: (key: string, values?: Record<string, string | number>) => string;
  setLanguage: (language: Language) => void;
  completeOnboarding: () => void;
  login: (email?: string) => void;
  register: (profile: Partial<UserProfile>) => void;
  logout: () => void;
  updateProfile: (profile: Partial<UserProfile>) => void;
  addMeal: (meal: Meal) => void;
  updateMeal: (meal: Meal) => void;
  deleteMeal: (mealId: string) => void;
  addWorkout: (workout: Workout) => void;
  updateWorkout: (workout: Workout) => void;
  deleteWorkout: (workoutId: string) => void;
  addProgressEntry: (entry: ProgressEntry) => void;
  updateSettings: (settings: Partial<Settings>) => void;
  clearPersistenceError: () => void;
};

const initialState: AppState = {
  isReady: false,
  persistenceError: null,
  meals: [],
  workouts: [],
  profile: getSeedProfile(),
  progressEntries: [],
  settings: defaultSettings,
};

const AppContext = createContext<AppContextValue | undefined>(undefined);

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'hydrate':
      return {
        ...state,
        isReady: true,
        meals: action.meals.map(normalizeMeal),
        workouts: action.workouts.map(normalizeWorkout),
        profile: normalizeProfile(action.profile),
        progressEntries: action.progressEntries.map(normalizeProgressEntry),
        settings: action.settings,
      };

    case 'setPersistenceError':
      return {
        ...state,
        persistenceError: action.error,
      };

    case 'addMeal': {
      const normalized = normalizeMeal(action.meal);
      const exists = state.meals.some((m) => m.id === normalized.id);
      const nextMeals = exists
        ? state.meals.map((m) => (m.id === normalized.id ? normalized : m))
        : [normalized, ...state.meals];
      return { ...state, meals: nextMeals };
    }

    case 'updateMeal': {
      const normalized = normalizeMeal(action.meal);
      return {
        ...state,
        meals: state.meals.map((meal) => (meal.id === normalized.id ? normalized : meal)),
      };
    }

    case 'deleteMeal':
      return {
        ...state,
        meals: state.meals.filter((meal) => meal.id !== action.mealId),
      };

    case 'addWorkout': {
      const normalized = normalizeWorkout(action.workout);
      const exists = state.workouts.some((w) => w.id === normalized.id);
      const nextWorkouts = exists
        ? state.workouts.map((w) => (w.id === normalized.id ? normalized : w))
        : [normalized, ...state.workouts];
      return { ...state, workouts: nextWorkouts };
    }

    case 'updateWorkout': {
      const normalized = normalizeWorkout(action.workout);
      return {
        ...state,
        workouts: state.workouts.map((workout) =>
          workout.id === normalized.id ? normalized : workout,
        ),
      };
    }

    case 'deleteWorkout':
      return {
        ...state,
        workouts: state.workouts.filter((workout) => workout.id !== action.workoutId),
      };

    case 'updateProfile': {
      const updated = normalizeProfile({ ...state.profile, ...action.profile });
      return {
        ...state,
        profile: updated,
      };
    }

    case 'addProgressEntry': {
      const normalized = normalizeProgressEntry(action.entry);
      const exists = state.progressEntries.some((p) => p.id === normalized.id);
      const nextEntries = exists
        ? state.progressEntries.map((p) => (p.id === normalized.id ? normalized : p))
        : [normalized, ...state.progressEntries];
      return {
        ...state,
        progressEntries: nextEntries,
      };
    }

    case 'updateSettings':
      return {
        ...state,
        settings: { ...state.settings, ...action.settings },
      };

    default:
      return state;
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Tracks whether state has been initialized from storage to prevent overwriting during hydration
  const isHydratedRef = useRef(false);

  const applyLanguageDirection = useCallback((language: Language) => {
    applyAppDirection(language);
  }, []);

  useEffect(() => {
    let active = true;

    async function hydrate() {
      try {
        // Initialize SQLite and perform one-time migration from legacy storage if needed
        try {
          const db = await getDatabase();
          await migrateFromAsyncStorage(db);
        } catch (dbErr) {
          console.warn('[AppContext] SQLite initialization or migration notice:', dbErr);
        }

        const [savedMeals, savedWorkouts, savedProfile, savedProgressEntries, savedSettings] =
          await Promise.all([
            loadMeals().catch((e) => {
              console.warn('[AppContext] Failed to load meals:', e);
              return null;
            }),
            loadWorkouts().catch((e) => {
              console.warn('[AppContext] Failed to load workouts:', e);
              return null;
            }),
            loadProfile().catch((e) => {
              console.warn('[AppContext] Failed to load profile:', e);
              return null;
            }),
            loadProgressEntries().catch((e) => {
              console.warn('[AppContext] Failed to load progress entries:', e);
              return null;
            }),
            loadSettings().catch((e) => {
              console.warn('[AppContext] Failed to load settings:', e);
              return null;
            }),
          ]);

        if (!active) {
          return;
        }

        const hydratedSettings = { ...defaultSettings, ...(savedSettings || {}) };

        // Determine if this is a fresh first launch (no settings AND no stored data records)
        const isFirstLaunch =
          savedSettings === null &&
          savedMeals === null &&
          savedWorkouts === null &&
          savedProfile === null;

        // If stored data is present (even if empty array []), preserve it. Never overwrite stored empty lists with seed data.
        const initialMeals = savedMeals !== null ? savedMeals : (isFirstLaunch ? getSeedMeals() : []);
        const initialWorkouts =
          savedWorkouts !== null ? savedWorkouts : (isFirstLaunch ? getSeedWorkouts() : []);
        const initialProfile =
          savedProfile !== null ? savedProfile : getSeedProfile();
        const initialProgress =
          savedProgressEntries !== null ? savedProgressEntries : (isFirstLaunch ? getSeedProgressEntries() : []);

        applyAppDirection(hydratedSettings.selectedLanguage);

        dispatch({
          type: 'hydrate',
          meals: initialMeals,
          workouts: initialWorkouts,
          profile: initialProfile,
          progressEntries: initialProgress,
          settings: hydratedSettings,
        });

        // If first launch, persist the initial seed state so subsequent loads recognize existing user data
        if (isFirstLaunch) {
          void Promise.all([
            saveMeals(initialMeals),
            saveWorkouts(initialWorkouts),
            saveProfile(initialProfile),
            saveProgressEntries(initialProgress),
            saveSettings(hydratedSettings),
          ]).catch((err) => {
            console.warn('[AppContext] Failed to persist initial seed state:', err);
          });
        }
      } catch (error) {
        console.error('[AppContext] Critical hydration failure, falling back to safe state:', error);
        if (!active) {
          return;
        }

        // Never seed sample data after an unknown storage failure!
        // Prevent background auto-persist from overwriting potentially intact database records
        isHydratedRef.current = false;

        dispatch({
          type: 'hydrate',
          meals: [],
          workouts: [],
          profile: {
            id: 'user_profile',
            name: '',
            email: '',
            goal: '',
            avatarInitials: '',
            heightCm: 0,
            weightKg: 0,
            targetCalories: 0,
            targetProtein: 0,
            targetCarbs: 0,
            targetFats: 0,
            sleepGoalHours: 0,
            waterGoalLiters: 0,
          },
          progressEntries: [],
          settings: defaultSettings,
        });

        dispatch({
          type: 'setPersistenceError',
          error: error instanceof Error ? error.message : 'Storage initialization failure',
        });
      }
    }

    hydrate();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!state.isReady) {
      return;
    }

    applyLanguageDirection(state.settings.selectedLanguage);
  }, [applyLanguageDirection, state.isReady, state.settings.selectedLanguage]);

  // Persist mutations after initial hydration completes
  useEffect(() => {
    if (!state.isReady) {
      return;
    }
    if (!isHydratedRef.current) {
      return;
    }
    saveMeals(state.meals)
      .then(() => {
        dispatch({ type: 'setPersistenceError', error: null });
      })
      .catch((err) => {
        console.error('[AppContext] Failed to persist meals:', err);
        dispatch({
          type: 'setPersistenceError',
          error: err instanceof Error ? err.message : 'Failed to persist meals',
        });
      });
  }, [state.isReady, state.meals]);

  useEffect(() => {
    if (!state.isReady) {
      return;
    }
    if (!isHydratedRef.current) {
      return;
    }
    saveWorkouts(state.workouts)
      .then(() => {
        dispatch({ type: 'setPersistenceError', error: null });
      })
      .catch((err) => {
        console.error('[AppContext] Failed to persist workouts:', err);
        dispatch({
          type: 'setPersistenceError',
          error: err instanceof Error ? err.message : 'Failed to persist workouts',
        });
      });
  }, [state.isReady, state.workouts]);

  useEffect(() => {
    if (!state.isReady) {
      return;
    }
    if (!isHydratedRef.current) {
      return;
    }
    saveProfile(state.profile)
      .then(() => {
        dispatch({ type: 'setPersistenceError', error: null });
      })
      .catch((err) => {
        console.error('[AppContext] Failed to persist profile:', err);
        dispatch({
          type: 'setPersistenceError',
          error: err instanceof Error ? err.message : 'Failed to persist profile',
        });
      });
  }, [state.isReady, state.profile]);

  useEffect(() => {
    if (!state.isReady) {
      return;
    }
    if (!isHydratedRef.current) {
      return;
    }
    saveProgressEntries(state.progressEntries)
      .then(() => {
        dispatch({ type: 'setPersistenceError', error: null });
      })
      .catch((err) => {
        console.error('[AppContext] Failed to persist progress entries:', err);
        dispatch({
          type: 'setPersistenceError',
          error: err instanceof Error ? err.message : 'Failed to persist progress',
        });
      });
  }, [state.isReady, state.progressEntries]);

  useEffect(() => {
    if (!state.isReady) {
      return;
    }
    if (!isHydratedRef.current) {
      // Mark initial hydration complete so future state changes trigger saves
      isHydratedRef.current = true;
      return;
    }
    saveSettings(state.settings)
      .then(() => {
        dispatch({ type: 'setPersistenceError', error: null });
      })
      .catch((err) => {
        console.error('[AppContext] Failed to persist settings:', err);
        dispatch({
          type: 'setPersistenceError',
          error: err instanceof Error ? err.message : 'Failed to persist settings',
        });
      });
  }, [state.isReady, state.settings]);

  const t = useCallback(
    (key: string, values?: Record<string, string | number>) =>
      translate(state.settings.selectedLanguage, key, values),
    [state.settings.selectedLanguage],
  );

  const setLanguage = useCallback(
    (language: Language) => {
      dispatch({ type: 'updateSettings', settings: { selectedLanguage: language } });
      applyLanguageDirection(language);
    },
    [applyLanguageDirection],
  );

  const value = useMemo<AppContextValue>(
    () => ({
      ...state,
      t,
      setLanguage,
      completeOnboarding: () =>
        dispatch({ type: 'updateSettings', settings: { hasCompletedOnboarding: true } }),
      login: (email) => {
        if (email) {
          dispatch({ type: 'updateProfile', profile: { email } });
        }
        dispatch({ type: 'updateSettings', settings: { isAuthenticated: true } });
      },
      register: (profile) => {
        dispatch({ type: 'updateProfile', profile });
        dispatch({ type: 'updateSettings', settings: { isAuthenticated: true, hasCompletedOnboarding: true } });
      },
      logout: () => dispatch({ type: 'updateSettings', settings: { isAuthenticated: false } }),
      updateProfile: (profile) => dispatch({ type: 'updateProfile', profile }),
      addMeal: (meal) => dispatch({ type: 'addMeal', meal }),
      updateMeal: (meal) => dispatch({ type: 'updateMeal', meal }),
      deleteMeal: (mealId) => dispatch({ type: 'deleteMeal', mealId }),
      addWorkout: (workout) => dispatch({ type: 'addWorkout', workout }),
      updateWorkout: (workout) => dispatch({ type: 'updateWorkout', workout }),
      deleteWorkout: (workoutId) => dispatch({ type: 'deleteWorkout', workoutId }),
      addProgressEntry: (entry) => dispatch({ type: 'addProgressEntry', entry }),
      updateSettings: (settings) => dispatch({ type: 'updateSettings', settings }),
      clearPersistenceError: () => dispatch({ type: 'setPersistenceError', error: null }),
    }),
    [setLanguage, state, t],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error('useApp must be used inside AppProvider');
  }

  return context;
}
