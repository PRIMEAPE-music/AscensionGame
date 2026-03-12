# Ascension — Wave 2 Feature Design Document

## Overview

This document covers all planned Wave 2 features organized into implementation waves. Each wave groups related features that can be built together efficiently.

---

## Wave 1: Combat Feel & Elite Enemies

### 1A. Combo Counter System
- **Display**: HUD element showing current combo count + multiplier
- **Mechanics**:
  - Each hit/kill increments combo counter
  - Timer resets on each hit (3 seconds to chain next action)
  - Getting hit resets combo to 0
  - Multiplier tiers: 5x = 1.5x, 10x = 2.0x, 20x = 2.5x, 50x = 3.0x
  - Multiplier applies to essence earned from kills
  - Visual feedback: screen edge glow intensifies with combo, number pulses
- **Integration**: CombatManager tracks combo state, GameHUD renders counter

### 1B. Parry System
- **Input**: Press block (Paladin) or dodge (Monk/Priest) within 150ms of incoming damage
- **Effect**:
  - Negates all damage from the attack
  - Stuns the attacking enemy for 1.5 seconds
  - Reflects 50% of the attack's damage back
  - Perfect parry visual: time-freeze flash (50ms white screen flash)
  - Builds combo counter by +3
- **Class Variants**:
  - Paladin: Shield parry (block key) — 200ms window (most forgiving)
  - Monk: Flow parry (dodge key) — 150ms window, grants +1 flow stack
  - Priest: Holy parry (dodge key) — 150ms window, heals 1 HP on success
- **Integration**: Player.ts parry window tracking, Enemy.ts stun state

### 1C. Elite Enemies
- **Spawn Rules**:
  - Begin spawning at altitude 500m+
  - 8% chance to replace a normal enemy spawn with an elite variant
  - Chance increases by 1% per 500m altitude (caps at 20%)
  - Never spawn during boss fights
- **Visual**: Glowing outline (red/purple), 1.5x size scale, nameplate above
- **Stats**: 3x HP, 1.5x damage, 1.25x speed
- **Affixes** (1 random affix per elite, 2 at altitude 3000m+):
  - **Shielded**: Takes 50% reduced damage from front; must be hit from behind
  - **Teleporting**: Blinks to random nearby position every 4 seconds
  - **Vampiric**: Heals 20% of damage dealt to player
  - **Berserker**: Gains +50% speed and damage below 30% HP
  - **Splitting**: On death, spawns 2 smaller copies at 30% HP each
  - **Reflective**: 25% chance to reflect projectile damage back
  - **Freezing**: Attacks apply 1.5s slow (50% move speed reduction)
  - **Explosive**: Detonates on death dealing 2 damage in AOE radius
- **Rewards**: 3x essence, guaranteed item drop (higher rarity weights)

### 1D. Finishing Moves
- **Trigger**: When enemy is below 15% HP and player attacks, finishing move activates
- **Effect**:
  - Instant kill with special visual (screen shake + particle burst)
  - +5 to combo counter
  - +50% bonus essence from that kill
  - Brief invincibility during animation (200ms)
- **Visual**: Enemy dissolves into essence particles that fly toward player

---

## Wave 2: Items & Synergies

### 2A. Cursed Items
- **Mechanic**: Items with powerful upsides and significant downsides
- **Visual**: Purple/black rarity tier, ominous glow, skull icon
- **Acquisition**: Can appear in shops (discounted), elite drops, gambling shrines
- **Player Choice**: Always show the curse effect before pickup; player must confirm
- **Cursed Items List** (10 items):
  1. **Blood Blade**: +75% attack damage, but lose 1 HP per 10 kills
  2. **Glass Cannon**: +100% damage, but max HP capped at 3
  3. **Temporal Drain**: Cooldowns reduced 50%, but move 20% slower
  4. **Chaos Orb**: Random item effect on each attack, but takes 1 damage every 60 seconds
  5. **Soul Siphon**: Kills heal 1 HP, but essence gain reduced 50%
  6. **Phantom Step**: Triple jump, but wall-jump disabled
  7. **Berserker's Rage**: Damage scales with missing HP (+10% per missing HP), but can't heal above 50% max
  8. **Echo Strike**: Every attack hits twice, but attack speed reduced 30%
  9. **Graviton Core**: Enemies pulled toward you (magnetism), but you fall 30% faster
  10. **Dark Pact**: Start each floor with a random buff, but start each floor taking 1 damage

### 2B. Item Synergy System
- **Detection**: When player collects items that form a synergy set, bonus activates
- **Visual**: Synergy name flashes on screen, affected items glow in inventory
- **Synergy Sets** (8 sets):
  1. **Inferno** (3 fire/damage items): Passive fire aura dealing 1 damage/sec to nearby enemies
  2. **Fortress** (3 defense items): +25% max HP, take -1 damage from all sources (min 1)
  3. **Tempest** (3 speed/mobility items): +30% move speed, attacks generate wind shockwaves
  4. **Lifeline** (3 healing items): Passive regen 1 HP every 20 seconds
  5. **Arsenal** (3 attack items): +20% attack speed, attacks chain to nearby enemy for 30% damage
  6. **Shadow** (3 dodge/stealth items): 15% chance to dodge any attack entirely
  7. **Arcane** (3 cooldown/ability items): Ultimate ability cooldowns reduced 30%
  8. **Avarice** (3 essence/gold items): +50% essence from all sources, shops 20% cheaper
