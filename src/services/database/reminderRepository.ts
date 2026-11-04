import { getDatabase } from './index';
import type {
  EventStatus,
  Reminder,
  ReminderEvent,
  ReminderStatus,
} from '@/types/reminder';

type ReminderRow = {
  id: string;
  title: string;
  message: string;
  scheduled_at: string;
  timezone: string;
  repeat_type: Reminder['repeatType'];
  repeat_days: string;
  priority: Reminder['priority'];
  voice_id: string | null;
  voice_name: string | null;
  speech_rate: number;
  speech_pitch: number;
  snooze_minutes: number;
  ringtone: Reminder['ringtone'];
  notification_id: string | null;
  notification_ids: string;
  snooze_notification_id: string | null;
  alarm_id: string | null;
  status: ReminderStatus;
  snoozed_until: string | null;
  created_at: string;
  updated_at: string;
};

type EventRow = {
  id: string;
  reminder_id: string;
  occurrence_at: string;
  status: EventStatus;
  created_at: string;
};

function parseDays(value: string): number[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6) : [];
  } catch {
    return [];
  }
}

function parseIds(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function mapReminder(row: ReminderRow): Reminder {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    scheduledAt: row.scheduled_at,
    timezone: row.timezone,
    repeatType: row.repeat_type,
    repeatDays: parseDays(row.repeat_days),
    priority: row.priority,
    voiceId: row.voice_id,
    voiceName: row.voice_name,
    speechRate: row.speech_rate,
    speechPitch: row.speech_pitch,
    snoozeMinutes: row.snooze_minutes,
    ringtone: row.ringtone,
    notificationId: row.notification_id,
    notificationIds: parseIds(row.notification_ids),
    snoozeNotificationId: row.snooze_notification_id,
    alarmId: row.alarm_id,
    status: row.status,
    snoozedUntil: row.snoozed_until,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEvent(row: EventRow): ReminderEvent {
  return {
    id: row.id,
    reminderId: row.reminder_id,
    occurrenceAt: row.occurrence_at,
    status: row.status,
    createdAt: row.created_at,
  };
}

export async function listReminders(): Promise<Reminder[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<ReminderRow>(
    `SELECT * FROM reminders ORDER BY scheduled_at ASC`,
  );
  return rows.map(mapReminder);
}

export async function getReminder(id: string): Promise<Reminder | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<ReminderRow>('SELECT * FROM reminders WHERE id = ?', id);
  return row ? mapReminder(row) : null;
}

export async function findDuplicate(
  title: string,
  scheduledAt: string,
  repeatType: string,
  excludeId?: string,
): Promise<Reminder | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<ReminderRow>(
    `SELECT * FROM reminders
     WHERE lower(trim(title)) = lower(trim(?)) AND scheduled_at = ? AND repeat_type = ?
       AND status IN ('scheduled','snoozed','ringing','answered') AND id != ?
     LIMIT 1`,
    title,
    scheduledAt,
    repeatType,
    excludeId ?? '',
  );
  return row ? mapReminder(row) : null;
}

export async function insertReminder(reminder: Reminder): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO reminders (
      id, title, message, scheduled_at, timezone, repeat_type, repeat_days, priority,
      voice_id, voice_name, speech_rate, speech_pitch, snooze_minutes, ringtone,
      notification_id, notification_ids, snooze_notification_id, alarm_id, status,
      snoozed_until, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    reminder.id,
    reminder.title.trim(),
    reminder.message.trim(),
    reminder.scheduledAt,
    reminder.timezone,
    reminder.repeatType,
    JSON.stringify(reminder.repeatDays),
    reminder.priority,
    reminder.voiceId,
    reminder.voiceName,
    reminder.speechRate,
    reminder.speechPitch,
    reminder.snoozeMinutes,
    reminder.ringtone,
    reminder.notificationId,
    JSON.stringify(reminder.notificationIds),
    reminder.snoozeNotificationId,
    reminder.alarmId,
    reminder.status,
    reminder.snoozedUntil,
    reminder.createdAt,
    reminder.updatedAt,
  );
}

