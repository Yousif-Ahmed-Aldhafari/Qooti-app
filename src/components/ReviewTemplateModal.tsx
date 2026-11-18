import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import type { Translator } from '../i18n';
import type { Language } from '../types';
import type { MealTemplate } from '../models/mealTemplate';
import type { NutritionCompleteness } from '../models/meal';
import { themeColors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { activeRowStyle, activeTextAlign, activeWritingDirection } from '../utils/rtl';

export interface ReviewTemplateModalProps {
  visible: boolean;
  template: MealTemplate | null;
  onClose: () => void;
  onReconfirm: (
    templateId: string,
    completeness: NutritionCompleteness,
    macros?: {
      proteinKnown?: boolean;
      carbsKnown?: boolean;
      fatKnown?: boolean;
      totalCalories?: number;
      totalProtein?: number;
      totalCarbs?: number;
      totalFat?: number;
    }
  ) => Promise<void>;
  language?: Language;
  t: Translator;
}

interface FormContentProps {
  template: MealTemplate;
  onClose: () => void;
  onReconfirm: (
    templateId: string,
    completeness: NutritionCompleteness,
    macros?: {
      proteinKnown?: boolean;
      carbsKnown?: boolean;
      fatKnown?: boolean;
      totalCalories?: number;
      totalProtein?: number;
      totalCarbs?: number;
      totalFat?: number;
    }
  ) => Promise<void>;
  t: Translator;
}

function ReviewTemplateFormContent({
  template,
  onClose,
  onReconfirm,
  t,
}: FormContentProps) {
  const colors = themeColors();
  const directionalText = {
    textAlign: activeTextAlign(),
    writingDirection: activeWritingDirection(),
  } as const;

  const tr = (key: string, fallback?: string): string => {
    const scoped = t(`meals.${key}` as any);
    if (scoped && scoped !== `meals.${key}`) return scoped;
    const direct = t(key as any);
    if (direct && direct !== key) return direct;
    return fallback || key;
  };

  const initialCalories =
    template.totalCalories !== undefined && template.totalCalories !== null
      ? String(template.totalCalories)
      : '';
  const initialProtein =
    template.totalProtein !== undefined && template.totalProtein !== null
      ? String(template.totalProtein)
      : '';
  const initialCarbs =
    template.totalCarbs !== undefined && template.totalCarbs !== null
      ? String(template.totalCarbs)
      : '';
  const initialFat =
    (template.totalFat ?? template.totalFats) !== undefined &&
    (template.totalFat ?? template.totalFats) !== null
      ? String(template.totalFat ?? template.totalFats)
      : '';

  const [calories, setCalories] = useState(initialCalories);
  const [protein, setProtein] = useState(initialProtein);
  const [carbs, setCarbs] = useState(initialCarbs);
  const [fat, setFat] = useState(initialFat);

  const [proteinKnown, setProteinKnown] = useState(Boolean(template.proteinKnown));
  const [carbsKnown, setCarbsKnown] = useState(Boolean(template.carbsKnown));
  const [fatKnown, setFatKnown] = useState(Boolean(template.fatKnown));

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaveError(null);
    const parsedCalories = Number(calories);
    if (isNaN(parsedCalories) || parsedCalories < 0) {
      setSaveError(tr('reconfirmError', 'Invalid nutrient values'));
      return;
    }

    const parsedProtein = proteinKnown ? Number(protein) : undefined;
    const parsedCarbs = carbsKnown ? Number(carbs) : undefined;
    const parsedFat = fatKnown ? Number(fat) : undefined;

    if (
      (proteinKnown && (parsedProtein === undefined || isNaN(parsedProtein) || parsedProtein < 0)) ||
      (carbsKnown && (parsedCarbs === undefined || isNaN(parsedCarbs) || parsedCarbs < 0)) ||
      (fatKnown && (parsedFat === undefined || isNaN(parsedFat) || parsedFat < 0))
    ) {
      setSaveError(tr('reconfirmError', 'Invalid nutrient values'));
      return;
    }

    let completeness: NutritionCompleteness = 'complete';
    if (!proteinKnown && !carbsKnown && !fatKnown) {
      completeness = 'calories_only';
    } else if (!proteinKnown || !carbsKnown || !fatKnown) {
      completeness = 'partial';
    }

    setIsSaving(true);
    try {
      await onReconfirm(template.id, completeness, {
        proteinKnown,
        carbsKnown,
        fatKnown,
        totalCalories: parsedCalories,
        totalProtein: proteinKnown ? parsedProtein : undefined,
        totalCarbs: carbsKnown ? parsedCarbs : undefined,
        totalFat: fatKnown ? parsedFat : undefined,
      });
      onClose();
    } catch {
      setSaveError(tr('reconfirmError', 'Failed to update template macros. Please try again.'));
    } finally {
      setIsSaving(false);
    }
  };

  const displayName = template.name || template.title;

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text style={[styles.title, directionalText, { color: colors.text }]} accessibilityRole="header">
          {tr('reviewMacrosTitle', 'Review Macronutrients')}
        </Text>
        <Text style={[styles.subtitle, directionalText, { color: colors.textMuted }]}>
          {tr('reviewMacrosSubtitle', 'Verify or correct nutrient status for this template')}: {displayName}
        </Text>
      </View>

      <View style={[styles.infoBox, { backgroundColor: colors.surface, borderColor: colors.warning }]}>
        <Text style={[styles.infoText, directionalText, { color: colors.text }]}>
          {tr('reviewAmbiguityExplanation', 'This template has positive calories with unconfirmed macronutrients from a previous update.')}
        </Text>
      </View>

      {saveError ? (
        <View
          style={[styles.errorBanner, { backgroundColor: colors.danger + '20', borderColor: colors.danger }]}
          accessibilityRole="alert"
        >
          <Text style={[styles.errorText, directionalText, { color: colors.danger }]}>{saveError}</Text>
        </View>
      ) : null}

      {/* Calories Input */}
      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, directionalText, { color: colors.textSecondary }]}>
          {tr('calories', 'Calories')} (kcal)
        </Text>
        <TextInput
          style={[
            styles.textInput,
            directionalText,
            {
              color: colors.text,
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
          value={calories}
          onChangeText={setCalories}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={`${tr('calories', 'Calories')} input`}
        />
      </View>

      {/* Protein Section */}
      <View style={[styles.macroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.macroHeaderRow, activeRowStyle()]}>
          <Text style={[styles.macroName, { color: colors.text }]}>
            {tr('protein', 'Protein')} (g)
          </Text>
          <View style={[styles.segmentContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TouchableOpacity
              style={[
                styles.segmentBtn,
                !proteinKnown && { backgroundColor: colors.danger || '#E53E3E' },
              ]}
              onPress={() => setProteinKnown(false)}
              accessibilityRole="button"
              accessibilityLabel={`${tr('protein', 'Protein')} ${tr('macroUnknown', 'Unrecorded')}`}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: !proteinKnown ? '#FFFFFF' : colors.textMuted },
                ]}
              >
                {tr('macroUnknown', 'Unrecorded')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.segmentBtn,
                proteinKnown && { backgroundColor: colors.primary },
              ]}
              onPress={() => setProteinKnown(true)}
              accessibilityRole="button"
              accessibilityLabel={`${tr('protein', 'Protein')} ${tr('macroKnown', 'Known')}`}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: proteinKnown ? '#FFFFFF' : colors.textMuted },
                ]}
              >
                {tr('macroKnown', 'Known')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {proteinKnown ? (
          <TextInput
            style={[
              styles.textInput,
              directionalText,
              {
                color: colors.text,
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
            value={protein}
            onChangeText={setProtein}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={`${tr('protein', 'Protein')} input`}
          />
        ) : (
          <Text style={[styles.unknownNote, directionalText, { color: colors.textMuted }]}>
            {tr('markAsUnknown', 'Mark as unrecorded')}
          </Text>
        )}
      </View>

      {/* Carbs Section */}
      <View style={[styles.macroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.macroHeaderRow, activeRowStyle()]}>
          <Text style={[styles.macroName, { color: colors.text }]}>
            {tr('carbs', 'Carbs')} (g)
          </Text>
          <View style={[styles.segmentContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TouchableOpacity
              style={[
                styles.segmentBtn,
                !carbsKnown && { backgroundColor: colors.danger || '#E53E3E' },
              ]}
              onPress={() => setCarbsKnown(false)}
              accessibilityRole="button"
              accessibilityLabel={`${tr('carbs', 'Carbs')} ${tr('macroUnknown', 'Unrecorded')}`}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: !carbsKnown ? '#FFFFFF' : colors.textMuted },
                ]}
              >
                {tr('macroUnknown', 'Unrecorded')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.segmentBtn,
                carbsKnown && { backgroundColor: colors.primary },
              ]}
              onPress={() => setCarbsKnown(true)}
              accessibilityRole="button"
              accessibilityLabel={`${tr('carbs', 'Carbs')} ${tr('macroKnown', 'Known')}`}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: carbsKnown ? '#FFFFFF' : colors.textMuted },
                ]}
              >
                {tr('macroKnown', 'Known')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {carbsKnown ? (
          <TextInput
            style={[
              styles.textInput,
              directionalText,
              {
                color: colors.text,
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
            value={carbs}
            onChangeText={setCarbs}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={`${tr('carbs', 'Carbs')} input`}
          />
        ) : (
          <Text style={[styles.unknownNote, directionalText, { color: colors.textMuted }]}>
            {tr('markAsUnknown', 'Mark as unrecorded')}
          </Text>
        )}
      </View>

      {/* Fat Section */}
      <View style={[styles.macroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.macroHeaderRow, activeRowStyle()]}>
          <Text style={[styles.macroName, { color: colors.text }]}>
            {tr('fat', 'Fat')} (g)
          </Text>
          <View style={[styles.segmentContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TouchableOpacity
              style={[
                styles.segmentBtn,
                !fatKnown && { backgroundColor: colors.danger || '#E53E3E' },
              ]}
              onPress={() => setFatKnown(false)}
              accessibilityRole="button"
              accessibilityLabel={`${tr('fat', 'Fat')} ${tr('macroUnknown', 'Unrecorded')}`}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: !fatKnown ? '#FFFFFF' : colors.textMuted },
                ]}
              >
                {tr('macroUnknown', 'Unrecorded')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.segmentBtn,
                fatKnown && { backgroundColor: colors.primary },
              ]}
              onPress={() => setFatKnown(true)}
              accessibilityRole="button"
              accessibilityLabel={`${tr('fat', 'Fat')} ${tr('macroKnown', 'Known')}`}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: fatKnown ? '#FFFFFF' : colors.textMuted },
                ]}
              >
                {tr('macroKnown', 'Known')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {fatKnown ? (
          <TextInput
            style={[
              styles.textInput,
              directionalText,
              {
                color: colors.text,
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
            value={fat}
            onChangeText={setFat}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={`${tr('fat', 'Fat')} input`}
          />
        ) : (
          <Text style={[styles.unknownNote, directionalText, { color: colors.textMuted }]}>
            {tr('markAsUnknown', 'Mark as unrecorded')}
          </Text>
        )}
      </View>

      {/* Buttons */}
      <View style={[styles.actionRow, activeRowStyle()]}>
        <TouchableOpacity
          style={[styles.cancelButton, { borderColor: colors.border }]}
          onPress={onClose}
          disabled={isSaving}
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel') || 'Cancel'}
        >
          <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>
            {t('common.cancel') || 'Cancel'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.confirmButton, { backgroundColor: colors.primary }]}
          onPress={handleSave}
          disabled={isSaving}
          accessibilityRole="button"
          accessibilityLabel={tr('confirmReview', 'Confirm Macronutrients')}
        >
          {isSaving ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.confirmButtonText}>{tr('confirmReview', 'Confirm Macronutrients')}</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

export function ReviewTemplateModal({
  visible,
  template,
  onClose,
  onReconfirm,
  t,
}: ReviewTemplateModalProps) {
  const colors = themeColors();

  if (!visible || !template) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ReviewTemplateFormContent
            key={template.id}
            template={template}
            onClose={onClose}
            onReconfirm={onReconfirm}
            t={t}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  container: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  scrollContent: {
    padding: spacing.lg,
  },
  header: {
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h3,
    fontSize: 18,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    fontSize: 14,
  },
  infoBox: {
    borderLeftWidth: 4,
    padding: spacing.md,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
  },
  infoText: {
    ...typography.caption,
    lineHeight: 18,
  },
  errorBanner: {
    borderWidth: 1,
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
  },
  errorText: {
    ...typography.caption,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    ...typography.caption,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
    minHeight: Platform.OS === 'android' ? 48 : 44,
  },
  macroCard: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  macroHeaderRow: {
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  macroName: {
    ...typography.body,
    fontWeight: '600',
  },
  segmentContainer: {
    flexDirection: 'row',
    borderRadius: radius.pill,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 2,
  },
  segmentBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    minHeight: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  segmentText: {
    ...typography.caption,
    fontWeight: '600',
    fontSize: 12,
  },
  unknownNote: {
    ...typography.caption,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  actionRow: {
    justifyContent: 'flex-end',
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  cancelButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: Platform.OS === 'android' ? 48 : 44,
  },
  cancelButtonText: {
    ...typography.body,
    fontWeight: '600',
  },
  confirmButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
    minHeight: Platform.OS === 'android' ? 48 : 44,
  },
  confirmButtonText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
