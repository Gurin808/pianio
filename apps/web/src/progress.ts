const STORAGE_KEY = "pianio:completed";
const STARS_KEY = "pianio:stars";

function loadCompleted(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return new Set(parsed as string[]);
  } catch {
    // ignore
  }
  return new Set();
}

function saveCompleted(set: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    // ignore
  }
}

function loadStars(): Record<string, 1 | 2 | 3> {
  try {
    const raw = localStorage.getItem(STARS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, 1 | 2 | 3>;
    }
  } catch {
    // ignore
  }
  return {};
}

function saveStars(stars: Record<string, 1 | 2 | 3>): void {
  try {
    localStorage.setItem(STARS_KEY, JSON.stringify(stars));
  } catch {
    // ignore
  }
}

function makeKey(courseId: string, exerciseSlug: string): string {
  return `${courseId}/${exerciseSlug}`;
}

export function markExerciseComplete(
  courseId: string,
  exerciseSlug: string,
  stars: 1 | 2 | 3 = 1
): void {
  const key = makeKey(courseId, exerciseSlug);

  const set = loadCompleted();
  set.add(key);
  saveCompleted(set);

  // Save best (highest) star rating
  const starsMap = loadStars();
  const current = starsMap[key] ?? 0;
  if (stars > current) {
    starsMap[key] = stars;
    saveStars(starsMap);
  }
}

export function isExerciseComplete(courseId: string, exerciseSlug: string): boolean {
  return loadCompleted().has(makeKey(courseId, exerciseSlug));
}

export function getBestStars(courseId: string, exerciseSlug: string): 1 | 2 | 3 | null {
  const stars = loadStars()[makeKey(courseId, exerciseSlug)];
  return stars ?? null;
}

export function getCompletedSlugs(courseId: string): Set<string> {
  const all = loadCompleted();
  const result = new Set<string>();
  for (const key of all) {
    const [cid, slug] = key.split("/");
    if (cid === courseId && slug) result.add(slug);
  }
  return result;
}

export function getCompletedCount(courseId: string): number {
  return getCompletedSlugs(courseId).size;
}

// ── Practice streak ──────────────────────────────────────────
const STREAK_KEY = "pianio:streak_dates";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function offsetISO(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Call once per exercise completion to stamp today's date. */
export function recordPracticeDay(): void {
  const today = todayISO();
  let dates: string[] = [];
  try {
    dates = JSON.parse(localStorage.getItem(STREAK_KEY) ?? "[]") as string[];
    if (!Array.isArray(dates)) dates = [];
  } catch { dates = []; }
  if (!dates.includes(today)) {
    dates.push(today);
    if (dates.length > 365) dates = dates.slice(-365);
    try { localStorage.setItem(STREAK_KEY, JSON.stringify(dates)); } catch { /* ignore */ }
  }
}

/** Returns the current consecutive-day streak (0 if none). */
export function getPracticeStreak(): number {
  let dates: string[] = [];
  try {
    dates = JSON.parse(localStorage.getItem(STREAK_KEY) ?? "[]") as string[];
    if (!Array.isArray(dates)) return 0;
  } catch { return 0; }
  if (dates.length === 0) return 0;

  const dateSet = new Set(dates);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Allow streak to stay alive if they haven't practiced yet today (yesterday counts)
  const startStr = dateSet.has(todayISO())
    ? todayISO()
    : dateSet.has(offsetISO(today, -1))
    ? offsetISO(today, -1)
    : null;

  if (!startStr) return 0;

  let streak = 0;
  const cursor = new Date(startStr);
  cursor.setHours(0, 0, 0, 0);
  while (dateSet.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// ── Reset ─────────────────────────────────────────────────────
export function resetProgress(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(STARS_KEY);
  localStorage.removeItem(STREAK_KEY);
}

// ── Export / Import ───────────────────────────────────────────
export function exportProgress(): boolean {
  try {
    // Preserve raw collections in the downloaded file, even if a future validator rejects them.
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      completed: JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"),
      stars: JSON.parse(localStorage.getItem(STARS_KEY) ?? "{}"),
      streakDates: JSON.parse(localStorage.getItem(STREAK_KEY) ?? "[]"),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pianio-progress-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return true;
  } catch {
    return false;
  }
}
