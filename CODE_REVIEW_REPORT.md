# AscensionGame — Comprehensive Code Review Report

**Date:** 2026-03-10
**Scope:** Full codebase review across 7 areas (config, player, enemies, systems, visuals, scene/UI, build)
**Total Issues Found:** 87 across all categories

---

## P0 — Critical Bugs (Must Fix)

### Memory Leaks

| # | File | Line(s) | Issue |
|---|------|---------|-------|
| 1 | LevelGenerator.ts | 494 | `scene.events.on("update")` registered per moving platform shadow, never unregistered. Accumulates unboundedly. |
| 2 | BackgroundRenderer.ts | entire class | No `destroy()` method. Graphics, emitters, textures leak on scene restart. |
| 3 | DemonTurret.ts | 25-36 | `physics.add.overlap()` on projectile group never destroyed when turret dies. |
| 4 | ItemDrop.ts | 25-32 | Infinite bobbing tween (`repeat: -1`) not stopped on `destroy()`. |
| 5 | MainScene.ts | entire class | No `shutdown()` lifecycle method. Tweens, delayed calls, event listeners persist across restarts. |
| 6 | BiomeRenderer.ts | 42-72 | Three rectangle graphics hidden but never destroyed. No `destroy()` method. |
| 7 | AtmosphereManager.ts | entire class | No `destroy()` method for vignette image and fog rectangles. |

### Logic Errors

| # | File | Line(s) | Issue |
|---|------|---------|-------|
| 8 | Player.ts | 348-352 | Jump hold force (`JUMP_HOLD_FORCE`) applies during wall jumps, disrupting wall jump arcs. |
| 9 | Player.ts | 312 | `wasOnSlope` not reset when jumping, causing stale slope-launch events. |
| 10 | Player.ts | 105 | Hardcoded `"animationcomplete-monk_land"` — Paladin/Priest never clear `isLanding` flag. |
| 11 | Player.ts | 559 | `scene.restart()` on death bypasses React state reset. UI shows stale data. |
| 12 | PlatformTypes.ts | 53-62 | `SLOPE_LEFT` and `SLOPE_RIGHT` both have `slopeAngle: 30` — functionally identical. |
| 13 | PlatformTypes.ts | 40 | ICE platform `speedMult: 1.0` means no speed change, contradicting low friction. |
| 14 | HellHound.ts | 7 | `private state` violates inheritance contract (should be `protected`). |
| 15 | ShadowBat.ts | 69-73 | State lock if killed during dive telegraph — `isDiving` stays true. |
| 16 | HellHound.ts | 106-115 | Stuck in LUNGE state if lunges into void without hitting ground. |

### Defensive Programming Failures

| # | File | Line(s) | Issue |
|---|------|---------|-------|
| 17 | BackgroundRenderer.ts | 242-248 | `findIndex()` returns -1 if biomeKey not found → blends to wrong biome. |
| 18 | BiomeRenderer.ts | 84-86 | Same `findIndex()` -1 issue as above. |
| 19 | AtmosphereManager.ts | 99-101 | Same `findIndex()` -1 issue as above. |

---

## P1 — High-Priority Issues

### Performance

| # | File | Line(s) | Issue |
|---|------|---------|-------|
| 20 | CombatManager.ts | 24-34 | `physics.overlap()` created every frame during attacks. Should create collider once and toggle. |
| 21 | ParticleManager.ts | 87-146 | No `maxParticles` limit on gameplay emitters. Extended play accumulates particles. |
| 22 | Player.ts | 272-278 | Ice platform skips velocity capping — allows infinite speed buildup. |
| 23 | StyleManager.ts | 95-119 | `tier` and `multiplier` getters iterate arrays on every access, called multiple times per frame. |

### Null Safety / Type Safety

| # | File | Line(s) | Issue |
|---|------|---------|-------|
| 24 | MainScene.ts | 313, 320-321, 331-332 | Collision callbacks access `.body.touching` without null checks. |
| 25 | MainScene.ts | 304-308 | Wall body updates assume `body` is never null. |
| 26 | HellHound.ts | 108 | `this.body as Body` without null check. |
| 27 | ShadowBat.ts | 78 | `this.body!.blocked.down` non-null assertion without guard. |
| 28 | Multiple files | — | 48 `any` type usages bypass TypeScript safety. |

### React Integration

| # | File | Line(s) | Issue |
|---|------|---------|-------|
| 29 | App.tsx | 92-103 | Escape key listener re-registers on every `togglePause` change. |
| 30 | App.tsx | 214 | React ref (`elapsedTimeRef.current`) read during render. |
| 31 | InventoryUI.tsx | 21 | List key uses `${item.id}-${index}` — index causes reconciliation bugs. |
| 32 | App.tsx | 26, 45-46 | Elapsed time only updates when pausing, not during gameplay. |

### Resource Cleanup

| # | File | Line(s) | Issue |
|---|------|---------|-------|
| 33 | MainScene.ts | 343-356 | Breakable platform 8-second `delayedCall` fires after scene destruction. |
| 34 | Enemy.ts | 29-31 | `delayedCall` in `takeDamage()` captures `this` — may execute on destroyed object. |
| 35 | BackgroundRenderer.ts | 184-194 | Particle emitters start at world origin (0,0) on frame 1 before position update. |

---

## P2 — Medium-Priority Issues

### Duplicated Code

| # | File | Issue |
|---|------|-------|
| 36 | BackgroundRenderer, BiomeRenderer, AtmosphereManager | `lerpColor()` implemented identically 3 times. |
| 37 | BackgroundRenderer, BiomeRenderer, AtmosphereManager | `getBiomeAt()` lookup loop duplicated 3 times. |

