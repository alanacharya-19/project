import { create } from 'zustand';
import type { Reminder, ReminderEvent, ReminderStatus } from '@/types/reminder';
import { listRecentEvents, listReminders } from '@/services/database/reminderRepository';
import { useSettingsStore } from './settingsStore';

interface RemindersState {
  reminders: Reminder[];
  events: ReminderEvent[];
  loading: boolean;
  initialized: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  initialize: () => Promise<void>;
  upsertLocal: (reminder: Reminder) => void;
  removeLocal: (id: string) => void;
  setStatusLocal: (id: string, status: ReminderStatus, snoozedUntil?: string | null) => void;
  getById: (id: string) => Reminder | undefined;
}

export const useRemindersStore = create<RemindersState>((set, get) => ({
  reminders: [],
  events: [],
  loading: false,
  initialized: false,
  error: null,
  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const [reminders, events] = await Promise.all([listReminders(), listRecentEvents(150)]);
      set({ reminders, events, loading: false, initialized: true });
    } catch (error) {
      set({
        loading: false,
        initialized: true,
        error: error instanceof Error ? error.message : 'Could not load reminders.',
      });
    }
  },
  initialize: async () => {
    if (get().initialized) return;
    const settings = useSettingsStore.getState().settings;
    void settings;
    await get().refresh();
  },
  upsertLocal: (reminder) => {
    set((state) => {
      const rest = state.reminders.filter((item) => item.id !== reminder.id);
      return { reminders: [...rest, reminder].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)) };
    });
  },
  removeLocal: (id) => {
    set((state) => ({ reminders: state.reminders.filter((item) => item.id !== id) }));
  },
  setStatusLocal: (id, status, snoozedUntil) => {
    set((state) => ({
      reminders: state.reminders.map((item) =>
        item.id === id ? { ...item, status, snoozedUntil: snoozedUntil ?? item.snoozedUntil } : item,
      ),
    }));
  },
  getById: (id) => get().reminders.find((item) => item.id === id),
}));
