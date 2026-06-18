import { useCallback, useEffect, useRef, useState } from 'react';

import {
  notesMatch,
  pickRandomGameNote,
  type GameMode,
  type NoteInfo,
} from '../utils/notes';
import { resolveNoteGoal } from '../utils/gameTime';
import type { Instrument } from '../utils/instruments';
import {
  getScaleDegreeNote,
  pickRandomScaleDegree,
  type ScaleDegree,
  type ScaleKey,
} from '../utils/scales';
import { usePitchDetector } from './usePitchDetector';

const MATCH_FRAMES_REQUIRED = 14;
const SUCCESS_DELAY_MS = 700;
const TIMER_INTERVAL_MS = 50;

const DEFAULT_SCALE_KEY: ScaleKey = { root: 'A', quality: 'minor' };

export function useNoteGame() {
  const [instrument, setInstrument] = useState<Instrument>('guitar');
  const {
    startListening,
    stopListening,
    ...pitchState
  } = usePitchDetector(instrument);
  const [gameMode, setGameMode] = useState<GameMode>('specific');
  const [targetNote, setTargetNote] = useState<NoteInfo>(() =>
    pickRandomGameNote('guitar', undefined, 'specific'),
  );
  const [selectedKey, setSelectedKey] = useState<ScaleKey>(DEFAULT_SCALE_KEY);
  const [targetDegree, setTargetDegree] = useState<ScaleDegree>(() =>
    pickRandomScaleDegree(),
  );
  const [score, setScore] = useState(0);
  const [noteGoal, setNoteGoal] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [finalTimeMs, setFinalTimeMs] = useState<number | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  const matchFramesRef = useRef(0);
  const successTimeoutRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const timerStartedAtRef = useRef<number | null>(null);
  const accumulatedMsRef = useRef(0);
  const gameModeRef = useRef(gameMode);
  const instrumentRef = useRef(instrument);
  const selectedKeyRef = useRef(selectedKey);
  const noteGoalRef = useRef(noteGoal);

  useEffect(() => {
    gameModeRef.current = gameMode;
  }, [gameMode]);

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
    if (mode === 'scale') {
      setTargetDegree(pickRandomScaleDegree());
    } else {
      setTargetNote(pickRandomGameNote(instrumentRef.current, undefined, mode));
    }
  }, []);

  const advanceChallenge = useCallback(
    (currentTarget: NoteInfo, currentDegree: ScaleDegree) => {
      const mode = gameModeRef.current;
      const currentInstrument = instrumentRef.current;

      if (mode === 'scale') {
        setTargetDegree(pickRandomScaleDegree(currentDegree));
      } else {
        const exclude =
          mode === 'general'
            ? { note: currentTarget.note }
            : { midi: currentTarget.midi };
        setTargetNote(pickRandomGameNote(currentInstrument, exclude, mode));
      }

      setIsSuccess(false);
      matchFramesRef.current = 0;
    },
    [],
  );

  const finishGame = useCallback(() => {
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
    setElapsedMs(0);
    setFinalTimeMs(null);
    setScore(0);
    setIsSuccess(false);
    setIsFinished(false);
    resetChallenge(gameModeRef.current);
  }, [clearSuccessTimeout, resetChallenge, stopTimer]);

  const changeGameMode = useCallback(
    (mode: GameMode) => {
      setGameMode(mode);
      resetChallenge(mode);
    },
    [resetChallenge],
  );

  const changeInstrument = useCallback(
    (nextInstrument: Instrument) => {
      setInstrument(nextInstrument);
      resetChallenge(gameModeRef.current);
    },
    [resetChallenge],
  );

  const changeScaleRoot = useCallback((root: ScaleKey['root']) => {
    setSelectedKey((prev) => ({ ...prev, root }));
    setTargetDegree(pickRandomScaleDegree());
  }, []);

  const changeScaleQuality = useCallback((quality: ScaleKey['quality']) => {
    setSelectedKey((prev) => ({ ...prev, quality }));
    setTargetDegree(pickRandomScaleDegree());
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
      return;
    }

    const expectedNote =
      gameMode === 'scale'
        ? getScaleDegreeNote(selectedKeyRef.current, targetDegree)
        : undefined;

    if (notesMatch(pitchState.note, targetNote, gameMode, expectedNote)) {
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
    targetDegree,
    targetNote,
  ]);

  useEffect(() => {
    return () => {
      clearSuccessTimeout();
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
    selectedKey,
    targetDegree,
    expectedScaleNote,
    score,
    noteGoal,
    elapsedMs,
    finalTimeMs,
    isSuccess,
    isFinished,
    hasStartedSession,
    changeInstrument,
    changeGameMode,
    changeScaleRoot,
    changeScaleQuality,
    startGame,
    resumeGame,
    pauseGame,
    resetGame,
  };
}
