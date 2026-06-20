import { YIN } from 'pitchfinder';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { Instrument } from '../utils/instruments';
import { getInstrumentFrequencyRange } from '../utils/instruments';
import { frequencyToNote, getRms, type NoteInfo } from '../utils/notes';

const RMS_THRESHOLD = 0.008;

export const MIN_GAIN = 1;
export const MAX_GAIN = 30;
const DEFAULT_GAIN = 15;
const GAIN_STORAGE_KEY = 'notasweb:input-gain';

function clampGain(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_GAIN;
  return Math.min(MAX_GAIN, Math.max(MIN_GAIN, value));
}

function readStoredGain(): number {
  if (typeof window === 'undefined') return DEFAULT_GAIN;
  const raw = window.localStorage.getItem(GAIN_STORAGE_KEY);
  if (raw === null) return DEFAULT_GAIN;
  return clampGain(Number.parseFloat(raw));
}

export interface PitchState {
  frequency: number | null;
  note: NoteInfo | null;
  isListening: boolean;
  isActive: boolean;
  error: string | null;
  devices: MediaDeviceInfo[];
  selectedDeviceId: string;
  gain: number;
}

export function usePitchDetector(instrument: Instrument) {
  const [state, setState] = useState<PitchState>(() => ({
    frequency: null,
    note: null,
    isListening: false,
    isActive: false,
    error: null,
    devices: [],
    selectedDeviceId: '',
    gain: readStoredGain(),
  }));

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const gainValueRef = useRef<number>(state.gain);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  const detectPitchRef = useRef<ReturnType<typeof YIN> | null>(null);
  const bufferRef = useRef<Float32Array<ArrayBuffer> | null>(null);
  const frequencyRangeRef = useRef(getInstrumentFrequencyRange(instrument));

  useEffect(() => {
    frequencyRangeRef.current = getInstrumentFrequencyRange(instrument);
  }, [instrument]);

  const stopListening = useCallback(() => {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    void audioContextRef.current?.close();
    audioContextRef.current = null;
    analyserRef.current = null;
    gainNodeRef.current = null;
    detectPitchRef.current = null;
    bufferRef.current = null;

    setState((prev) => ({
      ...prev,
      isListening: false,
      isActive: false,
      frequency: null,
      note: null,
    }));
  }, []);

  const analyze = useCallback(() => {
    const analyser = analyserRef.current;
    const detectPitch = detectPitchRef.current;
    const buffer = bufferRef.current;
    const { min, max } = frequencyRangeRef.current;

    if (!analyser || !detectPitch || !buffer) return;

    analyser.getFloatTimeDomainData(buffer);
    const rms = getRms(buffer);

    if (rms < RMS_THRESHOLD) {
      setState((prev) => ({
        ...prev,
        isActive: false,
        frequency: null,
        note: null,
      }));
    } else {
      const rawFrequency = detectPitch(buffer);

      if (rawFrequency && rawFrequency >= min && rawFrequency <= max) {
        setState((prev) => ({
          ...prev,
          isActive: true,
          frequency: rawFrequency,
          note: frequencyToNote(rawFrequency),
        }));
      } else {
        setState((prev) => ({
          ...prev,
          isActive: false,
          frequency: null,
          note: null,
        }));
      }
    }

    animationRef.current = requestAnimationFrame(analyze);
  }, []);

  const startListening = useCallback(
    async (deviceId?: string) => {
      stopListening();

      try {
        const constraints: MediaStreamConstraints = {
          audio: {
            deviceId: deviceId ? { exact: deviceId } : undefined,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        const audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        // Buffer grande para que entren varios períodos de las notas graves
        // (E1 del bajo ≈ 41 Hz necesita ~1165 muestras por período): con 4096
        // YIN no lograba detectarla de forma estable.
        analyser.fftSize = 8192;
        analyser.smoothingTimeConstant = 0;

        const source = audioContext.createMediaStreamSource(stream);
        const gainNode = audioContext.createGain();
        gainNode.gain.value = gainValueRef.current;
        source.connect(gainNode);
        gainNode.connect(analyser);

        const arrayBuffer = new ArrayBuffer(analyser.fftSize * Float32Array.BYTES_PER_ELEMENT);
        const buffer = new Float32Array(arrayBuffer);
        const detectPitch = YIN({ sampleRate: audioContext.sampleRate });

        streamRef.current = stream;
        audioContextRef.current = audioContext;
        analyserRef.current = analyser;
        gainNodeRef.current = gainNode;
        detectPitchRef.current = detectPitch;
        bufferRef.current = buffer;

        setState((prev) => ({
          ...prev,
          isListening: true,
          error: null,
          selectedDeviceId: deviceId ?? prev.selectedDeviceId,
        }));

        animationRef.current = requestAnimationFrame(analyze);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'No se pudo acceder al micrófono o entrada de línea';

        setState((prev) => ({
          ...prev,
          error: message,
          isListening: false,
        }));
      }
    },
    [analyze, stopListening],
  );

  const refreshDevices = useCallback(async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
        stream.getTracks().forEach((track) => track.stop());
      });
    } catch {
      // Permiso aún no concedido; igual intentamos listar dispositivos.
    }

    const allDevices = await navigator.mediaDevices.enumerateDevices();
    const inputDevices = allDevices.filter((device) => device.kind === 'audioinput');

    setState((prev) => ({
      ...prev,
      devices: inputDevices,
      selectedDeviceId: prev.selectedDeviceId || inputDevices[0]?.deviceId || '',
    }));
  }, []);

  const selectDevice = useCallback((deviceId: string) => {
    setState((prev) => ({ ...prev, selectedDeviceId: deviceId }));
  }, []);

  const setGain = useCallback((value: number) => {
    const next = clampGain(value);
    gainValueRef.current = next;

    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = next;
    }

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(GAIN_STORAGE_KEY, String(next));
    }

    setState((prev) => ({ ...prev, gain: next }));
  }, []);

  useEffect(() => {
    void refreshDevices();
    navigator.mediaDevices.addEventListener('devicechange', refreshDevices);

    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', refreshDevices);
      stopListening();
    };
  }, [refreshDevices, stopListening]);

  return {
    ...state,
    startListening,
    stopListening,
    refreshDevices,
    selectDevice,
    setGain,
  };
}
