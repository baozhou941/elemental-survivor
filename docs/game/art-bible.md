# V0.1 Art Bible

## Temporary direction

V0.1 uses a restrained Neon Elemental presentation as a low-cost readability baseline: a dark desaturated arena, a bright player core, strongly separated element hues, and simple geometric silhouettes. This is provisional until the three requested directions receive external art review.

## Direction candidates for review

| Direction | Strength | Risk | Web cost |
| --- | --- | --- | --- |
| Neon Elemental | Immediate elemental contrast and inexpensive procedural VFX | Can become visually tiring or resemble generic neon arcade art | Low to moderate |
| Arcane Fantasy | Strong world identity, symbols, and creature potential | Highest asset and animation cost; intricate details can reduce readability | Moderate to high |
| Minimal Premium | Clean silhouettes, excellent clarity, and controlled fatigue | May feel emotionally cool or insufficiently magical | Low |

No direction is final in V0.1. The external art review must compare production cost, VFX difficulty, performance, distinctiveness, long-session fatigue, and gameplay fit before V0.2 chooses one.

## Shape language

- Player: concentric circle/kite core with a persistent white center. The broken outer ring and dark core retain the last movement direction; motion uses a tiny forward offset rather than a trail.
- Chaser: forward-pointing notched diamond with an internal chevron.
- Swift: narrow notched dart with two internal speed lines.
- Brute: broad, flattened hexagonal silhouette with two internal armor plates.
- XP: small diamond shards with a clear inward attraction trail.
- Harmful areas: warm outlined boundaries with a readable pre-impact phase.
- Beneficial or player-owned areas: solid elemental edge plus softer interior motion.

## Element colors

| Element | Primary | Secondary | Motion language |
| --- | --- | --- | --- |
| Fire | orange-red | warm yellow | expanding bursts and rising sparks |
| Ice | cyan | pale blue-white | sharp facets and decelerating trails |
| Lightning | electric violet | white | branching, discontinuous arcs |
| Wind | mint green | desaturated teal | curved ribbons and rotational flow |
| Poison | acid green | deep magenta | bubbles, droplets, and pulsing pools |

Color is never the only differentiator; shape and motion must communicate the same element.

## Character state overlays

- Enemy identity colors and silhouettes remain visible while slowed. Ice slow is drawn as four cyan edge ticks instead of replacing the body color.
- Player invulnerability modulates white-core opacity instead of recoloring the whole body. The existing short red-white directional arc communicates the damage source.
- Character gameplay radii are not changed by visual extensions; darts, notches, and rings are rendering-only.

## Layering and readability

The arena background has the lowest contrast. XP sits above the arena but below attacks. Enemies and hostile projectiles remain distinct from player attacks. The player, damage direction cue, and critical HUD information render above decorative particles. Screen flashes are translucent and brief; camera shake is reserved for kills, reactions, and death rather than routine attacks.

## UI and typography

HUD panels use dark translucent surfaces, thin luminous borders, large numeric values, and a system sans-serif stack for zero font-loading delay. Upgrade cards show rarity, element color, a geometric icon, a one-line behavior change, and current-to-next values where applicable.

## Animation and effects

Movement and projectiles favor smooth curves. Enemy hit flash is short enough to preserve silhouette. Death collapses or bursts outward according to enemy mass. Fire Tornado combines the orange Fire palette with mint Wind ribbons and a distinct rotating boundary, making the reaction recognizable even without text.

## Performance limits

V0.1 uses Canvas primitives and cached gradients where useful. Decorative particle counts are capped and degrade before gameplay entities. Expensive full-screen blur and uncontrolled additive layering are excluded.
