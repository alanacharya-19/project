import { create } from 'zustand';
import type { Reminder } from '@/types/reminder';

export interface ToastMessage {
  id: number;
  message: string;
  kind: 'default' | 'success' | 'error';
}

interface UiState {
  createSheetOpen: boolean;
  editingReminder: Reminder | null;
  presetDate: Date | null;
  toast: ToastMessage | null;
  openCreate: (presetDate?: Date) => void;
  openEdit: (reminder: Reminder) => void;
  closeCreate: () => void;
  showToast: (message: string, kind?: ToastMessage['kind']) => void;
  clearToast: () => void;
}

let toastCounter = 0;

export const useUiStore = create<UiState>((set) => ({
  createSheetOpen: false,
  editingReminder: null,
  presetDate: null,
  toast: null,
  openCreate: (presetDate) =>
    set({ createSheetOpen: true, editingReminder: null, presetDate: presetDate ?? null }),
  openEdit: (reminder) =>
    set({ createSheetOpen: true, editingReminder: reminder, presetDate: null }),
  closeCreate: () => set({ createSheetOpen: false, editingReminder: null, presetDate: null }),
  showToast: (message, kind = 'default') => {
    toastCounter += 1;
    set({ toast: { id: toastCounter, message, kind } });
  },
  clearToast: () => set({ toast: null }),
}));