export async function updateReminder(reminder: Reminder): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE reminders SET
      title = ?, message = ?, scheduled_at = ?, timezone = ?, repeat_type = ?, repeat_days = ?,
      priority = ?, voice_id = ?, voice_name = ?, speech_rate = ?, speech_pitch = ?,
      snooze_minutes = ?, ringtone = ?, notification_id = ?, notification_ids = ?,
      snooze_notification_id = ?, alarm_id = ?, status = ?, snoozed_until = ?, updated_at = ?
     WHERE id = ?`,
    reminder.title.trim(),
    reminder.message.trim(),
    reminder.scheduledAt,
    reminder.timezone,
    reminder.repeatType,
    JSON.stringify(reminder.repeatDays),
    reminder.priority,
    reminder.voiceId,
    reminder.voiceName,
    reminder.speechRate,
    reminder.speechPitch,
    reminder.snoozeMinutes,
    reminder.ringtone,
    reminder.notificationId,
    JSON.stringify(reminder.notificationIds),
    reminder.snoozeNotificationId,
    reminder.alarmId,
    reminder.status,
    reminder.snoozedUntil,
    reminder.updatedAt,
    reminder.id,
  );
}

export async function updateReminderStatus(
  id: string,
  status: ReminderStatus,
  options: { snoozedUntil?: string | null; updatedAt?: string } = {},
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE reminders SET status = ?, snoozed_until = ?, updated_at = ? WHERE id = ?',
    status,
    options.snoozedUntil ?? null,
    options.updatedAt ?? new Date().toISOString(),
    id,
  );
}

export async function updateReminderScheduling(
  id: string,
  data: {
    notificationId: string | null;
    notificationIds: string[];
    snoozeNotificationId?: string | null;
    alarmId?: string | null;
  },
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE reminders SET notification_id = ?, notification_ids = ?, snooze_notification_id = ?, alarm_id = ?, updated_at = ?
     WHERE id = ?`,
    data.notificationId,
    JSON.stringify(data.notificationIds),
    data.snoozeNotificationId ?? null,
    data.alarmId ?? null,
    new Date().toISOString(),
    id,
  );
}

export async function deleteReminder(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM reminders WHERE id = ?', id);
}

export async function addEvent(
  id: string,
  reminderId: string,
  occurrenceAt: string,
  status: EventStatus,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR IGNORE INTO reminder_events (id, reminder_id, occurrence_at, status, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    id,
    reminderId,
    occurrenceAt,
    status,
    new Date().toISOString(),
  );
}

export async function listRecentEvents(limit = 120): Promise<ReminderEvent[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<EventRow>(
    'SELECT * FROM reminder_events ORDER BY occurrence_at DESC LIMIT ?',
    limit,
  );
  return rows.map(mapEvent);
}

export async function listEventsBetween(start: Date, end: Date): Promise<ReminderEvent[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<EventRow>(
    'SELECT * FROM reminder_events WHERE occurrence_at >= ? AND occurrence_at <= ? ORDER BY occurrence_at ASC',
    start.toISOString(),
    end.toISOString(),
  );
  return rows.map(mapEvent);
}

export async function listEventsForReminder(reminderId: string): Promise<ReminderEvent[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<EventRow>(
    'SELECT * FROM reminder_events WHERE reminder_id = ? ORDER BY occurrence_at DESC',
    reminderId,
  );
  return rows.map(mapEvent);
}

export async function latestEventForOccurrence(
  reminderId: string,
  occurrenceAt: string,
): Promise<ReminderEvent | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<EventRow>(
    `SELECT * FROM reminder_events WHERE reminder_id = ? AND occurrence_at = ?
     ORDER BY created_at DESC LIMIT 1`,
    reminderId,
    occurrenceAt,
  );
  return row ? mapEvent(row) : null;
}
