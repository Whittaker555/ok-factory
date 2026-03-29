#!/usr/bin/env node
/**
 * OK FACTORY — Comprehensive Test Suite
 * No external dependencies. Run: node test.js
 *
 * Extracts the <script> block from index.html, stubs DOM/browser APIs,
 * then exercises pure game-logic functions and data integrity.
 */

const fs   = require('fs');
const path = require('path');
const assert = require('assert');

// ═══════════════════════════════════════════════════════════════
// 0. MINI TEST RUNNER
// ═══════════════════════════════════════════════════════════════

class TestRunner {
  constructor() { this.groups = []; this._cur = null; this.pass = 0; this.fail = 0; }
  group(name, fn) { this._cur = { name, tests: [] }; fn(); this.groups.push(this._cur); }
  test(name, fn)  { this._cur.tests.push({ name, fn }); }
  run() {
    console.log('\n' + '═'.repeat(68));
    console.log(' OK FACTORY  TEST SUITE');
    console.log('═'.repeat(68));
    for (const g of this.groups) {
      console.log(`\n▸ ${g.name}`);
      for (const t of g.tests) {
        try { t.fn(); this.pass++; console.log(`  ✓ ${t.name}`); }
        catch (e) { this.fail++; console.log(`  ✗ ${t.name}\n    ${e.message}`); }
      }
    }
    console.log('\n' + '═'.repeat(68));
    console.log(` ${this.pass + this.fail} tests  |  ${this.pass} passed  |  ${this.fail} failed`);
    console.log('═'.repeat(68) + '\n');
    process.exit(this.fail > 0 ? 1 : 0);
  }
}
const T = new TestRunner();

// ═══════════════════════════════════════════════════════════════
// 1. EXTRACT & EVALUATE GAME CODE
// ═══════════════════════════════════════════════════════════════

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf-8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error('Could not find <script> block'); process.exit(1); }
let src = m[1];

// ── Stub browser APIs ────────────────────────────────────────
global.localStorage = (() => {
  const store = {};
  return {
    getItem:    k => store[k] ?? null,
    setItem:    (k,v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
    clear:      () => { for (const k in store) delete store[k]; },
  };
})();
global.crypto = { randomUUID: () => 'test-uuid-1234' };
const mockEl = () => {
  let _tc = '', _ih = '';
  return {
    style: {}, className: '', value: '',
    get textContent() { return _tc; },
    set textContent(v) { _tc = v; _ih = String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); },
    get innerHTML() { return _ih; },
    set innerHTML(v) { _ih = v; },
    classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    appendChild(){}, removeChild(){}, insertBefore(){},
    addEventListener(){}, removeEventListener(){},
    setAttribute(){}, getAttribute(){ return ''; },
    querySelectorAll(){ return []; }, querySelector(){ return null; },
    children: [], childNodes: [],
  };
};
global.document = {
  getElementById: () => mockEl(),
  querySelector:  () => mockEl(),
  querySelectorAll: () => [],
  createElement:  () => mockEl(),
  createTextNode: () => ({}),
  body: { ...mockEl(), appendChild(){}, removeChild(){} },
  addEventListener: () => {},
};
global.window = { addEventListener(){}, location: { href: '' }, devicePixelRatio: 1 };
global.requestAnimationFrame = () => 0;
global.cancelAnimationFrame = () => {};
global.setInterval = () => 0;
global.clearInterval = () => {};
global.setTimeout  = () => 0;
global.clearTimeout = () => {};

// Inject a no-op for every function that touches the DOM exclusively.
// We wrap in an IIFE; returned object makes game symbols accessible.
const wrapped = `
  // suppress any top-level DOM calls during load
  function toast() {}
  function renderCurrentPage() {}
  function updateUI() {}
  function updateLiveConveyor() {}
  function buildLiveConveyor() {}
  function updateManualPowerUI() {}
  function offerChallenge() {}
  function launchChallenge() {}
  function checkTutorialCondition() {}
  function updateTutorialSpotlight() {}

  ${src}

  // Export symbols we need
  module.exports = {
    RESOURCES, MACHINES, RECIPES, ALT_RECIPES, RESEARCH, MILESTONES,
    SAVE_VERSION, SAVE_KEY,
    newGameState, createSlots, getAllRecipes,
    getMaxClockSpeed, computePower, computeEfficiency,
    getCrankStats, getChallengeScale,
    getStats, gameTick, gameTickInner,
    serializeState, deserializeState,
    autoSave, loadFromStorage,
    startResearch, completeResearch, checkMilestones,
    renderMilestones, doNewRun,
    get gameState()  { return gameState; },
    set gameState(v) { gameState = v; },
    get lastTickTime()  { return lastTickTime; },
    set lastTickTime(v) { lastTickTime = v; },
  };
`;

// Write to a temp file, require() it so it gets its own scope
const tmp = path.join(__dirname, '.test_tmp_game.js');
fs.writeFileSync(tmp, wrapped);
let G;
try { G = require(tmp); } finally { fs.unlinkSync(tmp); }

// Helper: reset global gameState to a fresh state
function freshState() { G.gameState = G.newGameState(); G.lastTickTime = 0; return G.gameState; }

// Wrap gameTick to always simulate exactly 1 second per call in tests
const _origGameTick = G.gameTick;
G.gameTick = function() { G.lastTickTime = 0; _origGameTick(); };

// ═══════════════════════════════════════════════════════════════
// 2. TESTS
// ═══════════════════════════════════════════════════════════════

// ─── RESOURCES ────────────────────────────────────────────────

