import { useMemo, useState } from 'react';
import {
  FlatList,
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

import {
  EQUIPMENT_TYPES,
  MUSCLE_GROUPS,
  getLocalizedEquipmentName,
  getLocalizedMuscleGroupName,
  searchCatalog,
} from '../data/exerciseCatalog';
import type { Translator } from '../i18n';
import type {
  CatalogExercise,
  EquipmentType,
  MuscleGroup,
} from '../models/exerciseCatalog';
import { themeColors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { activeRowStyle, activeTextAlign, activeWritingDirection } from '../utils/rtl';
import { getPressFeedback } from '../utils/touchFeedback';

type ExercisePickerModalProps = {
  visible: boolean;
  onClose: () => void;
  onSelect: (exercise: CatalogExercise) => void;
  t: Translator;
  language?: 'en' | 'ar';
};

export function ExercisePickerModal({
  visible,
  onClose,
  onSelect,
  t,
  language = 'en',
}: ExercisePickerModalProps) {
  const colors = themeColors();
  const [query, setQuery] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup | 'all'>('all');
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentType | 'all'>('all');

  const directionalText = {
    textAlign: activeTextAlign(),
    writingDirection: activeWritingDirection(),
  } as const;

  const isFiltered = query.trim().length > 0 || selectedMuscle !== 'all' || selectedEquipment !== 'all';

  const filteredExercises = useMemo(() => {
    return searchCatalog({
      query: query.trim(),
      muscleGroup: selectedMuscle,
      equipment: selectedEquipment,
      language,
    });
  }, [query, selectedMuscle, selectedEquipment, language]);

  function handleClearFilters() {
    setQuery('');
    setSelectedMuscle('all');
    setSelectedEquipment('all');
  }

  const { android_ripple, styleModifier } = getPressFeedback({
    rippleColor: `${colors.border}4D`,
    activeOpacity: 0.72,
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, activeRowStyle(), { borderBottomColor: colors.border }]}>
          <View style={styles.headerTitleWrap}>
            <Text style={[styles.headerTitle, directionalText, { color: colors.text }]}>
              {language === 'ar' ? 'اختر تمريناً من الدليل' : 'Select Exercise'}
            </Text>
            <Text style={[styles.headerSubtitle, directionalText, { color: colors.textMuted }]}>
              {language === 'ar' ? 'دليل التمارين المعتمد' : 'Exercise Catalog'}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
            onPress={onClose}
            style={({ pressed }) => [styles.closeButton, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={[styles.searchBox, activeRowStyle(), { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
            <Ionicons name="search" size={20} color={colors.textMuted} />
            <TextInput
              style={[styles.searchInput, directionalText, { color: colors.text }]}
              placeholder={
                language === 'ar'
                  ? 'ابحث باسم التمرين أو الاسم الشائع...'
                  : 'Search exercise name or alias...'
              }
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
            {query ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                onPress={() => setQuery('')}
                style={styles.searchClear}
              >
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* Filter Chips: Muscle Groups */}
        <View style={styles.filtersSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={language === 'ar' ? 'كل العضلات' : 'All Muscles'}
              onPress={() => setSelectedMuscle('all')}
              style={[
                styles.chip,
                {
                  backgroundColor: selectedMuscle === 'all' ? colors.primary : colors.card,
                  borderColor: selectedMuscle === 'all' ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: selectedMuscle === 'all' ? colors.buttonText : colors.text },
                ]}
              >
                {language === 'ar' ? 'كل العضلات' : 'All Muscles'}
              </Text>
            </Pressable>

            {MUSCLE_GROUPS.map((m) => {
              const active = selectedMuscle === m;
              return (
                <Pressable
                  key={m}
                  accessibilityRole="button"
                  accessibilityLabel={getLocalizedMuscleGroupName(m, language)}
                  onPress={() => setSelectedMuscle(m)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? colors.primary : colors.card,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: active ? colors.buttonText : colors.text },
                    ]}
                  >
                    {getLocalizedMuscleGroupName(m, language)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Filter Chips: Equipment */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={language === 'ar' ? 'كل الأدوات' : 'All Equipment'}
              onPress={() => setSelectedEquipment('all')}
              style={[
                styles.chip,
                {
                  backgroundColor: selectedEquipment === 'all' ? colors.purple : colors.card,
                  borderColor: selectedEquipment === 'all' ? colors.purple : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: selectedEquipment === 'all' ? '#FFFFFF' : colors.text },
                ]}
              >
                {language === 'ar' ? 'كل الأدوات' : 'All Equipment'}
              </Text>
            </Pressable>

            {EQUIPMENT_TYPES.map((e) => {
              const active = selectedEquipment === e;
              return (
                <Pressable
                  key={e}
                  accessibilityRole="button"
                  accessibilityLabel={getLocalizedEquipmentName(e, language)}
                  onPress={() => setSelectedEquipment(e)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? colors.purple : colors.card,
                      borderColor: active ? colors.purple : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: active ? '#FFFFFF' : colors.text },
                    ]}
                  >
                    {getLocalizedEquipmentName(e, language)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Clear Filters bar if filtered */}
        {isFiltered ? (
          <View style={[styles.clearBar, activeRowStyle()]}>
            <Text style={[styles.resultCount, directionalText, { color: colors.textSecondary }]}>
              {language === 'ar'
                ? `${filteredExercises.length} تمريناً متاحاً`
                : `${filteredExercises.length} exercises found`}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={language === 'ar' ? 'إعادة ضبط الفلاتر' : 'Clear Filters'}
              onPress={handleClearFilters}
              style={styles.clearButton}
            >
              <Text style={[styles.clearButtonText, { color: colors.accent }]}>
                {language === 'ar' ? 'إعادة ضبط الفلاتر' : 'Clear Filters'}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* Exercise List */}
        <FlatList
          data={filteredExercises}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const primaryTitle = language === 'ar' ? item.nameAr : item.nameEn;
            const subtitle = language === 'ar' ? item.nameEn : item.nameAr;
            const muscleLabel = getLocalizedMuscleGroupName(item.primaryMuscle, language);
            const equipmentLabel = getLocalizedEquipmentName(item.equipment, language);

            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${primaryTitle}, ${muscleLabel}, ${equipmentLabel}`}
                android_ripple={android_ripple}
                onPress={() => {
                  onSelect(item);
                  onClose();
                }}
                style={({ pressed }) => [
                  styles.itemCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  styleModifier({ pressed }),
                ]}
              >
                <View style={styles.itemHeader}>
                  <Text style={[styles.itemTitle, directionalText, { color: colors.text }]}>
                    {primaryTitle}
                  </Text>
                  <Text style={[styles.itemSubtitle, directionalText, { color: colors.textMuted }]}>
                    {subtitle}
                  </Text>
                </View>

                <View style={[styles.badgesRow, activeRowStyle()]}>
                  <View style={[styles.badge, { backgroundColor: colors.primaryMuted }]}>
                    <Text style={[styles.badgeText, { color: colors.primary }]}>{muscleLabel}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: colors.secondaryMuted }]}>
                    <Text style={[styles.badgeText, { color: colors.secondary }]}>{equipmentLabel}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: colors.cardMuted }]}>
                    <Text style={[styles.badgeText, { color: colors.textSecondary }]}>
                      {item.category === 'compound'
                        ? language === 'ar' ? 'مركب' : 'Compound'
                        : language === 'ar' ? 'عزل' : 'Isolation'}
                    </Text>
                  </View>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconWrap, { backgroundColor: colors.cardMuted }]}>
                <Ionicons name="search-outline" size={36} color={colors.textMuted} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {language === 'ar' ? 'لم يتم العثور على تمارين' : 'No exercises found'}
              </Text>
              <Text style={[styles.emptyMessage, { color: colors.textMuted }]}>
                {language === 'ar'
                  ? 'جرّب تعديل كلمات البحث أو مسح الفلاتر المختارة.'
                  : 'Try adjusting your search terms or clearing selected filters.'}
              </Text>
              {isFiltered ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={language === 'ar' ? 'مسح الفلاتر' : 'Reset Filters'}
                  onPress={handleClearFilters}
                  style={[styles.emptyClearButton, { backgroundColor: colors.accent }]}
                >
                  <Text style={[styles.emptyClearText, { color: colors.buttonText }]}>
                    {language === 'ar' ? 'مسح الفلاتر' : 'Reset Filters'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          }
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    ...typography.h3,
  },
  headerSubtitle: {
    ...typography.caption,
    marginTop: 2,
  },
  closeButton: {
    padding: spacing.xs,
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  searchBox: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    minHeight: 48,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    paddingVertical: spacing.sm,
  },
  searchClear: {
    padding: spacing.xs,
  },
  filtersSection: {
    paddingBottom: spacing.xs,
    gap: spacing.xs,
  },
  filterRow: {
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipText: {
    ...typography.caption,
    fontWeight: '600',
  },
  clearBar: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xs,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultCount: {
    ...typography.caption,
  },
  clearButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  clearButtonText: {
    ...typography.caption,
    fontWeight: '700',
  },
  listContent: {
    padding: spacing.xl,
    paddingTop: spacing.sm,
    gap: spacing.md,
    paddingBottom: 80,
  },
  itemCard: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  itemHeader: {
    gap: 2,
  },
  itemTitle: {
    ...typography.h3,
    fontSize: 16,
  },
  itemSubtitle: {
    ...typography.caption,
  },
  badgesRow: {
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  badgeText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xxl * 2,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  emptyTitle: {
    ...typography.h3,
    textAlign: 'center',
  },
  emptyMessage: {
    ...typography.body,
    textAlign: 'center',
    maxWidth: 280,
  },
  emptyClearButton: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyClearText: {
    ...typography.body,
    fontWeight: '700',
  },
});
