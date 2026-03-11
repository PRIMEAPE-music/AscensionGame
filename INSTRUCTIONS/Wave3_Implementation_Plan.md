# Wave 3 Implementation Plan — Gameplay Polish

## Overview
Five features to deepen gameplay mechanics, ordered by file ownership for parallel implementation.

---

## Feature 1: Class Unique Mechanics

**Goal:** Each class gets a signature ability that differentiates playstyle.

### Paladin — Shield Guard
- When standing still for 0.5s, enters blocking stance (visual: blue tint pulse)
- Frontal attacks deal 50% reduced damage
- Active during attack recovery
- Does NOT prevent knockback

### Monk — Flow State
- Consecutive hits without taking damage build Flow meter (0-100)
- At 25/50/75/100: unlock enhanced movement (faster speed, higher jumps)
- At 100: attacks gain +50% damage
- Getting hit resets Flow to 0
- Flow decays at 5/sec when not attacking

### Priest — Sacred Ground
- Y attack on ground creates a 3-meter healing/damage circle (lasts 5s)
- Standing in circle: regen 1 HP over 3s (once per circle)
- Enemies in circle: take DoT (10% max HP/sec)
- Only one circle at a time
- 15 second cooldown

### Files
- **Modify:** `src/game/entities/Player.ts` — add shieldGuard state, flowMeter, sacredGround cooldown
- **Modify:** `src/game/config/ClassConfig.ts` — add uniqueMechanic field
- **Modify:** `src/game/systems/EventBus.ts` — add `flow-change`, `sacred-ground` events
- **Modify:** `src/game/ui/GameHUD.tsx` — flow meter for Monk, shield icon for Paladin
- **New:** `src/game/systems/SacredGround.ts` — zone game object with heal/damage logic

---

## Feature 2: Platform Drop-Through

**Goal:** Down+Jump drops through one-way platforms.

### Requirements
- Press Down + Space simultaneously to drop through current platform
- 0.5s window where player can't re-collide with the dropped platform
- Cannot drop through solid/arena platforms (boss barriers, walls)

### Files
- **Modify:** `src/game/entities/Player.ts` — add dropThrough state, timer
- **Modify:** `src/game/scenes/MainScene.ts` — modify `oneWayPlatformCheck` to respect drop-through

---

## Feature 3: Environmental Hazards

**Goal:** Add hazard variety to climbing sections.

### Falling Stalactites
- Random ceiling hazard every 30s average at altitude 2000m+
- 1s warning (visual shake indicator), then fast fall
- 2 damage on hit, destroys platforms temporarily (10s respawn)
- Visual: dark spike shape

### Wind Currents
- Invisible horizontal force in certain altitude bands (4000m+)
- Pushes player left or right while airborne
- Visual: floating particle indicators
- Changes every 500m of altitude

### Portal Platforms
- Rare purple platform (every 800-1200m at altitude 6000m+)
- Steps on it = teleport 50-100m upward
- 2s disorientation effect (slight camera wobble)

### Files
- **New:** `src/game/systems/HazardManager.ts` — manages stalactites, wind, portals
- **Modify:** `src/game/scenes/MainScene.ts` — instantiate HazardManager
- **Modify:** `src/game/systems/LevelGenerator.ts` — spawn portal platforms
- **Modify:** `src/game/config/PlatformTypes.ts` — add PORTAL type
- **Modify:** `src/game/systems/EventBus.ts` — add hazard events

---

## Feature 4: Combo Meter UI

**Goal:** Visual combo feedback during combat.

### Requirements
- Track consecutive hits without 3s gap
- Show hit count on right side of screen
- Show damage multiplier (1.0x → 1.1x → 1.2x → 1.3x for 3+ hits)
- Grows larger/brighter with higher combo
- Fades after 3s without hit
- Style points awarded on combo end based on length

### Files
- **Modify:** `src/game/systems/CombatManager.ts` — track combo count, reset timer, emit events
- **Modify:** `src/game/systems/EventBus.ts` — add `combo-update` event
- **Modify:** `src/game/ui/GameHUD.tsx` — combo meter display component

---

## Feature 5: Gambling Shrines

**Goal:** Risk/reward essence gambling at rare platforms.

### Requirements
- Spawn every 500-800m, recognizable by purple/mystical glow
- Landing opens Gambling UI with 3 bet tiers:
  - 50 essence: 70% nothing, 25% silver item (T1), 5% health
  - 100 essence: 40% nothing, 45% silver item (T2), 10% health, 5% gold item
  - 200 essence: 20% nothing, 50% silver item (T3), 20% health, 10% gold item
- Animated "spinning" reveal of result
- Can only gamble once per shrine

### Files
- **New:** `src/game/ui/GamblingUI.tsx` — gambling overlay component
- **Modify:** `src/game/config/PlatformTypes.ts` — add GAMBLING platform type
- **Modify:** `src/game/systems/LevelGenerator.ts` — spawn shrine platforms
- **Modify:** `src/game/scenes/MainScene.ts` — detect shrine landing, emit events
- **Modify:** `src/game/systems/EventBus.ts` — add gambling events
- **Modify:** `src/App.tsx` — listen for gambling events, show GamblingUI

---

## File Ownership Matrix

| File | F1 | F2 | F3 | F4 | F5 |
|------|----|----|----|----|-----|
| Player.ts | X | X | | | |
| ClassConfig.ts | X | | | | |
| MainScene.ts | | X | X | | X |
| CombatManager.ts | | | | X | |
| EventBus.ts | X | | X | X | X |
| GameHUD.tsx | X | | | X | |
| LevelGenerator.ts | | | X | | X |
| PlatformTypes.ts | | | X | | X |
| App.tsx | | | | | X |
| SacredGround.ts (new) | X | | | | |
| HazardManager.ts (new) | | | X | | |
| GamblingUI.tsx (new) | | | | | X |

---

## Implementation Strategy

All 5 features use worktree-isolated agents, merged sequentially.