T.group('RESOURCES — data integrity', () => {
  T.test('every resource has name, tier, value, color, category', () => {
    for (const [id, r] of Object.entries(G.RESOURCES)) {
      assert(r.name,   `${id}: missing name`);
      assert(typeof r.tier  === 'number', `${id}: tier not a number`);
      assert(typeof r.value === 'number', `${id}: value not a number`);
      assert(r.color,  `${id}: missing color`);
      assert(r.category, `${id}: missing category`);
    }
  });

  T.test('values are non-negative', () => {
    for (const [id, r] of Object.entries(G.RESOURCES))
      assert(r.value >= 0, `${id} value ${r.value} < 0`);
  });

  T.test('tiers span 0-6', () => {
    const tiers = new Set(Object.values(G.RESOURCES).map(r => r.tier));
    for (let t = 0; t <= 6; t++) assert(tiers.has(t), `tier ${t} missing`);
  });

  T.test('categories are from allowed set', () => {
    const ok = new Set(['ore','fluid','ingot','material','part','component','complex','advanced','elite']);
    for (const [id, r] of Object.entries(G.RESOURCES))
      assert(ok.has(r.category), `${id}: bad category '${r.category}'`);
  });

  T.test('higher tiers have strictly higher min value than lower tiers max', () => {
    const byTier = {};
    for (const r of Object.values(G.RESOURCES)) {
      (byTier[r.tier] ??= []).push(r.value);
    }
    // T6 min should exceed T0 max (skipping gaps where tiers may overlap)
    const minT6 = Math.min(...byTier[6]);
    const maxT0 = Math.max(...byTier[0]);
    assert(minT6 > maxT0, `T6 min (${minT6}) should exceed T0 max (${maxT0})`);
  });
});

// ─── MACHINES ─────────────────────────────────────────────────

T.group('MACHINES — data integrity', () => {
  T.test('every machine has name, power, slots, tier, category', () => {
    for (const [id, m] of Object.entries(G.MACHINES)) {
      assert(m.name, `${id}: missing name`);
      assert(typeof m.power === 'number', `${id}: power not a number`);
      assert(typeof m.slots === 'number', `${id}: slots not a number`);
      assert(typeof m.tier  === 'number', `${id}: tier not a number`);
      assert(m.category, `${id}: missing category`);
    }
  });

  T.test('generators have negative power, consumers have positive', () => {
    for (const [id, m] of Object.entries(G.MACHINES)) {
      if (m.category === 'power')
        assert(m.power < 0, `generator ${id} should have power < 0`);
      else
        assert(m.power > 0, `consumer ${id} should have power > 0`);
    }
  });

  T.test('slots >= 0', () => {
    for (const [id, m] of Object.entries(G.MACHINES))
      assert(m.slots >= 0, `${id}: slots < 0`);
  });
});

// ─── RECIPES ──────────────────────────────────────────────────

T.group('RECIPES — data integrity', () => {
  const all = G.getAllRecipes();

  T.test('all inputs reference valid RESOURCES', () => {
    for (const [id, r] of Object.entries(all))
      for (const res of Object.keys(r.inputs))
        assert(G.RESOURCES[res], `${id}: unknown input '${res}'`);
  });

  T.test('all outputs reference valid RESOURCES', () => {
    for (const [id, r] of Object.entries(all))
      for (const res of Object.keys(r.outputs))
        assert(G.RESOURCES[res], `${id}: unknown output '${res}'`);
  });

  T.test('all recipes reference valid MACHINES', () => {
    for (const [id, r] of Object.entries(all))
      assert(G.MACHINES[r.machine], `${id}: unknown machine '${r.machine}'`);
  });

  T.test('recipe time > 0 and amounts > 0', () => {
    for (const [id, r] of Object.entries(all)) {
      assert(r.time > 0, `${id}: time <= 0`);
      for (const [res, amt] of Object.entries(r.inputs))
        assert(amt > 0, `${id}: input '${res}' amt ${amt} <= 0`);
      for (const [res, amt] of Object.entries(r.outputs))
        assert(amt > 0, `${id}: output '${res}' amt ${amt} <= 0`);
    }
  });

  T.test('extraction recipes (mine_*/extract_*) have no inputs', () => {
    for (const [id, r] of Object.entries(G.RECIPES))
      if (/^(mine_|extract_)/.test(id))
        assert.strictEqual(Object.keys(r.inputs).length, 0, `${id} should have no inputs`);
  });

  T.test('power-generation recipes have no outputs', () => {
    for (const [id, r] of Object.entries(G.RECIPES))
      if (r.isPower)
        assert.strictEqual(Object.keys(r.outputs).length, 0, `${id} should have no outputs`);
  });

  T.test('constructor recipes have exactly 1 input', () => {
    for (const [id, r] of Object.entries(all))
      if (r.machine === 'constructor' && Object.keys(r.inputs).length > 0)
        assert.strictEqual(Object.keys(r.inputs).length, 1, `${id} should have 1 input`);
  });

  T.test('assembler recipes have exactly 2 inputs', () => {
    for (const [id, r] of Object.entries(all))
      if (r.machine === 'assembler')
        assert.strictEqual(Object.keys(r.inputs).length, 2, `${id} should have 2 inputs`);
  });
});

// ─── RESEARCH ─────────────────────────────────────────────────

T.group('RESEARCH — tree integrity', () => {
  T.test('all prerequisites exist in RESEARCH', () => {
    for (const [id, r] of Object.entries(G.RESEARCH))
      for (const p of r.prereqs)
        assert(G.RESEARCH[p], `${id}: unknown prereq '${p}'`);
  });

  T.test('cost resources exist in RESOURCES', () => {
    for (const [id, r] of Object.entries(G.RESEARCH))
      for (const res of Object.keys(r.cost))
        assert(G.RESOURCES[res], `${id}: cost uses unknown resource '${res}'`);
  });

  T.test('unlocks reference valid recipes or machines', () => {
    for (const [id, r] of Object.entries(G.RESEARCH)) {
      if (!r.unlocks) continue;
      for (const u of r.unlocks) {
        const valid = G.MACHINES[u] || G.RECIPES[u] || G.ALT_RECIPES[u]
                   || u.startsWith('overclock_') || u.startsWith('crank_');
        assert(valid, `${id}: unlocks unknown '${u}'`);
      }
    }
  });

  T.test('tiers >= 1', () => {
    for (const [id, r] of Object.entries(G.RESEARCH))
      assert(r.tier >= 1, `${id}: tier ${r.tier} < 1`);
  });

  T.test('tier 1 research has no prerequisites', () => {
    for (const [id, r] of Object.entries(G.RESEARCH))
      if (r.tier === 1)
        assert.strictEqual(r.prereqs.length, 0, `${id}: tier 1 should have no prereqs`);
  });

  T.test('tier 2+ research has at least 1 prerequisite', () => {
    for (const [id, r] of Object.entries(G.RESEARCH))
      if (r.tier >= 2)
        assert(r.prereqs.length >= 1, `${id}: tier ${r.tier} should have prereqs`);
  });

  T.test('no circular dependencies', () => {
    const inStack = new Set(), done = new Set();
    function dfs(id) {
      if (inStack.has(id)) return true; // cycle
      if (done.has(id)) return false;
      inStack.add(id);
      for (const p of (G.RESEARCH[id]?.prereqs || []))
        if (dfs(p)) return true;
      inStack.delete(id);
      done.add(id);
      return false;
    }
    for (const id of Object.keys(G.RESEARCH))
      assert(!dfs(id), `cycle detected from '${id}'`);
  });

  T.test('overclock chain: 1→2→3', () => {
    assert(G.RESEARCH.overclock_2.prereqs.includes('overclock_1'));
    assert(G.RESEARCH.overclock_3.prereqs.includes('overclock_2'));
  });
});

