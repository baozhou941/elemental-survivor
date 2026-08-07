export function createFrameSampler() {
  return {
    lastAt: null,
    totalInterval: 0,
    windowSeconds: 30,
    window: [],
    windowHead: 0,
    sortedIntervals: [],
  };
}

function lowerBound(values, target) {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (values[middle] < target) low = middle + 1;
    else high = middle;
  }
  return low;
}

function upperBound(values, target) {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (values[middle] <= target) low = middle + 1;
    else high = middle;
  }
  return low;
}

function removeSortedInterval(values, interval) {
  const index = lowerBound(values, interval);
  if (index < values.length && values[index] === interval) values.splice(index, 1);
}

function refreshWindowStats(stats, sampler, now) {
  const cutoff = now - sampler.windowSeconds * 1000;
  while (sampler.windowHead < sampler.window.length
    && sampler.window[sampler.windowHead].at <= cutoff) {
    removeSortedInterval(sampler.sortedIntervals, sampler.window[sampler.windowHead].interval);
    sampler.windowHead += 1;
  }
  if (sampler.windowHead > 256 && sampler.windowHead * 2 > sampler.window.length) {
    sampler.window = sampler.window.slice(sampler.windowHead);
    sampler.windowHead = 0;
  }

  const intervals = sampler.sortedIntervals;
  const count = intervals.length;
  stats.fps.windowSeconds = sampler.windowSeconds;
  stats.fps.windowSamples = count;
  if (count === 0) {
    stats.fps.rollingMedianFps = 0;
    stats.fps.p95Interval = 0;
    stats.fps.maximumIntervalWindow = 0;
    stats.fps.over33ms = 0;
    stats.fps.over50ms = 0;
    stats.fps.over100ms = 0;
    return;
  }

  const middle = count >> 1;
  const medianInterval = count % 2 === 0
    ? (intervals[middle - 1] + intervals[middle]) / 2
    : intervals[middle];
  stats.fps.rollingMedianFps = 1000 / medianInterval;
  stats.fps.p95Interval = intervals[Math.ceil(count * 0.95) - 1];
  stats.fps.maximumIntervalWindow = intervals[count - 1];
  stats.fps.over33ms = count - upperBound(intervals, 33);
  stats.fps.over50ms = count - upperBound(intervals, 50);
  stats.fps.over100ms = count - upperBound(intervals, 100);
}

export function recordFrame(stats, sampler, now, active) {
  if (!active) {
    sampler.lastAt = null;
    refreshWindowStats(stats, sampler, now);
    return;
  }

  if (sampler.lastAt === null) {
    sampler.lastAt = now;
    refreshWindowStats(stats, sampler, now);
    return;
  }

  const interval = now - sampler.lastAt;
  sampler.lastAt = now;
  if (interval <= 0) return;

  stats.fps.maximumInterval = Math.max(stats.fps.maximumInterval ?? 0, interval);
  if (interval > 250) {
    stats.fps.hitches = (stats.fps.hitches ?? 0) + 1;
    refreshWindowStats(stats, sampler, now);
    return;
  }

  sampler.window.push({ at: now, interval });
  sampler.sortedIntervals.splice(lowerBound(sampler.sortedIntervals, interval), 0, interval);
  refreshWindowStats(stats, sampler, now);
  sampler.totalInterval += interval;
  stats.fps.samples += 1;
  const currentFps = 1000 / interval;
  stats.fps.average = (stats.fps.samples * 1000) / sampler.totalInterval;
  stats.fps.minimum = stats.fps.samples === 1
    ? currentFps
    : Math.min(stats.fps.minimum, currentFps);
}
