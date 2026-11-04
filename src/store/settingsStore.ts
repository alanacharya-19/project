import { create } from 'zustand';
import { DEFAULT_SETTINGS, type AppSettings } from '@/types/settings';
import { loadSettings, saveSetting } from '@/services/database/settingsRepository';

interface SettingsState {
  settings: AppSettings;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  update: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
  updateMany: (partial: Partial<AppSettings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: DEFAULT_SETTINGS,
  hydrated: false,
  hydrate: async () => {
    const settings = await loadSettings();
    set({ settings, hydrated: true });
  },
  update: async (key, value) => {
    set((state) => ({ settings: { ...state.settings, [key]: value } }));
    await saveSetting(key, value);
  },
  updateMany: async (partial) => {
    set((state) => ({ settings: { ...state.settings, ...partial } }));
    await Promise.all(
      Object.entries(partial).map(([key, value]) =>
        saveSetting(key as keyof AppSettings, value as AppSettings[keyof AppSettings]),
      ),
    );
  },
}));