// ─── MILESTONES ───────────────────────────────────────────────

T.group('MILESTONES — integrity', () => {
  T.test('all milestones have id, name, desc, check (fn), reward, rewardVal', () => {
    for (const m of G.MILESTONES) {
      assert(m.id, 'missing id');
      assert(m.name, 'missing name');
      assert(m.desc, 'missing desc');
      assert(typeof m.check === 'function', 'check not a function');
      assert(m.reward, 'missing reward');
      assert(typeof m.rewardVal === 'number', 'rewardVal not a number');
    }
  });

  T.test('unique IDs', () => {
    const ids = G.MILESTONES.map(m => m.id);
    assert.strictEqual(ids.length, new Set(ids).size, 'duplicate milestone IDs');
  });

  T.test('rewardVal ranges valid per reward type', () => {
    for (const m of G.MILESTONES) {
      if (m.reward === 'efficiency' || m.reward === 'extra_floor_chance') {
        assert(m.rewardVal > 0 && m.rewardVal <= 0.10, `${m.id}: bad rewardVal ${m.rewardVal}`);
      } else if (m.reward === 'bonus_start_power') {
        assert(m.rewardVal > 0 && m.rewardVal <= 200, `${m.id}: bad rewardVal ${m.rewardVal}`);
      } else {
        assert(false, `${m.id}: unknown reward type '${m.reward}'`);
      }
    }
  });

  T.test('check functions are callable against mock stats', () => {
    const mock = {
      totalProduced: { iron_plate: 1000, copper_wire: 1000, steel_beam: 1000, plastic: 1000,
        circuit_board: 1000, computer: 1000, heavy_modular_frame: 1000, nuclear_pasta: 1,
        quantum_oscillator: 1, singularity_cell: 1 },
      totalMachines: 50, activeFloors: 8, netWorth: 2e9, powerSupply: 10000,
      totalThroughput: 50000, hasBuilt: { nuclear_plant: true }, allResearchDone: true,
      challengesSolved: 100,
    };
    for (const m of G.MILESTONES) {
      const result = m.check(mock);
      assert(typeof result === 'boolean', `${m.id}: check did not return boolean`);
    }
  });
});

// ─── newGameState ─────────────────────────────────────────────

T.group('newGameState() — initial values', () => {
  T.test('tick starts at 0', () => {
    assert.strictEqual(freshState().tick, 0);
  });

  T.test('8 factories, first 2 unlocked', () => {
    const s = freshState();
    assert.strictEqual(s.floors.length, 8);
    assert(s.floors[0].unlocked);
    assert(s.floors[1].unlocked);
    for (let i = 2; i < 8; i++) assert(!s.floors[i].unlocked, `factory ${i+1} should be locked`);
  });

  T.test('slot counts: 1 floor each (3,3,3,3,4,4,5,5)', () => {
    const s = freshState();
    const expected = [3,3,3,3,4,4,5,5];
    s.floors.forEach((f,i) => assert.strictEqual(f.slots.length, expected[i], `factory ${i+1}`));
  });

  T.test('factories start with 1 floor each', () => {
    const s = freshState();
    s.floors.forEach((f,i) => assert.strictEqual(f.rows, 1, `factory ${i+1} floors`));
  });

  T.test('default unlocked machines: miner_mk1, smelter, constructor', () => {
    const s = freshState();
    assert(s.unlockedMachines.has('miner_mk1'));
    assert(s.unlockedMachines.has('smelter'));
    assert(s.unlockedMachines.has('constructor'));
    assert.strictEqual(s.unlockedMachines.size, 3);
  });

  T.test('default unlocked recipes include mine_iron, smelt_iron, make_iron_plate', () => {
    const s = freshState();
    for (const r of ['mine_iron','smelt_iron','make_iron_plate'])
      assert(s.unlockedRecipes.has(r), `${r} should be unlocked`);
  });

  T.test('manual / challenge power start at 0', () => {
    const s = freshState();
    assert.strictEqual(s.manualPower, 0);
    assert.strictEqual(s.challengePower, 0);
    assert.strictEqual(s.challengesSolved, 0);
  });

  T.test('milestone reward accumulators start at 0', () => {
    const s = freshState();
    assert.strictEqual(s.extraFloorChance, 0);
    assert.strictEqual(s.bonusStartPower, 0);
  });
});

// ─── computePower() ───────────────────────────────────────────

