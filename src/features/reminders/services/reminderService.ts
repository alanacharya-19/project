import { Platform } from 'react-native';
import {
  addEvent,
  deleteReminder as deleteReminderRow,
  findDuplicate,
  getReminder,
  insertReminder,
  latestEventForOccurrence,
  listEventsForReminder,
  updateReminder as updateReminderRow,
  updateReminderScheduling,
  updateReminderStatus,
} from '@/services/database/reminderRepository';
import {
  acknowledgeNativeCall,
  cancelSnoozeNotification,
  scheduleReminderNotifications,
  scheduleSnoozeNotification,
  cancelReminderNotifications,
} from '@/services/scheduler';
import { getRingoAlarmNative, isNativeAlarmAvailable } from '@/services/native/ringoAlarm';
import type { AppSettings } from '@/types/settings';
import type {
  EventStatus,
  Reminder,
  ReminderDraft,
  ScheduleResult,
} from '@/types/reminder';
import { createId, eventId } from '@/utils/id';
import { getTimezone } from '@/utils/date';
import { nextOccurrence, occurrenceAfter } from '@/utils/recurrence';

export class ReminderValidationError extends Error {
  field?: string;
  constructor(message: string, field?: string) {
    super(message);
    this.name = 'ReminderValidationError';
    this.field = field;
  }
}

export class DuplicateReminderError extends Error {
  constructor() {
    super('An identical reminder is already scheduled for this time.');
    this.name = 'DuplicateReminderError';
  }
}

export interface SaveResult {
  reminder: Reminder;
  schedule: ScheduleResult;
}

export function validateDraft(draft: ReminderDraft): void {
  if (!draft.title.trim()) throw new ReminderValidationError('Give the reminder a title.', 'title');
  if (draft.title.trim().length > 80) throw new ReminderValidationError('Keep the title under 80 characters.', 'title');
  if (!draft.message.trim()) throw new ReminderValidationError('Add a message for RINGO to speak.', 'message');
  if (draft.message.trim().length > 500) throw new ReminderValidationError('Keep the message under 500 characters.', 'message');
  if (draft.repeatType === 'custom' && draft.repeatDays.length === 0) {
    throw new ReminderValidationError('Choose at least one day for a custom repeat.', 'repeat');
  }
  const when = new Date(draft.scheduledAt);
  if (Number.isNaN(when.getTime())) throw new ReminderValidationError('Choose a valid date and time.', 'date');
  if (when.getTime() < Date.now() + 20_000) {
    throw new ReminderValidationError('Choose a time at least 30 seconds from now.', 'date');
  }
}

function buildReminder(
  id: string,
  draft: ReminderDraft,
  createdAt: string,
  status: Reminder['status'] = 'scheduled',
): Reminder {
  return {
    id,
    title: draft.title.trim(),
    message: draft.message.trim(),
    scheduledAt: draft.scheduledAt,
    timezone: getTimezone(),
    repeatType: draft.repeatType,
    repeatDays: draft.repeatType === 'custom' ? draft.repeatDays : [],
    priority: draft.priority,
    voiceId: draft.voiceId,
    voiceName: draft.voiceName,
    speechRate: draft.speechRate,
    speechPitch: draft.speechPitch,
    snoozeMinutes: draft.snoozeMinutes,
    ringtone: draft.ringtone,
    notificationId: null,
    notificationIds: [],
    snoozeNotificationId: null,
    alarmId: null,
    status,
    snoozedUntil: null,
    createdAt,
    updatedAt: new Date().toISOString(),
  };
}

async function persistSchedule(
  reminder: Reminder,
  repeatMissedCall: boolean,
): Promise<SaveResult> {
  const schedule = await scheduleReminderNotifications(reminder, repeatMissedCall);
  await updateReminderScheduling(reminder.id, {
    notificationId: schedule.identifiers[0] ?? null,
    notificationIds: schedule.identifiers,
    snoozeNotificationId: null,
    alarmId: schedule.identifiers[0] ?? null,
  });
  const updated = await getReminder(reminder.id);
  return { reminder: updated ?? reminder, schedule };
}

