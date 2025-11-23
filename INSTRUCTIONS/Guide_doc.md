# **ASCENSION** - Complete Game Design Document

## 📋 Core Concept Overview

**Genre:** 2D Roguelike Platformer with Beat 'em Up Combat  
**Core Loop:** Climb infinitely upward, defeat enemies, collect items, defeat bosses, die and retry with unlocked abilities  
**Inspirations:** MapleStory (combat), N+ (physics/movement), Hades (roguelike progression)  
**Platforms:** Web (primary) and Mobile  
**Session Length:** 15-45 minutes per run

---

## 🎮 Core Game Flow

### Run Structure
1. **Pre-Run Phase:** Select class, equip gold items from collection, choose difficulty modifiers (optional)
2. **Climbing Phase:** Move upward, encounter enemies, collect items, navigate platforms
3. **Boss Phase:** Every 1000 meters, arena locks, defeat boss to progress
4. **Item Decision:** Choose to keep or replace silver items, automatically receive gold items to collection
5. **Continue or Die:** Return to climbing or game over
6. **Post-Run:** Review statistics, unlock new gold items, return to menu

### Victory & Death Conditions
- **Death:** Lose all health (3 base) = Run ends, return to menu with any new gold items unlocked
- **Victory:** No traditional "win" - goal is to climb as high as possible before death
- **Scoring:** Altitude reached is primary metric, secondary metrics include time, kills, items collected

---

## 🎯 Movement & Physics System

### Core Movement Mechanics

**Ground Movement:**
- Left/Right movement with acceleration and deceleration
- Top speed influenced by class and items
- Momentum-based: doesn't stop instantly, slides based on platform friction
- Different friction values per platform type

**Jumping:**
- Single jump (base) with height determined by button hold duration
- Short tap = low hop, full hold = maximum height
- Jump height affected by movement speed (running jump goes higher)
- Coyote time: 0.1 seconds after leaving platform edge where jump still works
- Jump buffering: pressing jump slightly before landing executes jump immediately on landing

**Wall Interaction:**
- Wall slide: Touching wall while falling reduces fall speed by 60%
- Wall jump: Jump while sliding launches diagonally away from wall
- Wall jump height is 80% of normal jump
- Can chain wall jumps between parallel walls
- Slight momentum boost when jumping off walls

**Aerial Control:**
- Air steering: can influence horizontal movement mid-air (reduced control compared to ground)
- Class-dependent air control strength
- Maintains horizontal momentum from launch speed
- Gravity applies consistently, terminal velocity cap prevents infinite fall speed

**Advanced Physics:**

**Slope Interaction:**
- Running up slopes reduces speed based on angle
- Running down slopes increases speed up to 150% normal speed
- Can jump from slopes with momentum boost in trajectory direction
- Steep slopes (>45°) cause sliding if standing still

**Curved/Round Platforms:**
- Character rotates to match surface angle
- Speed determines how far you travel around curve
- Can launch off curves at angle matching exit velocity
- High speed + proper input timing = huge aerial launches
- Momentum is preserved from curved launch

**Platform Drop-Through:**
- Down + Jump input drops through one-way platforms
- Cannot drop through solid platforms
- 0.5 second window where you can't re-grab dropped platform (prevents accidents)

---

## ⚔️ Combat System

### Attack Framework

