import type { ScaleDegree } from './scales';

const DEGREE_SPEECH: Record<ScaleDegree, string> = {
  1: 'first',
  2: 'second',
  3: 'third',
  4: 'fourth',
  5: 'fifth',
  6: 'sixth',
  7: 'seventh',
};

/** "Eb" → "E flat", "F#" → "F sharp", "E#" → "E sharp". */
export function spellingToSpeech(spelling: string, octave?: number): string {
  const letter = spelling[0] ?? spelling;
  const accidental = spelling.slice(1);
  let spoken = letter;
  if (accidental === '#') spoken = `${letter} sharp`;
  else if (accidental === 'b') spoken = `${letter} flat`;
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
  utterance.volume = 0.8;
  window.speechSynthesis.speak(utterance);
}

export function speakNote(spelling: string, octave?: number): void {
  speakText(spellingToSpeech(spelling, octave));
}

export function speakScaleDegree(degree: ScaleDegree): void {
  speakText(scaleDegreeToSpeech(degree));
}