- **Integration**: ItemSynergyManager checks collections on each item pickup

---

## Wave 3: Progression & Subclasses

### 3A. Subclass System
- **Trigger**: At altitude 2000m (boss #2 defeated), player chooses a specialization
- **UI**: Full-screen choice between 2 subclass paths, showing abilities and bonuses
- **Subclasses**:

**Paladin**:
  - **Crusader**: Offense-focused. +25% damage, attacks have 15% chance to smite (2x damage holy burst). New ability: Holy Charge — dash forward dealing damage to all enemies in path.
  - **Templar**: Defense-focused. +50% block effectiveness, blocking heals 1 HP. New ability: Divine Shield — 3 seconds of complete invulnerability (60s cooldown).

**Monk**:
  - **Shadow Dancer**: Evasion-focused. Dodge grants 1s invisibility, +30% crit chance from stealth. New ability: Shadow Step — teleport behind nearest enemy.
  - **Iron Fist**: Power-focused. Unarmed damage +50%, each consecutive hit deals +10% more (stacking). New ability: Quake Punch — ground pound that stuns all grounded enemies.

**Priest**:
  - **Oracle**: Support-focused. Sacred Ground radius doubled, reveals hidden items on minimap. New ability: Prophecy — preview next 3 item choices.
  - **Inquisitor**: Damage-focused. Holy damage +40%, smite enemies below 20% HP. New ability: Judgment — beam of light that pierces all enemies in a line.

### 3B. Achievement-Gated Unlocks
- **System**: Specific achievements unlock new content
- **Unlocks**:
  - "First Blood" (kill first enemy) → Unlock Training Room
  - "Boss Slayer" (defeat first boss) → Unlock Boss Rush Mode
  - "Ascended" (complete ascension) → Unlock Endless Mode
  - "Completionist" (collect 50 unique items) → Starting item choice (pick 1 of 3 items before run)
  - "Untouchable" (reach 500m without taking damage) → Unlock Glass Cannon cursed item in shop pool
  - "Combo Master" (reach 50x combo) → Unlock Combo cosmetic trail effect
  - Each class reaching altitude 5000m → Unlock that class's subclass system
  - Defeat all 5 boss types → Unlock Weekly Challenge mode

---

## Wave 4: Game Modes

### 4A. Boss Rush Mode
- **Access**: Main menu button (unlocked via achievement)
- **Structure**:
  - Fight all 5 boss archetypes in sequence
  - Between each boss: choose 1 of 3 items (curated pool, higher rarity)
  - Start with class abilities + 5 HP
  - No platforming — each arena is a flat boss arena
  - Timer tracked for speedrun leaderboard
- **Difficulty Scaling**: Each boss has 20% more HP than previous
- **Rewards**: Bonus essence based on time, cosmetic unlock for sub-5-minute clear

### 4B. Endless Mode
- **Access**: Main menu button (unlocked via achievement)
- **Structure**:
  - Standard run but after boss #15, difficulty keeps scaling infinitely
  - Every 5 bosses past #15: boss HP +25%, enemy HP +15%, platform gaps +10%
  - New enemy types start appearing with 2-3 affixes at altitude 20000m+
  - Leaderboard tracks highest altitude reached
- **Unique Mechanic**: "Corruption" meter slowly fills — at 100%, random negative modifier activates. Resets on boss kill.

### 4C. Weekly Challenge
- **Structure**: 7-day rotating challenge with 3 fixed modifiers + fixed class
- **Modifiers**: Harder than daily (always includes 1 brutal modifier)
- **Rewards**: 3x essence, exclusive weekly cosmetic
- **Leaderboard**: Separate weekly leaderboard

### 4D. Training Room
- **Access**: Main menu button
- **Features**:
  - Select any boss to practice against (only bosses you've seen)
  - Infinite HP toggle
  - Ability cooldown reset button
  - DPS dummy that shows damage numbers
  - Practice parry timing with configurable enemy attack patterns
- **No Rewards**: No essence or progression from training

---

## Wave 5: Level & Environment

### 5A. Biome-Specific Hazards
- **Depths (0-500m)**:
  - Lava Geysers: Periodic columns of fire from below platforms, 2 damage, 3s warning glow
  - Poison Pools: Green puddles on platforms that deal 1 damage/sec while standing in them
- **Caverns (500-2000m)**:
  - Falling Stalactites: Already implemented, enhance with cluster spawns
  - Ice Patches: Random platform sections freeze over (ice physics) temporarily
  - Cave-ins: Sections of ceiling drop, creating temporary barriers + damage
- **Spire (2000-5000m)**:
  - Lightning Strikes: Random targeted strikes with 1.5s telegraph (circle on ground), 3 damage
  - Wind Gusts: Sudden horizontal force bursts pushing player toward edges
  - Crumbling Ledges: Platforms at edges slowly crumble if stood on too long
- **Summit (5000m+)**:
  - Void Rifts: Portals that spawn enemies or pull player toward them
  - Gravity Flux: Periodic gravity reversal zones (2s duration, 15s cooldown)
  - Reality Tears: Moving vertical damage zones that sweep across the screen

### 5B. Secret Rooms
- **Detection**: Certain vertical walls have a subtle shimmer/crack
- **Entry**: Attack the cracked wall to break it, revealing a passage
- **Spawn Rate**: 1 per 800-1200m altitude
- **Contents** (random):
  - Treasure room: 3 item choices (guaranteed rare+)
  - Challenge room: Defeat a wave of elites in 30s for a legendary item
  - Shrine room: Choose a permanent buff (lasts rest of run)
  - Lore room: Story fragment + bonus essence

### 5C. NPC Encounters
- **Spawn**: On special platforms (similar to shop), 1 per 600-1000m
- **NPC Types**:
  - **The Wanderer**: Offers a timed quest ("kill 10 enemies in 30s") → reward: random item
  - **The Gambler** (enhanced): Existing gambling shrine, add new game types (dice roll, card flip)
  - **The Blacksmith**: Upgrade an existing item (+1 rarity tier) for essence cost
  - **The Cursed One**: Offers cursed items at steep discount, warns about the curse
  - **The Seer**: Reveals the next boss type and recommended strategy

---

## Wave 6: Quality of Life

### 6A. Run History Log
- **Storage**: localStorage, last 20 runs
- **Data Per Run**: Date, class, subclass, altitude, time, kills, bosses defeated, items collected, cause of death, essence earned
- **UI**: Scrollable list in Statistics screen, click to expand details
- **Visual**: Color-coded by how far the run got (red=early death, gold=ascension)

### 6B. Item Codex
- **Location**: Inside Collection screen
- **Display**: Grid of all items, discovered items show icon + stats, undiscovered show "???"
- **Progress**: "X/Y items discovered" counter
- **Filters**: By rarity, by type (weapon, armor, accessory, cursed)
- **Detail View**: Click item to see full description, stats, and which synergy sets it belongs to

### 6C. Training Room (see Wave 4D)

---

## Wave 7: Multiplayer Enhancements

### 7A. Shared Item Drafting (Co-op)
- **Mechanic**: When an item drops in co-op, both players see a selection screen
- **Rules**:
  - 3 items shown to both players
  - Each player picks one (can't pick same item)
  - If both want the same item, first to select gets it, other picks from remaining
  - Timer: 15 seconds to choose, auto-pick if time runs out
- **UI**: Split-screen item selection overlay

### 7B. Co-op Revive Upgrades
- **New Items** (co-op only, appear in item pool when co-op active):
  - **Soul Link**: When one player would die, split the lethal damage between both
  - **Phoenix Feather**: One-time auto-revive with full HP (consumed on use)
  - **Shared Vigor**: Both players' max HP increased by 2 in co-op
  - **Battle Bond**: Staying near partner increases both players' damage by 15%
  - **Rescue Rush**: Revive timer reduced to 2 seconds instead of 5

### 7C. Competitive Mode (Future — Online Prerequisite)
- **Structure**: Two players race up parallel tracks
- **Sabotage**: Every 30 seconds, leader can send a hazard to opponent's screen
- **Hazard Types**: Enemy wave, platform freeze, gravity flip, darkness (reduced vision)
- **Win Condition**: First to reach target altitude, or highest altitude when time expires

---

## Implementation Priority

| Wave | Features | Estimated Complexity |
|------|----------|---------------------|
| 1 | Combo Counter, Parry, Elites, Finishing Moves | Medium |
| 2 | Cursed Items, Synergy System | Medium |
| 3 | Subclasses, Achievement Unlocks | High |
| 4 | Boss Rush, Endless, Weekly, Training Room | High |
| 5 | Biome Hazards, Secret Rooms, NPCs | High |
| 6 | Run History, Item Codex | Low-Medium |
| 7 | Co-op Items, Shared Drafting | Medium |

---

## Technical Notes

- All new systems should follow the existing singleton/manager pattern
- New items integrate into existing `ItemDatabase.ts` with rarity weights
- Elite system extends `Enemy.ts` base class with affix composition
- Subclass data goes in `ClassConfig.ts` extension
- Game modes share `MainScene` with mode-specific config objects
- Combo/parry state lives in `Player.ts`, HUD rendering in `GameHUD.tsx`
- Synergy detection runs on item pickup via new `SynergyManager.ts`
- Run history uses `PersistentStats.ts` localStorage pattern
