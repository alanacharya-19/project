import { Platform } from 'react-native';
import type { RingtoneId, RepeatType } from '@/types/reminder';

export const APP_NAME = 'RINGO';
export const APP_SCHEME = 'ringo';
export const APP_VERSION = '1.0.0';
export const REMINDER_CATEGORY = 'RINGO_REMINDER_CALL';
export const REMINDER_CHANNEL = 'ringo-reminder-calls';
export const INCOMING_ROUTE = '/incoming';
export const ACTIVE_ROUTE = '/active';

export const ANDROID_PACKAGE = 'app.ringo.reminder';
export const IOS_BUNDLE_ID = 'app.ringo.reminder';

export const REPEAT_LABELS: Record<RepeatType, string> = {
  never: 'Once',
  daily: 'Every day',
  weekdays: 'Weekdays',
  weekends: 'Weekends',
  weekly: 'Every week',
  monthly: 'Every month',
  custom: 'Custom days',
};

export const PRIORITY_LABELS = {
  normal: 'Normal',
  important: 'Important',
  urgent: 'Urgent',
} as const;

export const RINGTONE_LABELS: Record<RingtoneId, string> = {
  default: 'Call tone',
  alarm: 'Alarm',
  ringtone: 'Ringtone',
  silent: 'Silent',
};

export const WEEKDAY_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export const WEEKDAY_FULL = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
/** Monday-first labels used by the calendar. */
export const CALENDAR_WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

export const SNOOZE_OPTIONS = [5, 10, 15, 30];
export const SPEECH_RATE_RANGE = { min: 0.6, max: 1.4, step: 0.05 };
export const SPEECH_PITCH_RANGE = { min: 0.7, max: 1.4, step: 0.05 };

export const IS_ANDROID = Platform.OS === 'android';
export const IS_IOS = Platform.OS === 'ios';
export const IS_WEB = Platform.OS === 'web';
