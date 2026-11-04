import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from '@/components/common/AppText';
import { dateKey, formatMonthYear, isSameDay, monthGrid, weekdayLabelsMondayFirst } from '@/utils/date';

interface CalendarProps {
  month: Date;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onChangeMonth: (date: Date) => void;
  counts: Map<string, number>;
}

export function Calendar({ month, selectedDate, onSelectDate, onChangeMonth, counts }: CalendarProps) {
  const { colors } = useTheme();
  const cells = useMemo(() => monthGrid(month), [month]);
  const labels = weekdayLabelsMondayFirst();
  const today = new Date();
  const rows = useMemo(() => {
    const result: Array<Array<Date | null>> = [];
    for (let i = 0; i < cells.length; i += 7) result.push(cells.slice(i, i + 7));
    return result;
  }, [cells]);

  const shiftMonth = (delta: number) => {
    onChangeMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1));
  };

  return (
    <View style={[styles.wrap, { backgroundColor: colors.surface, borderColor: colors.borderSoft }]}>
      <View style={styles.monthRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            onPress={() => shiftMonth(-1)}
            hitSlop={8}
            style={[styles.navButton, { backgroundColor: colors.surfaceMuted }]}
          >
            <Ionicons name="chevron-back" size={16} color={colors.textSecondary} />
          </Pressable>
          <AppText variant="h3">{formatMonthYear(month)}</AppText>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go to current month"
            onPress={() => {
              onChangeMonth(new Date());
              onSelectDate(new Date());
            }}
            style={[styles.todayButton, { backgroundColor: colors.accentSurface }]}
          >
            <AppText variant="micro" color={colors.accent}>
              TODAY
            </AppText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next month"
            onPress={() => shiftMonth(1)}
            hitSlop={8}
            style={[styles.navButton, { backgroundColor: colors.surfaceMuted }]}
          >
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      <View style={styles.weekRow}>
        {labels.map((label, index) => (
          <View key={`${label}-${index}`} style={styles.weekCell}>
            <AppText variant="micro" color={index > 4 ? colors.textMuted : colors.textSecondary}>
              {label}
            </AppText>
          </View>
        ))}
      </View>

      {rows.map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} style={styles.row}>
          {row.map((date, cellIndex) => {
            if (!date) return <View key={`empty-${rowIndex}-${cellIndex}`} style={styles.cell} />;
            const key = dateKey(date);
            const count = counts.get(key) ?? 0;
            const selected = isSameDay(date, selectedDate);
            const isToday = isSameDay(date, today);
            const weekend = date.getDay() === 0 || date.getDay() === 6;
            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={`${date.toDateString()}, ${count} reminder${count === 1 ? '' : 's'}`}
                onPress={() => onSelectDate(date)}
                style={styles.cell}
              >
                <View
                  style={[
                    styles.dayInner,
                    selected && { backgroundColor: colors.accent },
                    !selected && isToday && { borderColor: colors.accent, borderWidth: 1 },
                  ]}
                >
                  <AppText
                    variant="label"
                    color={selected ? '#FFF7F2' : weekend ? colors.textMuted : colors.text}
                    weight={selected || isToday ? '700' : '500'}
                    style={{ fontSize: 14 }}
                  >
                    {date.getDate()}
                  </AppText>
                  <View style={styles.markerSlot}>
                    {count > 0 ? (
                      <View style={styles.markerRow}>
                        <View
                          style={[
                            styles.dot,
                            { backgroundColor: selected ? '#FFF7F2' : colors.accent },
                          ]}
                        />
                        {count > 1 ? (
                          <AppText
                            variant="micro"
                            color={selected ? '#FFF7F2' : colors.accent}
                            style={{ fontSize: 8, lineHeight: 10, letterSpacing: 0.4 }}
                          >
                            {count > 9 ? '9+' : count}
                          </AppText>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.xl,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.lg,
  },
  navButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayButton: {
    height: 26,
    paddingHorizontal: 9,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  weekCell: {
    flex: 1,
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 2,
  },
  dayInner: {
    width: 40,
    height: 46,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  markerSlot: {
    height: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  markerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
