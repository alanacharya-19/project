import type { Priority, RingtoneId } from '@/types/reminder';
import type { ThemeMode as ThemePreference } from '@/theme/tokens';

export interface AppSettings {
  name: string;
  onboardingComplete: boolean;
  themePreference: ThemePreference;
  voiceId: string | null;
  voiceName: string | null;
  voiceLanguage: string | null;
  speechRate: number;
  speechPitch: number;
  ringtone: RingtoneId;
  snoozeMinutes: number;
  repeatMissedCall: boolean;
  defaultPriority: Priority;
  seededDemo: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  name: '',
  onboardingComplete: false,
  themePreference: 'system',
  voiceId: null,
  voiceName: null,
  voiceLanguage: null,
  speechRate: 1,
  speechPitch: 1,
  ringtone: 'default',
  snoozeMinutes: 10,
  repeatMissedCall: false,
  defaultPriority: 'normal',
  seededDemo: false,
};

export type { ThemePreference };
