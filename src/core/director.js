import { CONFIG } from '../data/config.js';

export function getEncounterPlan(run, config = CONFIG) {
  const time = Math.max(0, run.time);
  const phase = time % 40 < 24 ? 'pressure' : 'release';
  const killRate = run.stats.kills / Math.max(1, time);
  const powerBonus = Math.min(0.22, run.player.level * 0.012 + killRate * 0.04);
  const onboardingRelief = Math.max(0, 1 - time / 45) * 0.35;
  const baseInterval = Math.max(0.3, 0.9 + onboardingRelief - time * 0.002 - powerBonus);
  const spawnInterval = baseInterval * (phase === 'release' ? 1.4 : 1);
  const mix = [{ id: 'chaser', weight: 1 }];

  if (time >= 40) mix.push({ id: 'swift', weight: Math.min(0.7, 0.25 + time / 400) });
  if (time >= 90) mix.push({ id: 'brute', weight: Math.min(0.5, 0.12 + time / 700) });

  const targetEnemyCount = Math.min(config.limits.enemies, Math.floor(30 + time * 0.2));
  const remaining = Math.max(0, targetEnemyCount - run.enemies.length);
  const batchSize = Math.min(2, 1 + Math.floor(time / 180));
  const endlessMinutes = Math.max(0, time - 180) / 60;
  const healthScale = 1 + endlessMinutes * 0.14;
  const damageScale = 1 + endlessMinutes * 0.08;
  const speedScale = 1 + Math.min(0.35, endlessMinutes * 0.025);
  const nextEliteAt = run.nextEliteAt ?? 240;

  return {
    phase,
    mix,
    spawnInterval,
    batchSize,
    targetEnemyCount,
    spawnCount: Math.min(batchSize, remaining),
    canSpawn: remaining > 0,
    elite: time >= nextEliteAt && remaining > 0,
    healthScale,
    damageScale,
    speedScale,
  };
}
