export interface ProgressExport {
  version: 1;
  exportedAt: string;
  completed: string[];
  stars: Record<string, 1 | 2 | 3>;
  streakDates: string[];
}

export const PROGRESS_KEYS = ["pianio:completed", "pianio:stars", "pianio:streak_dates"] as const;
export const IMPORT_BACKUP_KEY = "pianio:before_import";
export type ImportMode = "merge" | "replace";
type Result<T> = { ok: true; value: T } | { ok: false; message: string };

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exerciseKey(value: unknown): value is string {
  return typeof value === "string" && value.length <= 1000 &&
    value.split("/").length === 2 && value.split("/").every(part => part.trim().length > 0);
}

function day(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}

/** Validate the entire file before allowing any storage writes. Unknown exercises are retained. */
export function parseProgress(json: string): Result<ProgressExport> {
  let value: unknown;
  try { value = JSON.parse(json); }
  catch { return { ok: false, message: "Invalid JSON file." }; }
  if (!record(value) || value.version !== 1 || typeof value.exportedAt !== "string" ||
      !Number.isFinite(Date.parse(value.exportedAt)) ||
      !Array.isArray(value.completed) || !value.completed.every(exerciseKey) ||
      !record(value.stars) || !Object.entries(value.stars).every(([key, stars]) =>
        exerciseKey(key) && (stars === 1 || stars === 2 || stars === 3)) ||
      !Array.isArray(value.streakDates) || !value.streakDates.every(day)) {
    return { ok: false, message: "Invalid Pianio export. Expected version 1, an export date, exercise IDs, 1–3 star ratings, and valid practice dates. Nothing was changed." };
  }
  return { ok: true, value: {
    version: 1, exportedAt: value.exportedAt,
    completed: [...new Set(value.completed as string[])],
    stars: Object.fromEntries(Object.entries(value.stars)) as ProgressExport["stars"],
    streakDates: [...new Set(value.streakDates as string[])].sort(),
  } };
}

export function readProgress(storage: Pick<Storage, "getItem">): ProgressExport {
  const raw = PROGRESS_KEYS.map(key => storage.getItem(key));
  const result = parseProgress(JSON.stringify({
    version: 1, exportedAt: new Date().toISOString(),
    completed: JSON.parse(raw[0] ?? "[]"), stars: JSON.parse(raw[1] ?? "{}"),
    streakDates: JSON.parse(raw[2] ?? "[]"),
  }));
  if (!result.ok) throw new Error("Existing progress could not be read safely. Export a backup and do not replace it.");
  return result.value;
}

export function combineProgress(current: ProgressExport, incoming: ProgressExport): ProgressExport {
  const stars = { ...current.stars };
  for (const [key, rating] of Object.entries(incoming.stars)) {
    stars[key] = Math.max(stars[key] ?? 0, rating) as 1 | 2 | 3;
  }
  return { ...incoming,
    completed: [...new Set([...current.completed, ...incoming.completed])], stars,
    streakDates: [...new Set([...current.streakDates, ...incoming.streakDates])].sort(),
  };
}

/** Keep a raw recovery snapshot first; roll back all collections if any write fails. */
export function applyProgressImport(
  json: string,
  mode: ImportMode,
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
): { ok: boolean; message: string } {
  const parsed = parseProgress(json);
  if (!parsed.ok) return parsed;
  let before: (string | null)[];
  let data: ProgressExport;
  try {
    before = PROGRESS_KEYS.map(key => storage.getItem(key));
    // Refuse even replacement if existing records cannot be understood safely.
    const current = readProgress(storage);
    data = mode === "merge" ? combineProgress(current, parsed.value) : parsed.value;
    storage.setItem(IMPORT_BACKUP_KEY, JSON.stringify({
      version: 1, savedAt: new Date().toISOString(),
      values: Object.fromEntries(PROGRESS_KEYS.map((key, i) => [key, before[i]])),
    }));
  } catch {
    return { ok: false, message: "Could not read progress or save the recovery backup. Nothing was changed. Download a backup and check available browser storage." };
  }
  try {
    const values = [data.completed, data.stars, data.streakDates];
    PROGRESS_KEYS.forEach((key, i) => storage.setItem(key, JSON.stringify(values[i])));
    return { ok: true, message: `${mode === "merge" ? "Merged" : "Replaced"} progress: ${data.completed.length} completed exercises. A pre-import recovery copy is saved in this browser. Keep your downloaded backup too.` };
  } catch {
    let restored = true;
    PROGRESS_KEYS.forEach((key, i) => {
      try {
        if (before[i] === null) storage.removeItem(key);
        else storage.setItem(key, before[i]!);
      } catch { restored = false; }
    });
    return { ok: false, message: restored
      ? "Import failed. Your previous progress was restored. Keep your downloaded backup."
      : "Import failed and could not fully restore progress. Stop practicing here and recover from your downloaded backup. The raw pre-import copy is retained under pianio:before_import." };
  }
}
