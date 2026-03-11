# Feature Implementation Plan — Wave 2

## Overview

Six features to complete the core game loop, ordered by dependency.

---

## Feature 1: Death Screen

**Goal:** Proper end-of-run screen with stats, retry, and menu buttons. Replace the current silent reset.

### Requirements
- When player health hits 0, pause the game and show a Death Screen overlay
- Display run stats: altitude reached, time survived, enemies killed, bosses defeated
- Track kill count throughout the run (listen to `enemy-killed` events in MainScene)
- Track bosses defeated count (listen to `boss-defeated` events)
- Buttons: "Retry" (restart with same class), "Main Menu" (back to class select)
- Dramatic presentation: dark overlay, stats animate in, red/dark theme

### Files
- **New:** `src/game/ui/DeathScreen.tsx` — React component
- **Modify:** `src/App.tsx` — add DEATH game state, render DeathScreen, track kills/bosses
- **Modify:** `src/game/scenes/MainScene.ts` — emit `player-died` with full stats instead of just resetting
- **Modify:** `src/game/systems/EventBus.ts` — update `player-died` event payload to include kills, bosses, time

### EventBus Changes
```typescript
"player-died": { altitude: number; kills: number; bossesDefeated: number; timeMs: number };
```

---

## Feature 2: Demon Essence Economy + HUD Counter

**Goal:** Currency earned from kills, displayed on HUD, persists during run.

### Requirements
- Earn essence on enemy kill:
  - Basic: 5, Intermediate: 15, Advanced: 30, Elite: 60
  - Boss: 50 × bossNumber
- Display essence counter on HUD (bottom-right, coin icon + number)
- Animate counter on collection (brief glow/scale pulse)
- Essence resets each run
- Store essence on Player or MainScene, emit events for UI

### Files
- **Modify:** `src/game/systems/EventBus.ts` — add `"essence-change": { essence: number; gained: number }`
- **Modify:** `src/game/scenes/MainScene.ts` — track essence, listen to `enemy-killed` and `boss-defeated`, calculate reward by tier, emit `essence-change`
- **Modify:** `src/game/ui/GameHUD.tsx` — add essence counter display (bottom-right)
- **Modify:** `src/App.tsx` — track essence state, pass to HUD, reset on death/restart

### Essence Lookup by Tier
```typescript
const ESSENCE_REWARDS: Record<string, number> = {
  basic: 5, intermediate: 15, advanced: 30, elite: 60
};
// Boss: 50 * bossNumber (from boss-defeated event)
```

---

## Feature 3: Shop Platforms

**Goal:** Special platforms every 300-500m where player can spend essence.

### Requirements
- Shop platform spawns every 300-500m altitude (golden glow, distinct visual)
- When player lands on shop platform, pause game, open Shop UI overlay
- Shop offerings:
  - Health restore (1 HP): 30 essence
  - Random silver item: 100 essence
  - Temporary buff (+20% damage, 2 minutes): 75 essence
- Player can buy multiple items if they have enough essence
- "Continue" button closes shop and resumes
- Shop platform has a golden/yellow tint and particle glow to distinguish it

### Files
- **New:** `src/game/ui/ShopUI.tsx` — React shop overlay component
- **New:** `src/game/config/ShopConfig.ts` — shop item definitions and prices
- **Modify:** `src/game/systems/LevelGenerator.ts` — spawn shop platforms at intervals
- **Modify:** `src/game/systems/EventBus.ts` — add `"shop-open"`, `"shop-close"`, `"shop-purchase"` events
- **Modify:** `src/game/scenes/MainScene.ts` — detect shop platform landing, emit shop-open, pause scene
- **Modify:** `src/App.tsx` — listen for shop events, show ShopUI, handle purchases
- **Modify:** `src/game/config/PlatformTypes.ts` — add SHOP platform type

---

## Feature 4: Dodge System

**Goal:** Dodge input with i-frames, cooldown, and perfect dodge buff.

### Requirements
- Dodge input: Shift key (or dedicated button)
- On dodge: quick dash in movement direction (or backward if stationary)
- Dodge grants 0.2 seconds of invincibility frames
- 0.3 second cooldown between dodges
- Perfect dodge: if dodging within 0.1s of an enemy attack hitting you, extend i-frames to 0.4s and grant 1.5x damage buff for 2 seconds
- Visual: brief afterimage/ghost effect during dodge, screen flash on perfect dodge
- Dodge velocity: quick burst (400px/s horizontal) in dodge direction

