import type { NoteName } from './notes';
import type { ScaleDegree } from './scales';

const NOTE_SPEECH: Record<NoteName, string> = {
  C: 'C',
  'C#': 'C sharp',
  D: 'D',
  'D#': 'D sharp',
  E: 'E',
  F: 'F',
  'F#': 'F sharp',
  G: 'G',
  'G#': 'G sharp',
  A: 'A',
  'A#': 'A sharp',
  B: 'B',
};

const DEGREE_SPEECH: Record<ScaleDegree, string> = {
  1: 'first',
  2: 'second',
  3: 'third',
  4: 'fourth',
  5: 'fifth',
  6: 'sixth',
  7: 'seventh',
};

export function noteToSpeech(note: NoteName, octave?: number): string {
  const spoken = NOTE_SPEECH[note];
  return octave === undefined ? spoken : `${spoken}, ${octave}`;
}

export function scaleDegreeToSpeech(degree: ScaleDegree): string {
  return DEGREE_SPEECH[degree];
}

export function cancelSpeech(): void {
  window.speechSynthesis?.cancel();
}

export function speakText(text: string): void {
  if (!window.speechSynthesis) return;

  cancelSpeech();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = 0.95;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}

export function speakNote(note: NoteName, octave?: number): void {
  speakText(noteToSpeech(note, octave));
}

export function speakScaleDegree(degree: ScaleDegree): void {
  speakText(scaleDegreeToSpeech(degree));
}
