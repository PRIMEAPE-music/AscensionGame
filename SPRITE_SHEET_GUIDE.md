# Ascension Game - Sprite Sheet Requirements

> Complete list of all characters, enemies, bosses, and entities requiring sprite sheets.
> Current frame size: **92x128px** | Physics body: **32x48px** (centered)

---

## Table of Contents

1. [Player Character](#1-player-character)
2. [Basic Tier Enemies](#2-basic-tier-enemies)
3. [Intermediate Tier Enemies](#3-intermediate-tier-enemies)
4. [Advanced Tier Enemies](#4-advanced-tier-enemies)
5. [Elite Tier Enemies](#5-elite-tier-enemies)
6. [Bosses](#6-bosses)
7. [Special Entities](#7-special-entities)
8. [Summary Table](#8-summary-table)

---

## 1. Player Character

### Monk (Player)
**Texture keys**: `monk_idle`, `monk_run`, `monk_jump`, `monk_fall`, `monk_land`, `monk_wall_slide`
**File**: `src/game/entities/Player.ts`

| Animation | Min Frames | Ideal Frames | FPS | Loop | Notes |
|-----------|------------|--------------|-----|------|-------|
| `monk_idle` | 4 | 6 | 6 | Yes | Subtle breathing, slight sway |
| `monk_run` | 6 | 8 | 12 | Yes | Full run cycle |
| `monk_jump` | 2 | 3 | 8 | No | Crouch anticipation -> launch |
| `monk_fall` | 2 | 3 | 6 | Yes | Arms up, legs dangling |
| `monk_land` | 2 | 3 | 10 | No | Impact squat -> stand |
| `monk_wall_slide` | 2 | 3 | 6 | Yes | Gripping wall, sliding down |

**Total: Min 18 frames | Ideal 26 frames across 6 sheets**

**Visual states handled by code** (no extra frames needed):
- Attack combo flash (white tint)
- Parry/dodge flash
- Invincibility flicker
- Knockback (movement-based)

---

## 2. Basic Tier Enemies

> All basic enemies currently use the `dude` placeholder texture with color tinting.
> Each should get its own dedicated sprite sheet.

### 2a. Imp Crawler
**Color ref**: Green (0x00ff00) | **HP**: 3 | **Speed**: 100
**File**: `src/game/entities/ImpCrawler.ts`

| Animation | Min Frames | Ideal Frames | FPS | Loop | Notes |
|-----------|-----------|-------------|-----|------|-------|
| idle | 3 | 4 | 6 | Yes | Low crouch, twitchy |
| crawl | 4 | 6 | 10 | Yes | Scurrying movement |
| attack_telegraph | 2 | 3 | 8 | No | Rears back before lunge |
| lunge | 2 | 3 | 12 | No | Fast forward swipe |
| flee | 4 | 6 | 14 | Yes | Frantic scurry away |
| hurt | 1 | 2 | - | No | Flinch/flash |
| death | 3 | 5 | 8 | No | Collapse, dissolve |

**Total: Min 19 frames | Ideal 29 frames**

---

### 2b. Shadow Bat
**Color ref**: Purple (0x550055) | **HP**: 2 | **Speed**: 100
**File**: `src/game/entities/ShadowBat.ts`

| Animation | Min Frames | Ideal Frames | FPS | Loop | Notes |
|-----------|-----------|-------------|-----|------|-------|
| hover | 3 | 6 | 8 | Yes | Wing flap cycle, sine float |
| dive_telegraph | 2 | 3 | 10 | No | Wings fold, flash |
| dive | 2 | 3 | 12 | No | Tucked dive, streaking down |
| recover | 2 | 3 | 8 | No | Wings spread, pull up |
| flee | 3 | 4 | 10 | Yes | Frantic upward flapping |
| hurt | 1 | 2 | - | No | Tumble/flash |
| death | 3 | 5 | 8 | No | Spiral fall, poof |

**Total: Min 16 frames | Ideal 26 frames**

---

### 2c. Demon Turret
**Color ref**: Dark Red (0x990000) | **HP**: 5 | **Speed**: 0 (stationary)
**File**: `src/game/entities/DemonTurret.ts`

| Animation | Min Frames | Ideal Frames | FPS | Loop | Notes |
|-----------|-----------|-------------|-----|------|-------|
| idle | 2 | 4 | 4 | Yes | Slight pulsing glow |
| aim | 2 | 3 | 6 | No | Rotates/tilts toward player |
| charge | 2 | 4 | 8 | No | Glowing buildup, telegraph pulse |
| fire | 2 | 3 | 12 | No | Recoil kick, muzzle flash |
| cooldown | 2 | 3 | 6 | No | Dim, recharging |
| hurt | 1 | 2 | - | No | Spark/flash |
| death | 3 | 5 | 8 | No | Explode, crumble |

**Total: Min 14 frames | Ideal 24 frames**

---

### 2d. Hell Hound
**Color ref**: Orange-Red (0xff4400) | **HP**: 4 | **Speed**: 250
**File**: `src/game/entities/HellHound.ts`

| Animation | Min Frames | Ideal Frames | FPS | Loop | Notes |
|-----------|-----------|-------------|-----|------|-------|
| patrol | 4 | 6 | 8 | Yes | Prowling walk |
| sprint | 4 | 6 | 14 | Yes | Full gallop |
| lunge_telegraph | 2 | 3 | 8 | No | Crouch, flash orange |
| lunge | 2 | 3 | 12 | No | Leaping bite |
| land | 2 | 3 | 10 | No | Post-lunge recovery |
| desperate | 4 | 6 | 16 | Yes | Faster, more feral sprint |
| hurt | 1 | 2 | - | No | Yelp/flinch |
| death | 3 | 5 | 8 | No | Collapse, fade |

**Total: Min 22 frames | Ideal 34 frames**

---

## 3. Intermediate Tier Enemies

### 3a. Void Stalker
**Color ref**: Purple (0x6600aa) | **HP**: 6 | **Speed**: 150
**File**: `src/game/entities/VoidStalker.ts`

| Animation | Min Frames | Ideal Frames | FPS | Loop | Notes |
|-----------|-----------|-------------|-----|------|-------|
| patrol | 4 | 6 | 8 | Yes | Creeping walk |
| stalk | 4 | 6 | 6 | Yes | Slow, hunched follow |
| teleport_out | 3 | 4 | 12 | No | Fade/dissolve away |
| teleport_in | 3 | 4 | 12 | No | Materialize from shadow |
| backstab | 2 | 3 | 12 | No | Fast strike from behind |
| recovery | 2 | 3 | 8 | No | Post-attack pause |
| flee | 3 | 4 | 10 | Yes | Phase-stepping away |
| stun | 1 | 2 | 4 | Yes | Dazed, wobble |
| hurt | 1 | 2 | - | No | Flinch |
| death | 3 | 5 | 8 | No | Dissolve into shadow |

**Total: Min 26 frames | Ideal 39 frames**

---

### 3b. Cursed Knight
**Color ref**: Blue (0x4444aa) | **HP**: 10 | **Speed**: 60
**File**: `src/game/entities/CursedKnight.ts`

| Animation | Min Frames | Ideal Frames | FPS | Loop | Notes |
|-----------|-----------|-------------|-----|------|-------|
| patrol | 4 | 6 | 6 | Yes | Heavy armored walk |
| approach | 4 | 6 | 8 | Yes | Weapon raised, advancing |
| block | 2 | 3 | - | No | Shield up, stationary |
| strike_telegraph | 2 | 3 | 8 | No | Overhead windup, flash |
| strike | 2 | 4 | 12 | No | Downward slash |
| recovery | 2 | 3 | 6 | No | Pulling weapon back |
| desperate | 4 | 6 | 10 | Yes | Faster, wilder swings |
| stun | 1 | 2 | 4 | Yes | Staggered |
| hurt | 1 | 2 | - | No | Armor clang, flinch |
| death | 3 | 6 | 8 | No | Collapse, armor scatter |

**Total: Min 25 frames | Ideal 41 frames**

---

### 3c. Floating Eye
**Color ref**: Yellow (0xffff00) | **HP**: 4 | **Speed**: 80
**File**: `src/game/entities/FloatingEye.ts`

| Animation | Min Frames | Ideal Frames | FPS | Loop | Notes |
|-----------|-----------|-------------|-----|------|-------|
| hover | 3 | 4 | 6 | Yes | Bobbing, pupil tracking |
| charge | 3 | 4 | 8 | No | Eye widens, color shift to red |
| beam | 2 | 4 | 10 | Yes | Beam firing, pupil locked |
| beam_end | 2 | 3 | 8 | No | Beam fizzle, eye dim |
| cooldown | 2 | 3 | 4 | Yes | Half-closed, recovering |
| flee | 3 | 4 | 10 | Yes | Rapid upward bob |
| stun | 1 | 2 | 4 | Yes | Spinning/dazed |
| hurt | 1 | 2 | - | No | Blink, flash |
| death | 3 | 5 | 8 | No | Pop, splatter |

**Total: Min 20 frames | Ideal 31 frames**

---

### 3d. Demon Spawner
**Color ref**: Magenta (0x880088) | **HP**: 8 | **Speed**: 0 (stationary)
**File**: `src/game/entities/DemonSpawner.ts`

| Animation | Min Frames | Ideal Frames | FPS | Loop | Notes |
|-----------|-----------|-------------|-----|------|-------|
| idle | 2 | 4 | 4 | Yes | Pulsing core glow |
| alert | 2 | 3 | 6 | No | Brightens, opens |
| summon | 3 | 6 | 10 | No | Flashing pulse, portal opens |
| cooldown | 2 | 3 | 4 | Yes | Dims, recharging |
| stun | 1 | 2 | 4 | Yes | Sparking, unstable |
| hurt | 1 | 2 | - | No | Crack/flash |
| death | 3 | 6 | 8 | No | Implode, shatter |

**Total: Min 14 frames | Ideal 26 frames**

---

## 4. Advanced Tier Enemies

### 4a. Rift Weaver
**Color ref**: Cyan (0x00cccc) | **HP**: 12 | **Speed**: 120
**File**: `src/game/entities/RiftWeaver.ts`

| Animation | Min Frames | Ideal Frames | FPS | Loop | Notes |
|-----------|-----------|-------------|-----|------|-------|
| float | 3 | 4 | 6 | Yes | Hovering, robes flowing |
| teleport_out | 3 | 5 | 12 | No | Rift opens, figure dissolves |
| teleport_in | 3 | 5 | 12 | No | Rift opens, figure reforms |
| portal_cast | 3 | 4 | 8 | No | Hands raised, portal spawn |
| cooldown | 2 | 3 | 4 | Yes | Arms lowered, dim glow |
| desperate | 3 | 4 | 8 | Yes | Erratic floating, faster |
| hurt | 1 | 2 | - | No | Flicker |
| death | 3 | 6 | 8 | No | Rift implodes, consumed |

**Total: Min 21 frames | Ideal 33 frames**

---

### 4b. Armor Colossus
**Color ref**: Gray (0x888888) | **HP**: 25 | **Speed**: 40
**File**: `src/game/entities/ArmorColossus.ts`

| Animation | Min Frames | Ideal Frames | FPS | Loop | Notes |
|-----------|-----------|-------------|-----|------|-------|
| patrol | 4 | 6 | 4 | Yes | Very slow, heavy footfalls |
| approach | 4 | 6 | 6 | Yes | Slightly faster advance |
| stomp_telegraph | 2 | 4 | 6 | No | Raises fists, body flashes |
| stomp | 3 | 4 | 10 | No | Slam down, impact frame |
| shockwave | 2 | 3 | 10 | No | Ground ripple expanding |
| recovery | 2 | 3 | 4 | No | Slow stand-up |
| desperate | 4 | 6 | 8 | Yes | Faster stomping walk |
| hurt | 1 | 2 | - | No | Barely flinches, sparks |
| death | 4 | 6 | 6 | No | Crumbles piece by piece |

**Total: Min 26 frames | Ideal 40 frames**

---

### 4c. Phase Demon
**Color ref**: Magenta (0xff00aa) | **HP**: 8 | **Speed**: 180
**File**: `src/game/entities/PhaseDemon.ts`

| Animation | Min Frames | Ideal Frames | FPS | Loop | Notes |
|-----------|-----------|-------------|-----|------|-------|
| corporeal | 4 | 6 | 10 | Yes | Normal chase movement |
| phase_out | 3 | 4 | 12 | No | Flicker, fade transparent |
| incorporeal | 3 | 4 | 6 | Yes | Semi-transparent floating |
| phase_in | 3 | 4 | 12 | No | Flicker, become solid |
| desperate | 4 | 6 | 12 | Yes | Rapid phase-shifting run |
| hurt | 1 | 2 | - | No | Only when corporeal |
| death | 3 | 5 | 8 | No | Phase fracture, shatter |

**Total: Min 21 frames | Ideal 31 frames**

---

### 4d. Chain Devil
**Color ref**: Orange-Brown (0xcc4400) | **HP**: 10 | **Speed**: 0 (suspended/pendulum)
**File**: `src/game/entities/ChainDevil.ts`

| Animation | Min Frames | Ideal Frames | FPS | Loop | Notes |
|-----------|-----------|-------------|-----|------|-------|
| swing | 4 | 6 | 8 | Yes | Pendulum sway on chain |
| whip_telegraph | 2 | 3 | 8 | No | Arm draws back, glow |
| whip | 2 | 4 | 12 | No | Whip crack, projectile spawn |
| whip_recovery | 2 | 3 | 6 | No | Arm returns |
| desperate | 4 | 6 | 10 | Yes | Faster swinging, angrier |
| stun | 1 | 2 | 4 | Yes | Limp on chain |
| hurt | 1 | 2 | - | No | Jolt |
| death | 3 | 5 | 8 | No | Chain snaps, falls |

**Total: Min 19 frames | Ideal 31 frames**

---

## 5. Elite Tier Enemies

### 5a. Soul Reaper
**Color ref**: Dark Purple (0x220044) | **HP**: 20 | **Speed**: 100
**File**: `src/game/entities/SoulReaper.ts`

| Animation | Min Frames | Ideal Frames | FPS | Loop | Notes |
|-----------|-----------|-------------|-----|------|-------|
| pursue | 4 | 6 | 8 | Yes | Smooth gliding, no-gravity |
| drain_aura | 3 | 4 | 6 | Yes | Aura pulsing around body |
| drain | 2 | 4 | 8 | Yes | Life-siphon pose, tendrils |
| reposition | 3 | 4 | 12 | No | Quick fade-shift to new spot |
| desperate | 4 | 6 | 10 | Yes | Faster, aura intensifies |
| hurt | 1 | 2 | - | No | Flicker |
| death | 4 | 6 | 8 | No | Implodes into void |

**Total: Min 21 frames | Ideal 32 frames**

---

### 5b. Demon General
**Color ref**: Dark Red (0xaa0000) | **HP**: 30 | **Speed**: 100
**File**: `src/game/entities/DemonGeneral.ts`

| Animation | Min Frames | Ideal Frames | FPS | Loop | Notes |
|-----------|-----------|-------------|-----|------|-------|
| command | 3 | 4 | 6 | Yes | Standing with authority, maintaining distance |
| approach | 4 | 6 | 8 | Yes | Marching forward |
| buff_cast | 3 | 4 | 8 | No | Raises weapon, aura burst |
| combo_1 | 2 | 3 | 12 | No | First strike - horizontal slash |
| combo_2 | 2 | 3 | 12 | No | Second strike - upward cut |
| combo_3 | 3 | 4 | 12 | No | Third strike - heavy overhead |
| recovery | 2 | 3 | 6 | No | Pulls back to stance |
| desperate | 4 | 6 | 12 | Yes | Relentless assault walk |
| hurt | 1 | 2 | - | No | Staggers but holds ground |
| death | 4 | 6 | 8 | No | Falls to knee, collapses |

**Total: Min 28 frames | Ideal 41 frames**

---

### 5c. Terror Mimic
**Color ref**: Golden (0xffdd00) disguised / Red (0xff2200) revealed | **HP**: 15 | **Speed**: 200
**File**: `src/game/entities/TerrorMimic.ts`

| Animation | Min Frames | Ideal Frames | FPS | Loop | Notes |
|-----------|-----------|-------------|-----|------|-------|
| disguise | 2 | 3 | 4 | Yes | Looks like an item drop, bobbing |
| disguise_tell | 2 | 3 | 6 | Yes | Subtle flicker/twitch (eagle-eyed tell) |
| reveal | 3 | 5 | 10 | No | Grows, unfolds, turns red, opens maw |
| lunge | 2 | 3 | 14 | No | Lunging bite |
| chase | 4 | 6 | 12 | Yes | Relentless bounding pursuit |
| recovery | 2 | 3 | 8 | No | Brief pause between lunges |
| hurt | 1 | 2 | - | No | Recoil |
| death | 3 | 5 | 8 | No | Shrinks, pops |

**Total: Min 19 frames | Ideal 30 frames**

---

## 6. Bosses

> Bosses are large-scale enemies (1.3x-1.7x scale) with multi-phase fights.
> Each boss has 3 escalating phases and a shared enrage system.
> Consider larger frame sizes for bosses (e.g., 128x176px or 148x200px).

### 6a. Magma Tyrant (Boss Cycle #1)
**Color ref**: Orange (0xff4400) | **Scale**: 1.6x | **HP**: Scaled by boss number
**File**: `src/game/entities/bosses/MagmaTyrant.ts`

| Animation | Min Frames | Ideal Frames | FPS | Loop | Notes |
|-----------|-----------|-------------|-----|------|-------|
| idle | 3 | 4 | 4 | Yes | Heavy breathing, embers rising |
| walk | 4 | 6 | 6 | Yes | Ground-shaking steps |
| stomp_telegraph | 2 | 4 | 8 | No | Jumps up, body flashes |
| stomp_impact | 2 | 3 | 10 | No | Landing slam, shockwave |
| flame_wave_cast | 3 | 4 | 8 | No | Arms sweep, fire bursts |
| boulder_toss | 3 | 5 | 10 | No | Reaches down, hurls rock |
| charge_startup | 2 | 3 | 8 | No | Lowers head, scrapes ground |
| charge | 3 | 4 | 14 | Yes | Full-speed bull rush |
| slam_telegraph | 2 | 3 | 8 | No | Raises both fists |
| slam | 2 | 3 | 12 | No | Double fist ground pound |
| enrage | 2 | 4 | 8 | No | Roar, flames intensify |
| hurt | 1 | 2 | - | No | Barely staggers |
| death | 5 | 8 | 6 | No | Crumbles, magma pools, explosion |

**Total: Min 34 frames | Ideal 53 frames**

---

### 6b. Void Wing Archon (Boss Cycle #2)
**Color ref**: Purple (0x6600ff) | **Scale**: 1.4x | **HP**: Scaled
**File**: `src/game/entities/bosses/VoidWingArchon.ts`

| Animation | Min Frames | Ideal Frames | FPS | Loop | Notes |
|-----------|-----------|-------------|-----|------|-------|
| hover | 4 | 6 | 8 | Yes | Wing flap, side-to-side sway |
| dive_telegraph | 2 | 3 | 10 | No | Wings fold, white flash |
| dive | 2 | 3 | 14 | No | Streaking downward |
| dive_recover | 2 | 3 | 8 | No | Wings spread, pulls up |
| feather_storm_cast | 3 | 4 | 8 | No | Wings spread wide, shaking |
| feather_barrage | 3 | 4 | 10 | Yes | Rapid wing beats, feathers fly |
| charge_startup | 2 | 3 | 8 | No | Tucks, glows |
| charge | 2 | 3 | 14 | No | Horizontal streak |
| enrage | 2 | 4 | 8 | No | Wings flare, void aura |
| hurt | 1 | 2 | - | No | Tumbles briefly |
| death | 5 | 8 | 6 | No | Wings shatter, spirals down |

**Total: Min 28 frames | Ideal 43 frames**

---

### 6c. Chrono Demon (Boss Cycle #3)
**Color ref**: Cyan (0x00ffaa) | **Scale**: 1.3x | **HP**: Scaled
**File**: `src/game/entities/bosses/ChronoDemon.ts`

| Animation | Min Frames | Ideal Frames | FPS | Loop | Notes |
|-----------|-----------|-------------|-----|------|-------|
| idle | 3 | 4 | 6 | Yes | Pacing, temporal shimmer |
| strike_telegraph | 2 | 3 | 8 | No | Marks appear, flash |
| strike | 2 | 3 | 12 | No | Rapid sequential hits |
| time_bomb_place | 2 | 4 | 8 | No | Touches ground, glyph appears |
| rewind | 3 | 5 | 10 | No | Reverse-motion blur effect |
| charge_startup | 2 | 3 | 8 | No | Temporal winds gather |
| charge | 2 | 3 | 14 | No | Time-blur dash |
| enrage | 2 | 4 | 8 | No | Time distortion intensifies |
| hurt | 1 | 2 | - | No | Flicker |
| death | 5 | 8 | 6 | No | Time fracture, shatters |

**Total: Min 24 frames | Ideal 39 frames**

---

### 6d. Legion Master (Boss Cycle #4)
**Color ref**: Dark Purple (0x440066) | **Scale**: 1.4x | **HP**: Scaled
**File**: `src/game/entities/bosses/LegionMaster.ts`

| Animation | Min Frames | Ideal Frames | FPS | Loop | Notes |
|-----------|-----------|-------------|-----|------|-------|
| idle | 3 | 4 | 6 | Yes | Commanding stance, aura |
| summon_cast | 3 | 5 | 8 | No | Arms raise, portal opens |
| summon_complete | 2 | 3 | 8 | No | Minions emerge |
| dark_bolt_charge | 2 | 3 | 8 | No | Dark energy gathers |
| dark_bolt_fire | 2 | 3 | 12 | No | Projectile launches |
| buff_circle | 3 | 4 | 6 | No | Aura expands to buff minions |
| charge_startup | 2 | 3 | 8 | No | Gathers power |
| charge | 2 | 3 | 14 | No | Dark dash |
| enrage | 2 | 4 | 8 | No | Dual-summon power surge |
| hurt | 1 | 2 | - | No | Barely reacts |
| death | 5 | 8 | 6 | No | Minions die, master implodes |

**Total: Min 27 frames | Ideal 42 frames**

---

### 6e. Platform Devourer (Boss Cycle #5)
**Color ref**: Brown (0x664422) | **Scale**: 1.7x (largest boss) | **HP**: Scaled
**File**: `src/game/entities/bosses/PlatformDevourer.ts`

| Animation | Min Frames | Ideal Frames | FPS | Loop | Notes |
|-----------|-----------|-------------|-----|------|-------|
| idle | 3 | 4 | 4 | Yes | Lumbering, maw dripping |
| burrow | 3 | 5 | 10 | No | Sinks into ground, vanishes |
| emerge_telegraph | 2 | 3 | 8 | No | Ground cracks, rumble |
| emerge | 3 | 5 | 10 | No | Erupts from below |
| bite | 3 | 5 | 10 | No | Lunges, jaws chomp (destroys platform) |
| spike_summon | 2 | 4 | 8 | No | Slams ground, spikes rise |
| charge_startup | 2 | 3 | 8 | No | Lowers body, growls |
| charge | 3 | 4 | 12 | Yes | Bulldozing rush |
| enrage | 2 | 4 | 8 | No | Skin cracks, glows |
| hurt | 1 | 2 | - | No | Recoils, snarls |
| death | 5 | 8 | 6 | No | Crumbles into rubble |

**Total: Min 29 frames | Ideal 47 frames**

---

## 7. Special Entities

### 7a. Training Dummy
**Color ref**: Gray (0x888888) | **HP**: 9999 (invincible, resets)
**File**: `src/game/entities/TrainingDummy.ts`

| Animation | Min Frames | Ideal Frames | FPS | Loop | Notes |
|-----------|-----------|-------------|-----|------|-------|
| idle | 2 | 3 | 4 | Yes | Stationary, slight wobble |
| attack_telegraph | 2 | 3 | 6 | No | Red rectangle expands (code-generated) |
| attack | 2 | 3 | 10 | No | Strikes forward |
| hurt | 1 | 2 | - | No | Wobbles on hit |

**Total: Min 7 frames | Ideal 11 frames**

---

### 7b. NPCs
**Types**: Wanderer (0x44bbaa), Blacksmith (0xdd8833), Cursed One (0x9933cc), Seer (0x66aadd)
**File**: `src/game/entities/NPC.ts`

Each NPC type needs:

| Animation | Min Frames | Ideal Frames | FPS | Loop | Notes |
|-----------|-----------|-------------|-----|------|-------|
| idle | 3 | 4 | 4 | Yes | Unique pose per NPC type |
| interact | 2 | 3 | 6 | No | Reaction when player talks |

**Total per NPC: Min 5 frames | Ideal 7 frames**
**Total for all 4 NPCs: Min 20 frames | Ideal 28 frames**

---

### 7c. Item Drop
**File**: `src/game/entities/ItemDrop.ts`

| Animation | Min Frames | Ideal Frames | FPS | Loop | Notes |
|-----------|-----------|-------------|-----|------|-------|
| bob | 2 | 4 | 6 | Yes | Vertical oscillation |
| collect | 2 | 3 | 12 | No | Flash + shrink on pickup |

**Total: Min 4 frames | Ideal 7 frames**

> Note: Item icon/color is determined by item data. A single generic item container sheet works, with code-applied tinting.

---

### 7d. Portal Platform
**File**: `src/game/entities/PortalPlatform.ts`
**Types**: Blue (0x4488ff), Orange (0xff8844)

| Animation | Min Frames | Ideal Frames | FPS | Loop | Notes |
|-----------|-----------|-------------|-----|------|-------|
| idle_pulse | 3 | 4 | 6 | Yes | Gentle glow pulse |
| active | 3 | 6 | 10 | Yes | Spinning ring, bright glow |
| cooldown | 2 | 3 | 4 | Yes | Dim, grayed out |

**Total per type: Min 8 frames | Ideal 13 frames**
**Total for both: Min 16 frames | Ideal 26 frames**

---

## 8. Summary Table

| # | Entity | Category | Min Frames | Ideal Frames | Sheet Count |
|---|--------|----------|-----------|-------------|-------------|
| 1 | **Monk (Player)** | Player | 18 | 26 | 6 sheets |
| 2 | Imp Crawler | Basic | 19 | 29 | 1 sheet |
| 3 | Shadow Bat | Basic | 16 | 26 | 1 sheet |
| 4 | Demon Turret | Basic | 14 | 24 | 1 sheet |
| 5 | Hell Hound | Basic | 22 | 34 | 1 sheet |
| 6 | Void Stalker | Intermediate | 26 | 39 | 1 sheet |
| 7 | Cursed Knight | Intermediate | 25 | 41 | 1 sheet |
| 8 | Floating Eye | Intermediate | 20 | 31 | 1 sheet |
| 9 | Demon Spawner | Intermediate | 14 | 26 | 1 sheet |
| 10 | Rift Weaver | Advanced | 21 | 33 | 1 sheet |
| 11 | Armor Colossus | Advanced | 26 | 40 | 1 sheet |
| 12 | Phase Demon | Advanced | 21 | 31 | 1 sheet |
| 13 | Chain Devil | Advanced | 19 | 31 | 1 sheet |
| 14 | Soul Reaper | Elite | 21 | 32 | 1 sheet |
| 15 | Demon General | Elite | 28 | 41 | 1 sheet |
| 16 | Terror Mimic | Elite | 19 | 30 | 1 sheet |
| 17 | Magma Tyrant | Boss | 34 | 53 | 1 sheet |
| 18 | Void Wing Archon | Boss | 28 | 43 | 1 sheet |
| 19 | Chrono Demon | Boss | 24 | 39 | 1 sheet |
| 20 | Legion Master | Boss | 27 | 42 | 1 sheet |
| 21 | Platform Devourer | Boss | 29 | 47 | 1 sheet |
| 22 | Training Dummy | Special | 7 | 11 | 1 sheet |
| 23 | NPCs (x4) | Special | 20 | 28 | 4 sheets |
| 24 | Item Drop | Special | 4 | 7 | 1 sheet |
| 25 | Portal Platform (x2) | Special | 16 | 26 | 2 sheets |
| | **TOTALS** | | **518** | **800** | **31 sheets** |

---

## Notes

- **Minimum frames** = functional animation, may look choppy. Good enough for prototyping.
- **Ideal frames** = smooth, polished animation. Target for release quality.
- **Player** uses separate sheets per animation (already set up as `monk_idle`, `monk_run`, etc.).
- **All enemies/bosses** currently use the `dude` placeholder texture with color tinting. Each needs its own dedicated sheet.
- **Bosses** should use larger frame dimensions than regular enemies (suggested 128x176px or larger) to match their in-game scale (1.3x-1.7x).
- **Shared effects** (projectiles, shockwaves, explosions, essence particles) are code-generated and don't need sprite sheets unless you want to replace them.
- Frame sizes can vary per entity -- smaller enemies like Shadow Bat could use 64x64px, while Armor Colossus might need 96x144px.
