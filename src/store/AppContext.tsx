import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react';

import { translate } from '../i18n';
import type { Language, Settings } from '../models/settings';
import type { Meal } from '../models/meal';
import type { UserProfile } from '../models/profile';
import type { ProgressEntry } from '../models/progress';
import type { Workout } from '../models/workout';
import { getSeedMeals, getSeedProfile, getSeedProgressEntries, getSeedWorkouts } from '../data/seedData';
import { loadMeals, saveMeals } from '../services/mealService';
import { loadProfile, saveProfile } from '../services/profileService';
import { loadProgressEntries, saveProgressEntries } from '../services/progressService';
import { defaultSettings, loadSettings, saveSettings } from '../services/settingsService';
import { loadWorkouts, saveWorkouts } from '../services/workoutService';
import { applyAppDirection } from '../utils/languageDirection';

type AppState = {
  isReady: boolean;
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
};

const initialState: AppState = {
  isReady: false,
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
        isReady: true,
        meals: action.meals,
        workouts: action.workouts,
        profile: action.profile,
        progressEntries: action.progressEntries,
        settings: action.settings,
      };
    case 'addMeal':
      return { ...state, meals: [action.meal, ...state.meals] };
    case 'updateMeal':
      return {
        ...state,
        meals: state.meals.map((meal) => (meal.id === action.meal.id ? action.meal : meal)),
      };
    case 'deleteMeal':
      return {
        ...state,
        meals: state.meals.filter((meal) => meal.id !== action.mealId),
      };
    case 'addWorkout':
      return { ...state, workouts: [action.workout, ...state.workouts] };
    case 'updateWorkout':
      return {
        ...state,
        workouts: state.workouts.map((workout) =>
          workout.id === action.workout.id ? action.workout : workout,
        ),
      };
    case 'deleteWorkout':
      return {
        ...state,
        workouts: state.workouts.filter((workout) => workout.id !== action.workoutId),
      };
    case 'updateProfile':
      return {
        ...state,
        profile: { ...state.profile, ...action.profile },
      };
    case 'addProgressEntry':
      return {
        ...state,
        progressEntries: [action.entry, ...state.progressEntries],
      };
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

  const applyLanguageDirection = useCallback((language: Language) => {
    applyAppDirection(language);
  }, []);

  useEffect(() => {
    async function hydrate() {
      const [savedMeals, savedWorkouts, savedProfile, savedProgressEntries, savedSettings] = await Promise.all([
        loadMeals(),
        loadWorkouts(),
        loadProfile(),
        loadProgressEntries(),
        loadSettings(),
      ]);

      dispatch({
        type: 'hydrate',
        meals: savedMeals ?? getSeedMeals(),
        workouts: savedWorkouts ?? getSeedWorkouts(),
        profile: savedProfile ?? getSeedProfile(),
        progressEntries: savedProgressEntries ?? getSeedProgressEntries(),
        settings: { ...defaultSettings, ...savedSettings },
      });
    }

    hydrate();
  }, []);

  useEffect(() => {
    if (!state.isReady) {
      return;
    }

    applyLanguageDirection(state.settings.selectedLanguage);
  }, [applyLanguageDirection, state.isReady, state.settings.selectedLanguage]);

  useEffect(() => {
    if (state.isReady) {
      saveMeals(state.meals);
    }
  }, [state.isReady, state.meals]);

  useEffect(() => {
    if (state.isReady) {
      saveWorkouts(state.workouts);
    }
  }, [state.isReady, state.workouts]);

  useEffect(() => {
    if (state.isReady) {
      saveProfile(state.profile);
    }
  }, [state.isReady, state.profile]);

  useEffect(() => {
    if (state.isReady) {
      saveProgressEntries(state.progressEntries);
    }
  }, [state.isReady, state.progressEntries]);

  useEffect(() => {
    if (state.isReady) {
      saveSettings(state.settings);
    }
  }, [state.isReady, state.settings]);

  const t = useCallback(
    (key: string, values?: Record<string, string | number>) =>
      translate(state.settings.selectedLanguage, key, values),
    [state.settings.selectedLanguage],
  );

  const setLanguage = useCallback(
    (language: Language) => {
      const nextSettings = { ...state.settings, selectedLanguage: language };

      dispatch({ type: 'updateSettings', settings: { selectedLanguage: language } });
      applyLanguageDirection(language);
      void saveSettings(nextSettings);
    },
    [applyLanguageDirection, state.settings],
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
