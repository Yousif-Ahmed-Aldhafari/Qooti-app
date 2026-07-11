import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react';
import { I18nManager } from 'react-native';

import { translate } from '../i18n';
import type { Language, Settings } from '../models/settings';
import type { Meal } from '../models/meal';
import type { Workout } from '../models/workout';
import { getSeedMeals, getSeedWorkouts } from '../data/seedData';
import { loadMeals, saveMeals } from '../services/mealService';
import { defaultSettings, loadSettings, saveSettings } from '../services/settingsService';
import { loadWorkouts, saveWorkouts } from '../services/workoutService';

type AppState = {
  isReady: boolean;
  meals: Meal[];
  workouts: Workout[];
  settings: Settings;
};

type AppAction =
  | { type: 'hydrate'; meals: Meal[]; workouts: Workout[]; settings: Settings }
  | { type: 'addMeal'; meal: Meal }
  | { type: 'updateMeal'; meal: Meal }
  | { type: 'deleteMeal'; mealId: string }
  | { type: 'addWorkout'; workout: Workout }
  | { type: 'updateWorkout'; workout: Workout }
  | { type: 'deleteWorkout'; workoutId: string }
  | { type: 'updateSettings'; settings: Partial<Settings> };

type AppContextValue = AppState & {
  t: (key: string, values?: Record<string, string | number>) => string;
  setLanguage: (language: Language) => void;
  completeOnboarding: () => void;
  addMeal: (meal: Meal) => void;
  updateMeal: (meal: Meal) => void;
  deleteMeal: (mealId: string) => void;
  addWorkout: (workout: Workout) => void;
  updateWorkout: (workout: Workout) => void;
  deleteWorkout: (workoutId: string) => void;
  updateSettings: (settings: Partial<Settings>) => void;
};

const initialState: AppState = {
  isReady: false,
  meals: [],
  workouts: [],
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

  useEffect(() => {
    async function hydrate() {
      const [savedMeals, savedWorkouts, savedSettings] = await Promise.all([
        loadMeals(),
        loadWorkouts(),
        loadSettings(),
      ]);

      dispatch({
        type: 'hydrate',
        meals: savedMeals ?? getSeedMeals(),
        workouts: savedWorkouts ?? getSeedWorkouts(),
        settings: { ...defaultSettings, ...savedSettings },
      });
    }

    hydrate();
  }, []);

  useEffect(() => {
    const isRTL = state.settings.selectedLanguage === 'ar';
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(isRTL);
  }, [state.settings.selectedLanguage]);

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
      saveSettings(state.settings);
    }
  }, [state.isReady, state.settings]);

  const t = useCallback(
    (key: string, values?: Record<string, string | number>) =>
      translate(state.settings.selectedLanguage, key, values),
    [state.settings.selectedLanguage],
  );

  const value = useMemo<AppContextValue>(
    () => ({
      ...state,
      t,
      setLanguage: (language) => dispatch({ type: 'updateSettings', settings: { selectedLanguage: language } }),
      completeOnboarding: () =>
        dispatch({ type: 'updateSettings', settings: { hasCompletedOnboarding: true } }),
      addMeal: (meal) => dispatch({ type: 'addMeal', meal }),
      updateMeal: (meal) => dispatch({ type: 'updateMeal', meal }),
      deleteMeal: (mealId) => dispatch({ type: 'deleteMeal', mealId }),
      addWorkout: (workout) => dispatch({ type: 'addWorkout', workout }),
      updateWorkout: (workout) => dispatch({ type: 'updateWorkout', workout }),
      deleteWorkout: (workoutId) => dispatch({ type: 'deleteWorkout', workoutId }),
      updateSettings: (settings) => dispatch({ type: 'updateSettings', settings }),
    }),
    [state, t],
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
