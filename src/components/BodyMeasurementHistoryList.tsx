import React, { useMemo } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Translator } from '../i18n';
import type { BodyMeasurementEntry } from '../models/biometrics';
import type { MeasurementUnits } from '../models/settings';
import { themeColors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import {
  compareBodyMeasurementsDescending,
  formatMeasurement,
  MEASUREMENT_FIELDS,
} from '../utils/measurements';
import { activeRowStyle, activeTextAlign, activeWritingDirection } from '../utils/rtl';

export type BodyMeasurementHistoryListProps = {
  measurements: BodyMeasurementEntry[];
  unit: MeasurementUnits;
  t: Translator;
  onEditEntry: (entry: BodyMeasurementEntry) => void;
  onDeleteEntry?: (id: string) => void;
  maxEntries?: number;
};

type GroupedMeasurements = {
  date: string;
  entries: BodyMeasurementEntry[];
};

export function BodyMeasurementHistoryList({
  measurements = [],
  unit,
  t,
  onEditEntry,
  onDeleteEntry,
  maxEntries,
}: BodyMeasurementHistoryListProps) {
  const colors = themeColors();

  // Sort measurements chronologically descending using the canonical comparator
  const sortedMeasurements = useMemo(() => {
    const safe = measurements || [];
    const sorted = [...safe].sort(compareBodyMeasurementsDescending);
    return maxEntries ? sorted.slice(0, maxEntries) : sorted;
  }, [measurements, maxEntries]);

  // Group sorted entries by date
  const groupedByDate = useMemo(() => {
    const groups: GroupedMeasurements[] = [];
    const dateMap = new Map<string, BodyMeasurementEntry[]>();

    for (const entry of sortedMeasurements) {
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
  }, [sortedMeasurements]);

  const directionalText = {
    textAlign: activeTextAlign(),
    writingDirection: activeWritingDirection(),
  } as const;

  const handleDeletePress = (id: string) => {
    if (!onDeleteEntry) return;

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
          onPress: () => onDeleteEntry(id),
        },
      ]
    );
  };

  if (sortedMeasurements.length === 0) {
    return (
      <View
        style={[
          styles.emptyContainer,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
        accessible={true}
        accessibilityRole="summary"
        accessibilityLabel={t('progress.noMeasurementsYet')}
      >
        <Text style={[styles.emptyIcon, { color: colors.textMuted }]}>📏</Text>
        <Text style={[styles.emptyTitle, directionalText, { color: colors.text }]}>
          {t('progress.noMeasurementsYet')}
        </Text>
        <Text style={[styles.emptySubtitle, directionalText, { color: colors.textMuted }]}>
          {t('progress.noMeasurementsSub')}
        </Text>
      </View>
    );
  }

  const unitLabel = unit === 'imperial' ? t('progress.unitIn') : t('progress.unitCm');

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
              const isLast = index === group.entries.length - 1;

              // Collect measured sites (strictly non-null and positive)
              const measuredSites = MEASUREMENT_FIELDS.filter((f) => {
                const val = entry[f.key];
                return val != null && Number.isFinite(val) && val > 0;
              });

              const summaryText = measuredSites
                .map((f) => `${t(f.labelKey)}: ${formatMeasurement(entry[f.key], unit, 1)} ${unitLabel}`)
                .join(', ');

              const a11yDescription = `${entry.date} ${entry.time}, ${summaryText}${
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
                    accessibilityHint={t('progress.editMeasurements')}
                  >
                    <View style={styles.entryContent}>
                      {/* Time and Notes Row */}
                      <View style={[styles.metaRow, activeRowStyle()]}>
                        <View style={[styles.timeBadge, { backgroundColor: `${colors.accent}15` }]}>
                          <Text style={[styles.timeText, { color: colors.accent }]}>
                            {entry.time}
                          </Text>
                        </View>
                        {entry.notes ? (
                          <Text
                            numberOfLines={1}
                            ellipsizeMode="tail"
                            style={[styles.notesText, directionalText, { color: colors.textMuted }]}
                          >
                            {entry.notes}
                          </Text>
                        ) : null}
                      </View>

                      {/* Chips of recorded measurements */}
                      <View style={[styles.chipsContainer, activeRowStyle()]}>
                        {measuredSites.map((site) => (
                          <View
                            key={site.key}
                            style={[
                              styles.chip,
                              { backgroundColor: colors.background, borderColor: colors.border },
                            ]}
                          >
                            <Text style={[styles.chipLabel, { color: colors.textMuted }]}>
                              {t(site.labelKey)}:
                            </Text>
                            <Text style={[styles.chipValue, { color: colors.text }]}>
                              {formatMeasurement(entry[site.key], unit, 1)} {unitLabel}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>

                    {/* Delete Action Button */}
                    {onDeleteEntry ? (
                      <Pressable
                        style={styles.deleteIconButton}
                        hitSlop={8}
                        onPress={() => handleDeletePress(entry.id)}
                        accessible={true}
                        accessibilityRole="button"
                        accessibilityLabel={t('common.delete')}
                      >
                        <Text style={[styles.deleteIconText, { color: colors.textMuted }]}>
                          ✕
                        </Text>
                      </Pressable>
                    ) : null}
                  </Pressable>

                  {!isLast ? (
                    <View style={[styles.separator, { backgroundColor: colors.border }]} />
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
  dateGroup: {
    gap: spacing.xs,
  },
  dateHeader: {
    ...typography.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: spacing.xs,
  },
  entriesCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  entryRow: {
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
  },
  entryContent: {
    flex: 1,
    gap: spacing.xs,
  },
  metaRow: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  timeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  timeText: {
    ...typography.caption,
    fontWeight: '700',
    fontSize: 12,
  },
  notesText: {
    ...typography.caption,
    flex: 1,
    fontStyle: 'italic',
  },
  chipsContainer: {
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  chipLabel: {
    ...typography.caption,
    fontSize: 11,
  },
  chipValue: {
    ...typography.caption,
    fontWeight: '700',
    fontSize: 11,
  },
  deleteIconButton: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteIconText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: spacing.md,
  },
  emptyContainer: {
    padding: spacing.xl,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: spacing.xs,
  },
  emptyTitle: {
    ...typography.body,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    ...typography.caption,
    textAlign: 'center',
    maxWidth: 280,
  },
});