### Depth Layer Conflicts

| # | File | Issue |
|---|------|-------|
| 38 | BackgroundRenderer vs BiomeRenderer | Overlapping depth ranges: BR uses -4/-1.5/-0.5, BiR uses -3/-2/-1. |

### Balance

| # | File | Issue |
|---|------|-------|
| 39 | ItemDatabase.ts | Heart Container (RARE) gives only +1 health — underpowered for rarity. |
| 40 | ItemDatabase.ts | Iron Weight (COMMON) gives +20% damage — overpowered for rarity. |
| 41 | GameConfig.ts | Style meter decay (5/tick after 2s) drains faster than bonuses refill. |
| 42 | ClassConfig.ts | Paladin gets +33% HP and +30% damage with only -15% speed. |
| 43 | GameConfig.ts | Spawn interval 5-15s (3x variance) creates unpredictable difficulty. |
| 44 | GameConfig.ts | Sticky jump multiplier defined in two places (GameConfig + PlatformTypes). |

### Missing Features

| # | File | Issue |
|---|------|-------|
| 45 | AnimationConfig.ts | Only MONK animations defined — PALADIN/PRIEST have no sprites. |

### Visual Issues

| # | File | Issue |
|---|------|-------|
| 46 | AtmosphereManager.ts:56 | Vignette canvas hardcoded to 1920x1080. |
| 47 | AtmosphereManager.ts:68 | Vignette image position hardcoded to (960, 540). |
| 48 | AtmosphereManager.ts:81 | Fog rectangle dimensions/position hardcoded. |
| 49 | PlatformEffectsManager.ts:117,146,184 | Effect depth tied to platform depth without bounds clamping. |
| 50 | PlatformTextureManager.ts:59-73 | Cache doesn't validate textures still exist in Phaser's texture manager. |

### Code Quality

| # | File | Issue |
|---|------|-------|
| 51 | Player.ts:33 | `hitEnemies: Set<any>` — weak typing. |
| 52 | Player.ts:234 | Two different definitions of "onGround" — getter vs local variable. |
| 53 | Player.ts:616-623 | `Object.values(PlatformType).includes()` allocates array every frame. |
| 54 | EventBus.ts:29-31 | `off()` method can't match wrapped listeners — misleading API. |
| 55 | DemonTurret.ts:77-94 | Multiple `(this.player as any)` casts without null checks. |

---

## P3 — Suggestions

| # | File | Issue |
|---|------|-------|
| 56 | Player.ts:262-269 | `setAccelerationX()` called every frame even when input unchanged. |
| 57 | Player.ts:273-277 | `this.body!.velocity.x` accessed 4 times — should cache. |
| 58 | Player.ts:405-407 | Attack stuck timeout silently recovers — no logging. |
| 59 | Player.ts:331-344 | Double jump particles orphaned if player dies mid-animation. |
| 60 | Player.ts:644-656 | Floating item text has no pooling or concurrency limit. |
| 61 | ImpCrawler.ts:14-30 | Missing initial `setFlipX()` in constructor. |
| 62 | SpawnManager.ts:113-131 | `.each()` callback returns `true` (continues) after finding platform. |
| 63 | SlopeManager.ts:40 | `slopes` array grows continuously — no cap. |
| 64 | BackgroundRenderer.ts:171-179 | All 4 biome sceneries generated at startup — should lazy-load. |
| 65 | BackgroundRenderer.ts:286 | RNG can produce 0 → all subsequent values 0. |
| 66 | ParticleManager.ts:183-192 | Crumble calls `explode()` in loop (15-25 times) — should batch. |
| 67 | ParticleManager.ts:183 | No `width > 0` validation on crumble emission. |
| 68 | BiomeRenderer.ts:49-50 | Rectangle size multipliers (2x, 3x) undocumented. |

### Build / Config

| # | File | Issue |
|---|------|-------|
| 69 | tsconfig.app.json | `erasableSyntaxOnly` conflicts with enum usage. |
| 70 | Multiple files | Unused imports: `SLOPES` (Player.ts), `BIOMES` (PlatformTextureManager.ts). |
| 71 | Multiple files | Unused parameters: `time`, `_delta`, `cameraY`, `params`, `scene`. |
| 72 | App.tsx:31, MainScene.ts:123 | `(window as any).__selectedClass` — should extend Window interface. |
| 73 | App.tsx:129 | No try-catch around `new Phaser.Game()`. |
| 74 | package.json | Project name is "temp-game", version "0.0.0". |
| 75 | package.json | Vulnerable dependencies: rollup (path traversal), minimatch (ReDoS), ajv (ReDoS). |
| 76 | eslint.config.js | Using basic linting, not type-aware. |
| 77 | vite.config.ts | Missing path aliases, build optimizations. |
| 78 | No .prettierrc | No code formatting configuration. |

---

## Fix Priority

1. **Memory leaks** (#1-7) — compound over time, degrade performance
2. **Logic errors** (#8-16) — directly impact gameplay
3. **Defensive programming** (#17-19) — prevent crashes on biome transitions
4. **Performance** (#20-23) — combat FPS and velocity issues
5. **React integration** (#29-32) — state sync between Phaser and React
6. **Null safety** (#24-28) — prevent runtime crashes
7. **Resource cleanup** (#33-35) — prevent stale callbacks
8. **Code quality & balance** (#36-55) — maintainability and game feel
9. **Build/config** (#69-78) — project health
