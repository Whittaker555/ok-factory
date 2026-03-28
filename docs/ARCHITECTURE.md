# Architecture

## Overview

OK Factory is a single-file browser game (`public/index.html`, ~3800 lines). Everything — HTML structure, CSS styles, and JavaScript engine — lives in one file for zero-dependency static hosting.

## File Layout

| Section | Lines (approx) | Purpose |
|---------|----------------|---------|
| CSS | 1–1060 | All styles, animations, keyframes |
| HTML | 1060–1230 | Intro screen, app shell, topbar, sidebar, page containers, modals |
| Data | 1230–1580 | `RESOURCES`, `MACHINES`, `RECIPES`, `ALT_RECIPES`, `RESEARCH`, `MILESTONES` constants |
| Game State | 1580–1640 | `gameState` schema, `newGameState()`, `createSlots()` |
| Engine | 1640–1870 | `computePower()`, `computeEfficiency()`, `gameTick()`, `getStats()`, milestones |
| UI System | 1870–1980 | `switchPage()`, `renderCurrentPage()`, `updateUI()` |
| Canvas Conveyor | 1980–2190 | `animateConveyor()` with requestAnimationFrame, sqrt density scaling |
| Renderers | 2190–3020 | `renderDashboard()`, `renderFloors()`, `renderResearch()`, `renderStorage()`, `renderPower()`, `renderCodex()`, `renderMilestones()` |
| Crank System | 3020–3180 | Manual power, challenges (sequence/math/reaction), crank research tiers |
| Helpers | 3180–3440 | `toast()`, `formatNum()`, `escapeHtml()`, `closeModal()`, `showScorecard()` |
| Save System | 3440–3570 | `serializeState()`, `deserializeState()`, `autoSave()`, `loadFromStorage()`, export/import |
| Init | 3570–3830 | `doNewRun()`, navigation wiring, intro conveyor, `checkExistingSave()` |

## Key Design Decisions

### Single File
Chose single-file to enable trivial deployment (drag to S3) and easy sharing. Trade-off: harder to navigate, but search works fine.

### Object.create(null) for Lookups
Machine-keyed maps use `Object.create(null)` to avoid `Object.prototype` collisions (the `constructor` machine name collides with `Object.prototype.constructor`).

### Power Priority: Generators First
`computePower()` separates `generatorSupply` from manual/crank power. Manual power is reserve-only — it only covers the deficit between generator output and demand. Crank battery doesn't drain when generators cover demand.

### Conveyor Density Scaling
Items per minute mapped to visual density via `sqrt(throughput)`. Items only touch at 100k items/min. Speed uses `log2` scaling so it doesn't become unwatchable.

### Save System
- LocalStorage with 24h TTL and browser ID binding
- Sets serialized to arrays for JSON (`unlockedRecipes`, `unlockedMachines`, `completedMilestones`)
- `deserializeState()` backfills missing fields from `newGameState()` for forward compatibility

## Game Loop

```
gameTick() [1s interval]
  ├── computeEfficiency()
  ├── drain manual power (only if covering deficit)
  ├── decay challenge timer
  ├── maybe offer challenge
  ├── for each floor/slot: consume inputs → produce outputs
  ├── research progress
  ├── check milestones
  ├── updateUI()
  │   ├── topbar stats
  │   ├── conveyor data update
  │   └── renderCurrentPage() [every 2 ticks]
  └── autoSave() [periodic]
```

## Test Strategy

`tests/test.js` extracts the `<script>` block from `index.html`, stubs DOM/browser APIs, and runs 92 assertions covering:
- Power computation (generators, manual, overclocking)
- Recipe unlocking via research
- Production logic (inputs consumed, outputs produced)
- Save/load round-trip (Set serialization)
- Efficiency calculations with milestones
- Edge cases (empty factory, zero demand, etc.)
