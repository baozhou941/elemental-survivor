# Elemental Survivor Art Bible (V0.8)

## Production direction

The selected hybrid is **Elemental Sigil Minimalism**:

- 65% Minimal Premium: clean silhouettes, restrained contrast, and long-session readability.
- 25% Neon Elemental: bright elemental edges and concise combat accents.
- 10% Arcane Fantasy: sigils and ritual geometry reserved for reactions and major moments.

The arena stays dark and quiet. Gameplay entities earn brightness through importance, not through quantity. New art must follow this mix rather than creating an independent style.

## Visual hierarchy

Every frame follows this order:

**player > hostile telegraphs/projectiles > elite > normal enemy > player skill > XP**

Silhouette, edge contrast, size, motion, and glow are allocated in that order. Decorative particles degrade first. An effect that obscures the player, a hostile warning, or the source of damage is invalid even when it looks impressive.

## Player language

- Body: an asymmetric faceted crystal with a persistent white core and a clear forward point.
- Direction: a broken/notched forward arc remains readable while moving or standing still.
- Health: a compact rear arc communicates remaining HP without competing with hostile warnings.
- Build: Fire, Ice, and Wind sockets use fixed positions around the body. They do not orbit, so a player's current build can be read at a glance.
- State: invulnerability modulates core opacity. Damage direction remains a short directional arc.
- Rendering-only extensions never change the player's gameplay radius.

## Enemy silhouettes

- Chaser: notched forward wedge with a central chevron; persistent pursuit threat.
- Swift: narrow twin-fin dart; fast and fragile even without color.
- Brute: broad armored hexagon with heavy side plates; slow pressure threat.
- Elite: keeps the base silhouette and adds a gold outer edge plus a restrained pulse ring.
- Slow status: four cyan edge ticks preserve the enemy's identity color instead of recoloring its entire body.

## XP energy tiers

- Common: a small point/diamond. It has no glow at distance and only a faint pickup-neighborhood glow.
- Rare: a double crystal with a gold-white center.
- Elite: a faceted prism with a short directional tail.

XP remains quieter than attacks and enemies. Attraction trails must be short and may never cover the player.

## Element shape language

| Element | Primary color | Projectile shape | Motion language |
| --- | --- | --- | --- |
| Fire | orange-red | asymmetric ember dart | expanding bursts and rising sparks |
| Ice | cyan | long faceted shard | sharp lines and decelerating trails |
| Lightning | electric violet | broken bolt | discontinuous branches |
| Wind | mint | curved crescent blade | ribbons and rotational flow |
| Poison | acid green | weighted droplet | bubbles and pulsing pools |

Color is never the only identifier. Shape and motion must communicate the same element.

## Reaction language

Reactions inherit recognizable geometry from both parent elements and add a restrained arcane boundary:

- Fire Tornado: Fire's pointed heat core inside Wind's rotating mint boundary.
- Thermal Shock: Ice facets interrupted by a warm Fire shock polygon.
- Future reactions must preserve both parent silhouettes before adding decorative sigils.

Reaction boundaries are larger and brighter than ordinary skills but remain below hostile telegraphs and the player in the hierarchy.

## Glow budgets

Canvas shadow blur is capped by category:

| Category | Maximum blur |
| --- | ---: |
| Far common XP | 0 px |
| Near common XP | 4 px |
| Rare/elite XP | 6 px |
| Normal projectile | 5 px |
| Element reaction | 8 px |
| Burst/death accent | 12 px, time-limited |
| Player core | 12 px |

Glow is an accent, not a material. Full-screen blur, uncontrolled additive layers, and permanent bloom are excluded.

## Viewport and performance rules

- Dynamic world entities are renderer-culled outside the viewport plus a **96 px margin**.
- Culling changes drawing only. Simulation, collision, spawning, damage, and XP attraction continue unchanged off-screen.
- Particle counts remain capped and decorative particles are removed before gameplay information.
- Avoid per-frame image allocation and temporary arrays in hot rendering paths.
- DPR remains capped. Resume, restart, and long-session play must not accumulate rendering state or duplicate loops.

## UI and readability

HUD panels use dark translucent surfaces, thin luminous borders, large numeric values, and a system sans-serif stack. Upgrade cards show rarity, element shape/color, one concise behavior change, and current-to-next values where useful.

The player, hostile warning, damage source, and critical HUD must remain readable during the densest wave. Routine attacks do not receive camera shake; major reactions, elite deaths, player death, and victory may use brief restrained emphasis.

## V0.8 acceptance checklist

- Player facing, health, and equipped elements are legible without text.
- Chaser, Swift, and Brute are distinguishable in silhouette.
- Common, rare, and elite XP are distinguishable by shape and intensity.
- Projectiles and reactions remain inside their glow budgets.
- Off-screen rendering is culled at the 96 px margin without changing gameplay state.
- A crowded frame still communicates the player location and the nearest hostile threat first.