T.group('computePower() — supply & demand', () => {
  T.test('empty factory = 0/0', () => {
    freshState();
    const p = G.computePower();
    assert.strictEqual(p.supply, 0);
    assert.strictEqual(p.demand, 0);
  });

  T.test('manual power adds to supply only when needed', () => {
    const s = freshState();
    s.manualPower = 42;
    // No demand, so manual power is reserve — not counted in supply
    assert.strictEqual(G.computePower().supply, 0);
    assert.strictEqual(G.computePower().generatorSupply, 0);
    // Add demand: manual power covers deficit
    s.floors[0].slots[0].machine = 'smelter'; // 4 MW
    s.floors[0].slots[0].recipe = 'smelt_iron';
    assert.strictEqual(G.computePower().supply, 4);
    assert.strictEqual(G.computePower().manualUsed, 4);
  });

  T.test('challenge power adds to supply only when needed', () => {
    const s = freshState();
    s.challengePower = 17;
    // No demand, reserve not used
    assert.strictEqual(G.computePower().supply, 0);
    // Add demand
    s.floors[0].slots[0].machine = 'smelter'; // 4 MW
    s.floors[0].slots[0].recipe = 'smelt_iron';
    assert.strictEqual(G.computePower().supply, 4);
    assert.strictEqual(G.computePower().manualUsed, 4);
  });

  T.test('consumer at 1x clock → base power demand', () => {
    const s = freshState();
    s.floors[0].slots[0].machine = 'smelter'; // 4 MW
    s.floors[0].slots[0].recipe  = 'smelt_iron';
    assert.strictEqual(G.computePower().demand, 4);
  });

  T.test('overclocked consumer uses quadratic power (1.5x → 2.25x)', () => {
    const s = freshState();
    s.floors[0].slots[0].machine = 'smelter';
    s.floors[0].slots[0].recipe  = 'smelt_iron';
    s.floors[0].slots[0].clockSpeed = 1.5;
    assert.strictEqual(G.computePower().demand, 4 * 1.5 * 1.5); // 9
  });

  T.test('underclocked consumer uses linear power (0.5x → 0.5x)', () => {
    const s = freshState();
    s.floors[0].slots[0].machine = 'smelter';
    s.floors[0].slots[0].recipe  = 'smelt_iron';
    s.floors[0].slots[0].clockSpeed = 0.5;
    assert.strictEqual(G.computePower().demand, 4 * 0.5); // 2
  });

  T.test('generator at 1x clock supplies |power|', () => {
    const s = freshState();
    s.floors[0].slots[0].machine = 'coal_generator'; // -75
    s.floors[0].slots[0].recipe  = 'burn_coal';
    assert.strictEqual(G.computePower().supply, 75);
  });

  T.test('generator without recipe = 0 supply', () => {
    const s = freshState();
    s.floors[0].slots[0].machine = 'coal_generator';
    assert.strictEqual(G.computePower().supply, 0);
  });

  T.test('generator scales linearly with clock speed', () => {
    const s = freshState();
    s.floors[0].slots[0].machine = 'coal_generator';
    s.floors[0].slots[0].recipe  = 'burn_coal';
    s.floors[0].slots[0].clockSpeed = 2.0;
    assert.strictEqual(G.computePower().supply, 150);
  });

  T.test('locked factory machines are ignored', () => {
    const s = freshState();
    s.floors[2].slots[0].machine = 'smelter';
    s.floors[2].slots[0].recipe  = 'smelt_iron';
    assert.strictEqual(G.computePower().demand, 0);
  });

  T.test('inactive slot is ignored', () => {
    const s = freshState();
    s.floors[0].slots[0].machine = 'smelter';
    s.floors[0].slots[0].recipe  = 'smelt_iron';
    s.floors[0].slots[0].active  = false;
    assert.strictEqual(G.computePower().demand, 0);
  });

  T.test('2x clock speed → 4x power', () => {
    const s = freshState();
    s.floors[0].slots[0].machine = 'smelter'; // 4 MW
    s.floors[0].slots[0].recipe  = 'smelt_iron';
    s.floors[0].slots[0].clockSpeed = 2.0;
    assert.strictEqual(G.computePower().demand, 16);
  });
});

// ─── computeEfficiency() ──────────────────────────────────────

T.group('computeEfficiency() — power ratio → production rate', () => {
  T.test('no demand = 100%', () => {
    freshState();
    assert.strictEqual(G.computeEfficiency(), 1.0);
  });

  T.test('supply >= demand = 100% (no bonus)', () => {
    const s = freshState();
    s.floors[0].slots[0].machine = 'smelter';
    s.floors[0].slots[0].recipe  = 'smelt_iron';
    s.manualPower = 100;
    assert.strictEqual(G.computeEfficiency(), 1.0);
  });

  T.test('50% supply → ~50% efficiency', () => {
    const s = freshState();
    s.floors[0].slots[0].machine = 'smelter'; // 4 MW
    s.floors[0].slots[0].recipe  = 'smelt_iron';
    s.manualPower = 2; // 50% of 4
    const eff = G.computeEfficiency();
    assert(Math.abs(eff - 0.5) < 0.001, `expected ~0.5, got ${eff}`);
  });

  T.test('milestone bonus increases efficiency', () => {
    const s = freshState();
    s.manualPower = 20;
    s.floors[0].slots[0].machine = 'smelter';
    s.floors[0].slots[0].recipe  = 'smelt_iron';
    s.milestoneBonus = 0.1;
    const eff = G.computeEfficiency();
    assert(eff > 1.0, `expected > 1.0, got ${eff}`);
  });

  T.test('capped at 2.0 (200%)', () => {
    const s = freshState();
    s.milestoneBonus = 5.0; // extreme
    const eff = G.computeEfficiency();
    assert(eff <= 2.0, `should cap at 2.0, got ${eff}`);
  });
});

// ─── getMaxClockSpeed() ───────────────────────────────────────

T.group('getMaxClockSpeed() — overclock tiers', () => {
  T.test('default = 1.0', () => { freshState(); assert.strictEqual(G.getMaxClockSpeed(), 1.0); });
  T.test('Mk.I → 1.25', () => {
    const s = freshState(); s.research.overclock_1 = { completed: true };
    assert.strictEqual(G.getMaxClockSpeed(), 1.25);
  });
  T.test('Mk.II → 1.5', () => {
    const s = freshState(); s.research.overclock_2 = { completed: true };
    assert.strictEqual(G.getMaxClockSpeed(), 1.5);
  });
  T.test('Mk.III → 2.0', () => {
    const s = freshState(); s.research.overclock_3 = { completed: true };
    assert.strictEqual(G.getMaxClockSpeed(), 2.0);
  });
  T.test('highest tier wins when all completed', () => {
    const s = freshState();
    s.research.overclock_1 = { completed: true };
    s.research.overclock_2 = { completed: true };
    s.research.overclock_3 = { completed: true };
    assert.strictEqual(G.getMaxClockSpeed(), 2.0);
  });
});

