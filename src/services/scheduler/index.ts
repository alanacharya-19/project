import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { REMINDER_CATEGORY, REMINDER_CHANNEL } from '@/constants/config';
import type { Reminder, RingtoneId, ScheduleResult } from '@/types/reminder';
import { nextOccurrence, occurrenceAfter } from '@/utils/recurrence';
import {
  buildNativePayload,
  getRingoAlarmNative,
} from '@/services/native/ringoAlarm';

const CHANNELS: Record<RingtoneId, string> = {
  default: REMINDER_CHANNEL,
  alarm: 'ringo-call-alarm',
  ringtone: 'ringo-call-ringtone',
  silent: 'ringo-call-silent',
};

export function reminderChannelId(ringtone: RingtoneId): string {
  return CHANNELS[ringtone] ?? REMINDER_CHANNEL;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
    priority: Notifications.AndroidNotificationPriority.MAX,
  }),
});

export async function initializeNotifications(): Promise<void> {
  try {
    await Notifications.setNotificationCategoryAsync(
      REMINDER_CATEGORY,
      [
        {
          identifier: 'ACCEPT',
          buttonTitle: 'Accept',
          options: { opensAppToForeground: true, isDestructive: false },
        },
        {
          identifier: 'SNOOZE',
          buttonTitle: 'Snooze 10 min',
          options: { opensAppToForeground: true, isDestructive: false },
        },
        {
          identifier: 'DECLINE',
          buttonTitle: 'Decline',
          options: { opensAppToForeground: true, isDestructive: true },
        },
      ],
      {
        showTitle: true,
        customDismissAction: true,
        categorySummaryFormat: '%@ — RINGO reminder',
      },
    );
  } catch {
    // Categories are best-effort; the core notification still works.
  }

  if (Platform.OS === 'android') {
    for (const [ringtone, channelId] of Object.entries(CHANNELS)) {
      try {
        await Notifications.setNotificationChannelAsync(channelId, {
          name:
            ringtone === 'silent'
              ? 'RINGO silent calls'
              : `RINGO calls · ${ringtone}`,
          description: 'Incoming reminder alerts from RINGO',
          importance: Notifications.AndroidImportance.MAX,
          sound: ringtone === 'silent' ? null : 'default',
          vibrationPattern: ringtone === 'silent' ? null : [0, 350, 250, 350],
          enableVibrate: ringtone !== 'silent',
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          bypassDnd: false,
          showBadge: false,
          audioAttributes: {
            usage: Notifications.AndroidAudioUsage.ALARM,
            contentType: Notifications.AndroidAudioContentType.SONIFICATION,
          },
        });
      } catch {
        // Channel creation is best-effort.
      }
    }
  }
}

function contentFor(reminder: Reminder, occurrence: Date, snooze = false) {
  return {
    title: 'RINGO',
    subtitle: reminder.title,
    body: reminder.message,
    sound: reminder.ringtone === 'silent' ? (false as const) : ('defaultRingtone' as const),
    categoryIdentifier: REMINDER_CATEGORY,
    threadIdentifier: `ringo-${reminder.id}`,
    data: {
      reminderId: reminder.id,
      occurrenceAt: occurrence.getTime(),
      scheduledAt: reminder.scheduledAt,
      snooze: snooze,
      priority: reminder.priority,
      route: snooze ? 'incoming' : 'incoming',
    },
    priority: Notifications.AndroidNotificationPriority.MAX,
  };
}

function weeklyTriggers(reminder: Reminder, occurrence: Date, channelId: string | undefined) {
  const hour = occurrence.getHours();
  const minute = occurrence.getMinutes();
  const delivery = Platform.OS === 'android' ? ('alarmClock' as const) : undefined;
  const anchor = new Date(reminder.scheduledAt);
  const days =
    reminder.repeatType === 'custom' && reminder.repeatDays.length
      ? reminder.repeatDays
      : reminder.repeatType === 'weekdays'
        ? [1, 2, 3, 4, 5]
        : reminder.repeatType === 'weekends'
          ? [0, 6]
          : [anchor.getDay()];

  return days.map((day) => ({
    type: 'weekly' as const,
    weekday: day + 1, // expo uses 1 = Sunday
    hour,
    minute,
    channelId,
    delivery,
  }));
}

/**
 * The next time the recurrence rule would fire if it were already repeating.
 * Used to detect a start date that is later than the next repeating slot.
 */
