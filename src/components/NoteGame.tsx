import { useState } from 'react';

import { useNoteGame } from '../hooks/useNoteGame';
import { formatElapsedTime } from '../utils/gameTime';
import { INSTRUMENTS, getInstrumentRangeText, type Instrument } from '../utils/instruments';
import { notesMatch, type GameMode } from '../utils/notes';
import {
  formatScaleDegreeLabel,
  formatScaleKeyLabel,
  SCALE_ROOTS,
} from '../utils/scales';

const GAME_MODES: { id: GameMode; label: string; description: string }[] = [
  {
    id: 'specific',
    label: 'Específico',
    description: 'Nota y octava exactas',
  },
  {
    id: 'general',
    label: 'General',
    description: 'Solo el nombre de la nota',
  },
  {
    id: 'scale',
    label: 'Grados',
    description: 'Grados de una escala mayor o menor',
  },
];

function NoteDisplay({
  note,
  label,
  variant,
  hideOctave = false,
}: {
  note: { note: string; octave: number } | null;
  label: string;
  variant: 'target' | 'detected';
  hideOctave?: boolean;
}) {
  return (
    <div className={`game__note-panel game__note-panel--${variant}`}>
      <span className="game__note-label">{label}</span>
      <div className="game__note-wrap">
        <span className="game__note">{note?.note ?? '—'}</span>
        {note && !hideOctave && <span className="game__octave">{note.octave}</span>}
      </div>
      {hideOctave && note && (
        <span className="game__note-hint">Cualquier octava</span>
      )}
    </div>
  );
}

function DegreeDisplay({
  degree,
  keyLabel,
}: {
  degree: number;
  keyLabel: string;
}) {
  return (
    <div className="game__note-panel game__note-panel--target">
      <span className="game__note-label">Tocá este grado</span>
      <p className="game__scale-key">{keyLabel}</p>
      <div className="game__degree-wrap">
        <span className="game__degree">{degree}</span>
        <span className="game__degree-symbol">°</span>
      </div>
      <span className="game__note-hint">{formatScaleDegreeLabel(degree as 1 | 2 | 3 | 4 | 5 | 6 | 7)}</span>
    </div>
  );
}

function modeResultLabel(mode: GameMode): string {
  if (mode === 'general') return 'general';
  if (mode === 'scale') return 'grados';
  return 'específico';
}

