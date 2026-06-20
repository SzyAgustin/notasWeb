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

export { SCALE_ROOTS };

const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_INTERVALS = [0, 2, 3, 5, 7, 8, 10];

const DEGREE_ORDINALS: Record<ScaleDegree, string> = {
  1: '1era',
  2: '2da',
  3: '3era',
  4: '4ta',
  5: '5ta',
  6: '6ta',
  7: '7ma',
};

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

export function formatScaleKeyLabel(key: ScaleKey): string {
  return `${key.root} ${key.quality === 'major' ? 'mayor' : 'menor'}`;
}

export function formatScaleDegreeLabel(degree: ScaleDegree): string {
  return `${degree}° (${DEGREE_ORDINALS[degree]})`;
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
