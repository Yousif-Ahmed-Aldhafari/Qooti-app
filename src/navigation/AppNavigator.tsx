import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { LoadingScreen } from '../components/common/LoadingScreen';
import { useApp } from '../store/AppContext';
import { useAppTheme } from '../hooks/useAppTheme';
import { DashboardScreen } from '../screens/dashboard/DashboardScreen';
import { MealsListScreen } from '../screens/meals/MealsListScreen';
import { AddEditMealScreen } from '../screens/meals/AddEditMealScreen';
import { MealDetailsScreen } from '../screens/meals/MealDetailsScreen';
import { WorkoutsListScreen } from '../screens/workouts/WorkoutsListScreen';
import { AddEditWorkoutScreen } from '../screens/workouts/AddEditWorkoutScreen';
import { WorkoutDetailsScreen } from '../screens/workouts/WorkoutDetailsScreen';
import { HistoryScreen } from '../screens/history/HistoryScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { OnboardingScreen } from '../screens/onboarding/OnboardingScreen';
import { LanguageSelectionScreen } from '../screens/onboarding/LanguageSelectionScreen';
import type { MainTabParamList, RootStackParamList } from './types';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();

const tabIcons: Record<keyof MainTabParamList, keyof typeof Ionicons.glyphMap> = {
  Dashboard: 'grid-outline',
  Meals: 'restaurant-outline',
  Workouts: 'barbell-outline',
  History: 'calendar-outline',
  Settings: 'settings-outline',
};

function MainTabs() {
  const { t } = useApp();
  const theme = useAppTheme();

  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.tabBar,
          borderTopColor: theme.colors.border,
          minHeight: 62,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '700',
        },
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={tabIcons[route.name]} color={color} size={size} />
        ),
      })}
    >
      <Tabs.Screen name="Dashboard" component={DashboardScreen} options={{ title: t('navigation.dashboard') }} />
      <Tabs.Screen name="Meals" component={MealsListScreen} options={{ title: t('navigation.meals') }} />
      <Tabs.Screen name="Workouts" component={WorkoutsListScreen} options={{ title: t('navigation.workouts') }} />
      <Tabs.Screen name="History" component={HistoryScreen} options={{ title: t('navigation.history') }} />
      <Tabs.Screen name="Settings" component={SettingsScreen} options={{ title: t('navigation.settings') }} />
    </Tabs.Navigator>
  );
}

export function AppNavigator() {
  const { isReady, settings, t } = useApp();
  const theme = useAppTheme();
  const navigationTheme = {
    ...(theme.isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(theme.isDark ? DarkTheme.colors : DefaultTheme.colors),
      background: theme.colors.background,
      card: theme.colors.surface,
      text: theme.colors.text,
      border: theme.colors.border,
      primary: theme.colors.primary,
    },
  };

  if (!isReady) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer theme={navigationTheme}>
      <RootStack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.surface },
          headerTintColor: theme.colors.text,
          headerTitleStyle: { fontWeight: '800' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        {!settings.hasCompletedOnboarding ? (
          <>
            <RootStack.Screen
              name="Onboarding"
              component={OnboardingScreen}
              options={{ headerShown: false, title: t('navigation.onboarding') }}
            />
            <RootStack.Screen
              name="Language"
              component={LanguageSelectionScreen}
              options={{ title: t('navigation.language') }}
            />
          </>
        ) : (
          <>
            <RootStack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
            <RootStack.Screen
              name="Language"
              component={LanguageSelectionScreen}
              options={{ title: t('navigation.language') }}
            />
            <RootStack.Screen
              name="AddEditMeal"
              component={AddEditMealScreen}
              options={({ route }) => ({
                title: route.params?.mealId ? t('navigation.editMeal') : t('navigation.addMeal'),
              })}
            />
            <RootStack.Screen
              name="MealDetails"
              component={MealDetailsScreen}
              options={{ title: t('navigation.mealDetails') }}
            />
            <RootStack.Screen
              name="AddEditWorkout"
              component={AddEditWorkoutScreen}
              options={({ route }) => ({
                title: route.params?.workoutId ? t('navigation.editWorkout') : t('navigation.addWorkout'),
              })}
            />
            <RootStack.Screen
              name="WorkoutDetails"
              component={WorkoutDetailsScreen}
              options={{ title: t('navigation.workoutDetails') }}
            />
          </>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
