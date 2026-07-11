import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { LoadingScreen } from '../components/common/LoadingScreen';
import { useApp } from '../store/AppContext';
import { useAppTheme } from '../hooks/useAppTheme';
import {
  getDirection,
  getTextAlign,
  getWritingDirection,
  isRTLLanguage,
} from '../utils/languageDirection';
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
  const { settings, t } = useApp();
  const theme = useAppTheme();
  const language = settings.selectedLanguage;
  const isRTL = isRTLLanguage(language);
  const direction = getDirection(language);
  const textAlign = getTextAlign(language);
  const writingDirection = getWritingDirection(language);
  const screens = [
    { name: 'Dashboard' as const, component: DashboardScreen, title: t('navigation.dashboard') },
    { name: 'Meals' as const, component: MealsListScreen, title: t('navigation.meals') },
    { name: 'Workouts' as const, component: WorkoutsListScreen, title: t('navigation.workouts') },
    { name: 'History' as const, component: HistoryScreen, title: t('navigation.history') },
    { name: 'Settings' as const, component: SettingsScreen, title: t('navigation.settings') },
  ];
  const orderedScreens = isRTL ? [...screens].reverse() : screens;

  return (
    <Tabs.Navigator
      key={direction}
      initialRouteName="Dashboard"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.tabBar,
          borderTopColor: theme.colors.border,
          direction,
          minHeight: 62,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarItemStyle: {
          direction,
        },
        tabBarLabelStyle: {
          direction,
          fontSize: 12,
          fontWeight: '700',
          textAlign,
          writingDirection,
        },
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={tabIcons[route.name]} color={color} size={size} />
        ),
      })}
    >
      {orderedScreens.map((screen) => (
        <Tabs.Screen
          key={screen.name}
          name={screen.name}
          component={screen.component}
          options={{ title: screen.title }}
        />
      ))}
    </Tabs.Navigator>
  );
}

export function AppNavigator() {
  const { isReady, settings, t } = useApp();
  const theme = useAppTheme();
  const language = settings.selectedLanguage;
  const direction = getDirection(language);
  const textAlign = getTextAlign(language);
  const writingDirection = getWritingDirection(language);
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
    <View key={direction} style={[styles.root, { direction }]}>
      <NavigationContainer key={direction} theme={navigationTheme}>
      <RootStack.Navigator
        key={direction}
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.surface },
          headerTintColor: theme.colors.text,
          headerTitle: ({ children, tintColor }) => (
            <Text
              numberOfLines={1}
              style={{
                color: tintColor ?? theme.colors.text,
                direction,
                fontWeight: '800',
                textAlign,
                writingDirection,
              }}
            >
              {children}
            </Text>
          ),
          headerTitleStyle: { fontWeight: '800' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.colors.background, direction },
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
