import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';
import type { ScheduleCapabilities } from '@/types/reminder';
import {
  getRingoAlarmNative,
  mapNativeCapabilities,
} from '@/services/native/ringoAlarm';

export async function notificationPermissionGranted(): Promise<boolean> {
  try {
    const status = await Notifications.getPermissionsAsync();
    return status.granted ||
      status.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL ||
      status.ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED;
  } catch {
    return false;
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const existing = await Notifications.getPermissionsAsync();
    if (existing.granted) return true;
    const status = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
        allowProvisional: false,
      },
    });
    return status.granted || status.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  } catch {
    return false;
  }
}

export async function readCapabilities(): Promise<ScheduleCapabilities> {
  const notificationsEnabled = await notificationPermissionGranted();
  if (Platform.OS === 'android') {
    const native = getRingoAlarmNative();
    if (native) {
      try {
        const caps = await native.getCapabilities();
        const snapshot = mapNativeCapabilities(caps, { notificationsEnabled });
        return {
          ...snapshot,
          notificationsEnabled,
          missingConfiguration: describeMissing(snapshot),
        };
      } catch {
        // fall through
      }
    }
    let exact = true;
    try {
      exact = (await Notifications.getExactAlarmPermissionsAsync()).granted;
    } catch {
      exact = false;
    }
    const snapshot = mapNativeCapabilities(null, {
      notificationsEnabled,
      exactAlarms: exact,
      batteryOptimized: false,
      fullScreenIntent: false,
    });
    return {
      ...snapshot,
      notificationsEnabled,
      missingConfiguration: describeMissing(snapshot),
    };
  }

  if (Platform.OS === 'ios') {
    const snapshot = mapNativeCapabilities(null, {
      notificationsEnabled,
      exactAlarms: true,
      fullScreenIntent: false,
      batteryOptimized: false,
    });
    return {
      ...snapshot,
      missingConfiguration: notificationsEnabled
        ? []
        : ['Notifications are off. RINGO cannot alert you until they are enabled in iOS Settings.'],
    };
  }

  return mapNativeCapabilities(null, {
    notificationsEnabled: false,
    exactAlarms: false,
    fullScreenIntent: false,
    batteryOptimized: false,
  });
}

function describeMissing(caps: ScheduleCapabilities): string[] {
  const messages: string[] = [];
  if (!caps.notificationsEnabled) {
    messages.push('Notification permission is off. Reminder calls cannot be shown.');
  }
  if (Platform.OS === 'android' && !caps.exactAlarms) {
    messages.push('Exact alarm access is off. Android may deliver the call late.');
  }
  if (Platform.OS === 'android' && caps.nativeAndroid && !caps.fullScreenIntent) {
    messages.push('Full-screen call access is off. Android will show a high-priority alert instead.');
  }
  if (Platform.OS === 'android' && !caps.nativeAndroid) {
    messages.push('This build uses notification alerts only. Full-screen calls need the RINGO development build.');
  }
  if (Platform.OS === 'android' && caps.batteryOptimized) {
    messages.push('Battery optimization is on. Some phones delay alarms while the app is in the background.');
  }
  if (Platform.OS === 'android' && caps.doNotDisturb) {
    messages.push('Do Not Disturb is on. System sound may be muted even though the call is delivered.');
  }
  return messages;
}

export async function openNotificationSettings(): Promise<void> {
  if (Platform.OS === 'android') {
    const native = getRingoAlarmNative();
    if (native) {
      try {
        await native.openNotificationSettings();
        return;
      } catch {
        // fall through
      }
    }
  }
  await Linking.openSettings();
}

export async function openExactAlarmSettings(): Promise<void> {
  if (Platform.OS !== 'android') {
    await Linking.openSettings();
    return;
  }
  const native = getRingoAlarmNative();
  if (native) {
    try {
      await native.openExactAlarmSettings();
      return;
    } catch {
      // fall through
    }
  }
  try {
    await Notifications.requestExactAlarmPermissionsAsync();
  } catch {
    await Linking.openSettings();
  }
}

export async function openFullScreenIntentSettings(): Promise<void> {
  if (Platform.OS !== 'android') {
    await Linking.openSettings();
    return;
  }
  const native = getRingoAlarmNative();
  if (native) {
    try {
      await native.openFullScreenIntentSettings();
      return;
    } catch {
      // fall through
    }
  }
  await Linking.openSettings();
}

export async function openBatteryOptimizationSettings(): Promise<void> {
  if (Platform.OS !== 'android') {
    await Linking.openSettings();
    return;
  }
  const native = getRingoAlarmNative();
  if (native) {
    try {
      await native.openBatteryOptimizationSettings();
      return;
    } catch {
      // fall through
    }
  }
  await Linking.openSettings();
}