function earliestRepeatSlot(reminder: Reminder, now: Date): Date | null {
  if (reminder.repeatType === 'never') return null;
  const anchor = new Date(reminder.scheduledAt);
  const hour = anchor.getHours();
  const minute = anchor.getMinutes();
  const candidate = new Date(now);
  candidate.setHours(hour, minute, 0, 0);
  if (candidate.getTime() <= now.getTime()) candidate.setDate(candidate.getDate() + 1);

  if (reminder.repeatType === 'daily') {
    return candidate;
  }
  if (
    reminder.repeatType === 'weekdays' ||
    reminder.repeatType === 'weekends' ||
    reminder.repeatType === 'weekly' ||
    reminder.repeatType === 'custom'
  ) {
    const days =
      reminder.repeatType === 'custom' && reminder.repeatDays.length
        ? reminder.repeatDays
        : reminder.repeatType === 'weekdays'
          ? [1, 2, 3, 4, 5]
          : reminder.repeatType === 'weekends'
            ? [0, 6]
            : [anchor.getDay()];
    for (let i = 0; i < 14; i += 1) {
      if (days.includes(candidate.getDay())) return candidate;
      candidate.setDate(candidate.getDate() + 1);
    }
    return null;
  }
  if (reminder.repeatType === 'monthly') {
    const day = anchor.getDate();
    const monthlyCandidate = new Date(now.getFullYear(), now.getMonth(), Math.min(day, 28), hour, minute, 0, 0);
    const lastDay = new Date(monthlyCandidate.getFullYear(), monthlyCandidate.getMonth() + 1, 0).getDate();
    monthlyCandidate.setDate(Math.min(day, lastDay));
    if (monthlyCandidate.getTime() <= now.getTime()) {
      monthlyCandidate.setMonth(monthlyCandidate.getMonth() + 1, 1);
      const nextLast = new Date(monthlyCandidate.getFullYear(), monthlyCandidate.getMonth() + 1, 0).getDate();
      monthlyCandidate.setDate(Math.min(day, nextLast));
    }
    return monthlyCandidate;
  }
  return null;
}

function buildTriggers(reminder: Reminder, firstOccurrence: Date) {
  const channelId = Platform.OS === 'android' ? reminderChannelId(reminder.ringtone) : undefined;
  const androidChannel = channelId ? { channelId } : {};
  const delivery = Platform.OS === 'android' ? { delivery: 'alarmClock' as const } : {};
  const hour = firstOccurrence.getHours();
  const minute = firstOccurrence.getMinutes();

  if (reminder.repeatType === 'never') {
    return [
      {
        type: 'date' as const,
        date: firstOccurrence,
        ...androidChannel,
        ...delivery,
      },
    ];
  }

  // iOS / Expo fallback cannot express "repeat beginning on a future date".
  // If the chosen start is later than the next recurring slot, schedule the
  // first call and let the series start when the occurrence is handled.
  const slot = earliestRepeatSlot(reminder, new Date());
  if (slot && slot.getTime() < firstOccurrence.getTime() - 60_000) {
    return [
      {
        type: 'date' as const,
        date: firstOccurrence,
        ...androidChannel,
        ...delivery,
      },
    ];
  }

  if (reminder.repeatType === 'daily') {
    return [
      {
        type: 'daily' as const,
        hour,
        minute,
        ...androidChannel,
        ...delivery,
      },
    ];
  }
  if (reminder.repeatType === 'monthly') {
    return [
      {
        type: 'monthly' as const,
        day: new Date(reminder.scheduledAt).getDate(),
        hour,
        minute,
        ...androidChannel,
        ...delivery,
      },
    ];
  }
  return weeklyTriggers(reminder, firstOccurrence, channelId);
}

async function scheduleWithExpo(reminder: Reminder, occurrence: Date): Promise<ScheduleResult> {
  const triggers = buildTriggers(reminder, occurrence);
  const identifiers: string[] = [];
  let failed = 0;
  for (let i = 0; i < triggers.length; i += 1) {
    try {
      const identifier = await Notifications.scheduleNotificationAsync({
        content: contentFor(reminder, occurrence),
        trigger: triggers[i] as Notifications.NotificationTriggerInput,
      });
      identifiers.push(identifier);
    } catch {
      failed += 1;
    }
  }
  const warnings: string[] = [];
  if (failed > 0) {
    warnings.push(
      failed === triggers.length
        ? 'RINGO saved this reminder but the system scheduler rejected it. Reopen RINGO to retry.'
        : 'RINGO could not register every call with the system scheduler. Reopen RINGO to retry.',
    );
  }
  if (Platform.OS === 'android') {
    warnings.push(
      'Full-screen call UI requires the RINGO development build. Alerts will still arrive in the notification shade.',
    );
  }
  return {
    identifiers,
    exact: Platform.OS !== 'android' || (await safeExactPermission()),
    fullScreen: false,
    warning: warnings.length ? warnings.join(' ') : undefined,
  };
}

async function safeExactPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const status = await Notifications.getExactAlarmPermissionsAsync();
    return status.granted;
  } catch {
    return false;
  }
}