// ─── getCrankStats() ──────────────────────────────────────────

T.group('getCrankStats() — crank upgrade progression', () => {
  T.test('default: level 1, 3 MW, max 200', () => {
    freshState();
    const c = G.getCrankStats();
    assert.deepStrictEqual(c, { perClick: 3, max: 200, level: 1 });
  });
  T.test('Mk.II: level 2, 8 MW, max 400', () => {
    freshState().research.crank_mk2 = { completed: true };
    assert.deepStrictEqual(G.getCrankStats(), { perClick: 8, max: 400, level: 2 });
  });
  T.test('Mk.III: level 3, 20 MW, max 800', () => {
    freshState().research.crank_mk3 = { completed: true };
    assert.deepStrictEqual(G.getCrankStats(), { perClick: 20, max: 800, level: 3 });
  });
  T.test('Mk.IV: level 4, 50 MW, max 1500', () => {
    freshState().research.crank_mk4 = { completed: true };
    assert.deepStrictEqual(G.getCrankStats(), { perClick: 50, max: 1500, level: 4 });
  });
});

// ─── getChallengeScale() ──────────────────────────────────────

T.group('getChallengeScale() — difficulty scaling', () => {
  T.test('0 solved → tier 0, multiplier 1x', () => {
    freshState();
    const c = G.getChallengeScale();
    assert.strictEqual(c.tier, 0);
    assert.strictEqual(c.powerMult, 1.0);
  });

  T.test('tier increments every 10 solves', () => {
    const s = freshState();
    s.challengesSolved = 10;
    assert.strictEqual(G.getChallengeScale().tier, 1);
    s.challengesSolved = 25;
    assert.strictEqual(G.getChallengeScale().tier, 2);
  });

  T.test('max tier is 5', () => {
    freshState().challengesSolved = 200;
    assert.strictEqual(G.getChallengeScale().tier, 5);
  });

  T.test('powerMult at tier 5 = 3.0', () => {
    freshState().challengesSolved = 50;
    assert.strictEqual(G.getChallengeScale().powerMult, 3.0);
  });
});

// ─── gameTick() — production / consumption ────────────────────

T.group('gameTick() — core production loop', () => {
  T.test('miner produces with sufficient power', () => {
    const s = freshState();
    s.manualPower = 20; // covers 5 MW miner
    s.floors[0].slots[0].machine = 'miner_mk1';
    s.floors[0].slots[0].recipe  = 'mine_iron';
    G.gameTick();
    assert(s.storage.iron_ore > 0, 'should have produced iron ore');
    assert(s.totalProduced.iron_ore > 0, 'should track totalProduced');
  });

  T.test('smelter consumes inputs and produces output', () => {
    const s = freshState();
    s.manualPower = 20;
    s.storage.iron_ore = 100;
    s.floors[0].slots[0].machine = 'smelter';
    s.floors[0].slots[0].recipe  = 'smelt_iron';
    const before = s.storage.iron_ore;
    G.gameTick();
    assert(s.storage.iron_ore < before, 'iron_ore should decrease');
    assert(s.storage.iron_ingot > 0, 'iron_ingot should be produced');
  });

  T.test('starved machine does not consume or produce', () => {
    const s = freshState();
    s.manualPower = 20;
    s.storage.iron_ore = 0;
    s.floors[0].slots[0].machine = 'smelter';
    s.floors[0].slots[0].recipe  = 'smelt_iron';
    G.gameTick();
    assert.strictEqual(s.storage.iron_ore || 0, 0);
    assert.strictEqual(s.storage.iron_ingot || 0, 0);
  });

  T.test('storage never goes negative', () => {
    const s = freshState();
    s.manualPower = 20;
    s.storage.iron_ore = 0.001; // barely any
    s.floors[0].slots[0].machine = 'smelter';
    s.floors[0].slots[0].recipe  = 'smelt_iron';
    G.gameTick();
    for (const v of Object.values(s.storage))
      assert(v >= 0, `storage negative: ${v}`);
  });

  T.test('tick counter increments', () => {
    const s = freshState();
    const t0 = s.tick;
    G.gameTick();
    assert.strictEqual(s.tick, t0 + 1);
  });

  T.test('manual power drains only when covering deficit', () => {
    const s = freshState();
    s.manualPower = 10;
    // No demand → no drain
    G.gameTick();
    assert.strictEqual(s.manualPower, 10);
    // Add demand without generators → now drains
    s.floors[0].slots[0].machine = 'smelter';
    s.floors[0].slots[0].recipe = 'smelt_iron';
    G.gameTick();
    assert.strictEqual(s.manualPower, 8);
  });

  T.test('manual power does not drain when generators cover demand', () => {
    const s = freshState();
    s.manualPower = 10;
    // Generator covers demand
    s.floors[0].slots[0].machine = 'coal_generator';
    s.floors[0].slots[0].recipe = 'burn_coal';
    s.floors[0].slots[1].machine = 'smelter';
    s.floors[0].slots[1].recipe = 'smelt_iron';
    G.gameTick();
    assert.strictEqual(s.manualPower, 10); // no drain
  });

  T.test('challenge power timer decrements and resets at 0', () => {
    const s = freshState();
    s.challengePower = 50;
    s.challengePowerTimer = 1;
    G.gameTick();
    assert.strictEqual(s.challengePower, 0);
    assert.strictEqual(s.challengePowerTimer, 0);
  });

  T.test('zero efficiency means no production', () => {
    const s = freshState();
    // no power at all, demand present
    s.manualPower = 0;
    s.floors[0].slots[0].machine = 'smelter';
    s.floors[0].slots[0].recipe  = 'smelt_iron';
    s.storage.iron_ore = 100;
    // also need another slot to actually create demand for smelter
    G.gameTick();
    // efficiency would be 0 because demand=4 but supply=0
    // but miner (no demand?) — actually smelter IS the demand. eff = 0/4 = 0
    // with 0 efficiency, effectiveRate = 0, needed = 0, canProduce = true but produce = 0
    // production is rate * eff which = 0
    assert.strictEqual(s.storage.iron_ingot || 0, 0, 'no production at 0 efficiency');
  });
});

