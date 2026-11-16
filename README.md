# ASHFALL YARD — Tactical FPS (three.js)

A round-based tactical first-person shooter in the Counter-Strike style,
built for the make.fun **threejs-fps-01** bounty: two teams, short rounds
won by eliminating the other team or by the objective, money between rounds
to buy weapons, and gunfire where accuracy counts more than speed.

You play **Vanguard** (blue), attacking with four bot teammates against five
**Ember** (red) defender bots on a 64×48 m industrial yard with two plant
sites — Site A, the fuel depot, and Site B, the warehouse.

## How to play

```
node serve.ts            # serves game/ at http://localhost:8080
```

Open the page in desktop Chrome and click **DEPLOY**. Pointer lock captures
the mouse.

| Key | Action |
| --- | ------ |
| WASD / mouse | Move / aim |
| LMB | Fire (hold for automatics) |
| RMB | Aim down sights |
| R | Reload |
| Shift | Walk (slow, steady aim) |
| Space | Jump |
| B | Buy menu (buy phase only) |
| 1–6 | Buy / switch weapon |
| E (hold) | Plant the charge at a site / defuse |
| M | Mute |

## Rules

- **Rounds:** 100 seconds. First to 5 round wins takes the match (max 9).
- **Win a round** by eliminating Ember, or by planting the charge at Site A
  or B and defending it until detonation (35 s fuse). Ember wins by
  eliminating Vanguard, running the clock out, or defusing (5 s).
- **Economy:** start $800. Kill +$300, plant +$300, round win +$3,250,
  round loss +$1,900 (grows with a loss streak, capped at $3,400).
- **Shop (buy phase, 15 s):** VK-7 rifle $2,700 · Hornet SMG $1,500 ·
  Breacher shotgun $1,200 · Longshot DMR $4,200 · Kevlar armor $650 ·
  ammo refill $400. The P9 sidearm is free and always in your kit.
- **Bots** navigate a waypoint graph, hold sites, strafe and burst-fire with
  real hitscan rays, plant when they carry the charge, and rush to defuse.

## Files

- `game/` — the playable game as static files: `index.html` + ES modules
  under `src/`, three.js 0.187.0 vendored under `vendor/three/`. No build
  step, no network request; all textures and sounds are generated in code.
- `main.ts` — the entrypoint: copies `game/` and `screenshots/` to
  `/output` (or `$MAKEFUN_OUTPUT_DIR`) and writes `dossier.json`.
- `screenshots/` — real renders of the game's own code, taken in headless
  Chrome through the game's deterministic `?shot=` poses.
- `serve.ts` — a minimal static server for local play-testing.
- `vendor/makefun-threejs.ts` — the kit's dossier library, unchanged.

## Screenshots

The game supports deterministic screenshot poses (no pointer lock needed):

```
?shot=menu&seed=ashfall-1     buy phase at spawn, shop open
?shot=action&seed=ashfall-1   mid-firefight with tracer and muzzle flash
?shot=plant&seed=ashfall-1    charge planted at Site A, defenders closing in
?shot=end&seed=ashfall-1      match-end scoreboard
?shot=selftest&seed=ashfall-1 headless smoke test: a full round plays out
```

## License

MIT — see `LICENSE`.
