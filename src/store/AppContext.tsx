import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';

import { translate } from '../i18n';
import type { Language, Settings } from '../models/settings';
import { normalizeMeal, validateMeal, type Meal } from '../models/meal';
import { normalizeMealTemplate, type MealTemplate, type MealTemplateItem } from '../models/mealTemplate';
import { normalizeProfile, type UserProfile } from '../models/profile';
import { normalizeProgressEntry, type ProgressEntry } from '../models/progress';
import { normalizeWorkout, type Workout } from '../models/workout';
import { BodyMeasurementEntry, BodyWeightEntry } from '../models/biometrics';
import {
  loadAllMeasurements,
  loadAllWeights,
  recordMeasurement,
  recordWeightWithProfileSync,
  updateMeasurement,
  updateWeightWithProfileSync,
  deleteMeasurement,
  deleteWeightWithProfileSync,
} from '../services/bodyTrackingService';
import { compareBodyMeasurementsDescending } from '../utils/measurements';
import { compareBodyWeightsDescending } from '../utils/weight';
import { getSeedMeals, getSeedProfile, getSeedProgressEntries, getSeedWorkouts } from '../data/seedData';
import {
  loadMeals,
  saveMeals,
  insertMeal as insertMealService,
  updateMeal as updateMealService,
  deleteMeal as deleteMealService,
  toggleMealFavorite as toggleMealFavoriteService,
} from '../services/mealService';
import {
  loadMealTemplates,
  insertMealTemplate as insertMealTemplateService,
  updateMealTemplate as updateMealTemplateService,
  deleteMealTemplate as deleteMealTemplateService,
  toggleMealTemplateFavorite as toggleMealTemplateFavoriteService,
  reconfirmMealTemplate as reconfirmMealTemplateService,
} from '../services/mealTemplateService';
import { loadProfile, saveProfile } from '../services/profileService';
import {
  loadProgressEntries,
  saveProgressEntries,
  insertProgressEntry as insertProgressEntryService,
  updateProgressEntry as updateProgressEntryService,
  deleteProgressEntry as deleteProgressEntryService,
} from '../services/progressService';
import { resolveAuthoritativeLanguage } from '../services/localizationService';
import { defaultSettings, loadSettings, saveSettings } from '../services/settingsService';
import {
  loadWorkouts,
  saveWorkouts,
  insertWorkout as insertWorkoutService,
  updateWorkout as updateWorkoutService,
  deleteWorkout as deleteWorkoutService,
} from '../services/workoutService';
import { MigrationSessionConflictError, type WorkoutSession } from '../models/workoutSession';
import {
  getActiveWorkoutSession,
  startWorkoutSession,
  pauseWorkoutSession,
  resumeWorkoutSession,
  completeSessionSet,
  skipSessionSet,
  addSessionSet,
  finishWorkoutSession,
  discardWorkoutSession,
  setSessionRestTarget,
  getInterruptedWorkoutSessions,
  resumeInterruptedWorkoutSession,
  archiveInterruptedWorkoutSession,
} from '../services/workoutSessionService';
import { applyAppDirection, isRTLLanguage } from '../utils/languageDirection';
import {
  getDatabase,
  getDatabaseConnectionOnly,
  migrateFromAsyncStorage,
  reconcileLegacyProgressWeights,
  reconcilePreMigrationConflicts,
  type PreMigrationResolution,
} from '../db';

export type MigrationConflictInfo = {
  conflicts: { id: string; title: string; startedAt: string; status?: string }[];
  error: string;
};

export type AppStateData = {
  isReady: boolean;
  persistenceError: string | null;
  migrationConflict: MigrationConflictInfo | null;
  meals: Meal[];
  mealTemplates: MealTemplate[];
  workouts: Workout[];
  profile: UserProfile;
  progressEntries: ProgressEntry[];
  bodyWeights: BodyWeightEntry[];
  bodyMeasurements: BodyMeasurementEntry[];
  settings: Settings;
  activeSession: WorkoutSession | null;
  interruptedSessions: WorkoutSession[];
};

