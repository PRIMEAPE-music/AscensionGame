# Platforming Fixes Plan

## Fix 1: Jump Validation
After placing each platform, check if the gap is physically possible. Calculate max jump height from `JUMP_FORCE` and `GRAVITY`, max horizontal reach from `MOVE_SPEED`. If unreachable, regenerate with tighter constraints (halve gap, clamp X closer). Add `isJumpFeasible(fromX, fromY, toX, toY): boolean` that accounts for double jump.

## Fix 2: Smooth Difficulty Curves
Replace stepped altitude brackets in `getDifficultyParams()` with linear interpolation. Anchor points: altitude 0 → minGap 80/maxGap 150, altitude 5000 → minGap 150/maxGap 300. Lerp between them — no sudden jumps at biome boundaries.

## Fix 3: Pattern Repeat Prevention
Add `recentPatterns: string[]` (max 3). After selecting a pattern, if it's in the list, reroll (up to 2 retries). Push chosen pattern, shift if length > 3.

## Fix 4: Platform Types in Patterns
Patterns currently hardcode STANDARD. Change to call `getRandomPlatformType()` so biome-weighted types appear in structured patterns. Exceptions: bounce chains keep BOUNCE, wall jumps keep STANDARD.

## Fix 5: Transition Platforms
After multi-platform patterns, generate 1-2 bridge platforms with moderate gaps and centered X before next pattern. Add `pendingTransitions: number` counter that inserts standard platforms before the next pattern roll.

## Fix 6: Platform Width Curves
Within multi-platform patterns, vary scale progressively: start wide (1.5-2.0), narrow mid-pattern (0.8-1.0), end with reward width (1.8-2.2). Add a helper `getPatternScale(index, total): number` that returns scale based on position in the pattern.

## Fix 7: Diagonal Flow Patterns
Add 2 new patterns: "diagonal ascent" (platforms placed in a consistent diagonal line, ~45 degrees, 4-6 platforms) and "spiral climb" (platforms alternate sides but trend upward in an arc). These break the pure-horizontal/pure-vertical monotony.

## Fix 8: Ramp Landing Validation
For slope/launch patterns, calculate where a player actually exits the ramp (exit velocity + arc trajectory) and place the next platform at that landing point instead of an arbitrary offset. Use `exitVelocity = launchForce * slopeAngle`, then projectile motion `landingX = exitX + vx*t`, `landingY = exitY + vy*t + 0.5*g*t^2`.
