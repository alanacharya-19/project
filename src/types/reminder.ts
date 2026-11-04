export type RepeatType =
  | 'never'
  | 'daily'
  | 'weekdays'
  | 'weekends'
  | 'weekly'
  | 'monthly'
  | 'custom';

export type Priority = 'normal' | 'important' | 'urgent';

export type ReminderStatus =
  | 'scheduled'
  | 'ringing'
  | 'answered'
  | 'snoozed'
  | 'completed'
  | 'missed'
  | 'declined'
  | 'cancelled';

export type RingtoneId = 'default' | 'alarm' | 'ringtone' | 'silent';

export type EventStatus =
  | 'ringing'
  | 'answered'
  | 'snoozed'
  | 'completed'
  | 'missed'
  | 'declined'
  | 'dismissed';

export interface Reminder {
  id: string;
  title: string;
  message: string;
  /** ISO timestamp of the first / only occurrence. */
  scheduledAt: string;
  timezone: string;
  repeatType: RepeatType;
  /** 0 = Sunday … 6 = Saturday. */
  repeatDays: number[];
  priority: Priority;
  voiceId: string | null;
  voiceName: string | null;
  speechRate: number;
  speechPitch: number;
  snoozeMinutes: number;
  ringtone: RingtoneId;
  notificationId: string | null;
  notificationIds: string[];
  snoozeNotificationId: string | null;
  alarmId: string | null;
  status: ReminderStatus;
  snoozedUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReminderEvent {
  id: string;
  reminderId: string;
  occurrenceAt: string;
  status: EventStatus;
  createdAt: string;
}

export interface ReminderDraft {
  title: string;
  message: string;
  scheduledAt: string;
  repeatType: RepeatType;
  repeatDays: number[];
  priority: Priority;
  voiceId: string | null;
  voiceName: string | null;
  speechRate: number;
  speechPitch: number;
  snoozeMinutes: number;
  ringtone: RingtoneId;
}

export interface ScheduleCapabilities {
  platform: 'android' | 'ios' | 'web';
  nativeAndroid: boolean;
  exactAlarms: boolean;
  fullScreenIntent: boolean;
  notificationsEnabled: boolean;
  batteryOptimized: boolean;
  doNotDisturb: boolean;
  missingConfiguration: string[];
}

export interface ScheduleResult {
  identifiers: string[];
  exact: boolean;
  fullScreen: boolean;
  warning?: string;
}
