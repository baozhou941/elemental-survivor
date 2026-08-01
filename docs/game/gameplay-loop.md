# V0.1 Gameplay Loop

## Moment-to-moment loop

1. The player moves to kite enemies and collect elemental energy.
2. Equipped weapons automatically target suitable enemies.
3. Hits communicate damage through enemy flash, small particles, restrained damage numbers, and short sounds.
4. Kills produce a stronger burst and drop XP shards.
5. Nearby shards are attracted to the player and collected.
6. Filling the XP bar pauses the simulation and presents three upgrades.
7. The selected upgrade immediately changes damage behavior, targeting, projectile count, area, cadence, or elemental capability.
8. Fire and Wind investment makes Fire Tornado eligible, converting progression into a build-defining reaction.
9. Increasing enemy pressure tests the build until death or the V0.1 survival target.

## Run states

The game has five explicit states:

- `title`: rules and controls are visible; no simulation is running.
- `running`: fixed simulation updates and rendering are active.
- `levelUp`: simulation time is frozen while one of three upgrades is selected.
- `paused`: simulation time is frozen and the pause overlay is visible.
- `gameOver`: final run statistics and restart are available.

Transitions are centralized so only one animation loop exists. Returning from a hidden page or pause resets the previous timestamp, preventing a large catch-up step.

## V0.1 content

### Weapons

- Fireball: high-impact projectile with modest cadence and a small hit burst.
- Wind Blade: faster projectile with piercing behavior.
- Ice Shard: reliable projectile that slows enemies on hit.

### Enemies

- Chaser: steady direct pursuit; baseline positioning threat.
- Swift: low health and high speed; punishes slow reactions.
- Brute: high health and low speed; occupies space and absorbs fire.

### Element reaction

Fire Tornado requires both Fire and Wind progression. It creates a persistent moving or orbiting damage zone with a much larger visual and mechanical footprint than either component weapon. A target has an individual hit interval so the zone cannot apply damage every render frame.

## Upgrade rules

- Present three distinct choices whenever the eligible pool permits.
- Do not offer a maxed upgrade.
- Do not offer the same upgrade twice in one choice set.
- Weapon unlocks and behavior changes take priority over minor stat increases.
- Fire Tornado becomes eligible only after the player owns both Fireball and Wind Blade and satisfies their progression requirement.
- Selecting the reaction cannot grant the unlock more than once.

The initial ten upgrades are Fireball unlock, Fireball extra projectile, Fireball blast radius, Wind Blade unlock, Wind Blade extra pierce, Wind Blade attack speed, Ice Shard unlock, Ice Shard stronger slow, player movement speed, and Fire Tornado evolution.

## Feedback hierarchy

- Hit: flash, one sound layer, small particles, optional restrained damage number.
- Kill: larger burst, XP shard, stronger sound, and a very short hit-stop only for meaningful kills.
- XP collection: attraction trail, collection sound with limited stacking, and visible XP bar movement.
- Level-up: simulation pause, overlay entrance, strong but brief audio cue, and immediate post-selection effect.
- Reaction: unique color blend, persistent vortex motion, larger particles, and distinct audio cadence.

Camera shake, particles, flashes, and floating numbers are capped. The player marker and danger indicators render above nonessential effects.
