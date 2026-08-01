# Elemental Survivor V0.1 Vision

## Product promise

Elemental Survivor is a short-session browser Roguelite built around automatic attacks, frequent growth, and discoverable elemental reactions. V0.1 proves one question: does moving through escalating enemy pressure while assembling a Fire/Wind build feel good for at least three to five minutes?

## Player experience targets

- The controls are understood within three seconds: move with WASD or the arrow keys; attacks are automatic.
- The first enemy dies within five seconds under normal play.
- A clear positive feedback event occurs within ten seconds.
- The first level-up normally occurs between 30 and 45 seconds.
- Weapon behavior changes materially during the run; upgrades are not dominated by tiny percentage increases.
- Fire plus Wind can unlock Fire Tornado, the first build-defining elemental reaction.
- The player remains visually identifiable during dense combat and can understand the source of damage.
- Death offers an immediate restart and suggests trying a different upgrade path.

## V0.1 scope

V0.1 contains one arena, one player, three enemy archetypes, three weapons, ten upgrades, one reaction, XP and level-ups, a three-choice upgrade screen, HUD, pause/resume, death/restart, procedural sound, and lightweight particle feedback.

The target is a complete three-to-five-minute playable core. Bosses, elites, meta progression, multiple maps, save data, accounts, shops, achievements, leaderboards, and content expansion are outside V0.1.

## Acceptance criteria

V0.1 reaches its review pause when all of the following are true:

1. A new player can start and play using only movement input.
2. Auto-attacks produce kills, XP drops, collection, level-ups, and upgrade choices.
3. At least three weapons and three enemy behaviors are observable in normal play.
4. Fire Tornado can be deliberately unlocked and behaves differently from its component weapons.
5. Pause, resume, death, and restart do not leak entities, timers, buffs, input listeners, or animation loops.
6. Pure gameplay logic tests, browser flow checks, and a manual browser playtest have fresh passing evidence.
7. A three-to-five-minute playtest is recorded before any post-V0.1 feature expansion.

## Project constraints

- Implementation uses local files only. No Git initialization, commit, push, pull request, deployment, or production change is authorized.
- The workspace baseline was empty on 2026-07-31; there is no prior game to preserve.
- V0.1 uses procedural geometry and generated audio. Art production must not block playability.
- New scope must improve fun, feedback, build variety, meaningful decisions, or replayability.
