const STORAGE_KEY = 'elemental-survivor-leaderboard';
const MAX_ENTRIES = 5;

export function loadLeaderboard(storage = globalThis.localStorage) {
  try {
    const value = JSON.parse(storage?.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function recordLeaderboardEntry(storage, entry) {
  const normalized = {
    time: Math.max(0, Number(entry.time) || 0),
    kills: Math.max(0, Math.floor(Number(entry.kills) || 0)),
    level: Math.max(1, Math.floor(Number(entry.level) || 1)),
    recordedAt: entry.recordedAt ?? new Date().toISOString(),
  };
  const entries = [...loadLeaderboard(storage), normalized]
    .sort((left, right) => right.time - left.time)
    .slice(0, MAX_ENTRIES);
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Private browsing and restricted storage must not break game over.
  }
  return entries;
}
