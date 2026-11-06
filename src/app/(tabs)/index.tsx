import React, { useMemo } from 'react';
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, radius } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from '@/components/common/AppText';
import { Screen, ScreenHeader } from '@/components/common/Screen';
import { Wordmark } from '@/components/common/Logo';
import { SectionHeader, StatusPill } from '@/components/common/Chip';
import { Surface } from '@/components/common/Surface';
import { PrimaryButton } from '@/components/common/Buttons';
import { EmptyState } from '@/components/common/EmptyState';
import { NextCallCard } from '@/components/cards/NextCallCard';
import { ReminderCard } from '@/components/cards/ReminderCard';
import {
  getUpcoming,
  isActiveReminder,
  todayItems,
  upcomingWeek,
} from '@/features/reminders/utils/agenda';
import { useRemindersStore } from '@/store/remindersStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useUiStore } from '@/store/uiStore';
import { useCapabilities } from '@/services/permissions/hooks';
import { formatCountdown, formatDateLong, getGreeting, isSameDay, formatRelativeDay, formatTime } from '@/utils/date';
import { repeatDescription } from '@/utils/recurrence';
import { hapticTap, hapticMedium } from '@/utils/haptics';
import type { AgendaItem } from '@/features/reminders/utils/agenda';

export default function HomeScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reminders = useRemindersStore((state) => state.reminders);
  const events = useRemindersStore((state) => state.events);
  const loading = useRemindersStore((state) => state.loading);
  const refresh = useRemindersStore((state) => state.refresh);
  const name = useSettingsStore((state) => state.settings.name);
  const openCreate = useUiStore((state) => state.openCreate);
  const openEdit = useUiStore((state) => state.openEdit);
  const { capabilities } = useCapabilities();

  const now = new Date();
  const upcoming = useMemo(() => getUpcoming(reminders, now), [reminders, now]);
  const next = upcoming[0];
  const today = useMemo(() => todayItems(reminders, events, now), [reminders, events, now]);
  const week = useMemo(() => upcomingWeek(reminders, now), [reminders, now]);
  const activeCount = reminders.filter(isActiveReminder).length;
  const laterThisWeek = week
    .filter((item) => !isSameDay(item.occurrence, now))
    .slice(0, 3);

  const recent = useMemo(() => {
    const seen = new Set<string>();
    const items: AgendaItem[] = [];
    for (const event of events) {
      if (!['completed', 'missed', 'declined', 'answered'].includes(event.status)) continue;
      const key = `${event.reminderId}:${event.occurrenceAt}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const reminder = reminders.find((item) => item.id === event.reminderId);
      if (!reminder) continue;
      items.push({
        reminder,
        occurrence: new Date(event.occurrenceAt),
        event,
        kind: event.status,
      });
      if (items.length >= 3) break;
    }
    return items;
  }, [events, reminders]);

  const capabilityAlert = useMemo(() => {
    if (!capabilities) return null;
    if (!capabilities.notificationsEnabled) {
      return 'Notifications are off. RINGO cannot call you until you allow them.';
    }
    if (Platform.OS === 'android' && !capabilities.nativeAndroid) {
      return 'This build uses alerts only. Full-screen calls need the RINGO development build.';
    }
    if (capabilities.platform === 'android' && !capabilities.exactAlarms) {
      return 'Exact alarm access is off. Android may delay your reminder calls.';
    }
    if (capabilities.platform === 'android' && !capabilities.fullScreenIntent) {
      return 'Full-screen call access is off. Calls will show as high-priority alerts.';
    }
    return null;
  }, [capabilities]);

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
            <View style={{ gap: 5 }}>
              <AppText variant="micro" color={colors.textMuted}>
                {formatDateLong(now).toUpperCase()}
              </AppText>
              <AppText variant="h1">
                {name ? `${getGreeting(now)}, ${name}` : getGreeting(now)}
              </AppText>
            </View>
          }
          right={<Wordmark size={15} />}
          style={{ paddingHorizontal: 0, paddingTop: spacing.md }}
        />

        {capabilityAlert ? (
          <Pressable
            onPress={() => router.navigate('/settings')}
            style={[
              styles.alertBanner,
              { backgroundColor: colors.warningSurface, borderColor: `${colors.warning}33` },
            ]}
          >
            <Ionicons name="alert-circle-outline" size={17} color={colors.warning} />
            <AppText variant="caption" color={colors.warning} style={{ flex: 1 }}>
              {capabilityAlert}
            </AppText>
            <AppText variant="caption" color={colors.warning} weight="700">
              Fix
            </AppText>
            <Ionicons name="chevron-forward" size={13} color={colors.warning} />
          </Pressable>
        ) : null}

        <Surface style={styles.summary} padding={0}>
          <View style={styles.summaryCell}>
            <AppText variant="hero" style={{ fontSize: 26, lineHeight: 30 }}>
              {today.filter((item) => item.kind === 'scheduled' || item.kind === 'snoozed').length}
            </AppText>
            <AppText variant="micro" color={colors.textMuted}>
              TODAY
            </AppText>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: colors.borderSoft }]} />
          <View style={styles.summaryCell}>
            <AppText variant="hero" style={{ fontSize: 26, lineHeight: 30 }}>
              {activeCount}
            </AppText>
            <AppText variant="micro" color={colors.textMuted}>
              ACTIVE
            </AppText>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: colors.borderSoft }]} />
          <View style={styles.summaryCell}>
            <AppText variant="h3" style={{ marginTop: 3 }}>
              {next ? formatCountdown(next.occurrence, now) : '—'}
            </AppText>
            <AppText variant="micro" color={colors.textMuted}>
              NEXT CALL
            </AppText>
          </View>
        </Surface>

        <View style={{ marginTop: spacing.lg }}>
          {next ? (
            <NextCallCard item={next} onPress={() => openItem({ reminder: next.reminder, occurrence: next.occurrence, kind: 'scheduled' })} />
          ) : (
            <Surface style={styles.emptyHero} variant="default">
              <View style={[styles.emptyIcon, { backgroundColor: colors.accentSurface, borderColor: `${colors.accent}33` }]}>
                <Ionicons name="call-outline" size={28} color={colors.accent} />
              </View>
              <AppText variant="h3" align="center" style={{ marginTop: spacing.md }}>
                No calls scheduled
              </AppText>
              <AppText
                variant="body"
                align="center"
                color={colors.textSecondary}
                style={{ marginTop: 4, maxWidth: 300 }}
              >
                Turn the next thing you must not forget into a reminder call.
              </AppText>
              <PrimaryButton
                label="Schedule a call"
                icon="add"
                onPress={() => openCreate()}
                fullWidth={false}
                style={{ marginTop: spacing.lg, minWidth: 190, alignSelf: 'center' }}
              />
            </Surface>
          )}
        </View>

        <View style={{ marginTop: spacing['2xl'] }}>
          <SectionHeader
            title="TODAY'S CALLS"
            actionLabel="Calendar"
            onAction={() => router.navigate('/events')}
          />
          {today.length === 0 ? (
            <EmptyState
              compact
              icon="moon-outline"
              title="Nothing else today"
              message="Your line is quiet. Add a call for later or enjoy the calm."
            />
          ) : (
            <View style={{ gap: spacing.sm }}>
              {today.map((item) => (
                <ReminderCard
                  key={`${item.reminder.id}-${item.occurrence.toISOString()}-${item.kind}`}
                  item={item}
                  onPress={() => openItem(item)}
                />
              ))}
            </View>
          )}
        </View>

        {laterThisWeek.length > 0 ? (
          <View style={{ marginTop: spacing['2xl'] }}>
            <SectionHeader
              title="LATER THIS WEEK"
              actionLabel="All events"
              onAction={() => router.navigate('/events')}
            />
            <View style={{ gap: spacing.sm }}>
              {laterThisWeek.map((item) => (
                <Pressable
                  key={`${item.reminder.id}-${item.occurrence.toISOString()}`}
                  accessibilityRole="button"
                  onPress={() => {
                    hapticTap();
                    openEdit(item.reminder);
                  }}
                  style={({ pressed }) => [
                    styles.weekRow,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.borderSoft,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <View style={styles.weekTime}>
                    <AppText variant="caption" color={colors.textMuted} weight="600">
                      {formatRelativeDay(item.occurrence, now).toUpperCase()}
                    </AppText>
                    <AppText variant="h3" style={{ fontSize: 17 }}>
                      {formatTime(item.occurrence, false)}
                    </AppText>
                  </View>
                  <View style={[styles.weekDivider, { backgroundColor: colors.borderSoft }]} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText variant="bodyStrong" numberOfLines={1}>
                      {item.reminder.title}
                    </AppText>
                    <AppText variant="caption" color={colors.textMuted} numberOfLines={1}>
                      {repeatDescription(item.reminder.repeatType, item.reminder.repeatDays)}
                      {item.snoozed ? ' · Snoozed' : ''}
                    </AppText>
                  </View>
                  {item.reminder.priority !== 'normal' ? (
                    <StatusPill
                      label={item.reminder.priority.toUpperCase()}
                      color={item.reminder.priority === 'urgent' ? colors.danger : colors.warning}
                      background={`${item.reminder.priority === 'urgent' ? colors.danger : colors.warning}18`}
                      dot={false}
                    />
                  ) : null}
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {recent.length > 0 ? (
          <View style={{ marginTop: spacing['2xl'] }}>
            <SectionHeader
              title="RECENT CALLS"
              actionLabel="History"
              onAction={() => router.navigate('/events')}
            />
            <View style={{ gap: spacing.sm }}>
              {recent.map((item) => (
                <ReminderCard
                  key={`recent-${item.reminder.id}-${item.occurrence.toISOString()}-${item.kind}`}
                  item={item}
                  compact
                  onPress={() => openEdit(item.reminder)}
                />
              ))}
            </View>
          </View>
        ) : null}

        <AppText
          variant="caption"
          color={colors.textMuted}
          align="center"
          style={{ marginTop: spacing['3xl'], lineHeight: 18 }}
        >
          RINGO calls only when you asked it to. No microphone, no tracking.
        </AppText>
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Create a reminder"
        onPress={() => {
          hapticMedium();
          openCreate();
        }}
        style={[
          styles.fab,
          {
            backgroundColor: colors.accent,
            bottom: Math.max(insets.bottom, 10) + 84,
            shadowColor: colors.shadow,
          },
        ]}
      >
        <Ionicons name="add" size={26} color={colors.background} />
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: spacing.md,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingVertical: spacing.lg,
    marginTop: spacing.lg,
  },
  summaryCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
  },
  summaryDivider: {
    width: 1,
  },
  emptyHero: {
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingVertical: spacing.md,
    paddingRight: spacing.md,
  },
  weekTime: {
    width: 88,
    paddingLeft: spacing.md,
    gap: 1,
  },
  weekDivider: {
    width: 1,
    alignSelf: 'stretch',
  },
  fab: {
    position: 'absolute',
    right: spacing.xl,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 12,
  },
});
