import { NOTE_NAMES, type NoteName } from './notes';

export type ScaleQuality = 'major' | 'minor';

export interface ScaleKey {
  root: NoteName;
  quality: ScaleQuality;
}

export type ScaleDegree = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/**
 * En modo Grados, qué se pide al jugador:
 * - 'degree': el número de grado (1°–7°), cualquier octava.
 * - 'note': la nota resultante del grado, cualquier octava.
 * - 'specific': una nota y octava exactas dentro de la escala.
 */
export type ScalePromptMode = 'degree' | 'note' | 'specific';

const SCALE_ROOTS: NoteName[] = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'];

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
const NATURAL_PC = [0, 2, 4, 5, 7, 9, 11] as const;

export interface ScaleRootOption {
  /** Grafía de la tónica, como en Acordes de diapasonWeb. */
  label: string;
  /** Clase de altura con sostenido: es la que compara el afinador. */
  note: NoteName;
}

/**
 * Tónicas en el orden del círculo de quintas (sostenidos y después bemoles).
 * Misma grafía que las filas de Acordes: Db mayor y C# menor, no al revés.
 */
const MAJOR_ROOTS: ScaleRootOption[] = [
  { label: 'C', note: 'C' },
  { label: 'G', note: 'G' },
  { label: 'D', note: 'D' },
  { label: 'A', note: 'A' },
  { label: 'E', note: 'E' },
  { label: 'B', note: 'B' },
  { label: 'F#', note: 'F#' },
  { label: 'F', note: 'F' },
  { label: 'Bb', note: 'A#' },
  { label: 'Eb', note: 'D#' },
  { label: 'Ab', note: 'G#' },
  { label: 'Db', note: 'C#' },
];

const MINOR_ROOTS: ScaleRootOption[] = [
  { label: 'A', note: 'A' },
  { label: 'E', note: 'E' },
  { label: 'B', note: 'B' },
  { label: 'F#', note: 'F#' },
  { label: 'C#', note: 'C#' },
  { label: 'G#', note: 'G#' },
  { label: 'D#', note: 'D#' },
  { label: 'D', note: 'D' },
  { label: 'G', note: 'G' },
  { label: 'C', note: 'C' },
  { label: 'F', note: 'F' },
  { label: 'Bb', note: 'A#' },
];

export function getScaleRoots(quality: ScaleQuality): ScaleRootOption[] {
  return quality === 'major' ? MAJOR_ROOTS : MINOR_ROOTS;
}

const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_INTERVALS = [0, 2, 3, 5, 7, 8, 10];

export function getAllScaleKeys(): ScaleKey[] {
  const keys: ScaleKey[] = [];

  for (const root of SCALE_ROOTS) {
    keys.push({ root, quality: 'major' });
    keys.push({ root, quality: 'minor' });
  }

  return keys;
}

export function scaleKeyId(key: ScaleKey): string {
  return `${key.root}-${key.quality}`;
}

export function formatRootSpelling(key: ScaleKey): string {
  return getScaleRoots(key.quality).find((root) => root.note === key.root)?.label ?? key.root;
}

export function formatScaleKeyLabel(key: ScaleKey): string {
  return `${formatRootSpelling(key)} ${key.quality === 'major' ? 'mayor' : 'menor'}`;
}

/** Escribe una letra en la clase de altura pedida (Db, E#, F…). */
function spelledName(letterIndex: number, pc: number): string {
  const index = ((letterIndex % 7) + 7) % 7;
  const letter = LETTERS[index];
  const natural = NATURAL_PC[index];
  const pitch = ((pc % 12) + 12) % 12;
  let accidental = pitch - natural;
  if (accidental > 6) accidental -= 12;
  if (accidental < -6) accidental += 12;
  if (accidental === 1) return `${letter}#`;
  if (accidental === -1) return `${letter}b`;
  return letter;
}

/** Las siete notas, con la armadura de esa tónica (Eb mayor: Eb F G Ab Bb C D). */
export function getScaleSpellings(key: ScaleKey): string[] {
  const rootLabel = formatRootSpelling(key);
  const letter = LETTERS.indexOf(rootLabel[0] as (typeof LETTERS)[number]);
  const rootIndex = noteIndex(key.root);
  const intervals = key.quality === 'major' ? MAJOR_INTERVALS : MINOR_INTERVALS;

  return intervals.map((interval, degree) =>
    spelledName(letter + degree, (rootIndex + interval) % 12),
  );
}

/** Grafía de una nota de la escala. Si no pertenece, queda el nombre con #. */
export function spellScaleNote(key: ScaleKey, note: NoteName): string {
  const index = getScaleNotes(key).indexOf(note);
  if (index === -1) return note;
  return getScaleSpellings(key)[index] ?? note;
}

function noteIndex(note: NoteName): number {
  return NOTE_NAMES.indexOf(note);
}

export function getScaleNotes(key: ScaleKey): NoteName[] {
  const intervals = key.quality === 'major' ? MAJOR_INTERVALS : MINOR_INTERVALS;
  const rootIndex = noteIndex(key.root);

  return intervals.map((interval) => NOTE_NAMES[(rootIndex + interval) % 12]);
}

export function getScaleDegreeNote(key: ScaleKey, degree: ScaleDegree): NoteName {
  return getScaleNotes(key)[degree - 1];
}

export function pickRandomScaleDegree(exclude?: ScaleDegree): ScaleDegree {
  const pool = ([1, 2, 3, 4, 5, 6, 7] as ScaleDegree[]).filter((degree) => degree !== exclude);
  return pool[Math.floor(Math.random() * pool.length)] ?? 1;
}
