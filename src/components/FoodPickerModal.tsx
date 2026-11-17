import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { Translator } from '../i18n';
import type {
  CustomFood,
  FoodCategory,
  ServingOption,
} from '../models/food';
import type { MealItem } from '../models/meal';
import { themeColors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import {
  calculateServingGrams,
  createCustomFoodMealItemSnapshot,
  createMealItemSnapshot,
  scaleCustomFoodNutrients,
  scaleFoodNutrients,
  SCALING_LIMITS,
} from '../utils/foodScaling';
import {
  searchAllFoods,
  type UnifiedFoodItem,
} from '../utils/foodSearch';
import { parseStrictQuantity } from '../utils/nutrition';
import { activeRowStyle, activeTextAlign, activeWritingDirection } from '../utils/rtl';
import { getPressFeedback } from '../utils/touchFeedback';
import { loadCustomFoods } from '../services/customFoodService';

export type FoodPickerModalProps = {
  visible: boolean;
  onClose: () => void;
  onSelectFood: (item: MealItem) => void;
  onAddManual?: () => void;
  t: Translator;
  language?: 'en' | 'ar';
  customFoods?: CustomFood[];
};

const CATEGORIES: { id: FoodCategory | 'all'; key: string }[] = [
  { id: 'all', key: 'foodPicker.allCategories' },
  { id: 'meat_poultry', key: 'foodCategories.meat_poultry' },
  { id: 'fish_seafood', key: 'foodCategories.fish_seafood' },
  { id: 'eggs_dairy', key: 'foodCategories.eggs_dairy' },
  { id: 'grains_breads', key: 'foodCategories.grains_breads' },
  { id: 'rice_pasta', key: 'foodCategories.rice_pasta' },
  { id: 'legumes', key: 'foodCategories.legumes' },
  { id: 'fruits_vegetables', key: 'foodCategories.fruits_vegetables' },
  { id: 'nuts_seeds', key: 'foodCategories.nuts_seeds' },
  { id: 'oils_fats', key: 'foodCategories.oils_fats' },
  { id: 'middle_eastern', key: 'foodCategories.middle_eastern' },
  { id: 'beverages', key: 'foodCategories.beverages' },
  { id: 'custom', key: 'foodCategories.custom' },
];

export function FoodPickerModal({
  visible,
  onClose,
  onSelectFood,
  onAddManual,
  t,
  language = 'en',
  customFoods: customFoodsProp,
}: FoodPickerModalProps) {
  const colors = themeColors();
  const isRTL = language === 'ar';

  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<FoodCategory | 'all'>('all');
  const [loadedCustomFoods, setLoadedCustomFoods] = useState<CustomFood[]>([]);
  const [selectedItem, setSelectedItem] = useState<UnifiedFoodItem | null>(null);

  // Portion configuration state
  const [selectedServingUnit, setSelectedServingUnit] = useState<string>('g');
  const [quantityInput, setQuantityInput] = useState<string>('1');
  const [quantityError, setQuantityError] = useState<string>('');

  // Load custom foods from SQLite if not passed via prop
  useEffect(() => {
    let isMounted = true;
    if (visible && !customFoodsProp) {
      loadCustomFoods()
        .then((foods) => {
          if (isMounted) setLoadedCustomFoods(foods);
        })
        .catch((err) => {
          console.warn('[FoodPickerModal] Failed to load custom foods:', err);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [visible, customFoodsProp]);

  const handleDismiss = useCallback(() => {
    setQuery('');
    setSelectedCategory('all');
    setSelectedItem(null);
    setQuantityInput('1');
    setQuantityError('');
    onClose();
  }, [onClose]);

  const directionalText = {
    textAlign: activeTextAlign(),
    writingDirection: activeWritingDirection(),
  } as const;

  const { android_ripple } = getPressFeedback({
    rippleColor: `${colors.border}4D`,
    activeOpacity: 0.72,
  });

  // Effective custom foods list
  const activeCustomFoods = customFoodsProp ?? loadedCustomFoods;

  // Search results
  const searchResults = useMemo(() => {
    const categoryFilter = selectedCategory === 'all' ? undefined : selectedCategory;
    return searchAllFoods(query, {
      category: categoryFilter,
      customFoods: activeCustomFoods,
      limit: 60,
      includeMismatch: false,
    });
  }, [query, selectedCategory, activeCustomFoods]);

  // When an item is selected for portioning, initialize default unit
  function handleSelectItem(item: UnifiedFoodItem) {
    setSelectedItem(item);
    setQuantityInput('1');
    setQuantityError('');

    if (item.isCustom) {
      setSelectedServingUnit(item.servingUnit || 'g');
    } else {
      // Choose first non-gram serving unit if available, otherwise default to first unit or 'g'
      const options = item.servingOptions || [];
      const nonGramOption = options.find((o) => o.id !== 'g' && o.id !== '100g');
      setSelectedServingUnit(nonGramOption ? nonGramOption.id : options[0]?.id || 'g');
    }
  }

  // Calculate live portion nutrition
  const portionNutrition = useMemo(() => {
    if (!selectedItem) return null;

    const parsed = parseStrictQuantity(quantityInput);
    if (!parsed.isValid) {
      return { isValid: false, grams: 0, calories: 0, protein: 0, carbs: 0, fats: 0 };
    }

    const qty = parsed.value;
    if (qty <= 0 || qty > SCALING_LIMITS.MAX_QUANTITY) {
      return { isValid: false, grams: 0, calories: 0, protein: 0, carbs: 0, fats: 0 };
    }

    try {
      if (selectedItem.isCustom) {
        const scaled = scaleCustomFoodNutrients(selectedItem, qty);
        return {
          isValid: true,
          grams: Math.round(selectedItem.servingSize * qty * 10) / 10,
          calories: scaled.calories,
          protein: scaled.protein,
          carbs: scaled.carbs,
          fats: scaled.fats,
        };
      } else {
        const option = selectedItem.servingOptions.find((o) => o.id === selectedServingUnit) || {
          id: 'g',
          nameEn: 'Grams',
          nameAr: 'جرام',
          grams: 1,
        };
        const grams = calculateServingGrams(option, qty);
        const scaled = scaleFoodNutrients(selectedItem, qty, selectedServingUnit);
        return {
          isValid: true,
          grams: Math.round(grams * 10) / 10,
          calories: scaled.calories,
          protein: scaled.protein,
          carbs: scaled.carbs,
          fats: scaled.fats,
        };
      }
    } catch {
      return { isValid: false, grams: 0, calories: 0, protein: 0, carbs: 0, fats: 0 };
    }
  }, [selectedItem, selectedServingUnit, quantityInput]);

  // Confirm adding food to meal draft
  function handleConfirmAdd() {
    if (!selectedItem) return;

    const parsed = parseStrictQuantity(quantityInput);
    if (!parsed.isValid) {
      setQuantityError(t(parsed.errorMessageKey as any) || parsed.defaultMessage || 'Must be > 0');
      return;
    }

    const qty = parsed.value;
    if (qty <= 0 || qty > SCALING_LIMITS.MAX_QUANTITY) {
      setQuantityError(t('validation.mustBePositive') || 'Must be > 0');
      return;
    }

    let mealItem: MealItem;
    if (selectedItem.isCustom) {
      mealItem = createCustomFoodMealItemSnapshot(selectedItem, qty);
    } else {
      mealItem = createMealItemSnapshot(selectedItem, qty, selectedServingUnit);
    }

    onSelectFood(mealItem);
    handleDismiss();
  }

  // Render food name based on active language
  function getFoodDisplayName(item: UnifiedFoodItem): string {
    if (item.isCustom) {
      return (isRTL && item.nameAr) ? item.nameAr : item.name;
    }
    return (isRTL && item.nameAr) ? item.nameAr : (item.nameEn || item.nameAr || '');
  }

  // Render unit label
  function getUnitDisplayName(opt: ServingOption): string {
    return isRTL ? (opt.labelAr || opt.nameAr || opt.nameEn) : (opt.labelEn || opt.nameEn || opt.nameAr);
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={() => {
        if (selectedItem) {
          setSelectedItem(null);
        } else {
          handleDismiss();
        }
      }}
    >
      <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
        >
          {/* Header */}
          <View style={[styles.header, activeRowStyle(), { borderBottomColor: colors.border }]}>
            <View style={styles.headerTitleWrap}>
              <Text style={[styles.headerTitle, directionalText, { color: colors.text }]}>
                {selectedItem
                  ? t('foodPicker.portionTitle') || 'Set Portion'
                  : t('foodPicker.title') || 'Select Food'}
              </Text>
              <Text style={[styles.headerSubtitle, directionalText, { color: colors.textMuted }]}>
                {selectedItem
                  ? getFoodDisplayName(selectedItem)
                  : t('foodPicker.subtitle') || '150+ verified foods'}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
              onPress={() => {
                if (selectedItem) {
                  setSelectedItem(null);
                } else {
                  handleDismiss();
                }
              }}
              style={({ pressed }) => [styles.closeButton, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Ionicons name={selectedItem ? (isRTL ? 'arrow-forward' : 'arrow-back') : 'close'} size={24} color={colors.text} />
            </Pressable>
          </View>

          {/* STEP 1: BROWSE & SEARCH */}
          {!selectedItem && (
            <View style={styles.contentWrap}>
              {/* Search Bar */}
              <View style={styles.searchContainer}>
                <View
                  style={[
                    styles.searchBox,
                    activeRowStyle(),
                    { backgroundColor: colors.inputBackground, borderColor: colors.border },
                  ]}
                >
                  <Ionicons name="search" size={20} color={colors.textMuted} />
                  <TextInput
                    style={[styles.searchInput, directionalText, { color: colors.text }]}
                    placeholder={t('foodPicker.searchPlaceholder') || 'Search chicken, rice, dates...'}
                    placeholderTextColor={colors.textMuted}
                    value={query}
                    onChangeText={setQuery}
                    autoCorrect={false}
                    returnKeyType="search"
                    clearButtonMode="while-editing"
                    accessibilityLabel={t('foodPicker.searchPlaceholder')}
                  />
                  {query.length > 0 && Platform.OS !== 'ios' && (
                    <Pressable
                      onPress={() => setQuery('')}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={t('common.clear')}
                    >
                      <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                    </Pressable>
                  )}
                </View>
              </View>

              {/* Category Filter Chips */}
              <View style={styles.categoryScrollContainer}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.categoryContent}
                >
                  {CATEGORIES.map((cat) => {
                    const isSelected = selectedCategory === cat.id;
                    return (
                      <Pressable
                        key={cat.id}
                        onPress={() => setSelectedCategory(cat.id)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        style={[
                          styles.categoryChip,
                          {
                            backgroundColor: isSelected ? colors.primary : colors.card,
                            borderColor: isSelected ? colors.primary : colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.categoryChipText,
                            { color: isSelected ? '#FFFFFF' : colors.text },
                          ]}
                        >
                          {t(cat.key as any) || cat.id}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Results List */}
              <FlatList
                data={searchResults}
                keyExtractor={(item) => (item.isCustom ? `custom_${item.id}` : `catalog_${item.id}`)}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => {
                  const isCustom = item.isCustom;
                  const caloriesPer100g = isCustom ? item.calories : item.caloriesPer100g;
                  const protein = isCustom ? item.protein : item.proteinPer100g;
                  const carbs = isCustom ? item.carbs : item.carbsPer100g;
                  const fats = isCustom ? item.fats : item.fatsPer100g;
                  const prepState = !isCustom ? item.preparationState : undefined;
                  const provenance = !isCustom ? item.provenanceStatus : undefined;

                  return (
                    <Pressable
                      android_ripple={android_ripple}
                      onPress={() => handleSelectItem(item)}
                      accessibilityRole="button"
                      accessibilityLabel={`${getFoodDisplayName(item)}, ${caloriesPer100g} kcal`}
                      style={({ pressed }) => [
                        styles.foodCard,
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                          opacity: Platform.OS === 'ios' && pressed ? 0.7 : 1,
                        },
                      ]}
                    >
                      <View style={[styles.cardHeaderRow, activeRowStyle()]}>
                        <Text style={[styles.foodName, directionalText, { color: colors.text }]} numberOfLines={1}>
                          {getFoodDisplayName(item)}
                        </Text>
                        <Text style={[styles.cardCalories, directionalText, { color: colors.accent }]}>
                          {`${Math.round(caloriesPer100g)} ${t('common.kcal')}`}
                        </Text>
                      </View>

                      {/* Badges and metadata */}
                      <View style={[styles.badgeRow, activeRowStyle()]}>
                        {isCustom ? (
                          <View style={[styles.badge, { backgroundColor: '#7C3AED20', borderColor: '#7C3AED80' }]}>
                            <Text style={[styles.badgeText, { color: '#8B5CF6' }]}>
                              {t('foodPicker.customBadge') || 'Custom'}
                            </Text>
                          </View>
                        ) : null}

                        {prepState ? (
                          <View style={[styles.badge, { backgroundColor: `${colors.textMuted}1A`, borderColor: colors.border }]}>
                            <Text style={[styles.badgeText, { color: colors.textMuted }]}>
                              {prepState}
                            </Text>
                          </View>
                        ) : null}

                        {provenance === 'VERIFIED' && (
                          <View style={[styles.badge, { backgroundColor: '#10B98120', borderColor: '#10B98160' }]}>
                            <Text style={[styles.badgeText, { color: '#059669' }]}>
                              {t('foodPicker.verifiedBadge') || 'Verified'}
                            </Text>
                          </View>
                        )}

                        {provenance === 'ESTIMATED' && (
                          <View style={[styles.badge, { backgroundColor: '#3B82F620', borderColor: '#3B82F660' }]}>
                            <Text style={[styles.badgeText, { color: '#2563EB' }]}>
                              {t('foodPicker.estimatedBadge') || 'Estimate'}
                            </Text>
                          </View>
                        )}

                        {provenance === 'UNVERIFIED' && (
                          <View style={[styles.badge, { backgroundColor: '#F59E0B20', borderColor: '#F59E0B60' }]}>
                            <Text style={[styles.badgeText, { color: '#D97706' }]}>
                              {t('foodPicker.unverifiedBadge') || 'Unverified'}
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Macro subline */}
                      <View style={[styles.macroSubRow, activeRowStyle()]}>
                        <Text style={[styles.macroSubText, directionalText, { color: colors.textMuted }]}>
                          {`P: ${protein}g · C: ${carbs}g · F: ${fats}g`}
                          <Text style={{ fontStyle: 'italic', fontSize: 11 }}>
                            {isCustom ? ` (${t('meals.perServing') || 'per serving'})` : ` (${t('foodPicker.per100g') || 'per 100g'})`}
                          </Text>
                        </Text>
                      </View>
                    </Pressable>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Ionicons name="nutrition-outline" size={48} color={colors.textMuted} />
                    <Text style={[styles.emptyTitle, directionalText, { color: colors.text }]}>
                      {t('foodPicker.noResults') || 'No foods found'}
                    </Text>
                    <Text style={[styles.emptySubtitle, directionalText, { color: colors.textMuted }]}>
                      {t('foodPicker.noResultsDescription') || 'Try a different search term or add manually.'}
                    </Text>
                    {onAddManual && (
                      <Pressable
                        onPress={() => {
                          onClose();
                          onAddManual();
                        }}
                        accessibilityRole="button"
                        style={[styles.emptyAddButton, { backgroundColor: colors.primary }]}
                      >
                        <Ionicons name="add" size={18} color="#FFFFFF" style={{ marginEnd: 6 }} />
                        <Text style={styles.emptyAddButtonText}>
                          {t('foodPicker.addManually') || 'Add manually'}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                }
              />
            </View>
          )}

          {/* STEP 2: PORTION CONFIGURATION */}
          {selectedItem && (
            <ScrollView
              style={styles.portionScrollView}
              contentContainerStyle={styles.portionContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* Food Info Summary */}
              <View style={[styles.portionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.portionFoodName, directionalText, { color: colors.text }]}>
                  {getFoodDisplayName(selectedItem)}
                </Text>
                {!selectedItem.isCustom && selectedItem.preparationState ? (
                  <Text style={[styles.portionPrepState, directionalText, { color: colors.textMuted }]}>
                    {`${t('foodPicker.preparationState') || 'State'}: ${selectedItem.preparationState}`}
                  </Text>
                ) : null}
              </View>

              {/* Serving Unit Selection */}
              <Text style={[styles.sectionLabel, directionalText, { color: colors.text }]}>
                {t('foodPicker.servingUnit') || 'Serving Unit'}
              </Text>
              {!selectedItem.isCustom ? (
                <View style={styles.servingUnitOptionsWrap}>
                  {selectedItem.servingOptions.map((opt) => {
                    const isSelected = selectedServingUnit === opt.id;
                    return (
                      <Pressable
                        key={opt.id}
                        onPress={() => setSelectedServingUnit(opt.id)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        style={[
                          styles.servingOptionChip,
                          {
                            backgroundColor: isSelected ? colors.primary : colors.card,
                            borderColor: isSelected ? colors.primary : colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.servingOptionChipText,
                            { color: isSelected ? '#FFFFFF' : colors.text },
                          ]}
                        >
                          {getUnitDisplayName(opt)}
                          <Text style={{ fontSize: 11, opacity: 0.85 }}>{` (${opt.grams}g)`}</Text>
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <View style={[styles.servingOptionChip, { backgroundColor: colors.card, borderColor: colors.border, alignSelf: 'flex-start' }]}>
                  <Text style={[styles.servingOptionChipText, { color: colors.text }]}>
                    {`${selectedItem.servingUnit} (${selectedItem.servingSize}g)`}
                  </Text>
                </View>
              )}

              {/* Quantity Input */}
              <Text style={[styles.sectionLabel, directionalText, { color: colors.text, marginTop: spacing.md }]}>
                {t('foodPicker.quantity') || 'Quantity'}
              </Text>
              <View
                style={[
                  styles.quantityBox,
                  activeRowStyle(),
                  {
                    backgroundColor: colors.inputBackground,
                    borderColor: quantityError ? colors.danger : colors.border,
                  },
                ]}
              >
                <TextInput
                  style={[styles.quantityInput, directionalText, { color: colors.text }]}
                  value={quantityInput}
                  onChangeText={(val) => {
                    setQuantityInput(val);
                    setQuantityError('');
                  }}
                  keyboardType="decimal-pad"
                  placeholder="1.0"
                  placeholderTextColor={colors.textMuted}
                  accessibilityLabel={t('foodPicker.quantity')}
                />
                <Text style={[styles.quantityGramsText, { color: colors.accent }]}>
                  {portionNutrition?.isValid
                    ? `${portionNutrition.grams} ${t('foodPicker.grams') || 'g'}`
                    : `-- ${t('foodPicker.grams') || 'g'}`}
                </Text>
              </View>
              {quantityError ? (
                <Text style={[styles.errorText, directionalText, { color: colors.danger }]}>
                  {quantityError}
                </Text>
              ) : null}

              {/* Live Nutrition Preview Card */}
              <View
                style={[
                  styles.previewCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.previewTitle, directionalText, { color: colors.text }]}>
                  {t('foodPicker.nutritionPreview') || 'Nutrition Preview'}
                </Text>
                <View style={[styles.previewCaloriesRow, activeRowStyle()]}>
                  <Text style={[styles.previewCaloriesNum, directionalText, { color: colors.accent }]}>
                    {portionNutrition?.isValid ? String(portionNutrition.calories) : '--'}
                  </Text>
                  <Text style={[styles.previewCaloriesLabel, directionalText, { color: colors.textMuted }]}>
                    {t('common.kcal')}
                  </Text>
                </View>
                <View style={[styles.previewMacrosRow, activeRowStyle()]}>
                  <View style={styles.macroPill}>
                    <Text style={[styles.macroPillLabel, { color: colors.textMuted }]}>
                      {t('common.protein')}
                    </Text>
                    <Text style={[styles.macroPillValue, { color: colors.text }]}>
                      {portionNutrition?.isValid ? `${portionNutrition.protein}g` : '--'}
                    </Text>
                  </View>
                  <View style={styles.macroPill}>
                    <Text style={[styles.macroPillLabel, { color: colors.textMuted }]}>
                      {t('common.carbs')}
                    </Text>
                    <Text style={[styles.macroPillValue, { color: colors.text }]}>
                      {portionNutrition?.isValid ? `${portionNutrition.carbs}g` : '--'}
                    </Text>
                  </View>
                  <View style={styles.macroPill}>
                    <Text style={[styles.macroPillLabel, { color: colors.textMuted }]}>
                      {t('common.fats')}
                    </Text>
                    <Text style={[styles.macroPillValue, { color: colors.text }]}>
                      {portionNutrition?.isValid ? `${portionNutrition.fats}g` : '--'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.portionActions}>
                <Pressable
                  onPress={handleConfirmAdd}
                  disabled={!portionNutrition?.isValid}
                  accessibilityRole="button"
                  accessibilityLabel={t('foodPicker.addToMeal')}
                  style={[
                    styles.primaryButton,
                    {
                      backgroundColor: portionNutrition?.isValid ? colors.primary : `${colors.primary}66`,
                    },
                  ]}
                >
                  <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" style={{ marginEnd: 6 }} />
                  <Text style={styles.primaryButtonText}>
                    {t('foodPicker.addToMeal') || 'Add to Meal'}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setSelectedItem(null)}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.cancel')}
                  style={[styles.secondaryButton, { borderColor: colors.border }]}
                >
                  <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
                    {t('common.back') || 'Back to Search'}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  contentWrap: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: typography.title.fontSize,
    fontWeight: typography.title.fontWeight,
  },
  headerSubtitle: {
    fontSize: typography.caption.fontSize,
    marginTop: 2,
  },
  closeButton: {
    minWidth: Platform.OS === 'android' ? 48 : 44,
    minHeight: Platform.OS === 'android' ? 48 : 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  searchBox: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.body.fontSize,
    paddingVertical: Platform.OS === 'ios' ? spacing.sm : spacing.xs,
    marginHorizontal: spacing.xs,
  },
  categoryScrollContainer: {
    marginVertical: spacing.xs,
  },
  categoryContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    minHeight: Platform.OS === 'android' ? 48 : 44,
    justifyContent: 'center',
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  foodCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    minHeight: 48,
  },
  cardHeaderRow: {
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  foodName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    marginEnd: spacing.sm,
  },
  cardCalories: {
    fontSize: 14,
    fontWeight: '700',
  },
  badgeRow: {
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  macroSubRow: {
    marginTop: 6,
  },
  macroSubText: {
    fontSize: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  emptyTitle: {
    fontSize: typography.h3.fontSize,
    fontWeight: typography.h3.fontWeight,
    marginTop: spacing.sm,
  },
  emptySubtitle: {
    fontSize: typography.caption.fontSize,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.md,
    minHeight: 48,
  },
  emptyAddButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  portionScrollView: {
    flex: 1,
  },
  portionContent: {
    padding: spacing.lg,
  },
  portionCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  portionFoodName: {
    fontSize: 17,
    fontWeight: '700',
  },
  portionPrepState: {
    fontSize: 13,
    marginTop: 4,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  servingUnitOptionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: spacing.sm,
  },
  servingOptionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    minHeight: Platform.OS === 'android' ? 48 : 44,
    justifyContent: 'center',
  },
  servingOptionChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  quantityBox: {
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  quantityInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: spacing.sm,
  },
  quantityGramsText: {
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
  },
  previewCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  previewTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  previewCaloriesRow: {
    alignItems: 'baseline',
    gap: 4,
    marginVertical: spacing.xs,
  },
  previewCaloriesNum: {
    fontSize: 28,
    fontWeight: '800',
  },
  previewCaloriesLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  previewMacrosRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    gap: 8,
  },
  macroPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(128,128,128,0.08)',
  },
  macroPillLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  macroPillValue: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  portionActions: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    minHeight: 48,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    minHeight: 48,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
