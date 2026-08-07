import { CONFIG } from '../data/config.js';
import { nextRandom } from './random.js';

const VALID_STATES = new Set(['title', 'running', 'levelUp', 'paused', 'gameOver']);

function createWeapon(id, config, cooldownMultiplier = 1) {
  return { ...config.weapons[id], cooldown: config.weapons[id].cooldown * cooldownMultiplier, cooldownRemaining: 0, level: 1 };
}

export function createRun({ seed = Date.now(), runId = 1, state = 'title', config = CONFIG } = {}) {
  if (!VALID_STATES.has(state)) throw new Error(`Unknown run state: ${state}`);

  return {
    id: runId,
    state,
    previousState: null,
    time: 0,
    rngState: seed >>> 0,
    nextEntityId: 1,
    spawnTimer: 0,
    nextEliteAt: 240,
    nextWorldRuleAt: 480,
    worldRuleLevel: 0,
    worldRules: [],
    player: {
      x: config.world.width / 2,
      y: config.world.height / 2,
      radius: config.player.radius,
      speed: config.player.speed,
      health: config.player.maxHealth,
      maxHealth: config.player.maxHealth,
      invulnerableUntil: 0,
      level: 1,
      xp: 0,
      xpToNext: config.player.xpCurve[1],
      pickupRadius: config.player.pickupRadius,
      damageMultiplier: 1,
      weaponCooldownMultiplier: 1,
    },
    weapons: { fireball: createWeapon('fireball', config) },
    upgrades: { fireballUnlock: 1 },
    masteries: {},
    weaponMutations: {},
    unlockedReactions: {},
    fusionSlots: [],
    burst: {
      charge: 0,
      maxCharge: config.burst.maxCharge,
      activeUntil: 0,
      activations: 0,
    },
    pendingLevelUps: 0,
    currentUpgradeChoices: [],
    enemies: [],
    projectiles: [],
    xpOrbs: [],
    particles: [],
    reactions: [],
    reactionCooldowns: {},
    reactionTriggerCooldowns: {},
    events: [],
    stats: {
      attacks: 0,
      kills: 0,
      killsByType: {},
      eliteKills: 0,
      xpProduced: 0,
      xpCollected: 0,
      slowEnemySeconds: 0,
      damageTaken: 0,
      lastDamageSource: null,
      damageByWeapon: {},
      damageByReaction: {},
      reactionActivations: {},
      reactionHits: {},
      reactionZeroHitActivations: {},
      milestones: { firstKillAt: null, firstXpAt: null, firstLevelUpAt: null },
      upgradePicks: [],
      current: { enemies: 0, projectiles: 0, xp: 0, particles: 0 },
      peaks: { enemies: 0, projectiles: 0, xp: 0, particles: 0 },
      collision: { candidates: 0, exactChecks: 0 },
      hudWrites: 0,
      fps: {
        average: 0,
        minimum: 0,
        samples: 0,
        hitches: 0,
        maximumInterval: 0,
        rollingMedianFps: 0,
        p95Interval: 0,
        maximumIntervalWindow: 0,
        over33ms: 0,
        over50ms: 0,
        over100ms: 0,
        windowSeconds: 30,
        windowSamples: 0,
      },
    },
  };
}

export function gainBurstCharge(run, amount, config = CONFIG) {
  if (amount <= 0) return run.burst.charge;
  run.burst.charge = Math.min(config.burst.maxCharge, run.burst.charge + amount);
  return run.burst.charge;
}

export function activateBurst(run, config = CONFIG) {
  if (run.state !== 'running'
    || run.time < run.burst.activeUntil
    || run.burst.charge < config.burst.maxCharge) return false;
  run.burst.charge = 0;
  run.burst.activeUntil = run.time + config.burst.duration;
  run.burst.activations += 1;
  run.events.push({ type: 'burstActivate', x: run.player.x, y: run.player.y });
  return true;
}

export function restartRun(run, { seed = Date.now(), config = CONFIG } = {}) {
  return createRun({ seed, runId: run.id + 1, state: 'running', config });
}

export function damagePlayer(run, amount, atTime = run.time, config = CONFIG, source = null) {
  if (run.state !== 'running' || amount <= 0 || atTime < run.player.invulnerableUntil) return false;

  run.player.health = Math.max(0, run.player.health - amount);
  run.player.invulnerableUntil = atTime + config.player.invulnerability;
  run.stats.damageTaken += amount;
  run.stats.lastDamageSource = source ? { ...source } : null;
  if (run.player.health === 0) run.state = 'gameOver';
  return true;
}

export function gainXp(run, amount, config = CONFIG) {
  if (run.state !== 'running' || amount <= 0) return;

  run.player.xp += amount;
  while (run.player.xp >= run.player.xpToNext) {
    if (run.stats.milestones.firstLevelUpAt === null) {
      run.stats.milestones.firstLevelUpAt = run.time;
    }
    run.player.xp -= run.player.xpToNext;
    run.player.level += 1;
    run.pendingLevelUps += 1;
    run.player.xpToNext = config.player.xpCurve[run.player.level]
      ?? config.player.xpCurve.at(-1) + (run.player.level - config.player.xpCurve.length + 1) * 55;
  }

  if (run.pendingLevelUps > 0) run.state = 'levelUp';
}