export async function createReminder(draft: ReminderDraft, settings: AppSettings): Promise<SaveResult> {
  validateDraft(draft);
  const duplicate = await findDuplicate(draft.title, draft.scheduledAt, draft.repeatType);
  if (duplicate) throw new DuplicateReminderError();
  const now = new Date().toISOString();
  const reminder = buildReminder(createId('rem'), draft, now);
  await insertReminder(reminder);
  return persistSchedule(reminder, settings.repeatMissedCall);
}

export async function updateReminder(
  existing: Reminder,
  draft: ReminderDraft,
  settings: AppSettings,
): Promise<SaveResult> {
  validateDraft(draft);
  const duplicate = await findDuplicate(draft.title, draft.scheduledAt, draft.repeatType, existing.id);
  if (duplicate) throw new DuplicateReminderError();

  await cancelReminderNotifications(existing);
  await cancelSnoozeNotification(existing);
  await acknowledgeNativeCall(existing.id);

  const updated = buildReminder(existing.id, draft, existing.createdAt);
  updated.updatedAt = new Date().toISOString();
  await updateReminderRow(updated);
  return persistSchedule(updated, settings.repeatMissedCall);
}

export async function deleteReminder(reminder: Reminder): Promise<void> {
  await cancelReminderNotifications(reminder);
  await cancelSnoozeNotification(reminder);
  await acknowledgeNativeCall(reminder.id);
  await deleteReminderRow(reminder.id);
}

export async function markAnswered(
  reminder: Reminder,
  occurrence: Date,
  settings: AppSettings,
): Promise<Reminder> {
  await addEvent(eventId(reminder.id, occurrence.toISOString(), 'answered'), reminder.id, occurrence.toISOString(), 'answered');
  await updateReminderStatus(reminder.id, 'answered');
  await acknowledgeNativeCall(reminder.id);

  if (reminder.repeatType !== 'never') {
    const seriesReminder = { ...reminder, status: 'scheduled' as const, snoozedUntil: null };
    await updateReminderStatus(reminder.id, 'scheduled');
    return (await persistSchedule(seriesReminder, settings.repeatMissedCall)).reminder;
  }
  const latest = await getReminder(reminder.id);
  return latest ?? { ...reminder, status: 'answered' };
}

export async function markDeclined(
  reminder: Reminder,
  occurrence: Date,
  settings: AppSettings,
): Promise<Reminder> {
  await addEvent(eventId(reminder.id, occurrence.toISOString(), 'declined'), reminder.id, occurrence.toISOString(), 'declined');
  await cancelSnoozeNotification(reminder);
  await acknowledgeNativeCall(reminder.id);

  if (reminder.repeatType === 'never') {
    await cancelReminderNotifications(reminder);
    await updateReminderStatus(reminder.id, 'declined');
    return (await getReminder(reminder.id)) ?? { ...reminder, status: 'declined' };
  }

  const seriesReminder = { ...reminder, status: 'scheduled' as const, snoozedUntil: null };
  await updateReminderStatus(reminder.id, 'scheduled');
  const result = await persistSchedule(seriesReminder, settings.repeatMissedCall);
  return result.reminder;
}

export async function markMissed(
  reminder: Reminder,
  occurrence: Date,
  settings: AppSettings,
  rescheduleSeries = true,
): Promise<Reminder> {
  await addEvent(eventId(reminder.id, occurrence.toISOString(), 'missed'), reminder.id, occurrence.toISOString(), 'missed');
  await cancelSnoozeNotification(reminder);
  await acknowledgeNativeCall(reminder.id);

  if (reminder.repeatType === 'never' || !rescheduleSeries) {
    const nextStatus = reminder.repeatType === 'never' ? 'missed' : 'scheduled';
    await updateReminderStatus(reminder.id, nextStatus);
    return (await getReminder(reminder.id)) ?? { ...reminder, status: nextStatus };
  }

  const seriesReminder = { ...reminder, status: 'scheduled' as const, snoozedUntil: null };
  await updateReminderStatus(reminder.id, 'scheduled');
  const result = await persistSchedule(seriesReminder, settings.repeatMissedCall);
  return result.reminder;
}

