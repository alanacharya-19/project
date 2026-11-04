import * as Speech from 'expo-speech';

export interface SentenceSlice {
  text: string;
  start: number;
  end: number;
}

export interface VoiceOption {
  identifier: string;
  name: string;
  language: string;
  quality: string;
}

/**
 * Splits a message into sentence slices that keep exact offsets into the
 * original string. Speech is played one sentence at a time so highlighting is
 * never fabricated: when native word-boundary events are unavailable the UI
 * highlights the sentence currently being spoken.
 */
export function splitSentences(message: string): SentenceSlice[] {
  const text = message ?? '';
  const slices: SentenceSlice[] = [];
  let start = 0;
  let i = 0;
  while (i < text.length) {
    const char = text[i];
    if (char === '.' || char === '!' || char === '?' || char === '…') {
      let end = i + 1;
      while (end < text.length && /["')\]]/.test(text[end])) end += 1;
      if (end >= text.length || /\s/.test(text[end])) {
        while (end < text.length && /\s/.test(text[end])) end += 1;
        const slice = text.slice(start, end);
        if (slice.trim()) {
          slices.push({ text: slice, start, end });
        }
        start = end;
        i = end;
        continue;
      }
    }
    if (char === '\n') {
      const end = i + 1;
      const slice = text.slice(start, end);
      if (slice.trim()) slices.push({ text: slice, start, end });
      start = end;
      i = end;
      continue;
    }
    i += 1;
  }
  if (start < text.length) {
    const slice = text.slice(start);
    if (slice.trim()) slices.push({ text: slice, start, end: text.length });
  }
  return slices.length ? slices : [{ text, start: 0, end: text.length }];
}

export async function getSystemVoices(): Promise<VoiceOption[]> {
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    return voices
      .map((voice) => ({
        identifier: voice.identifier,
        name: voice.name,
        language: voice.language,
        quality: String(voice.quality),
      }))
      .sort((a, b) => {
        const languageCompare = a.language.localeCompare(b.language);
        if (languageCompare !== 0) return languageCompare;
        return a.name.localeCompare(b.name);
      });
  } catch {
    return [];
  }
}

export async function previewSpeech(
  text: string,
  options: { rate: number; pitch: number; voiceId?: string | null },
): Promise<void> {
  await Speech.stop();
  Speech.speak(text, {
    rate: options.rate,
    pitch: options.pitch,
    voice: options.voiceId ?? undefined,
    onError: () => undefined,
  });
}

export async function stopSpeech(): Promise<void> {
  try {
    await Speech.stop();
  } catch {
    // Native speech engine unavailable.
  }
}
