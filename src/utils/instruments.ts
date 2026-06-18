export type Instrument = 'guitar' | 'bass';

export interface InstrumentConfig {
  id: Instrument;
  label: string;
  minMidi: number;
  maxMidi: number;
  rangeLabel: string;
  description: string;
}

/** Guitarra estándar 6 cuerdas, 22 trastes. */
const GUITAR: InstrumentConfig = {
  id: 'guitar',
  label: 'Guitarra',
  minMidi: 40,
  maxMidi: 85,
  rangeLabel: 'E2 — C#6',
  description: '6 cuerdas · 22 trastes',
};

/** Bajo estándar 4 cuerdas (E-A-D-G), 22 trastes. */
const BASS: InstrumentConfig = {
  id: 'bass',
  label: 'Bajo',
  minMidi: 28,
  maxMidi: 65,
  rangeLabel: 'E1 — F4',
  description: '4 cuerdas · 22 trastes',
};

export const INSTRUMENTS: Record<Instrument, InstrumentConfig> = {
  guitar: GUITAR,
  bass: BASS,
};

export function getInstrumentConfig(instrument: Instrument): InstrumentConfig {
  return INSTRUMENTS[instrument];
}

export function getInstrumentFrequencyRange(instrument: Instrument): {
  min: number;
  max: number;
} {
  const { minMidi, maxMidi } = INSTRUMENTS[instrument];
  const minFrequency = 440 * 2 ** ((minMidi - 69) / 12);
  const maxFrequency = 440 * 2 ** ((maxMidi - 69) / 12);

  return {
    min: minFrequency * 0.95,
    max: maxFrequency * 1.05,
  };
}

export function getInstrumentRangeText(instrument: Instrument): string {
  const config = INSTRUMENTS[instrument];
  return `Rango: ${config.rangeLabel} · ${config.description}`;
}
