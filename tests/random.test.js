import test from 'node:test';
import assert from 'node:assert/strict';

import { nextRandom } from '../src/core/random.js';

test('seeded random sequences repeat while different seeds diverge', () => {
  const first = { rngState: 1234 };
  const second = { rngState: 1234 };
  const other = { rngState: 4321 };

  const firstSequence = Array.from({ length: 5 }, () => nextRandom(first));
  const secondSequence = Array.from({ length: 5 }, () => nextRandom(second));
  const otherSequence = Array.from({ length: 5 }, () => nextRandom(other));

  assert.deepEqual(firstSequence, secondSequence);
  assert.notDeepEqual(firstSequence, otherSequence);
  assert.ok(firstSequence.every((value) => value >= 0 && value < 1));
});
