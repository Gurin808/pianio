import test from "node:test";
import { deepEqual, equal } from "node:assert/strict";
import { meterTiming, swingBeat, findPerformanceHit, performanceCursorBeat, scoreStepAtBeat } from "./playbackTiming.ts";

test("count-in and accents follow the numerator and denominator", () => {
  deepEqual(meterTiming(60, [3, 4]), { pulses: 3, pulseSeconds: 1, measureBeats: 3, countInSeconds: 3 });
  deepEqual(meterTiming(60, [6, 8]), { pulses: 6, pulseSeconds: 0.5, measureBeats: 3, countInSeconds: 3 });
  equal(meterTiming(120, [2, 2]).countInSeconds, 2);
});

test("first note has the same early and late window across the count-in boundary", () => {
  const notes = [{ noteNumber: 60, timeMs: 0, index: 0 }, { noteNumber: 60, timeMs: 1000, index: 1 }];
  for (const time of [-350, -150, 0, 150, 350]) equal(findPerformanceHit(notes, new Set(), 60, time), 0);
  equal(findPerformanceHit(notes, new Set(), 60, -351), -1);
  equal(findPerformanceHit(notes, new Set([0]), 60, 0), -1);
  equal(findPerformanceHit(notes, new Set(), 61, 0), -1);
  equal(findPerformanceHit(notes, new Set([0]), 60, 850), 1);
});

test("chords do not advance the performance cursor by their pitch count", () => {
  const notes = [{ startBeat: 0 }, { startBeat: 1 }, { startBeat: 3 }];
  equal(performanceCursorBeat(notes, 0, 60), 0);
  equal(performanceCursorBeat(notes, 999, 60), 0);
  equal(performanceCursorBeat(notes, 1000, 60), 1);
  equal(performanceCursorBeat(notes, 2999, 60), 1);
  equal(performanceCursorBeat(notes, 3000, 60), 3);
});

test("score positioning uses musical timestamps, skipping ties and respecting rests", () => {
  const positions = [{ beat: 0, step: 0 }, { beat: 1, step: 1 }, { beat: 2, step: 2 }, { beat: 4, step: 5 }];
  // A tie at beat 1 adds a score position but not a new expected attack.
  equal(scoreStepAtBeat(positions, 2), 2);
  equal(scoreStepAtBeat(positions, 4), 5);
});

test("swing has one timing conversion for grading, audio, and cursor", () => {
  equal(swingBeat(0.5, true), 2 / 3);
  equal(swingBeat(0.5, false), 0.5);
  equal(performanceCursorBeat([{ startBeat: 0 }, { startBeat: 0.5 }], 600, 60, true), 0);
  equal(performanceCursorBeat([{ startBeat: 0 }, { startBeat: 0.5 }], 667, 60, true), 0.5);
});
