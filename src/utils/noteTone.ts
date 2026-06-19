let audioContext: AudioContext | null = null;
let oscillator: OscillatorNode | null = null;
let gainNode: GainNode | null = null;
let activeFrequency: number | null = null;

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

export function stopReferenceTone(): void {
  const context = audioContext;
  const osc = oscillator;
  const gain = gainNode;

  oscillator = null;
  gainNode = null;
  activeFrequency = null;

  if (!context || !osc || !gain) return;

  const now = context.currentTime;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.001), now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

  window.setTimeout(() => {
    try {
      osc.stop();
    } catch {
      // already stopped
    }
    osc.disconnect();
    gain.disconnect();
  }, 90);
}

export function startReferenceTone(frequency: number): void {
  const context = getAudioContext();
  if (!context) return;

  void context.resume();

  if (oscillator && gainNode && activeFrequency === frequency) {
    return;
  }

  if (oscillator && gainNode) {
    activeFrequency = frequency;
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);
    return;
  }

  stopReferenceTone();

  const osc = context.createOscillator();
  const gain = context.createGain();
  const now = context.currentTime;

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(frequency, now);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.12, now + 0.06);

  osc.connect(gain);
  gain.connect(context.destination);
  osc.start();

  oscillator = osc;
  gainNode = gain;
  activeFrequency = frequency;
}

export function disposeReferenceTone(): void {
  stopReferenceTone();
  if (audioContext && audioContext.state !== 'closed') {
    void audioContext.close();
  }
  audioContext = null;
}
