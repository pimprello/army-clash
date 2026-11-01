// Creative match-ups: invents two teams that mix troops from different genres (mages + riflemen + a tank vs orcs + two dragons...),
// and balances any match-up with quick test battles so the top side wins about half the time.
'use strict';
const os = require('os');
const path = require('path');
const RVB = require('./engine.js');

// Words for team names, by troop. A team is called "<WORD> <NOUN>", e.g. STORM MAGES or IRON ZOMBIES.
const NOUN = {
  soldier: 'LEGION', archer: 'ARCHERS', crossbowman: 'BOLTS', swordsman: 'BLADES', spearman: 'SPEARS', shieldbearer: 'SHIELDS',
  berserker: 'RAIDERS', knight: 'KNIGHTS', rifleman: 'RIFLES', gunner: 'GUNNERS', sniper: 'SNIPERS', grenadier: 'BOMBERS',
  wizard: 'MAGES', orc: 'ORCS', skeleton: 'BONES', elf: 'ELVES', trooper: 'TROOPERS', robot: 'BOTS', pirate: 'PIRATES',
  musketeer: 'MUSKETS', zombie: 'ZOMBIES', ninja: 'NINJAS', samurai: 'SAMURAI', vampire: 'VAMPIRES',
};
const HEAVY_WORD = { tank: 'IRON', dragon: 'DRAGON', giant: 'GIANT', mech: 'MECH', cannon: 'CANNON' };
const WORDS = ['STORM', 'SHADOW', 'NEON', 'CHAOS', 'ROGUE', 'ROYAL', 'WILD', 'GHOST', 'STEEL', 'FROST', 'SOLAR', 'LUNAR', 'TOXIC', 'CYBER', 'OMEGA', 'TITAN', 'THUNDER', 'COSMIC', 'MIDNIGHT', 'GOLDEN', 'SAVAGE', 'TURBO', 'MEGA', 'ULTRA'];
const HEAVIES = ['tank', 'dragon', 'giant', 'mech', 'cannon'];
// plural names for descriptions
const TROOP_NAME = {
  soldier: 'soldiers', archer: 'archers', crossbowman: 'crossbowmen', swordsman: 'swordsmen', spearman: 'spearmen', shieldbearer: 'shield bearers',
  berserker: 'berserkers', healer: 'healers', knight: 'knights', rifleman: 'riflemen', gunner: 'machine gunners', sniper: 'snipers', grenadier: 'grenadiers',
  wizard: 'wizards', orc: 'orcs', skeleton: 'skeletons', elf: 'elf archers', trooper: 'laser troopers', robot: 'robots', pirate: 'pirates',
  musketeer: 'musketeers', zombie: 'zombies', ninja: 'ninjas', samurai: 'samurai', vampire: 'vampires',
  tank: 'tank', dragon: 'dragon', giant: 'giant', mech: 'mech', cannon: 'cannon',
};
const MAX_NAME = 13;

// One made-up team. `avoid` = troops the other team already leads with, so the two sides look different.
function inventSide(R, avoid) {
  const pool = Object.keys(NOUN).filter(k => !avoid.includes(k));
  const genre = k => RVB.UNIT_ERA[k];
  const main = R.pick(pool);
  // the second troop comes from another genre most of the time: that's the fun of it
  const crossGenre = R.chance(0.75);
  const others = pool.filter(k => k !== main && (!crossGenre || genre(k) !== genre(main)));
  const second = R.pick(others.length ? others : pool.filter(k => k !== main));
  const troops = [main, second];
  if (R.chance(0.4)) { const third = R.pick(Object.keys(NOUN).concat(['healer']).filter(k => !troops.includes(k))); troops.push(third); }
  const w = troops.map((k, i) => (i === 0 ? R.range(0.5, 0.65) : i === 1 ? R.range(0.25, 0.4) : R.range(0.08, 0.15)));
  const sum = w.reduce((a, b) => a + b, 0), mix = {};
  troops.forEach((k, i) => { mix[k] = Math.round(w[i] / sum * 100) / 100; });
  const heavy = [];
  const h = R.next();
  if (h < 0.12) { const a = R.pick(HEAVIES); heavy.push(a, R.pick(HEAVIES.filter(k => k !== a))); }
  else if (h < 0.5) heavy.push(R.pick(HEAVIES));
  // a name that fits the scoreboard
  let name = '';
  for (let tries = 0; tries < 12; tries++) {
    const word = heavy.length && tries < 3 && R.chance(0.6) ? HEAVY_WORD[R.pick(heavy)] : R.pick(WORDS);
    const noun = NOUN[tries % 2 && NOUN[second] ? second : main];
    name = `${word} ${noun}`;
    if (name.length <= MAX_NAME && word !== noun) break;
  }
  if (name.length > MAX_NAME) name = NOUN[main];
  const base = troops.filter(k => k !== 'healer').reduce((a, b) => (RVB.UNIT[a].cost <= RVB.UNIT[b].cost ? a : b));
  return { name, mix, heavy, base };
}

