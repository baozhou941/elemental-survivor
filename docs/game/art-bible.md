# Elemental Survivor Art Bible（V0.7）

## Final direction

The production direction is **Elemental Sigil Minimalism**: 55% Minimal Premium, 35% Neon Elemental, and 10% Arcane Fantasy. The visual foundation is a dark desaturated arena, a bright crystalline player core, strongly separated element hues, geometric threat silhouettes, and restrained arcane sigils. This mix keeps long-session readability and Canvas performance while giving elemental reactions a recognizable identity.

## Direction candidates for review

| Direction | Strength | Risk | Web cost |
| --- | --- | --- | --- |
| Neon Elemental | Immediate elemental contrast and inexpensive procedural VFX | Can become visually tiring or resemble generic neon arcade art | Low to moderate |
| Arcane Fantasy | Strong world identity, symbols, and creature potential | Highest asset and animation cost; intricate details can reduce readability | Moderate to high |
| Minimal Premium | Clean silhouettes, excellent clarity, and controlled fatigue | May feel emotionally cool or insufficiently magical | Low |

The comparison remains as production history; V0.7 has selected the mixed direction above. New assets must match it rather than independently inventing another style.

## Visual hierarchy

Every frame follows: **player > elite/Boss > normal enemies > player skills > XP**. Brightness, edge contrast, size, motion, and glow are allocated in that order. XP may become brighter only inside the pickup neighborhood; ordinary attacks must not outshine elites or the player; decorative particles degrade before gameplay information.

## Shape language

- Player: faceted crystal core with a persistent white center, forward facet, and restrained outer sigil ring. The core retains the last movement direction; equipped Fire, Wind, and Ice appear as small distinct orbiting sigils rather than a color wash.
- Chaser: forward-pointing notched diamond with an internal chevron.
- Swift: narrow notched dart with two internal speed lines.
- Brute: broad, flattened hexagonal silhouette with two internal armor plates.
- XP: common energy uses a small white-cyan hollow diamond; rare energy uses a larger gold hexagonal crystal; elite energy uses a bright multi-ring core. Attraction uses a short curved trail and never hides the player.
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
- Elite identity uses a gold outer edge and pulse ring while preserving the base enemy silhouette and internal threat glyph.

## Element burst

The charged state adds a restrained gold-white cadence to the player's sigil ring. Activation expands as a hexagonal shock ring followed by a six-second warm core pulse. It must communicate a tactical window without becoming a full-screen clear, hiding enemy telegraphs, or changing collision radii.

## Layering and readability

The arena background has the lowest contrast. XP sits above the arena but below attacks. Enemies and hostile projectiles remain distinct from player attacks. The player, damage direction cue, and critical HUD information render above decorative particles. Screen flashes are translucent and brief; camera shake is reserved for kills, reactions, and death rather than routine attacks.

## UI and typography

HUD panels use dark translucent surfaces, thin luminous borders, large numeric values, and a system sans-serif stack for zero font-loading delay. Upgrade cards show rarity, element color, a geometric icon, a one-line behavior change, and current-to-next values where applicable.

## Animation and effects

Movement and projectiles favor smooth curves. Enemy hit flash is short enough to preserve silhouette. Death collapses or bursts outward according to enemy mass. Fire Tornado combines the orange Fire palette with mint Wind ribbons and a distinct rotating boundary, making the reaction recognizable even without text.

## Performance limits

V0.7 uses Canvas primitives and cached gradients where useful. Decorative particle counts are capped and degrade before gameplay entities. Expensive full-screen blur, uncontrolled additive layering, texture spam, and per-frame image allocation are excluded. DPR remains capped and the ordinary 3-minute stress target is approximately 60 FPS with no sustained hitching.
