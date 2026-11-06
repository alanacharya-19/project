import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, radius } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from '@/components/common/AppText';
import { Screen, ScreenHeader } from '@/components/common/Screen';
import { SectionHeader } from '@/components/common/Chip';
import { SegmentedControl } from '@/components/common/SegmentedControl';
import { EmptyState } from '@/components/common/EmptyState';
import { Calendar } from '@/components/calendar/Calendar';
import { ReminderCard } from '@/components/cards/ReminderCard';
import {
  buildAgenda,
  calendarCounts,
  getUpcoming,
} from '@/features/reminders/utils/agenda';
import type { AgendaItem } from '@/features/reminders/utils/agenda';
import { useRemindersStore } from '@/store/remindersStore';
import { useUiStore } from '@/store/uiStore';
import {
  addDays,
  dateKey,
  endOfDay,
  formatDateLong,
  formatRelativeDay,
  isSameDay,
  isSameMonth,
  startOfDay,
} from '@/utils/date';
import { hapticMedium } from '@/utils/haptics';

type Filter = 'all' | 'upcoming' | 'past';

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'History' },
];

export default function EventsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reminders = useRemindersStore((state) => state.reminders);
  const events = useRemindersStore((state) => state.events);
  const loading = useRemindersStore((state) => state.loading);
  const refresh = useRemindersStore((state) => state.refresh);
  const openCreate = useUiStore((state) => state.openCreate);
  const openEdit = useUiStore((state) => state.openEdit);

  const now = new Date();
  const [month, setMonth] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(now);
  const [filter, setFilter] = useState<Filter>('all');

  const counts = useMemo(
    () => calendarCounts(reminders, events, month),
    [reminders, events, month],
  );

  const dayItems = useMemo(() => {
    const items = buildAgenda(reminders, events, selectedDate, { includePastEvents: true });
    if (filter === 'upcoming') {
      return items.filter((item) =>
        ['scheduled', 'snoozed', 'ringing', 'answered'].includes(item.kind),
      );
    }
    if (filter === 'past') {
      return items.filter((item) =>
        ['completed', 'missed', 'declined', 'dismissed'].includes(item.kind),
      );
    }
    return items;
  }, [events, filter, reminders, selectedDate]);

  const upcomingGroups = useMemo(() => {
    const horizon = endOfDay(addDays(now, 7));
    const items = getUpcoming(reminders, now).filter(
      (item) => item.occurrence.getTime() > now.getTime() && item.occurrence <= horizon,
    );
    const groups = new Map<string, typeof items>();
    for (const item of items) {
      const key = dateKey(item.occurrence);
      const group = groups.get(key) ?? [];
      group.push(item);
      groups.set(key, group);
    }
    return Array.from(groups.entries()).map(([key, group]) => ({
      key,
      date: startOfDay(group[0].occurrence),
      items: group,
    }));
  }, [reminders, now]);

  const openItem = (item: AgendaItem) => {
    if (item.kind === 'ringing') {
      router.push({
        pathname: '/incoming/[id]',
        params: { id: item.reminder.id, at: String(item.occurrence.getTime()) },
      });
      return;
    }
    openEdit(item.reminder);
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.xl,
          paddingBottom: insets.bottom + 118,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      >
        <ScreenHeader
          left={
            <View style={{ gap: 4 }}>
              <AppText variant="micro" color={colors.textMuted}>
                CALL HISTORY & SCHEDULE
              </AppText>
              <AppText variant="h1">Events</AppText>
            </View>
          }
          right={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Create a reminder"
              onPress={() => {
                hapticMedium();
                openCreate(selectedDate);
              }}
              style={[styles.headerAdd, { backgroundColor: colors.accentSurface, borderColor: `${colors.accent}33` }]}
            >
              <Ionicons name="add" size={18} color={colors.accent} />
              <AppText variant="caption" color={colors.accent} weight="700">
                New
              </AppText>
            </Pressable>
          }
          style={{ paddingHorizontal: 0, paddingTop: spacing.md }}
        />

        <Calendar
          month={month}
          selectedDate={selectedDate}
          counts={counts}
          onSelectDate={setSelectedDate}
          onChangeMonth={(date) => {
            setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
            if (!isSameMonth(date, selectedDate)) {
              setSelectedDate(
                isSameMonth(date, now) ? now : new Date(date.getFullYear(), date.getMonth(), 1),
              );
            }
          }}
        />

        <View style={styles.dayHeader}>
          <View style={{ gap: 3, flex: 1 }}>
            <AppText variant="h3">{formatDateLong(selectedDate)}</AppText>
            <AppText variant="caption" color={colors.textMuted}>
              {dayItems.length} {dayItems.length === 1 ? 'call' : 'calls'}
              {isSameDay(selectedDate, now) ? ' · today' : ''}
            </AppText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add a call on this day"
            onPress={() => {
              hapticMedium();
              openCreate(selectedDate);
            }}
            style={[styles.addButton, { backgroundColor: colors.accentSurface }]}
          >
            <Ionicons name="add" size={16} color={colors.accent} />
          </Pressable>
        </View>

        <SegmentedControl options={FILTERS} value={filter} onChange={setFilter} />

        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          {dayItems.length === 0 ? (
            <EmptyState
              compact
              icon={filter === 'past' ? 'time-outline' : 'calendar-outline'}
              title={filter === 'past' ? 'No call history this day' : 'A quiet day'}
              message={
                filter === 'past'
                  ? 'Completed, missed and declined calls will appear here.'
                  : 'No reminder calls are scheduled for this day yet.'
              }
              actionLabel={filter === 'past' ? undefined : 'Schedule a call'}
              onAction={filter === 'past' ? undefined : () => openCreate(selectedDate)}
            />
          ) : (
            dayItems.map((item) => (
              <ReminderCard
                key={`${item.reminder.id}-${item.occurrence.toISOString()}-${item.kind}-${filter}`}
                item={item}
                onPress={() => openItem(item)}
              />
            ))
          )}
        </View>

        {filter !== 'past' && upcomingGroups.length > 0 ? (
          <View style={{ marginTop: spacing['2xl'] }}>
            <SectionHeader title="NEXT 7 DAYS" />
            {upcomingGroups.map((group) => (
              <View key={group.key} style={{ marginBottom: spacing.lg }}>
                <View style={styles.groupHeader}>
                  <AppText variant="caption" color={colors.textSecondary} weight="700">
                    {formatRelativeDay(group.date, now)}
                  </AppText>
                  <View style={[styles.groupLine, { backgroundColor: colors.borderSoft }]} />
                  <AppText variant="micro" color={colors.textMuted}>
                    {group.items.length} {group.items.length === 1 ? 'CALL' : 'CALLS'}
                  </AppText>
                </View>
                <View style={{ gap: spacing.sm }}>
                  {group.items.map((item) => (
                    <ReminderCard
                      key={`week-${item.reminder.id}-${item.occurrence.toISOString()}`}
                      item={{
                        reminder: item.reminder,
                        occurrence: item.occurrence,
                        kind: item.snoozed ? 'snoozed' : 'scheduled',
                      }}
                      compact
                      onPress={() => openEdit(item.reminder)}
                    />
                  ))}
                </View>
              </View>
            ))}
          </View>
        ) : null}

        <AppText
          variant="caption"
          color={colors.textMuted}
          align="center"
          style={{ marginTop: spacing['2xl'], lineHeight: 18 }}
        >
          Past calls are kept even if you delete the reminder, so your history stays honest.
        </AppText>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 38,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing['2xl'],
    marginBottom: spacing.md,
  },
  addButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  groupLine: {
    flex: 1,
    height: 1,
  },
});
