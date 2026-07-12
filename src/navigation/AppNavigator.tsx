import { useEffect, useState } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { LoadingScreen } from '../components/common/LoadingScreen';
import { useApp } from '../store/AppContext';
import { useAppTheme } from '../hooks/useAppTheme';
import { getDirection, getTextAlign, getWritingDirection, isRTLLanguage } from '../utils/languageDirection';
import { SplashScreen } from '../screens/splash/SplashScreen';
import { DashboardScreen } from '../screens/dashboard/DashboardScreen';
import { MealsListScreen } from '../screens/meals/MealsListScreen';
import { NutritionSummaryScreen } from '../screens/meals/NutritionSummaryScreen';
import { AddEditMealScreen } from '../screens/meals/AddEditMealScreen';
import { MealDetailsScreen } from '../screens/meals/MealDetailsScreen';
import { FoodSearchScreen } from '../screens/meals/FoodSearchScreen';
import { WorkoutsListScreen } from '../screens/workouts/WorkoutsListScreen';
import { AddExerciseScreen } from '../screens/workouts/AddExerciseScreen';
import { WorkoutDetailsScreen } from '../screens/workouts/WorkoutDetailsScreen';
import { ProgressScreen } from '../screens/progress/ProgressScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { OnboardingScreen } from '../screens/onboarding/OnboardingScreen';
import { LanguageSelectionScreen } from '../screens/onboarding/LanguageSelectionScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import type { MainTabParamList, RootStackParamList } from './types';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();

const tabIcons: Record<keyof MainTabParamList, keyof typeof Ionicons.glyphMap> = {
  Home: 'grid-outline',
  Meals: 'restaurant-outline',
  Workouts: 'barbell-outline',
  Progress: 'stats-chart-outline',
  Profile: 'person-outline',
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
    { name: 'Home' as const, component: DashboardScreen, title: t('navigation.home') },
    { name: 'Meals' as const, component: MealsListScreen, title: t('navigation.meals') },
    { name: 'Workouts' as const, component: WorkoutsListScreen, title: t('navigation.workouts') },
    { name: 'Progress' as const, component: ProgressScreen, title: t('navigation.progress') },
    { name: 'Profile' as const, component: ProfileScreen, title: t('navigation.profile') },
  ];
  const orderedScreens = isRTL ? [...screens].reverse() : screens;

  return (
    <Tabs.Navigator
      key={direction}
      initialRouteName="Home"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          position: 'absolute',
          start: 18,
          end: 18,
          bottom: 18,
          minHeight: 72,
          borderRadius: 28,
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.tabBar,
          direction,
          paddingTop: 9,
          paddingBottom: 12,
          shadowColor: theme.colors.shadow,
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.12,
          shadowRadius: 24,
          elevation: 12,
        },
        tabBarItemStyle: {
          direction,
        },
        tabBarLabelStyle: {
          direction,
          fontSize: 11,
          fontWeight: '900',
          textAlign,
          writingDirection,
        },
        tabBarIcon: ({ color, size, focused }) => (
          <View
            style={[
              styles.tabIcon,
              focused ? { backgroundColor: theme.colors.primaryMuted } : null,
            ]}
          >
            <Ionicons name={tabIcons[route.name]} color={color} size={focused ? size + 2 : size} />
          </View>
        ),
      })}
    >
      {orderedScreens.map((screen) => (
        <Tabs.Screen key={screen.name} name={screen.name} component={screen.component} options={{ title: screen.title }} />
      ))}
    </Tabs.Navigator>
  );
}

export function AppNavigator() {
  const { isReady, settings, t } = useApp();
  const theme = useAppTheme();
  const [showSplash, setShowSplash] = useState(true);
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

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 950);
    return () => clearTimeout(timer);
  }, []);

  if (!isReady) {
    return <LoadingScreen />;
  }

  if (showSplash) {
    return <SplashScreen />;
  }

  return (
    <View key={direction} style={[styles.root, { direction }]}>
      <NavigationContainer key={direction} theme={navigationTheme}>
        <RootStack.Navigator
          key={direction}
          screenOptions={{
            headerStyle: { backgroundColor: theme.colors.background },
            headerTintColor: theme.colors.text,
            headerTitle: ({ children, tintColor }) => (
              <Text
                numberOfLines={1}
                style={{
                  color: tintColor ?? theme.colors.text,
                  direction,
                  fontWeight: '900',
                  textAlign,
                  writingDirection,
                }}
              >
                {children}
              </Text>
            ),
            headerTitleStyle: { fontWeight: '900' },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: theme.colors.background, direction },
          }}
        >
          {!settings.hasCompletedOnboarding ? (
            <>
              <RootStack.Screen name="Onboarding" component={OnboardingScreen} options={{ headerShown: false, title: t('navigation.onboarding') }} />
              <RootStack.Screen name="Language" component={LanguageSelectionScreen} options={{ title: t('navigation.language') }} />
            </>
          ) : !settings.isAuthenticated ? (
            <>
              <RootStack.Screen name="Login" component={LoginScreen} options={{ headerShown: false, title: t('navigation.login') }} />
              <RootStack.Screen name="Register" component={RegisterScreen} options={{ title: t('navigation.register') }} />
              <RootStack.Screen name="Language" component={LanguageSelectionScreen} options={{ title: t('navigation.language') }} />
            </>
          ) : (
            <>
              <RootStack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
              <RootStack.Screen name="NutritionSummary" component={NutritionSummaryScreen} options={{ title: t('navigation.nutritionSummary') }} />
              <RootStack.Screen name="AddEditMeal" component={AddEditMealScreen} options={({ route }) => ({ title: route.params?.mealId ? t('navigation.editMeal') : t('navigation.addMeal') })} />
              <RootStack.Screen name="MealDetails" component={MealDetailsScreen} options={{ title: t('navigation.mealDetails') }} />
              <RootStack.Screen name="FoodSearch" component={FoodSearchScreen} options={{ title: t('navigation.foodSearch') }} />
              <RootStack.Screen name="AddExercise" component={AddExerciseScreen} options={{ title: t('navigation.addExercise') }} />
              <RootStack.Screen name="WorkoutDetails" component={WorkoutDetailsScreen} options={{ title: t('navigation.workoutDetails') }} />
              <RootStack.Screen name="Profile" component={ProfileScreen} options={{ title: t('navigation.profile') }} />
              <RootStack.Screen name="Settings" component={SettingsScreen} options={{ title: t('navigation.settings') }} />
              <RootStack.Screen name="Language" component={LanguageSelectionScreen} options={{ title: t('navigation.language') }} />
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
  tabIcon: {
    width: 38,
    height: 30,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