// A new creative match-up from a seed (the same seed always gives the same match-up).
function invent(seed) {
  const R = RVB.rng((seed ^ 0xC2EA7E) >>> 0);
  const top = inventSide(R, []);
  let bottom = inventSide(R, [Object.keys(top.mix)[0]]);
  for (let k = 0; k < 5 && (bottom.name === top.name || bottom.name.split(' ')[0] === top.name.split(' ')[0]); k++) bottom = inventSide(R, [Object.keys(top.mix)[0]]);
  return { top, bottom, wild: true };
}

// "wizards, riflemen and machine gunners + a tank"
function describeSide(side) {
  if (typeof side === 'string') return side.toLowerCase();
  const list = Object.keys(side.mix).map(k => TROOP_NAME[k] || k);
  const said = list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}` : list[0];
  const heavy = (side.heavy || []).concat(['giant', 'tank', 'dragon'].filter(k => side[k]));
  if (!heavy.length) return said;
  const counts = {}; heavy.forEach(k => { counts[k] = (counts[k] || 0) + 1; });
  const hs = Object.entries(counts).map(([k, n]) => (n > 1 ? `${n} ${TROOP_NAME[k]}s` : `a ${TROOP_NAME[k]}`));
  return `${said} + ${hs.join(' and ')}`;
}

// ---------- balancing ----------
// topRate(opts, seeds): share of test battles the top army wins, spread over worker threads.
function makeRunner(threads) {
  const n = Math.max(1, Math.min(threads || (os.availableParallelism ? os.availableParallelism() : os.cpus().length), 8));
  let workers = [];
  try {
    const { Worker } = require('worker_threads');
    for (let i = 0; i < n; i++) workers.push(new Worker(path.join(__dirname, 'sim-worker.js')));
  } catch (e) { workers = []; }
  let next = 0;
  const pending = new Map();
  for (const w of workers) w.on('message', ({ id, top, wins, soft }) => { const p = pending.get(id); pending.delete(id); p({ top, wins, soft }); });
  const run = (opts, seeds) => new Promise(resolve => {
    if (!workers.length) { const sw = require('./sim-worker.js'); const top = sw.topWins(opts, seeds); resolve({ top, wins: sw.topWins.last, soft: sw.topWins.soft }); return; }
    const id = next++; pending.set(id, resolve);
    workers[id % workers.length].postMessage({ id, opts, seeds });
  });
  return {
    async topRate(opts, seeds) {
      const parts = workers.length ? workers.map((_, i) => seeds.filter((_, j) => j % workers.length === i)).filter(p => p.length) : [seeds];
      const res = await Promise.all(parts.map(p => run(opts, p)));
      return res.reduce((a, b) => a + b.top, 0) / seeds.length;
    },
    // share of battles each of three armies won
    async rates3(opts, seeds) {
      const parts = workers.length ? workers.map((_, i) => seeds.filter((_, j) => j % workers.length === i)).filter(p => p.length) : [seeds];
      const res = await Promise.all(parts.map(p => run(opts, p)));
      const rates = [0, 1, 2].map(t => res.reduce((a, b) => a + b.wins[t], 0) / seeds.length);
      // soft: each army's average share of a score for how long it lasted and how many it had left (smoother than wins)
      rates.soft = [0, 1, 2].map(t => res.reduce((a, b) => a + (b.soft ? b.soft[t] : 0), 0) / seeds.length);
      return rates;
    },
    close() { for (const w of workers) w.terminate(); },
  };
}

// Find the bottom army size (a multiplier on its budget) that makes the top side win about half the time.
// optsFor(mul) builds the Army options for that size. The same test seeds are used at every step, so the steps compare fairly.
async function balance(optsFor, { sims = 8, steps = 6, seed = 1, lo = 0.35, hi = 2.8, threads, log } = {}) {
  const runner = makeRunner(threads);
  try {
    const seeds = Array.from({ length: sims }, (_, i) => (((seed >>> 0) * 2654435761 + i * 40503 + 17) >>> 0) || 1);
    let mul = 1, best = { mul: 1, rate: 0, err: 1 };
    for (let s = 0; s < steps; s++) {
      const rate = await runner.topRate(optsFor(mul), seeds);
      const err = Math.abs(rate - 0.5);
      if (err <= best.err) best = { mul, rate, err };
      if (log) log(`  step ${s + 1}: bottom x${mul.toFixed(3)} -> top wins ${(rate * 100).toFixed(0)}%`);
      if (err < 0.001) break;
      if (rate > 0.5) lo = mul; else hi = mul;
      mul = Math.sqrt(lo * hi);
    }
    return { balance: Math.round(best.mul * 1000) / 1000, rate: best.rate };
  } finally { runner.close(); }
}

// A three-way creative match-up: three made-up teams that each lead with a different troop.
function invent3(seed) {
  const R = RVB.rng((seed ^ 0x3A3A3A) >>> 0);
  const sides = [];
  for (let t = 0; t < 3; t++) {
    let s = inventSide(R, sides.map(x => Object.keys(x.mix)[0]));
    for (let k = 0; k < 6 && sides.some(x => x.name.split(' ')[0] === s.name.split(' ')[0] || x.name === s.name); k++) s = inventSide(R, sides.map(x => Object.keys(x.mix)[0]));
    sides.push(s);
  }
  return { three: sides, wild: true };
}

// Balance three armies: repeatedly grow the ones that win too rarely and shrink the ones that win too often,
// using the same test battles each round. optsFor(muls) builds the options for army sizes muls = [a, b, c].
async function balance3(optsFor, { sims = 12, rounds = 5, seed = 1, threads, log, start } = {}) {
  const runner = makeRunner(threads);
  try {
    const seeds = Array.from({ length: sims }, (_, i) => (((seed >>> 0) * 2246822519 + i * 3266489917 + 7) >>> 0) || 1);
    // steer by the smooth score (how long each army lasts and how many it keeps), and keep the sizes whose wins and scores are both closest to even
    let muls = (start || [1, 1, 1]).slice(), best = { muls: muls.slice(), err: Infinity, rates: [1 / 3, 1 / 3, 1 / 3] };
    const gain = [0.75, 0.75, 0.75], sgn = [0, 0, 0];
    for (let r = 0; r < rounds; r++) {
      const rates = await runner.rates3(optsFor(muls), seeds), soft = rates.soft;
      const err = Math.max(...rates.map(x => Math.abs(x - 1 / 3))) * 0.5 + Math.max(...soft.map(x => Math.abs(x - 1 / 3))) * 1.5;
      if (err < best.err) best = { muls: muls.slice(), err, rates: rates.slice() };
      if (log) log(`  round ${r + 1}: sizes ${muls.map(m => m.toFixed(2)).join('/')} -> wins ${rates.map(x => (x * 100).toFixed(0) + '%').join('/')}, score ${soft.map(x => (x * 100).toFixed(0) + '%').join('/')}`);
      if (Math.max(...soft.map(x => Math.abs(x - 1 / 3))) < 0.035 && Math.max(...rates.map(x => Math.abs(x - 1 / 3))) < 0.2) break;
      // three-way battles snowball (a small edge wins outright), so each army's step is halved whenever its score swings past even
      for (let t = 0; t < 3; t++) { const sg = Math.sign(soft[t] - 1 / 3); if (sgn[t] && sg && sg !== sgn[t]) gain[t] *= 0.5; if (sg) sgn[t] = sg; }
      muls = muls.map((m, t) => m * Math.pow((1 / 3) / Math.max(soft[t], 0.04), gain[t]) * Math.pow((1 / 3 + 0.1) / (rates[t] + 0.1), 0.1));
      const mean = (muls[0] + muls[1] + muls[2]) / 3; muls = muls.map(m => clamp3(m / mean));
    }
    return { balance: best.muls.map(m => Math.round(m * 1000) / 1000), rates: best.rates };
  } finally { runner.close(); }
}

const clamp3 = m => Math.min(3, Math.max(0.25, m));
module.exports = { invent, invent3, describeSide, balance, balance3, makeRunner, TROOP_NAME, NOUN };
