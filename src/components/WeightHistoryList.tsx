import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Translator } from '../i18n';
import type { BodyWeightEntry } from '../models/biometrics';
import type { MeasurementUnits } from '../models/settings';
import { themeColors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { activeRowStyle, activeTextAlign, activeWritingDirection } from '../utils/rtl';
import {
  compareBodyWeightsDescending,
  formatWeight,
} from '../utils/weight';

export type WeightHistoryListProps = {
  weights: BodyWeightEntry[];
  unit: MeasurementUnits;
  t: Translator;
  onEditEntry: (entry: BodyWeightEntry) => void;
  onDeleteEntry?: (id: string) => void;
  maxEntries?: number;
};

type GroupedWeights = {
  date: string;
  entries: BodyWeightEntry[];
};

export function WeightHistoryList({
  weights = [],
  unit,
  t,
  onEditEntry,
  onDeleteEntry,
  maxEntries,
}: WeightHistoryListProps) {
  const colors = themeColors();

  // Sort weights chronologically descending using the canonical comparator
  const sortedWeights = useMemo(() => {
    const safeWeights = weights || [];
    const sorted = [...safeWeights].sort(compareBodyWeightsDescending);
    return maxEntries ? sorted.slice(0, maxEntries) : sorted;
  }, [weights, maxEntries]);

  // Group sorted entries by date
  const groupedByDate = useMemo(() => {
    const groups: GroupedWeights[] = [];
    const dateMap = new Map<string, BodyWeightEntry[]>();

    for (const entry of sortedWeights) {
      const existing = dateMap.get(entry.date);
      if (existing) {
        existing.push(entry);
      } else {
        const list = [entry];
        dateMap.set(entry.date, list);
        groups.push({ date: entry.date, entries: list });
      }
    }

    return groups;
  }, [sortedWeights]);

  const directionalText = {
    textAlign: activeTextAlign(),
    writingDirection: activeWritingDirection(),
  } as const;

  if (sortedWeights.length === 0) {
    return (
      <View
        style={[
          styles.emptyContainer,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
        accessible={true}
        accessibilityRole="summary"
        accessibilityLabel={t('progress.noWeightsYet')}
      >
        <Text style={[styles.emptyIcon, { color: colors.textMuted }]}>⚖️</Text>
        <Text style={[styles.emptyTitle, directionalText, { color: colors.text }]}>
          {t('progress.noWeightsYet')}
        </Text>
        <Text style={[styles.emptySubtitle, directionalText, { color: colors.textMuted }]}>
          {t('progress.noWeightsSub')}
        </Text>
      </View>
    );
  }

  const unitLabel = unit === 'imperial' ? t('progress.unitLb') : t('progress.unitKg');

  return (
    <View style={styles.container}>
      {groupedByDate.map((group) => (
        <View key={group.date} style={styles.dateGroup}>
          <Text style={[styles.dateHeader, directionalText, { color: colors.textMuted }]}>
            {group.date}
          </Text>

          <View
            style={[
              styles.entriesCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            {group.entries.map((entry, index) => {
              const isDateOnly = entry.timePrecision === 'date_only';
              const formattedValue = formatWeight(entry.weightKg, unit, 1);
              const isLast = index === group.entries.length - 1;

              const a11yDescription = isDateOnly
                ? `${formattedValue} ${unitLabel}, ${entry.date}, ${t('progress.timeUnrecorded')}${
                    entry.notes ? `, ${entry.notes}` : ''
                  }`
                : `${formattedValue} ${unitLabel}, ${entry.date} ${entry.time}${
                    entry.notes ? `, ${entry.notes}` : ''
                  }`;

              return (
                <View key={entry.id}>
                  <Pressable
                    style={[styles.entryRow, activeRowStyle()]}
                    onPress={() => onEditEntry(entry)}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={a11yDescription}
                    accessibilityHint={t('progress.editWeight')}
                  >
                    {/* Weight value & unit */}
                    <View style={styles.weightColumn}>
                      <View style={[styles.weightValueRow, activeRowStyle()]}>
                        <Text style={[styles.weightText, { color: colors.text }]}>
                          {formattedValue}
                        </Text>
                        <Text style={[styles.unitText, { color: colors.textMuted }]}>
                          {unitLabel}
                        </Text>
                      </View>
                      {entry.notes ? (
                        <Text
                          style={[styles.notesText, directionalText, { color: colors.textMuted }]}
                          numberOfLines={1}
                        >
                          {entry.notes}
                        </Text>
                      ) : null}
                    </View>

                    {/* Time or date-only badge */}
                    <View style={styles.timeColumn}>
                      {isDateOnly ? (
                        <View
                          style={[
                            styles.dateOnlyBadge,
                            { backgroundColor: `${colors.lavender}20`, borderColor: colors.lavender },
                          ]}
                        >
                          <Text style={[styles.dateOnlyText, { color: colors.lavender }]}>
                            {t('progress.timeUnrecorded')}
                          </Text>
                        </View>
                      ) : (
                        <Text style={[styles.timeText, { color: colors.textMuted }]}>
                          {entry.time}
                        </Text>
                      )}
                    </View>

                    {/* Action buttons */}
                    <View style={[styles.actionsRow, activeRowStyle()]}>
                      <Pressable
                        style={styles.actionButton}
                        onPress={() => onEditEntry(entry)}
                        hitSlop={8}
                        accessible={true}
                        accessibilityRole="button"
                        accessibilityLabel={t('common.edit')}
                      >
                        <Text style={[styles.actionIcon, { color: colors.accent }]}>✎</Text>
                      </Pressable>

                      {onDeleteEntry ? (
                        <Pressable
                          style={styles.actionButton}
                          onPress={() => onDeleteEntry(entry.id)}
                          hitSlop={8}
                          accessible={true}
                          accessibilityRole="button"
                          accessibilityLabel={t('common.delete')}
                        >
                          <Text style={[styles.actionIcon, { color: colors.danger }]}>🗑</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </Pressable>

                  {!isLast ? (
                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  emptyContainer: {
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: spacing.xs,
  },
  emptyTitle: {
    ...typography.body,
    fontWeight: '700',
    fontSize: 16,
  },
  emptySubtitle: {
    ...typography.caption,
    textAlign: 'center',
  },
  dateGroup: {
    gap: spacing.xs,
  },
  dateHeader: {
    ...typography.caption,
    fontWeight: '700',
    paddingHorizontal: spacing.xs,
  },
  entriesCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  entryRow: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
    gap: spacing.sm,
  },
  weightColumn: {
    flex: 1,
    gap: 2,
  },
  weightValueRow: {
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  weightText: {
    ...typography.h3,
    fontSize: 18,
  },
  unitText: {
    ...typography.caption,
    fontWeight: '600',
  },
  notesText: {
    ...typography.caption,
    fontSize: 12,
  },
  timeColumn: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  timeText: {
    ...typography.caption,
    fontWeight: '600',
  },
  dateOnlyBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  dateOnlyText: {
    fontSize: 11,
    fontWeight: '600',
  },
  actionsRow: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionButton: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionIcon: {
    fontSize: 16,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: spacing.md,
  },
});