export async function scheduleReminderNotifications(
  reminder: Reminder,
  repeatMissedCall = false,
): Promise<ScheduleResult> {
  if (['completed', 'declined', 'cancelled', 'ringing', 'answered'].includes(reminder.status)) {
    return { identifiers: [], exact: true, fullScreen: false };
  }
  const now = new Date();
  const occurrence = nextOccurrence(reminder, new Date(now.getTime() + 1000));
  if (!occurrence) {
    return { identifiers: [], exact: true, fullScreen: false, warning: 'No future occurrence.' };
  }

  await cancelReminderNotifications(reminder);

  const native = getRingoAlarmNative();
  if (Platform.OS === 'android' && native) {
    try {
      const caps = await native.scheduleAlarm(buildNativePayload(reminder, occurrence, repeatMissedCall));
      const warnings: string[] = [];
      if (caps?.exactAlarms === false) warnings.push('Exact alarms are not allowed; the call may be delayed.');
      if (caps?.fullScreenIntent === false) warnings.push('Full-screen calls are not allowed; a heads-up alert will be used.');
      return {
        identifiers: [`native:${reminder.id}`],
        exact: caps?.exactAlarms ?? false,
        fullScreen: caps?.fullScreenIntent ?? false,
        warning: warnings.length ? warnings.join(' ') : undefined,
      };
    } catch (error) {
      // Fall through to Expo Notifications rather than losing the reminder.
      const fallback = await scheduleWithExpo(reminder, occurrence);
      return {
        ...fallback,
        warning: `Native alarm failed (${error instanceof Error ? error.message : 'unknown error'}). Using notification fallback.`,
      };
    }
  }

  return scheduleWithExpo(reminder, occurrence);
}

export async function cancelReminderNotifications(reminder: Reminder): Promise<void> {
  const native = getRingoAlarmNative();
  if (Platform.OS === 'android' && native) {
    try {
      await native.cancelAlarm(reminder.id);
    } catch {
      // Continue with expo cleanup so no duplicate remains.
    }
  }
  await Promise.all(
    reminder.notificationIds.map(async (identifier) => {
      try {
        await Notifications.cancelScheduledNotificationAsync(identifier);
      } catch {
        // Already delivered or removed.
      }
    }),
  );
  if (reminder.notificationId && !reminder.notificationIds.includes(reminder.notificationId)) {
    try {
      await Notifications.cancelScheduledNotificationAsync(reminder.notificationId);
    } catch {
      // no-op
    }
  }
}

export async function cancelReminderById(reminderId: string, identifiers: string[] = []): Promise<void> {
  const native = getRingoAlarmNative();
  if (Platform.OS === 'android' && native) {
    try {
      await native.cancelAlarm(reminderId);
    } catch {
      // no-op
    }
  }
  await Promise.all(
    identifiers.map(async (identifier) => {
      try {
        await Notifications.cancelScheduledNotificationAsync(identifier);
      } catch {
        // no-op
      }
    }),
  );
}

export async function scheduleSnoozeNotification(
  reminder: Reminder,
  minutes: number,
  occurrence: Date,
): Promise<string | null> {
  if (reminder.snoozeNotificationId) {
    try {
      await Notifications.cancelScheduledNotificationAsync(reminder.snoozeNotificationId);
    } catch {
      // no-op
    }
  }
  const native = getRingoAlarmNative();
  if (Platform.OS === 'android' && native) {
    try {
      await native.scheduleSnooze(buildNativePayload(reminder, occurrence), minutes);
      return `native-snooze:${reminder.id}`;
    } catch {
      // fall through to local notification
    }
  }
  try {
    const fireAt = new Date(Date.now() + minutes * 60_000);
    return await Notifications.scheduleNotificationAsync({
      content: contentFor(reminder, occurrence, true),
      trigger: {
        type: 'date',
        date: fireAt,
        channelId:
          Platform.OS === 'android' ? reminderChannelId(reminder.ringtone) : undefined,
      } as Notifications.NotificationTriggerInput,
    });
  } catch {
    return null;
  }
}

export async function cancelSnoozeNotification(reminder: Reminder): Promise<void> {
  const native = getRingoAlarmNative();
  if (Platform.OS === 'android' && native) {
    try {
      await native.cancelSnooze(reminder.id);
    } catch {
      // no-op
    }
  }
  if (reminder.snoozeNotificationId?.startsWith('native-')) return;
  if (reminder.snoozeNotificationId) {
    try {
      await Notifications.cancelScheduledNotificationAsync(reminder.snoozeNotificationId);
    } catch {
      // no-op
    }
  }
}

export async function acknowledgeNativeCall(reminderId: string): Promise<void> {
  const native = getRingoAlarmNative();
  if (!native) return;
  try {
    await native.acknowledgeOccurrence(reminderId);
    await native.dismissNotification(reminderId);
  } catch {
    // no-op
  }
}

export function getNextRecurrencePreview(reminder: Reminder, after: Date): Date | null {
  return nextOccurrence(reminder, after);
}

export function getOccurrenceAfter(reminder: Reminder, occurrence: Date): Date | null {
  return occurrenceAfter(reminder, occurrence);
}
