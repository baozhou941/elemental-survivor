import test from 'node:test';
import assert from 'node:assert/strict';

import { SpatialGrid } from '../src/core/spatial-grid.js';

test('spatial grid inserts and returns only nearby circular entities', () => {
  const grid = new SpatialGrid(64);
  const near = { id: 1, x: 20, y: 20, radius: 8 };
  const edge = { id: 2, x: 82, y: 20, radius: 8 };
  const far = { id: 3, x: 240, y: 20, radius: 8 };
  grid.insert(near);
  grid.insert(edge);
  grid.insert(far);

  assert.deepEqual(grid.queryCircle(20, 20, 56).map(({ id }) => id), [1, 2]);
});

test('entities spanning several cells are returned without duplicates', () => {
  const grid = new SpatialGrid(32);
  const large = { id: 7, x: 32, y: 32, radius: 40 };
  grid.insert(large);

  assert.deepEqual(grid.queryCircle(32, 32, 48).map(({ id }) => id), [7]);
});

test('rebuild removes entities that are no longer present', () => {
  const grid = new SpatialGrid(64);
  grid.rebuild([
    { id: 1, x: 5, y: 5, radius: 2 },
    { id: 2, x: 10, y: 10, radius: 2 },
  ]);
  assert.equal(grid.queryCircle(0, 0, 32).length, 2);

  grid.rebuild([{ id: 2, x: 10, y: 10, radius: 2 }]);
  assert.deepEqual(grid.queryCircle(0, 0, 32).map(({ id }) => id), [2]);
});

test('negative and out-of-world coordinates remain queryable', () => {
  const grid = new SpatialGrid(50);
  grid.rebuild([
    { id: 10, x: -20, y: -15, radius: 3 },
    { id: 11, x: 5000, y: 4000, radius: 3 },
  ]);

  assert.deepEqual(grid.queryCircle(-20, -15, 5).map(({ id }) => id), [10]);
  assert.deepEqual(grid.queryCircle(5000, 4000, 5).map(({ id }) => id), [11]);
});

test('query can reuse a caller-owned result array', () => {
  const grid = new SpatialGrid(64);
  const output = [{ id: -1 }];
  grid.insert({ id: 4, x: 0, y: 0, radius: 2 });

  assert.equal(grid.queryCircle(0, 0, 10, output), output);
  assert.deepEqual(output.map(({ id }) => id), [4]);
});
