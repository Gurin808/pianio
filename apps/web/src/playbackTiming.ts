/** Content timestamps and durations are measured in quarter notes, including x/8. */
export function meterTiming(bpm: number, signature: readonly number[]) {
  const [numerator, denominator] = signature;
  const pulseBeats = 4 / denominator;
  return {
    pulses: numerator,
    pulseSeconds: (60 / bpm) * pulseBeats,
    measureBeats: numerator * pulseBeats,
    countInSeconds: numerator * pulseBeats * (60 / bpm),
  };
}

export function swingBeat(beat: number, swing = false): number {
  return swing && Math.abs(beat % 1 - 0.5) < 0.001 ? Math.floor(beat) + 2 / 3 : beat;
}

export const PERFORMANCE_WINDOW_MS = 350;

export function findPerformanceHit(
  expected: readonly { noteNumber: number; timeMs: number; index: number }[],
  hits: ReadonlySet<number>, noteNumber: number, elapsedMs: number,
): number {
  let bestIndex = -1;
  let bestDelta = Infinity;
  for (const note of expected) {
    const delta = Math.abs(elapsedMs - note.timeMs);
    if (!hits.has(note.index) && note.noteNumber === noteNumber &&
        delta <= PERFORMANCE_WINDOW_MS && delta < bestDelta) {
      bestIndex = note.index;
      bestDelta = delta;
    }
  }
  return bestIndex;
}

/** Keep a chord highlighted for its whole onset, without counting its pitches. */
export function performanceCursorBeat(
  notes: readonly { startBeat: number }[], elapsedMs: number, bpm: number, swing = false,
): number | null {
  let beat: number | null = null;
  for (const note of notes) {
    if (swingBeat(note.startBeat, swing) * 60000 / bpm <= elapsedMs) beat = note.startBeat;
    else break;
  }
  return beat ?? notes[0]?.startBeat ?? null;
}

export function scoreStepAtBeat(positions: readonly { beat: number; step: number }[], beat: number): number {
  let step = positions[0]?.step ?? 0;
  for (const position of positions) {
    if (position.beat > beat + 0.00001) break;
    step = position.step;
  }
  return step;
}