export async function markCompleted(
  reminder: Reminder,
  occurrence: Date,
  settings: AppSettings,
): Promise<Reminder> {
  await addEvent(eventId(reminder.id, occurrence.toISOString(), 'completed'), reminder.id, occurrence.toISOString(), 'completed');
  await cancelSnoozeNotification(reminder);
  await acknowledgeNativeCall(reminder.id);

  if (reminder.repeatType === 'never') {
    await cancelReminderNotifications(reminder);
    await updateReminderStatus(reminder.id, 'completed');
    return (await getReminder(reminder.id)) ?? { ...reminder, status: 'completed' };
  }

  const seriesReminder = { ...reminder, status: 'scheduled' as const, snoozedUntil: null };
  await updateReminderStatus(reminder.id, 'scheduled');
  const result = await persistSchedule(seriesReminder, settings.repeatMissedCall);
  return result.reminder;
}

export async function snoozeReminder(
  reminder: Reminder,
  occurrence: Date,
  minutes: number,
): Promise<Reminder> {
  const snoozedUntil = new Date(Date.now() + minutes * 60_000);
  await cancelSnoozeNotification(reminder);
  const snoozeId = await scheduleSnoozeNotification(reminder, minutes, occurrence);
  await addEvent(eventId(reminder.id, occurrence.toISOString(), 'snoozed'), reminder.id, occurrence.toISOString(), 'snoozed');
  if (snoozeId) {
    await updateReminderScheduling(reminder.id, {
      notificationId: reminder.notificationId,
      notificationIds: reminder.notificationIds,
      snoozeNotificationId: snoozeId,
      alarmId: reminder.alarmId,
    });
  }
  await updateReminderStatus(reminder.id, 'snoozed', {
    snoozedUntil: snoozedUntil.toISOString(),
  });
  await acknowledgeNativeCall(reminder.id);
  return (await getReminder(reminder.id)) ?? { ...reminder, status: 'snoozed', snoozedUntil: snoozedUntil.toISOString() };
}

export async function endReminder(reminder: Reminder, occurrence: Date, settings: AppSettings): Promise<Reminder> {
  return markMissed(reminder, occurrence, settings);
}

export async function rescheduleReminder(
  reminder: Reminder,
  settings: AppSettings,
): Promise<ScheduleResult> {
  const result = await persistSchedule(reminder, settings.repeatMissedCall);
  return result.schedule;
}

/**
 * Applies persisted native action events to SQLite. Native alarms own the
 * Android schedule, so these updates intentionally do not re-schedule.
 */
export async function syncNativeEvents(): Promise<string[]> {
  const native = getRingoAlarmNative();
  if (!native) return [];
  let events;
  try {
    events = await native.consumeEvents();
  } catch {
    return [];
  }
  const changed: string[] = [];
  for (const event of events) {
    const occurrence = new Date(event.occurrenceAt);
    const reminder = await getReminder(event.reminderId);
    if (!reminder) continue;
    const iso = occurrence.toISOString();
    switch (event.type) {
      case 'fired': {
        await addEvent(eventId(reminder.id, iso, 'ringing'), reminder.id, iso, 'ringing');
        const age = Date.now() - event.occurrenceAt;
        if (age < 90 * 60_000) {
          await updateReminderStatus(reminder.id, 'ringing');
        } else {
          await addEvent(eventId(reminder.id, iso, 'missed'), reminder.id, iso, 'missed');
          await updateReminderStatus(reminder.id, reminder.repeatType === 'never' ? 'missed' : 'scheduled');
        }
        changed.push(reminder.id);
        break;
      }
      case 'accepted': {
        await addEvent(eventId(reminder.id, iso, 'answered'), reminder.id, iso, 'answered');
        await updateReminderStatus(reminder.id, 'answered');
        changed.push(reminder.id);
        break;
      }
      case 'declined': {
        await addEvent(eventId(reminder.id, iso, 'declined'), reminder.id, iso, 'declined');
        await updateReminderStatus(reminder.id, reminder.repeatType === 'never' ? 'declined' : 'scheduled');
        changed.push(reminder.id);
        break;
      }
      case 'snoozed': {
        const extra = event.extra as { snoozeMinutes?: number } | undefined;
        const minutes = Number(extra?.snoozeMinutes) || reminder.snoozeMinutes;
        await addEvent(eventId(reminder.id, iso, 'snoozed'), reminder.id, iso, 'snoozed');
        const snoozedUntil = new Date(event.timestamp + minutes * 60_000).toISOString();
        await updateReminderStatus(reminder.id, 'snoozed', { snoozedUntil });
        await updateReminderScheduling(reminder.id, {
          notificationId: reminder.notificationId,
          notificationIds: reminder.notificationIds,
          snoozeNotificationId: `native-snooze:${reminder.id}`,
          alarmId: reminder.alarmId,
        });
        changed.push(reminder.id);
        break;
      }
      case 'dismissed': {
        await addEvent(eventId(reminder.id, iso, 'dismissed'), reminder.id, iso, 'dismissed');
        await addEvent(eventId(reminder.id, iso, 'missed'), reminder.id, iso, 'missed');
        await updateReminderStatus(reminder.id, reminder.repeatType === 'never' ? 'missed' : 'scheduled');
        changed.push(reminder.id);
        break;
      }
      default:
        break;
    }
  }
  return changed;
}