export function eligibleUpgrades(run, config = CONFIG) {
  return config.upgrades.filter((upgrade) => {
    if (!upgrade.repeatable && run.upgrades[upgrade.id]) return false;
    if (upgrade.minimumLevel && run.player.level < upgrade.minimumLevel) return false;
    if (upgrade.kind === 'reaction' && run.fusionSlots.length >= 2) return false;
    if (upgrade.kind === 'mutation' && run.weaponMutations[upgrade.weapon]) return false;
    return (upgrade.requires ?? []).every((requirement) => run.upgrades[requirement]);
  });
}

export function createUpgradeChoices(run, config = CONFIG, count = 3) {
  const candidates = eligibleUpgrades(run, config);
  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(nextRandom(run) * (index + 1));
    [candidates[index], candidates[swapIndex]] = [candidates[swapIndex], candidates[index]];
  }

  let choices = candidates.slice(0, count);
  if (run.stats.upgradePicks.length === 0 && count >= 2) {
    const routeIds = new Set(['windBladeUnlock', 'iceShardUnlock']);
    const routeChoices = [...routeIds]
      .map((id) => candidates.find((candidate) => candidate.id === id))
      .filter(Boolean);
    const remaining = candidates.filter(({ id }) => !routeIds.has(id));
    choices = [...routeChoices, ...remaining].slice(0, count);
  } else if (run.fusionSlots.length < 2 && count > 0) {
    const reactionChoice = candidates.find(({ kind }) => kind === 'reaction');
    if (reactionChoice && !choices.some(({ kind }) => kind === 'reaction')) {
      choices = [reactionChoice, ...choices.slice(0, count - 1)];
    }
  }
  if (choices.length < count) {
    const chosenIds = new Set(choices.map(({ id }) => id));
    const fallbackMasteries = config.upgrades.filter(({ repeatable, id }) => repeatable && !chosenIds.has(id));
    choices = [...choices, ...fallbackMasteries].slice(0, count);
  }
  run.currentUpgradeChoices = choices.map(({ id }) => id);
  return choices;
}

export function applyUpgrade(run, upgradeId, config = CONFIG) {
  if (run.state !== 'levelUp' || !run.currentUpgradeChoices.includes(upgradeId)) return false;
  const upgrade = config.upgrades.find(({ id }) => id === upgradeId);
  if (!upgrade || (!upgrade.repeatable && run.upgrades[upgradeId])) return false;
  if (upgrade.kind === 'reaction' && run.fusionSlots.length >= 2) return false;
  if (upgrade.kind === 'mutation' && run.weaponMutations[upgrade.weapon]) return false;

  switch (upgrade.kind) {
    case 'unlock':
      run.weapons[upgrade.weapon] = createWeapon(upgrade.weapon, config, run.player.weaponCooldownMultiplier);
      break;
    case 'projectiles':
    case 'radius':
    case 'pierce':
      run.weapons[upgrade.weapon][upgrade.kind] += upgrade.amount;
      break;
    case 'cooldownMultiplier':
      run.weapons[upgrade.weapon].cooldown *= upgrade.amount;
      break;
    case 'slowMultiplier':
      run.weapons[upgrade.weapon].slowMultiplier *= upgrade.amount;
      break;
    case 'moveSpeedMultiplier':
      run.player.speed *= upgrade.amount;
      break;
    case 'mutation':
      run.weaponMutations[upgrade.weapon] = upgrade.behavior;
      break;
    case 'reaction':
      run.fusionSlots.push(upgrade.reaction);
      run.unlockedReactions[upgrade.reaction] = true;
      break;
    case 'damageMultiplier':
      run.player.damageMultiplier *= upgrade.amount;
      break;
    case 'globalCooldownMultiplier':
      run.player.weaponCooldownMultiplier *= upgrade.amount;
      for (const weapon of Object.values(run.weapons)) weapon.cooldown *= upgrade.amount;
      break;
    case 'maxHealth':
      run.player.maxHealth += upgrade.amount;
      run.player.health = Math.min(run.player.maxHealth, run.player.health + upgrade.amount);
      break;
    default:
      return false;
  }
  run.upgrades[upgradeId] = (run.upgrades[upgradeId] ?? 0) + 1;
  if (upgrade.repeatable) run.masteries[upgradeId] = (run.masteries[upgradeId] ?? 0) + 1;
  run.stats.upgradePicks.push(upgradeId);
  run.pendingLevelUps = Math.max(0, run.pendingLevelUps - 1);
  run.currentUpgradeChoices = [];
  run.state = run.pendingLevelUps > 0 ? 'levelUp' : 'running';
  return true;
}
