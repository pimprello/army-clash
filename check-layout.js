// Layout check for the overlays (the roster card at the start, the tribes' story, the war council panel and the outro chronicle line).
// It draws them for many line-ups, three-way battles and the longest names, and fails if any two text boxes or portraits overlap,
// if any text had to be squashed to fit, is smaller than allowed, or leaves its area.
// Usage: node check-layout.js            (all line-ups; about a minute)
//        node check-layout.js 20         (the first 20 line-ups only)
//        node check-layout.js all 2/4    (part 2 of 4: every 4th line-up; three-way and invented ones go in part 1),
//                                         for machines where the whole check takes longer than one command may run
// Exit code 1 if anything is wrong, with a list of what and where.
'use strict';
const { createCanvas, registerFont } = require('canvas');
const path = require('path');
registerFont(path.join(__dirname, 'fonts/BarlowCondensed-ExtraBoldItalic.ttf'), { family: 'Barlow Condensed', weight: '800', style: 'italic' });
registerFont(path.join(__dirname, 'fonts/BarlowCondensed-Bold.ttf'), { family: 'Barlow Condensed', weight: '700', style: 'normal' });
const RVB = require('./engine.js');
RVB.makeCanvas = (w, h) => createCanvas(w, h);
const rules = require('./rules.json'), sh = rules.troopShares || {};
const C = require('./creative.js');

const limit = Number(process.argv[2]) || Infinity;
const [part, parts] = (process.argv[3] || '1/1').split('/').map(Number);
const mine = i => (i % parts) === part - 1;
const combat = Object.assign({}, rules.combat || {}, { moves: true, roster: true });
const tribes = Object.assign({}, rules.tribes || {}, { on: true });
// areas: the roster card covers the score area; the panel sits under the battle timer
const AREA = { roster: { x0: 30, y0: 222, x1: 1050, y1: 478, min: 12 }, council: { x0: 30, y0: 1600, x1: 1050, y1: 1912, min: 18 } };
// UI 2.0 (rules.ui.layout 2): everything must also stay inside the Shorts safe zone: clear of the phone's edges, the top bar,
// YouTube's title/channel line at the bottom (below y 1560) and the like/comment/share column (right of x 940, from y 900 down)
const UI = (rules.ui && rules.ui.layout) || 1;
const SAFE = { x0: 48, x1: 1032, y0: 60, y1: 1560, btnX: 940, btnY0: 900 };
const MIN2 = { council: 18, story: 18, roster: 13, chapter: 18, banner: 0 };
const cv = createCanvas(1080, 1920), ctx = cv.getContext('2d');
const problems = [];
const hit = (a, b) => a.x < b.x + b.w - 1 && b.x < a.x + a.w - 1 && a.y < b.y + b.h - 1 && b.y < a.y + a.h - 1;

function check2(g, label) {
  const L = g.lay || [];
  for (const b of L) {
    const where = b.y >= 1372 ? 'council' : b.kind === 'banner' ? 'banner' : b.y < 700 && g.t < 4.3 ? 'story' : b.y > 1290 ? 'chapter' : 'roster';
    const nm = `"${b.text || b.kind}"`;
    if (b.kind === 'text' && b.squash) problems.push(`${label} [${where}]: ${nm} had to be squashed to fit`);
    if (b.kind === 'text' && b.size && b.size < MIN2[where]) problems.push(`${label} [${where}]: ${nm} is ${b.size}px (min ${MIN2[where]})`);
    if (b.x < SAFE.x0 - 1 || b.x + b.w > SAFE.x1 + 1 || b.y < SAFE.y0 - 1 || b.y + b.h > SAFE.y1 + 1) problems.push(`${label} [${where}]: ${nm} leaves the Shorts safe zone`);
    if (b.y + b.h > SAFE.btnY0 && b.x + b.w > SAFE.btnX + 1) problems.push(`${label} [${where}]: ${nm} goes under YouTube's like/comment buttons`);
  }
  for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
    if (hit(L[i], L[j])) problems.push(`${label}: "${L[i].text || L[i].kind}" overlaps "${L[j].text || L[j].kind}"`);
  }
}

function check(g, label, area) {
  if (UI >= 2) return check2(g, label);
  const L = (g.lay || []).filter(b => b.y >= AREA[area].y0 - 40 && b.y <= AREA[area].y1 + 40);
  const A = AREA[area];
  for (const b of L) {
    if (b.kind === 'text' && b.squash) problems.push(`${label} [${area}]: "${b.text}" had to be squashed to fit`);
    if (b.kind === 'text' && b.size && b.size < A.min) problems.push(`${label} [${area}]: "${b.text}" is ${b.size}px (min ${A.min})`);
    if (b.x < A.x0 - 1 || b.x + b.w > A.x1 + 1 || b.y < A.y0 - 1 || b.y + b.h > A.y1 + 1) problems.push(`${label} [${area}]: "${b.text || b.kind}" leaves its area`);
  }
  for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
    if (hit(L[i], L[j])) problems.push(`${label} [${area}]: "${L[i].text || L[i].kind}" overlaps "${L[j].text || L[j].kind}"`);
  }
}

