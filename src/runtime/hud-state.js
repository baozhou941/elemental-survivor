function weaponSignature(run) {
  const weapons = Object.keys(run.weapons).sort();
  const reactions = [...run.fusionSlots].sort();
  const unlockedReactions = Object.entries(run.unlockedReactions)
    .filter(([, unlocked]) => unlocked)
    .map(([id]) => id)
    .sort();
  const mutations = Object.entries(run.weaponMutations)
    .sort(([left], [right]) => left.localeCompare(right));
  const masteries = Object.entries(run.masteries)
    .sort(([left], [right]) => left.localeCompare(right));

  return JSON.stringify({ weapons, reactions, unlockedReactions, mutations, masteries });
}

function createHudSnapshot(run) {
  const burstActive = run.time < run.burst.activeUntil;
  const burstRemaining = burstActive
    ? Math.max(0, run.burst.activeUntil - run.time).toFixed(1)
    : null;
  const showXpTutorial = run.stats.xpCollected === 0 && run.xpOrbs.length > 0;

  return {
    time: Math.floor(run.time),
    health: `${run.player.health}/${run.player.maxHealth}`,
    level: run.player.level,
    xp: `${run.player.xp}/${run.player.xpToNext}/${showXpTutorial}`,
    burst: `${run.burst.charge}/${run.burst.maxCharge}/${burstRemaining}/${run.state}`,
    weapons: weaponSignature(run),
  };
}

export function diffHudSnapshot(previous, run) {
  const snapshot = createHudSnapshot(run);
  return {
    snapshot,
    changed: {
      time: previous === null || previous.time !== snapshot.time,
      health: previous === null || previous.health !== snapshot.health,
      level: previous === null || previous.level !== snapshot.level,
      xp: previous === null || previous.xp !== snapshot.xp,
      burst: previous === null || previous.burst !== snapshot.burst,
      weapons: previous === null || previous.weapons !== snapshot.weapons,
    },
  };
}
