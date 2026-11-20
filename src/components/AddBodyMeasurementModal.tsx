import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

import type { Translator } from '../i18n';
import type { BodyMeasurementEntry } from '../models/biometrics';
import type { MeasurementUnits } from '../models/settings';
import { themeColors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import {
  formatMeasurementInput,
  inchToCm,
  MEASUREMENT_FIELDS,
  type MeasurementFieldKey,
  parseMeasurementInput,
  validateCircumferenceValue,
  validateMeasurementDate,
  validateMeasurementTime,
} from '../utils/measurements';
import { activeRowStyle, activeTextAlign, activeWritingDirection } from '../utils/rtl';

export type AddBodyMeasurementModalProps = {
  visible: boolean;
  onClose: () => void;
  onSave: (entry: BodyMeasurementEntry) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  initialEntry?: BodyMeasurementEntry | null;
  defaultUnit?: MeasurementUnits;
  t: Translator;
  referenceDate?: string;
};

function getLocalCurrentTime(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function getLocalCurrentDate(fallback?: string): string {
  if (fallback && validateMeasurementDate(fallback)) return fallback;
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function generateBodyMeasurementId(): string {
  return `bm_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

function AddBodyMeasurementFormContent({
  onClose,
  onSave,
  onDelete,
  initialEntry,
  defaultUnit = 'metric',
  t,
  referenceDate,
}: Omit<AddBodyMeasurementModalProps, 'visible'>) {
  const colors = themeColors();
  const isEditing = Boolean(initialEntry);

  const initialUnitState: 'cm' | 'in' = defaultUnit === 'imperial' ? 'in' : 'cm';
  const [selectedUnit, setSelectedUnit] = useState<'cm' | 'in'>(initialUnitState);

  // Canonical state in cm (preserves exact values without rounding degradation)
  const [canonicalCmValues, setCanonicalCmValues] = useState<Record<MeasurementFieldKey, number | null>>(() => {
    const initial: Record<MeasurementFieldKey, number | null> = {
      chestCm: initialEntry?.chestCm ?? null,
      waistCm: initialEntry?.waistCm ?? null,
      hipsCm: initialEntry?.hipsCm ?? null,
      shouldersCm: initialEntry?.shouldersCm ?? null,
      neckCm: initialEntry?.neckCm ?? null,
      leftArmCm: initialEntry?.leftArmCm ?? null,
      rightArmCm: initialEntry?.rightArmCm ?? null,
      leftThighCm: initialEntry?.leftThighCm ?? null,
      rightThighCm: initialEntry?.rightThighCm ?? null,
      leftCalfCm: initialEntry?.leftCalfCm ?? null,
      rightCalfCm: initialEntry?.rightCalfCm ?? null,
    };
    return initial;
  });

  const [editedFields, setEditedFields] = useState<Record<MeasurementFieldKey, boolean>>(() => ({
    chestCm: false,
    waistCm: false,
    hipsCm: false,
    shouldersCm: false,
    neckCm: false,
    leftArmCm: false,
    rightArmCm: false,
    leftThighCm: false,
    rightThighCm: false,
    leftCalfCm: false,
    rightCalfCm: false,
  }));

  // Field input texts in current selected unit
  const [fieldTexts, setFieldTexts] = useState<Record<MeasurementFieldKey, string>>(() => {
    const initialTexts: Record<MeasurementFieldKey, string> = {
      chestCm: '',
      waistCm: '',
      hipsCm: '',
      shouldersCm: '',
      neckCm: '',
      leftArmCm: '',
      rightArmCm: '',
      leftThighCm: '',
      rightThighCm: '',
      leftCalfCm: '',
      rightCalfCm: '',
    };
    MEASUREMENT_FIELDS.forEach((f) => {
      const val = initialEntry ? initialEntry[f.key] : null;
      initialTexts[f.key] = formatMeasurementInput(val, initialUnitState, 2);
    });
    return initialTexts;
  });

  const [dateText, setDateText] = useState(() => {
    if (initialEntry) {
      return initialEntry.date;
    }
    return getLocalCurrentDate(referenceDate);
  });

  const [timeText, setTimeText] = useState(() => {
    if (initialEntry) {
      return initialEntry.time;
    }
    return getLocalCurrentTime();
  });

  const [notesText, setNotesText] = useState(() => initialEntry?.notes || '');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Unit toggle without loss of precision
  const handleUnitToggle = useCallback(
    (newUnit: 'cm' | 'in') => {
      if (newUnit === selectedUnit) return;
      // Re-derive display strings from canonical cm without mutating canonical numbers
      const updatedTexts: Record<MeasurementFieldKey, string> = { ...fieldTexts };
      MEASUREMENT_FIELDS.forEach((f) => {
        const canonicalVal = canonicalCmValues[f.key];
        updatedTexts[f.key] = formatMeasurementInput(canonicalVal, newUnit, 2);
      });
      setFieldTexts(updatedTexts);
      setSelectedUnit(newUnit);
      setErrorMessage(null);
    },
    [selectedUnit, canonicalCmValues, fieldTexts]
  );

  const handleFieldChange = (key: MeasurementFieldKey, text: string) => {
    setFieldTexts((prev) => ({ ...prev, [key]: text }));
    setEditedFields((prev) => ({ ...prev, [key]: true }));
    if (errorMessage) setErrorMessage(null);

    const parsed = parseMeasurementInput(text);
    if (parsed != null && Number.isFinite(parsed) && parsed > 0) {
      const canonical = selectedUnit === 'in' ? inchToCm(parsed) : parsed;
      setCanonicalCmValues((prev) => ({ ...prev, [key]: canonical }));
    } else {
      setCanonicalCmValues((prev) => ({ ...prev, [key]: null }));
    }
  };

  const handleSave = async () => {
    if (isSaving || isDeleting) return;

    // 1. Validate calendar date
    const trimmedDate = dateText.trim();
    if (!validateMeasurementDate(trimmedDate)) {
      setErrorMessage(t('progress.invalidDateError'));
      return;
    }

    // 2. Validate measurement time
    const trimmedTime = timeText.trim();
    if (!validateMeasurementTime(trimmedTime)) {
      setErrorMessage(t('progress.invalidTimeError'));
      return;
    }

    // 3. Validate and construct measurement values
    const finalValues: Partial<Record<MeasurementFieldKey, number | null>> = {};
    let hasAtLeastOne = false;

    for (const field of MEASUREMENT_FIELDS) {
      const key = field.key;
      const text = (fieldTexts[key] || '').trim();

      if (text === '') {
        // Field left empty -> explicitly null
        finalValues[key] = null;
        continue;
      }

      const parsed = parseMeasurementInput(text);
      if (parsed == null) {
        setErrorMessage(t('progress.invalidNumberError'));
        return;
      }

      const validation = validateCircumferenceValue(parsed, field, selectedUnit);
      if (!validation.isValid || validation.valueCm == null) {
        setErrorMessage(t(validation.errorKey || 'progress.measurementRangeError'));
        return;
      }

      // If this field was NOT edited by the user and existed in initialEntry, preserve initialEntry value exactly
      if (!editedFields[key] && initialEntry && initialEntry[key] != null) {
        finalValues[key] = initialEntry[key];
      } else if (canonicalCmValues[key] != null && Math.abs(canonicalCmValues[key]! - validation.valueCm) < 0.05) {
        finalValues[key] = canonicalCmValues[key];
      } else {
        finalValues[key] = validation.valueCm;
      }

      hasAtLeastOne = true;
    }

    if (!hasAtLeastOne) {
      setErrorMessage(t('progress.noMeasurementsAtLeastOne'));
      return;
    }

    const nowIso = new Date().toISOString();
    const entryToSave: BodyMeasurementEntry = {
      id: initialEntry ? initialEntry.id : generateBodyMeasurementId(),
      date: trimmedDate,
      time: trimmedTime,
      chestCm: finalValues.chestCm ?? null,
      waistCm: finalValues.waistCm ?? null,
      hipsCm: finalValues.hipsCm ?? null,
      leftArmCm: finalValues.leftArmCm ?? null,
      rightArmCm: finalValues.rightArmCm ?? null,
      leftThighCm: finalValues.leftThighCm ?? null,
      rightThighCm: finalValues.rightThighCm ?? null,
      leftCalfCm: finalValues.leftCalfCm ?? null,
      rightCalfCm: finalValues.rightCalfCm ?? null,
      shouldersCm: finalValues.shouldersCm ?? null,
      neckCm: finalValues.neckCm ?? null,
      notes: notesText.trim() ? notesText.trim() : null,
      createdAt: initialEntry ? initialEntry.createdAt : nowIso,
      updatedAt: nowIso,
    };

    try {
      setIsSaving(true);
      setErrorMessage(null);
      await onSave(entryToSave);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('common.notFound');
      setErrorMessage(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (!initialEntry || !onDelete || isDeleting || isSaving) return;

    Alert.alert(
      t('progress.deleteMeasurementConfirmTitle'),
      t('progress.deleteMeasurementConfirmMessage'),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeleting(true);
              setErrorMessage(null);
              await onDelete(initialEntry.id);
              onClose();
            } catch (err) {
              const msg = err instanceof Error ? err.message : t('common.notFound');
              setErrorMessage(msg);
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  const directionalText = {
    textAlign: activeTextAlign(),
    writingDirection: activeWritingDirection(),
  } as const;

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardContainer}
        >
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.scrollContent}
            >
              {/* Header */}
              <View style={[styles.headerRow, activeRowStyle()]}>
                <Text style={[styles.modalTitle, directionalText, { color: colors.text }]}>
                  {isEditing ? t('progress.editMeasurements') : t('progress.logMeasurements')}
                </Text>
                <Pressable
                  onPress={onClose}
                  hitSlop={12}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.cancel')}
                  style={styles.closeButton}
                >
                  <Text style={[styles.closeIcon, { color: colors.textMuted }]}>✕</Text>
                </Pressable>
              </View>

              {/* Error Banner */}
              {errorMessage ? (
                <View
                  style={[
                    styles.errorBox,
                    { backgroundColor: `${colors.danger}15`, borderColor: colors.danger },
                  ]}
                  accessible={true}
                  accessibilityRole="alert"
                  accessibilityLabel={errorMessage}
                >
                  <Text style={[styles.errorText, directionalText, { color: colors.danger }]}>
                    {errorMessage}
                  </Text>
                </View>
              ) : null}

              {/* Unit Toggle */}
              <View
                style={[
                  styles.unitToggleContainer,
                  activeRowStyle(),
                  { backgroundColor: colors.background },
                ]}
              >
                <Pressable
                  style={[
                    styles.unitTab,
                    selectedUnit === 'cm' && [styles.unitTabActive, { backgroundColor: colors.accent }],
                  ]}
                  onPress={() => handleUnitToggle('cm')}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityState={{ selected: selectedUnit === 'cm' }}
                  accessibilityLabel={t('progress.unitCm')}
                >
                  <Text
                    style={[
                      styles.unitTabText,
                      { color: selectedUnit === 'cm' ? colors.background : colors.textMuted },
                    ]}
                  >
                    {t('progress.unitCm')}
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.unitTab,
                    selectedUnit === 'in' && [styles.unitTabActive, { backgroundColor: colors.accent }],
                  ]}
                  onPress={() => handleUnitToggle('in')}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityState={{ selected: selectedUnit === 'in' }}
                  accessibilityLabel={t('progress.unitIn')}
                >
                  <Text
                    style={[
                      styles.unitTabText,
                      { color: selectedUnit === 'in' ? colors.background : colors.textMuted },
                    ]}
                  >
                    {t('progress.unitIn')}
                  </Text>
                </Pressable>
              </View>

              {/* Date and Time Row */}
              <View style={[styles.row, activeRowStyle()]}>
                <View style={[styles.inputGroup, styles.halfCol]}>
                  <Text style={[styles.inputLabel, directionalText, { color: colors.text }]}>
                    {t('progress.measurementDate')}
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      directionalText,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                        color: colors.text,
                      },
                    ]}
                    value={dateText}
                    onChangeText={(val) => {
                      setDateText(val);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.textMuted}
                    maxLength={10}
                    accessible={true}
                    accessibilityLabel={t('progress.measurementDate')}
                    accessibilityHint={t('progress.dateHelp')}
                  />
                </View>

                <View style={[styles.inputGroup, styles.halfCol]}>
                  <Text style={[styles.inputLabel, directionalText, { color: colors.text }]}>
                    {t('progress.measurementTime')}
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      directionalText,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                        color: colors.text,
                      },
                    ]}
                    value={timeText}
                    onChangeText={(val) => {
                      setTimeText(val);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="HH:mm"
                    placeholderTextColor={colors.textMuted}
                    maxLength={5}
                    accessible={true}
                    accessibilityLabel={t('progress.measurementTime')}
                    accessibilityHint={t('progress.timeHelp')}
                  />
                </View>
              </View>

              {/* Measurement Input Fields (Core Torso: Waist, Hips, Chest) */}
              <View style={styles.sectionDivider}>
                <Text style={[styles.groupHeading, directionalText, { color: colors.textMuted }]}>
                  {t('progress.measurements')}
                </Text>
              </View>

              {MEASUREMENT_FIELDS.map((field) => {
                const label = t(field.labelKey);
                const placeholder = selectedUnit === 'cm' ? `${Math.round(field.minCm + 20)}` : '32.0';

                return (
                  <View key={field.key} style={styles.inputGroup}>
                    <View style={[styles.fieldLabelRow, activeRowStyle()]}>
                      <Text style={[styles.inputLabel, directionalText, { color: colors.text }]}>
                        {label}
                      </Text>
                      <Text style={[styles.unitBadge, { color: colors.textMuted }]}>
                        ({selectedUnit})
                      </Text>
                    </View>
                    <TextInput
                      style={[
                        styles.input,
                        directionalText,
                        {
                          backgroundColor: colors.background,
                          borderColor: colors.border,
                          color: colors.text,
                        },
                      ]}
                      value={fieldTexts[field.key]}
                      onChangeText={(val) => handleFieldChange(field.key, val)}
                      placeholder={placeholder}
                      placeholderTextColor={colors.textMuted}
                      keyboardType="decimal-pad"
                      returnKeyType="done"
                      accessible={true}
                      accessibilityLabel={`${label} (${selectedUnit})`}
                      accessibilityHint={t('progress.measurementRangeError')}
                    />
                  </View>
                );
              })}

              {/* Notes Input */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, directionalText, { color: colors.text }]}>
                  {t('progress.notesOptional')}
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    styles.multilineInput,
                    directionalText,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  value={notesText}
                  onChangeText={setNotesText}
                  placeholder={t('progress.notesPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  multiline={true}
                  numberOfLines={3}
                  accessible={true}
                  accessibilityLabel={t('progress.notesOptional')}
                />
              </View>

              {/* Action Buttons */}
              <View style={[styles.actionsContainer, activeRowStyle()]}>
                {isEditing && onDelete ? (
                  <Pressable
                    style={[
                      styles.deleteButton,
                      { borderColor: colors.danger, opacity: isDeleting || isSaving ? 0.6 : 1 },
                    ]}
                    onPress={handleDelete}
                    disabled={isDeleting || isSaving}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={t('common.delete')}
                  >
                    <Text style={[styles.deleteButtonText, { color: colors.danger }]}>
                      {t('common.delete')}
                    </Text>
                  </Pressable>
                ) : null}

                <Pressable
                  style={[
                    styles.saveButton,
                    { backgroundColor: colors.accent, opacity: isSaving || isDeleting ? 0.6 : 1 },
                    isEditing && onDelete ? styles.saveButtonFlex : styles.saveButtonFull,
                  ]}
                  onPress={handleSave}
                  disabled={isSaving || isDeleting}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={isSaving ? t('progress.saving') : t('common.save')}
                >
                  <Text style={[styles.saveButtonText, { color: colors.background }]}>
                    {isSaving ? t('progress.saving') : t('common.save')}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </TouchableWithoutFeedback>
  );
}

export function AddBodyMeasurementModal(props: AddBodyMeasurementModalProps) {
  const { visible, onClose } = props;

  useEffect(() => {
    if (!visible) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [visible, onClose]);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      {visible ? (
        <AddBodyMeasurementFormContent key={props.initialEntry?.id ?? 'new'} {...props} />
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  keyboardContainer: {
    width: '100%',
    maxWidth: 480,
  },
  modalCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  scrollContent: {
    gap: spacing.md,
  },
  headerRow: {
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    ...typography.h3,
    flex: 1,
  },
  closeButton: {
    minWidth: 48,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIcon: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  errorBox: {
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  errorText: {
    ...typography.caption,
    fontWeight: '600',
  },
  unitToggleContainer: {
    padding: 3,
    borderRadius: radius.pill,
  },
  unitTab: {
    flex: 1,
    paddingVertical: spacing.xs + 2,
    alignItems: 'center',
    borderRadius: radius.pill,
    minHeight: 40,
    justifyContent: 'center',
  },
  unitTabActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  unitTabText: {
    ...typography.body,
    fontWeight: '700',
    fontSize: 14,
  },
  inputGroup: {
    gap: spacing.xs,
  },
  fieldLabelRow: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  unitBadge: {
    ...typography.caption,
    fontSize: 12,
  },
  sectionDivider: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(150,150,150,0.15)',
    paddingTop: spacing.xs,
    marginTop: spacing.xs,
  },
  groupHeading: {
    ...typography.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  row: {
    gap: spacing.md,
  },
  halfCol: {
    flex: 1,
  },
  inputLabel: {
    ...typography.caption,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    ...typography.body,
    minHeight: 48,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  actionsContainer: {
    marginTop: spacing.sm,
    gap: spacing.md,
  },
  deleteButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.pill,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  deleteButtonText: {
    ...typography.body,
    fontWeight: '700',
  },
  saveButton: {
    borderRadius: radius.pill,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  saveButtonFlex: {
    flex: 2,
  },
  saveButtonFull: {
    width: '100%',
  },
  saveButtonText: {
    ...typography.body,
    fontWeight: '700',
  },
});
