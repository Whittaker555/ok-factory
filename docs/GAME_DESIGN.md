# Game Design

## Concept

OK Factory is an idle/incremental factory game inspired by Satisfactory. Players build production lines across factory floors, research new technologies, and scale from mining raw ores to producing quantum-tier elite products.

## Core Loop

1. **Mine** raw resources (iron, copper, limestone, coal, etc.)
2. **Smelt** ores into ingots
3. **Craft** ingots into parts (plates, rods, wire, screws)
4. **Assemble** parts into components (rotors, motors, computers)
5. **Research** to unlock higher tiers, new machines, and recipes
6. **Scale** across 8 factory floors with up to 14 slots each
7. **Power** your factory — generators first, crank as backup

## Progression Tiers

| Tier | Key Unlocks |
|------|------------|
| T0 | Miner Mk.I, Smelter, Constructor — basic ores and parts |
| T1 | Water Extractor, Copper Sheet, Quickwire, Caterium |
| T2 | Miner Mk.II, Foundry, Assembler — steel, alloys, components |
| T3 | Oil Extractor, Refinery, Manufacturer — plastics, fuel, computers |
| T4 | Miner Mk.III, Blender — advanced materials, nitrogen |
| T5 | Particle Accelerator, Nuclear — uranium, nuclear pasta |
| T6 | Quantum Encoder — AI limiters, quantum computers, SAM fluctuators |

## Machines

- **Extraction**: Miners (Mk.I/II/III), Water Extractor, Oil Extractor
- **Processing**: Smelter, Foundry, Refinery, Blender
- **Production**: Constructor, Assembler, Manufacturer, Particle Accelerator, Quantum Encoder
- **Power**: Biomass Burner (20 MW), Coal Generator (75 MW), Fuel Generator (150 MW), Nuclear Plant (2500 MW)

## Recipes

- **92 total** (standard + alternates)
- Each recipe has: machine, inputs, outputs, cycle time, tier
- Alternate recipes offer different input/output ratios for the same products

## Power System

- Generators supply power automatically when fueled
- Manual crank is **reserve only** — covers deficit when generators fall short
- Crank upgradeable via research (Mk.I → Mk.IV)
- Challenges (math, sequence, reaction) grant temporary bonus power
- Overclocking uses **quadratic** power scaling (1.5x speed = 2.25x power)

## Factory Floors

- 8 floors, 8–14 slots each
- Slots configurable: machine + recipe + clock speed (50%–250%)
- Toggle current rates vs. 100% theoretical rates
- Floors unlock via research

## Research

- 40 research projects across all tiers
- Each costs specific resources, consumed over time
- Unlocks machines, recipes, floors, crank upgrades, and overclocking tiers

## Milestones

- Achievement system with efficiency bonuses
- Rewards stack multiplicatively with power efficiency
- Capped at 200% total efficiency

## Save System

- Auto-saves to LocalStorage every 30 ticks
- 24-hour TTL with browser ID binding
- Export/import `.sav` files for backup or sharing
- Save-on-close via `beforeunload`

## Planned / Feedback Areas

- [ ] Mobile responsiveness
- [ ] Sound effects
- [ ] Production chain visualizer
- [ ] Prestige/rebirth system
- [ ] Leaderboard
- [ ] Tutorial / onboarding flow
