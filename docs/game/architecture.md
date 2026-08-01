# Elemental Survivor Architecture

## Chosen approach

V0.1 uses browser-native JavaScript ES modules, Canvas 2D, Node's built-in test runner, and Playwright for browser flow checks. A small local static server is sufficient; no application framework or production bundler is required.

This approach was selected over Vite because the empty baseline does not need a build pipeline, and over a single-file prototype because reset safety and pure-logic testing are acceptance requirements.

## Boundaries

The implementation is divided by responsibility without creating one file for every domain noun:

- `src/core/`: deterministic and browser-independent gameplay rules: math, state transitions, XP, upgrades, weapons, reactions, director pressure, collision queries, and run reset.
- `src/runtime/`: browser integration: animation scheduling, input events, canvas sizing/rendering, visibility changes, and procedural audio.
- `src/data/`: frozen weapon, enemy, upgrade, reaction, and balance configuration.
- `src/main.js`: composition root that creates one game instance and connects UI controls.
- `tests/`: Node tests for pure behavior.
- `e2e/`: Playwright browser journeys and test-only observation through a narrow debug snapshot.

## Simulation and timing

The browser schedules exactly one `requestAnimationFrame` chain. Simulation updates use a fixed step with an accumulator; frame delta is capped to prevent background-tab catch-up. Rendering may interpolate but never mutates gameplay state.

`visibilitychange`, pause, level-up, game-over, and restart all clear accumulated time. Restart replaces the run state rather than mutating many old collections in place.

## World model

The run state owns the player, enemies, projectiles, XP shards, effects, weapon runtime state, upgrade ownership, statistics, timers, and encounter state. Entities use numeric IDs allocated by the run state. Dead or expired entries are compacted after updates, never spliced during collision iteration.

Triggered reactions keep cooldown state inside the run model, keyed by reaction and enemy ID. Cleanup removes dead enemy keys, and restart replaces the entire map with a fresh object. This prevents duplicate rewards and cooldown leakage across runs without introducing a general-purpose status framework.

V0.1 uses bounded arrays and a uniform spatial grid for nearby projectile/enemy queries when entity counts justify it. Limits on enemies, projectiles, particles, and damage numbers are data-driven. No pooling is introduced until profiling demonstrates allocation pressure; particles use a simple reusable pool because they are intentionally numerous.

## Data flow

Input produces a normalized movement intent. The fixed-step update applies player movement, encounter spawning, enemy movement, weapon cooldowns, projectile motion, spatial indexing, collisions, status effects, XP attraction, level transitions, effect aging, and cleanup in that order. Events from the update are consumed by audio and rendering feedback without controlling gameplay outcomes.

## Testability

Randomness and time are passed into pure systems. Tests can use a seeded generator and explicit `dt`. The runtime exposes a read-only debug snapshot only when the page is launched with `?test=1`; it supports E2E assertions without exposing mutation hooks.

## Failure handling

Unknown data IDs fail during startup validation with a visible fatal error. Runtime audio failures leave the game playable and mute audio. Resize clamps device pixel ratio and recalculates the viewport without recreating the game. Unsupported storage is irrelevant to V0.1 because no save system is included.

## Security and external review

The project contains no credentials or remote APIs. Review packages will exclude Git data, dependencies, test output, environment files, browser state, cookies, tokens, credentials, and private keys. Package manifests, file lists, size, baseline, and SHA-256 will be recorded before external upload.
