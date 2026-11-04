import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import type { Reminder, ScheduleCapabilities } from '@/types/reminder';

interface NativeAlarmPayload {
  [key: string]: unknown;
}

interface NativeCapabilities {
  nativeAndroid?: boolean;
  exactAlarms?: boolean;
  fullScreenIntent?: boolean;
  notificationsEnabled?: boolean;
  batteryOptimized?: boolean;
  doNotDisturb?: boolean;
}

interface NativeEvent {
  type: string;
  reminderId: string;
  occurrenceAt: number;
  timestamp: number;
  extra?: Record<string, unknown> | null;
}

interface RingoAlarmNativeModule {
  scheduleAlarm(payload: NativeAlarmPayload): Promise<NativeCapabilities>;
  scheduleSnooze(payload: NativeAlarmPayload, minutes: number): Promise<NativeCapabilities>;
  cancelAlarm(reminderId: string): Promise<void>;
  cancelSnooze(reminderId: string): Promise<void>;
  acknowledgeOccurrence(reminderId: string): Promise<void>;
  dismissNotification(reminderId: string): Promise<void>;
  consumeEvents(): Promise<NativeEvent[]>;
  getCapabilities(): Promise<NativeCapabilities>;
  openExactAlarmSettings(): Promise<void>;
  openFullScreenIntentSettings(): Promise<void>;
  openNotificationSettings(): Promise<void>;
  openBatteryOptimizationSettings(): Promise<void>;
}

let cached: RingoAlarmNativeModule | null | undefined;

export function getRingoAlarmNative(): RingoAlarmNativeModule | null {
  if (Platform.OS !== 'android') return null;
  if (cached !== undefined) return cached;
  try {
    cached = requireOptionalNativeModule<RingoAlarmNativeModule>('RingoAlarm');
  } catch {
    cached = null;
  }
  return cached;
}

export function isNativeAlarmAvailable(): boolean {
  return getRingoAlarmNative() !== null;
}

export function buildNativePayload(
  reminder: Reminder,
  occurrence: Date,
  repeatMissedCall = false,
) {
  return {
    id: reminder.id,
    title: reminder.title,
    message: reminder.message,
    occurrenceAt: occurrence.getTime(),
    repeatType: reminder.repeatType,
    repeatDays: reminder.repeatDays,
    anchorDay: new Date(reminder.scheduledAt).getDate(),
    hour: occurrence.getHours(),
    minute: occurrence.getMinutes(),
    priority: reminder.priority,
    ringtone: reminder.ringtone,
    snoozeMinutes: reminder.snoozeMinutes,
    repeatMissedCall,
    timezone: reminder.timezone,
  };
}

export function mapNativeCapabilities(
  caps: NativeCapabilities | null,
  fallback: Partial<ScheduleCapabilities>,
): ScheduleCapabilities {
  const native = caps?.nativeAndroid === true;
  return {
    platform: Platform.OS === 'android' ? 'android' : Platform.OS === 'ios' ? 'ios' : 'web',
    nativeAndroid: native,
    exactAlarms: caps?.exactAlarms ?? fallback.exactAlarms ?? true,
    fullScreenIntent: caps?.fullScreenIntent ?? false,
    notificationsEnabled: caps?.notificationsEnabled ?? fallback.notificationsEnabled ?? false,
    batteryOptimized: caps?.batteryOptimized ?? fallback.batteryOptimized ?? false,
    doNotDisturb: caps?.doNotDisturb ?? false,
    missingConfiguration: [],
  };
}

export type { NativeEvent, RingoAlarmNativeModule };
