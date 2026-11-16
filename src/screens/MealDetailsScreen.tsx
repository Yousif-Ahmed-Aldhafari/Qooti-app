import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import { AppHeader } from '../components/AppHeader';
import { MacroCard } from '../components/MacroCard';
import type { Translator } from '../i18n';
import { themeColors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import type { Meal, UserProfile } from '../types';
import { calculateMealTotals } from '../utils/nutrition';
import { resolveEffectiveNutritionTargets } from '../utils/nutritionTargets';
import { activeRowStyle, activeTextAlign, activeWritingDirection } from '../utils/rtl';

export type MealDeleteState = 'idle' | 'confirming' | 'deleting' | 'success' | 'error';

type MealDetailsScreenProps = {
  t: Translator;
  meal: Meal;
  profile: UserProfile;
  onEdit?: (meal: Meal) => void;
  onDelete?: (meal: Meal) => Promise<void> | void;
  onRepeat?: (meal: Meal) => Promise<void> | void;
  onToggleFavorite?: (meal: Meal) => Promise<void> | void;
};

export function MealDetailsScreen({
  t,
  meal,
  profile,
  onEdit,
  onDelete,
  onRepeat,
  onToggleFavorite,
}: MealDetailsScreenProps) {
  const colors = themeColors();
  const [deleteState, setDeleteState] = useState<MealDeleteState>('idle');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isRepeating, setIsRepeating] = useState(false);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const isDeleting = deleteState === 'deleting';

  const handleRepeat = async () => {
    if (isRepeating || !onRepeat) return;
    setIsRepeating(true);
    setActionFeedback(null);
    try {
      await onRepeat(meal);
      setActionFeedback(t('meals.repeatedMealSuccess') || 'Meal repeated for today');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to repeat meal';
      setActionFeedback(message);
    } finally {
      setIsRepeating(false);
    }
  };

  const handleToggleFavorite = async () => {
    if (isTogglingFavorite || !onToggleFavorite) return;
    setIsTogglingFavorite(true);
    setActionFeedback(null);
    try {
      await onToggleFavorite(meal);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update favorite status';
      setActionFeedback(message);
    } finally {
      setIsTogglingFavorite(false);
    }
  };

  // Support itemless legacy meals with explicit totals
  const totals = useMemo(() => {
    if (meal.items && meal.items.length > 0) {
      return calculateMealTotals(meal.items);
    }
    return {
      calories: meal.totalCalories ?? 0,
      protein: meal.totalProtein ?? 0,
      carbs: meal.totalCarbs ?? 0,
      fats: meal.totalFat ?? meal.totalFats ?? 0,
      fat: meal.totalFat ?? meal.totalFats ?? 0,
    };
  }, [meal]);

  const effectiveTargets = useMemo(() => resolveEffectiveNutritionTargets(profile), [profile]);
  const directionalText = {
    textAlign: activeTextAlign(),
    writingDirection: activeWritingDirection(),
  } as const;

  const hasActiveTarget = effectiveTargets.hasActiveTarget;
  const unavailableLabel = t('personalization.unconfirmedStatus');

  const executeDelete = async () => {
    if (isDeleting || !onDelete) return;
    setDeleteState('deleting');
    setDeleteError(null);

    try {
      await onDelete(meal);
      setDeleteState('success');
    } catch (err) {
      setDeleteState('error');
      const message = err instanceof Error ? err.message : t('meals.deleteError') || 'Failed to delete meal';
      setDeleteError(message);
    }
  };

  const confirmDelete = () => {
    if (isDeleting) return;
    setDeleteState('confirming');
    setDeleteError(null);

    const mealTitle = meal.title || meal.name || '';
    const message = mealTitle
      ? `${mealTitle}\n${t('meals.deleteMealMessage')}`
      : t('meals.deleteMealMessage');

    Alert.alert(
      t('meals.deleteMeal'),
      message,
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
          onPress: () => setDeleteState('idle'),
        },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            await executeDelete();
          },
        },
      ],
      {
        cancelable: true,
        onDismiss: () => {
          setDeleteState((prev) => (prev === 'confirming' ? 'idle' : prev));
        },
      }
    );
  };

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <AppHeader
        title={meal.title || meal.name || ''}
        subtitle={
          meal.date && meal.date.trim()
            ? `${meal.date.trim()}${meal.time ? ` · ${meal.time}` : ''}`
            : (t('meals.unassignedBadge') || 'Unassigned')
        }
        action={
          <View style={[styles.headerActions, activeRowStyle()]}>
            {onToggleFavorite ? (
              <AppButton
                title={meal.isFavorite ? (t('meals.favoriteBadge') || 'Favorite') : ''}
                icon={meal.isFavorite ? 'star' : 'star-outline'}
                variant="secondary"
                disabled={isTogglingFavorite || isDeleting}
                onPress={handleToggleFavorite}
              />
            ) : null}
            {onEdit ? (
              <AppButton
                title={t('common.edit')}
                icon="create-outline"
                variant="secondary"
                disabled={isDeleting || isRepeating}
                onPress={() => onEdit(meal)}
              />
            ) : null}
          </View>
        }
      />

      {actionFeedback ? (
        <View style={[styles.feedbackBanner, { backgroundColor: colors.card, borderColor: colors.primary }]}>
          <Text style={[styles.feedbackBannerText, directionalText, { color: colors.text }]}>
            {actionFeedback}
          </Text>
        </View>
      ) : null}

      {/* Meal Slot Badge, Favorite Badge & Notes */}
      {(meal.mealType || meal.notes || meal.isFavorite) && (
        <View style={styles.metaCard}>
          <View style={[styles.badgeRow, activeRowStyle()]}>
            {meal.isFavorite ? (
              <View style={[styles.favoriteBadge, { backgroundColor: '#f59e0b20', borderColor: '#f59e0b' }]}>
                <Text style={[styles.favoriteBadgeText, { color: '#f59e0b' }]}>
                  ★ {t('meals.favoriteBadge') || 'Favorite'}
                </Text>
              </View>
            ) : null}
            {meal.mealType ? (
              <View style={[styles.slotBadge, { backgroundColor: `${colors.primary}20`, borderColor: colors.primary }]}>
                <Text style={[styles.slotBadgeText, { color: colors.primary }]}>
                  {t(`meals.${meal.mealType}` as any) || meal.mealType}
                </Text>
              </View>
            ) : null}
          </View>
          {meal.notes ? (
            <Text style={[styles.notesText, directionalText, { color: colors.textMuted }]}>
              {meal.notes}
            </Text>
          ) : null}
        </View>
      )}

      {onRepeat ? (
        <AppButton
          title={isRepeating ? (t('common.loading') || 'Loading...') : t('meals.logAgainToday')}
          icon="repeat-outline"
          variant="secondary"
          disabled={isRepeating || isDeleting}
          onPress={handleRepeat}
          style={styles.repeatButton}
        />
      ) : null}

      {deleteError ? (
        <View style={[styles.errorBanner, { backgroundColor: colors.card, borderColor: colors.danger }]}>
          <Text style={[styles.errorBannerText, directionalText, { color: colors.danger }]}>
            {deleteError}
          </Text>
        </View>
      ) : null}

      <View style={[styles.grid, activeRowStyle()]}>
        <MacroCard
          label={t('common.calories')}
          value={totals.calories}
          target={hasActiveTarget ? effectiveTargets.calories : null}
          hasTarget={hasActiveTarget}
          unavailableLabel={unavailableLabel}
          unit={t('common.kcal')}
        />
        <MacroCard
          label={t('common.protein')}
          value={totals.protein}
          target={hasActiveTarget ? effectiveTargets.protein : null}
          hasTarget={hasActiveTarget}
          unavailableLabel={unavailableLabel}
          unit={t('common.grams')}
          accent={colors.purple}
        />
        <MacroCard
          label={t('common.carbs')}
          value={totals.carbs}
          target={hasActiveTarget ? effectiveTargets.carbs : null}
          hasTarget={hasActiveTarget}
          unavailableLabel={unavailableLabel}
          unit={t('common.grams')}
          accent={colors.lavender}
        />
        <MacroCard
          label={t('common.fats')}
          value={totals.fats}
          target={hasActiveTarget ? effectiveTargets.fats : null}
          hasTarget={hasActiveTarget}
          unavailableLabel={unavailableLabel}
          unit={t('common.grams')}
          accent={colors.orange}
        />
      </View>

      {meal.items && meal.items.length > 0 ? (
        meal.items.map((item) => (
          <AppCard key={item.id}>
            <Text style={[styles.itemTitle, directionalText, { color: colors.text }]}>{item.foodName || item.name}</Text>
            <Text style={[styles.itemMeta, directionalText, { color: colors.textMuted }]}>
              {item.quantity} {item.unit || 'g'} - {item.calories} {t('common.kcal')} - {item.protein}{t('common.grams')} {t('common.protein')}
            </Text>
          </AppCard>
        ))
      ) : (
        <AppCard>
          <Text style={[styles.itemTitle, directionalText, { color: colors.text }]}>{meal.title || meal.name}</Text>
          <Text style={[styles.itemMeta, directionalText, { color: colors.textMuted }]}>
            {t('meals.noItems')} - {totals.calories} {t('common.kcal')}
          </Text>
        </AppCard>
      )}

      {onDelete ? (
        <View style={styles.dangerZone}>
          <AppButton
            title={isDeleting ? (t('common.loading') || 'Loading...') : t('meals.deleteMeal')}
            icon="trash-outline"
            variant="danger"
            disabled={isDeleting}
            onPress={confirmDelete}
            style={styles.deleteButton}
          />
        </View>
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
  headerActions: {
    gap: spacing.xs,
    alignItems: 'center',
  },
  metaCard: {
    gap: spacing.xs,
  },
  badgeRow: {
    gap: spacing.xs,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  favoriteBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  favoriteBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  repeatButton: {
    width: '100%',
  },
  feedbackBanner: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  feedbackBannerText: {
    ...typography.caption,
    fontWeight: '600',
  },
  slotBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  slotBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  notesText: {
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 4,
  },
  errorBanner: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  errorBannerText: {
    ...typography.caption,
    fontWeight: '600',
  },
  grid: {
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  itemTitle: {
    ...typography.h3,
  },
  itemMeta: {
    ...typography.body,
  },
  dangerZone: {
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  deleteButton: {
    width: '100%',
  },
});
