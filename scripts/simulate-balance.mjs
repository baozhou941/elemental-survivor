import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

import { CONFIG } from '../src/data/config.js';
import {
  activateBurst,
  applyUpgrade,
  createRun,
  createUpgradeChoices,
} from '../src/core/model.js';
import { stepSimulation } from '../src/core/simulation.js';

const UPGRADE_PRIORITIES = Object.freeze({
  auto: Object.freeze([
    'windBladeUnlock', 'fireTornado', 'fireballVolley', 'iceShardUnlock', 'thermalShock',
    'windBladeHaste', 'fleetFooted', 'windBladePierce', 'fireballBlast', 'iceShardDeepFreeze',
  ]),
  wind: Object.freeze([
    'windBladeUnlock', 'fireTornado', 'fireballVolley', 'windBladeHaste', 'windBladePierce',
    'fleetFooted', 'fireballBlast', 'iceShardUnlock', 'iceShardDeepFreeze',
  ]),
  ice: Object.freeze([
    'iceShardUnlock', 'thermalShock', 'fireballVolley', 'iceShardDeepFreeze', 'fleetFooted',
    'fireballBlast', 'windBladeUnlock', 'windBladeHaste', 'windBladePierce',
  ]),
});

function rounded(value, digits = 6) {
  return Number(value.toFixed(digits));
}

function steeringInput(run, config) {
  const player = run.player;
  let x = 0;
  let y = 0;
  let closestThreat = Infinity;

  for (const enemy of run.enemies) {
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const distance = Math.hypot(dx, dy) || 1;
    closestThreat = Math.min(closestThreat, distance);
    if (distance < 300) {
      const strength = (300 - distance) / 300;
      x += (dx / distance) * strength;
      y += (dy / distance) * strength;
    }
  }

  if (closestThreat > 210 && run.xpOrbs.length > 0) {
    let nearestOrb = null;
    let nearestDistance = Infinity;
    for (const orb of run.xpOrbs) {
      const distance = Math.hypot(orb.x - player.x, orb.y - player.y);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestOrb = orb;
      }
    }
    if (nearestOrb) {
      x += (nearestOrb.x - player.x) / Math.max(1, nearestDistance);
      y += (nearestOrb.y - player.y) / Math.max(1, nearestDistance);
    }
  }

  const margin = 260;
  if (player.x < margin) x += (margin - player.x) / margin;
  if (player.x > config.world.width - margin) x -= (player.x - (config.world.width - margin)) / margin;
  if (player.y < margin) y += (margin - player.y) / margin;
  if (player.y > config.world.height - margin) y -= (player.y - (config.world.height - margin)) / margin;

  if (Math.abs(x) + Math.abs(y) < 0.01) x = 1;
  return { x, y };
}

function chooseUpgrade(run, config, route) {
  const choices = createUpgradeChoices(run, config);
  if (choices.length === 0) {
    run.pendingLevelUps = 0;
    run.state = 'running';
    return;
  }
  const selected = UPGRADE_PRIORITIES[route]
    .map((id) => choices.find((choice) => choice.id === id))
    .find(Boolean) ?? choices[0];
  applyUpgrade(run, selected.id, config);
}

function serialiseRun(run, seed, duration, route) {
  const reactionHits = Object.values(run.stats.reactionHits).reduce((sum, value) => sum + value, 0);
  const zeroHitActivations = Object.values(run.stats.reactionZeroHitActivations)
    .reduce((sum, value) => sum + value, 0);
  return {
    seed,
    route,
    fusionSlots: [...run.fusionSlots],
    mutations: { ...run.weaponMutations },
    masteries: { ...run.masteries },
    worldRules: [...run.worldRules],
    burstActivations: run.burst.activations,
    targetDuration: duration,
    survived: run.time >= duration && run.state !== 'gameOver',
    state: run.state,
    time: rounded(run.time),
    health: rounded(run.player.health),
    level: run.player.level,
    xp: rounded(run.player.xp),
    kills: run.stats.kills,
    killsByType: { ...run.stats.killsByType },
    damageTaken: rounded(run.stats.damageTaken),
    damageByWeapon: { ...run.stats.damageByWeapon },
    damageByReaction: { ...run.stats.damageByReaction },
    reactionActivations: { ...run.stats.reactionActivations },
    reactionHits,
    reactionZeroHitActivations: zeroHitActivations,
    xpProduced: run.stats.xpProduced,
    xpCollected: run.stats.xpCollected,
    slowEnemySeconds: rounded(run.stats.slowEnemySeconds),
    milestones: { ...run.stats.milestones },
    peaks: { ...run.stats.peaks },
    weapons: Object.keys(run.weapons).sort(),
    reactions: Object.keys(run.unlockedReactions).sort(),
    upgrades: [...run.stats.upgradePicks],
  };
}

