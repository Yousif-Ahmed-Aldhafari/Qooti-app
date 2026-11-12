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
import { AppHeader } from '../components/AppHeader';
import { AppInput } from '../components/AppInput';
import { MacroCard } from '../components/MacroCard';
import { StatCard } from '../components/StatCard';
import { useBottomNavScrollHandler } from '../context/BottomNavContext';
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
  activeRowStyle,
  activeTextAlign,
  activeWritingDirection,
} from '../utils/rtl';
import { getPressFeedback } from '../utils/touchFeedback';

export type ProfileScreenProps = {
  t: Translator;
  profile: UserProfile;
  onSettingsPress: () => void;
  onUpdateProfile?: (profile: Partial<UserProfile>) => void;
};

type OptionItem<T extends string | number> = {
  value: T;
  labelKey: string;
  icon?: keyof typeof Ionicons.glyphMap;
};

export function ProfileScreen({ t, profile, onSettingsPress, onUpdateProfile }: ProfileScreenProps) {
  const colors = themeColors();
  const handleBottomNavScroll = useBottomNavScrollHandler();
  const [isEditing, setIsEditing] = useState<boolean>(false);

  const directionalText = {
    textAlign: activeTextAlign(),
    writingDirection: activeWritingDirection(),
  } as const;

  // Active Profile Recommendations
  const currentRecommendations = useMemo<ProfileRecommendations>(() => {
    return calculateFullRecommendation(profile);
  }, [profile]);

  // Edit Form State
  const [name, setName] = useState<string>(profile.name);
  const [ageStr, setAgeStr] = useState<string>(profile.age ? String(profile.age) : '28');
  const [heightStr, setHeightStr] = useState<string>(profile.heightCm ? String(profile.heightCm) : '170');
  const [weightStr, setWeightStr] = useState<string>(profile.weightKg ? String(profile.weightKg) : '70');
  const [gender, setGender] = useState<Gender>(profile.gender ?? 'unspecified');
  const [bmrBiologicalReference, setBmrBiologicalReference] = useState<'male' | 'female' | undefined>(
    profile.bmrBiologicalReference
  );

  const [primaryGoal, setPrimaryGoal] = useState<PrimaryGoal>(profile.primaryGoal ?? 'general_health');
  const [weeklyGoalRate, setWeeklyGoalRate] = useState<WeeklyGoalRate>(profile.weeklyGoalRate ?? 'moderate');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(profile.activityLevel ?? 'moderately_active');
  const [trainingExperience, setTrainingExperience] = useState<'beginner' | 'intermediate' | 'advanced'>(
    profile.trainingExperience ?? 'beginner'
  );
  const [preferredWorkoutDays, setPreferredWorkoutDays] = useState<number>(profile.preferredWorkoutDays ?? 4);
  const [workoutLocation, setWorkoutLocation] = useState<'home' | 'gym' | 'outdoor' | 'flexible'>(
    profile.workoutLocationPreference ?? 'flexible'
  );
  const [availableEquipment, setAvailableEquipment] = useState<string[]>(
    profile.availableEquipment ?? ['bodyweight']
  );
  const [dietaryPreference, setDietaryPreference] = useState<DietaryPreference>(profile.dietaryPreference ?? 'standard');
  const [mealsPerDay, setMealsPerDay] = useState<number>(profile.mealsPerDayPreference ?? 3);

  const [attributesConfirmed, setAttributesConfirmed] = useState<boolean>(profile.attributesConfirmed ?? false);

  // Custom Targets Overrides in Edit Mode
  const [isCustomOverride, setIsCustomOverride] = useState<boolean>(profile.calculationOverridden ?? false);
  const [customCaloriesStr, setCustomCaloriesStr] = useState<string>(String(profile.targetCalories));
  const [customProteinStr, setCustomProteinStr] = useState<string>(String(profile.targetProtein));
  const [customCarbsStr, setCustomCarbsStr] = useState<string>(String(profile.targetCarbs));
  const [customFatsStr, setCustomFatsStr] = useState<string>(String(profile.targetFats));

  // Parsed numerical edit values
  const parsedAge = parseInt(ageStr, 10);
  const parsedHeight = parseFloat(heightStr);
  const parsedWeight = parseFloat(weightStr);

  const isAgeValid = Number.isFinite(parsedAge) && parsedAge >= 1 && parsedAge <= 120;
  const isHeightValid = Number.isFinite(parsedHeight) && parsedHeight >= 60 && parsedHeight <= 260;
  const isWeightValid = Number.isFinite(parsedWeight) && parsedWeight >= 20 && parsedWeight <= 350;

  // Live Recommendation for Edit Mode
  const editDraftProfile = useMemo<UserProfile>(() => {
    return {
      ...profile,
      name,
      age: isAgeValid ? parsedAge : profile.age,
      heightCm: isHeightValid ? parsedHeight : profile.heightCm,
      weightKg: isWeightValid ? parsedWeight : profile.weightKg,
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
      attributesConfirmed,
      calculationOverridden: isCustomOverride,
    };
  }, [
    profile,
    name,
    isAgeValid,
    parsedAge,
    isHeightValid,
    parsedHeight,
    isWeightValid,
    parsedWeight,
    gender,
    bmrBiologicalReference,
    primaryGoal,
    weeklyGoalRate,
    activityLevel,
    trainingExperience,
    preferredWorkoutDays,
    workoutLocation,
    availableEquipment,
    dietaryPreference,
    mealsPerDay,
    attributesConfirmed,
    isCustomOverride,
  ]);

  const editRecommendations = useMemo<ProfileRecommendations>(() => {
    return calculateFullRecommendation(editDraftProfile);
  }, [editDraftProfile]);

  function startEditing() {
    setName(profile.name);
    setAgeStr(profile.age ? String(profile.age) : '28');
    setHeightStr(profile.heightCm ? String(profile.heightCm) : '170');
    setWeightStr(profile.weightKg ? String(profile.weightKg) : '70');
    setGender(profile.gender ?? 'unspecified');
    setBmrBiologicalReference(profile.bmrBiologicalReference);
    setPrimaryGoal(profile.primaryGoal ?? 'general_health');
    setWeeklyGoalRate(profile.weeklyGoalRate ?? 'moderate');
    setActivityLevel(profile.activityLevel ?? 'moderately_active');
    setTrainingExperience(profile.trainingExperience ?? 'beginner');
    setPreferredWorkoutDays(profile.preferredWorkoutDays ?? 4);
    setWorkoutLocation(profile.workoutLocationPreference ?? 'flexible');
    setAvailableEquipment(profile.availableEquipment ?? ['bodyweight']);
    setDietaryPreference(profile.dietaryPreference ?? 'standard');
    setMealsPerDay(profile.mealsPerDayPreference ?? 3);
    setAttributesConfirmed(profile.attributesConfirmed ?? false);
    setIsCustomOverride(profile.calculationOverridden ?? false);
    setCustomCaloriesStr(String(profile.targetCalories));
    setCustomProteinStr(String(profile.targetProtein));
    setCustomCarbsStr(String(profile.targetCarbs));
    setCustomFatsStr(String(profile.targetFats));
    setIsEditing(true);
  }

  function cancelEditing() {
    setIsEditing(false);
  }

  function saveChanges() {
    if (!onUpdateProfile) {
      setIsEditing(false);
      return;
    }

    const nextAge = isAgeValid ? parsedAge : profile.age;
    const nextHeight = isHeightValid ? parsedHeight : profile.heightCm;
    const nextWeight = isWeightValid ? parsedWeight : profile.weightKg;

    if (isCustomOverride) {
      const parsedCal = parseInt(customCaloriesStr, 10) || profile.targetCalories;
      const parsedProt = parseInt(customProteinStr, 10) || profile.targetProtein;
      const parsedCarbs = parseInt(customCarbsStr, 10) || profile.targetCarbs;
      const parsedFats = parseInt(customFatsStr, 10) || profile.targetFats;

      onUpdateProfile({
        name,
        age: nextAge,
        heightCm: nextHeight,
        weightKg: nextWeight,
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
        attributesConfirmed,
        calculationOverridden: true,
        targetCalories: parsedCal,
        targetProtein: parsedProt,
        targetCarbs: parsedCarbs,
        targetFats: parsedFats,
        targetFat: parsedFats,
      });
    } else if (editRecommendations.hasApprovedTarget) {
      onUpdateProfile({
        name,
        age: nextAge,
        heightCm: nextHeight,
        weightKg: nextWeight,
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
        attributesConfirmed: true,
        calculationOverridden: false,
        targetCalories: editRecommendations.recommendedCalories ?? profile.targetCalories,
        targetProtein: editRecommendations.recommendedProtein ?? profile.targetProtein,
        targetCarbs: editRecommendations.recommendedCarbs ?? profile.targetCarbs,
        targetFats: editRecommendations.recommendedFats ?? profile.targetFats,
        targetFat: editRecommendations.recommendedFats ?? profile.targetFats,
      });
    } else {
      // Attributes updated without setting unverified targets
      onUpdateProfile({
        name,
        age: nextAge,
        heightCm: nextHeight,
        weightKg: nextWeight,
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
        attributesConfirmed: attributesConfirmed && (nextAge ? nextAge >= 18 : false),
      });
    }

    setIsEditing(false);
  }

  function resetToRecommended() {
    if (!onUpdateProfile) {
      return;
    }
    const confirmedProfile = { ...profile, attributesConfirmed: true };
    const rec = calculateFullRecommendation(confirmedProfile);
    if (rec.hasApprovedTarget && rec.recommendedCalories) {
      onUpdateProfile({
        attributesConfirmed: true,
        calculationOverridden: false,
        targetCalories: rec.recommendedCalories,
        targetProtein: rec.recommendedProtein!,
        targetCarbs: rec.recommendedCarbs!,
        targetFats: rec.recommendedFats!,
        targetFat: rec.recommendedFats!,
      });
    }
  }

  function toggleEquipment(item: string) {
    setAvailableEquipment((prev) =>
      prev.includes(item) ? prev.filter((eq) => eq !== item) : [...prev, item]
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

  // Single choice chip renderer for edit form
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

  // --- Render Edit Mode ---
  if (isEditing) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.screen, { backgroundColor: colors.background }]}
      >
        <ScrollView
          style={styles.screen}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <AppHeader
            title={t('personalization.editAttributes')}
            subtitle={t('profile.subtitle')}
            action={
              <AppButton
                title={t('personalization.cancelEdit')}
                variant="ghost"
                onPress={cancelEditing}
              />
            }
          />

          <AppCard style={styles.cardGap}>
            <AppInput
              label={t('common.name')}
              value={name}
              onChangeText={setName}
            />

            <View style={[styles.twoColumnRow, activeRowStyle()]}>
              <View style={styles.flex1}>
                <AppInput
                  label={t('personalization.age')}
                  value={ageStr}
                  onChangeText={setAgeStr}
                  keyboardType="numeric"
                  error={!isAgeValid ? t('common.requiredMessage') : undefined}
                />
              </View>
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

          <AppCard style={styles.cardGap}>
            <Text style={[styles.fieldLabel, directionalText, { color: colors.textSecondary }]}>
              {t('personalization.primaryGoal')}
            </Text>
            {renderSingleChoice<PrimaryGoal>(
              [
                { value: 'weight_loss', labelKey: 'personalization.goalWeightLoss' },
                { value: 'muscle_gain', labelKey: 'personalization.goalMuscleGain' },
                { value: 'maintenance', labelKey: 'personalization.goalMaintenance' },
                { value: 'endurance', labelKey: 'personalization.goalEndurance' },
                { value: 'general_health', labelKey: 'personalization.goalGeneralHealth' },
              ],
              primaryGoal,
              setPrimaryGoal
            )}

            <Text style={[styles.fieldLabel, directionalText, { color: colors.textSecondary, marginTop: spacing.xs }]}>
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

            <Text style={[styles.fieldLabel, directionalText, { color: colors.textSecondary, marginTop: spacing.xs }]}>
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

            <Text style={[styles.fieldLabel, directionalText, { color: colors.textSecondary, marginTop: spacing.xs }]}>
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

            <Text style={[styles.fieldLabel, directionalText, { color: colors.textSecondary, marginTop: spacing.xs }]}>
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

          {/* Confirmation & Custom Target Overrides */}
          <AppCard style={styles.cardGap}>
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
              <View style={styles.flex1}>
                <Text style={[styles.confirmTitle, directionalText, { color: colors.text }]}>
                  {t('personalization.confirmAttributes')}
                </Text>
                <Text style={[styles.confirmDesc, directionalText, { color: colors.textMuted }]}>
                  {t('personalization.confirmAttributesDesc')}
                </Text>
              </View>
            </Pressable>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isCustomOverride }}
              accessibilityLabel={t('personalization.setCustomTargets')}
              onPress={() => setIsCustomOverride((prev) => !prev)}
              style={[styles.confirmRow, activeRowStyle()]}
            >
              <View
                style={[
                  styles.checkboxBox,
                  {
                    backgroundColor: isCustomOverride ? colors.accent : colors.cardMuted,
                    borderColor: isCustomOverride ? colors.accent : colors.border,
                  },
                ]}
              >
                {isCustomOverride ? (
                  <Ionicons name="checkmark" size={16} color={colors.buttonText} />
                ) : null}
              </View>
              <View style={styles.flex1}>
                <Text style={[styles.confirmTitle, directionalText, { color: colors.text }]}>
                  {t('personalization.setCustomTargets')}
                </Text>
              </View>
            </Pressable>

            {isCustomOverride ? (
              <View style={styles.customInputsSection}>
                <AppInput
                  label={t('common.calories')}
                  value={customCaloriesStr}
                  onChangeText={setCustomCaloriesStr}
                  keyboardType="numeric"
                />
                <View style={[styles.twoColumnRow, activeRowStyle()]}>
                  <View style={styles.flex1}>
                    <AppInput
                      label={t('common.protein')}
                      value={customProteinStr}
                      onChangeText={setCustomProteinStr}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.flex1}>
                    <AppInput
                      label={t('common.carbs')}
                      value={customCarbsStr}
                      onChangeText={setCustomCarbsStr}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.flex1}>
                    <AppInput
                      label={t('common.fats')}
                      value={customFatsStr}
                      onChangeText={setCustomFatsStr}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              </View>
            ) : null}
          </AppCard>

          <AppButton
            title={t('personalization.saveAttributes')}
            icon="checkmark-outline"
            onPress={saveChanges}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // --- Render View Mode ---
  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      onScroll={handleBottomNavScroll}
      scrollEventThrottle={16}
    >
      <AppHeader
        title={t('profile.title')}
        subtitle={t('profile.subtitle')}
        action={
          <AppButton
            title={t('common.settings')}
            icon="settings-outline"
            variant="secondary"
            onPress={onSettingsPress}
          />
        }
      />

      {/* Profile Overview Card */}
      <AppCard>
        <View style={[styles.profileRow, activeRowStyle()]}>
          <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
            <Text style={[styles.avatarText, { color: colors.buttonText }]}>
              {profile.avatarInitials}
            </Text>
          </View>
          <View style={styles.copy}>
            <Text style={[styles.name, directionalText, { color: colors.text }]}>{profile.name}</Text>
            <Text style={[styles.email, directionalText, { color: colors.textMuted }]}>{profile.email}</Text>
          </View>
          <AppButton
            title={t('common.edit')}
            icon="create-outline"
            variant="ghost"
            onPress={startEditing}
          />
        </View>
      </AppCard>

      {/* Attributes Card */}
      <AppCard style={styles.cardGap}>
        <View style={[styles.cardHeaderRow, activeRowStyle()]}>
          <Text style={[styles.cardHeaderTitle, directionalText, { color: colors.text }]}>
            {t('personalization.attributesCardTitle')}
          </Text>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: profile.attributesConfirmed
                  ? `${colors.accent}20`
                  : `${colors.warning}20`,
                borderColor: profile.attributesConfirmed ? colors.accent : colors.warning,
              },
            ]}
          >
            <Ionicons
              name={profile.attributesConfirmed ? 'checkmark-circle' : 'alert-circle'}
              size={14}
              color={profile.attributesConfirmed ? colors.accent : colors.warning}
            />
            <Text
              style={[
                styles.statusBadgeText,
                { color: profile.attributesConfirmed ? colors.accent : colors.warning },
              ]}
            >
              {profile.attributesConfirmed
                ? t('personalization.confirmedStatus')
                : t('personalization.unconfirmedStatus')}
            </Text>
          </View>
        </View>

        <View style={[styles.statsRow, activeRowStyle()]}>
          <StatCard
            label={t('personalization.age')}
            value={profile.age ? `${profile.age}` : '--'}
          />
          <StatCard
            label={t('profile.height')}
            value={`${profile.heightCm} ${t('common.cm')}`}
          />
          <StatCard
            label={t('profile.weight')}
            value={`${profile.weightKg} ${t('common.kg')}`}
            accent={colors.lavender}
          />
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={[styles.twoColumnRow, activeRowStyle()]}>
          <View style={styles.flex1}>
            <Text style={[styles.label, directionalText, { color: colors.textMuted }]}>
              {t('personalization.gender')}
            </Text>
            <Text style={[styles.valueText, directionalText, { color: colors.text }]}>
              {profile.gender
                ? t(`personalization.gender${profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1)}`)
                : '--'}
            </Text>
          </View>
          <View style={styles.flex1}>
            <Text style={[styles.label, directionalText, { color: colors.textMuted }]}>
              {t('personalization.bmrReference')}
            </Text>
            <Text style={[styles.valueText, directionalText, { color: colors.text }]}>
              {profile.bmrBiologicalReference
                ? t(`personalization.ref${profile.bmrBiologicalReference.charAt(0).toUpperCase() + profile.bmrBiologicalReference.slice(1)}`)
                : t('personalization.refUnspecified')}
            </Text>
          </View>
        </View>
      </AppCard>

      {/* Fitness Goals & Preferences Card */}
      <AppCard style={styles.cardGap}>
        <Text style={[styles.cardHeaderTitle, directionalText, { color: colors.text }]}>
          {t('personalization.goalsCardTitle')}
        </Text>

        <View style={[styles.twoColumnRow, activeRowStyle()]}>
          <View style={styles.flex1}>
            <Text style={[styles.label, directionalText, { color: colors.textMuted }]}>
              {t('personalization.primaryGoal')}
            </Text>
            <Text style={[styles.valueText, directionalText, { color: colors.text }]}>
              {profile.primaryGoal
                ? t(
                    `personalization.goal${profile.primaryGoal
                      .split('_')
                      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
                      .join('')}`
                  )
                : profile.goal || '--'}
            </Text>
          </View>
          <View style={styles.flex1}>
            <Text style={[styles.label, directionalText, { color: colors.textMuted }]}>
              {t('personalization.weeklyGoalRate')}
            </Text>
            <Text style={[styles.valueText, directionalText, { color: colors.text }]}>
              {profile.weeklyGoalRate
                ? t(`personalization.rate${profile.weeklyGoalRate.charAt(0).toUpperCase() + profile.weeklyGoalRate.slice(1)}`)
                : '--'}
            </Text>
          </View>
        </View>

        <View style={[styles.twoColumnRow, activeRowStyle()]}>
          <View style={styles.flex1}>
            <Text style={[styles.label, directionalText, { color: colors.textMuted }]}>
              {t('personalization.activityLevel')}
            </Text>
            <Text style={[styles.valueText, directionalText, { color: colors.text }]}>
              {profile.activityLevel
                ? t(
                    `personalization.act${profile.activityLevel
                      .split('_')
                      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
                      .join('')}`
                  )
                : '--'}
            </Text>
          </View>
          <View style={styles.flex1}>
            <Text style={[styles.label, directionalText, { color: colors.textMuted }]}>
              {t('personalization.dietaryPreference')}
            </Text>
            <Text style={[styles.valueText, directionalText, { color: colors.text }]}>
              {profile.dietaryPreference
                ? t(
                    `personalization.diet${profile.dietaryPreference
                      .split('_')
                      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
                      .join('')}`
                  )
                : '--'}
            </Text>
          </View>
        </View>
      </AppCard>

      {/* Target Status Badges and Disclaimers */}
      <View style={[styles.targetsHeaderRow, activeRowStyle()]}>
        <Text style={[styles.sectionTitle, directionalText, { color: colors.text }]}>
          {t('profile.targets')}
        </Text>
        {profile.calculationOverridden ? (
          <View style={[styles.badge, { backgroundColor: `${colors.accent}25`, borderColor: colors.accent }]}>
            <Text style={[styles.badgeText, { color: colors.accent }]}>
              {t('personalization.customOverrideBadge')}
            </Text>
          </View>
        ) : currentRecommendations.hasApprovedTarget ? (
          <View style={[styles.badge, { backgroundColor: `${colors.accent}20`, borderColor: colors.accent }]}>
            <Text style={[styles.badgeText, { color: colors.accent }]}>
              {t('personalization.recommendedEstimateTitle')}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Status Warning Alerts if not approved */}
      {currentRecommendations.status === 'unconfirmed_attributes' ? (
        <View style={[styles.stateAlert, { backgroundColor: `${colors.accent}15`, borderColor: colors.accent }]}>
          <Ionicons name="information-circle-outline" size={20} color={colors.accent} />
          <Text style={[styles.stateAlertText, directionalText, { color: colors.text }]}>
            {t('personalization.unconfirmedNotice')}
          </Text>
        </View>
      ) : null}

      {currentRecommendations.status === 'unsupported_adolescent' ? (
        <View style={[styles.stateAlert, { backgroundColor: `${colors.danger}15`, borderColor: colors.danger }]}>
          <Ionicons name="alert-circle-outline" size={20} color={colors.danger} />
          <Text style={[styles.stateAlertText, directionalText, { color: colors.danger }]}>
            {t('personalization.unsupportedAdolescent')}
          </Text>
        </View>
      ) : null}

      {/* Nutrition Targets Grid */}
      <View style={[styles.grid, activeRowStyle()]}>
        <MacroCard
          label={t('common.calories')}
          value={profile.targetCalories}
          target={profile.targetCalories}
          unit={t('common.kcal')}
        />
        <MacroCard
          label={t('common.protein')}
          value={profile.targetProtein}
          target={profile.targetProtein}
          unit={t('common.grams')}
          accent={colors.purple}
        />
        <MacroCard
          label={t('common.carbs')}
          value={profile.targetCarbs}
          target={profile.targetCarbs}
          unit={t('common.grams')}
          accent={colors.lavender}
        />
        <MacroCard
          label={t('common.fats')}
          value={profile.targetFats}
          target={profile.targetFats}
          unit={t('common.grams')}
          accent={colors.orange}
        />
      </View>

      {/* Reset Target action if custom override is active */}
      {profile.calculationOverridden && currentRecommendations.hasApprovedTarget ? (
        <AppButton
          title={t('personalization.resetToRecommended')}
          icon="refresh-outline"
          variant="secondary"
          onPress={resetToRecommended}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: spacing.xl,
    paddingBottom: 120,
    gap: spacing.lg,
  },
  profileRow: {
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...typography.h2,
  },
  copy: {
    flex: 1,
    gap: spacing.xs,
  },
  name: {
    ...typography.h2,
  },
  email: {
    ...typography.body,
  },
  cardGap: {
    gap: spacing.md,
  },
  cardHeaderRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardHeaderTitle: {
    ...typography.h3,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  statusBadgeText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '600',
  },
  statsRow: {
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  divider: {
    height: 1,
  },
  twoColumnRow: {
    gap: spacing.md,
  },
  flex1: {
    flex: 1,
  },
  label: {
    ...typography.caption,
  },
  valueText: {
    ...typography.body,
    fontWeight: '600',
    marginTop: 2,
  },
  targetsHeaderRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    ...typography.h3,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  badgeText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '700',
  },
  stateAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  stateAlertText: {
    ...typography.caption,
    flex: 1,
  },
  grid: {
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  fieldLabel: {
    ...typography.caption,
    fontWeight: '600',
  },
  chipGroup: {
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  choiceChip: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    ...typography.caption,
    fontWeight: '500',
  },
  confirmRow: {
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 44,
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmTitle: {
    ...typography.body,
    fontWeight: '600',
  },
  confirmDesc: {
    ...typography.caption,
    fontSize: 12,
  },
  customInputsSection: {
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
});