export function NoteGame() {
  const [noteCountInput, setNoteCountInput] = useState('');

  const {
    instrument,
    gameMode,
    targetNote,
    selectedKey,
    targetDegree,
    expectedScaleNote,
    note: detectedNote,
    score,
    noteGoal,
    elapsedMs,
    finalTimeMs,
    isSuccess,
    isFinished,
    isListening,
    isActive,
    hasStartedSession,
    error,
    devices,
    selectedDeviceId,
    changeInstrument,
    changeGameMode,
    changeScaleRoot,
    changeScaleQuality,
    startGame,
    resumeGame,
    pauseGame,
    resetGame,
    selectDevice,
    speechMuted,
    toggleSpeechMuted,
  } = useNoteGame();

  const isCorrect =
    isActive &&
    detectedNote !== null &&
    notesMatch(
      detectedNote,
      targetNote,
      gameMode,
      gameMode === 'scale' ? expectedScaleNote : undefined,
    );

  const canChangeSettings = !isListening && (!hasStartedSession || isFinished);
  const selectedKeyLabel = formatScaleKeyLabel(selectedKey);

  const handleToggle = () => {
    if (isListening) {
      pauseGame();
      return;
    }

    if (isFinished || !hasStartedSession) {
      void startGame(selectedDeviceId || undefined, noteCountInput);
      return;
    }

    void resumeGame(selectedDeviceId || undefined);
  };

  const toggleLabel = (() => {
    if (isListening) return 'Pausar';
    if (isFinished) return 'Jugar de nuevo';
    if (hasStartedSession) return 'Reanudar';
    return 'Iniciar juego';
  })();

  const displayedTime = formatElapsedTime(finalTimeMs ?? elapsedMs);

  const statusMessage = (() => {
    if (isFinished) {
      return `Completaste ${noteGoal} desafíos en ${formatElapsedTime(finalTimeMs ?? 0)}`;
    }
    if (!isListening && !hasStartedSession) {
      return gameMode === 'scale'
        ? 'Elegí la escala, configurá las notas e iniciá el juego.'
        : 'Elegí el modo, configurá las notas e iniciá el juego.';
    }
    if (!isListening) return 'Juego en pausa. Reanudá cuando quieras.';
    if (isSuccess) return '¡Correcto! Preparando el siguiente desafío…';
    if (!isActive) {
      if (gameMode === 'scale') {
        return `Tocá el grado indicado en ${selectedKeyLabel}.`;
      }
      if (gameMode === 'general') {
        return 'Tocá la nota indicada en cualquier octava.';
      }
      return 'Tocá la nota indicada en tu guitarra.';
    }
    if (isCorrect) return '¡Esa es! Mantené la nota un instante…';
    return 'Seguí intentando…';
  })();

  const headerDescription = (() => {
    if (gameMode === 'scale') {
      return 'Te pedimos un grado del 1° al 7° de la escala elegida.';
    }
    if (gameMode === 'general') {
      return 'Tocá la nota indicada; la octava no importa.';
    }
    return 'Tocá la nota y octava exactas que te indica el juego.';
  })();

  return (
    <div className="game">
      <div className="game__timer-row">
        <div className={`game__timer ${isListening ? 'game__timer--running' : ''}`}>
          <span className="game__timer-label">Tiempo</span>
          <span className="game__timer-value">{displayedTime}</span>
        </div>
        <button
          type="button"
          className={`game__mute ${speechMuted ? 'game__mute--active' : ''}`}
          onClick={toggleSpeechMuted}
          aria-pressed={speechMuted}
          title={speechMuted ? 'Activar voz' : 'Silenciar voz'}
        >
          {speechMuted ? 'Voz off' : 'Voz on'}
        </button>
      </div>

      <header className="game__header">
        <div className="game__title-row">
          <h1>Desafío de Notas</h1>
          <div className="game__score">
            <span className="game__score-label">Progreso</span>
            <span className="game__score-value">
              {noteGoal === null ? score : `${Math.min(score, noteGoal)} / ${noteGoal}`}
            </span>
          </div>
        </div>
        <p>{headerDescription}</p>
      </header>

      <div className="game__instrument">
        <span className="game__instrument-label">Instrumento</span>
        <div className="game__instrument-toggle" role="group" aria-label="Instrumento">
          {(Object.keys(INSTRUMENTS) as Instrument[]).map((id) => (
            <button
              key={id}
              type="button"
              className={`game__instrument-option ${instrument === id ? 'game__instrument-option--active' : ''}`}
              onClick={() => changeInstrument(id)}
              disabled={!canChangeSettings}
              aria-pressed={instrument === id}
              title={INSTRUMENTS[id].description}
            >
              {INSTRUMENTS[id].label}
            </button>
          ))}
        </div>
      </div>

      <div className="game__mode">
        <span className="game__mode-label">Modo de juego</span>
        <div className="game__mode-toggle" role="group" aria-label="Modo de juego">
          {GAME_MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              className={`game__mode-option ${gameMode === mode.id ? 'game__mode-option--active' : ''}`}
              onClick={() => changeGameMode(mode.id)}
              disabled={!canChangeSettings}
              aria-pressed={gameMode === mode.id}
              title={mode.description}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {gameMode === 'scale' && (
        <div className="game__keys">
          <span className="game__keys-label">Escala</span>
          <div className="game__roots" role="group" aria-label="Tónica de la escala">
            {SCALE_ROOTS.map((root) => (
              <button
                key={root}
                type="button"
                className={`game__root-option ${selectedKey.root === root ? 'game__root-option--active' : ''}`}
                onClick={() => changeScaleRoot(root)}
                disabled={!canChangeSettings}
                aria-pressed={selectedKey.root === root}
              >
                {root}
              </button>
            ))}
          </div>
          <div className="game__quality-toggle" role="group" aria-label="Tipo de escala">
            <button
              type="button"
              className={`game__quality-option ${selectedKey.quality === 'major' ? 'game__quality-option--active' : ''}`}
              onClick={() => changeScaleQuality('major')}
              disabled={!canChangeSettings}
              aria-pressed={selectedKey.quality === 'major'}
            >
              Mayor
            </button>
            <button
              type="button"
              className={`game__quality-option ${selectedKey.quality === 'minor' ? 'game__quality-option--active' : ''}`}
              onClick={() => changeScaleQuality('minor')}
              disabled={!canChangeSettings}
              aria-pressed={selectedKey.quality === 'minor'}
            >
              Menor
            </button>
          </div>
          <span className="game__settings-hint">
            {selectedKeyLabel}
          </span>
        </div>
      )}

      <div className="game__settings">
        <label htmlFor="note-count">Cantidad de notas</label>
        <input
          id="note-count"
          type="number"
          min={1}
          placeholder="∞"
          value={noteCountInput}
          onChange={(event) => setNoteCountInput(event.target.value)}
          disabled={!canChangeSettings}
        />
        <span className="game__settings-hint">
          Vacío = juego infinito
        </span>
      </div>

      <div className="game__device">
        <label htmlFor="audio-input">Entrada de audio</label>
        <select
          id="audio-input"
          value={selectedDeviceId}
          onChange={(event) => selectDevice(event.target.value)}
          disabled={isListening}
        >
          {devices.length === 0 ? (
            <option value="">Sin dispositivos detectados</option>
          ) : (
            devices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Entrada ${device.deviceId.slice(0, 8)}…`}
              </option>
            ))
          )}
        </select>
      </div>

      <div className="game__actions">
        <button type="button" className="game__toggle" onClick={handleToggle}>
          {toggleLabel}
        </button>
        <button
          type="button"
          className="game__reset"
          onClick={resetGame}
          disabled={!hasStartedSession}
        >
          Reiniciar
        </button>
      </div>

      {error && <p className="game__error">{error}</p>}

      <div
        className={[
          'game__board',
          isListening && isActive ? 'game__board--active' : '',
          isSuccess ? 'game__board--success' : '',
          isCorrect && !isSuccess ? 'game__board--matching' : '',
          isFinished ? 'game__board--finished' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {isFinished ? (
          <div className="game__result">
            <p className="game__result-title">¡Ronda completada!</p>
            <p className="game__result-time">{formatElapsedTime(finalTimeMs ?? 0)}</p>
            <p className="game__result-detail">
              {noteGoal} desafíos · modo {modeResultLabel(gameMode)}
              {gameMode === 'scale' ? ` · ${selectedKeyLabel}` : ''} ·{' '}
              {formatElapsedTime(finalTimeMs ?? 0)}
            </p>
          </div>
        ) : gameMode === 'scale' ? (
          <>
            <DegreeDisplay degree={targetDegree} keyLabel={selectedKeyLabel} />

            <p className="game__status">{statusMessage}</p>

            <NoteDisplay
              note={detectedNote}
              label="Estás tocando"
              variant="detected"
            />
          </>
        ) : (
          <>
            <NoteDisplay
              note={targetNote}
              label="Tocá esta nota"
              variant="target"
              hideOctave={gameMode === 'general'}
            />

            <p className="game__status">{statusMessage}</p>

            <NoteDisplay
              note={detectedNote}
              label="Estás tocando"
              variant="detected"
            />
          </>
        )}

        {!isFinished && (
          <p className="game__range">{getInstrumentRangeText(instrument)}</p>
        )}
      </div>
    </div>
  );
}