// ─── gameTick — _produced flag for display accuracy ──────────

T.group('gameTick() — slot._produced display flag', () => {
  T.test('matched miner+smelter: smelter._produced is true', () => {
    const s = freshState();
    s.manualPower = 200;
    s.floors[0].slots[0].machine = 'miner_mk1';
    s.floors[0].slots[0].recipe  = 'mine_iron';
    s.floors[0].slots[1].machine = 'smelter';
    s.floors[0].slots[1].recipe  = 'smelt_iron';
    G.gameTick();
    assert.strictEqual(s.floors[0].slots[1]._produced, true,
      'smelter should produce when miner feeds it in same tick');
  });

  T.test('truly starved smelter: _produced is false', () => {
    const s = freshState();
    s.manualPower = 200;
    s.floors[0].slots[0].machine = 'smelter';
    s.floors[0].slots[0].recipe  = 'smelt_iron';
    // no iron ore in storage, no miner
    G.gameTick();
    assert.strictEqual(s.floors[0].slots[0]._produced, false,
      'smelter with no input source should be starved');
  });

  T.test('miner always has _produced true (no inputs needed)', () => {
    const s = freshState();
    s.manualPower = 200;
    s.floors[0].slots[0].machine = 'miner_mk1';
    s.floors[0].slots[0].recipe  = 'mine_iron';
    G.gameTick();
    assert.strictEqual(s.floors[0].slots[0]._produced, true);
  });
});

// ─── getStats() — throughput accounting ───────────────────────

T.group('getStats() — throughput & stats', () => {
  T.test('empty factory → 0 throughput, 0 machines', () => {
    freshState();
    const st = G.getStats();
    assert.strictEqual(st.totalMachines, 0);
    assert.strictEqual(st.totalThroughput, 0);
    assert.strictEqual(st.activeFloors, 0);
  });

  T.test('single miner with power → positive throughput', () => {
    const s = freshState();
    s.manualPower = 20;
    s.floors[0].slots[0].machine = 'miner_mk1';
    s.floors[0].slots[0].recipe  = 'mine_iron';
    const st = G.getStats();
    assert(st.totalThroughput > 0, 'should have throughput');
    assert.strictEqual(st.totalMachines, 1);
    assert.strictEqual(st.activeFloors, 1);
  });

  T.test('starved machine reports reduced throughput', () => {
    const s = freshState();
    s.manualPower = 20;
    s.storage.iron_ore = 0;
    s.floors[0].slots[0].machine = 'smelter';
    s.floors[0].slots[0].recipe  = 'smelt_iron';
    const st = G.getStats();
    // smelter needs iron_ore, storage = 0 → resourceEff = 0 → throughput 0
    assert.strictEqual(st.totalThroughput, 0, 'starved machine = 0 throughput');
  });

  T.test('netWorth reflects storage', () => {
    const s = freshState();
    s.storage.iron_ore = 100; // value 1 each
    const st = G.getStats();
    assert.strictEqual(st.netWorth, 100);
  });

  T.test('allResearchDone is false by default', () => {
    freshState();
    assert.strictEqual(G.getStats().allResearchDone, false);
  });
});

// ─── serialize / deserialize ──────────────────────────────────

T.group('Save/Load — round-trip serialization', () => {
  T.test('serializeState converts Sets to arrays', () => {
    const s = freshState();
    const json = G.serializeState(s);
    assert(Array.isArray(json.unlockedRecipes));
    assert(Array.isArray(json.unlockedMachines));
    assert(Array.isArray(json.completedMilestones));
  });

  T.test('deserializeState converts arrays back to Sets', () => {
    const s = freshState();
    const json = G.serializeState(s);
    const back = G.deserializeState(json);
    assert(back.unlockedRecipes instanceof Set);
    assert(back.unlockedMachines instanceof Set);
    assert(back.completedMilestones instanceof Set);
  });

  T.test('round-trip preserves unlocked recipes', () => {
    const s = freshState();
    s.unlockedRecipes.add('make_steel_beam');
    const back = G.deserializeState(G.serializeState(s));
    assert(back.unlockedRecipes.has('make_steel_beam'));
    assert(back.unlockedRecipes.has('mine_iron'));
  });

  T.test('round-trip preserves storage', () => {
    const s = freshState();
    s.storage = { iron_ore: 42.5, coal: 13 };
    const back = G.deserializeState(G.serializeState(s));
    assert.deepStrictEqual(back.storage, { iron_ore: 42.5, coal: 13 });
  });

  T.test('round-trip preserves milestoneBonus', () => {
    const s = freshState();
    s.milestoneBonus = 0.07;
    const back = G.deserializeState(G.serializeState(s));
    assert.strictEqual(back.milestoneBonus, 0.07);
  });

  T.test('deserialize fills missing keys from defaults', () => {
    const partial = { tick: 5, storage: {}, unlockedRecipes: [], unlockedMachines: [], completedMilestones: [] };
    const back = G.deserializeState(partial);
    assert(back.floors, 'should have floors from defaults');
    assert(back.research, 'should have research from defaults');
    assert.strictEqual(back.manualPower, 0);
    assert.strictEqual(back.challengesSolved, 0);
  });

  T.test('JSON stringify ↔ parse round-trip works', () => {
    const s = freshState();
    s.storage.iron_ore = 999;
    s.completedMilestones.add('m1');
    const json = JSON.stringify(G.serializeState(s));
    const back = G.deserializeState(JSON.parse(json));
    assert(back.completedMilestones.has('m1'));
    assert.strictEqual(back.storage.iron_ore, 999);
  });
});

// ─── EDGE CASES ───────────────────────────────────────────────

