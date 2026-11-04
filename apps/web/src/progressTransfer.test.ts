import assert from "node:assert/strict";
import { test } from "node:test";
import { applyProgressImport, IMPORT_BACKUP_KEY, parseProgress, PROGRESS_KEYS, readProgress, type ProgressExport } from "./progressTransfer.ts";

const progress = (patch: Partial<ProgressExport> = {}): ProgressExport => ({
  version: 1, exportedAt: "2026-11-03T12:00:00Z", completed: ["course/first"],
  stars: { "course/first": 3 }, streakDates: ["2026-11-01"], ...patch,
});
function storage(initial = progress()) {
  const data = new Map<string, string>([
    [PROGRESS_KEYS[0], JSON.stringify(initial.completed)],
    [PROGRESS_KEYS[1], JSON.stringify(initial.stars)],
    [PROGRESS_KEYS[2], JSON.stringify(initial.streakDates)],
  ]);
  return { data, getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
  };
}

test("validates the complete file and rejects malformed collections without writes", () => {
  for (const bad of ["{", "[]", JSON.stringify({ version: 1 }), ...[
    { stars: [] }, { stars: { "course/first": 4 } }, { completed: [null] },
    { completed: ["missing-course"] }, { streakDates: ["2026-02-30"] },
    { exportedAt: "yesterday" }, { version: 2 },
  ].map(patch => JSON.stringify({ ...progress(), ...patch }))]) {
    const store = storage();
    const before = [...store.data];
    assert.equal(applyProgressImport(bad, "merge", store).ok, false);
    assert.deepEqual([...store.data], before);
  }
});

test("merges completions, highest stars, and practice dates without losing local progress", () => {
  const store = storage();
  const incoming = progress({ completed: ["course/second"],
    stars: { "course/first": 1, "course/second": 2 }, streakDates: ["2026-11-02"] });
  assert.equal(applyProgressImport(JSON.stringify(incoming), "merge", store).ok, true);
  const saved = readProgress(store);
  assert.deepEqual(saved.completed, ["course/first", "course/second"]);
  assert.deepEqual(saved.stars, { "course/first": 3, "course/second": 2 });
  assert.deepEqual(saved.streakDates, ["2026-11-01", "2026-11-02"]);
  const snapshot = JSON.parse(store.getItem(IMPORT_BACKUP_KEY)!);
  assert.equal(snapshot.values[PROGRESS_KEYS[0]], '["course/first"]');
});

test("replacement is explicit and still saves a raw recovery copy", () => {
  const store = storage();
  const incoming = progress({ completed: [], stars: {}, streakDates: [] });
  assert.equal(applyProgressImport(JSON.stringify(incoming), "replace", store).ok, true);
  assert.deepEqual(readProgress(store).completed, []);
  assert.ok(store.getItem(IMPORT_BACKUP_KEY));
});

test("backup failure aborts before touching practice collections", () => {
  const store = storage();
  const before = [...store.data];
  const failed = { ...store, setItem: () => { throw new Error("quota"); } };
  assert.equal(applyProgressImport(JSON.stringify(progress()), "merge", failed).ok, false);
  assert.deepEqual([...store.data], before);
});

test("a partial write failure rolls all progress collections back", () => {
  const store = storage();
  const before = PROGRESS_KEYS.map(key => store.getItem(key));
  let failed = false;
  const failing = { ...store, setItem: (key: string, value: string) => {
    if (key === PROGRESS_KEYS[1] && !failed) { failed = true; throw new Error("write failed"); }
    store.setItem(key, value);
  } };
  const result = applyProgressImport(JSON.stringify(progress({ completed: ["new/exercise"] })), "replace", failing);
  assert.equal(result.ok, false);
  assert.match(result.message, /restored/);
  assert.deepEqual(PROGRESS_KEYS.map(key => store.getItem(key)), before);
  assert.ok(store.getItem(IMPORT_BACKUP_KEY));
});

test("rollback removes previously absent keys rather than introducing empty records", () => {
  const store = storage();
  store.data.clear();
  let failed = false;
  const failing = { ...store, setItem: (key: string, value: string) => {
    if (key === PROGRESS_KEYS[2] && !failed) { failed = true; throw new Error("write failed"); }
    store.setItem(key, value);
  } };
  assert.equal(applyProgressImport(JSON.stringify(progress()), "merge", failing).ok, false);
  assert.deepEqual(PROGRESS_KEYS.map(key => store.getItem(key)), [null, null, null]);
});

test("does not overwrite existing corrupt records, even in replacement mode", () => {
  const store = storage();
  store.setItem(PROGRESS_KEYS[1], "broken JSON");
  const before = [...store.data];
  assert.equal(applyProgressImport(JSON.stringify(progress()), "replace", store).ok, false);
  assert.deepEqual([...store.data], before);
});

test("deduplicates records and retains exercises not in the local catalog", () => {
  const result = parseProgress(JSON.stringify(progress({ completed: ["unknown/exercise", "unknown/exercise"] })));
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.value.completed, ["unknown/exercise"]);
});

test("reports failed rollback and retains the backup for recovery", () => {
  const store = storage();
  const failing = { ...store, setItem: (key: string, value: string) => {
    if (key === PROGRESS_KEYS[1]) throw new Error("storage inaccessible");
    store.setItem(key, value);
  } };
  const result = applyProgressImport(JSON.stringify(progress()), "replace", failing);
  assert.equal(result.ok, false);
  assert.match(result.message, /could not fully restore/);
  assert.ok(store.getItem(IMPORT_BACKUP_KEY));
});
