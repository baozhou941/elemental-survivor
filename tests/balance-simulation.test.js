import test from 'node:test';
import assert from 'node:assert/strict';

import { aggregateBalanceRuns, simulateBalanceRun } from '../scripts/simulate-balance.mjs';

test('balance simulation is deterministic for a fixed seed', () => {
  const first = simulateBalanceRun({ seed: 17, duration: 15 });
  const second = simulateBalanceRun({ seed: 17, duration: 15 });

  assert.deepEqual(first, second);
  assert.equal(first.seed, 17);
  assert.ok(first.time >= 15);
  assert.ok(first.kills > 0);
});

test('balance simulation aggregates survival and timing ranges', () => {
  const runs = [1, 2, 3].map((seed) => simulateBalanceRun({ seed, duration: 15 }));
  const report = aggregateBalanceRuns(runs, 15);

  assert.equal(report.sampleSize, 3);
  assert.equal(report.targetDuration, 15);
  assert.equal(report.survived, 3);
  assert.equal(report.survivalRate, 1);
  assert.ok(report.metrics.kills.minimum <= report.metrics.kills.maximum);
});

test('wind and ice simulation routes independently establish their intended reaction', () => {
  for (const route of ['wind', 'ice']) {
    const expectedReaction = route === 'wind' ? 'fireTornado' : 'thermalShock';
    const rejectedReaction = route === 'wind' ? 'thermalShock' : 'fireTornado';
    for (const seed of [1, 2, 3]) {
      const run = simulateBalanceRun({ seed, duration: 90, route });
      assert.equal(run.route, route);
      assert.equal(run.reactionSlot, expectedReaction);
      assert.ok(run.reactions.includes(expectedReaction));
      assert.ok(!run.reactions.includes(rejectedReaction));
    }
  }
});

test('ice route survives at least nine of ten fixed three-minute runs', () => {
  const runs = Array.from({ length: 10 }, (_, index) => simulateBalanceRun({
    seed: index + 1,
    duration: 180,
    route: 'ice',
  }));

  assert.ok(runs.filter(({ survived }) => survived).length >= 9);
});