T.group('Edge cases', () => {
  T.test('createSlots returns correct count of empty slots', () => {
    const slots = G.createSlots(5);
    assert.strictEqual(slots.length, 5);
    for (const s of slots) {
      assert.strictEqual(s.machine, null);
      assert.strictEqual(s.recipe, null);
      assert.strictEqual(s.active, true);
      assert.strictEqual(s.clockSpeed, 1.0);
    }
  });

  T.test('mining recipes at 1.0 eff produce 30/min (0.5/sec)', () => {
    const r = G.RECIPES.mine_iron;
    const rate = r.outputs.iron_ore / r.time; // per second
    assert.strictEqual(rate, 0.5);
  });

  T.test('power cost at 2x ≈ 4x base for smelter (4→16 MW)', () => {
    const base = G.MACHINES.smelter.power; // 4
    const at2x = base * 2 * 2;
    assert.strictEqual(at2x, 16);
  });

  T.test('SAVE_VERSION is 1', () => {
    assert.strictEqual(G.SAVE_VERSION, 1);
  });

  T.test('getAllRecipes includes both RECIPES and ALT_RECIPES', () => {
    const all = G.getAllRecipes();
    assert(all.mine_iron,       'should include base recipe');
    assert(all.alt_screw,       'should include alt recipe');
    assert(all.alt_motor,       'should include alt recipe');
  });

  T.test('multiple machines on same floor sum power', () => {
    const s = freshState();
    s.floors[0].slots[0].machine = 'smelter'; // 4 MW
    s.floors[0].slots[0].recipe  = 'smelt_iron';
    s.floors[0].slots[1].machine = 'constructor'; // 4 MW
    s.floors[0].slots[1].recipe  = 'make_iron_plate';
    assert.strictEqual(G.computePower().demand, 8);
  });

  T.test('nuclear plant generates 2500 MW', () => {
    const s = freshState();
    s.floors[0].slots[0].machine = 'nuclear_plant';
    s.floors[0].slots[0].recipe  = 'burn_uranium';
    assert.strictEqual(G.computePower().supply, 2500);
  });
});

// ─── MILESTONES — hidden until achieved ──────────────────────

T.group('MILESTONES — hidden until achieved', () => {
  T.test('renderMilestones only shows completed milestone names', () => {
    const s = freshState();
    s.completedMilestones.add('m1');
    const el = { innerHTML: '' };
    const orig = global.document.getElementById;
    global.document.getElementById = (id) => id === 'page-milestones' ? el : orig(id);
    G.renderMilestones();
    global.document.getElementById = orig;
    assert(el.innerHTML.includes('First Steps'), 'completed milestone should be visible');
    assert(!el.innerHTML.includes('Copper Baron'), 'uncompleted milestone should be hidden');
    assert(!el.innerHTML.includes('Steel Worker'), 'uncompleted milestone should be hidden');
  });

  T.test('milestone page shows completed count without total', () => {
    const s = freshState();
    s.completedMilestones.add('m1');
    s.completedMilestones.add('m2');
    const el = { innerHTML: '' };
    const orig = global.document.getElementById;
    global.document.getElementById = (id) => id === 'page-milestones' ? el : orig(id);
    G.renderMilestones();
    global.document.getElementById = orig;
    // Should show count of achieved milestones
    assert(el.innerHTML.includes('2'), 'should show completed count');
    // Should NOT reveal total count (spoiler)
    assert(!el.innerHTML.includes(`/${G.MILESTONES.length}`), 'should not show total milestone count');
  });

  T.test('milestone page still shows total efficiency bonus', () => {
    const s = freshState();
    s.completedMilestones.add('m1');
    s.milestoneBonus = 0.02;
    const el = { innerHTML: '' };
    const orig = global.document.getElementById;
    global.document.getElementById = (id) => id === 'page-milestones' ? el : orig(id);
    G.renderMilestones();
    global.document.getElementById = orig;
    assert(el.innerHTML.includes('2%'), 'should show total efficiency bonus');
  });
});

// ─── MILESTONES — new reward types & power surge ─────────────

T.group('MILESTONES — new reward types & power surge triggers', () => {
  T.test('milestone exists for 10 power surges (bonus_start_power)', () => {
    const m = G.MILESTONES.find(m => m.reward === 'bonus_start_power');
    assert(m, 'should have a bonus_start_power milestone');
    const mock = { challengesSolved: 10, totalProduced: {}, totalMachines: 0,
      activeFloors: 0, netWorth: 0, powerSupply: 0, totalThroughput: 0,
      hasBuilt: {}, allResearchDone: false };
    assert(m.check(mock), 'should trigger at 10 surges');
    mock.challengesSolved = 9;
    assert(!m.check(mock), 'should not trigger below 10');
  });

  T.test('milestone exists for 25 power surges (extra_floor_chance)', () => {
    const m = G.MILESTONES.find(m => m.reward === 'extra_floor_chance');
    assert(m, 'should have an extra_floor_chance milestone');
    const mock = { challengesSolved: 25, totalProduced: {}, totalMachines: 0,
      activeFloors: 0, netWorth: 0, powerSupply: 0, totalThroughput: 0,
      hasBuilt: {}, allResearchDone: false };
    assert(m.check(mock), 'should trigger at 25 surges');
    mock.challengesSolved = 24;
    assert(!m.check(mock), 'should not trigger below 25');
  });

  T.test('milestone exists for 50 power surges (efficiency)', () => {
    const surgeEfficiency = G.MILESTONES.find(m =>
      m.reward === 'efficiency' && m.check({ challengesSolved: 50, totalProduced: {},
        totalMachines: 0, activeFloors: 0, netWorth: 0, powerSupply: 0,
        totalThroughput: 0, hasBuilt: {}, allResearchDone: false }));
    assert(surgeEfficiency, 'should have a surge-based efficiency milestone');
  });

  T.test('checkMilestones awards extra_floor_chance reward', () => {
    const s = freshState();
    s.challengesSolved = 25;
    G.checkMilestones();
    const m = G.MILESTONES.find(m => m.reward === 'extra_floor_chance');
    assert(s.completedMilestones.has(m.id), 'milestone should be completed');
    assert.strictEqual(s.extraFloorChance, m.rewardVal, 'extraFloorChance should increase');
  });

  T.test('checkMilestones awards bonus_start_power reward', () => {
    const s = freshState();
    s.challengesSolved = 10;
    G.checkMilestones();
    const m = G.MILESTONES.find(m => m.reward === 'bonus_start_power');
    assert(s.completedMilestones.has(m.id), 'milestone should be completed');
    assert.strictEqual(s.bonusStartPower, m.rewardVal, 'bonusStartPower should increase');
  });

  T.test('reward type text shown for non-efficiency milestones', () => {
    const s = freshState();
    s.challengesSolved = 25;
    G.checkMilestones();
    const el = { innerHTML: '' };
    const orig = global.document.getElementById;
    global.document.getElementById = (id) => id === 'page-milestones' ? el : orig(id);
    G.renderMilestones();
    global.document.getElementById = orig;
    assert(el.innerHTML.includes('extra factory'), 'should show extra factory reward text');
  });
});

