import React, { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from '@/components/common/AppText';
import { BottomSheet } from '@/components/modals/BottomSheet';
import { PrimaryButton } from '@/components/common/Buttons';
import {
  getSystemVoices,
  previewSpeech,
  stopSpeech,
  type VoiceOption,
} from '@/features/voice/services/speech';

interface VoicePickerSheetProps {
  visible: boolean;
  onClose: () => void;
  selectedId: string | null;
  rate: number;
  pitch: number;
  onSelect: (voice: VoiceOption | null) => void;
}

export function VoicePickerSheet({
  visible,
  onClose,
  selectedId,
  rate,
  pitch,
  onSelect,
}: VoicePickerSheetProps) {
  const { colors } = useTheme();
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [pending, setPending] = useState<VoiceOption | null>(null);

  useEffect(() => {
    if (!visible) {
      stopSpeech();
      return;
    }
    setPending(null);
    setQuery('');
    let cancelled = false;
    setLoading(true);
    getSystemVoices()
      .then((result) => {
        if (!cancelled) setVoices(result);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    const sorted = voices.slice().sort((a, b) => {
      const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? 'en';
      const prefix = locale.slice(0, 2).toLowerCase();
      const aLocal = a.language.toLowerCase().startsWith(prefix) ? 0 : 1;
      const bLocal = b.language.toLowerCase().startsWith(prefix) ? 0 : 1;
      if (aLocal !== bLocal) return aLocal - bLocal;
      return a.name.localeCompare(b.name);
    });
    if (!text) return sorted;
    return sorted.filter(
      (voice) =>
        voice.name.toLowerCase().includes(text) ||
        voice.language.toLowerCase().includes(text),
    );
  }, [query, voices]);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      eyebrow="VOICE"
      title="Choose a voice"
      footer={
        <PrimaryButton
          label={pending ? `Use ${pending.name}` : 'Keep current voice'}
          onPress={() => {
            onSelect(pending);
            onClose();
          }}
        />
      }
    >
      <View style={{ gap: spacing.md }}>
        <View
          style={[
            styles.searchWrap,
            { backgroundColor: colors.surfaceAlt, borderColor: colors.borderSoft },
          ]}
        >
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search voices or languages"
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.text }]}
            selectionColor={colors.accent}
          />
        </View>

        <AppText variant="caption" color={colors.textMuted}>
          {loading
            ? 'Loading voices from your device…'
            : `${filtered.length} system voice${filtered.length === 1 ? '' : 's'} available`}
        </AppText>

        <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
          {filtered.length === 0 && !loading ? (
            <AppText variant="body" color={colors.textSecondary} style={{ paddingVertical: spacing.lg }}>
              No matching voices. Your device may only expose a few offline voices.
            </AppText>
          ) : null}
          {filtered.map((voice) => {
            const selected = (pending?.identifier ?? selectedId) === voice.identifier;
            return (
              <View
                key={voice.identifier}
                style={[styles.voiceRow, { borderBottomColor: colors.borderSoft }]}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setPending(voice)}
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
                >
                  <View
                    style={[
                      styles.check,
                      {
                        borderColor: selected ? colors.accent : colors.border,
                        backgroundColor: selected ? colors.accent : 'transparent',
                      },
                    ]}
                  >
                    {selected ? <Ionicons name="checkmark" size={13} color="#FFF7F2" /> : null}
                  </View>
                  <View style={{ flex: 1, gap: 1 }}>
                    <AppText variant="bodyStrong" numberOfLines={1}>
                      {voice.name}
                    </AppText>
                    <AppText variant="caption" color={colors.textMuted}>
                      {voice.language}
                      {voice.quality !== 'Default' ? ` · ${voice.quality}` : ''}
                    </AppText>
                  </View>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Preview ${voice.name}`}
                  onPress={() =>
                    previewSpeech('Hey, this is RINGO. This is how I will read your reminder.', {
                      rate,
                      pitch,
                      voiceId: voice.identifier,
                    })
                  }
                  style={[styles.previewButton, { backgroundColor: colors.surfaceMuted }]}
                >
                  <Ionicons name="play" size={13} color={colors.textSecondary} />
                </Pressable>
              </View>
            );
          })}
        </ScrollView>

        <Pressable onPress={() => setPending(null)} style={{ paddingVertical: spacing.sm }}>
          <AppText
            variant="caption"
            color={pending === null ? colors.accent : colors.textSecondary}
          >
            Use the device default voice
          </AppText>
        </Pressable>
        {Platform.OS === 'ios' ? (
          <AppText variant="caption" color={colors.textMuted} style={{ lineHeight: 17 }}>
            More voices can be installed in iOS Settings → Accessibility → Spoken Content.
          </AppText>
        ) : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    minHeight: 46,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 10,
  },
  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  check: {
    width: 21,
    height: 21,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
