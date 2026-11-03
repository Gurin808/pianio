# Pianio practice edition

Based on https://github.com/ismaelponce/pianio, retaining its curriculum and MIT/CC0 licensing.

## Changes

- Establish a shared audio/MIDI downbeat before the count-in. First notes can match within the same ±350 ms window as later notes, even during the last count-in beat.
- Position the score cursor by quarter-note timestamps rather than pitch counts. Performance keeps each chord's score position until the next onset; ties/rests no longer shift the event-to-score mapping. Keep cursor containment within the score.
- Add visible Stop/Restart controls and a stoppable preview. Dispose future playback events, release sounding notes, cancel completion timers, and invalidate pending asynchronous starts. Switching modes/exercises also cancels playback.
- Use the time-signature numerator for count-in/accent cycles and the denominator for click spacing and measure loops. 3/4 has three quarter-note clicks; 6/8 has six eighth-note clicks. Tempo remains quarter notes per minute, matching the content's timestamps.
- Share swing timing between playback, scoring, and the indicator; play every pitch in preview/accompaniment chords.
- Wait for audio samples before starting and use immediate audio scheduling for live keyboard feedback.

## Validation

Run `pnpm typecheck`, `pnpm test`, and `pnpm build` (Node 24+ for TypeScript/module-mocking tests).

The playback tests cover early/late first-note windows, duplicate pitches, chord cursor timing, tie/rest timestamp mapping, 3/4 and 6/8 timing, canceled count-ins, and restarted preview schedules. Audio scheduling is mocked; a real MIDI keyboard is still needed for end-to-end latency and listening checks.

The inherited core matcher tests expected summary objects from before velocity/pedal scores were added. Their expected objects now include those existing nullable fields; runtime matcher behavior was not changed.

Manual checks on Chrome/Edge with a wired MIDI keyboard:

1. In performance mode, play the first note slightly before, on, and after the opening downbeat. Confirm each is registered within the timing window.
2. Stop/restart during count-in, during a piece, and during Preview. Wait beyond the previous completion time: no old playback or result dialog should reappear.
3. Play a piece with chords, ties, rests, and both hands; check the indicator through zoom and window resizing.
4. Enable Metro on 3/4 and 6/8 exercises. Verify the count-in length, accent cycle, and click spacing match the displayed meter.

## Curriculum scope

The content supplies progressive drills and repertoire, but its numbered levels are internal, not exam grades. Completing exercises is not evidence of relaxed technique, good fingering, articulation, phrasing, or readiness for advanced repertoire. Use technique demonstrations and occasional human feedback alongside MIDI practice.