// ─── New run — milestone reward carry-forward ────────────────

T.group('New run — milestone reward carry-forward', () => {
  T.test('doNewRun preserves completed milestones', () => {
    const s = freshState();
    s.completedMilestones.add('m1');
    s.milestoneBonus = 0.02;
    G.doNewRun();
    assert(G.gameState.completedMilestones.has('m1'), 'milestone should persist');
    assert.strictEqual(G.gameState.milestoneBonus, 0.02, 'bonus should persist');
  });

  T.test('extra floor chance: random below threshold unlocks floor 3', () => {
    const s = freshState();
    s.extraFloorChance = 0.02;
    s.completedMilestones.add('m1'); // need at least one milestone
    const origRandom = Math.random;
    Math.random = () => 0.01; // below 0.02 threshold
    G.doNewRun();
    Math.random = origRandom;
    // Floor 3 (index 2) should be unlocked as bonus
    assert(G.gameState.floors[2].unlocked, 'extra floor should be unlocked');
  });

  T.test('extra floor chance: random above threshold does not unlock', () => {
    const s = freshState();
    s.extraFloorChance = 0.02;
    s.completedMilestones.add('m1');
    const origRandom = Math.random;
    Math.random = () => 0.99; // above 0.02 threshold
    G.doNewRun();
    Math.random = origRandom;
    assert(!G.gameState.floors[2].unlocked, 'extra floor should NOT be unlocked');
  });

  T.test('bonus start power applied on new run', () => {
    const s = freshState();
    s.bonusStartPower = 50;
    s.completedMilestones.add('m1');
    G.doNewRun();
    assert.strictEqual(G.gameState.manualPower, 50, 'should start with bonus power');
  });

  T.test('bonus start power capped at manualPowerMax', () => {
    const s = freshState();
    s.bonusStartPower = 999;
    G.doNewRun();
    assert(G.gameState.manualPower <= G.gameState.manualPowerMax, 'should not exceed cap');
  });

  T.test('new run resets production but keeps milestones', () => {
    const s = freshState();
    s.completedMilestones.add('m1');
    s.completedMilestones.add('m2');
    s.milestoneBonus = 0.04;
    s.storage = { iron_ore: 999 };
    s.tick = 500;
    G.doNewRun();
    // Milestones preserved
    assert(G.gameState.completedMilestones.has('m1'));
    assert(G.gameState.completedMilestones.has('m2'));
    assert.strictEqual(G.gameState.milestoneBonus, 0.04);
    // Production reset
    assert.strictEqual(G.gameState.tick, 0);
    assert.deepStrictEqual(G.gameState.storage, {});
  });
});

// ─── Serialization — new fields ──────────────────────────────

T.group('Save/Load — new milestone reward fields', () => {
  T.test('round-trip preserves extraFloorChance', () => {
    const s = freshState();
    s.extraFloorChance = 0.02;
    const back = G.deserializeState(G.serializeState(s));
    assert.strictEqual(back.extraFloorChance, 0.02);
  });

  T.test('round-trip preserves bonusStartPower', () => {
    const s = freshState();
    s.bonusStartPower = 50;
    const back = G.deserializeState(G.serializeState(s));
    assert.strictEqual(back.bonusStartPower, 50);
  });

  T.test('old saves without new fields get defaults', () => {
    const partial = { tick: 5, storage: {}, unlockedRecipes: [], unlockedMachines: [], completedMilestones: [] };
    const back = G.deserializeState(partial);
    assert.strictEqual(back.extraFloorChance, 0, 'extraFloorChance defaults to 0');
    assert.strictEqual(back.bonusStartPower, 0, 'bonusStartPower defaults to 0');
  });
});

// ─── Share / Invite milestones ───────────────────────────────

T.group('Share / Invite milestones', () => {
  T.test('invite milestones exist for 1, 10, 100, 1000', () => {
    const thresholds = [1, 10, 100, 1000];
    for (const t of thresholds) {
      const m = G.MILESTONES.find(m => m.check({ invitesSent: t, totalProduced: {} }));
      assert(m, `milestone should trigger at ${t} invites`);
    }
  });

  T.test('invitesSent defaults to 0 in newGameState', () => {
    const s = G.newGameState();
    assert.strictEqual(s.invitesSent, 0);
  });

  T.test('getStats includes invitesSent', () => {
    const s = freshState();
    s.invitesSent = 42;
    const stats = G.getStats();
    assert.strictEqual(stats.invitesSent, 42);
  });

  T.test('round-trip preserves invitesSent', () => {
    const s = freshState();
    s.invitesSent = 7;
    const back = G.deserializeState(G.serializeState(s));
    assert.strictEqual(back.invitesSent, 7);
  });

  T.test('old saves without invitesSent get default 0', () => {
    const partial = { tick: 5, storage: {}, unlockedRecipes: [], unlockedMachines: [], completedMilestones: [] };
    const back = G.deserializeState(partial);
    assert.strictEqual(back.invitesSent, 0);
  });

  T.test('checkMilestones awards First Invite at 1 share', () => {
    const s = freshState();
    s.invitesSent = 1;
    // Need power supply so milestone check runs (some milestones check powerSupply)
    G.checkMilestones();
    assert(s.completedMilestones.has('m24'), 'First Invite milestone should be awarded');
  });
});

// ═══════════════════════════════════════════════════════════════
// RUN
// ═══════════════════════════════════════════════════════════════

T.run();