/**
 * Startup maintenance: repair stale snoozes, record missed one-off reminders,
 * adapt reminders to timezone changes, and recover recurring schedules on
 * platforms that use Expo notifications.
 */
export async function runStartupMaintenance(
  reminders: Reminder[],
  settings: AppSettings,
): Promise<string[]> {
  const changed = new Set<string>();
  const now = Date.now();

  for (const reminder of reminders) {
    if (reminder.status === 'snoozed' && reminder.snoozedUntil) {
      const snoozeTime = new Date(reminder.snoozedUntil).getTime();
      if (snoozeTime + 2 * 60 * 60_000 < now) {
        await addEvent(
          eventId(reminder.id, reminder.snoozedUntil, 'missed'),
          reminder.id,
          reminder.snoozedUntil,
          'missed',
        );
        await updateReminderStatus(
          reminder.id,
          reminder.repeatType === 'never' ? 'missed' : 'scheduled',
          { snoozedUntil: null },
        );
        changed.add(reminder.id);
      }
      continue;
    }

    if (reminder.status !== 'scheduled') continue;

    if (reminder.status === 'scheduled' && reminder.repeatType === 'never') {
      const due = new Date(reminder.scheduledAt);
      if (due.getTime() + 2 * 60 * 60_000 < now) {
        const latest = await latestEventForOccurrence(reminder.id, reminder.scheduledAt);
        if (!latest || !['completed', 'answered', 'declined'].includes(latest.status)) {
          await addEvent(eventId(reminder.id, reminder.scheduledAt, 'missed'), reminder.id, reminder.scheduledAt, 'missed');
          await updateReminderStatus(reminder.id, 'missed');
          changed.add(reminder.id);
        }
      }
    }

    if (reminder.timezone !== getTimezone()) {
      const timezone = getTimezone();
      await updateReminderRow({
        ...reminder,
        timezone,
        updatedAt: new Date().toISOString(),
      });
      await persistSchedule({ ...reminder, timezone }, settings.repeatMissedCall);
      changed.add(reminder.id);
    }
  }

  // Expo's repeating triggers cannot express a delayed series start. Rebuilding
  // them on launch also repairs schedules after iOS notification limits and
  // app updates. Native Android alarms are already persistent.
  if (Platform.OS !== 'android' || !isNativeAlarmAvailable()) {
    for (const reminder of reminders) {
      if (reminder.status === 'scheduled' && reminder.repeatType !== 'never') {
        try {
          await persistSchedule(reminder, settings.repeatMissedCall);
          changed.add(reminder.id);
        } catch {
          // Never block startup because one schedule failed.
        }
      }
    }
  }

  return Array.from(changed);
}

export async function findRecentEvent(reminderId: string, occurrence: Date, status: EventStatus) {
  const events = await listEventsForReminder(reminderId);
  return events.find(
    (event) => event.occurrenceAt === occurrence.toISOString() && event.status === status,
  ) ?? null;
}

export function nextForReminder(reminder: Reminder, after = new Date()): Date | null {
  return nextOccurrence(reminder, after);
}

export function followingOccurrence(reminder: Reminder, occurrence: Date): Date | null {
  return occurrenceAfter(reminder, occurrence);
}
