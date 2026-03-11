# Monster & Boss Implementation Plan

## Overview

This document outlines the phased implementation of the full monster and boss system for Ascension, as described in the Game Design Document.

---

## Phase 1: Foundation Layer

**Goal:** Upgrade the enemy infrastructure so new enemies can be added cleanly. Existing gameplay remains identical.

| Step | What | Files |
|------|------|-------|
| 1.1 | Enhance `Enemy` base class — add `enemyType`, `tier`, `isElite`, `isBlocking` properties, drop hooks | `Enemy.ts` (modify) |
| 1.2 | Create `EnemyStateMachine` utility — lightweight state machine with onEnter/onUpdate/onExit callbacks | `systems/EnemyStateMachine.ts` (new) |
| 1.3 | Create `EnemyConfig` registry — data-driven type definitions with factory functions and weighted random selection | `config/EnemyConfig.ts` (new) |
| 1.4 | Refactor `SpawnManager` — replace hardcoded switch-case with registry-based lookup, add elite spawning | `SpawnManager.ts` (modify) |
| 1.5 | Update existing 4 enemies — set `enemyType` and `tier` on each | `ImpCrawler.ts`, `HellHound.ts`, `ShadowBat.ts`, `DemonTurret.ts` (modify) |

**Result:** Same gameplay, but the spawn system is registry-based and ready for new enemy types.

---

## Phase 2: Intermediate Tier Enemies (1000-6000m)

**Goal:** Add 4 new intermediate enemies. Players encounter new variety at mid-altitudes.

| Enemy | Mechanic | HP | Key Behavior |
|-------|----------|----|-------------|
| **Void Stalker** | Teleport + backstab | 6 | Walks normally, teleports behind player every 8s, backstab attack, 0.5s recovery vulnerability |
| **Cursed Knight** | Shield block + overhead strike | 10 | Slow walk, frontal attacks blocked by shield, must attack from behind or above |
| **Floating Eye** | Laser beam sweep | 4 | Hovers, tracks player, fires sweeping laser every 5s with 1s charge telegraph |
| **Demon Spawner** | Summons ImpCrawlers | 8 | Stationary, summons 1-2 crawlers every 10s (max 3 active), summons die when spawner dies |

**Files:** 4 new entity files + register in `EnemyConfig.ts`

---

## Phase 3: Advanced + Elite Tier Enemies

**Goal:** Add 7 more enemy types and the elite variant system.

### Advanced Tier (3000-9000m)

| Enemy | Mechanic | HP |
|-------|----------|----|
| **Rift Weaver** | Teleports, creates damaging portal zones | 12 |
| **Armor Colossus** | Very slow, ground pound shockwave, grab attack | 25 |
| **Phase Demon** | Alternates corporeal/incorporeal on 5s cycle | 8 |
| **Chain Devil** | Swings from ceiling, whip attack with 8m range | 10 |

### Elite Tier (6000m+)

| Enemy | Mechanic | HP |
|-------|----------|----|
| **Soul Reaper** | Glides through platforms, soul drain DoT aura | 20 |
| **Demon General** | Commands enemies, sword combos, buff aura | 30 |
| **Terror Mimic** | Disguises as item pickup, ambush attack | 15 |

### Elite Variant System
- Any enemy type can become elite
- Stats: 3x health, 1.5x damage, 1.2x speed
- Visual: silver aura, pulsing glow
- 20% chance to drop silver item on death
- Always drops 2x essence

**Files:** 7 new entity files + elite logic in `SpawnManager.ts` and `Enemy.ts`

---

## Phase 4: Boss Arena System

**Goal:** Build arena generation, lockdown mechanics, and boss health UI. Test with placeholder boss.

| Step | What | File |
|------|------|------|
| 4.1 | `BossArenaManager` — generates sealed arenas at every 1000m altitude | `systems/BossArenaManager.ts` (new) |
| 4.2 | LevelGenerator integration — pause normal gen, inject arena, resume above | `LevelGenerator.ts` (modify) |
| 4.3 | Arena lockdown — barriers top/bottom, camera lock, enter/exit triggers | `BossArenaManager.ts` |
| 4.4 | Boss health bar UI — 3-phase segmented bar, boss name | `ui/BossHealthBar.tsx` (new) |
| 4.5 | Boss events — boss-spawn, boss-health-change, boss-phase-change, boss-defeated | `EventBus.ts` (modify) |
| 4.6 | GameHUD integration — conditional boss bar, "Boss Approaching" warning | `GameHUD.tsx` (modify) |
| 4.7 | Placeholder boss for end-to-end testing | Temporary |

**Arena Specs:** 30m wide x 20m tall, 3-5 platforms, sealed with barriers

---

## Phase 5: Boss Archetypes

**Goal:** Implement `Boss` base class and all 5 boss archetypes with 3-phase attack patterns.

### Boss Base Class (`entities/Boss.ts`)
- Extends `Enemy`
- Phase tracking with health thresholds (100-66%, 66-33%, 33-0%)
- Health scaling: Boss 1 = 200 HP, Boss 2 = 350 HP, Boss 3 = 500 HP, etc.
- Phase transition invulnerability + visual effects
- Reward spawning on death

### Boss Archetypes

