export class SpatialGrid {
  constructor(cellSize = 96) {
    if (cellSize <= 0) throw new Error('cellSize must be positive');
    this.cellSize = cellSize;
    this.buckets = new Map();
    this.seen = new Set();
  }

  clear() {
    for (const bucket of this.buckets.values()) bucket.length = 0;
  }

  rebuild(entities) {
    this.clear();
    for (const entity of entities) this.insert(entity);
  }

  insert(entity) {
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
          bucket = [];
          this.buckets.set(key, bucket);
        }
        bucket.push(entity);
      }
    }
  }

  queryCircle(x, y, radius, output = []) {
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
          if (this.seen.has(entity.id)) continue;
          this.seen.add(entity.id);
          const dx = entity.x - x;
          const dy = entity.y - y;
          const reach = radius + (entity.radius ?? 0);
          if (dx * dx + dy * dy <= reach * reach) output.push(entity);
        }
      }
    }
    return output;
  }
}
