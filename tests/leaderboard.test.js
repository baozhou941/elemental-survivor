import test from 'node:test';
import assert from 'node:assert/strict';

import { loadLeaderboard, recordLeaderboardEntry } from '../src/runtime/leaderboard.js';

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

test('local leaderboard keeps the five longest survival times', () => {
  const local = storage();
  for (const time of [90, 320, 180, 70, 410, 240]) {
    recordLeaderboardEntry(local, { time, kills: Math.floor(time / 2), level: 8 });
  }

  assert.deepEqual(loadLeaderboard(local).map(({ time }) => time), [410, 320, 240, 180, 90]);
});

test('leaderboard safely recovers from invalid local data', () => {
  const local = storage({ 'elemental-survivor-leaderboard': '{broken' });
  assert.deepEqual(loadLeaderboard(local), []);
});
