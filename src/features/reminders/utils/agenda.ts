import type { Reminder, ReminderEvent } from '@/types/reminder';
import {
  addDays,
  dateKey,
  endOfDay,
  isSameDay,
  startOfDay,
} from '@/utils/date';
import { nextOccurrence, occurrencesForDay } from '@/utils/recurrence';

export interface AgendaItem {
  reminder: Reminder;
  occurrence: Date;
  event?: ReminderEvent;
  kind: 'scheduled' | 'ringing' | 'answered' | 'snoozed' | 'completed' | 'missed' | 'declined' | 'dismissed';
  snoozedUntil?: Date;
}

export function isActiveReminder(reminder: Reminder): boolean {
  return ['scheduled', 'ringing', 'answered', 'snoozed'].includes(reminder.status);
}

export function nextForReminder(reminder: Reminder, now = new Date()): Date | null {
  if (!isActiveReminder(reminder)) return null;
  if (reminder.status === 'snoozed' && reminder.snoozedUntil) {
    const snooze = new Date(reminder.snoozedUntil);
    if (snooze.getTime() > now.getTime()) return snooze;
  }
  if (reminder.status === 'ringing' || reminder.status === 'answered') {
    const due = new Date(reminder.scheduledAt);
    if (due.getTime() <= now.getTime()) return due;
  }
  return nextOccurrence(reminder, now);
}

export interface UpcomingItem {
  reminder: Reminder;
  occurrence: Date;
  snoozed: boolean;
}

export function getUpcoming(reminders: Reminder[], now = new Date()): UpcomingItem[] {
  const items: UpcomingItem[] = [];
  for (const reminder of reminders) {
    const occurrence = nextForReminder(reminder, now);
    if (!occurrence) continue;
    items.push({
      reminder,
      occurrence,
      snoozed: reminder.status === 'snoozed' && !!reminder.snoozedUntil,
    });
  }
  return items.sort((a, b) => a.occurrence.getTime() - b.occurrence.getTime());
}

const EVENT_PRIORITY: Record<string, number> = {
  completed: 6,
  declined: 5,
  missed: 4,
  snoozed: 3,
  answered: 2,
  ringing: 1,
  dismissed: 0,
};

export function buildAgenda(
  reminders: Reminder[],
  events: ReminderEvent[],
  day: Date,
  options: { includePastEvents?: boolean } = {},
): AgendaItem[] {
  const now = new Date();
  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);
  const items: AgendaItem[] = [];
  const seen = new Map<string, number>();

  const relevantEvents = events.filter((event) => {
    const occurrence = new Date(event.occurrenceAt);
    return occurrence >= dayStart && occurrence <= dayEnd;
  });

  for (const event of relevantEvents) {
    const reminder = reminders.find((item) => item.id === event.reminderId);
    if (!reminder) continue;
    const occurrence = new Date(event.occurrenceAt);
    const key = `${event.reminderId}:${event.occurrenceAt}`;
    const existingIndex = seen.get(key);
    if (existingIndex !== undefined) {
      const existing = items[existingIndex];
      if ((EVENT_PRIORITY[event.status] ?? -1) > (EVENT_PRIORITY[existing.kind] ?? -1)) {
        items[existingIndex] = {
          reminder,
          occurrence,
          event,
          kind: event.status,
        };
      }
      continue;
    }
    seen.set(key, items.length);
    items.push({
      reminder,
      occurrence,
      event,
      kind: event.status,
    });
  }

  if (!options.includePastEvents) {
    // Keep future scheduled occurrences and current ringing/snoozed states.
    for (const reminder of reminders) {
      if (!isActiveReminder(reminder)) continue;
      if (reminder.status === 'snoozed' && reminder.snoozedUntil) {
        const snooze = new Date(reminder.snoozedUntil);
        if (snooze >= dayStart && snooze <= dayEnd) {
          const key = `snooze:${reminder.id}`;
          if (!seen.has(key)) {
            seen.set(key, items.length);
            items.push({ reminder, occurrence: snooze, kind: 'snoozed', snoozedUntil: snooze });
          }
        }
      }
      const occurrences = occurrencesForDay([reminder], day);
      for (const { occurrence } of occurrences) {
        const occurrenceKey = `${reminder.id}:${occurrence.toISOString()}`;
        if (seen.has(occurrenceKey)) continue;
        const isPast = occurrence.getTime() < now.getTime() - 60_000 && !isSameDay(occurrence, now);
        if (isPast) continue;
        if (occurrence.getTime() < now.getTime() - 60_000 && isSameDay(occurrence, now)) {
          if (reminder.status === 'scheduled') continue;
        }
        seen.set(occurrenceKey, items.length);
        items.push({ reminder, occurrence, kind: 'scheduled' });
      }
    }
  } else {
    for (const reminder of reminders) {
      if (!isActiveReminder(reminder)) continue;
      const occurrences = occurrencesForDay([reminder], day);
      for (const { occurrence } of occurrences) {
        const occurrenceKey = `${reminder.id}:${occurrence.toISOString()}`;
        if (seen.has(occurrenceKey)) continue;
        seen.set(occurrenceKey, items.length);
        items.push({ reminder, occurrence, kind: 'scheduled' });
      }
    }
  }

  return items.sort((a, b) => a.occurrence.getTime() - b.occurrence.getTime());
}

export function calendarCounts(
  reminders: Reminder[],
  events: ReminderEvent[],
  month: Date,
): Map<string, number> {
  const counts = new Map<string, number>();
  const now = new Date();
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
  const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const seen = new Set<string>();

  for (const event of events) {
    const occurrence = new Date(event.occurrenceAt);
    if (occurrence < monthStart || occurrence > endOfDay(monthEnd)) continue;
    const key = `${event.reminderId}:${event.occurrenceAt}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const dayKey = dateKey(occurrence);
    counts.set(dayKey, (counts.get(dayKey) ?? 0) + 1);
  }

  const days = monthEnd.getDate();
  for (const reminder of reminders) {
    if (!isActiveReminder(reminder)) continue;
    for (let day = 1; day <= days; day += 1) {
      const current = new Date(month.getFullYear(), month.getMonth(), day);
      const occurrences = occurrencesForDay([reminder], current);
      for (const { occurrence } of occurrences) {
        if (occurrence.getTime() < now.getTime() - 60_000) continue;
        const key = `${reminder.id}:${occurrence.toISOString()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const dayKey = dateKey(occurrence);
        counts.set(dayKey, (counts.get(dayKey) ?? 0) + 1);
      }
    }
  }
  return counts;
}

export function todayItems(reminders: Reminder[], events: ReminderEvent[], now = new Date()): AgendaItem[] {
  return buildAgenda(reminders, events, now, { includePastEvents: false });
}

export function upcomingWeek(reminders: Reminder[], now = new Date()): UpcomingItem[] {
  const horizon = endOfDay(addDays(now, 7));
  return getUpcoming(reminders, now).filter(
    (item) => item.occurrence.getTime() > now.getTime() && item.occurrence <= horizon,
  );
}

export function nextOccurrenceFor(reminder: Reminder, now = new Date()): Date | null {
  return nextForReminder(reminder, now);
}
