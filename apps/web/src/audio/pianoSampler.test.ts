import test, { mock } from "node:test";
import { equal, deepEqual, ok } from "node:assert/strict";

const loops: FakeLoop[] = [];
const parts: FakePart[] = [];
const draws: Array<() => void> = [];
const clicks: unknown[][] = [];
const played: unknown[][] = [];
let releases = 0;
const transport = { bpm: { value: 60 }, position: 0, start: (_time?: number) => {}, stop: () => {} };
class FakeLoop {
  disposed = false;
  callback: (time: number) => void;
  interval: number;
  constructor(callback: (time: number) => void, interval: number) { this.callback = callback; this.interval = interval; loops.push(this); }
  start() { return this; }
  stop() {}
  dispose() { this.disposed = true; }
}
class FakePart {
  disposed = false;
  callback: (time: number, note: any) => void;
  events: any[];
  constructor(callback: (time: number, note: any) => void, events: any[]) { this.callback = callback; this.events = events; parts.push(this); }
  start() { return this; }
  dispose() { this.disposed = true; }
}
class FakeSampler {
  loaded = true;
  toDestination() { return this; }
  connect() { return this; }
  triggerAttackRelease(...args: unknown[]) { played.push(args); }
  releaseAll() { releases++; }
}
class FakeSynth {
  toDestination() { return this; }
  triggerAttackRelease(...args: unknown[]) { clicks.push(args); }
  triggerRelease() {}
}
mock.module("tone", { namedExports: {
  Sampler: FakeSampler, Synth: FakeSynth, Gain: class { toDestination() { return this; } },
  Loop: FakeLoop, Part: FakePart,
  Frequency: (note: number) => ({ toNote: () => String(note) }),
  now: () => 10.1, immediate: () => 10,
  getTransport: () => transport,
  getDraw: () => ({ schedule: (callback: () => void) => draws.push(callback) }),
  start: async () => {}, loaded: async () => {},
} });
const audio = await import("./pianoSampler.ts");

test("performance schedules the piece before count-in, preserves chords, and cancels stale callbacks", () => {
  let started = 0;
  const counts: number[] = [];
  const before = performance.now();
  const deadline = audio.startPerformanceCountIn([
    { noteNumber: 60, noteNumbers: [60, 64, 67], startBeat: 0, durationBeats: 1 },
  ], 60, [3, 4], true, false, n => counts.push(n), () => started++);
  ok(deadline >= before + 3140 && deadline < performance.now() + 3160);
  const loop = loops.at(-1)!;
  equal(loop.interval, 1);
  const part = parts.at(-1)!;
  equal(part.events[0].time, 3);
  part.callback(13.15, part.events[0]);
  deepEqual(played.at(-1)?.[0], ["60", "64", "67"]);
  for (let i = 0; i <= 3; i++) loop.callback(10.15 + i);
  deepEqual(clicks.slice(-4).map(c => c[0]), ["C6", "G5", "G5", "C6"]);
  draws.splice(0).forEach(fn => fn());
  deepEqual(counts, [3, 2, 1]);
  equal(started, 1);
  loop.callback(14.15);
  audio.stopExercisePlayback();
  draws.splice(0).forEach(fn => fn());
  equal(started, 1);
  equal(part.disposed, true);
  equal(loop.disposed, true);
  ok(releases > 0);
});

test("stopping during count-in cancels pending start; 6/8 clicks are eighth notes", () => {
  let started = 0;
  audio.startPerformanceCountIn([], 60, [6, 8], false, false, () => {}, () => started++);
  const loop = loops.at(-1)!;
  equal(loop.interval, 0.5);
  for (let i = 0; i <= 6; i++) loop.callback(10 + i * 0.5);
  audio.stopExercisePlayback();
  draws.splice(0).forEach(fn => fn());
  equal(started, 0);
});

test("restarting preview disposes the earlier schedule and swing matches grading", () => {
  audio.scheduleExercisePlayback([{ noteNumber: 60, startBeat: 0.5, durationBeats: 1 }], 60, true);
  const previous = parts.at(-1)!;
  equal(previous.events[0].time, 2 / 3);
  audio.scheduleExercisePlayback([], 60);
  equal(previous.disposed, true);
  audio.stopExercisePlayback();
});
