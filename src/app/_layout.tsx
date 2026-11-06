import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, View } from 'react-native';
import { Stack, router, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { Toast } from '@/components/feedback/Toast';
import { Onboarding } from '@/features/onboarding/Onboarding';
import { CreateReminderSheet } from '@/features/reminders/components/CreateReminderSheet';
import { initializeNotifications } from '@/services/scheduler';
import { getDatabase } from '@/services/database';
import { getReminder } from '@/services/database/reminderRepository';
import {
  markDeclined,
  markMissed,
  runStartupMaintenance,
  snoozeReminder,
  syncNativeEvents,
} from '@/features/reminders/services/reminderService';
import { useRemindersStore } from '@/store/remindersStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useUiStore } from '@/store/uiStore';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function BootScreen() {
  return (
    <View style={bootStyles.root}>
      <ActivityIndicator color="#FF6B4A" />
    </View>
  );
}

function AppShell() {
  const { colors, isDark } = useTheme();
  const refresh = useRemindersStore((state) => state.refresh);
  const hydrateSettings = useSettingsStore((state) => state.hydrated);
  const onboardingComplete = useSettingsStore((state) => state.settings.onboardingComplete);
  const showToast = useUiStore((state) => state.showToast);
  const handledResponses = useRef<Set<string>>(new Set());
  const currentPath = usePathname();

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      try {
        await getDatabase();
        await useSettingsStore.getState().hydrate();
        await initializeNotifications();
        const store = useRemindersStore.getState();
        await store.refresh();
        const synced = await syncNativeEvents();
        if (synced.length > 0) {
          await useRemindersStore.getState().refresh();
        }
        const settings = useSettingsStore.getState().settings;
        const current = useRemindersStore.getState();
        const changed = await runStartupMaintenance(current.reminders, settings);
        if (changed.length > 0) {
          await useRemindersStore.getState().refresh();
        }
      } catch {
        // The app still renders; screens surface their own loading errors.
      } finally {
        if (!cancelled) {
          SplashScreen.hideAsync().catch(() => undefined);
        }
      }
    };
    boot();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrateSettings) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      syncNativeEvents()
        .then((changed) => {
          if (changed.length > 0) {
            refresh();
            showToast('Reminder call status updated.');
          }
        })
        .catch(() => undefined);
    });
    return () => subscription.remove();
  }, [hydrateSettings, refresh, showToast]);

  useEffect(() => {
    const received = Notifications.addNotificationReceivedListener((notification) => {
      if (AppState.currentState !== 'active') return;
      const data = notification.request.content.data ?? {};
      const reminderId = typeof data.reminderId === 'string' ? data.reminderId : null;
      if (!reminderId) return;
      const occurrenceAt = Number(data.occurrenceAt);
      const at = Number.isFinite(occurrenceAt) ? occurrenceAt : Date.now();
      if (currentPath.includes('/incoming/') || currentPath.includes('/active/')) {
        return;
      }
      router.push({
        pathname: '/incoming/[id]',
        params: { id: reminderId, at: String(at) },
      });
    });

    const response = Notifications.addNotificationResponseReceivedListener((result) => {
      const data = result.notification.request.content.data ?? {};
      const reminderId = typeof data.reminderId === 'string' ? data.reminderId : null;
      if (!reminderId) return;
      const occurrenceAt = Number(data.occurrenceAt);
      const at = Number.isFinite(occurrenceAt) ? occurrenceAt : Date.now();
      const action = result.actionIdentifier;
      const key = `${reminderId}:${action}:${at}`;
      if (handledResponses.current.has(key)) return;
      handledResponses.current.add(key);

      const openIncoming = () => {
        router.push({
          pathname: '/incoming/[id]',
          params: { id: reminderId, at: String(at) },
        });
      };

      if (action === 'ACCEPT') {
        router.push({
          pathname: '/active/[id]',
          params: { id: reminderId, at: String(at) },
        });
        return;
      }

      const runAction = async () => {
        const reminder = await getReminder(reminderId);
        if (!reminder) return;
        const occurrence = new Date(at);
        const settings = useSettingsStore.getState().settings;
        try {
          if (action === 'SNOOZE') {
            await snoozeReminder(reminder, occurrence, reminder.snoozeMinutes);
            showToast(`Snoozed for ${reminder.snoozeMinutes} minutes.`);
          } else if (action === 'DECLINE') {
            await markDeclined(reminder, occurrence, settings);
            showToast('Reminder call declined.');
          } else if (
            action === Notifications.DEFAULT_ACTION_IDENTIFIER
          ) {
            openIncoming();
            return;
          } else {
            // iOS dismissal or an unknown system action means the call was not
            // answered. Treat it honestly as missed.
            await markMissed(reminder, occurrence, settings);
            showToast('Missed reminder call recorded.');
          }
          await refresh();
        } catch {
          showToast('Could not update this reminder call.', 'error');
        }
      };
      runAction();
    });

    return () => {
      received.remove();
      response.remove();
    };
  }, [currentPath, refresh, showToast]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="incoming/[id]"
          options={{ animation: 'fade', presentation: 'fullScreenModal' }}
        />
        <Stack.Screen
          name="active/[id]"
          options={{ animation: 'fade', presentation: 'fullScreenModal' }}
        />
      </Stack>
      <Toast />
      <CreateReminderSheet />
      <Onboarding visible={hydrateSettings && !onboardingComplete} />
    </View>
  );
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // ThemeProvider reads the settings store. Hydrating before first paint
    // avoids a visible flash of the wrong theme.
    const prepare = async () => {
      try {
        await getDatabase();
        await useSettingsStore.getState().hydrate();
      } catch {
        // Render anyway; individual screens handle failures.
      } finally {
        setReady(true);
      }
    };
    prepare();
  }, []);

  if (!ready) return <BootScreen />;

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppShell />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  gestureRoot: {
    flex: 1,
  },
});

const bootStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0B0C0E',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