function sideOpts(m) {
  const t = m.troops || [], ex = t.filter(k => k !== 'swordsman' && k !== 'crossbowman').map(type => ({ type, share: sh[type] ?? 0.12 }));
  const side = [m.topTroops || [], m.bottomTroops || []];
  return { swordsmen: t.includes('swordsman') ? sh.swordsman : 0, crossbowmen: t.includes('crossbowman') ? sh.crossbowman : 0, extras: ex,
    extrasByTeam: side.some(l => l.length) ? side.map(l => ex.concat(l.map(type => ({ type, share: sh[type] ?? 0.12 })))) : undefined };
}

function run(label, opts, seed, teams, frames) {
  if (process.env.VERBOSE) console.log("run", label);
  RVB.setTeams(...teams);
  const V = rules.video || {}, len = V.outroSeconds ? (V.fightSeconds || 60) + V.outroSeconds : 60;
  const g = new RVB.Army(seed, Object.assign({ target: len, fixedLength: len, outroSecs: V.outroSeconds || undefined, pace: V.outroSeconds ? V.pace !== false : undefined, map: 'open', events: rules.events, ...(rules.systems || {}), combat, tribes }, UI >= 2 ? { ui: UI } : {}, opts));
  let k = 0;
  // UI 2.0 has more moments to check: both beats of the story, the roster strips, the panel, chapter cards and the outro
  if (UI >= 2) frames = [[1.2], [3.0], [5.2], [7.0], [12], [20], [33], [47]].concat(frames.some(f => f[0] === 'end') ? [['end']] : []);
  for (const [at, area] of frames) {
    if (at === 'end') { while (!g.finished && k < 4800 && !(g.phase === 'outro' && g.outroT > Math.min(2.5, g.outroLen - 0.1))) { g.frame(1 / 60); g.sfx.length = 0; k++; } }
    else while (k < Math.round(at * 60)) { g.frame(1 / 60); g.sfx.length = 0; k++; }
    if (process.env.VERBOSE) console.log("  frame", at);
    g.lay = null; g.draw(ctx);
    check(g, `${label} @${at}`, area);
  }
}

// long names: make every tribe in the pool and every long troop name show up somewhere
const longTeams = [['LAVENDER', 'CRIMSON'], ['MAGENTA', 'OLIVE'], ['NETHERLANDS', 'NEWZEALAND'], ['RED', 'BLUE']];
const matchups = (rules.matchups || []).filter(m => !m.pending).slice(0, limit);
let n = 0;
matchups.forEach((m, i) => {
  if (!mine(i)) return;
  const eras = [RVB.eraOf(m.top), RVB.eraOf(m.bottom)];
  const opts = { doctrines: [m.top, m.bottom], era: eras[0] === eras[1] ? eras[0] : 'mixed', budgetMul: [1, m.combatBalance ?? m.balance ?? 1], ...sideOpts(m),
    skins: i % 3 === 0 ? ['shadow', 'gold'] : undefined, mode: i % 5 === 0 ? 'king' : undefined };
  // the roster card at 1.5 s, the story at 4 s, the panel at 15 s (and the outro for every fourth line-up)
  const frames = [[1.5, 'roster'], [4, 'council'], [15, 'council']];
  if (i % 4 === 0) frames.push(['end', 'council']);
  run(`#${i} ${typeof m.top === 'string' ? m.top : m.top.name} vs ${typeof m.bottom === 'string' ? m.bottom : m.bottom.name}`, opts, 100 + i, longTeams[i % longTeams.length], frames);
  n++;
});
// three-way battles and invented match-ups
for (const [j, tl] of (rules.threeWay && rules.threeWay.lineups || []).slice(0, part === 1 ? Math.min(6, limit) : 0).entries()) {
  run(`three-way ${tl.three.map(x => (typeof x === 'string' ? x : x.name)).join('/')}`, { doctrines: tl.three, teams: 3, era: 'wild', budgetMul: tl.balance || [1, 1, 1], dream: true }, 300 + j, ['RED', 'BLUE', 'GREEN'], [[1.5, 'roster'], [4, 'council'], [15, 'council']]);
  n++;
}
for (let s = 1; s <= (part === 1 ? Math.min(8, limit) : 0); s++) {
  const mu = C.invent(s * 7919, { melee: combat.creativeMelee });
  run(`creative ${mu.top.name} vs ${mu.bottom.name}`, { doctrines: [mu.top, mu.bottom], era: 'wild', dream: true }, 500 + s, longTeams[s % longTeams.length], [[1.5, 'roster'], [4, 'council'], [15, 'council']]);
  n++;
}
if (problems.length) {
  console.log(`Layout check FAILED: ${problems.length} problem(s) in ${n} battles`);
  for (const p of [...new Set(problems)].slice(0, 60)) console.log(' - ' + p);
  process.exit(1);
}
console.log(`Layout check passed: ${n} battles, no overlaps, nothing squashed or too small.`);
