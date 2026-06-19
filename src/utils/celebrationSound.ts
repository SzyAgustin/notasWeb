const CHIME_NOTES = [
  { frequency: 523.25, delay: 0, duration: 0.32 },
  { frequency: 659.25, delay: 0.07, duration: 0.32 },
  { frequency: 783.99, delay: 0.14, duration: 0.45 },
] as const;

export function playCelebrationSound(): void {
  const AudioContextClass =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextClass) return;

  const context = new AudioContextClass();
  const startTime = context.currentTime;

  const masterGain = context.createGain();
  masterGain.gain.setValueAtTime(0, startTime);
  masterGain.gain.linearRampToValueAtTime(0.16, startTime + 0.025);
  masterGain.gain.exponentialRampToValueAtTime(0.001, startTime + 1.1);
  masterGain.connect(context.destination);

  for (const { frequency, delay, duration } of CHIME_NOTES) {
    const noteStart = startTime + delay;
    const oscillator = context.createOscillator();
    const noteGain = context.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, noteStart);

    noteGain.gain.setValueAtTime(0, noteStart);
    noteGain.gain.linearRampToValueAtTime(0.48, noteStart + 0.02);
    noteGain.gain.exponentialRampToValueAtTime(0.001, noteStart + duration);

    oscillator.connect(noteGain);
    noteGain.connect(masterGain);
    oscillator.start(noteStart);
    oscillator.stop(noteStart + duration + 0.05);
  }

  void context.resume().finally(() => {
    window.setTimeout(() => {
      void context.close();
    }, 1300);
  });
}