export type AppAction =
  | {
      type: 'hydrate';
      meals: Meal[];
      mealTemplates?: MealTemplate[];
      workouts: Workout[];
      profile: UserProfile;
      progressEntries: ProgressEntry[];
      bodyWeights?: BodyWeightEntry[];
      bodyMeasurements?: BodyMeasurementEntry[];
      settings: Settings;
      activeSession: WorkoutSession | null;
      interruptedSessions?: WorkoutSession[];
    }
  | { type: 'setPersistenceError'; error: string | null }
  | { type: 'setMigrationConflict'; conflict: MigrationConflictInfo | null }
  | { type: 'setActiveSession'; session: WorkoutSession | null }
  | { type: 'setInterruptedSessions'; sessions: WorkoutSession[] }
  | { type: 'addMeal'; meal: Meal }
  | { type: 'updateMeal'; meal: Meal }
  | { type: 'deleteMeal'; mealId: string }
  | { type: 'toggleMealFavorite'; mealId: string; isFavorite: boolean }
  | { type: 'setMealTemplates'; mealTemplates: MealTemplate[] }
  | { type: 'addMealTemplate'; template: MealTemplate }
  | { type: 'updateMealTemplate'; template: MealTemplate }
  | { type: 'deleteMealTemplate'; templateId: string }
  | { type: 'toggleMealTemplateFavorite'; templateId: string; isFavorite: boolean }
  | { type: 'addWorkout'; workout: Workout }
  | { type: 'updateWorkout'; workout: Workout }
  | { type: 'deleteWorkout'; workoutId: string }
  | { type: 'updateProfile'; profile: Partial<UserProfile> }
  | { type: 'addProgressEntry'; entry: ProgressEntry }
  | { type: 'updateProgressEntry'; entry: ProgressEntry }
  | { type: 'deleteProgressEntry'; entryId: string }
  | { type: 'setBodyWeights'; bodyWeights: BodyWeightEntry[] }
  | { type: 'addBodyWeight'; entry: BodyWeightEntry }
  | { type: 'updateBodyWeight'; entry: BodyWeightEntry }
  | { type: 'deleteBodyWeight'; id: string }
  | { type: 'setBodyMeasurements'; bodyMeasurements: BodyMeasurementEntry[] }
  | { type: 'addBodyMeasurement'; entry: BodyMeasurementEntry }
  | { type: 'updateBodyMeasurement'; entry: BodyMeasurementEntry }
  | { type: 'deleteBodyMeasurement'; id: string }
  | { type: 'updateSettings'; settings: Partial<Settings> };

type AppContextValue = AppStateData & {
  t: (key: string, values?: Record<string, string | number>) => string;
  setLanguage: (language: Language) => void;
  completeOnboarding: () => void;
  login: (email?: string) => void;
  register: (profile: Partial<UserProfile>) => void;
  logout: () => void;
  updateProfile: (profile: Partial<UserProfile>) => void;
  addMeal: (meal: Meal) => Promise<void>;
  updateMeal: (meal: Meal) => Promise<void>;
  deleteMeal: (mealId: string) => Promise<void>;
  toggleMealFavorite: (mealId: string, isFavorite: boolean) => Promise<void>;
  addMealTemplate: (template: MealTemplate) => Promise<void>;
  updateMealTemplate: (template: MealTemplate) => Promise<void>;
  deleteMealTemplate: (templateId: string) => Promise<void>;
  toggleMealTemplateFavorite: (templateId: string, isFavorite: boolean) => Promise<void>;
  reconfirmMealTemplate: (
    templateId: string,
    completeness: import('../models/meal').NutritionCompleteness,
    macros?: {
      proteinKnown?: boolean;
      carbsKnown?: boolean;
      fatKnown?: boolean;
      totalCalories?: number;
      totalProtein?: number;
      totalCarbs?: number;
      totalFat?: number;
      items?: MealTemplateItem[];
    }
  ) => Promise<MealTemplate>;
  addWorkout: (workout: Workout) => Promise<void> | void;
  updateWorkout: (workout: Workout) => Promise<void> | void;
  deleteWorkout: (workoutId: string) => Promise<void> | void;
  addProgressEntry: (entry: ProgressEntry) => Promise<void> | void;
  updateProgressEntry: (entry: ProgressEntry) => Promise<void>;
  deleteProgressEntry: (entryId: string) => Promise<void>;
  recordBodyWeight: (entry: BodyWeightEntry) => Promise<void>;
  updateBodyWeight: (entry: BodyWeightEntry) => Promise<void>;
  deleteBodyWeight: (id: string) => Promise<void>;
  recordBodyMeasurement: (entry: BodyMeasurementEntry) => Promise<void>;
  updateBodyMeasurement: (entry: BodyMeasurementEntry) => Promise<void>;
  deleteBodyMeasurement: (id: string) => Promise<void>;
  updateSettings: (settings: Partial<Settings>) => void;
  clearPersistenceError: () => void;
  startActiveWorkout: (workout: Workout) => Promise<WorkoutSession>;
  pauseActiveWorkout: () => Promise<void>;
  resumeActiveWorkout: () => Promise<void>;
  completeSetInSession: (
    setId: string,
    reps: number,
    weight: number,
    rpe?: number | null,
    notes?: string
  ) => Promise<void>;
  skipSetInSession: (setId: string, notes?: string) => Promise<void>;
  addSetToSession: (
    sessionExerciseId: string,
    reps: number,
    weight: number
  ) => Promise<void>;
  finishActiveWorkout: (notes?: string) => Promise<WorkoutSession>;
  discardActiveWorkout: () => Promise<void>;
  refreshActiveSession: () => Promise<void>;
  updateActiveSessionRestTarget: (restTargetAt: string | null) => Promise<WorkoutSession | null>;
  loadInterruptedSessions: () => Promise<WorkoutSession[]>;
  resolveMigrationConflict: (
    resolution?:
      | string
      | {
          resumeSessionId?: string;
          actionForOthers?: 'keep_interrupted' | 'archive' | 'discard';
          sessionResolutions?: Record<
            string,
            'resume' | 'keep_interrupted' | 'archive' | 'discard'
          >;
        },
    actionForOthers?: 'keep_interrupted' | 'archive' | 'discard'
  ) => Promise<void>;
  resumeInterruptedSession: (
    sessionId: string,
    currentSessionAction?: 'keep_interrupted' | 'archive' | 'discard'
  ) => Promise<WorkoutSession>;
  archiveInterruptedSession: (sessionId: string, notes?: string) => Promise<WorkoutSession>;
  discardInterruptedSession: (sessionId: string) => Promise<void>;
};