### Files
- **Modify:** `src/game/entities/Player.ts` — add dodge state, cooldown timer, perfect dodge detection, damage buff tracking
- **Modify:** `src/game/systems/CombatManager.ts` — check for dodge state during contact damage, detect perfect dodge timing
- **Modify:** `src/game/systems/EventBus.ts` — add `"perfect-dodge": {}` event (for UI feedback)
- **Modify:** `src/game/ui/GameHUD.tsx` — show "PERFECT DODGE" flash text on event

### Player Properties to Add
```typescript
private isDodging: boolean = false;
private dodgeCooldown: number = 0;
private dodgeTimer: number = 0;
private perfectDodgeBuff: boolean = false;
private perfectDodgeBuffTimer: number = 0;
private readonly DODGE_DURATION = 200;    // ms
private readonly DODGE_COOLDOWN = 300;    // ms
private readonly DODGE_SPEED = 400;       // px/s
private readonly PERFECT_DODGE_WINDOW = 100; // ms
```

---

## Feature 5: Hit Feedback Polish

**Goal:** Screen shake, hit-stop, and floating damage numbers for satisfying combat feel.

### Requirements
- **Hit-stop:** On enemy hit, freeze game for 2-3 frames (33-50ms) — brief time scale change
- **Screen shake:** Camera shake on hit, intensity based on attack power (light=small, heavy=large, boss=massive)
- **Damage numbers:** Floating text showing damage dealt, rises and fades from enemy position
  - Normal hits: white text
  - Critical/heavy hits: yellow, larger text
  - Boss damage: red text
- **Impact particles:** Small burst of particles at hit point (already partially exists in ParticleManager)

### Files
- **New:** `src/game/systems/DamageNumberManager.ts` — creates and animates floating damage text
- **Modify:** `src/game/systems/CombatManager.ts` — trigger hit-stop, screen shake, and damage numbers on hit
- **Modify:** `src/game/scenes/MainScene.ts` — instantiate DamageNumberManager, pass to CombatManager

### Screen Shake Implementation
```typescript
// In CombatManager.handleAttackHit():
this.scene.cameras.main.shake(duration, intensity);
// Light attack: shake(50, 0.002)
// Heavy attack: shake(80, 0.005)
// Boss hit: shake(100, 0.008)
```

### Hit-Stop Implementation
```typescript
// Brief time scale reduction:
this.scene.time.timeScale = 0.1;
this.scene.time.delayedCall(40, () => { this.scene.time.timeScale = 1; });
```

---

## Feature 6: Boss Distance Indicator

**Goal:** Show "BOSS IN Xm" on HUD when approaching a boss.

### Requirements
- When player is within 300m of next boss altitude, show distance on HUD
- Display near the altitude counter: "BOSS IN 250m"
- Text pulses red as distance decreases
- Disappears once boss fight starts
- Uses data already available from BossArenaManager

### Files
- **Modify:** `src/game/systems/EventBus.ts` — `boss-warning` already exists, but emit continuously when in range (not just once)
- **Modify:** `src/game/systems/BossArenaManager.ts` — emit `boss-warning` every update when within 300m (with current distance)
- **Modify:** `src/game/ui/GameHUD.tsx` — show boss distance text near altitude display, pulsing red

---

## Dependency Order

```
Feature 1 (Death Screen)     — independent, do first
Feature 2 (Essence Economy)  — independent, parallel with 1
Feature 6 (Boss Distance)    — independent, parallel with 1+2
Feature 4 (Dodge System)     — independent, parallel with above
Feature 5 (Hit Feedback)     — independent, parallel with above
Feature 3 (Shop Platforms)   — depends on Feature 2 (needs essence to spend)
```

Features 1, 2, 4, 5, and 6 can all be built **in parallel**. Feature 3 depends on Feature 2.

---

## File Change Summary

### New Files (3)
| File | Purpose |
|------|---------|
| `src/game/ui/DeathScreen.tsx` | End-of-run overlay with stats and buttons |
| `src/game/ui/ShopUI.tsx` | Mid-run shop overlay |
| `src/game/systems/DamageNumberManager.ts` | Floating damage text |

### Modified Files (9)
| File | Features |
|------|----------|
| `src/game/systems/EventBus.ts` | 1, 2, 3, 4 |
| `src/game/scenes/MainScene.ts` | 1, 2, 3, 5 |
| `src/App.tsx` | 1, 2, 3 |
| `src/game/ui/GameHUD.tsx` | 2, 4, 6 |
| `src/game/entities/Player.ts` | 4 |
| `src/game/systems/CombatManager.ts` | 4, 5 |
| `src/game/systems/LevelGenerator.ts` | 3 |
| `src/game/systems/BossArenaManager.ts` | 6 |
| `src/game/config/PlatformTypes.ts` | 3 |
