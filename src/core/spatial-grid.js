export class SpatialGrid {
  constructor(cellSize = 96) {
    if (cellSize <= 0) throw new Error('cellSize must be positive');
    this.cellSize = cellSize;
    this.buckets = new Map();
    this.bucketPool = [];
    this.seen = new Set();
    this.order = new Map();
  }

  clear() {
    for (const bucket of this.buckets.values()) {
      bucket.length = 0;
      this.bucketPool.push(bucket);
    }
    this.buckets.clear();
    this.seen.clear();
    this.order.clear();
  }

  rebuild(entities) {
    this.clear();
    for (const entity of entities) this.insert(entity);
  }

  insert(entity) {
    if (this.order.has(entity)) return;
    this.order.set(entity, this.order.size);
    this.insertIntoCells(entity);
  }

  insertIntoCells(entity) {
    const radius = entity.radius ?? 0;
    const minX = Math.floor((entity.x - radius) / this.cellSize);
    const maxX = Math.floor((entity.x + radius) / this.cellSize);
    const minY = Math.floor((entity.y - radius) / this.cellSize);
    const maxY = Math.floor((entity.y + radius) / this.cellSize);

    for (let cellY = minY; cellY <= maxY; cellY += 1) {
      for (let cellX = minX; cellX <= maxX; cellX += 1) {
        const key = `${cellX},${cellY}`;
        let bucket = this.buckets.get(key);
        if (!bucket) {
          bucket = this.bucketPool.pop() ?? [];
          this.buckets.set(key, bucket);
        }
        bucket.push(entity);
      }
    }
  }

  update(entity, previousX, previousY) {
    if (!this.order.has(entity)) {
      this.insert(entity);
      return;
    }
    const radius = entity.radius ?? 0;
    const minX = Math.floor((previousX - radius) / this.cellSize);
    const maxX = Math.floor((previousX + radius) / this.cellSize);
    const minY = Math.floor((previousY - radius) / this.cellSize);
    const maxY = Math.floor((previousY + radius) / this.cellSize);
    for (let cellY = minY; cellY <= maxY; cellY += 1) {
      for (let cellX = minX; cellX <= maxX; cellX += 1) {
        const key = `${cellX},${cellY}`;
        const bucket = this.buckets.get(key);
        if (!bucket) continue;
        const index = bucket.indexOf(entity);
        if (index >= 0) bucket.splice(index, 1);
        if (bucket.length === 0) {
          this.buckets.delete(key);
          this.bucketPool.push(bucket);
        }
      }
    }
    this.insertIntoCells(entity);
  }

  get size() {
    return this.order.size;
  }

  queryCircleCandidates(x, y, radius, output = []) {
    output.length = 0;
    this.seen.clear();
    const minX = Math.floor((x - radius) / this.cellSize);
    const maxX = Math.floor((x + radius) / this.cellSize);
    const minY = Math.floor((y - radius) / this.cellSize);
    const maxY = Math.floor((y + radius) / this.cellSize);

    for (let cellY = minY; cellY <= maxY; cellY += 1) {
      for (let cellX = minX; cellX <= maxX; cellX += 1) {
        const bucket = this.buckets.get(`${cellX},${cellY}`);
        if (!bucket) continue;
        for (const entity of bucket) {
          if (this.seen.has(entity)) continue;
          this.seen.add(entity);
          output.push(entity);
        }
      }
    }
    output.sort((left, right) => this.order.get(left) - this.order.get(right));
    return output;
  }

  queryCircle(x, y, radius, output = []) {
    this.queryCircleCandidates(x, y, radius, output);
    let outputIndex = 0;
    for (const entity of output) {
      const dx = entity.x - x;
      const dy = entity.y - y;
      const reach = radius + (entity.radius ?? 0);
      if (dx * dx + dy * dy <= reach * reach) {
        output[outputIndex] = entity;
        outputIndex += 1;
      }
    }
    output.length = outputIndex;
    return output;
  }
}
