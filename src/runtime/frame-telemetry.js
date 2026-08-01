export function createFrameSampler() {
  return { lastAt: null, totalInterval: 0 };
}

export function recordFrame(stats, sampler, now, active) {
  if (!active) {
    sampler.lastAt = null;
    return;
  }

  if (sampler.lastAt === null) {
    sampler.lastAt = now;
    return;
  }

  const interval = now - sampler.lastAt;
  sampler.lastAt = now;
  if (interval <= 0) return;

  stats.fps.maximumInterval = Math.max(stats.fps.maximumInterval ?? 0, interval);
  if (interval > 250) {
    stats.fps.hitches = (stats.fps.hitches ?? 0) + 1;
    return;
  }

  sampler.totalInterval += interval;
  stats.fps.samples += 1;
  const currentFps = 1000 / interval;
  stats.fps.average = (stats.fps.samples * 1000) / sampler.totalInterval;
  stats.fps.minimum = stats.fps.samples === 1
    ? currentFps
    : Math.min(stats.fps.minimum, currentFps);
}
