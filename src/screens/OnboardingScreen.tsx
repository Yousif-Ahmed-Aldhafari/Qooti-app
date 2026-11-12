import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import { AppInput } from '../components/AppInput';
import { MacroCard } from '../components/MacroCard';
import { StatCard } from '../components/StatCard';
import type { Translator } from '../i18n';
import type {
  ActivityLevel,
  DietaryPreference,
  Gender,
  PrimaryGoal,
  UserProfile,
  WeeklyGoalRate,
} from '../models/profile';
import { themeColors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import {
  calculateFullRecommendation,
  type ProfileRecommendations,
} from '../utils/personalization';
import {
  activeIsRTL,
  activeRowStyle,
  activeTextAlign,
  activeWritingDirection,
} from '../utils/rtl';
import { getPressFeedback } from '../utils/touchFeedback';

export type OnboardingScreenProps = {
  t: Translator;
  onDone: () => void;
  profile?: UserProfile;
  onUpdateProfile?: (profile: Partial<UserProfile>) => void;
};

type OptionItem<T extends string | number> = {
  value: T;
  labelKey: string;
  hintKey?: string;
  icon?: keyof typeof Ionicons.glyphMap;
};

export function OnboardingScreen({ t, onDone, profile, onUpdateProfile }: OnboardingScreenProps) {
  const colors = themeColors();
  const rtl = activeIsRTL();
  const [step, setStep] = useState<number>(1);
  const totalSteps = 5;

  const directionalText = {
    textAlign: activeTextAlign(),
    writingDirection: activeWritingDirection(),
  } as const;

  // Form State
  const [ageStr, setAgeStr] = useState<string>(profile?.age ? String(profile.age) : '28');
  const [heightStr, setHeightStr] = useState<string>(profile?.heightCm ? String(profile.heightCm) : '170');
  const [weightStr, setWeightStr] = useState<string>(profile?.weightKg ? String(profile.weightKg) : '70');
  const [gender, setGender] = useState<Gender>(profile?.gender ?? 'unspecified');
  const [bmrBiologicalReference, setBmrBiologicalReference] = useState<'male' | 'female' | undefined>(
    profile?.bmrBiologicalReference
  );

  const [primaryGoal, setPrimaryGoal] = useState<PrimaryGoal>(profile?.primaryGoal ?? 'general_health');
  const [weeklyGoalRate, setWeeklyGoalRate] = useState<WeeklyGoalRate>(profile?.weeklyGoalRate ?? 'moderate');

  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(profile?.activityLevel ?? 'moderately_active');
  const [trainingExperience, setTrainingExperience] = useState<'beginner' | 'intermediate' | 'advanced'>(
    profile?.trainingExperience ?? 'beginner'
  );
  const [preferredWorkoutDays, setPreferredWorkoutDays] = useState<number>(profile?.preferredWorkoutDays ?? 4);
  const [workoutLocation, setWorkoutLocation] = useState<'home' | 'gym' | 'outdoor' | 'flexible'>(
    profile?.workoutLocationPreference ?? 'flexible'
  );
  const [availableEquipment, setAvailableEquipment] = useState<string[]>(
    profile?.availableEquipment ?? ['bodyweight']
  );

  const [dietaryPreference, setDietaryPreference] = useState<DietaryPreference>(profile?.dietaryPreference ?? 'standard');
  const [mealsPerDay, setMealsPerDay] = useState<number>(profile?.mealsPerDayPreference ?? 3);
  const [allergiesRestrictions, setAllergiesRestrictions] = useState<string[]>(
    profile?.allergiesRestrictions ?? []
  );

  const [attributesConfirmed, setAttributesConfirmed] = useState<boolean>(true);

  // Parsed numerical values
  const parsedAge = parseInt(ageStr, 10);
  const parsedHeight = parseFloat(heightStr);
  const parsedWeight = parseFloat(weightStr);

  const isAgeValid = Number.isFinite(parsedAge) && parsedAge >= 1 && parsedAge <= 120;
  const isHeightValid = Number.isFinite(parsedHeight) && parsedHeight >= 60 && parsedHeight <= 260;
  const isWeightValid = Number.isFinite(parsedWeight) && parsedWeight >= 20 && parsedWeight <= 350;

  // Active Draft Profile for Live Recommendations
  const draftProfile = useMemo<UserProfile>(() => {
    return {
      id: profile?.id ?? 'onboarding-user',
      name: profile?.name ?? 'User',
      email: profile?.email ?? 'user@qooti.local',
      goal: primaryGoal,
      avatarInitials: profile?.avatarInitials ?? 'Q',
      heightCm: isHeightValid ? parsedHeight : 170,
      weightKg: isWeightValid ? parsedWeight : 70,
      targetCalories: profile?.targetCalories ?? 2000,
      targetProtein: profile?.targetProtein ?? 140,
      targetCarbs: profile?.targetCarbs ?? 200,
      targetFats: profile?.targetFats ?? 65,
      targetFat: profile?.targetFats ?? 65,
      age: isAgeValid ? parsedAge : 28,
      gender,
      bmrBiologicalReference,
      primaryGoal,
      weeklyGoalRate,
      activityLevel,
      trainingExperience,
      preferredWorkoutDays,
      workoutLocationPreference: workoutLocation,
      availableEquipment,
      dietaryPreference,
      mealsPerDayPreference: mealsPerDay,
      allergiesRestrictions,
      attributesConfirmed,
      calculationOverridden: false,
    };
  }, [
    profile,
    primaryGoal,
    isHeightValid,
    parsedHeight,
    isWeightValid,
    parsedWeight,
    isAgeValid,
    parsedAge,
    gender,
    bmrBiologicalReference,
    weeklyGoalRate,
    activityLevel,
    trainingExperience,
    preferredWorkoutDays,
    workoutLocation,
    availableEquipment,
    dietaryPreference,
    mealsPerDay,
    allergiesRestrictions,
    attributesConfirmed,
  ]);

  const recommendations = useMemo<ProfileRecommendations>(() => {
    return calculateFullRecommendation(draftProfile);
  }, [draftProfile]);

  function handleNext() {
    if (step < totalSteps) {
      setStep((current) => current + 1);
    } else {
      handleComplete(true);
    }
  }

  function handleBack() {
    if (step > 1) {
      setStep((current) => current - 1);
    }
  }

  function handleSkip() {
    handleComplete(false);
  }

  function handleComplete(applyPersonalizedTargets: boolean) {
    if (onUpdateProfile) {
      if (applyPersonalizedTargets && recommendations.hasApprovedTarget) {
        onUpdateProfile({
          age: isAgeValid ? parsedAge : undefined,
          heightCm: isHeightValid ? parsedHeight : draftProfile.heightCm,
          weightKg: isWeightValid ? parsedWeight : draftProfile.weightKg,
          gender,
          bmrBiologicalReference,
          primaryGoal,
          weeklyGoalRate,
          activityLevel,
          trainingExperience,
          preferredWorkoutDays,
          workoutLocationPreference: workoutLocation,
          availableEquipment,
          dietaryPreference,
          mealsPerDayPreference: mealsPerDay,
          allergiesRestrictions,
          attributesConfirmed: true,
          calculationOverridden: false,
          targetCalories: recommendations.recommendedCalories ?? draftProfile.targetCalories,
          targetProtein: recommendations.recommendedProtein ?? draftProfile.targetProtein,
          targetCarbs: recommendations.recommendedCarbs ?? draftProfile.targetCarbs,
          targetFats: recommendations.recommendedFats ?? draftProfile.targetFats,
        });
      } else {
        // Save attributes as entered without forcing unapproved targets
        onUpdateProfile({
          age: isAgeValid ? parsedAge : undefined,
          heightCm: isHeightValid ? parsedHeight : draftProfile.heightCm,
          weightKg: isWeightValid ? parsedWeight : draftProfile.weightKg,
          gender,
          bmrBiologicalReference,
          primaryGoal,
          weeklyGoalRate,
          activityLevel,
          trainingExperience,
          preferredWorkoutDays,
          workoutLocationPreference: workoutLocation,
          availableEquipment,
          dietaryPreference,
          mealsPerDayPreference: mealsPerDay,
          allergiesRestrictions,
          attributesConfirmed: attributesConfirmed && isAgeValid && parsedAge >= 18,
        });
      }
    }
    onDone();
  }

  function toggleEquipment(item: string) {
    setAvailableEquipment((prev) =>
      prev.includes(item) ? prev.filter((eq) => eq !== item) : [...prev, item]
    );
  }

  function toggleAllergy(item: string) {
    setAllergiesRestrictions((prev) =>
      prev.includes(item) ? prev.filter((a) => a !== item) : [...prev, item]
    );
  }

  // Option Renderers
  function renderSingleChoice<T extends string | number>(
    items: OptionItem<T>[],
    currentValue: T,
    onSelect: (value: T) => void
  ) {
    return (
      <View style={[styles.chipGroup, activeRowStyle()]}>
        {items.map((item) => {
          const isSelected = currentValue === item.value;
          const { android_ripple, styleModifier } = getPressFeedback({
            rippleColor: `${colors.accent}33`,
            activeOpacity: 0.72,
          });

          return (
            <Pressable
              key={String(item.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={t(item.labelKey)}
              android_ripple={android_ripple}
              onPress={() => onSelect(item.value)}
              style={({ pressed }) => [
                styles.choiceChip,
                {
                  backgroundColor: isSelected ? colors.accent : colors.cardMuted,
                  borderColor: isSelected ? colors.accent : colors.border,
                },
                styleModifier({ pressed }),
              ]}
            >
              {item.icon ? (
                <Ionicons
                  name={item.icon}
                  size={16}
                  color={isSelected ? colors.buttonText : colors.text}
                  style={styles.chipIcon}
                />
              ) : null}
              <Text
                style={[
                  styles.chipText,
                  directionalText,
                  { color: isSelected ? colors.buttonText : colors.text },
                ]}
              >
                {t(item.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  function renderMultiChoice(
    items: OptionItem<string>[],
    selectedValues: string[],
    onToggle: (value: string) => void
  ) {
    return (
      <View style={[styles.chipGroup, activeRowStyle()]}>
        {items.map((item) => {
          const isSelected = selectedValues.includes(item.value);
          const { android_ripple, styleModifier } = getPressFeedback({
            rippleColor: `${colors.accent}33`,
            activeOpacity: 0.72,
          });

          return (
            <Pressable
              key={item.value}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected }}
              accessibilityLabel={t(item.labelKey)}
              android_ripple={android_ripple}
              onPress={() => onToggle(item.value)}
              style={({ pressed }) => [
                styles.choiceChip,
                {
                  backgroundColor: isSelected ? colors.accent : colors.cardMuted,
                  borderColor: isSelected ? colors.accent : colors.border,
                },
                styleModifier({ pressed }),
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  directionalText,
                  { color: isSelected ? colors.buttonText : colors.text },
                ]}
              >
                {t(item.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  // --- Step 1: Personal Details ---
  function renderStep1() {
    const isUnder18 = Number.isFinite(parsedAge) && parsedAge > 0 && parsedAge < 18;

    return (
      <View style={styles.stepContainer}>
        <Text style={[styles.stepTitle, directionalText, { color: colors.text }]}>
          {t('personalization.step1Title')}
        </Text>
        <Text style={[styles.stepSubtitle, directionalText, { color: colors.textMuted }]}>
          {t('personalization.step1Subtitle')}
        </Text>

        <AppCard style={styles.card}>
          <AppInput
            label={t('personalization.age')}
            value={ageStr}
            onChangeText={setAgeStr}
            keyboardType="numeric"
            placeholder={t('personalization.agePlaceholder')}
            error={!isAgeValid ? t('common.requiredMessage') : undefined}
          />
          {isUnder18 ? (
            <View style={[styles.infoBanner, { backgroundColor: `${colors.warning}1A`, borderColor: colors.warning }]}>
              <Ionicons name="information-circle-outline" size={20} color={colors.warning} />
              <Text style={[styles.infoBannerText, directionalText, { color: colors.text }]}>
                {t('personalization.unsupportedAdolescent')}
              </Text>
            </View>
          ) : null}

          <View style={[styles.twoColumnRow, activeRowStyle()]}>
            <View style={styles.flex1}>
              <AppInput
                label={t('personalization.height')}
                value={heightStr}
                onChangeText={setHeightStr}
                keyboardType="numeric"
                error={!isHeightValid ? t('common.requiredMessage') : undefined}
              />
            </View>
            <View style={styles.flex1}>
              <AppInput
                label={t('personalization.weight')}
                value={weightStr}
                onChangeText={setWeightStr}
                keyboardType="numeric"
                error={!isWeightValid ? t('common.requiredMessage') : undefined}
              />
            </View>
          </View>

          <Text style={[styles.fieldLabel, directionalText, { color: colors.textSecondary }]}>
            {t('personalization.gender')}
          </Text>
          {renderSingleChoice<Gender>(
            [
              { value: 'male', labelKey: 'personalization.genderMale' },
              { value: 'female', labelKey: 'personalization.genderFemale' },
              { value: 'other', labelKey: 'personalization.genderOther' },
              { value: 'unspecified', labelKey: 'personalization.genderUnspecified' },
            ],
            gender,
            setGender
          )}

          <Text style={[styles.fieldLabel, directionalText, { color: colors.textSecondary }]}>
            {t('personalization.bmrReference')}
          </Text>
          <Text style={[styles.fieldHint, directionalText, { color: colors.textMuted }]}>
            {t('personalization.bmrReferenceHint')}
          </Text>
          {renderSingleChoice<'male' | 'female' | 'unspecified'>(
            [
              { value: 'male', labelKey: 'personalization.refMale' },
              { value: 'female', labelKey: 'personalization.refFemale' },
              { value: 'unspecified', labelKey: 'personalization.refUnspecified' },
            ],
            bmrBiologicalReference ?? 'unspecified',
            (val) => setBmrBiologicalReference(val === 'unspecified' ? undefined : val)
          )}
        </AppCard>
      </View>
    );
  }

  // --- Step 2: Fitness Goal ---
  function renderStep2() {
    const showRate = primaryGoal === 'weight_loss' || primaryGoal === 'muscle_gain';

    return (
      <View style={styles.stepContainer}>
        <Text style={[styles.stepTitle, directionalText, { color: colors.text }]}>
          {t('personalization.step2Title')}
        </Text>
        <Text style={[styles.stepSubtitle, directionalText, { color: colors.textMuted }]}>
          {t('personalization.step2Subtitle')}
        </Text>

        <AppCard style={styles.card}>
          <Text style={[styles.fieldLabel, directionalText, { color: colors.textSecondary }]}>
            {t('personalization.primaryGoal')}
          </Text>
          {renderSingleChoice<PrimaryGoal>(
            [
              { value: 'weight_loss', labelKey: 'personalization.goalWeightLoss', icon: 'trending-down-outline' },
              { value: 'muscle_gain', labelKey: 'personalization.goalMuscleGain', icon: 'barbell-outline' },
              { value: 'maintenance', labelKey: 'personalization.goalMaintenance', icon: 'shield-checkmark-outline' },
              { value: 'endurance', labelKey: 'personalization.goalEndurance', icon: 'bicycle-outline' },
              { value: 'general_health', labelKey: 'personalization.goalGeneralHealth', icon: 'heart-outline' },
            ],
            primaryGoal,
            setPrimaryGoal
          )}

          {showRate ? (
            <>
              <Text style={[styles.fieldLabel, directionalText, { color: colors.textSecondary, marginTop: spacing.md }]}>
                {t('personalization.weeklyGoalRate')}
              </Text>
              {renderSingleChoice<WeeklyGoalRate>(
                [
                  { value: 'conservative', labelKey: 'personalization.rateConservative' },
                  { value: 'moderate', labelKey: 'personalization.rateModerate' },
                  { value: 'aggressive', labelKey: 'personalization.rateAggressive' },
                ],
                weeklyGoalRate,
                setWeeklyGoalRate
              )}
            </>
          ) : null}
        </AppCard>
      </View>
    );
  }

  // --- Step 3: Activity & Training ---
  function renderStep3() {
    return (
      <View style={styles.stepContainer}>
        <Text style={[styles.stepTitle, directionalText, { color: colors.text }]}>
          {t('personalization.step3Title')}
        </Text>
        <Text style={[styles.stepSubtitle, directionalText, { color: colors.textMuted }]}>
          {t('personalization.step3Subtitle')}
        </Text>

        <AppCard style={styles.card}>
          <Text style={[styles.fieldLabel, directionalText, { color: colors.textSecondary }]}>
            {t('personalization.activityLevel')}
          </Text>
          {renderSingleChoice<ActivityLevel>(
            [
              { value: 'sedentary', labelKey: 'personalization.actSedentary' },
              { value: 'lightly_active', labelKey: 'personalization.actLightlyActive' },
              { value: 'moderately_active', labelKey: 'personalization.actModeratelyActive' },
              { value: 'very_active', labelKey: 'personalization.actVeryActive' },
              { value: 'extra_active', labelKey: 'personalization.actExtraActive' },
            ],
            activityLevel,
            setActivityLevel
          )}

          <Text style={[styles.fieldLabel, directionalText, { color: colors.textSecondary, marginTop: spacing.md }]}>
            {t('personalization.trainingExperience')}
          </Text>
          {renderSingleChoice<'beginner' | 'intermediate' | 'advanced'>(
            [
              { value: 'beginner', labelKey: 'personalization.expBeginner' },
              { value: 'intermediate', labelKey: 'personalization.expIntermediate' },
              { value: 'advanced', labelKey: 'personalization.expAdvanced' },
            ],
            trainingExperience,
            setTrainingExperience
          )}

          <Text style={[styles.fieldLabel, directionalText, { color: colors.textSecondary, marginTop: spacing.md }]}>
            {t('personalization.preferredWorkoutDays')}
          </Text>
          {renderSingleChoice<number>(
            [1, 2, 3, 4, 5, 6, 7].map((d) => ({
              value: d,
              labelKey: 'personalization.daysCount',
            })),
            preferredWorkoutDays,
            setPreferredWorkoutDays
          )}

          <Text style={[styles.fieldLabel, directionalText, { color: colors.textSecondary, marginTop: spacing.md }]}>
            {t('personalization.workoutLocation')}
          </Text>
          {renderSingleChoice<'home' | 'gym' | 'outdoor' | 'flexible'>(
            [
              { value: 'home', labelKey: 'personalization.locHome' },
              { value: 'gym', labelKey: 'personalization.locGym' },
              { value: 'outdoor', labelKey: 'personalization.locOutdoor' },
              { value: 'flexible', labelKey: 'personalization.locFlexible' },
            ],
            workoutLocation,
            setWorkoutLocation
          )}

          <Text style={[styles.fieldLabel, directionalText, { color: colors.textSecondary, marginTop: spacing.md }]}>
            {t('personalization.equipment')}
          </Text>
          {renderMultiChoice(
            [
              { value: 'bodyweight', labelKey: 'personalization.eqBodyweight' },
              { value: 'dumbbells', labelKey: 'personalization.eqDumbbells' },
              { value: 'barbell', labelKey: 'personalization.eqBarbell' },
              { value: 'resistance_bands', labelKey: 'personalization.eqResistanceBands' },
              { value: 'full_gym', labelKey: 'personalization.eqFullGym' },
            ],
            availableEquipment,
            toggleEquipment
          )}
        </AppCard>
      </View>
    );
  }

  // --- Step 4: Nutrition & Diet ---
  function renderStep4() {
    return (
      <View style={styles.stepContainer}>
        <Text style={[styles.stepTitle, directionalText, { color: colors.text }]}>
          {t('personalization.step4Title')}
        </Text>
        <Text style={[styles.stepSubtitle, directionalText, { color: colors.textMuted }]}>
          {t('personalization.step4Subtitle')}
        </Text>

        <AppCard style={styles.card}>
          <Text style={[styles.fieldLabel, directionalText, { color: colors.textSecondary }]}>
            {t('personalization.dietaryPreference')}
          </Text>
          {renderSingleChoice<DietaryPreference>(
            [
              { value: 'standard', labelKey: 'personalization.dietStandard' },
              { value: 'high_protein', labelKey: 'personalization.dietHighProtein' },
              { value: 'low_carb', labelKey: 'personalization.dietLowCarb' },
              { value: 'keto', labelKey: 'personalization.dietKeto' },
              { value: 'vegetarian', labelKey: 'personalization.dietVegetarian' },
              { value: 'vegan', labelKey: 'personalization.dietVegan' },
              { value: 'pescatarian', labelKey: 'personalization.dietPescatarian' },
              { value: 'mediterranean', labelKey: 'personalization.dietMediterranean' },
            ],
            dietaryPreference,
            setDietaryPreference
          )}

          <Text style={[styles.fieldLabel, directionalText, { color: colors.textSecondary, marginTop: spacing.md }]}>
            {t('personalization.mealsPerDay')}
          </Text>
          {renderSingleChoice<number>(
            [2, 3, 4, 5, 6].map((m) => ({
              value: m,
              labelKey: 'personalization.mealsCount',
            })),
            mealsPerDay,
            setMealsPerDay
          )}

          <Text style={[styles.fieldLabel, directionalText, { color: colors.textSecondary, marginTop: spacing.md }]}>
            {t('personalization.allergies')}
          </Text>
          {renderMultiChoice(
            [
              { value: 'dairy_free', labelKey: 'common.optional' },
              { value: 'gluten_free', labelKey: 'common.optional' },
              { value: 'nut_free', labelKey: 'common.optional' },
              { value: 'shellfish_free', labelKey: 'common.optional' },
            ],
            allergiesRestrictions,
            toggleAllergy
          )}
        </AppCard>
      </View>
    );
  }

  // --- Step 5: Review & Confirmation ---
  function renderStep5() {
    const recState = recommendations.recommendationState;

    return (
      <View style={styles.stepContainer}>
        <Text style={[styles.stepTitle, directionalText, { color: colors.text }]}>
          {t('personalization.step5Title')}
        </Text>
        <Text style={[styles.stepSubtitle, directionalText, { color: colors.textMuted }]}>
          {t('personalization.step5Subtitle')}
        </Text>

        {/* Confirmation Toggle Card */}
        <AppCard style={styles.card}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: attributesConfirmed }}
            accessibilityLabel={t('personalization.confirmAttributes')}
            onPress={() => setAttributesConfirmed((prev) => !prev)}
            style={[styles.confirmRow, activeRowStyle()]}
          >
            <View
              style={[
                styles.checkboxBox,
                {
                  backgroundColor: attributesConfirmed ? colors.accent : colors.cardMuted,
                  borderColor: attributesConfirmed ? colors.accent : colors.border,
                },
              ]}
            >
              {attributesConfirmed ? (
                <Ionicons name="checkmark" size={16} color={colors.buttonText} />
              ) : null}
            </View>
            <View style={styles.confirmTextContainer}>
              <Text style={[styles.confirmTitle, directionalText, { color: colors.text }]}>
                {t('personalization.confirmAttributes')}
              </Text>
              <Text style={[styles.confirmDesc, directionalText, { color: colors.textMuted }]}>
                {t('personalization.confirmAttributesDesc')}
              </Text>
            </View>
          </Pressable>
        </AppCard>

        {/* Recommendation State Banner */}
        {recState === 'unsupported' ? (
          <View style={[styles.stateBanner, { backgroundColor: `${colors.danger}15`, borderColor: colors.danger }]}>
            <Ionicons name="alert-circle-outline" size={24} color={colors.danger} />
            <View style={styles.stateBannerContent}>
              <Text style={[styles.stateBannerTitle, directionalText, { color: colors.danger }]}>
                {t('personalization.unsupportedTitle')}
              </Text>
              <Text style={[styles.stateBannerBody, directionalText, { color: colors.text }]}>
                {t('personalization.unsupportedAdolescent')}
              </Text>
            </View>
          </View>
        ) : null}

        {recState === 'conflicting_constraints' ? (
          <View style={[styles.stateBanner, { backgroundColor: `${colors.warning}15`, borderColor: colors.warning }]}>
            <Ionicons name="warning-outline" size={24} color={colors.warning} />
            <View style={styles.stateBannerContent}>
              <Text style={[styles.stateBannerTitle, directionalText, { color: colors.warning }]}>
                {t('personalization.conflictingConstraintsTitle')}
              </Text>
              <Text style={[styles.stateBannerBody, directionalText, { color: colors.text }]}>
                {t('personalization.conflictingConstraintsNotice')}
              </Text>
            </View>
          </View>
        ) : null}

        {recState === 'unconfirmed_estimate' ? (
          <View style={[styles.stateBanner, { backgroundColor: `${colors.accent}15`, borderColor: colors.accent }]}>
            <Ionicons name="help-circle-outline" size={24} color={colors.accent} />
            <View style={styles.stateBannerContent}>
              <Text style={[styles.stateBannerTitle, directionalText, { color: colors.accent }]}>
                {t('personalization.unconfirmedTitle')}
              </Text>
              <Text style={[styles.stateBannerBody, directionalText, { color: colors.text }]}>
                {t('personalization.unconfirmedNotice')}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Targets Display */}
        {recommendations.hasApprovedTarget ? (
          <>
            <View style={[styles.twoColumnRow, activeRowStyle()]}>
              <StatCard
                label={t('personalization.bmrEst')}
                value={`${recommendations.bmr ?? '--'} ${t('common.kcal')}`}
              />
              <StatCard
                label={t('personalization.tdeeEst')}
                value={`${recommendations.tdee ?? '--'} ${t('common.kcal')}`}
                accent={colors.lavender}
              />
            </View>

            <Text style={[styles.sectionHeading, directionalText, { color: colors.text }]}>
              {t('personalization.recommendedEstimateTitle')}
            </Text>

            <View style={[styles.grid, activeRowStyle()]}>
              <MacroCard
                label={t('common.calories')}
                value={recommendations.recommendedCalories ?? 0}
                target={recommendations.recommendedCalories ?? 0}
                unit={t('common.kcal')}
              />
              <MacroCard
                label={t('common.protein')}
                value={recommendations.recommendedProtein ?? 0}
                target={recommendations.recommendedProtein ?? 0}
                unit={t('common.grams')}
                accent={colors.purple}
              />
              <MacroCard
                label={t('common.carbs')}
                value={recommendations.recommendedCarbs ?? 0}
                target={recommendations.recommendedCarbs ?? 0}
                unit={t('common.grams')}
                accent={colors.lavender}
              />
              <MacroCard
                label={t('common.fats')}
                value={recommendations.recommendedFats ?? 0}
                target={recommendations.recommendedFats ?? 0}
                unit={t('common.grams')}
                accent={colors.orange}
              />
            </View>
          </>
        ) : recommendations.preliminaryEstimate ? (
          <View style={styles.preliminarySection}>
            <Text style={[styles.sectionHeading, directionalText, { color: colors.textMuted }]}>
              {t('personalization.unconfirmedTitle')}
            </Text>
            <View style={[styles.grid, activeRowStyle()]}>
              <MacroCard
                label={t('common.calories')}
                value={recommendations.preliminaryEstimate.calories}
                target={recommendations.preliminaryEstimate.calories}
                unit={t('common.kcal')}
              />
              <MacroCard
                label={t('common.protein')}
                value={recommendations.preliminaryEstimate.protein}
                target={recommendations.preliminaryEstimate.protein}
                unit={t('common.grams')}
                accent={colors.purple}
              />
              <MacroCard
                label={t('common.carbs')}
                value={recommendations.preliminaryEstimate.carbs}
                target={recommendations.preliminaryEstimate.carbs}
                unit={t('common.grams')}
                accent={colors.lavender}
              />
              <MacroCard
                label={t('common.fats')}
                value={recommendations.preliminaryEstimate.fats}
                target={recommendations.preliminaryEstimate.fats}
                unit={t('common.grams')}
                accent={colors.orange}
              />
            </View>
          </View>
        ) : null}

        {recommendations.requiresProfessionalReview && recommendations.professionalReviewReasons.length > 0 ? (
          <View style={[styles.reviewBanner, { backgroundColor: `${colors.warning}1A`, borderColor: colors.warning }]}>
            <Ionicons name="medical-outline" size={20} color={colors.warning} />
            <View style={styles.flex1}>
              <Text style={[styles.reviewBannerTitle, directionalText, { color: colors.warning }]}>
                {t('personalization.professionalReview')}
              </Text>
              {recommendations.professionalReviewReasons.map((reason, idx) => (
                <Text key={idx} style={[styles.reviewBannerText, directionalText, { color: colors.text }]}>
                  • {reason}
                </Text>
              ))}
            </View>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header & Progress */}
        <View style={[styles.headerRow, activeRowStyle()]}>
          {step > 1 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.back')}
              onPress={handleBack}
              style={styles.backButton}
            >
              <Ionicons
                name={rtl ? 'chevron-forward' : 'chevron-back'}
                size={24}
                color={colors.text}
              />
            </Pressable>
          ) : (
            <View style={styles.backPlaceholder} />
          )}

          <Text style={[styles.progressText, { color: colors.textMuted }]}>
            {t('personalization.stepProgress', { step, total: totalSteps })}
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('personalization.skipOnboarding')}
            onPress={handleSkip}
            style={styles.skipButton}
          >
            <Text style={[styles.skipText, { color: colors.textMuted }]}>
              {t('common.skip')}
            </Text>
          </Pressable>
        </View>

        {/* Step Indicator Bar */}
        <View style={[styles.progressBar, activeRowStyle()]}>
          {[1, 2, 3, 4, 5].map((s) => (
            <View
              key={s}
              style={[
                styles.progressSegment,
                {
                  backgroundColor: s <= step ? colors.accent : colors.cardMuted,
                },
              ]}
            />
          ))}
        </View>

        {/* Step Contents */}
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
        {step === 5 && renderStep5()}

        {/* Footer Actions */}
        <View style={styles.footer}>
          <AppButton
            title={
              step === totalSteps
                ? recommendations.hasApprovedTarget
                  ? t('personalization.applyTargets')
                  : t('common.start')
                : t('common.next')
            }
            icon={step === totalSteps ? 'checkmark-outline' : 'arrow-forward'}
            onPress={handleNext}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.xl,
    paddingBottom: spacing.xxl * 2,
    gap: spacing.lg,
  },
  headerRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  backButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backPlaceholder: {
    minWidth: 44,
  },
  skipButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  skipText: {
    ...typography.caption,
  },
  progressText: {
    ...typography.caption,
    fontWeight: '600',
  },
  progressBar: {
    gap: spacing.xs,
    height: 4,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  stepContainer: {
    gap: spacing.md,
  },
  stepTitle: {
    ...typography.title,
  },
  stepSubtitle: {
    ...typography.body,
  },
  card: {
    gap: spacing.md,
  },
  twoColumnRow: {
    gap: spacing.md,
  },
  flex1: {
    flex: 1,
  },
  fieldLabel: {
    ...typography.caption,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  fieldHint: {
    ...typography.caption,
    fontSize: 12,
  },
  chipGroup: {
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  choiceChip: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipIcon: {
    marginRight: spacing.xs,
  },
  chipText: {
    ...typography.caption,
    fontWeight: '500',
  },
  confirmRow: {
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
  },
  checkboxBox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmTextContainer: {
    flex: 1,
    gap: 2,
  },
  confirmTitle: {
    ...typography.body,
    fontWeight: '600',
  },
  confirmDesc: {
    ...typography.caption,
    fontSize: 12,
  },
  stateBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  stateBannerContent: {
    flex: 1,
    gap: 4,
  },
  stateBannerTitle: {
    ...typography.body,
    fontWeight: '700',
  },
  stateBannerBody: {
    ...typography.caption,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  infoBannerText: {
    ...typography.caption,
    flex: 1,
  },
  sectionHeading: {
    ...typography.h3,
    marginTop: spacing.sm,
  },
  grid: {
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  preliminarySection: {
    opacity: 0.85,
    gap: spacing.sm,
  },
  reviewBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: spacing.sm,
  },
  reviewBannerTitle: {
    ...typography.caption,
    fontWeight: '700',
    marginBottom: 4,
  },
  reviewBannerText: {
    ...typography.caption,
    fontSize: 12,
  },
  footer: {
    marginTop: spacing.md,
  },
});
