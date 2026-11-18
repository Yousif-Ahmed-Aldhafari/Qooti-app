import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import { AppHeader } from '../components/AppHeader';
import { AppInput } from '../components/AppInput';
import { FoodPickerModal } from '../components/FoodPickerModal';
import { ManualFoodModal } from '../components/ManualFoodModal';
import type { Translator } from '../i18n';
import type { CustomFood } from '../models/food';
import { validateMealDate, validateMealTime, type Meal, type MealItem, type MealType } from '../models/meal';
import { themeColors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { createId } from '../utils/id';
import { calculateMealTotals, formatLocalDate, formatLocalTime } from '../utils/nutrition';
import { activeRowStyle, activeTextAlign, activeWritingDirection } from '../utils/rtl';
import { getPressFeedback } from '../utils/touchFeedback';

type EditMealScreenProps = {
  t: Translator;
  meal: Meal;
  onSave: (meal: Meal) => Promise<void> | void;
  onCancel: () => void;
  language?: 'en' | 'ar';
  customFoods?: CustomFood[];
};

const MEAL_SLOTS: { id: MealType; key: string; icon: string }[] = [
  { id: 'breakfast', key: 'meals.breakfast', icon: 'sunny-outline' },
  { id: 'lunch', key: 'meals.lunch', icon: 'restaurant-outline' },
  { id: 'dinner', key: 'meals.dinner', icon: 'moon-outline' },
  { id: 'snack', key: 'meals.snack', icon: 'cafe-outline' },
];

export function EditMealScreen({
  t,
  meal,
  onSave,
  onCancel,
  language = 'en',
  customFoods,
}: EditMealScreenProps) {
  const colors = themeColors();

  const [title, setTitle] = useState(meal.title || meal.name || '');
  const [date, setDate] = useState(meal.date || formatLocalDate());
  const [time, setTime] = useState(meal.time || formatLocalTime());
  const [mealType, setMealType] = useState<MealType>(
    (meal.mealType as MealType) || 'lunch'
  );
  const [notes, setNotes] = useState(meal.notes || '');

  // Initialize items from meal, preserving item IDs and snapshots. If itemless legacy meal, provide 1 item.
  const [items, setItems] = useState<MealItem[]>(() => {
    if (meal.items && meal.items.length > 0) {
      return meal.items.map((it) => ({ ...it }));
    }
    return [
      {
        id: createId('meal-item'),
        foodName: meal.title || meal.name || '',
        name: meal.title || meal.name || '',
        quantity: 1,
        unit: 'g',
        portionUnit: 'g',
        calories: meal.totalCalories ?? 0,
        protein: meal.totalProtein ?? 0,
        carbs: meal.totalCarbs ?? 0,
        fats: meal.totalFat ?? meal.totalFats ?? 0,
        fat: meal.totalFat ?? meal.totalFats ?? 0,
      },
    ];
  });

  // Modals
  const [isFoodPickerVisible, setIsFoodPickerVisible] = useState(false);
  const [isManualModalVisible, setIsManualModalVisible] = useState(false);
  const [editingManualItem, setEditingManualItem] = useState<MealItem | null>(null);

  const [titleError, setTitleError] = useState('');
  const [dateError, setDateError] = useState('');
  const [timeError, setTimeError] = useState('');
  const [itemsError, setItemsError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const directionalText = {
    textAlign: activeTextAlign(),
    writingDirection: activeWritingDirection(),
  } as const;

  const { android_ripple } = getPressFeedback({
    rippleColor: `${colors.border}4D`,
    activeOpacity: 0.72,
  });

  // Calculate live meal totals
  const mealTotals = useMemo(() => calculateMealTotals(items), [items]);

  // Dirty check
  const isDirty = useMemo(() => {
    if (title !== (meal.title || meal.name || '')) return true;
    if (date !== (meal.date || '')) return true;
    if (time !== (meal.time || '')) return true;
    if (mealType !== (meal.mealType || 'lunch')) return true;
    if (notes !== (meal.notes || '')) return true;

    const originalItems = meal.items || [];
    if (items.length !== originalItems.length) return true;

    for (let i = 0; i < items.length; i++) {
      const cur = items[i];
      const orig = originalItems[i];
      if (!orig) return true;
      if (cur.id !== orig.id) return true;
      if (cur.foodName !== (orig.foodName || orig.name || '')) return true;
      if (cur.quantity !== orig.quantity) return true;
      if (cur.calories !== orig.calories) return true;
      if (cur.protein !== orig.protein) return true;
      if (cur.carbs !== orig.carbs) return true;
      if (cur.fats !== (orig.fats ?? orig.fat ?? 0)) return true;
    }

    return false;
  }, [title, date, time, mealType, notes, items, meal]);

  const handleCancel = useCallback(() => {
    if (isDirty) {
      Alert.alert(
        t('meals.discardChangesTitle') || 'Discard changes?',
        t('meals.discardChangesMessage') || 'Discard your unsaved meal changes?',
        [
          { text: t('common.cancel') || 'Cancel', style: 'cancel' },
          {
            text: t('common.delete') || 'Discard',
            style: 'destructive',
            onPress: onCancel,
          },
        ]
      );
    } else {
      onCancel();
    }
  }, [isDirty, onCancel, t]);

  // Android hardware back protection
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isFoodPickerVisible) {
        setIsFoodPickerVisible(false);
        return true;
      }
      if (isManualModalVisible) {
        setIsManualModalVisible(false);
        return true;
      }
      handleCancel();
      return true;
    });
    return () => sub.remove();
  }, [handleCancel, isFoodPickerVisible, isManualModalVisible]);

  // Item management
  function handleAddCatalogFood(newItem: MealItem) {
    setItems((prev) => [...prev, newItem]);
    setItemsError('');
  }

  function handleSaveManualFood(savedItem: MealItem) {
    if (editingManualItem) {
      setItems((prev) =>
        prev.map((it) => (it.id === savedItem.id ? savedItem : it))
      );
      setEditingManualItem(null);
    } else {
      setItems((prev) => [...prev, savedItem]);
    }
    setItemsError('');
  }

  function handleRemoveItem(itemId: string) {
    setItems((prev) => prev.filter((it) => it.id !== itemId));
  }

  function handleMoveUp(index: number) {
    if (index <= 0) return;
    setItems((prev) => {
      const copy = [...prev];
      const temp = copy[index - 1];
      copy[index - 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  }

  function handleMoveDown(index: number) {
    if (index >= items.length - 1) return;
    setItems((prev) => {
      const copy = [...prev];
      const temp = copy[index + 1];
      copy[index + 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  }

  async function handleSave() {
    if (isSaving) return;

    let hasError = false;

    // Validate title
    if (!title.trim()) {
      setTitleError(t('common.requiredMessage') || 'Required');
      hasError = true;
    } else {
      setTitleError('');
    }

    // Validate date
    const trimmedDate = date.trim();
    try {
      validateMealDate(trimmedDate);
      setDateError('');
    } catch (err: any) {
      setDateError(err.message || t('common.invalidDate') || 'YYYY-MM-DD required');
      hasError = true;
    }

    // Validate time
    const trimmedTime = time.trim();
    try {
      validateMealTime(trimmedTime);
      setTimeError('');
    } catch (err: any) {
      setTimeError(err.message || t('common.invalidTime') || 'HH:mm required');
      hasError = true;
    }

    // Persist new times as zero-padded HH:mm
    let standardizedTime = trimmedTime;
    if (/^[0-9]:[0-5]\d$/.test(trimmedTime)) {
      standardizedTime = `0${trimmedTime}`;
    }

    // Must have at least 1 item
    if (items.length === 0) {
      setItemsError(t('meals.emptyItemsError') || 'Please add at least one food item.');
      hasError = true;
    } else {
      setItemsError('');
    }

    if (hasError) return;

    setIsSaving(true);
    setSaveError('');

    try {
      const updatedMeal: Meal = {
        id: meal.id, // Strictly preserve original meal ID
        title: title.trim(),
        name: title.trim(),
        date: trimmedDate,
        time: standardizedTime,
        mealType,
        notes: notes.trim() || undefined,
        items,
        totalCalories: mealTotals.calories,
        totalProtein: mealTotals.protein,
        totalCarbs: mealTotals.carbs,
        totalFat: mealTotals.fats,
        totalFats: mealTotals.fats,
        isFavorite: meal.isFavorite,
        favoriteSource: meal.favoriteSource,
        nutritionCompleteness: meal.nutritionCompleteness,
        proteinKnown: meal.proteinKnown,
        carbsKnown: meal.carbsKnown,
        fatKnown: meal.fatKnown,
      };

      await onSave(updatedMeal);
    } catch (err) {
      setIsSaving(false);
      const message = err instanceof Error ? err.message : t('meals.saveError') || 'Failed to save meal';
      setSaveError(message);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.keyboardRoot}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
    >
      <ScrollView
        style={[styles.screen, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={styles.innerForm}>
            <AppHeader
              title={t('meals.editTitle')}
              subtitle={meal.title || meal.name || ''}
              action={<AppButton title={t('common.cancel')} variant="secondary" onPress={handleCancel} />}
            />

            {saveError ? (
              <View style={[styles.errorBanner, { backgroundColor: '#EF444420', borderColor: colors.danger }]}>
                <Ionicons name="alert-circle" size={20} color={colors.danger} />
                <Text style={[styles.errorBannerText, directionalText, { color: colors.danger }]}>
                  {saveError}
                </Text>
              </View>
            ) : null}

            {/* Meal Slot Selector */}
            <AppCard>
              <Text style={[styles.sectionLabel, directionalText, { color: colors.text }]}>
                {t('meals.mealType') || 'Meal Slot'}
              </Text>
              <View style={[styles.slotRow, activeRowStyle()]}>
                {MEAL_SLOTS.map((slot) => {
                  const isSelected = mealType === slot.id;
                  return (
                    <Pressable
                      key={slot.id}
                      onPress={() => setMealType(slot.id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      style={[
                        styles.slotChip,
                        {
                          backgroundColor: isSelected ? colors.primary : colors.inputBackground,
                          borderColor: isSelected ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Ionicons
                        name={slot.icon as any}
                        size={16}
                        color={isSelected ? '#FFFFFF' : colors.text}
                        style={{ marginEnd: 4 }}
                      />
                      <Text
                        style={[
                          styles.slotChipText,
                          { color: isSelected ? '#FFFFFF' : colors.text },
                        ]}
                      >
                        {t(slot.key as any) || slot.id}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </AppCard>

            {/* Metadata Card */}
            <AppCard>
              <AppInput
                label={t('meals.mealName')}
                placeholder={t('meals.mealNamePlaceholder')}
                value={title}
                error={titleError}
                onChangeText={(text) => {
                  setTitle(text);
                  if (titleError) setTitleError('');
                }}
              />
              <View style={[styles.inputRow, activeRowStyle()]}>
                <View style={styles.halfCol}>
                  <AppInput
                    label={t('common.date') || 'Date'}
                    placeholder="YYYY-MM-DD"
                    value={date}
                    error={dateError}
                    onChangeText={(text) => {
                      setDate(text);
                      if (dateError) setDateError('');
                    }}
                  />
                </View>
                <View style={styles.halfCol}>
                  <AppInput
                    label={t('common.time') || 'Time'}
                    placeholder="HH:mm"
                    value={time}
                    error={timeError}
                    onChangeText={(text) => {
                      setTime(text);
                      if (timeError) setTimeError('');
                    }}
                  />
                </View>
              </View>

              <AppInput
                label={t('meals.notes') || 'Notes'}
                placeholder={t('meals.notesPlaceholder') || 'Optional notes...'}
                value={notes}
                onChangeText={setNotes}
                maxLength={500}
                multiline
                numberOfLines={2}
              />
            </AppCard>

            {/* Food Items Card */}
            <AppCard>
              <View style={[styles.cardHeaderRow, activeRowStyle()]}>
                <View>
                  <Text style={[styles.cardTitle, directionalText, { color: colors.text }]}>
                    {t('meals.foodItems') || 'Food Items'}
                  </Text>
                  <Text style={[styles.cardSubtitle, directionalText, { color: colors.textMuted }]}>
                    {`${items.length} ${t('meals.itemLabel') || 'items'}`}
                  </Text>
                </View>

                {/* Add Buttons */}
                <View style={[styles.addButtonsGroup, activeRowStyle()]}>
                  <Pressable
                    android_ripple={android_ripple}
                    onPress={() => setIsFoodPickerVisible(true)}
                    accessibilityRole="button"
                    accessibilityLabel={t('meals.addFoodFromCatalog')}
                    style={[styles.smallAddButton, { backgroundColor: colors.primary }]}
                  >
                    <Ionicons name="search" size={16} color="#FFFFFF" style={{ marginEnd: 4 }} />
                    <Text style={styles.smallAddButtonText}>
                      {t('meals.addFoodFromCatalog') || 'Search'}
                    </Text>
                  </Pressable>

                  <Pressable
                    android_ripple={android_ripple}
                    onPress={() => {
                      setEditingManualItem(null);
                      setIsManualModalVisible(true);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={t('meals.addManually')}
                    style={[styles.smallAddButton, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
                  >
                    <Ionicons name="create-outline" size={16} color={colors.text} style={{ marginEnd: 4 }} />
                    <Text style={[styles.smallAddButtonText, { color: colors.text }]}>
                      {t('meals.addManually') || 'Manual'}
                    </Text>
                  </Pressable>
                </View>
              </View>

              {itemsError ? (
                <Text style={[styles.errorText, directionalText, { color: colors.danger, marginVertical: spacing.xs }]}>
                  {itemsError}
                </Text>
              ) : null}

              {/* Items List */}
              {items.length === 0 ? (
                <View style={styles.emptyItemsBox}>
                  <Ionicons name="restaurant-outline" size={36} color={colors.textMuted} />
                  <Text style={[styles.emptyItemsText, directionalText, { color: colors.textMuted }]}>
                    {t('meals.noItems') || 'No food items added.'}
                  </Text>
                </View>
              ) : (
                <View style={styles.itemsListContainer}>
                  {items.map((item, index) => {
                    const displayName = item.foodName || item.name || '';
                    const portionDesc = `${item.quantity} ${item.unit || item.portionUnit || 'g'}`;
                    const isFirst = index === 0;
                    const isLast = index === items.length - 1;

                    return (
                      <View
                        key={item.id}
                        style={[
                          styles.itemCard,
                          { backgroundColor: colors.inputBackground, borderColor: colors.border },
                        ]}
                      >
                        <View style={[styles.itemMainRow, activeRowStyle()]}>
                          <View style={styles.itemInfoCol}>
                            <Text style={[styles.itemFoodName, directionalText, { color: colors.text }]} numberOfLines={1}>
                              {displayName}
                            </Text>
                            <Text style={[styles.itemPortionDesc, directionalText, { color: colors.accent }]}>
                              {portionDesc}
                            </Text>
                            <Text style={[styles.itemNutrientsDesc, directionalText, { color: colors.textMuted }]}>
                              {`${item.calories} kcal · P: ${item.protein}g · C: ${item.carbs}g · F: ${item.fats ?? item.fat ?? 0}g`}
                            </Text>
                          </View>

                          {/* Reorder and Delete Controls */}
                          <View style={[styles.itemActionsCol, activeRowStyle()]}>
                            <Pressable
                              onPress={() => handleMoveUp(index)}
                              disabled={isFirst}
                              accessibilityRole="button"
                              accessibilityLabel={t('meals.moveUp')}
                              hitSlop={Platform.OS === 'android' ? 6 : 4}
                              style={[styles.itemActionBtn, { opacity: isFirst ? 0.3 : 1 }]}
                            >
                              <Ionicons name="chevron-up" size={18} color={colors.text} />
                            </Pressable>

                            <Pressable
                              onPress={() => handleMoveDown(index)}
                              disabled={isLast}
                              accessibilityRole="button"
                              accessibilityLabel={t('meals.moveDown')}
                              hitSlop={Platform.OS === 'android' ? 6 : 4}
                              style={[styles.itemActionBtn, { opacity: isLast ? 0.3 : 1 }]}
                            >
                              <Ionicons name="chevron-down" size={18} color={colors.text} />
                            </Pressable>

                            <Pressable
                              onPress={() => handleRemoveItem(item.id)}
                              accessibilityRole="button"
                              accessibilityLabel={t('meals.remove')}
                              hitSlop={Platform.OS === 'android' ? 6 : 4}
                              style={styles.itemActionBtn}
                            >
                              <Ionicons name="trash-outline" size={18} color={colors.danger} />
                            </Pressable>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </AppCard>

            {/* Live Meal Totals Card */}
            {items.length > 0 && (
              <AppCard>
                <Text style={[styles.totalsCardTitle, directionalText, { color: colors.text }]}>
                  {t('meals.mealTotals') || 'Meal Totals'}
                </Text>
                <View style={[styles.totalsCaloriesRow, activeRowStyle()]}>
                  <Text style={[styles.totalsCaloriesValue, directionalText, { color: colors.accent }]}>
                    {String(mealTotals.calories)}
                  </Text>
                  <Text style={[styles.totalsCaloriesLabel, directionalText, { color: colors.textMuted }]}>
                    {t('common.kcal')}
                  </Text>
                </View>
                <View style={[styles.totalsMacrosRow, activeRowStyle()]}>
                  <View style={styles.totalsMacroPill}>
                    <Text style={[styles.totalsMacroLabel, { color: colors.textMuted }]}>
                      {t('common.protein')}
                    </Text>
                    <Text style={[styles.totalsMacroVal, { color: colors.text }]}>
                      {`${mealTotals.protein}g`}
                    </Text>
                  </View>
                  <View style={styles.totalsMacroPill}>
                    <Text style={[styles.totalsMacroLabel, { color: colors.textMuted }]}>
                      {t('common.carbs')}
                    </Text>
                    <Text style={[styles.totalsMacroVal, { color: colors.text }]}>
                      {`${mealTotals.carbs}g`}
                    </Text>
                  </View>
                  <View style={styles.totalsMacroPill}>
                    <Text style={[styles.totalsMacroLabel, { color: colors.textMuted }]}>
                      {t('common.fats')}
                    </Text>
                    <Text style={[styles.totalsMacroVal, { color: colors.text }]}>
                      {`${mealTotals.fats}g`}
                    </Text>
                  </View>
                </View>
              </AppCard>
            )}

            {/* Save Button */}
            <AppButton
              title={isSaving ? t('common.loading') : t('common.save')}
              icon="save-outline"
              disabled={isSaving}
              onPress={handleSave}
            />
          </View>
        </TouchableWithoutFeedback>
      </ScrollView>

      {/* Catalog Food Picker Modal */}
      <FoodPickerModal
        visible={isFoodPickerVisible}
        onClose={() => setIsFoodPickerVisible(false)}
        onSelectFood={handleAddCatalogFood}
        onAddManual={() => {
          setIsFoodPickerVisible(false);
          setEditingManualItem(null);
          setIsManualModalVisible(true);
        }}
        t={t}
        language={language}
        customFoods={customFoods}
      />

      {/* Manual Food Entry Modal */}
      <ManualFoodModal
        visible={isManualModalVisible}
        onClose={() => {
          setIsManualModalVisible(false);
          setEditingManualItem(null);
        }}
        onSaveFood={handleSaveManualFood}
        t={t}
        language={language}
        initialItem={editingManualItem}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardRoot: {
    flex: 1,
  },
  screen: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: spacing.xl,
    paddingBottom: 140,
  },
  innerForm: {
    gap: spacing.lg,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
  },
  errorBannerText: {
    ...typography.caption,
    fontWeight: '600',
    flex: 1,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  slotRow: {
    flexWrap: 'wrap',
    gap: 8,
  },
  slotChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    minHeight: 40,
  },
  slotChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  inputRow: {
    gap: spacing.md,
  },
  halfCol: {
    flex: 1,
  },
  cardHeaderRow: {
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  addButtonsGroup: {
    gap: 8,
  },
  smallAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
    minHeight: 36,
  },
  smallAddButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyItemsBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.xs,
  },
  emptyItemsText: {
    fontSize: 14,
  },
  itemsListContainer: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  itemCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  itemMainRow: {
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemInfoCol: {
    flex: 1,
    marginEnd: spacing.sm,
  },
  itemFoodName: {
    fontSize: 15,
    fontWeight: '600',
  },
  itemPortionDesc: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  itemNutrientsDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  itemActionsCol: {
    gap: 6,
  },
  itemActionBtn: {
    minWidth: Platform.OS === 'android' ? 48 : 44,
    minHeight: Platform.OS === 'android' ? 48 : 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalsCardTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  totalsCaloriesRow: {
    alignItems: 'baseline',
    gap: 4,
    marginVertical: spacing.xs,
  },
  totalsCaloriesValue: {
    fontSize: 28,
    fontWeight: '800',
  },
  totalsCaloriesLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  totalsMacrosRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    gap: 8,
  },
  totalsMacroPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(128,128,128,0.08)',
  },
  totalsMacroLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  totalsMacroVal: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  errorText: {
    fontSize: 12,
  },
});
