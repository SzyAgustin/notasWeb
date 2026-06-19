import type { Instrument } from './instruments';
import { getInstrumentConfig } from './instruments';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export { NOTE_NAMES };

export type NoteName = (typeof NOTE_NAMES)[number];

export interface NoteInfo {
  note: NoteName;
  octave: number;
  cents: number;
  fullName: string;
  frequency: number;
  midi: number;
}

export function midiToNote(midi: number): NoteInfo {
  const noteIndex = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const note = NOTE_NAMES[noteIndex];

  return {
    note,
    octave,
    cents: 0,
    fullName: `${note}${octave}`,
    frequency: 440 * 2 ** ((midi - 69) / 12),
    midi,
  };
}

export function getInstrumentGameNotes(instrument: Instrument): number[] {
  const { minMidi, maxMidi } = getInstrumentConfig(instrument);
  const notes: number[] = [];

  for (let midi = minMidi; midi <= maxMidi; midi++) {
    notes.push(midi);
  }

  return notes;
}

export type GameMode = 'specific' | 'general' | 'scale';

export function notesMatch(
  detected: NoteInfo,
  target: NoteInfo,
  mode: GameMode,
  expectedNote?: NoteName,
): boolean {
  if (mode === 'scale') {
    return expectedNote !== undefined && detected.note === expectedNote;
  }
  if (mode === 'general') {
    return detected.note === target.note;
  }
  return detected.midi === target.midi;
}

export function getInstrumentPitchClasses(instrument: Instrument): NoteName[] {
  const classes = new Set<NoteName>();

  for (const midi of getInstrumentGameNotes(instrument)) {
    classes.add(midiToNote(midi).note);
  }

  return [...classes];
}

export function pickRandomGameNote(
  instrument: Instrument,
  exclude?: { midi?: number; note?: NoteName },
  mode: GameMode = 'specific',
): NoteInfo {
  const { minMidi } = getInstrumentConfig(instrument);
  const gameNotes = getInstrumentGameNotes(instrument);

  if (mode === 'general') {
    const pool = getInstrumentPitchClasses(instrument).filter((note) => note !== exclude?.note);
    const note = pool[Math.floor(Math.random() * pool.length)] ?? 'E';
    const midi = gameNotes.find((value) => midiToNote(value).note === note) ?? minMidi;
    return midiToNote(midi);
  }

  const pool = gameNotes.filter((midi) => midi !== exclude?.midi);
  const midi = pool[Math.floor(Math.random() * pool.length)] ?? minMidi;
  return midiToNote(midi);
}

export function getReferenceFrequencyForNoteName(
  note: NoteName,
  instrument: Instrument,
): number {
  const gameNotes = getInstrumentGameNotes(instrument);
  const matches = gameNotes.filter((midi) => midiToNote(midi).note === note);
  const midi = matches[Math.floor(matches.length / 2)] ?? 69;
  return midiToNote(midi).frequency;
}

export function frequencyToNote(frequency: number): NoteInfo {
  const midi = 12 * Math.log2(frequency / 440) + 69;
  const roundedMidi = Math.round(midi);
  const cents = Math.round((midi - roundedMidi) * 100);
  const noteIndex = ((roundedMidi % 12) + 12) % 12;
  const octave = Math.floor(roundedMidi / 12) - 1;
  const note = NOTE_NAMES[noteIndex];

  return {
    note,
    octave,
    cents,
    fullName: `${note}${octave}`,
    frequency: 440 * 2 ** ((roundedMidi - 69) / 12),
    midi: roundedMidi,
  };
}

export function getRms(buffer: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i] * buffer[i];
  }
  return Math.sqrt(sum / buffer.length);
}