const initialState: AppStateData = {
  isReady: false,
  persistenceError: null,
  migrationConflict: null,
  meals: [],
  mealTemplates: [],
  workouts: [],
  profile: getSeedProfile(),
  progressEntries: [],
  bodyWeights: [],
  bodyMeasurements: [],
  settings: defaultSettings,
  activeSession: null,
  interruptedSessions: [],
};

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function appReducer(state: AppStateData, action: AppAction): AppStateData {
  switch (action.type) {
    case 'hydrate':
      return {
        ...state,
        isReady: true,
        meals: action.meals.map(normalizeMeal),
        mealTemplates: (action.mealTemplates || []).map(normalizeMealTemplate),
        workouts: action.workouts.map(normalizeWorkout),
        profile: normalizeProfile(action.profile),
        progressEntries: action.progressEntries.map(normalizeProgressEntry),
        bodyWeights: action.bodyWeights ? [...action.bodyWeights].sort(compareBodyWeightsDescending) : [],
        bodyMeasurements: action.bodyMeasurements
          ? [...action.bodyMeasurements].sort(compareBodyMeasurementsDescending)
          : [],
        settings: action.settings,
        activeSession: action.activeSession,
        interruptedSessions: action.interruptedSessions ?? [],
      };

    case 'setActiveSession':
      return {
        ...state,
        activeSession: action.session,
      };

    case 'setInterruptedSessions':
      return {
        ...state,
        interruptedSessions: action.sessions,
      };

    case 'setPersistenceError':
      return {
        ...state,
        persistenceError: action.error,
      };

    case 'setMigrationConflict':
      return {
        ...state,
        migrationConflict: action.conflict,
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

    case 'toggleMealFavorite':
      return {
        ...state,
        meals: state.meals.map((meal) =>
          meal.id === action.mealId ? { ...meal, isFavorite: action.isFavorite } : meal
        ),
      };

    case 'setMealTemplates':
      return {
        ...state,
        mealTemplates: action.mealTemplates.map(normalizeMealTemplate),
      };

    case 'addMealTemplate': {
      const normalized = normalizeMealTemplate(action.template);
      const exists = state.mealTemplates.some((t) => t.id === normalized.id);
      const nextTemplates = exists
        ? state.mealTemplates.map((t) => (t.id === normalized.id ? normalized : t))
        : [normalized, ...state.mealTemplates];
      return { ...state, mealTemplates: nextTemplates };
    }

    case 'updateMealTemplate': {
      const normalized = normalizeMealTemplate(action.template);
      return {
        ...state,
        mealTemplates: state.mealTemplates.map((t) => (t.id === normalized.id ? normalized : t)),
      };
    }

    case 'deleteMealTemplate':
      return {
        ...state,
        mealTemplates: state.mealTemplates.filter((t) => t.id !== action.templateId),
      };

    case 'toggleMealTemplateFavorite':
      return {
        ...state,
        mealTemplates: state.mealTemplates.map((t) =>
          t.id === action.templateId ? { ...t, isFavorite: action.isFavorite } : t
        ),
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

    case 'updateProgressEntry': {
      const normalized = normalizeProgressEntry(action.entry);
      return {
        ...state,
        progressEntries: state.progressEntries.map((p) => (p.id === normalized.id ? normalized : p)),
      };
    }

    case 'deleteProgressEntry': {
      return {
        ...state,
        progressEntries: state.progressEntries.filter((p) => p.id !== action.entryId),
      };
    }

    case 'setBodyWeights':
      return {
        ...state,
        bodyWeights: [...action.bodyWeights].sort(compareBodyWeightsDescending),
      };

    case 'addBodyWeight':
      return {
        ...state,
        bodyWeights: [action.entry, ...state.bodyWeights.filter((w) => w.id !== action.entry.id)].sort(
          compareBodyWeightsDescending
        ),
      };

    case 'updateBodyWeight':
      return {
        ...state,
        bodyWeights: state.bodyWeights
          .map((w) => (w.id === action.entry.id ? action.entry : w))
          .sort(compareBodyWeightsDescending),
      };

    case 'deleteBodyWeight':
      return {
        ...state,
        bodyWeights: state.bodyWeights.filter((w) => w.id !== action.id),
      };

    case 'setBodyMeasurements':
      return {
        ...state,
        bodyMeasurements: [...action.bodyMeasurements].sort(compareBodyMeasurementsDescending),
      };

    case 'addBodyMeasurement':
      return {
        ...state,
        bodyMeasurements: [
          action.entry,
          ...state.bodyMeasurements.filter((m) => m.id !== action.entry.id),
        ].sort(compareBodyMeasurementsDescending),
      };

    case 'updateBodyMeasurement':
      return {
        ...state,
        bodyMeasurements: state.bodyMeasurements
          .map((m) => (m.id === action.entry.id ? action.entry : m))
          .sort(compareBodyMeasurementsDescending),
      };

    case 'deleteBodyMeasurement':
      return {
        ...state,
        bodyMeasurements: state.bodyMeasurements.filter((m) => m.id !== action.id),
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

  // Tracks whether state has been initialized from storage to prevent overwriting during hydration
  const isHydratedRef = useRef(false);
  const hydrateRef = useRef<() => Promise<void>>(() => Promise.resolve());

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
          await reconcileLegacyProgressWeights(db);
        } catch (dbErr: any) {
          if (
            dbErr instanceof MigrationSessionConflictError ||
            dbErr?.name === 'MigrationSessionConflictError'
          ) {
            console.warn('[AppContext] Pre-migration session conflict detected:', dbErr);
            if (active) {
              dispatch({
                type: 'setMigrationConflict',
                conflict: {
                  conflicts: dbErr.conflictingSessions || [],
                  error: dbErr.message,
                },
              });
            }
            return;
          }
          console.warn('[AppContext] SQLite initialization or migration notice:', dbErr);
        }

        const [
          savedMeals,
          savedTemplates,
          savedWorkouts,
          savedProfile,
          savedProgressEntries,
          savedSettings,
          savedActiveSession,
          savedInterruptedSessions,
          savedBodyWeights,
          savedBodyMeasurements,
        ] = await Promise.all([
          loadMeals().catch((e) => {
            console.warn('[AppContext] Failed to load meals:', e);
            return null;
          }),
          loadMealTemplates().catch((e) => {
            console.warn('[AppContext] Failed to load meal templates:', e);
            return [];
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
          getActiveWorkoutSession().catch((e) => {
            console.warn('[AppContext] Failed to load active workout session:', e);
            return null;
          }),
          getInterruptedWorkoutSessions().catch((e) => {
            console.warn('[AppContext] Failed to load interrupted workout sessions:', e);
            return [];
          }),
          loadAllWeights().catch((e) => {
            console.warn('[AppContext] Failed to load body weights:', e);
            return [];
          }),
          loadAllMeasurements().catch((e) => {
            console.warn('[AppContext] Failed to load body measurements:', e);
            return [];
          }),
        ]);

        if (!active) {
          return;
        }

        const authoritativeLanguage = resolveAuthoritativeLanguage(savedSettings?.selectedLanguage);
        const hydratedSettings = {
          ...defaultSettings,
          ...(savedSettings || {}),
          selectedLanguage: authoritativeLanguage,
        };

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

        applyAppDirection(authoritativeLanguage);

        dispatch({
          type: 'hydrate',
          meals: initialMeals,
          mealTemplates: savedTemplates || [],
          workouts: initialWorkouts,
          profile: initialProfile,
          progressEntries: initialProgress,
          bodyWeights: savedBodyWeights || [],
          bodyMeasurements: savedBodyMeasurements || [],
          settings: hydratedSettings,
          activeSession: savedActiveSession,
          interruptedSessions: savedInterruptedSessions,
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
          mealTemplates: [],
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
          activeSession: null,
          interruptedSessions: [],
        });

        dispatch({
          type: 'setPersistenceError',
          error: error instanceof Error ? error.message : 'Storage initialization failure',
        });
      }
    }

    hydrateRef.current = hydrate;
    hydrate();

    return () => {
      active = false;
    };
  }, []);

  const resolveMigrationConflict = useCallback(
    async (
      resolutionArg?:
        | string
        | {
            resumeSessionId?: string;
            actionForOthers?: 'keep_interrupted' | 'archive' | 'discard';
            sessionResolutions?: Record<
              string,
              'resume' | 'keep_interrupted' | 'archive' | 'discard'
            >;
          },
      actionForOthersArg?: 'keep_interrupted' | 'archive' | 'discard'
    ) => {
      try {
        let resolution: PreMigrationResolution;
        if (typeof resolutionArg === 'string') {
          resolution = {
            resumeSessionId: resolutionArg,
            actionForOthers: actionForOthersArg ?? 'keep_interrupted',
          };
        } else if (resolutionArg) {
          resolution = {
            ...resolutionArg,
            actionForOthers: resolutionArg.actionForOthers ?? actionForOthersArg ?? 'keep_interrupted',
          };
        } else {
          resolution = { actionForOthers: actionForOthersArg ?? 'keep_interrupted' };
        }

        const db = await getDatabaseConnectionOnly();
        await reconcilePreMigrationConflicts(db, resolution);
        await getDatabase();
        dispatch({ type: 'setMigrationConflict', conflict: null });
        await hydrateRef.current();
      } catch (err: any) {
        console.error('[AppContext] Failed to resolve migration conflict:', err);
        dispatch({
          type: 'setPersistenceError',
          error: err?.message || 'Failed to resolve session conflict.',
        });
        throw err;
      }
    },
    []
  );

  useEffect(() => {
    if (!state.isReady) {
      return;
    }

    applyLanguageDirection(state.settings.selectedLanguage);
  }, [applyLanguageDirection, state.isReady, state.settings.selectedLanguage]);


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
      addMeal: async (meal) => {
        try {
          const normalized = normalizeMeal(meal);
          validateMeal(normalized);
          await insertMealService(normalized);
          dispatch({ type: 'addMeal', meal: normalized });
          dispatch({ type: 'setPersistenceError', error: null });
        } catch (err) {
          console.error('[AppContext] Failed to insert meal:', err);
          dispatch({
            type: 'setPersistenceError',
            error: err instanceof Error ? err.message : 'Failed to persist meal',
          });
          throw err;
        }
      },
      updateMeal: async (meal) => {
        try {
          const normalized = normalizeMeal(meal);
          validateMeal(normalized);
          await updateMealService(normalized);
          dispatch({ type: 'updateMeal', meal: normalized });
          dispatch({ type: 'setPersistenceError', error: null });
        } catch (err) {
          console.error('[AppContext] Failed to update meal:', err);
          dispatch({
            type: 'setPersistenceError',
            error: err instanceof Error ? err.message : 'Failed to persist meal',
          });
          throw err;
        }
      },
      deleteMeal: async (mealId) => {
        try {
          await deleteMealService(mealId);
          dispatch({ type: 'deleteMeal', mealId });
          dispatch({ type: 'setPersistenceError', error: null });
        } catch (err) {
          console.error('[AppContext] Failed to delete meal:', err);
          dispatch({
            type: 'setPersistenceError',
            error: err instanceof Error ? err.message : 'Failed to persist meal deletion',
          });
          throw err;
        }
      },
      toggleMealFavorite: async (mealId, isFavorite) => {
        try {
          await toggleMealFavoriteService(mealId, isFavorite);
          dispatch({ type: 'toggleMealFavorite', mealId, isFavorite });
          dispatch({ type: 'setPersistenceError', error: null });
        } catch (err) {
          console.error('[AppContext] Failed to toggle meal favorite:', err);
          dispatch({
            type: 'setPersistenceError',
            error: err instanceof Error ? err.message : 'Failed to persist meal favorite',
          });
          throw err;
        }
      },
      addMealTemplate: async (template) => {
        try {
          const normalized = normalizeMealTemplate(template);
          await insertMealTemplateService(normalized);
          dispatch({ type: 'addMealTemplate', template: normalized });
          dispatch({ type: 'setPersistenceError', error: null });
        } catch (err) {
          console.error('[AppContext] Failed to insert meal template:', err);
          dispatch({
            type: 'setPersistenceError',
            error: err instanceof Error ? err.message : 'Failed to persist meal template',
          });
          throw err;
        }
      },
      updateMealTemplate: async (template) => {
        try {
          const normalized = normalizeMealTemplate(template);
          await updateMealTemplateService(normalized);
          dispatch({ type: 'updateMealTemplate', template: normalized });
          dispatch({ type: 'setPersistenceError', error: null });
        } catch (err) {
          console.error('[AppContext] Failed to update meal template:', err);
          dispatch({
            type: 'setPersistenceError',
            error: err instanceof Error ? err.message : 'Failed to persist meal template',
          });
          throw err;
        }
      },
      deleteMealTemplate: async (templateId) => {
        try {
          await deleteMealTemplateService(templateId);
          dispatch({ type: 'deleteMealTemplate', templateId });
          dispatch({ type: 'setPersistenceError', error: null });
        } catch (err) {
          console.error('[AppContext] Failed to delete meal template:', err);
          dispatch({
            type: 'setPersistenceError',
            error: err instanceof Error ? err.message : 'Failed to persist meal template deletion',
          });
          throw err;
        }
      },
      toggleMealTemplateFavorite: async (templateId, isFavorite) => {
        try {
          await toggleMealTemplateFavoriteService(templateId, isFavorite);
          dispatch({ type: 'toggleMealTemplateFavorite', templateId, isFavorite });
          dispatch({ type: 'setPersistenceError', error: null });
        } catch (err) {
          console.error('[AppContext] Failed to toggle meal template favorite:', err);
          dispatch({
            type: 'setPersistenceError',
            error: err instanceof Error ? err.message : 'Failed to persist meal template favorite',
          });
          throw err;
        }
      },
      reconfirmMealTemplate: async (templateId, completeness, macros) => {
        try {
          const updated = await reconfirmMealTemplateService(templateId, completeness, macros);
          dispatch({ type: 'updateMealTemplate', template: updated });
          dispatch({ type: 'setPersistenceError', error: null });
          return updated;
        } catch (err) {
          console.error('[AppContext] Failed to reconfirm meal template:', err);
          dispatch({
            type: 'setPersistenceError',
            error: err instanceof Error ? err.message : 'Failed to reconfirm meal template',
          });
          throw err;
        }
      },
      addWorkout: async (workout) => {
        try {
          const normalized = normalizeWorkout(workout);
          await insertWorkoutService(normalized);
          dispatch({ type: 'addWorkout', workout: normalized });
          dispatch({ type: 'setPersistenceError', error: null });
        } catch (err) {
          console.error('[AppContext] Failed to insert workout:', err);
          dispatch({
            type: 'setPersistenceError',
            error: err instanceof Error ? err.message : 'Failed to persist workout',
          });
          throw err;
        }
      },
      updateWorkout: async (workout) => {
        try {
          const normalized = normalizeWorkout(workout);
          await updateWorkoutService(normalized);
          dispatch({ type: 'updateWorkout', workout: normalized });
          dispatch({ type: 'setPersistenceError', error: null });
        } catch (err) {
          console.error('[AppContext] Failed to update workout:', err);
          dispatch({
            type: 'setPersistenceError',
            error: err instanceof Error ? err.message : 'Failed to persist workout',
          });
          throw err;
        }
      },
      deleteWorkout: async (workoutId) => {
        try {
          await deleteWorkoutService(workoutId);
          dispatch({ type: 'deleteWorkout', workoutId });
          dispatch({ type: 'setPersistenceError', error: null });
        } catch (err) {
          console.error('[AppContext] Failed to delete workout:', err);
          dispatch({
            type: 'setPersistenceError',
            error: err instanceof Error ? err.message : 'Failed to persist workout deletion',
          });
          throw err;
        }
      },
      addProgressEntry: async (entry) => {
        try {
          const normalized = normalizeProgressEntry(entry);
          await insertProgressEntryService(normalized);
          dispatch({ type: 'addProgressEntry', entry: normalized });
          dispatch({ type: 'setPersistenceError', error: null });
        } catch (err) {
          console.error('[AppContext] Failed to persist progress entry:', err);
          dispatch({
            type: 'setPersistenceError',
            error: err instanceof Error ? err.message : 'Failed to persist progress entry',
          });
          throw err;
        }
      },
      updateProgressEntry: async (entry) => {
        try {
          const normalized = normalizeProgressEntry(entry);
          await updateProgressEntryService(normalized);
          dispatch({ type: 'updateProgressEntry', entry: normalized });
          dispatch({ type: 'setPersistenceError', error: null });
        } catch (err) {
          console.error('[AppContext] Failed to update progress entry:', err);
          dispatch({
            type: 'setPersistenceError',
            error: err instanceof Error ? err.message : 'Failed to update progress entry',
          });
          throw err;
        }
      },
      deleteProgressEntry: async (entryId) => {
        try {
          await deleteProgressEntryService(entryId);
          dispatch({ type: 'deleteProgressEntry', entryId });
          dispatch({ type: 'setPersistenceError', error: null });
        } catch (err) {
          console.error('[AppContext] Failed to delete progress entry:', err);
          dispatch({
            type: 'setPersistenceError',
            error: err instanceof Error ? err.message : 'Failed to delete progress entry',
          });
          throw err;
        }
      },
      recordBodyWeight: async (entry: BodyWeightEntry) => {
        try {
          const result = await recordWeightWithProfileSync(entry);
          dispatch({ type: 'addBodyWeight', entry: result.entry });
          if (result.updatedProfile) {
            dispatch({ type: 'updateProfile', profile: result.updatedProfile });
          }
          dispatch({ type: 'setPersistenceError', error: null });
        } catch (err) {
          console.error('[AppContext] Failed to record body weight:', err);
          dispatch({
            type: 'setPersistenceError',
            error: err instanceof Error ? err.message : 'Failed to record body weight',
          });
          throw err;
        }
      },
      updateBodyWeight: async (entry: BodyWeightEntry) => {
        try {
          const result = await updateWeightWithProfileSync(entry);
          dispatch({ type: 'updateBodyWeight', entry: result.entry });
          if (result.updatedProfile) {
            dispatch({ type: 'updateProfile', profile: result.updatedProfile });
          }
          dispatch({ type: 'setPersistenceError', error: null });
        } catch (err) {
          console.error('[AppContext] Failed to update body weight:', err);
          dispatch({
            type: 'setPersistenceError',
            error: err instanceof Error ? err.message : 'Failed to update body weight',
          });
          throw err;
        }
      },
      deleteBodyWeight: async (id: string) => {
        try {
          const result = await deleteWeightWithProfileSync(id);
          dispatch({ type: 'deleteBodyWeight', id });
          if (result.updatedProfile) {
            dispatch({ type: 'updateProfile', profile: result.updatedProfile });
          }
          dispatch({ type: 'setPersistenceError', error: null });
        } catch (err) {
          console.error('[AppContext] Failed to delete body weight:', err);
          dispatch({
            type: 'setPersistenceError',
            error: err instanceof Error ? err.message : 'Failed to delete body weight',
          });
          throw err;
        }
      },
      recordBodyMeasurement: async (entry: BodyMeasurementEntry) => {
        try {
          await recordMeasurement(entry);
          dispatch({ type: 'addBodyMeasurement', entry });
          dispatch({ type: 'setPersistenceError', error: null });
        } catch (err) {
          console.error('[AppContext] Failed to record body measurement:', err);
          dispatch({
            type: 'setPersistenceError',
            error: err instanceof Error ? err.message : 'Failed to record body measurement',
          });
          throw err;
        }
      },
      updateBodyMeasurement: async (entry: BodyMeasurementEntry) => {
        try {
          await updateMeasurement(entry);
          dispatch({ type: 'updateBodyMeasurement', entry });
          dispatch({ type: 'setPersistenceError', error: null });
        } catch (err) {
          console.error('[AppContext] Failed to update body measurement:', err);
          dispatch({
            type: 'setPersistenceError',
            error: err instanceof Error ? err.message : 'Failed to update body measurement',
          });
          throw err;
        }
      },
      deleteBodyMeasurement: async (id: string) => {
        try {
          await deleteMeasurement(id);
          dispatch({ type: 'deleteBodyMeasurement', id });
          dispatch({ type: 'setPersistenceError', error: null });
        } catch (err) {
          console.error('[AppContext] Failed to delete body measurement:', err);
          dispatch({
            type: 'setPersistenceError',
            error: err instanceof Error ? err.message : 'Failed to delete body measurement',
          });
          throw err;
        }
      },
      updateSettings: (settings) => dispatch({ type: 'updateSettings', settings }),
      clearPersistenceError: () => dispatch({ type: 'setPersistenceError', error: null }),
      startActiveWorkout: async (workout: Workout) => {
        try {
          const session = await startWorkoutSession(workout);
          dispatch({ type: 'setActiveSession', session });
          dispatch({ type: 'setPersistenceError', error: null });
          return session;
        } catch (err) {
          console.error('[AppContext] Failed to start active workout session:', err);
          dispatch({
            type: 'setPersistenceError',
            error: err instanceof Error ? err.message : 'Failed to start active workout session',
          });
          throw err;
        }
      },
      pauseActiveWorkout: async () => {
        if (!state.activeSession) return;
        try {
          const session = await pauseWorkoutSession(state.activeSession.id);
          dispatch({ type: 'setActiveSession', session });
          dispatch({ type: 'setPersistenceError', error: null });
        } catch (err) {
          console.error('[AppContext] Failed to pause active workout:', err);
          dispatch({
            type: 'setPersistenceError',
            error: err instanceof Error ? err.message : 'Failed to pause workout session',
          });
          throw err;
        }
      },
      resumeActiveWorkout: async () => {
        if (!state.activeSession) return;
        try {
          const session = await resumeWorkoutSession(state.activeSession.id);
          dispatch({ type: 'setActiveSession', session });
          dispatch({ type: 'setPersistenceError', error: null });
        } catch (err) {
          console.error('[AppContext] Failed to resume active workout:', err);
          dispatch({
            type: 'setPersistenceError',
            error: err instanceof Error ? err.message : 'Failed to resume workout session',
          });
          throw err;
        }
      },
      completeSetInSession: async (
        setId: string,
        reps: number,
        weight: number,
        rpe?: number | null,
        notes?: string
      ) => {
        if (!state.activeSession) return;
        try {
          await completeSessionSet(setId, reps, weight, rpe, notes);
          const session = await getActiveWorkoutSession();
          dispatch({ type: 'setActiveSession', session });
          dispatch({ type: 'setPersistenceError', error: null });
        } catch (err) {
          console.error('[AppContext] Failed to complete set in session:', err);
          dispatch({
            type: 'setPersistenceError',
            error: err instanceof Error ? err.message : 'Failed to complete set',
          });
          throw err;
        }
      },
      skipSetInSession: async (setId: string, notes?: string) => {
        if (!state.activeSession) return;
        try {
          await skipSessionSet(setId, notes);
          const session = await getActiveWorkoutSession();
          dispatch({ type: 'setActiveSession', session });
          dispatch({ type: 'setPersistenceError', error: null });
        } catch (err) {
          console.error('[AppContext] Failed to skip set in session:', err);
          dispatch({
            type: 'setPersistenceError',
            error: err instanceof Error ? err.message : 'Failed to skip set',
          });
          throw err;
        }
      },
      addSetToSession: async (sessionExerciseId: string, reps: number, weight: number) => {
        if (!state.activeSession) return;
        try {
          await addSessionSet(sessionExerciseId, reps, weight);
          const session = await getActiveWorkoutSession();
          dispatch({ type: 'setActiveSession', session });
          dispatch({ type: 'setPersistenceError', error: null });
        } catch (err) {
          console.error('[AppContext] Failed to add set to session:', err);
          dispatch({
            type: 'setPersistenceError',
            error: err instanceof Error ? err.message : 'Failed to add set',
          });
          throw err;
        }
      },
      finishActiveWorkout: async (notes?: string) => {
        if (!state.activeSession) throw new Error('No active workout session.');
        try {
          const finished = await finishWorkoutSession(state.activeSession.id, notes);
          dispatch({ type: 'setActiveSession', session: null });
          dispatch({ type: 'setPersistenceError', error: null });
          return finished;
        } catch (err) {
          console.error('[AppContext] Failed to finish active workout session:', err);
          dispatch({
            type: 'setPersistenceError',
            error: err instanceof Error ? err.message : 'Failed to finish workout session',
          });
          throw err;
        }
      },
      discardActiveWorkout: async () => {
        if (!state.activeSession) return;
        try {
          await discardWorkoutSession(state.activeSession.id);
          dispatch({ type: 'setActiveSession', session: null });
          dispatch({ type: 'setPersistenceError', error: null });
        } catch (err) {
          console.error('[AppContext] Failed to discard active workout session:', err);
          dispatch({
            type: 'setPersistenceError',
            error: err instanceof Error ? err.message : 'Failed to discard workout session',
          });
          throw err;
        }
      },
      refreshActiveSession: async () => {
        try {
          const session = await getActiveWorkoutSession();
          dispatch({ type: 'setActiveSession', session });
        } catch (err) {
          console.warn('[AppContext] Failed to refresh active workout session:', err);
        }
      },
      updateActiveSessionRestTarget: async (restTargetAt: string | null) => {
        if (!state.activeSession) return null;
        try {
          const updated = await setSessionRestTarget(state.activeSession.id, restTargetAt);
          dispatch({ type: 'setActiveSession', session: updated });
          return updated;
        } catch (err) {
          console.warn('[AppContext] Failed to update rest target:', err);
          throw err;
        }
      },
      loadInterruptedSessions: async () => {
        try {
          const sessions = await getInterruptedWorkoutSessions();
          dispatch({ type: 'setInterruptedSessions', sessions });
          return sessions;
        } catch (err) {
          console.warn('[AppContext] Failed to load interrupted sessions:', err);
          return [];
        }
      },
      resumeInterruptedSession: async (
        sessionId: string,
        currentSessionAction?: 'keep_interrupted' | 'archive' | 'discard'
      ) => {
        try {
          const resumed = await resumeInterruptedWorkoutSession(sessionId, currentSessionAction);
          const remainingInterrupted = await getInterruptedWorkoutSessions();
          dispatch({ type: 'setInterruptedSessions', sessions: remainingInterrupted });
          dispatch({ type: 'setActiveSession', session: resumed });
          dispatch({ type: 'setPersistenceError', error: null });
          return resumed;
        } catch (err) {
          console.error('[AppContext] Failed to resume interrupted session:', err);
          dispatch({
            type: 'setPersistenceError',
            error: err instanceof Error ? err.message : 'Failed to resume interrupted session',
          });
          throw err;
        }
      },
      archiveInterruptedSession: async (sessionId: string, notes?: string) => {
        try {
          const archived = await archiveInterruptedWorkoutSession(sessionId, notes);
          const remainingInterrupted = await getInterruptedWorkoutSessions();
          dispatch({ type: 'setInterruptedSessions', sessions: remainingInterrupted });
          dispatch({ type: 'setPersistenceError', error: null });
          return archived;
        } catch (err) {
          console.error('[AppContext] Failed to archive interrupted session:', err);
          dispatch({
            type: 'setPersistenceError',
            error: err instanceof Error ? err.message : 'Failed to archive interrupted session',
          });
          throw err;
        }
      },
      discardInterruptedSession: async (sessionId: string) => {
        try {
          await discardWorkoutSession(sessionId);
          const remainingInterrupted = await getInterruptedWorkoutSessions();
          dispatch({ type: 'setInterruptedSessions', sessions: remainingInterrupted });
          dispatch({ type: 'setPersistenceError', error: null });
        } catch (err) {
          console.error('[AppContext] Failed to discard interrupted session:', err);
          dispatch({
            type: 'setPersistenceError',
            error: err instanceof Error ? err.message : 'Failed to discard interrupted session',
          });
          throw err;
        }
      },
      resolveMigrationConflict,
    }),
    [resolveMigrationConflict, setLanguage, state, t],
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

export function useLanguage() {
  const { settings } = useApp();
  const language = settings.selectedLanguage;
  return {
    language,
    isRTL: isRTLLanguage(language),
  };
}