| Boss | Concept | Phase 1 | Phase 2 | Phase 3 |
|------|---------|---------|---------|---------|
| **Magma Tyrant** | Ground controller | Lava pools, flame wave, rock toss | Spreading pools, double stomp, shrapnel | Permanent lava floor, triple stomp, boulder rain |
| **Void Wing Archon** | Air dominator | Dive bomb, feather storm, laser sweep | Double dive, damage zones, vertical lasers | Triple dive, continuous storm, cross-pattern laser |
| **Chrono Demon** | Pattern memorization | Sequential strikes (1-2-3-4), time bombs, rewind | Mixed order, more bombs, damaging afterimage | Random strikes, 7 varied-timer bombs, triple rewind |
| **Legion Master** | Crowd control | Summon imps, dark bolt, buff circle | Summon bats, triple bolt, shielded minions | Summon stalkers, pentagram bolt, exploding minions |
| **Platform Devourer** | Arena manipulation | Destroy 1 platform, wall emerge, spike wall | Destroy 2, both-side emerge, narrowing walls | Rotating safe platform, continuous emerge, full hazards |

### Boss Selection
- Boss 1: Magma Tyrant (simplest, teaches boss mechanics)
- Later bosses: cycle through archetypes with scaling difficulty
- Each archetype defines preferred arena layout

**Files:** `Boss.ts` base class + `entities/bosses/` directory with 5 boss files

---

## Phase 6: Polish & Integration

| Step | What |
|------|------|
| 6.1 | Drop table system — tier-based loot tables for all enemies and bosses |
| 6.2 | New reward items — demon essence currency, more silver/gold variety |
| 6.3 | Spawn tuning — adjust intervals, composition weights, max enemies |
| 6.4 | Visual polish — elite auras, boss entrances, phase transitions, screen shake |
| 6.5 | Boss warning system — distance-based warning at 200m |
| 6.6 | ProjectilePool utility — extract from DemonTurret, reuse for ranged enemies/bosses |
| 6.7 | Difficulty balancing — enemy HP/damage scaling, boss fight duration targeting (2-4 min) |

---

## Dependency Graph

```
Phase 1 (Foundation) ─── everything depends on this
  │
  ├── Phase 2 (Intermediate enemies) ── depends on Phase 1
  │     │
  │     └── Phase 3 (Advanced + Elite) ── depends on Phase 1 & 2 patterns
  │
  └── Phase 4 (Boss Arena) ── depends on Phase 1, independent of Phase 2/3
        │
        └── Phase 5 (Boss Archetypes) ── depends on Phase 4
              │
              └── Phase 6 (Polish) ── depends on all above
```

Phases 2 and 4 can be developed **in parallel** after Phase 1.

---

## New Files Summary (23 total)

| File | Purpose |
|------|---------|
| `systems/EnemyStateMachine.ts` | Reusable AI state machine |
| `config/EnemyConfig.ts` | Enemy type registry |
| `config/DropConfig.ts` | Loot drop tables |
| `systems/BossArenaManager.ts` | Arena generation & lockdown |
| `ui/BossHealthBar.tsx` | Boss health bar component |
| `entities/VoidStalker.ts` | Intermediate enemy |
| `entities/CursedKnight.ts` | Intermediate enemy |
| `entities/FloatingEye.ts` | Intermediate enemy |
| `entities/DemonSpawner.ts` | Intermediate enemy |
| `entities/RiftWeaver.ts` | Advanced enemy |
| `entities/ArmorColossus.ts` | Advanced enemy |
| `entities/PhaseDemon.ts` | Advanced enemy |
| `entities/ChainDevil.ts` | Advanced enemy |
| `entities/SoulReaper.ts` | Elite enemy |
| `entities/DemonGeneral.ts` | Elite enemy |
| `entities/TerrorMimic.ts` | Elite enemy |
| `entities/Boss.ts` | Boss base class |
| `entities/bosses/MagmaTyrant.ts` | Boss archetype |
| `entities/bosses/VoidWingArchon.ts` | Boss archetype |
| `entities/bosses/ChronoDemon.ts` | Boss archetype |
| `entities/bosses/LegionMaster.ts` | Boss archetype |
| `entities/bosses/PlatformDevourer.ts` | Boss archetype |

## Modified Files Summary (10 total)

| File | Changes |
|------|---------|
| `entities/Enemy.ts` | Add enemyType, tier, isElite, isBlocking, drop hooks |
| `entities/ImpCrawler.ts` | Set enemyType and tier |
| `entities/HellHound.ts` | Set enemyType and tier |
| `entities/ShadowBat.ts` | Set enemyType and tier |
| `entities/DemonTurret.ts` | Set enemyType and tier |
| `systems/SpawnManager.ts` | Registry-based spawning, elite system |
| `systems/CombatManager.ts` | Block check, improved events |
| `systems/LevelGenerator.ts` | Boss arena integration |
| `systems/EventBus.ts` | Boss event types |
| `ui/GameHUD.tsx` | Boss health bar, warnings |

---

## Known Challenges

1. **ProjectilePool reuse** — DemonTurret manages its own projectile group. Need to extract a shared utility for Floating Eye, bosses, etc.
2. **Boss arena injection** — LevelGenerator generates one platform at a time. Arena insertion requires careful `lastPlatformY` state management.
3. **Performance** — Boss summon mechanics (Legion Master, Demon Spawner) may exceed MAX_ENEMIES. Need separate limits for boss-summoned minions.
4. **Terror Mimic** — Must visually match ItemDrop exactly. Reveal animation swaps from item to enemy physics body.
5. **Phase Demon collision** — Toggling platform collision per-enemy in Arcade physics requires custom process callbacks or group swapping.
