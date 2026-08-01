# Balance Targets and Evidence

## Experience pacing

These are measurable targets rather than scripted timestamps:

| Event | Target |
| --- | ---: |
| First enemy contact | 2–5 seconds |
| First kill | at most 5 seconds |
| First obvious reward feedback | at most 10 seconds |
| First XP attraction cluster | 15–25 seconds |
| First level-up | 30–45 seconds |
| Build direction visible | about 60 seconds |
| Fire Tornado eligible in a focused run | 2–3 minutes |
| Sustained high pressure | after 3 minutes |

## Current tuning principles

- A starting weapon must kill a Chaser in a small number of hits and may not leave the player waiting through long empty cooldowns.
- Swift enemies are dangerous because of speed; Brutes constrain space rather than dealing burst damage.
- Contact damage uses an invulnerability window so overlapping enemies do not remove the full health bar in one frame.
- The player has six health points. Enemy intensity rises in waves with relief windows instead of increasing linearly forever.
- Enemy population, projectiles, particles, damage numbers, and frame delta all have explicit caps.
- Upgrade effects must be noticeable on the next combat cycle. The pool favors projectile count, pierce, cooldown, area, slow, unlocks, and reactions over tiny percentage bonuses.

## XP curve

V0.3 retains the 60 XP start, then uses `70, 84, 100, 118, 138, 160, 185, 215`. Overflow carries across level boundaries, including multiple queued level-ups. XP produced and collected are tracked separately so reward loss can be detected.

The representative browser run reached its first level-up at 27.10 seconds, slightly faster than the 30–45 second target. The deterministic 30-seed runner ranged from 19.20 to 39.33 seconds with a 22.09 second median. This is evidence that the automated steering route collects unusually efficiently, not yet evidence that human pacing is too fast; V0.2 holds the XP curve for expert and human review.

## V0.2 deterministic simulation — 30 seeds

Command: `npm run test:balance`

| Metric | Minimum | Median | Maximum |
| --- | ---: | ---: | ---: |
| Duration | 180.00 s | 180.00 s | 180.00 s |
| Level | 8 | 9 | 10 |
| Kills | 240 | 245.5 | 254 |
| First kill | 1.25 s | 1.57 s | 1.80 s |
| First XP | 2.23 s | 3.76 s | 5.10 s |
| First level-up | 19.20 s | 22.09 s | 39.33 s |
| Fire Tornado hits | 24 | 45 | 64 |
| Zero-hit activations | 1 | 5 | 9 |
| Peak enemies | 16 | 21 | 26 |
| Peak projectiles | 7 | 7 | 8 |
| Peak particles | 31 | 38.5 | 49 |

All 30 scripted runs survived at full health. That makes the runner useful for determinism, progression, reward conservation, and entity-cap regressions, but invalid as proof of human difficulty or survival balance.

## V0.2 real-browser three-minute run

- Duration/state: 180.30 seconds, still running; health 4/6; level 8.
- First kill 1.65 s; first XP 5.45 s; first level-up 27.10 s.
- 240 kills; 1,246 XP produced; 833 XP collected.
- Damage: Fireball 4,608; Wind Blade 2,112; Ice Shard 540; Fire Tornado 477.
- Fire Tornado: 21 activations, 53 hits, 6 zero-hit activations. This is 2.52 hits per activation, 28.6% zero-hit activations, and 6.2% of recorded damage.
- Player took 2 damage; last source was a Chaser.
- Average FPS 59.56; 0 recorded hitches; isolated sampled minimum 14.71 FPS and maximum interval 68 ms still merit observation.
- Peaks: 25 enemies, 8 projectiles, 58 particles.

The reaction clears the numerical gates for hit efficiency and damage share, but six zero-hit activations show that its targeting/presentation can still improve. One automated run cannot establish Build balance.

## V0.3 reaction evidence

V0.3 holds the V0.2 weapon, enemy, XP, and Fire Tornado values. It aims the tornado's initial angle at the nearest live enemy and adds Thermal Shock: Fireball hitting an already slowed target creates a radius-72 burst for 12 damage, with a 0.8-second per-enemy trigger cooldown.

The deterministic 30-seed runner completed all runs. Thermal Shock averaged 8.77 activations and 72.40 damage; Fire Tornado averaged 21.07 activations and 444.60 damage. Both were selected in every scripted route. In the representative real-browser run, Thermal Shock dealt 72 damage from 8 activations while Fire Tornado dealt 297 from 19 activations. This supports the intended supplemental role but does not prove player-perceived value.

The browser run reached first kill at 1.68 seconds, first XP at 4.83 seconds, and first level-up at 23.43 seconds. It ended the three-minute window at level 8, 249 kills, and full health. Because the route is automated and optimized for collection, the XP curve and difficulty remain unchanged pending human evidence.

## V0.4 route evidence

V0.4 guarantees Wind Blade and Ice Shard in the first offer, then locks the run to the first selected reaction. The next offer guarantees an eligible reaction so the opening choice forms a route rather than merely changing upgrade order.

| 90-second route (30 seeds) | Target reaction formed | Hits / activation | Reaction damage share | Runs with no reaction hit |
| --- | ---: | ---: | ---: | ---: |
| Wind → Fire Tornado | 30/30 | 1.07 | 3.23% | 0/30 |
| Ice → Thermal Shock | 30/30 | 1.30 | 4.73% | 1/30 |

The one Ice-route miss unlocked its reaction too late to land a hit within the 90-second observation window; it was not a trigger-semantic failure. A lethal Fireball against a slowed target now produces exactly one Thermal Shock hit, one kill, one XP orb, and one kill event in its dedicated regression test.

The representative V0.4 browser run selected Wind and reached level 8 with 231 kills and full health. First kill was 1.38 seconds, first XP 2.77 seconds, and first level-up 22.93 seconds. Fire Tornado dealt 549 of 8,004 recorded damage (6.86%), with 24 activations, 61 hits, and 8 zero-hit activations. Average FPS was 59.70 with zero recorded hitches. XP and difficulty values remain unchanged because automation still cannot establish human fairness or pacing.

## Balancing gate

Production values require invariant tests, deterministic multi-seed simulation, a real browser run, and human play evidence. Matching this document is not acceptance by itself; observed first-upgrade time, kill rate, reaction contribution, damage causes, clarity, and replay desire decide whether a value remains.
