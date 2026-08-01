const weapons = Object.freeze({
  fireball: Object.freeze({
    id: 'fireball',
    name: '火球',
    element: 'fire',
    cooldown: 0.72,
    damage: 18,
    speed: 520,
    lifetime: 1.25,
    radius: 8,
    projectiles: 1,
    pierce: 0,
  }),
  windBlade: Object.freeze({
    id: 'windBlade',
    name: '风刃',
    element: 'wind',
    cooldown: 1.05,
    damage: 12,
    speed: 650,
    lifetime: 0.85,
    radius: 11,
    projectiles: 1,
    pierce: 2,
  }),
  iceShard: Object.freeze({
    id: 'iceShard',
    name: '冰晶',
    element: 'ice',
    cooldown: 1.2,
    damage: 15,
    speed: 470,
    lifetime: 1.4,
    radius: 9,
    projectiles: 1,
    pierce: 0,
    slowMultiplier: 0.62,
    slowDuration: 1.5,
  }),
});

const enemies = Object.freeze({
  chaser: Object.freeze({ id: 'chaser', name: '追猎体', health: 24, speed: 74, radius: 14, damage: 1, xp: 5 }),
  swift: Object.freeze({ id: 'swift', name: '迅袭体', health: 14, speed: 126, radius: 10, damage: 1, xp: 4 }),
  brute: Object.freeze({ id: 'brute', name: '重压体', health: 72, speed: 42, radius: 21, damage: 1, xp: 12 }),
});

const upgrades = Object.freeze([
  Object.freeze({ id: 'fireballUnlock', name: '点燃核心', description: '获得会自动追踪最近敌人的火球。', rarity: 'common', weapon: 'fireball', kind: 'unlock' }),
  Object.freeze({ id: 'fireballVolley', name: '双生火焰', description: '火球数量 +1，扇形覆盖更宽。', rarity: 'rare', weapon: 'fireball', kind: 'projectiles', amount: 1, requires: ['fireballUnlock'] }),
  Object.freeze({ id: 'fireballBlast', name: '熔核膨胀', description: '火球体积显著增大，更容易命中怪群。', rarity: 'common', weapon: 'fireball', kind: 'radius', amount: 7, requires: ['fireballUnlock'] }),
  Object.freeze({ id: 'windBladeUnlock', name: '风刃', description: '获得高速贯穿风刃；与火焰共鸣可进化为火焰龙卷。', rarity: 'common', weapon: 'windBlade', kind: 'unlock' }),
  Object.freeze({ id: 'windBladePierce', name: '裂空', description: '风刃额外贯穿 2 个敌人。', rarity: 'common', weapon: 'windBlade', kind: 'pierce', amount: 2, requires: ['windBladeUnlock'] }),
  Object.freeze({ id: 'windBladeHaste', name: '疾风', description: '风刃攻击间隔缩短 28%。', rarity: 'rare', weapon: 'windBlade', kind: 'cooldownMultiplier', amount: 0.72, requires: ['windBladeUnlock'] }),
  Object.freeze({ id: 'iceShardUnlock', name: '寒晶', description: '获得冰晶，命中会明显减速敌人；与火焰共鸣可引发霜爆。', rarity: 'common', weapon: 'iceShard', kind: 'unlock' }),
  Object.freeze({ id: 'iceShardDeepFreeze', name: '霜缚', description: '冰晶减速效果进一步增强。', rarity: 'rare', weapon: 'iceShard', kind: 'slowMultiplier', amount: 0.72, requires: ['iceShardUnlock'] }),
  Object.freeze({ id: 'fleetFooted', name: '元素步', description: '移动速度提升 18%，更容易穿过怪潮空隙。', rarity: 'common', kind: 'moveSpeedMultiplier', amount: 1.18 }),
  Object.freeze({
    id: 'fireTornado',
    name: '火焰龙卷',
    description: '火 + 风 → 火焰龙卷｜持续环绕自身，灼烧怪群。',
    rarity: 'evolution',
    kind: 'reaction',
    reaction: 'fireTornado',
    requires: ['fireballUnlock', 'windBladeUnlock'],
  }),
  Object.freeze({
    id: 'thermalShock',
    name: '霜爆',
    description: '火 + 冰 → 霜爆｜先减速，再以火焰引爆。',
    rarity: 'evolution',
    kind: 'reaction',
    reaction: 'thermalShock',
    requires: ['fireballUnlock', 'iceShardUnlock'],
  }),
]);

const reactions = Object.freeze({
  fireTornado: Object.freeze({
    id: 'fireTornado',
    name: '火焰龙卷',
    elements: Object.freeze(['fire', 'wind']),
    mode: 'orbit',
    damage: 9,
    radius: 96,
    duration: 4.5,
    hitInterval: 0.45,
    orbitRadius: 110,
    angularSpeed: 1.9,
  }),
  thermalShock: Object.freeze({
    id: 'thermalShock',
    name: '霜爆',
    elements: Object.freeze(['fire', 'ice']),
    mode: 'triggeredBurst',
    damage: 18,
    radius: 110,
    triggerCooldown: 0.8,
  }),
});

export const CONFIG = Object.freeze({
  fixedStep: 1 / 60,
  maxDelta: 0.1,
  world: Object.freeze({ width: 2400, height: 1600 }),
  limits: Object.freeze({ enemies: 180, projectiles: 260, particles: 700, xpOrbs: 260 }),
  player: Object.freeze({
    radius: 15,
    speed: 220,
    maxHealth: 6,
    invulnerability: 0.72,
    pickupRadius: 76,
    xpCurve: Object.freeze([0, 60, 70, 84, 100, 118, 138, 160, 185, 215]),
  }),
  weapons,
  enemies,
  upgrades,
  reactions,
});

export function validateConfig(config) {
  const errors = [];
  const upgradeIds = new Set();

  for (const [key, weapon] of Object.entries(config.weapons)) {
    if (key !== weapon.id) errors.push(`Weapon key ${key} does not match id ${weapon.id}`);
  }

  for (const [key, enemy] of Object.entries(config.enemies)) {
    if (key !== enemy.id) errors.push(`Enemy key ${key} does not match id ${enemy.id}`);
  }

  for (const upgrade of config.upgrades) {
    if (upgradeIds.has(upgrade.id)) errors.push(`Duplicate upgrade id ${upgrade.id}`);
    upgradeIds.add(upgrade.id);
    if (upgrade.weapon && !config.weapons[upgrade.weapon]) errors.push(`Unknown weapon ${upgrade.weapon}`);
    if (upgrade.reaction && !config.reactions[upgrade.reaction]) errors.push(`Unknown reaction ${upgrade.reaction}`);
  }

  for (const upgrade of config.upgrades) {
    for (const requirement of upgrade.requires ?? []) {
      if (!upgradeIds.has(requirement)) errors.push(`Unknown requirement ${requirement}`);
    }
  }

  return errors;
}