export function simulateBalanceRun({ seed, duration = 180, route = 'auto', config = CONFIG }) {
  if (!UPGRADE_PRIORITIES[route]) throw new Error(`Unknown simulation route: ${route}`);
  const run = createRun({ config, seed });
  run.state = 'running';

  while (run.time < duration && run.state !== 'gameOver') {
    if (run.state === 'levelUp') {
      chooseUpgrade(run, config, route);
      continue;
    }
    if (run.burst.charge >= run.burst.maxCharge && run.time >= run.burst.activeUntil) {
      activateBurst(run, config);
    }
    const dt = Math.min(config.fixedStep, duration - run.time);
    stepSimulation(run, { dt, input: steeringInput(run, config), config });
  }

  return serialiseRun(run, seed, duration, route);
}

function metricSummary(values) {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
  return {
    minimum: rounded(sorted[0]),
    maximum: rounded(sorted.at(-1)),
    average: rounded(sorted.reduce((sum, value) => sum + value, 0) / sorted.length),
    median: rounded(median),
  };
}

export function aggregateBalanceRuns(runs, targetDuration) {
  const survived = runs.filter((run) => run.survived).length;
  const metric = (selector) => metricSummary(runs.map(selector));
  const upgradePickRates = {};
  for (const run of runs) {
    for (const upgradeId of new Set(run.upgrades)) {
      upgradePickRates[upgradeId] = (upgradePickRates[upgradeId] ?? 0) + 1;
    }
  }
  for (const id of Object.keys(upgradePickRates)) {
    upgradePickRates[id] = rounded(upgradePickRates[id] / runs.length);
  }

  return {
    sampleSize: runs.length,
    targetDuration,
    survived,
    survivalRate: runs.length === 0 ? 0 : rounded(survived / runs.length),
    metrics: {
      duration: metric((run) => run.time),
      health: metric((run) => run.health),
      level: metric((run) => run.level),
      kills: metric((run) => run.kills),
      damageTaken: metric((run) => run.damageTaken),
      firstKillAt: metric((run) => run.milestones.firstKillAt),
      firstXpAt: metric((run) => run.milestones.firstXpAt),
      firstLevelUpAt: metric((run) => run.milestones.firstLevelUpAt),
      xpProduced: metric((run) => run.xpProduced),
      xpCollected: metric((run) => run.xpCollected),
      reactionHits: metric((run) => run.reactionHits),
      reactionZeroHitActivations: metric((run) => run.reactionZeroHitActivations),
      burstActivations: metric((run) => run.burstActivations),
      peakEnemies: metric((run) => run.peaks.enemies),
      peakProjectiles: metric((run) => run.peaks.projectiles),
      peakParticles: metric((run) => run.peaks.particles),
    },
    upgradePickRates,
  };
}

function argumentValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

async function main() {
  const count = Number(argumentValue('--runs', 30));
  const duration = Number(argumentValue('--duration', 180));
  const route = argumentValue('--route', 'auto');
  const output = argumentValue('--output', null);
  if (!Number.isInteger(count) || count < 1 || !Number.isFinite(duration) || duration <= 0 || !UPGRADE_PRIORITIES[route]) {
    throw new Error('Usage: --runs <positive integer> --duration <positive seconds> [--route auto|wind|ice] [--output <path>]');
  }
  const runs = Array.from({ length: count }, (_, index) => simulateBalanceRun({
    seed: index + 1,
    duration,
    route,
  }));
  const result = { report: aggregateBalanceRuns(runs, duration), runs };
  const json = `${JSON.stringify(result, null, 2)}\n`;
  if (output) {
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, json, 'utf8');
  }
  process.stdout.write(JSON.stringify(result.report, null, 2));
  process.stdout.write('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
