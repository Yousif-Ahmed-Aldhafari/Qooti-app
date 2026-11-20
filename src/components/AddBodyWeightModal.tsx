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
import type { BodyWeightEntry, TimePrecision, WeightSource } from '../models/biometrics';
import type { MeasurementUnits } from '../models/settings';
import { themeColors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { activeRowStyle, activeTextAlign, activeWritingDirection } from '../utils/rtl';
import {
  formatWeightInput,
  lbToKg,
  parseWeightInput,
  validateWeightDate,
  validateWeightTime,
  validateWeightValue,
} from '../utils/weight';

export type AddBodyWeightModalProps = {
  visible: boolean;
  onClose: () => void;
  onSave: (entry: BodyWeightEntry) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  initialEntry?: BodyWeightEntry | null;
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
  if (fallback && validateWeightDate(fallback)) return fallback;
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function generateBodyWeightId(): string {
  return `bw_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

function AddBodyWeightFormContent({
  onClose,
  onSave,
  onDelete,
  initialEntry,
  defaultUnit = 'metric',
  t,
  referenceDate,
}: Omit<AddBodyWeightModalProps, 'visible'>) {
  const colors = themeColors();
  const isEditing = Boolean(initialEntry);

  const initialUnitState: 'kg' | 'lb' = defaultUnit === 'imperial' ? 'lb' : 'kg';
  const [selectedUnit, setSelectedUnit] = useState<'kg' | 'lb'>(initialUnitState);
  const [canonicalWeightKg, setCanonicalWeightKg] = useState<number | null>(
    () => (initialEntry ? initialEntry.weightKg : null)
  );
  const [isWeightEdited, setIsWeightEdited] = useState(false);
  const [weightText, setWeightText] = useState(() => {
    if (initialEntry) {
      return formatWeightInput(initialEntry.weightKg, initialUnitState, 2);
    }
    return '';
  });
  const [dateText, setDateText] = useState(() => {
    if (initialEntry) {
      return initialEntry.date;
    }
    return getLocalCurrentDate(referenceDate);
  });
  const [timeText, setTimeText] = useState(() => {
    if (initialEntry) {
      return initialEntry.timePrecision === 'date_only' ? '' : initialEntry.time;
    }
    return getLocalCurrentTime();
  });
  const [notesText, setNotesText] = useState(() => initialEntry?.notes || '');
  const [isDateOnlyRecord] = useState(() => initialEntry?.timePrecision === 'date_only');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Handle unit toggle with lossless conversion
  const handleUnitToggle = useCallback(
    (newUnit: 'kg' | 'lb') => {
      if (newUnit === selectedUnit) return;
      if (canonicalWeightKg != null) {
        setWeightText(formatWeightInput(canonicalWeightKg, newUnit, 2));
      }
      setSelectedUnit(newUnit);
      setErrorMessage(null);
    },
    [selectedUnit, canonicalWeightKg]
  );

  const handleSave = async () => {
    if (isSaving || isDeleting) return;

    // 1. Parse and validate weight
    const parsedWeight = parseWeightInput(weightText);
    if (parsedWeight == null) {
      setErrorMessage(t('progress.invalidNumberError'));
      return;
    }

    const validation = validateWeightValue(parsedWeight, selectedUnit);
    if (!validation.isValid || validation.weightKg == null) {
      setErrorMessage(t(validation.errorKey || 'progress.weightRangeError'));
      return;
    }

    // Determine canonical weight to save:
    // If the user didn't edit the weight numeric value (e.g. only toggled units, or only edited date/time/notes),
    // preserve initialEntry.weightKg exactly to avoid any floating point drift.
    let weightKgToSave: number;
    if (!isWeightEdited && initialEntry) {
      weightKgToSave = initialEntry.weightKg;
    } else if (canonicalWeightKg != null && Math.abs(canonicalWeightKg - validation.weightKg) < 0.05) {
      weightKgToSave = canonicalWeightKg;
    } else {
      weightKgToSave = validation.weightKg;
    }

    // 2. Validate calendar date
    const trimmedDate = dateText.trim();
    if (!validateWeightDate(trimmedDate)) {
      setErrorMessage(t('progress.invalidDateError'));
      return;
    }

    // 3. Validate measurement time
    const trimmedTime = timeText.trim();
    if (!validateWeightTime(trimmedTime)) {
      setErrorMessage(t('progress.invalidTimeError'));
      return;
    }

    // Determine time precision:
    let finalTime: string;
    let timePrecision: TimePrecision;

    if (!trimmedTime) {
      // User left time empty or legacy date_only record with no time entered
      finalTime = '12:00';
      timePrecision = 'date_only';
    } else {
      finalTime = trimmedTime;
      timePrecision = 'minute';
    }

    const source: WeightSource = initialEntry ? initialEntry.source : 'manual';
    const nowIso = new Date().toISOString();

    const entryToSave: BodyWeightEntry = {
      id: initialEntry ? initialEntry.id : generateBodyWeightId(),
      date: trimmedDate,
      time: finalTime,
      timePrecision,
      weightKg: weightKgToSave,
      notes: notesText.trim() ? notesText.trim() : null,
      source,
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
      t('progress.deleteWeightConfirmTitle'),
      t('progress.deleteWeightConfirmMessage'),
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
                    {isEditing ? t('progress.editWeight') : t('progress.logWeight')}
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
                    style={[styles.errorBox, { backgroundColor: `${colors.danger}15`, borderColor: colors.danger }]}
                    accessible={true}
                    accessibilityRole="alert"
                    accessibilityLabel={errorMessage}
                  >
                    <Text style={[styles.errorText, directionalText, { color: colors.danger }]}>
                      {errorMessage}
                    </Text>
                  </View>
                ) : null}

                {/* Date-only notice if editing legacy migrated entry */}
                {isDateOnlyRecord ? (
                  <View
                    style={[styles.noticeBox, { backgroundColor: `${colors.lavender}15`, borderColor: colors.lavender }]}
                  >
                    <Text style={[styles.noticeText, directionalText, { color: colors.lavender }]}>
                      {t('progress.timeUnrecorded')}
                    </Text>
                  </View>
                ) : null}

                {/* Unit Toggle */}
                <View style={[styles.unitToggleContainer, activeRowStyle(), { backgroundColor: colors.background }]}>
                  <Pressable
                    style={[
                      styles.unitTab,
                      selectedUnit === 'kg' && [styles.unitTabActive, { backgroundColor: colors.accent }],
                    ]}
                    onPress={() => handleUnitToggle('kg')}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityState={{ selected: selectedUnit === 'kg' }}
                    accessibilityLabel={t('progress.weightKg')}
                  >
                    <Text
                      style={[
                        styles.unitTabText,
                        { color: selectedUnit === 'kg' ? colors.background : colors.textMuted },
                      ]}
                    >
                      {t('progress.unitKg')}
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.unitTab,
                      selectedUnit === 'lb' && [styles.unitTabActive, { backgroundColor: colors.accent }],
                    ]}
                    onPress={() => handleUnitToggle('lb')}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityState={{ selected: selectedUnit === 'lb' }}
                    accessibilityLabel={t('progress.weightLb')}
                  >
                    <Text
                      style={[
                        styles.unitTabText,
                        { color: selectedUnit === 'lb' ? colors.background : colors.textMuted },
                      ]}
                    >
                      {t('progress.unitLb')}
                    </Text>
                  </Pressable>
                </View>

                {/* Weight Input */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, directionalText, { color: colors.text }]}>
                    {selectedUnit === 'kg' ? t('progress.weightKg') : t('progress.weightLb')}
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
                    value={weightText}
                    onChangeText={(val) => {
                      setWeightText(val);
                      setIsWeightEdited(true);
                      if (errorMessage) setErrorMessage(null);
                      const parsed = parseWeightInput(val);
                      if (parsed != null && Number.isFinite(parsed) && parsed > 0) {
                        const asKg = selectedUnit === 'lb' ? lbToKg(parsed) : parsed;
                        setCanonicalWeightKg(asKg);
                      } else {
                        setCanonicalWeightKg(null);
                      }
                    }}
                    placeholder={selectedUnit === 'kg' ? '70.5' : '155.0'}
                    placeholderTextColor={colors.textMuted}
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                    accessible={true}
                    accessibilityLabel={t('progress.weight')}
                    accessibilityHint={t('progress.weightRangeError')}
                  />
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

export function AddBodyWeightModal(props: AddBodyWeightModalProps) {
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
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      {visible ? (
        <AddBodyWeightFormContent
          key={props.initialEntry?.id ?? 'new'}
          {...props}
        />
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
  noticeBox: {
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  noticeText: {
    ...typography.caption,
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