**Three Attack Buttons (B/X/Y or L/;/'):**
- Each button represents a different attack type
- Attack properties vary by class
- Can be used on ground or in air with different results
- Attacks have startup frames, active frames, and recovery frames

**Combo System:**
- Sequential button presses create different combo strings
- Examples: B→B→B (three-hit combo), B→X→Y (launcher combo)
- Combos have timing windows: too slow breaks combo, too fast buffers next input
- Aerial combos different from ground combos
- Successful combos give slight damage multiplier (1.1x, 1.2x, 1.3x for 3-hit combo)

**Directional Attacks:**
- Holding direction while attacking modifies attack
- Up + Attack: Upward strike (anti-air)
- Down + Attack (while airborne): Downward slam/dive attack
- Neutral: Standard horizontal attack

**Attack Properties:**
- **Damage:** How much health enemy loses
- **Knockback:** How far enemy is pushed
- **Hitstun:** How long enemy is frozen after hit
- **Range:** Attack hitbox size and reach
- **Speed:** Startup and recovery time
- **Invincibility Frames:** Brief moments of invulnerability during attack animation

**Hit Feedback:**
- Hit-stop: 2-3 frame pause on impact for impact feel
- Screen shake (intensity based on attack power)
- Particle effects at impact point
- Damage numbers float from enemy
- Sound effect layers (swing sound + impact sound)
- Enemy flash white/red on hit

**Dodge/Parry System:**
- Dedicated dodge input (double-tap direction or separate button)
- 0.3 second cooldown between dodges
- Dodge grants 0.2 seconds of invincibility frames
- Perfect dodge (timing enemy attack): extends i-frames to 0.4 seconds and grants 1.5x damage buff for 2 seconds
- Perfect parry (attack button at exact moment of being hit): reflects damage back, grants brief invincibility

---

## 👥 Class System - Detailed Breakdown

### **PALADIN - The Stalwart Defender**

**Core Identity:** Tank who trades mobility for survivability and devastating close-range damage

**Base Stats:**
- Health: 4 (unique - other classes have 3)
- Movement Speed: 85% of base
- Jump Height: 90% of base
- Attack Range: 60% of base (very close)
- Attack Damage: 130% of base
- Attack Speed: 80% of base (slower swings)
- Air Control: 110% of base (better aerial steering)

**Attack Patterns:**
- B: Heavy overhead smash (high damage, long recovery)
- X: Wide shield bash (knockback, short range)
- Y: Spinning slash (hits multiple times, slight movement)
- Aerial attacks all have downward momentum influence

**Unique Mechanic - Shield Guard:**
- Passive: Blocking stance when standing still for 0.5 seconds
- Reduces damage from frontal attacks by 50%
- Can be active during attack recovery
- Does not prevent knockback or hitstun

**Playstyle:** Slow, methodical, punishes enemy mistakes with massive damage. Strong at controlling small arenas, weak at chasing or escaping.

---

### **MONK - The Swift Striker**

**Core Identity:** Glass cannon with extreme mobility and combo-focused combat

**Base Stats:**
- Health: 3
- Movement Speed: 125% of base
- Jump Height: 120% of base
- Attack Range: 80% of base
- Attack Damage: 70% of base per hit
- Attack Speed: 150% of base (very fast)
- Air Control: 90% of base

**Attack Patterns:**
- B: Quick jab (can chain 5 times rapidly)
- X: Dash punch (moves forward while attacking)
- Y: Uppercut (launches enemies, juggle potential)
- Can cancel attacks into movement earlier than other classes

**Unique Mechanic - Flow State:**
- Consecutive hits without getting hit builds Flow meter (0-100)
- At 25/50/75/100: unlock enhanced movement (faster, higher jumps)
- At 100: attacks gain +50% damage for duration
- Getting hit resets Flow to 0
- Flow decays slowly when not attacking (5 per second)

**Playstyle:** Hit-and-run, requires mastery of dodge timing and combos. High skill ceiling, rewards aggressive play.

---

### **PRIEST - The Sacred Archer**

**Core Identity:** Ranged specialist with utility and zoning capabilities

**Base Stats:**
- Health: 3
- Movement Speed: 100% of base (neutral)
- Jump Height: 100% of base
- Attack Range: 200% of base (projectiles)
- Attack Damage: 90% of base
- Attack Speed: 100% of base
- Air Control: 100% of base

**Attack Patterns:**
- B: Holy bolt (straight projectile, medium speed)
- X: Charged shot (hold to power up, up to 3x damage, pierces enemies)
- Y: Radiant burst (short-range area blast, no projectile)
- Aerial attacks angle downward/upward based on input

**Unique Mechanic - Sacred Ground:**
- Y attack on ground creates temporary 3-meter circle (lasts 5 seconds)
- Standing in circle: regenerate 1 health over 3 seconds (once per circle)
- Enemies in circle: take damage over time (10% of max health per second)
- Only one circle can exist at a time
- Cooldown: 15 seconds

**Playstyle:** Spacing and positioning-focused, weak in close combat but dominates at range. Resource management for healing circles.

---

## 🎲 Item System - Complete Mechanics

### Silver Items (Stat Boosters)

**Acquisition Rules:**
- Start with 1 silver item slot
- Gain +1 silver item slot every 3rd boss (bosses 3, 6, 9, 12, etc.)
- Maximum slots: Theoretically unlimited (tied to bosses defeated)
- Bosses 1-2: 1 slot, Bosses 3-5: 2 slots, Bosses 6-8: 3 slots, etc.

**Drop Sources:**
- Every boss drops 1 random silver item (100% drop rate)
- Elite enemies (rare spawns with silver aura) drop silver items (20% drop rate)
- Shop platforms sell silver items for demon essence
- Gambling shrines can give silver items

**Item Categories & Tiers:**

**Attack Boost:**
- Tier 1: +10% damage (Common)
- Tier 2: +25% damage (Uncommon)
- Tier 3: +50% damage (Rare)

**Defense Armor:**
- Tier 1: Absorb 1 hit before breaking, then item is lost
- Tier 2: Absorb 2 hits before breaking
- Tier 3: Absorb 3 hits before breaking
- Note: These reduce hits taken to 0, not reduce damage

**Movement Speed:**
- Tier 1: +15% movement and attack speed
- Tier 2: +30% movement and attack speed
- Tier 3: +50% movement and attack speed

**Health Upgrade:**
- Tier 1: +1 max health (heals 1 immediately on pickup)
- Tier 2: +2 max health (heals 2 immediately)
- Tier 3: +3 max health (heals 3 immediately)

**Item Quality System:**
Each silver item also has a quality that affects effectiveness:
- Damaged (70% effectiveness): gray border
- Normal (100% effectiveness): white border
- Pristine (130% effectiveness): blue border

**Replacement Mechanic:**
When finding a silver item with full slots:
1. Game pauses, shows current equipped items vs. new item
2. Side-by-side comparison: category, tier, quality, net stat change
3. Player chooses: Take new item (select which to replace) or Leave it
4. 10-second decision timer (auto-skip if expired)
5. Replaced item is lost forever (for this run)

**Synergy Bonuses:**
Matching tier silver items give additional bonuses:
- 2 same-tier items: +10% to both effects
- 3 same-tier items: +25% to all effects
- 4+ same-tier items: +50% to all effects

---

### Gold Items (Abilities & Skills)

**Acquisition Rules:**
- Drop from every 3rd boss (bosses 3, 6, 9, 12, etc.)
- Added to permanent collection when obtained
- Collection persists across all runs and deaths
- Before each run, equip 2 gold items from collection
- Can equip same gold item twice if you have duplicates (some stack, some don't)

**Item Categories:**

**Movement Abilities:**

*Double Jump*
- Adds one additional jump while airborne
- Second jump is 80% height of first jump
- Can change direction on second jump
- Stackable: 2 equipped = triple jump

*Air Dash*
- Press dodge in air to dash horizontally
- 1.5 second cooldown
- Maintains some vertical momentum
- Can be used once per jump
- Stackable: reduces cooldown to 0.8 seconds

*Wall Climb*
- Hold toward wall to slowly climb upward
- Climb speed: 50% of normal walk speed
- Drains stamina bar (5 seconds before forced drop)
- Stamina refills on ground
- Not stackable

*Grappling Hook*
- Aim and shoot hook to latch onto platforms
- Pull yourself toward grapple point rapidly
- 3 second cooldown
- Max range: 10 meters
- Not stackable

**Attack Abilities (Replace one of B/X/Y):**

*Projectile Upgrade*
- Replaces chosen attack with ranged projectile
- Projectile travels 15 meters, pierces one enemy
- Same damage as original attack
- Stackable: second adds homing behavior

*Ground Slam*
- Replaces chosen attack with area slam
- Create shockwave in 5-meter radius
- Knocks enemies upward for juggle
- Stackable: adds second shockwave after delay

*Charged Devastation*
- Replaces chosen attack with charge attack
- Hold button to charge (max 3 seconds)
- Release for massive damage (up to 3x normal)
- Stackable: adds explosion on full charge

*Counter Slash*
- Replaces chosen attack with counter stance
- If hit during stance: negate damage and auto-attack
- 0.5 second stance window, 4 second cooldown
- Not stackable

**Passive Abilities:**

*Health Regeneration*
- Restore 1 health every 30 seconds
- Only works when not in combat (5 seconds after last hit)
- Stackable: reduces timer to 20 seconds

*Dodge Mastery*
- Increases invincibility frames on dodge from 0.2 to 0.4 seconds
- Reduces dodge cooldown from 0.3 to 0.15 seconds
- Stackable: adds brief afterimage trail that damages enemies

*Damage Reflection*
- 30% of received damage reflected back to attacker
- Does not reduce damage taken
- Stackable: increases to 60% reflection

*Temporary Shield*
- When health drops to 1: gain 3 seconds of invincibility
- Once per run
- Stackable: second use available after 5 minutes

**Ultimate Abilities:**

*Cataclysm*
- Press all three attack buttons simultaneously
- Massive explosion covering entire screen
- Deals 500% damage to all enemies
- 60 second cooldown
- Not stackable

*Temporal Rift*
- Activate to slow time to 30% for 5 seconds
- You move at normal speed
- 90 second cooldown
- Stackable: extends duration to 8 seconds

*Divine Intervention*
- Activate for 5 seconds of complete invincibility
- Cannot attack during duration
- 120 second cooldown
- Not stackable

*Essence Burst*
- Temporary power-up based on collected essence
- Every 100 essence spent: +10% all stats for 30 seconds
- Essence consumed on activation
- Not stackable

---

## 👹 Enemy Design System

### Enemy Spawn Rules

**Spawn Timing:**
- Enemies spawn at random intervals between 5-15 seconds
- Spawn rate increases with altitude (shorter intervals at high altitude)
- Never spawn during boss fights
- Never spawn within 3 meters of player
- Spawn points: on platforms above/below player, from screen edges

**Spawn Composition:**
- 0-1000m: 90% basic, 10% intermediate
- 1000-3000m: 70% basic, 25% intermediate, 5% advanced
- 3000-6000m: 40% basic, 40% intermediate, 15% advanced, 5% elite
- 6000-9000m: 10% basic, 40% intermediate, 40% advanced, 10% elite
- 9000m+: 50% advanced, 40% elite, 10% ultra-elite

**Elite Enemy System:**
- Elite versions of any enemy type spawn with silver aura
- Stats: 3x health, 1.5x damage, 1.2x speed
- 20% chance to drop silver item on death
- Always drops 2x essence/souls
- Telegraphed spawn (warning indicator 1 second before)

### Enemy Type Categories

**BASIC TIER (0-3000m introduction):**

**Imp Crawler**
- Movement: Walks back and forth on platforms
- Attack: Short-range swipe when player is close
- Health: 3 hits
- Behavior: Turns around at platform edges, does not jump
- Weakness: Predictable patrol, easy to avoid

**Shadow Bat**
- Movement: Flies in sine wave pattern
- Attack: Dive bomb when player is below
- Health: 2 hits
- Behavior: Stays in upper portion of screen
- Weakness: Telegraph dive with 0.5s warning

**Demon Turret**
- Movement: Stationary on platform
- Attack: Shoots projectiles at player (3 second intervals)
- Health: 5 hits
- Behavior: Rotates to face player
- Weakness: Cannot move, projectiles can be dodged

**Hell Hound**
- Movement: Fast running on ground
- Attack: Lunging bite
- Health: 4 hits
- Behavior: Chases player, jumps between platforms
- Weakness: Predictable jump trajectory

---

**INTERMEDIATE TIER (1000-6000m introduction):**

**Void Stalker**
- Movement: Walks normally, can teleport
- Attack: Appears behind player, backstab attack
- Health: 6 hits
- Behavior: Teleports every 8 seconds, leaves shadow before teleport (0.3s warning)
- Weakness: Vulnerable after teleport (0.5s recovery)

**Cursed Knight**
- Movement: Slow walk, cannot jump
- Attack: Shield bash (frontal block), overhead strike
- Health: 10 hits
- Behavior: Frontal attacks blocked by shield, must attack from behind or above
- Weakness: Slow turn speed, exposed back

**Floating Eye**
- Movement: Hovers, slow floating
- Attack: Laser beam (sweeps horizontally)
- Health: 4 hits
- Behavior: Tracks player with eye, fires laser every 5 seconds
- Weakness: Cannot fire while damaged, laser has 1s charge time

**Demon Spawner**
- Movement: Stationary
- Attack: Summons Imp Crawlers every 10 seconds
- Health: 8 hits
- Behavior: Priority target, kills summons when destroyed
- Weakness: Doesn't attack directly, vulnerable itself

---

**ADVANCED TIER (3000-9000m introduction):**

**Rift Weaver**
- Movement: Teleports in complex patterns
- Attack: Creates damaging portals on platforms
- Health: 12 hits
- Behavior: Portals persist for 3 seconds, teleports through them
- Weakness: Portals damage enemies too

**Armor Colossus**
- Movement: Very slow, heavy footsteps
- Attack: Ground pound (shockwave), grab attack
- Health: 25 hits
- Behavior: Shockwave reaches 5 meters, grab is instant-kill but heavily telegraphed
- Weakness: Attacks are slow, long recovery windows

**Phase Demon**
- Movement: Alternates between corporeal and incorporeal
- Attack: Only attacks when corporeal (quick slashes)
- Health: 8 hits
- Behavior: Incorporeal = invulnerable (50% of time), corporeal = vulnerable but aggressive
- Weakness: Phase shift is predictable 5-second cycle

**Chain Devil**
- Movement: Swings from chains attached to ceiling
- Attack: Whip attacks with 8-meter range
- Health: 10 hits
- Behavior: Swings in pendulum motion, whip attack during swing
- Weakness: Chain can be attacked to drop enemy (instant kill on fall damage)

---

**ELITE TIER (6000m+):**

**Soul Reaper**
- Movement: Glides smoothly, can pass through platforms
- Attack: Soul drain (damages over time if within 4 meters)
- Health: 20 hits
- Behavior: Pursues relentlessly, drain accelerates when player is low health
- Weakness: Takes double damage when draining

**Demon General**
- Movement: Walks, commands other enemies
- Attack: Sword combos, buffs nearby enemies (+50% damage)
- Health: 30 hits
- Behavior: Stays back, lets minions attack, joins when player is weakened
- Weakness: Buff aura breaks when staggered (3 hits in 2 seconds)

**Terror Mimic**
- Movement: Disguises as item pickup
- Attack: Ambush bite when approached
- Health: 15 hits
- Behavior: Sits still until player gets within 2 meters
- Weakness: Items sparkle normally, mimics have subtle tell (slight breathing animation)

---

### Enemy Behavior AI States

**Patrol State:**
- Default state when player not detected
- Move along platform/pattern
- No attacks

**Alert State:**
- Player detected (within detection range)
- Move toward player
- Prepare attack patterns

**Attack State:**
- Within attack range
- Execute attack sequence
- Can be interrupted by taking damage (poise system)

**Flee State:**
- Health below 20%
- Some enemies flee, some become desperate (faster attacks)
- Elite enemies never flee

**Stun State:**
- Hit during attack startup
- Vulnerable window (1.5x damage taken)
- Duration based on attack power that caused stun

---

## 🏆 Boss Design System

### Boss Encounter Structure

**Arena Setup:**
- At exactly 1000m/2000m/3000m etc., visible warning appears
- Player has 5 seconds to prepare before lockdown
- Top and bottom of current screen space seals with barriers
- Boss spawns in center of arena
- Arena dimensions: 30 meters wide, 20 meters tall
- Contains 3-5 platforms for combat

**Boss Health System:**
- All bosses have health bars (visible at top of screen)
- Health scales with boss number (Boss 1: 200 HP, Boss 2: 350 HP, Boss 3: 500 HP, etc.)
- Health bar shows phase transitions (divided into 3 segments)

**Phase System:**
All bosses have 3 phases:

**Phase 1 (100%-66% health):**
- Introduction to boss mechanics
- Moderate attack speed
- 2-3 attack patterns
- Learning phase for player

**Phase 2 (66%-33% health):**
- Increased aggression
- Faster attack speed (1.3x)
- Introduces new attack patterns
- May summon minions
- Environmental changes possible

**Phase 3 (33%-0% health):**
- Desperation state
- Fastest attacks (1.5x speed)
- Most dangerous patterns
- Screen effects intensify
- Some bosses gain new abilities

---

### Boss Types & Examples

**GROUND CONTROLLER - "Magma Tyrant"**

**Concept:** Forces vertical combat, ground is dangerous

**Appearance:** Massive armored demon with molten cracks

**Phase 1 Attacks:**
- Ground Stomp: Creates lava pools on ground platforms (persist 4 seconds)
- Flame Wave: Horizontal wave across ground (jump to avoid)
- Rock Toss: Throws slow-moving boulders

**Phase 2 Changes:**
- Lava pools spread to adjacent platforms
- Double stomp creates two waves
- Boulders break into shrapnel

**Phase 3 Changes:**
- Entire bottom platform becomes permanent lava
- Triple stomp combo
- Boulder rain (5 boulders at once)

**Strategy:** Stay airborne, use wall jumps, attack during stomp recovery

---

**AIR DOMINATOR - "Void Wing Archon"**

**Concept:** Attacks from above, forces ground defense

**Appearance:** Winged demon with multiple eyes

**Phase 1 Attacks:**
- Dive Bomb: Swoops down at player location
- Feather Storm: Rains projectiles from above
- Laser Sweep: Horizontal laser from top of arena

**Phase 2 Changes:**
- Double dive (two swoops in succession)
- Feather storm creates damaging zones on platforms
- Laser becomes vertical slashes

**Phase 3 Changes:**
- Triple dive with wider hitbox
- Continuous feather storm
- Cross-pattern laser

**Strategy:** Bait dives, stay mobile between platforms, watch for tells

---

**PATTERN BOSS - "Chrono Demon"**

**Concept:** Memorization and timing-based

**Appearance:** Humanoid demon with clock motifs

**Phase 1 Attacks:**
- Sequential Strike: Attacks positions 1→2→3→4 in order (telegraphed)
- Time Bomb: Places 3 bombs that explode in sequence
- Rewind: Teleports to previous position, attacks

**Phase 2 Changes:**
- Strike pattern becomes 1→3→2→4 (mixed order)
- 5 bombs, faster explosion sequence
- Rewind leaves damaging afterimage

**Phase 3 Changes:**
- Random strike pattern (must react, cannot memorize)
- 7 bombs with varying timers
- Triple rewind

**Strategy:** Learn patterns, positioning is key, anticipate rewinds

---

**SUMMON BOSS - "Legion Master"**

**Concept:** Crowd control challenge

**Appearance:** Robed demon with summoning circles

**Phase 1 Attacks:**
- Summon Imps: 3 Imp Crawlers appear
- Dark Bolt: Single projectile while minions attack
- Buff Circle: Empowers minions (+damage)

**Phase 2 Changes:**
- Summons Shadow Bats instead
- Triple dark bolt
- Buff gives minions shields

**Phase 3 Changes:**
- Summons Void Stalkers
- Pentagram bolt pattern (5 directions)
- Buff makes minions explode on death

**Strategy:** Prioritize minions or boss based on situation, dodge while managing adds

---

**ENVIRONMENTAL BOSS - "Platform Devourer"**

**Concept:** Arena manipulation

**Appearance:** Massive worm-like demon

**Phase 1 Attacks:**
- Platform Bite: Destroys one platform (respawns after 10 seconds)
- Emerge Attack: Bursts from wall, sweeps across arena
- Spike Wall: Spikes extend from walls briefly

**Phase 2 Changes:**
- Destroys two platforms simultaneously
- Emerges from both sides
- Spike walls close in (reduce arena width)

**Phase 3 Changes:**
- Destroys all but one platform (rotating safe platform)
- Continuous emergence from all sides
- Walls and ceiling become hazards

**Strategy:** Adapt to changing arena, high mobility required, aerial combat

---

### Boss Rewards

**Every Boss (1, 2, 3, 4, etc.):**
- 1 Silver item (random tier, random quality)
- Demon essence (scaling amount: Boss 1 = 50, Boss 2 = 75, etc.)
- Altitude gate opens, progress continues

**Every 3rd Boss (3, 6, 9, 12, etc.):**
- 1 Silver item (guaranteed Tier 2 or higher)
- 1 Gold item (added to permanent collection)
- +1 Silver item slot for current run
- 2x Demon essence
- Possible cosmetic unlock (class skins, etc.)

---

## 🗺️ Platform & Environment System

### Platform Generation Rules

**Vertical Spacing:**
- Minimum gap: 2 meters (short jump)
- Maximum gap: 6 meters (requires running jump or double jump)
- Average gap: 3.5 meters
- Gap size increases with altitude for difficulty

**Horizontal Layout:**
- Platforms arranged in upward-climbing pattern
- Some platforms stacked vertically (wall jump sections)
- Zigzag patterns (left-right-left-right progression)
- Occasional "wells" (enclosed areas with platform at bottom)

**Platform Density:**
- 0-3000m: High density (easy navigation)
- 3000-6000m: Medium density (requires planning)
- 6000m+: Low density (challenging jumps, precise movement)

---

### Platform Type Specifications

**Standard Platform**
- Flat, solid surface
- Normal friction (100% value)
- Most common (50% of platforms)
- Various widths: 3m, 5m, 8m, 12m

**Sloped Platform**
- Angled surface: 15°, 30°, or 45° inclines
- Can face left or right
- Affect movement speed:
  - Uphill: 80% speed
  - Downhill: 130% speed
- Jump trajectory influenced by slope angle
- 20% of platforms

**Half-Pipe Platform**
- Curved U-shape or single curve
- Player rotates to match curve angle
- Build momentum by alternating sides
- Launch off edge with velocity
- Speed calculation: entry speed + gravity pull on curve
- Can chain into huge jumps
- 10% of platforms

**Breakable Platform**
- Cracked appearance
- Collapses 0.5 seconds after being stepped on
- Respawns after 8 seconds
- Cannot support enemies
- Forces quick decision-making
- 8% of platforms

**Moving Platform**
- Moves on set path:
  - Horizontal (left-right)
  - Vertical (up-down)
  - Circular pattern
  - Figure-8 pattern
- Player inherits platform momentum on jump
- Speed varies by pattern
- 5% of platforms

**Bounce Platform**
- Spring pad appearance
- Launches player upward when landed on
- Launch height: 2x normal jump height
- Cannot control launch (always vertical)
- Good for reaching high areas quickly
- 3% of platforms

**Ice Platform**
- Icy/crystalline appearance
- Reduced friction (30% of normal)
- Slide when moving
- Reduced jump height (90% of normal) due to slipping
- Enemies also affected
- 2% of platforms

**Sticky Platform**
- Tar/slime appearance
- Increased friction (200% of normal)
- Reduced movement speed (60%)
- Jump height reduced (70%)
- Harder to dodge on
- Enemies not affected
- 2% of platforms

---

### Environmental Hazards

**Spike Walls (Boss Arenas Only)**
- Extend from side walls during boss fights
- Telegraph with 1 second warning (glowing)
- Extend inward 3 meters
- Deal 1 damage on contact
- Force players toward center

**Rising Darkness**
- Optional difficulty modifier
- "Floor is lava" variant
- Darkness rises from below at 5m per second
- Staying below darkness: damage over time (1 HP every 2 seconds)
- Forces upward progression
- Affects enemies too

**Falling Stalactites**
- Random ceiling hazard
- 1 second warning (shake + sound)
- Falls quickly
- 2 damage on hit
- Destroys platforms temporarily (respawn 10 seconds)
- 1 stalactite every 30 seconds average

**Portal Platforms**
- Purple swirling platform
- Steps on it = teleport
- Teleports to another portal platform
- Direction: upward 50-100 meters
- 2 second disorientation on exit (blurry screen)
- Rare spawn

**Wind Currents**
- Invisible force affecting aerial movement
- Pushes player left or right
- Visual indicator: floating particles
- Changes jump trajectory significantly
- Appears in specific biome regions

---

### Biome System

**Biome Progression (every 2000 meters):**

**0-2000m: HELLFIRE CAVERNS**
- Visual: Red/orange rocks, lava flows in background
- Platforms: Mostly standard and sloped
- Hazards: None (tutorial area)
- Ambient: Dripping lava sounds, low rumble

**2000-4000m: CURSED TEMPLE**
- Visual: Ancient stone ruins, purple mystical glow
- Platforms: Introduce breakable and moving
- Hazards: Occasional falling debris
- Ambient: Chanting echoes, stone grinding

**4000-6000m: SKY FRAGMENTS**
- Visual: Floating platforms in cloudy sky, lightning
- Platforms: More gaps, ice platforms introduced
- Hazards: Wind currents
- Ambient: Wind howling, distant thunder

**6000-8000m: VOID DEPTHS**
- Visual: Dark purple/black void, floating fragments
- Platforms: Low density, many curved/half-pipes
- Hazards: Portal platforms, stalactites
- Ambient: Ethereal whispers, spatial distortion sounds

**8000m+: ABYSSAL THRONE**
- Visual: Demonic architecture, crimson and black
- Platforms: All types mixed, highest difficulty
- Hazards: All hazards possible
- Ambient: Demonic roars, battle drums

**Biome Effects:**
- Each biome has unique background animations
- Platform color schemes match biome
- Enemy types have biome-specific appearances (color variants)
- Boss arenas styled to match current biome

---

## 📈 Progression & Meta Systems

### Demon Essence Economy

**Earning Essence:**
- Basic enemy kill: 5 essence
- Intermediate enemy: 15 essence
- Advanced enemy: 30 essence
- Elite enemy: 60 essence
- Boss kill: 50 essence × boss number (Boss 1 = 50, Boss 5 = 250)

**Spending Essence:**

**Shop Platforms:**
- Spawn randomly every 300-500 meters
- Recognizable by golden glow
- Pause climbing, open shop UI
- Offerings:
  - Health restore (1 HP): 30 essence
  - Random silver item: 100 essence
  - Item reroll: 50 essence (reroll any equipped silver item)
  - Temporary buff: 75 essence (20% damage for 2 minutes)
  - Continue climbing or leave

**Gambling Shrines:**
- Spawn rarely (every 500-800 meters)
- Bet essence for random reward
- Costs: 50, 100, or 200 essence
- Rewards scale with bet:
  - 50: 70% nothing, 25% silver item (tier 1), 5% health
  - 100: 40% nothing, 45% silver item (tier 2), 10% health, 5% gold item
  - 200: 20% nothing, 50% silver item (tier 3), 20% health, 10% gold item

---

### Run Modifiers (Pre-Run Selection)

Optional difficulty increases for better rewards:

**Glass Cannon:**
- Start with 1 health instead of 3
- +100% damage dealt
- Reward: 2x essence gain

**Speed Demon:**
- Timer added: reach 5000m in 15 minutes or die
- Reward: Extra silver item slot at start

**Minimalist:**
- Can only equip 1 silver item (even after boss 3)
- Reward: All silver items are Pristine quality

**One Shot:**
- Enemies die in one hit
- You die in one hit
- Reward: Triple essence gain

**Chaos Mode:**
- All enemies spawn as Elite variants
- Random hazards active at all times
- Reward: Guaranteed gold item every boss (not just 3rd)

---

### Collection & Unlocks

**Gold Item Collection:**
- Viewable in main menu gallery
- Shows all unlocked gold items
- Displays which bosses drop each item
- Tracks duplicate count
- Can favorite items for quick equip

**Achievements:**
- Defeat first boss
- Reach 5000m
- Collect 10 different gold items
- Win with each class
- Defeat 100 total bosses (across all runs)
- Reach 10000m
- Perfect boss (no damage taken)
- Chain 50-hit combo
- Unlock all gold items

**Cosmetic Unlocks:**
Achievement-based:
- Class skins (recolors, armor variants)
- Weapon skins (change attack visual effects)
- Platform themes (change appearance of platforms)
- UI themes (change HUD colors)

---

### Statistics Tracking

**Per-Run Stats:**
- Altitude reached
- Time survived
- Bosses defeated
- Enemies killed
- Damage dealt
- Damage taken
- Perfect dodges
- Items collected
- Essence earned

**Lifetime Stats:**
- Total altitude climbed
- Total bosses defeated
- Total deaths
- Highest altitude (per class)
- Fastest 5000m time
- Total play time
- Favorite class (most played)
- Favorite gold item (most equipped)

---

### Leaderboards

**Categories:**
- Highest altitude (global)
- Highest altitude (per class)
- Fastest to 5000m
- Fastest to 10000m
- Most bosses defeated (single run)
- Longest survival time
- Daily challenge (fixed seed)
- Weekly challenge (special modifiers)

**Daily/Weekly Challenges:**
- Fixed seed for all players (same platform/enemy generation)
- Special modifiers active
- Unique rewards (exclusive cosmetics)
- Leaderboard competition
- Resets at midnight UTC

---

## 🎨 UI/UX Design Specifications

### HUD Layout

**Health Display (Top-Left):**
- Heart icons (3D-style)
- Current health in red
- Max health in gray outlines
- Damage animation: heart shakes and flashes

**Altitude Counter (Top-Center):**
- Large bold numbers
- Meters climbed
- Next boss distance (when within 300m)
- Example: "4,750m | BOSS IN 250m"

**Item Slots (Top-Right):**
- Silver items: small boxes with icons and tier indicators
- Show quality via border color
- Gold items: larger icons below silver
- Empty slots shown as outlines

**Combo Meter (Right-Side):**
- Only appears during combat
- Shows hit count
- Multiplier display (1.0x → 1.3x)
- Fades after 3 seconds without hit
- Grows larger with higher combo

**Essence Counter (Bottom-Right):**
- Coin icon + number
- Animates when collecting
- Glows when near shop

**Speed Meter (Bottom-Left, Optional):**
- Small speedometer
- Shows current velocity
- Color-coded: blue (slow), yellow (normal), red (fast)
- Useful for physics-based players

**Boss Health Bar (Top, during boss):**
- Full-width bar
- Boss name displayed
- Phase indicators (3 segments)
- Current phase highlighted

---

### Menu Systems

**Main Menu:**
- Start Run
- Collection (view gold items)
- Statistics
- Settings
- Leaderboards
- Exit

**Pre-Run Menu:**
- Select Class (shows stats)
- Equip Gold Items (from collection)
- Select Modifiers (optional difficulty)
- Confirm Start

**Pause Menu (During Run):**
- Resume
- View Stats (current run)
- Settings
- Abandon Run

**Death Screen:**
- Final stats (altitude, bosses, kills, etc.)
- New gold items unlocked (if any)
- Retry button
- Main menu button
- Leaderboard position (if applicable)

---

### Mobile-Specific UI

**Control Layout:**
- Left-side: Virtual joystick (movement)
- Right-side: 4 buttons arranged like Xbox layout
  - A (bottom): Jump
  - B (right): Attack 1
  - X (left): Attack 2
  - Y (top): Attack 3
- Buttons semi-transparent (adjustable in settings)
- Haptic feedback on press

**Control Customization:**
- Size adjustment (small, medium, large)
- Position adjustment (drag anywhere)
- Opacity adjustment (50%-100%)
- Sensitivity (joystick dead zone)
- Button layout presets

**Additional Mobile Features:**
- Swipe gestures for dodge (optional)
- Pinch to zoom camera (optional)
- Portrait mode (full screen) or landscape
- Auto-pause when app backgrounds

---

### Web-Specific UI

**Keyboard Controls (Default):**
- WASD: Movement
- Space: Jump
- L: Attack 1
- ;: Attack 2
- ': Attack 3
- Shift: Dodge
- ESC: Pause
- Tab: View stats overlay

**Control Remapping:**
- Click any action to reassign
- Click button + press new key
- Reset to defaults option
- Multiple profiles (save/load)
- Gamepad support (auto-detect)

**Mouse Integration:**
- Click to attack (optional)
- Aim attacks with mouse (Priest projectiles)
- Menu navigation
- Drag to adjust camera (optional)

**Additional Web Features:**
- Windowed or fullscreen toggle
- Resolution options
- Graphics quality presets
- Screenshake intensity
- Particle effect density
- Save replay (record last run)

---

## ⚖️ Balance & Difficulty Considerations

### Difficulty Curve

**Altitude-Based Scaling:**

**0-1000m:**
- Enemy health: Base × 1.0
- Enemy damage: 1 HP per hit
- Platform spacing: Easy
- Goal: Tutorial, learn mechanics

**1000-3000m:**
- Enemy health: Base × 1.5
- Enemy damage: 1 HP per hit
- Platform spacing: Moderate
- Goal: Build confidence, experiment

**3000-6000m:**
- Enemy health: Base × 2.5
- Enemy damage: 1-2 HP per hit (varied)
- Platform spacing: Challenging
- Goal: Test mastery, require good items

**6000-10000m:**
- Enemy health: Base × 4.0
- Enemy damage: 2 HP per hit
- Platform spacing: Very challenging
- Goal: Elite gameplay, perfect execution

**10000m+:**
- Enemy health: Base × 6.0+ (scales infinitely)
- Enemy damage: 2-3 HP per hit
- Platform spacing: Extreme
- Goal: Endless challenge for mastery

---

### Balance Considerations

**Class Balance:**
- Each class should reach similar average altitudes
- Win rate parity across classes (within 5%)
- Different playstyles appeal to different players
- No "mandatory" class for high scores

**Item Balance:**
- No single gold item should dominate meta
- Silver items should feel impactful
- Multiple viable build paths
- Synergies encouraged but not required

**Boss Difficulty:**
- Each boss should take 2-4 minutes (skilled player)
- Boss 1 should be beatable by new players
- Boss 10+ should challenge veteran players
- Phase 3 should feel intense but fair

**Risk/Reward:**
- High-risk strategies should have high payoff
- Safe strategies should still be viable
- Skill expression matters more than luck
- RNG should influence but not determine outcomes

---

### Accessibility Options

**Gameplay Assists:**
- Increased invincibility frames (assist mode)
- Slower enemy attacks (assist mode)
- Extra starting health (assist mode)
- Auto-dodge (activates perfect dodge automatically)
- Reduced precision requirements for combos

**Visual Options:**
- High contrast mode
- Colorblind modes (deuteranopia, protanopia, tritanopia)
- Screen shake toggle
- Flash reduction (for photosensitivity)
- Enemy outline highlighting
- Damage number size adjustment

**Audio Options:**
- Volume sliders (master, music, SFX)
- Separate volume for UI sounds
- Closed captions for sound cues
- Visual indicators for audio cues (enemy off-screen)
- Mono audio option

**Control Options:**
- Button remapping
- Toggle vs. hold options
- Auto-run option
- Jump buffer window adjustment
- Input delay compensation

---

## 🎵 Audio Design Framework

### Music System

**Layered Music:**
- Base layer plays during climbing
- Combat layer adds when enemies appear
- Boss layer intensifies during boss fights
- Layers fade in/out smoothly

**Biome Themes:**
- Each biome has unique musical theme
- Tempo increases with altitude
- Boss themes incorporate biome motifs
- Victory stinger after boss defeat

**Adaptive Music:**
- Low health: adds tense percussion
- High combo: adds triumphant brass
- Near boss: transition music builds
- Death: sad strings fade in

---

### Sound Effect Categories

**Player Actions:**
- Footsteps (vary by platform type)
- Jump/land sounds
- Attack swooshes (different per weapon/class)
- Dodge woosh
- Taking damage grunt
- Death scream

**Combat Feedback:**
- Hit impacts (light, medium, heavy)
- Perfect dodge success chime
- Perfect parry clang
- Combo counter increments
- Critical hit deep impact

**Environmental:**
- Platform creaking (breakable)
- Ice sliding
- Wind ambience
- Lava bubbling
- Portal humming
- Stalactite falling

**UI Sounds:**
- Menu navigation clicks
- Button confirms
- Item pickup jingles
- Level up/milestone sounds
- Essence collection chimes

---

## 🚀 Technical Specifications

### Performance Targets

**Web:**
- 60 FPS minimum
- 1920×1080 recommended resolution
- Supports 4K displays
- Browser compatibility: Chrome, Firefox, Safari, Edge

**Mobile:**
- 60 FPS on modern devices (2020+)
- 30 FPS acceptable on older devices
- Resolution adapts to device
- iOS and Android support

**Optimization:**
- Object pooling for enemies/projectiles
- Off-screen culling
- LOD system for distant platforms
- Compressed textures
- Efficient particle systems

---

### Save System

**Auto-Save Points:**
- After each boss defeat
- Every 500m climbed
- When collecting gold item
- When exiting to menu

**Save Data Includes:**
- Current run state (if active)
- Gold item collection
- Statistics
- Settings/preferences
- Cosmetic unlocks
- Leaderboard cache

**Cloud Save (Optional):**
- Cross-platform progression
- Account-based
- Syncs collection and stats
- Does not sync active runs

---

## 📝 Design Philosophy Summary

### Core Pillars

**1. Responsive Movement**
Everything should feel tight and responsive. Jumps, attacks, dodges should have immediate feedback.

**2. Meaningful Progression**
Every run should unlock something or improve player skill. No run feels wasted.

**3. Strategic Depth**
Item builds, class selection, and moment-to-moment decisions should all matter.

**4. Fair Challenge**
Difficulty comes from mastery requirements, not RNG or cheap deaths. Players should always feel they can improve.

**5. Replayability**
Different classes, builds, modifiers, and challenges keep each run fresh.

---