import { REPEAT_LABELS } from '@/constants/config';
import type { Reminder, RepeatType } from '@/types/reminder';
import { addMonths, dateKey, endOfDay, isSameDay, startOfDay, weekdayName } from './date';

const MAX_ITERATIONS = 2000;

export function isRepeating(type: RepeatType): boolean {
  return type !== 'never';
}

/**
 * Returns the first occurrence at or after `after`.
 * `reminder.scheduledAt` is the anchor (the first occurrence of the series).
 */
export function nextOccurrence(reminder: Pick<Reminder, 'scheduledAt' | 'repeatType' | 'repeatDays'>, after: Date): Date | null {
  const anchor = new Date(reminder.scheduledAt);
  if (Number.isNaN(anchor.getTime())) return null;
  if (reminder.repeatType === 'never') {
    return anchor.getTime() >= after.getTime() ? anchor : null;
  }
  if (anchor.getTime() >= after.getTime()) return anchor;

  let cursor = new Date(anchor);
  for (let i = 0; i < MAX_ITERATIONS; i += 1) {
    cursor = advance(cursor, reminder.repeatType, reminder.repeatDays, anchor);
    if (cursor.getTime() >= after.getTime()) return cursor;
  }
  return null;
}

/** Next occurrence strictly after the given occurrence. */
export function occurrenceAfter(
  reminder: Pick<Reminder, 'scheduledAt' | 'repeatType' | 'repeatDays'>,
  occurrence: Date,
): Date | null {
  if (reminder.repeatType === 'never') return null;
  return advance(occurrence, reminder.repeatType, reminder.repeatDays, new Date(reminder.scheduledAt));
}

function advance(cursor: Date, type: RepeatType, repeatDays: number[], anchor: Date): Date {
  const next = new Date(cursor);
  switch (type) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      return next;
    case 'weekdays': {
      do {
        next.setDate(next.getDate() + 1);
      } while (next.getDay() === 0 || next.getDay() === 6);
      return next;
    }
    case 'weekends': {
      do {
        next.setDate(next.getDate() + 1);
      } while (next.getDay() !== 0 && next.getDay() !== 6);
      return next;
    }
    case 'weekly':
      next.setDate(next.getDate() + 7);
      return next;
    case 'monthly': {
      const day = anchor.getDate();
      const after = addMonths(next, 1);
      const lastDay = new Date(after.getFullYear(), after.getMonth() + 1, 0).getDate();
      after.setDate(Math.min(day, lastDay));
      return after;
    }
    case 'custom': {
      const days = repeatDays.length ? repeatDays : [anchor.getDay()];
      let guard = 0;
      do {
        next.setDate(next.getDate() + 1);
        guard += 1;
      } while (!days.includes(next.getDay()) && guard < 14);
      return next;
    }
    default:
      next.setDate(next.getDate() + 1);
      return next;
  }
}

export function occurrencesInRange(
  reminder: Pick<Reminder, 'scheduledAt' | 'repeatType' | 'repeatDays' | 'status'>,
  rangeStart: Date,
  rangeEnd: Date,
): Date[] {
  if (reminder.status === 'cancelled' || reminder.status === 'completed' || reminder.status === 'declined') {
    return [];
  }
  const anchor = new Date(reminder.scheduledAt);
  const start = startOfDay(rangeStart);
  const end = endOfDay(rangeEnd);
  const result: Date[] = [];

  if (reminder.repeatType === 'never') {
    if (anchor >= start && anchor <= end) result.push(anchor);
    return result;
  }

  let cursor: Date | null = anchor;
  if (anchor < start) {
    let guard = 0;
    while (cursor && cursor < start && guard < MAX_ITERATIONS) {
      cursor = occurrenceAfter(reminder, cursor);
      guard += 1;
    }
  }
  let guard = 0;
  while (cursor && cursor <= end && guard < MAX_ITERATIONS) {
    if (cursor >= start) result.push(cursor);
    cursor = occurrenceAfter(reminder, cursor);
    guard += 1;
  }
  return result;
}

export function occurrencesForDay(
  reminders: Reminder[],
  day: Date,
): Array<{ reminder: Reminder; occurrence: Date }> {
  const result: Array<{ reminder: Reminder; occurrence: Date }> = [];
  for (const reminder of reminders) {
    const occurrences = occurrencesInRange(reminder, day, day);
    for (const occurrence of occurrences) {
      result.push({ reminder, occurrence });
    }
  }
  return result.sort((a, b) => a.occurrence.getTime() - b.occurrence.getTime());
}

export function remindersOnCalendarDays(reminders: Reminder[], month: Date): Map<string, number> {
  const counts = new Map<string, number>();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day += 1) {
    const current = new Date(month.getFullYear(), month.getMonth(), day);
    const items = occurrencesForDay(reminders, current);
    if (items.length) counts.set(dateKey(current), items.length);
  }
  return counts;
}

export function repeatDescription(type: RepeatType, repeatDays: number[]): string {
  if (type === 'custom') {
    if (!repeatDays.length) return 'Custom days';
    return repeatDays
      .slice()
      .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
      .map((day) => weekdayName(day).slice(0, 3))
      .join(', ');
  }
  if (type === 'weekly') return REPEAT_LABELS.weekly;
  return REPEAT_LABELS[type];
}

export function nextOccurrenceLabel(reminder: Reminder, after = new Date()): string {
  const next = nextOccurrence(reminder, after);
  if (!next) return 'No upcoming call';
  if (isSameDay(next, after)) return 'Today';
  return REPEAT_LABELS[reminder.repeatType];
}
