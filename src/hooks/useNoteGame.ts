import { useCallback, useEffect, useRef, useState } from 'react';

import {
  getInstrumentOctaves,
  getReferenceFrequenciesForNoteName,
  notesMatch,
  pickRandomGameNote,
  pickRandomScaleGameNote,
  pickRandomSpelling,
  type GameMode,
  type NoteInfo,
} from '../utils/notes';
import { resolveNoteGoal } from '../utils/gameTime';
import { playCelebrationSound } from '../utils/celebrationSound';
import { disposeReferenceTone, startReferenceTone, stopReferenceTone } from '../utils/noteTone';
import type { Instrument } from '../utils/instruments';
import {
  cancelSpeech,
  speakNote,
  speakScaleDegree,
} from '../utils/speech';
import {
  getScaleDegreeNote,
  getScaleNotes,
  pickRandomScaleDegree,
  spellScaleNote,
  type ScaleDegree,
  type ScaleKey,
  type ScalePromptMode,
} from '../utils/scales';
import { usePitchDetector } from './usePitchDetector';

const MATCH_FRAMES_REQUIRED = 14;
// Cuántos frames seguidos debe sostenerse una nota equivocada para contarla
// como error (evita contar parpadeos del detector al pasar de una nota a otra).
const ERROR_FRAMES_REQUIRED = 8;
// Frames de silencio que cierran un "intento": tras ellos, volver a tocar la
// misma nota equivocada vuelve a contar como un error nuevo.
const SILENCE_RESET_FRAMES = 10;
const SUCCESS_DELAY_MS = 700;
const TIMER_INTERVAL_MS = 50;

const DEFAULT_SCALE_KEY: ScaleKey = { root: 'A', quality: 'minor' };

function spellingForTarget(note: NoteInfo, mode: GameMode, key: ScaleKey): string {
  if (mode === 'scale') return spellScaleNote(key, note.note);
  return pickRandomSpelling(note.note);
}

function octaveIsFixed(gameMode: GameMode, scalePromptMode: ScalePromptMode): boolean {
  return gameMode === 'specific' || (gameMode === 'scale' && scalePromptMode === 'specific');
}

function resolveTargetReferenceFrequencies(
  gameMode: GameMode,
  targetNote: NoteInfo,
  instrument: Instrument,
  scaleKey: ScaleKey,
  targetDegree: ScaleDegree,
  scalePromptMode: ScalePromptMode,
  referenceOctaves: number[],
): number[] {
  if (octaveIsFixed(gameMode, scalePromptMode)) {
    return [targetNote.frequency];
  }

  const note =
    gameMode === 'scale' ? getScaleDegreeNote(scaleKey, targetDegree) : targetNote.note;
  return getReferenceFrequenciesForNoteName(note, instrument, referenceOctaves);
}

