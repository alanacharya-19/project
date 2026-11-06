import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Speech from 'expo-speech';
import { splitSentences, type SentenceSlice } from '../services/speech';

export interface SpeechHighlight {
  start: number;
  end: number;
  mode: 'word' | 'sentence';
}

interface UseSpeechPlayerOptions {
  message: string;
  rate: number;
  pitch: number;
  voiceId: string | null;
  autoStart?: boolean;
}

interface SpeechPlayer {
  sentences: SentenceSlice[];
  isSpeaking: boolean;
  isPaused: boolean;
  currentSentence: number;
  highlight: SpeechHighlight | null;
  hasWordTiming: boolean;
  error: string | null;
  progress: number;
  start: () => void;
  pause: () => void;
  resume: () => void;
  togglePause: () => void;
  repeat: () => void;
  stop: () => void;
}

export function useSpeechPlayer({
  message,
  rate,
  pitch,
  voiceId,
  autoStart = true,
}: UseSpeechPlayerOptions): SpeechPlayer {
  const sentences = useMemo(() => splitSentences(message), [message]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentSentence, setCurrentSentence] = useState(-1);
  const [highlight, setHighlight] = useState<SpeechHighlight | null>(null);
  const [hasWordTiming, setHasWordTiming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionRef = useRef(0);
  const stoppedRef = useRef(false);
  const currentSentenceRef = useRef(-1);
  const sentenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const clearSentenceTimer = useCallback(() => {
    if (sentenceTimerRef.current) {
      clearTimeout(sentenceTimerRef.current);
      sentenceTimerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    sessionRef.current += 1;
    stoppedRef.current = true;
    clearSentenceTimer();
    Speech.stop().catch(() => undefined);
    setIsSpeaking(false);
    setIsPaused(false);
    setHighlight(null);
    setCurrentSentence(-1);
    currentSentenceRef.current = -1;
  }, [clearSentenceTimer]);

  const speakAt = useCallback(
    (index: number, session: number) => {
      if (session !== sessionRef.current) return;
      if (index >= sentences.length) {
        setIsSpeaking(false);
        setIsPaused(false);
        setHighlight(null);
        setCurrentSentence(-1);
        currentSentenceRef.current = -1;
        return;
      }
      const sentence = sentences[index];
      currentSentenceRef.current = index;
      setCurrentSentence(index);
      setHasWordTiming(false);
      setIsPaused(false);
      setIsSpeaking(true);
      setError(null);

      // Sentence-level is the honest fallback. Native boundary events below
      // replace it with a precise word range when the engine emits them.
      setHighlight({ start: sentence.start, end: sentence.end, mode: 'sentence' });
      clearSentenceTimer();
      sentenceTimerRef.current = setTimeout(() => {
        if (session === sessionRef.current) {
          setHighlight({ start: sentence.start, end: sentence.end, mode: 'sentence' });
        }
      }, 700);

      try {
        Speech.speak(sentence.text, {
          rate,
          pitch,
          voice: voiceId ?? undefined,
          onStart: () => {
            if (session !== sessionRef.current) return;
            setIsSpeaking(true);
          },
          onBoundary: (event: { charIndex?: number; charLength?: number }) => {
            if (session !== sessionRef.current) return;
            const charIndex = Number(event.charIndex ?? 0);
            const charLength = Math.max(1, Number(event.charLength ?? 1));
            setHasWordTiming(true);
            setHighlight({
              start: sentence.start + charIndex,
              end: Math.min(sentence.end, sentence.start + charIndex + charLength),
              mode: 'word',
            });
          },
          onDone: () => {
            if (session !== sessionRef.current || stoppedRef.current) return;
            clearSentenceTimer();
            speakAt(index + 1, session);
          },
          onStopped: () => {
            if (session === sessionRef.current && !stoppedRef.current) {
              setIsSpeaking(false);
            }
          },
          onError: () => {
            if (session !== sessionRef.current) return;
            clearSentenceTimer();
            setIsSpeaking(false);
            setIsPaused(false);
            setError('The device speech engine could not read this reminder.');
          },
        });
      } catch {
        setIsSpeaking(false);
        setError('Text-to-speech is unavailable on this device.');
      }
    },
    [clearSentenceTimer, pitch, rate, sentences, voiceId],
  );

  const start = useCallback(() => {
    sessionRef.current += 1;
    const session = sessionRef.current;
    stoppedRef.current = false;
    clearSentenceTimer();
    Speech.stop().catch(() => undefined);
    speakAt(0, session);
  }, [clearSentenceTimer, speakAt]);

  const pause = useCallback(() => {
    if (!isSpeaking || isPaused) return;
    sessionRef.current += 1;
    stoppedRef.current = true;
    clearSentenceTimer();
    Speech.stop().catch(() => undefined);
    setIsSpeaking(false);
    setIsPaused(true);
    setHighlight(null);
  }, [clearSentenceTimer, isPaused, isSpeaking]);

  const resume = useCallback(() => {
    if (!isPaused) return;
    const index = Math.max(0, currentSentenceRef.current);
    sessionRef.current += 1;
    stoppedRef.current = false;
    clearSentenceTimer();
    speakAt(index, sessionRef.current);
  }, [clearSentenceTimer, isPaused, speakAt]);

  const togglePause = useCallback(() => {
    if (isPaused) resume();
    else pause();
  }, [isPaused, pause, resume]);

  const repeat = useCallback(() => {
    start();
  }, [start]);

  useEffect(() => {
    mountedRef.current = true;
    if (autoStart) start();
    return () => {
      mountedRef.current = false;
      sessionRef.current += 1;
      clearSentenceTimer();
      Speech.stop().catch(() => undefined);
    };
    // Auto-start once per mounted message. Manual controls are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    sentences,
    isSpeaking,
    isPaused,
    currentSentence,
    highlight,
    hasWordTiming,
    error,
    progress: currentSentence >= 0 ? (currentSentence + 1) / sentences.length : 0,
    start,
    pause,
    resume,
    togglePause,
    repeat,
    stop,
  };
}
