import { useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppInput } from './AppInput';
import type { Translator } from '../i18n';
import type { MealItem } from '../models/meal';
import { themeColors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { createId } from '../utils/id';
import { parseStrictNutrient, parseStrictQuantity } from '../utils/nutrition';
import { activeRowStyle, activeTextAlign, activeWritingDirection } from '../utils/rtl';

export type ManualFoodModalProps = {
  visible: boolean;
  onClose: () => void;
  onSaveFood: (item: MealItem) => void;
  t: Translator;
  language?: 'en' | 'ar';
  initialItem?: MealItem | null;
};

export function ManualFoodModal({
  visible,
  onClose,
  onSaveFood,
  t,
  initialItem,
}: ManualFoodModalProps) {
  const colors = themeColors();
  const directionalText = {
    textAlign: activeTextAlign(),
    writingDirection: activeWritingDirection(),
  } as const;

  const [name, setName] = useState(initialItem?.foodName || initialItem?.name || '');
  const [quantity, setQuantity] = useState(String(initialItem?.quantity ?? 1));
  const [unit, setUnit] = useState(initialItem?.unit || initialItem?.portionUnit || 'g');
  const [calories, setCalories] = useState(initialItem ? String(initialItem.calories ?? 0) : '');
  const [protein, setProtein] = useState(initialItem ? String(initialItem.protein ?? 0) : '');
  const [carbs, setCarbs] = useState(initialItem ? String(initialItem.carbs ?? 0) : '');
  const [fats, setFats] = useState(initialItem ? String(initialItem.fats ?? initialItem.fat ?? 0) : '');

  const [nameError, setNameError] = useState('');
  const [quantityError, setQuantityError] = useState('');
  const [caloriesError, setCaloriesError] = useState('');
  const [proteinError, setProteinError] = useState('');
  const [carbsError, setCarbsError] = useState('');
  const [fatsError, setFatsError] = useState('');

  function resetForm() {
    setName('');
    setQuantity('1');
    setUnit('g');
    setCalories('');
    setProtein('');
    setCarbs('');
    setFats('');
    setNameError('');
    setQuantityError('');
    setCaloriesError('');
    setProteinError('');
    setCarbsError('');
    setFatsError('');
  }

  function handleDismiss() {
    resetForm();
    onClose();
  }

  function handleSave() {
    let hasError = false;

    // Validate Food Name
    if (!name.trim()) {
      setNameError(t('common.requiredMessage') || 'Required');
      hasError = true;
    } else {
      setNameError('');
    }

    // Validate Quantity
    const qtyParsed = parseStrictQuantity(quantity);
    if (!qtyParsed.isValid) {
      setQuantityError(t(qtyParsed.errorMessageKey as any) || qtyParsed.defaultMessage || 'Must be > 0');
      hasError = true;
    } else {
      setQuantityError('');
    }

    // Validate Calories
    const calParsed = parseStrictNutrient(calories, { allowEmpty: false });
    if (!calParsed.isValid) {
      setCaloriesError(t(calParsed.errorMessageKey as any) || calParsed.defaultMessage || 'Must be >= 0');
      hasError = true;
    } else {
      setCaloriesError('');
    }

    // Validate Protein
    const proParsed = parseStrictNutrient(protein, { allowEmpty: true });
    if (!proParsed.isValid) {
      setProteinError(t(proParsed.errorMessageKey as any) || proParsed.defaultMessage || 'Must be >= 0');
      hasError = true;
    } else {
      setProteinError('');
    }

    // Validate Carbs
    const carbParsed = parseStrictNutrient(carbs, { allowEmpty: true });
    if (!carbParsed.isValid) {
      setCarbsError(t(carbParsed.errorMessageKey as any) || carbParsed.defaultMessage || 'Must be >= 0');
      hasError = true;
    } else {
      setCarbsError('');
    }

    // Validate Fats
    const fatParsed = parseStrictNutrient(fats, { allowEmpty: true });
    if (!fatParsed.isValid) {
      setFatsError(t(fatParsed.errorMessageKey as any) || fatParsed.defaultMessage || 'Must be >= 0');
      hasError = true;
    } else {
      setFatsError('');
    }

    if (hasError) return;

    const item: MealItem = {
      id: initialItem?.id || createId('meal-item'),
      foodName: name.trim(),
      name: name.trim(),
      quantity: qtyParsed.value,
      unit: unit.trim() || 'g',
      portionUnit: unit.trim() || 'g',
      calories: Math.round(calParsed.value),
      protein: Math.round(proParsed.value * 10) / 10,
      carbs: Math.round(carbParsed.value * 10) / 10,
      fats: Math.round(fatParsed.value * 10) / 10,
      fat: Math.round(fatParsed.value * 10) / 10,
    };

    onSaveFood(item);
    handleDismiss();
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={handleDismiss}
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
                {t('manualFood.title') || 'Add Food Manually'}
              </Text>
              <Text style={[styles.headerSubtitle, directionalText, { color: colors.textMuted }]}>
                {t('manualFood.subtitle') || 'Enter custom values directly'}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
              onPress={handleDismiss}
              style={({ pressed }) => [styles.closeButton, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
              <View style={styles.form}>
                <AppInput
                  label={t('manualFood.foodName') || 'Food name'}
                  placeholder={t('manualFood.foodNamePlaceholder') || 'e.g. Homemade pancake'}
                  value={name}
                  onChangeText={(val) => {
                    setName(val);
                    setNameError('');
                  }}
                  error={nameError}
                  autoCapitalize="sentences"
                />

                <View style={[styles.row, activeRowStyle()]}>
                  <View style={styles.halfCol}>
                    <AppInput
                      label={t('manualFood.quantity') || 'Quantity'}
                      placeholder="1"
                      value={quantity}
                      onChangeText={(val) => {
                        setQuantity(val);
                        setQuantityError('');
                      }}
                      keyboardType="decimal-pad"
                      error={quantityError}
                    />
                  </View>
                  <View style={styles.halfCol}>
                    <AppInput
                      label={t('manualFood.unit') || 'Unit'}
                      placeholder={t('manualFood.unitPlaceholder') || 'g, piece...'}
                      value={unit}
                      onChangeText={setUnit}
                      autoCapitalize="none"
                    />
                  </View>
                </View>

                <AppInput
                  label={t('manualFood.calories') || 'Calories (kcal)'}
                  placeholder="0"
                  value={calories}
                  onChangeText={(val) => {
                    setCalories(val);
                    setCaloriesError('');
                  }}
                  keyboardType="decimal-pad"
                  error={caloriesError}
                />

                <View style={[styles.row, activeRowStyle()]}>
                  <View style={styles.thirdCol}>
                    <AppInput
                      label={t('manualFood.protein') || 'Protein (g)'}
                      placeholder="0"
                      value={protein}
                      onChangeText={(val) => {
                        setProtein(val);
                        setProteinError('');
                      }}
                      keyboardType="decimal-pad"
                      error={proteinError}
                    />
                  </View>
                  <View style={styles.thirdCol}>
                    <AppInput
                      label={t('manualFood.carbs') || 'Carbs (g)'}
                      placeholder="0"
                      value={carbs}
                      onChangeText={(val) => {
                        setCarbs(val);
                        setCarbsError('');
                      }}
                      keyboardType="decimal-pad"
                      error={carbsError}
                    />
                  </View>
                  <View style={styles.thirdCol}>
                    <AppInput
                      label={t('manualFood.fats') || 'Fats (g)'}
                      placeholder="0"
                      value={fats}
                      onChangeText={(val) => {
                        setFats(val);
                        setFatsError('');
                      }}
                      keyboardType="decimal-pad"
                      error={fatsError}
                    />
                  </View>
                </View>

                <View style={styles.actions}>
                  <Pressable
                    onPress={handleSave}
                    accessibilityRole="button"
                    accessibilityLabel={t('manualFood.add')}
                    style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                  >
                    <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" style={{ marginEnd: 6 }} />
                    <Text style={styles.primaryButtonText}>
                      {t('manualFood.add') || 'Add to meal'}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={handleDismiss}
                    accessibilityRole="button"
                    accessibilityLabel={t('common.cancel')}
                    style={[styles.secondaryButton, { borderColor: colors.border }]}
                  >
                    <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
                      {t('common.cancel') || 'Cancel'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </ScrollView>
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
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
  },
  form: {
    gap: spacing.sm,
  },
  row: {
    gap: spacing.md,
  },
  halfCol: {
    flex: 1,
  },
  thirdCol: {
    flex: 1,
  },
  actions: {
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
