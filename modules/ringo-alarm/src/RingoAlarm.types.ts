export interface NativeAlarmCapabilities {
  nativeAndroid?: boolean;
  exactAlarms?: boolean;
  fullScreenIntent?: boolean;
  notificationsEnabled?: boolean;
  batteryOptimized?: boolean;
  doNotDisturb?: boolean;
}

export interface NativeAlarmEvent {
  type: string;
  reminderId: string;
  occurrenceAt: number;
  timestamp: number;
  extra?: Record<string, unknown> | null;
}

export interface RingoAlarmNativeModule {
  scheduleAlarm(payload: Record<string, unknown>): Promise<NativeAlarmCapabilities>;
  scheduleSnooze(
    payload: Record<string, unknown>,
    minutes: number,
  ): Promise<NativeAlarmCapabilities>;
  cancelAlarm(reminderId: string): Promise<void>;
  cancelSnooze(reminderId: string): Promise<void>;
  acknowledgeOccurrence(reminderId: string): Promise<void>;
  dismissNotification(reminderId: string): Promise<void>;
  consumeEvents(): Promise<NativeAlarmEvent[]>;
  getCapabilities(): Promise<NativeAlarmCapabilities>;
  openExactAlarmSettings(): Promise<void>;
  openFullScreenIntentSettings(): Promise<void>;
  openNotificationSettings(): Promise<void>;
  openBatteryOptimizationSettings(): Promise<void>;
}
