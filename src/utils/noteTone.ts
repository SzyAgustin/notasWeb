let audioContext: AudioContext | null = null;
let oscillators: OscillatorNode[] = [];
let gainNodes: GainNode[] = [];
let activeFrequencies: number[] = [];

function getAudioContext(): AudioContext | null {
  const AudioContextClass =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextClass) return null;

  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new AudioContextClass();
  }

  return audioContext;
}

function sameFrequencies(left: number[], right: number[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((frequency, index) => frequency === right[index]);
}

export function stopReferenceTone(): void {
  const context = audioContext;
  const oscs = oscillators;
  const gains = gainNodes;

  oscillators = [];
  gainNodes = [];
  activeFrequencies = [];

  if (!context || oscs.length === 0) return;

  const now = context.currentTime;
  for (let i = 0; i < oscs.length; i++) {
    const gain = gains[i];
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.001), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  }

  window.setTimeout(() => {
    for (let i = 0; i < oscs.length; i++) {
      try {
        oscs[i].stop();
      } catch {
        // already stopped
      }
      oscs[i].disconnect();
      gains[i].disconnect();
    }
  }, 90);
}

export function startReferenceTone(frequencies: number[]): void {
  const context = getAudioContext();
  if (!context) return;

  const next = [...frequencies].sort((left, right) => left - right);
  if (next.length === 0) {
    stopReferenceTone();
    return;
  }

  void context.resume();

  if (oscillators.length > 0 && sameFrequencies(activeFrequencies, next)) {
    return;
  }

  stopReferenceTone();

  const now = context.currentTime;
  const level = 0.12 / Math.sqrt(next.length);

  next.forEach((frequency) => {
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(level, now + 0.06);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start();
    oscillators.push(osc);
    gainNodes.push(gain);
  });

  activeFrequencies = next;
}

export function disposeReferenceTone(): void {
  stopReferenceTone();
  if (audioContext && audioContext.state !== 'closed') {
    void audioContext.close();
  }
  audioContext = null;
}