export function useNoteGame() {
  const [instrument, setInstrument] = useState<Instrument>('guitar');
  const {
    startListening,
    stopListening,
    ...pitchState
  } = usePitchDetector(instrument);
  const [gameMode, setGameMode] = useState<GameMode>('general');
  const [targetNote, setTargetNote] = useState<NoteInfo>(() =>
    pickRandomGameNote('guitar', undefined, 'general'),
  );
  const [targetSpelling, setTargetSpelling] = useState(() =>
    pickRandomSpelling(targetNote.note),
  );
  const [selectedKey, setSelectedKey] = useState<ScaleKey>(DEFAULT_SCALE_KEY);
  const [targetDegree, setTargetDegree] = useState<ScaleDegree>(() =>
    pickRandomScaleDegree(),
  );
  const [scalePromptMode, setScalePromptMode] = useState<ScalePromptMode>('degree');
  const [score, setScore] = useState(0);
  const [errors, setErrors] = useState(0);
  const [noteGoal, setNoteGoal] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [finalTimeMs, setFinalTimeMs] = useState<number | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [speechMuted, setSpeechMuted] = useState(false);
  const [noteToneEnabled, setNoteToneEnabled] = useState(false);
  const [referenceOctaves, setReferenceOctaves] = useState<number[]>(() =>
    getInstrumentOctaves('guitar'),
  );

  const matchFramesRef = useRef(0);
  const wrongFramesRef = useRef(0);
  const wrongNoteMidiRef = useRef<number | null>(null);
  const countedWrongMidiRef = useRef<number | null>(null);
  const silenceFramesRef = useRef(0);
  const successTimeoutRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const timerStartedAtRef = useRef<number | null>(null);
  const accumulatedMsRef = useRef(0);
  const gameModeRef = useRef(gameMode);
  const instrumentRef = useRef(instrument);
  const selectedKeyRef = useRef(selectedKey);
  const scalePromptModeRef = useRef(scalePromptMode);
  const noteGoalRef = useRef(noteGoal);

  useEffect(() => {
    gameModeRef.current = gameMode;
  }, [gameMode]);

  useEffect(() => {
    scalePromptModeRef.current = scalePromptMode;
  }, [scalePromptMode]);

  useEffect(() => {
    instrumentRef.current = instrument;
  }, [instrument]);

  useEffect(() => {
    selectedKeyRef.current = selectedKey;
  }, [selectedKey]);

  useEffect(() => {
    noteGoalRef.current = noteGoal;
  }, [noteGoal]);

  const expectedScaleNote =
    gameMode === 'scale' ? getScaleDegreeNote(selectedKey, targetDegree) : undefined;

  const clearSuccessTimeout = useCallback(() => {
    if (successTimeoutRef.current !== null) {
      window.clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = null;
    }
  }, []);

  const resetErrorTracking = useCallback(() => {
    wrongFramesRef.current = 0;
    wrongNoteMidiRef.current = null;
    countedWrongMidiRef.current = null;
    silenceFramesRef.current = 0;
  }, []);

  const stopTimer = useCallback(() => {
    if (timerIntervalRef.current !== null) {
      window.clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (timerStartedAtRef.current !== null) {
      accumulatedMsRef.current += performance.now() - timerStartedAtRef.current;
      timerStartedAtRef.current = null;
      setElapsedMs(accumulatedMsRef.current);
    }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    timerStartedAtRef.current = performance.now();

    timerIntervalRef.current = window.setInterval(() => {
      if (timerStartedAtRef.current !== null) {
        setElapsedMs(accumulatedMsRef.current + performance.now() - timerStartedAtRef.current);
      }
    }, TIMER_INTERVAL_MS);
  }, [stopTimer]);

  const resetChallenge = useCallback((mode: GameMode) => {
    const key = selectedKeyRef.current;
    if (mode === 'scale') {
      if (scalePromptModeRef.current === 'specific') {
        const note = pickRandomScaleGameNote(instrumentRef.current, getScaleNotes(key));
        setTargetNote(note);
        setTargetSpelling(spellingForTarget(note, mode, key));
      } else {
        setTargetDegree(pickRandomScaleDegree());
      }
    } else {
      const note = pickRandomGameNote(instrumentRef.current, undefined, mode);
      setTargetNote(note);
      setTargetSpelling(spellingForTarget(note, mode, key));
    }
  }, []);

  const advanceChallenge = useCallback(
    (currentTarget: NoteInfo, currentDegree: ScaleDegree) => {
      const mode = gameModeRef.current;
      const currentInstrument = instrumentRef.current;

      const key = selectedKeyRef.current;
      if (mode === 'scale') {
        if (scalePromptModeRef.current === 'specific') {
          const note = pickRandomScaleGameNote(
            currentInstrument,
            getScaleNotes(key),
            currentTarget.midi,
          );
          setTargetNote(note);
          setTargetSpelling(spellingForTarget(note, mode, key));
        } else {
          setTargetDegree(pickRandomScaleDegree(currentDegree));
        }
      } else {
        const exclude =
          mode === 'general'
            ? { note: currentTarget.note }
            : { midi: currentTarget.midi };
        const note = pickRandomGameNote(currentInstrument, exclude, mode);
        setTargetNote(note);
        setTargetSpelling(spellingForTarget(note, mode, key));
      }

      setIsSuccess(false);
      matchFramesRef.current = 0;
      resetErrorTracking();
    },
    [resetErrorTracking],
  );

  const finishGame = useCallback(() => {
    cancelSpeech();
    if (noteGoalRef.current !== null) {
      playCelebrationSound();
    }
    stopTimer();
    setFinalTimeMs(accumulatedMsRef.current);
    setIsFinished(true);
    setIsSuccess(false);
    matchFramesRef.current = 0;
    stopListening();
  }, [stopListening, stopTimer]);

  const resetSessionState = useCallback(() => {
    clearSuccessTimeout();
    stopTimer();
    accumulatedMsRef.current = 0;
    matchFramesRef.current = 0;
    resetErrorTracking();
    setElapsedMs(0);
    setFinalTimeMs(null);
    setScore(0);
    setErrors(0);
    setIsSuccess(false);
    setIsFinished(false);
    resetChallenge(gameModeRef.current);
  }, [clearSuccessTimeout, resetChallenge, resetErrorTracking, stopTimer]);

  const changeGameMode = useCallback(
    (mode: GameMode) => {
      setGameMode(mode);
      resetChallenge(mode);
    },
    [resetChallenge],
  );

  const changeInstrument = useCallback(
    (nextInstrument: Instrument) => {
      const previousOctaves = getInstrumentOctaves(instrumentRef.current);
      setInstrument(nextInstrument);
      instrumentRef.current = nextInstrument;
      setReferenceOctaves((current) => {
        const available = getInstrumentOctaves(nextInstrument);
        const wasAll =
          current.length === previousOctaves.length &&
          previousOctaves.every((octave) => current.includes(octave));
        if (wasAll) return available;
        const kept = current.filter((octave) => available.includes(octave));
        return kept.length > 0 ? kept : available;
      });
      resetChallenge(gameModeRef.current);
    },
    [resetChallenge],
  );

  const toggleReferenceOctave = useCallback((octave: number) => {
    setReferenceOctaves((current) => {
      if (current.includes(octave)) {
        if (current.length === 1) return current;
        return current.filter((value) => value !== octave);
      }
      return [...current, octave].sort((left, right) => left - right);
    });
  }, []);

  const repickScaleChallenge = useCallback((key: ScaleKey) => {
    if (scalePromptModeRef.current === 'specific') {
      const note = pickRandomScaleGameNote(instrumentRef.current, getScaleNotes(key));
      setTargetNote(note);
      setTargetSpelling(spellingForTarget(note, 'scale', key));
    } else {
      setTargetDegree(pickRandomScaleDegree());
    }
  }, []);

  const changeScaleRoot = useCallback(
    (root: ScaleKey['root']) => {
      const nextKey: ScaleKey = { ...selectedKeyRef.current, root };
      setSelectedKey(nextKey);
      selectedKeyRef.current = nextKey;
      repickScaleChallenge(nextKey);
    },
    [repickScaleChallenge],
  );

  const changeScaleQuality = useCallback(
    (quality: ScaleKey['quality']) => {
      const nextKey: ScaleKey = { ...selectedKeyRef.current, quality };
      setSelectedKey(nextKey);
      selectedKeyRef.current = nextKey;
      repickScaleChallenge(nextKey);
    },
    [repickScaleChallenge],
  );

  const changeScalePromptMode = useCallback(
    (mode: ScalePromptMode) => {
      setScalePromptMode(mode);
      scalePromptModeRef.current = mode;
      if (gameModeRef.current === 'scale') {
        resetChallenge('scale');
      }
    },
    [resetChallenge],
  );

  const toggleSpeechMuted = useCallback(() => {
    setSpeechMuted((prev) => {
      if (!prev) {
        cancelSpeech();
      }
      return !prev;
    });
  }, []);

  const toggleNoteToneEnabled = useCallback(() => {
    setNoteToneEnabled((prev) => {
      if (prev) {
        stopReferenceTone();
      }
      return !prev;
    });
  }, []);

  const startGame = useCallback(
    async (deviceId?: string, noteCountInput = '') => {
      resetSessionState();
      setNoteGoal(resolveNoteGoal(noteCountInput));
      await startListening(deviceId);
      startTimer();
    },
    [resetSessionState, startListening, startTimer],
  );

  const resumeGame = useCallback(
    async (deviceId?: string) => {
      await startListening(deviceId);
      startTimer();
    },
    [startListening, startTimer],
  );

  const pauseGame = useCallback(() => {
    clearSuccessTimeout();
    cancelSpeech();
    stopTimer();
    setIsSuccess(false);
    matchFramesRef.current = 0;
    stopListening();
  }, [clearSuccessTimeout, stopListening, stopTimer]);

  const resetGame = useCallback(() => {
    resetSessionState();
    stopListening();
  }, [resetSessionState, stopListening]);

  useEffect(() => {
    if (
      !pitchState.isListening ||
      !pitchState.isActive ||
      !pitchState.note ||
      isSuccess ||
      isFinished
    ) {
      matchFramesRef.current = 0;
      wrongFramesRef.current = 0;
      wrongNoteMidiRef.current = null;

      // Tras un silencio sostenido cerramos el "intento": volver a tocar la
      // misma nota equivocada contará como un error nuevo.
      if (!pitchState.isActive || !pitchState.note) {
        silenceFramesRef.current += 1;
        if (silenceFramesRef.current >= SILENCE_RESET_FRAMES) {
          countedWrongMidiRef.current = null;
        }
      }
      return;
    }

    silenceFramesRef.current = 0;

    const scaleSpecific = gameMode === 'scale' && scalePromptMode === 'specific';
    const expectedNote =
      gameMode === 'scale' && !scaleSpecific
        ? getScaleDegreeNote(selectedKeyRef.current, targetDegree)
        : undefined;

    if (notesMatch(pitchState.note, targetNote, gameMode, expectedNote, scaleSpecific)) {
      wrongFramesRef.current = 0;
      wrongNoteMidiRef.current = null;
      countedWrongMidiRef.current = null;
      matchFramesRef.current += 1;

      if (matchFramesRef.current >= MATCH_FRAMES_REQUIRED) {
        setIsSuccess(true);
        matchFramesRef.current = 0;

        setScore((prev) => {
          const nextScore = prev + 1;

          successTimeoutRef.current = window.setTimeout(() => {
            const goal = noteGoalRef.current;
            if (goal !== null && nextScore >= goal) {
              finishGame();
            } else {
              advanceChallenge(targetNote, targetDegree);
            }
          }, SUCCESS_DELAY_MS);

          return nextScore;
        });
      }
    } else {
      matchFramesRef.current = 0;

      const detectedMidi = pitchState.note.midi;

      if (wrongNoteMidiRef.current !== detectedMidi) {
        wrongNoteMidiRef.current = detectedMidi;
        wrongFramesRef.current = 0;
      }

      wrongFramesRef.current += 1;

      if (
        wrongFramesRef.current >= ERROR_FRAMES_REQUIRED &&
        countedWrongMidiRef.current !== detectedMidi
      ) {
        countedWrongMidiRef.current = detectedMidi;
        setErrors((prev) => prev + 1);
      }
    }
  }, [
    advanceChallenge,
    finishGame,
    gameMode,
    isFinished,
    isSuccess,
    noteGoal,
    pitchState.isActive,
    pitchState.isListening,
    pitchState.note,
    scalePromptMode,
    targetDegree,
    targetNote,
  ]);

  useEffect(() => {
    if (!pitchState.isListening || isFinished || speechMuted) return;

    if (gameMode === 'scale') {
      if (scalePromptMode === 'specific') {
        speakNote(spellScaleNote(selectedKey, targetNote.note), targetNote.octave);
      } else if (scalePromptMode === 'note' && expectedScaleNote) {
        speakNote(spellScaleNote(selectedKey, expectedScaleNote));
      } else {
        speakScaleDegree(targetDegree);
      }
      return;
    }

    if (gameMode === 'specific') {
      speakNote(targetSpelling, targetNote.octave);
      return;
    }

    speakNote(targetSpelling);
  }, [
    expectedScaleNote,
    gameMode,
    isFinished,
    pitchState.isListening,
    scalePromptMode,
    selectedKey,
    speechMuted,
    targetDegree,
    targetNote.midi,
    targetNote.note,
    targetNote.octave,
    targetSpelling,
  ]);

  useEffect(() => {
    if (
      !noteToneEnabled ||
      !pitchState.isListening ||
      isFinished ||
      isSuccess
    ) {
      stopReferenceTone();
      return;
    }

    const frequencies = resolveTargetReferenceFrequencies(
      gameMode,
      targetNote,
      instrument,
      selectedKey,
      targetDegree,
      scalePromptMode,
      referenceOctaves,
    );
    startReferenceTone(frequencies);

    return () => {
      stopReferenceTone();
    };
  }, [
    gameMode,
    instrument,
    isFinished,
    isSuccess,
    noteToneEnabled,
    pitchState.isListening,
    referenceOctaves,
    scalePromptMode,
    selectedKey,
    targetDegree,
    targetNote.frequency,
    targetNote.midi,
    targetNote.note,
  ]);

  useEffect(() => {
    return () => {
      clearSuccessTimeout();
      cancelSpeech();
      disposeReferenceTone();
      if (timerIntervalRef.current !== null) {
        window.clearInterval(timerIntervalRef.current);
      }
    };
  }, [clearSuccessTimeout]);

  const hasStartedSession = score > 0 || elapsedMs > 0 || isFinished;

  return {
    ...pitchState,
    instrument,
    gameMode,
    targetNote,
    targetSpelling,
    selectedKey,
    targetDegree,
    expectedScaleNote,
    scalePromptMode,
    score,
    errors,
    noteGoal,
    elapsedMs,
    finalTimeMs,
    isSuccess,
    isFinished,
    hasStartedSession,
    speechMuted,
    noteToneEnabled,
    toggleNoteToneEnabled,
    instrumentOctaves: getInstrumentOctaves(instrument),
    referenceOctaves,
    toggleReferenceOctave,
    changeInstrument,
    changeGameMode,
    changeScaleRoot,
    changeScaleQuality,
    changeScalePromptMode,
    toggleSpeechMuted,
    startGame,
    resumeGame,
    pauseGame,
    resetGame,
  };
}
