// Renders one Army Clash Short (team colours from rules.json): 1080x1920, 60 fps, H.264 + AAC sound.
// The battle is paced to end close to rules.video.fightSeconds, and the video ends rules.video.outroSeconds after it does.
// Output: out/army-clash.mp4 and out/meta.json (title, description and tags for the upload).
'use strict';
const { createCanvas, registerFont } = require('canvas');
const { spawn } = require('child_process');
const { once } = require('events');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

registerFont(path.join(__dirname, 'fonts/BarlowCondensed-ExtraBoldItalic.ttf'), { family: 'Barlow Condensed', weight: '800', style: 'italic' });
registerFont(path.join(__dirname, 'fonts/BarlowCondensed-Bold.ttf'), { family: 'Barlow Condensed', weight: '700', style: 'normal' });

const RVB = require('./engine.js');
const C = require('./creative.js');
const { makeTitle, nounOf } = require('./titles.js');
const chronicle = require('./chronicle.js');
RVB.makeCanvas = (w, h) => createCanvas(w, h);

const FPS = 60, W = 1080, H = 1920, SR = 48000;
// Video length (rules.video): with outroSeconds set, the battle is paced to finish close to fightSeconds and the video ends
// outroSeconds after the battle does (the safety net calls time 2 s before SECS, so a video is never longer than SECS + 1;
// with the finale, rules.video.finale, the slow-motion final blow adds about 6 s more and there is no safety net).
// Without it, every video is exactly 60 seconds as before. SECS=<n> in the environment makes a short test clip of n seconds.
const VID = JSON.parse(fs.readFileSync(path.join(__dirname, 'rules.json'), 'utf8')).video || {};
const OUTRO = process.env.SECS ? 0 : VID.outroSeconds || 0;
const SECS = process.env.SECS ? Number(process.env.SECS) : OUTRO ? (VID.fightSeconds || 60) + OUTRO : 60;
// (the finale's slow motion adds up to about 8 s after the battle: rules.video.finale)
const MAXFRAMES = FPS * (OUTRO ? SECS + 16 : SECS);
const OUT = path.join(__dirname, 'out');
const seed = process.env.SEED ? Number(process.env.SEED) >>> 0 : crypto.randomBytes(4).readUInt32LE(0);

// Video rules live in rules.json (team colours, how often swordsmen appear). See RULES.md.
const rules = JSON.parse(fs.readFileSync(path.join(__dirname, 'rules.json'), 'utf8'));
const pick = RVB.rng(seed ^ 0x5bd1e995);
function weighted(list) {
  const total = list.reduce((t, x) => t + (x.weight ?? 1), 0);
  let r = pick.next() * total;
  for (const x of list) if ((r -= x.weight ?? 1) <= 0) return x;
  return list[list.length - 1];
}
// Troop line-up: not random. Videos go through rules.matchups in order, one per video,
// using how many videos are already in uploads.md to know where we are in the list.
// every posted video so far (videos.jsonl): used for the tribes' history and as the starting size for on-the-spot tuning
const pastVideos = (() => { try { return fs.readFileSync(path.join(__dirname, 'videos.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean); } catch (e) { return []; } })();
const posted = fs.existsSync(path.join(__dirname, 'uploads.md'))
  ? (fs.readFileSync(path.join(__dirname, 'uploads.md'), 'utf8').match(/^\| \d{4}-/gm) || []).length : 0;
const forcedEarly = process.env.MATCHUP !== undefined && process.env.MATCHUP !== '';
// Three-way battles (1v1v1): every Nth video (rules.threeWay.every); the rest stay 1v1. THREE=1 forces one.
const tw = rules.threeWay || {};
const three = process.env.THREE === '1' || (!forcedEarly && (tw.every || 0) > 1 && posted % tw.every === 1);
// Two teams must never look alike: a pair (or trio) whose colours are too close (rules.minColourGap, CIEDE2000) is skipped.
const minGap = rules.minColourGap ?? 30;
const gapOk = names => names.every((a, i) => names.every((b, j) => j <= i || RVB.colourGap(a, b) >= minGap));
let pair;
if (three) {
  const okTrios = (tw.teamTriples || [{ teams: ['RED', 'BLUE', 'GREEN'] }]).filter(p => gapOk(p.teams));
  pair = weighted(okTrios.length ? okTrios : [{ teams: ['RED', 'BLUE', 'GREEN'] }]).teams.slice();
  const k = Math.floor(pick.next() * 3); pair.push(...pair.splice(0, k));
} else {
  const okPairs = rules.teamPairs.filter(p => gapOk(p.teams));
  pair = weighted(okPairs.length ? okPairs : rules.teamPairs).teams.slice();
  if (pick.next() < 0.5) pair.reverse();
}
RVB.setTeams(pair[0], pair[1], pair[2]);
// line-ups marked "pending" are still being balanced and stay out of the rotation until then
const matchups = (rules.matchups || []).filter(m => !m.pending);
// Creative slots: every Nth video (rules.creative.every) is a brand-new match-up invented from the seed, balanced on the spot.
// MATCHUP=<n> forces line-up n from the list; WILD=1 forces a creative one.
const creative = rules.creative || {};
const every = creative.every || 0;
const forced = process.env.MATCHUP !== undefined && process.env.MATCHUP !== '';
const slot = forced ? Number(process.env.MATCHUP) : posted;
const wild = process.env.WILD === '1' || (!forced && every > 1 && slot % every === every - 1);
const listSlot = forced || every < 2 ? slot : slot - Math.floor((slot + 1) / every);
// three-way: alternate between the hand-made three-way line-ups and invented ones
const lineups3 = (tw.lineups || []).filter(m => !m.pending);
const invent3 = three && (process.env.WILD === '1' || Math.floor(posted / Math.max(1, tw.every || 4)) % 2 === 1 || !lineups3.length);
// Intelligent combat (rules.combat): smaller armies, visible melee moves (parry, block, cleave, pierce, stun, dodge), fewer but harder
// bullets from rapid-fire guns, and a roster card at the start. Off when "on" is false, which keeps old seeds playing out as before.
const combat = rules.combat && rules.combat.on !== false ? rules.combat : null;
// freshness (rules.creative.fresh): invented match-ups pick the troops seen least in the last 150 videos (videos.jsonl "units"),
// so all 140+ troops, the new ones included, keep turning up
const fresh = (() => {
  if (!(rules.creative && rules.creative.fresh)) return undefined;
  const f = {};
  const docs = {}; for (const d of RVB.ALL_DOCTRINES()) docs[d.name] = d;
  const typesOf = side => (side && typeof side === 'object' ? Object.keys(side.mix || {}).concat(side.heavy || []) : docs[side] ? Object.keys(docs[side].mix || {}).concat(docs[side].heavy || []) : []);
  for (const v of pastVideos.slice(-150)) {
    // (older videos didn't save their troop types: work them out from the armies)
    const list = v.units || [...new Set([].concat(...(v.sides || v.armies || []).map(typesOf)))];
    for (const k of list) f[k] = (f[k] || 0) + 1;
  }
  return f;
})();
const melee = combat && combat.creativeMelee ? Object.assign({ melee: combat.creativeMelee }, fresh ? { fresh } : {}) : fresh ? { fresh } : undefined;
const mu0 = three
  ? (invent3 ? C.invent3(seed, melee) : lineups3[Math.floor(posted / Math.max(1, tw.every || 4) / 2) % lineups3.length])
  : wild ? C.invent(seed, melee) : matchups.length ? matchups[listSlot % matchups.length] : null;
// Battle modes (rules.modes, 1v1 only) and army skins (rules.skins, looks only) roll their own dice, so nothing else in the rotation moves.
// MODE=king|duel|heroes|mirror|hill|none and SKINS=neon,shadow force them.
const MR = RVB.rng((seed ^ 0x6D0DE5) >>> 0);
const modeRoll = MR.next(), sideRoll = MR.next(), skinRolls = [MR.next(), MR.next(), MR.next(), MR.next(), MR.next(), MR.next()];
const modeCfg = rules.modes || {};
// troop armies (a crowd of one kind) can be mirrored or made into a band of heroes; one-of-a-kind boss armies can't
const crowd = d => typeof d === 'string' && !!nounOf({ name: d }).count;
let mode = null, heroTeam = 0;
if (process.env.MODE) mode = process.env.MODE === 'none' ? null : process.env.MODE;
else if (combat && !three && modeCfg.shares && mu0) {
  const list = Object.entries(modeCfg.shares), total = list.reduce((a, [, w]) => a + w, 0);
  let r = modeRoll * total;
  for (const [k, w] of list) if ((r -= w) <= 0) { mode = k; break; }
  if (mode === 'classic') mode = null;
}
let mu = mu0;
if (mode === 'mirror') {
  // the same army on both sides (one of the two from this line-up), told apart by colour and skin
  const ok = wild ? [] : [0, 1].filter(i => crowd(i ? mu0.bottom : mu0.top));
  if (!ok.length && !process.env.MODE) mode = null;
  const s = ok.length ? ok[Math.floor(sideRoll * ok.length)] : 0, d = s ? mu0.bottom : mu0.top, tt = s ? mu0.bottomTroops : mu0.topTroops;
  if (mode) mu = { ...mu0, top: d, bottom: d, topTroops: tt, bottomTroops: tt, balance: 1, combatBalance: 1 };
}
if (mode === 'heroes') {
  // a small band of heroes (30% of the troops, each far stronger) against a full army
  const ok = wild ? [0, 1] : [0, 1].filter(i => crowd(i ? mu0.bottom : mu0.top));
  if (!ok.length && !process.env.MODE) mode = null;
  heroTeam = ok.length ? ok[Math.floor(sideRoll * ok.length)] : 0;
}
let skins;
if (process.env.SKINS) skins = process.env.SKINS.split(',').map(k => k || null);
else if (combat && rules.skins && (rules.skins.list || []).length) {
  const left = rules.skins.list.slice(), n = three ? 3 : 2, need = mode === 'mirror';
  skins = Array.from({ length: n }, (_, i) => (need || skinRolls[i * 2] < (rules.skins.chance ?? 0.3) ? left.splice(Math.floor(skinRolls[i * 2 + 1] * left.length), 1)[0] : null));
  if (!skins.some(Boolean)) skins = undefined;
}
const sides = !mu ? undefined : three ? mu.three : [mu.top, mu.bottom];
// era (genre) comes from the two sides: 'medieval', 'modern', 'fantasy', 'scifi', 'pirate', 'horror', 'samurai',
// 'mixed' when two army types come from different genres, 'wild' for teams that mix genres themselves
const eras = sides ? sides.map(x => RVB.eraOf(x)) : ['medieval', 'medieval'];
const custom = !!mu && sides.some(x => typeof x === 'object');
// two genres from different times (knights vs tanks) are an "old vs new" battle; other mixes (zombies vs infantry) count as wild match-ups
const OLD = ['medieval', 'fantasy', 'samurai', 'pirate'], NEW = ['modern', 'scifi'];
const oldVsNew = (OLD.includes(eras[0]) && NEW.includes(eras[1])) || (OLD.includes(eras[1]) && NEW.includes(eras[0]));
const era = three ? 'wild' : wild || (custom && !(eras[0] === eras[1] && eras[0] !== 'mixed')) ? 'wild' : eras[0] === eras[1] ? eras[0] : oldVsNew ? 'mixed' : 'wild';
// Formations also rotate, shifting by one each time the line-up list starts over, so pairings keep changing.
const forms = rules.formations || ['line'];
const shift = Math.floor(slot / Math.max(1, matchups.length));
const formations = [forms[(slot + shift) % forms.length], forms[(slot * 5 + 2 + shift) % forms.length]];
// Optional troops for this line-up, e.g. "troops": ["spearman", "healer"]; shares come from rules.troopShares.
const shares = rules.troopShares || {};
const troops = (mu && mu.troops) || [];
const shareOf = type => (troops.includes(type) ? (shares[type] ?? 0.12) : 0);
const swordsmen = shareOf('swordsman');
const crossbowmen = shareOf('crossbowman');
const extras = troops.filter(t => t !== 'swordsman' && t !== 'crossbowman').map(type => ({ type, share: shareOf(type) }));
// topTroops / bottomTroops give one side its own extra troops (any troop type, from any era)
const sideTroops = mu ? [mu.topTroops || [], mu.bottomTroops || []] : [[], []];
const extrasByTeam = sideTroops.some(l => l.length) ? sideTroops.map(l => extras.concat(l.map(type => ({ type, share: shares[type] ?? 0.12 })))) : undefined;
const doctrines = sides;
// balance: bottom army size relative to the top, tuned so each match-up is close to 50/50 (three-way: one size per army).
// (with intelligent combat on, a line-up's "combatBalance" is used: combat changes which side is stronger)
const balOf = m => (combat && m.combatBalance !== undefined ? m.combatBalance : m.balance);
const budgetMul = !mu ? undefined : three ? (balOf(mu) || [1, 1, 1]) : [1, balOf(mu) ?? 1];
// Maps rotate too, among the ones allowed for this era (see rules.maps; three-way battles use maps marked "three").
const mapList = three ? ((mu && mu.maps) || tw.maps || ['open']).map(name => ({ name })) : (rules.maps || [{ name: 'open' }]).filter(m => !m.eras || m.eras.includes(era));
const map = process.env.MAP || (mapList.length ? mapList[(slot * 7 + 3 + shift) % mapList.length].name : 'open');
fs.mkdirSync(OUT, { recursive: true });

function ffmpeg(args) {
  const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((resolve, reject) => {
    p.on('error', reject);
    p.on('close', code => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with code ${code}`))));
  });
  return { p, done };
}

function writeWav(file, L, R, frames) {
  const buf = Buffer.alloc(44 + frames * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + frames * 4, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(frames * 4, 40);
  for (let i = 0; i < frames; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i])) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i])) * 32767), 46 + i * 4);
  }
  fs.writeFileSync(file, buf);
}

const titleCase = s => s.split(' ').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');

async function main() {
  const t0 = Date.now();
  // teamStyles: a colour can have its own fighting style, e.g. ORANGE armies are mostly swordsmen.
  const styles = rules.teamStyles || {};
  // (colour styles are about medieval troops, so they're ignored in modern battles)
  const style = (name, i) => (!three && eras[i] === 'medieval' && !(doctrines && typeof doctrines[i] === 'object') ? styles[name] : null);
  const swordsmenByTeam = pair.map((name, i) => (style(name, i) && style(name, i).swordsmenShare !== undefined) ? style(name, i).swordsmenShare : swordsmen);
  // a style's budget scales that army's size so the style stays fair (tested over many battles)
  const bm = (budgetMul || [1, 1]).map((v, i) => v * ((style(pair[i], i) && style(pair[i], i).budget) || 1));
  // formationBudget: slightly smaller armies for formations that tested stronger than a line, bigger for weaker ones
  const fbud = rules.formationBudget || {};
  if (!three) formations.forEach((f, i) => { bm[i] *= fbud[f] ?? 1; });
  // battle events (rules.events): supply drops, airstrikes, meteor showers
  const events = Array.isArray(rules.events) && rules.events.length ? rules.events : undefined;
  const systems = rules.systems || {};
  // living tribes (rules.tribes): each army is made of tribes that earn, trade, forge and follow tactics; their history comes from past videos
  const tribesOn = rules.tribes && rules.tribes.on;
  const trbOpts = tribesOn ? { tribes: Object.assign({}, rules.tribes, { history: chronicle.history(pastVideos) }) } : {};
  const cmbOpts = combat ? { combat: { armySize: combat.armySize ?? 0.8, hp: combat.hp ?? 1, moves: combat.moves !== false, fewerBullets: combat.fewerBullets !== false, roster: combat.roster !== false, smart: !!combat.smart }, mode: mode || undefined, skins, heroes: mode === 'heroes' ? heroTeam : undefined } : {};
  const pacing = OUTRO ? { outroSecs: OUTRO, pace: VID.pace !== false } : {};
  const UIL = (rules.ui && rules.ui.layout) || 1; // 2 = the Shorts-safe layout (scoreboard on top, tribes strip above YouTube's title)
  const optsFor = mul => ({ target: SECS, fixedLength: SECS, weaponSfx: !!(rules.sound && rules.sound.weapons), ...pacing, swordsmen, crossbowmen, map, doctrines, budgetMul: three ? mul : [bm[0], bm[1] * mul], swordsmenByTeam, extras, extrasByTeam, era, formations, events,
    teams: three ? 3 : 2, dream: !!(wild || custom || three), ...systems, ...cmbOpts, ...trbOpts, ...(UIL >= 2 ? { ui: UIL } : {}), ...(rules.ui && rules.ui.art >= 2 ? { art: rules.ui.art } : {}), ...(rules.world && rules.world.on ? { world: rules.world } : {}) });
  // a creative match-up is new, so balance it now with quick test battles on this map and these formations
  let wildMul = three ? bm.slice(0, 3) : 1, wildRate = null, tuned = null;
  // with intelligent combat on, every 1v1 battle is tuned on the spot with quick test battles (combat changes who is strong),
  // starting from the size the same line-up and mode ended up with last time (videos.jsonl), so it gets closer every time
  const sideName = d => (typeof d === 'object' ? d.name : d);
  const balKey = !three && !wild && mu ? `${sideName(mu.top)}|${sideName(mu.bottom)}|${mode || 'classic'}${mode === 'heroes' ? heroTeam : ''}` : null;
  if (combat && !three && mode !== 'mirror' && (combat.balanceSteps ?? 5) > 0) {
    let start = mode === 'heroes' ? ((modeCfg.heroStart || 1) ** (heroTeam ? -1 : 1)) : 1;
    try {
      const lines = pastVideos.slice().reverse();
      // (videos.jsonl keeps the bottom army's full size; it's turned back into a step on top of this line-up's size here,
      // so a later change to the line-up's combatBalance doesn't throw the start off)
      let near = null;
      const rel = v => (typeof v.balance === 'number' ? v.balance / (balOf(mu) ?? 1) : v.tuned);
      for (const ln of lines) {
        const v = ln; if (!balKey || !v.tuned || !v.balKey) continue;
        if (v.balKey === balKey) { near = rel(v); break; }
        // no video of this mode yet: the same line-up in another mode (not a last stand) is the next best start
        if (near === null && mode !== 'heroes' && v.balKey.startsWith(`${sideName(mu.top)}|${sideName(mu.bottom)}|`) && !v.balKey.includes('|heroes')) near = rel(v);
      }
      if (near !== null) start = near;
    } catch (e) { /* no history yet */ }
    const b = await C.tune(optsFor, { sims: combat.balanceBattles || 16, steps: combat.balanceSteps ?? 5, seed, start, spread: combat.balanceSpread || (mode === 'heroes' ? 2.6 : 2),
      maxMs: (combat.balanceSeconds || 90) * 1000, log: console.log });
    wildMul = b.balance; wildRate = b.rate; tuned = b.balance;
    console.log(`Tuned ${balKey || 'creative match-up'}: bottom x${wildMul} on top of its usual size, top won ${(b.rate * 100).toFixed(0)}% of test battles (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  } else if (combat && three && !invent3) {
    const b = await C.balance3(optsFor, { sims: tw.balanceBattles || 12, rounds: combat.balanceRounds3 || 4, seed, start: wildMul, log: console.log });
    wildMul = b.balance; wildRate = b.rates;
    console.log(`Three-way line-up ${sides.map(sideName).join(' vs ')}: sizes ${wildMul.join('/')} with combat on (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  } else if (three && invent3) {
    const b = await C.balance3(optsFor, { sims: tw.balanceBattles || 12, rounds: tw.balanceRounds || 6, seed, log: console.log });
    wildMul = b.balance; wildRate = b.rates;
    console.log(`Three-way creative match-up ${mu.three.map(x => x.name).join(' vs ')}: sizes ${wildMul.join('/')}, wins ${b.rates.map(x => (x * 100).toFixed(0) + '%').join('/')} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  } else if (wild && !three && !combat) {
    const b = await C.balance(optsFor, { sims: creative.balanceBattles || 8, steps: creative.balanceSteps || 6, seed, log: console.log });
    wildMul = b.balance; wildRate = b.rate;
    console.log(`Creative match-up ${mu.top.name} vs ${mu.bottom.name}: bottom army x${wildMul}, top won ${(b.rate * 100).toFixed(0)}% of test battles (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
  // the cinematic director: camera moves, close-ups and slow motion (rules.cinematic, on unless set to false)
  const cinematic = rules.cinematic !== false && process.env.CINEMATIC !== '0';
  // the finale (rules.video.finale): play the battle through once without drawing to find exactly when and where the
  // final blow lands (the battle plays out the same both times), so the director can be there for it in slow motion
  let finale = null;
  if (cinematic && OUTRO && VID.finale !== false) {
    const tf = Date.now(), pre = new RVB.Army(seed, optsFor(wildMul)), pd = new RVB.Director(pre, { seed });
    pre.noLate = true;
    for (let k = 0; pre.phase === 'fight' && k < MAXFRAMES * 3; k++) { pd.advance(1 / FPS); pre.sfx.length = 0; }
    const d = pre.lastDeath || {}, kill = pre.endHow === 'kill';
    finale = { t: pre.fightT, how: kill ? 'kill' : 'time', uid: kill ? d.uid : 0, by: kill ? d.by : 0, x: d.x, y: d.y };
    console.log(`Finale: the battle ends at ${pre.fightT.toFixed(2)} s by ${kill ? `the final blow on a ${d.type}${d.byType ? ` by a ${d.byType}` : ''}` : 'time'} (found in ${((Date.now() - tf) / 1000).toFixed(0)} s)`);
  }
  const game = new RVB.Army(seed, optsFor(wildMul));
  // every troop type in this battle (saved in videos.jsonl, so freshness can pick the troops seen least)
  const unitsAtStart = [...new Set(game.units.filter(u => !RVB.UNIT[u.type].uncounted).map(u => u.type).concat(...(game.waves || []).flat().map(w => w.list || [])))];
  const director = cinematic ? new RVB.Director(game, { seed, finale }) : null;
  const synth = new RVB.Synth(SR, MAXFRAMES / FPS + 4);
  synth.reset(seed);
  synth.variety = (rules.sound && rules.sound.variety) || 0;   // rules.json: how much each sound's pitch and volume vary (0 = off)
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  const silent = path.join(OUT, 'video-only.mp4');
  const enc = ffmpeg([
    '-f', 'rawvideo', '-pix_fmt', 'bgra', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-maxrate', '12M', '-bufsize', '24M',
    '-profile:v', 'high', '-level', '4.2', '-g', String(FPS * 2),
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-r', String(FPS), silent,
  ]);

  // the thumbnail (rules.thumbnail): each army's troops at the start, and the busiest even moment of the battle as its background
  const TH = rules.thumbnail || {};
  const thumbLists = TH.on ? [...Array(game.N).keys()].map(t => {
    const n = {};
    for (const u of game.units) if (u.team === t && !RVB.UNIT[u.type].uncounted) n[u.type] = (n[u.type] || 0) + 1;
    return Object.entries(n);
  }) : null;
  const thumbEnd = finale ? finale.t : 40;
  let thumbBg = null, thumbScore = -1;
  let nFrames = 0;
  for (let i = 0; i < MAXFRAMES; i++) {
    game.draw(ctx);
    // between 30% and 60% of the fight, twice a second: lots of troops on both sides, and neither side clearly ahead
    if (TH.on && game.phase === 'fight' && i % 30 === 0 && game.fightT > thumbEnd * 0.3 && game.fightT < thumbEnd * 0.6) {
      const al = [...Array(game.N).keys()].map(t => game.alive[t]), lo = Math.min(...al), hi = Math.max(...al, 1);
      const sc = (lo / hi) * al.reduce((a, b) => a + b, 0);
      if (sc > thumbScore) { thumbScore = sc; thumbBg = thumbBg || createCanvas(W, H); thumbBg.getContext('2d').drawImage(canvas, 0, 0); }
    }
    const frame = canvas.toBuffer('raw');
    if (!enc.p.stdin.write(frame)) await once(enc.p.stdin, 'drain');
    nFrames++;
    // the video ends when the outro does (outroSeconds after the battle), or at the fixed length
    if (OUTRO && game.finished) break;
    if (director) director.advance(1 / FPS); else game.frame(1 / FPS);
    for (const ev of game.sfx) synth.play(ev, (i + 1) / FPS);
    game.sfx.length = 0;
    if ((i + 1) % (FPS * 6) === 0) console.log(`frame ${i + 1} (${((i + 1) / FPS).toFixed(0)} s of video) after ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
  const DUR = nFrames / FPS;
  enc.p.stdin.end();
  await enc.done;

  // Sound: the match's sound effects, soft-limited, exactly as long as the video.
  const frames = Math.round(SR * DUR);
  const gain = game.audioGain || 1;
  const L = new Float32Array(frames), R = new Float32Array(frames);
  for (let i = 0; i < frames; i++) { L[i] = Math.tanh(synth.L[i] * gain); R[i] = Math.tanh(synth.R[i] * gain); }
  const wav = path.join(OUT, 'sound.wav');
  writeWav(wav, L, R, frames);

  const final = path.join(OUT, 'army-clash.mp4');
  await ffmpeg(['-i', silent, '-i', wav, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-t', DUR.toFixed(3), '-movflags', '+faststart', final]).done;
  fs.rmSync(silent); fs.rmSync(wav);

  // nations keep their usual short names (UK, USA); colours are title-cased
  const NATION = { UK: 'UK', USA: 'USA', FRANCE: 'France', GERMANY: 'Germany', ITALY: 'Italy', BRAZIL: 'Brazil', ARGENTINA: 'Argentina', CANADA: 'Canada', SPAIN: 'Spain', PORTUGAL: 'Portugal',
    AUSTRALIA: 'Australia', NEWZEALAND: 'New Zealand', NETHERLANDS: 'Netherlands', BELGIUM: 'Belgium', SWEDEN: 'Sweden', NORWAY: 'Norway',
    DENMARK: 'Denmark', FINLAND: 'Finland' };
  const FLAG = { UK: '🇬🇧', USA: '🇺🇸', FRANCE: '🇫🇷', GERMANY: '🇩🇪', ITALY: '🇮🇹', BRAZIL: '🇧🇷', ARGENTINA: '🇦🇷', CANADA: '🇨🇦', SPAIN: '🇪🇸', PORTUGAL: '🇵🇹',
    AUSTRALIA: '🇦🇺', NEWZEALAND: '🇳🇿', NETHERLANDS: '🇳🇱', BELGIUM: '🇧🇪', SWEDEN: '🇸🇪', NORWAY: '🇳🇴',
    DENMARK: '🇩🇰', FINLAND: '🇫🇮' };
  const EMOJI = { RED: '🔴', BLUE: '🔵', GREEN: '🟢', PURPLE: '🟣', ORANGE: '🟠', YELLOW: '🟡', PINK: '🩷', CYAN: '🩵', WHITE: '⚪', BROWN: '🟤',
    LIME: '💚', TEAL: '🌊', GOLD: '🥇', SILVER: '🥈', INDIGO: '🫐', CORAL: '🪸', MAGENTA: '🔮', SKY: '☁️', MINT: '🌿', AMBER: '🍯', CRIMSON: '❤️',
    NAVY: '⚓', LAVENDER: '🪻', OLIVE: '🫒', ROSE: '🌹', SAND: '🏜️', ...FLAG };
  const teamName = k => NATION[k] || titleCase(k);
  const ns = pair.map(teamName), [n0, n1] = ns;
  const armyName = i => titleCase(RVB.docLabel(game.doc[i]));
  const red = `${n0} ${armyName(0)}`, blue = `${n1} ${armyName(1)}`;
  // Clickbait slots (rules.clickbait.every): a short teaser about something that really happened, with no team names, hashtags or tags.
  const cbEvery = (rules.clickbait && rules.clickbait.every) || 0;
  const clickbait = process.env.CLICKBAIT === '1' || (!forced && cbEvery > 1 && slot % cbEvery === Math.floor(cbEvery / 2));
  const ids = three ? [0, 1, 2] : [0, 1];
  const Fx = game.facts || {};
  const tf = game.tribeFacts ? game.tribeFacts() : null;
  const skinNames = skins ? ids.map(i => (skins[i] && RVB.SKINS[skins[i]] ? RVB.SKINS[skins[i]].name : null)) : undefined;
  const nationBattle = pair.every(k => NATION[k]);
  const { title, kind: titleKind } = makeTitle({
    teams: pair, nations: nationBattle ? NATION : null, flags: FLAG, docs: game.doc, start: game.start.slice(0, ids.length),
    left: ids.map(t => game.alive[t] + game.reserve[t]), gained: ids.map(t => (game.gained && game.gained[t]) || 0), winner: game.winner,
    low: Fx.low, falls: Fx.falls || [], drops: Fx.drops || [], strike: Fx.strike, hazard: Fx.hazard, wild: wild || custom || (three && invent3), three, clickbait, seed,
    xf: game.xf || {}, label: RVB.labelOf, mvp: game.best && game.best[game.winner],
    mode: game.mode || undefined, heroes: mode === 'heroes' ? heroTeam : undefined, skins: skinNames, tribes: tf,
  });
  const hook = title;
  const MAP_NAME = { open: 'open field', rocks: 'rocky field', ruins: 'ruins', trenches: 'trenches', city: 'city rooftops', forest: 'forest', bombed: 'bombed city', enchanted: 'fantasy land', canyon: 'canyon',
    godboard: 'Godboard (a giant chessboard)', furnace: 'World Furnace (lava)', frozen: 'Frozen End (ice)', grave: "Titan's Grave", overgrown: 'Overgrown Kingdom', clockwork: 'Clockwork Colosseum', shattered: 'Shattered Sky (floating islands)', mirror: 'Mirror Dimension', castle: 'Castle Siege',
    beach: 'Pirate Beach', snow: 'Snowy Pass', dunes: 'Dune Sea', swamp: 'Murk Swamp', neon: 'Neon City', temple: 'Sky Temple', graveyard: 'Haunted Graveyard', moon: 'Moon Base' };
  // battle modes, said plainly in the description
  const MODE_LINE = { king: 'Protect the King: each army has a king at the back, behind a royal shield for the first part of the battle; an army whose king falls loses heart (weaker and slower) for the rest of the fight.',
    duel: 'Champion Duel: each army\'s best fighter duels in the middle first while both armies watch, then everyone charges.',
    heroes: `Last Stand: one army is a small band of heroes (far stronger fighters, gold rings) against a full army.`,
    mirror: 'Mirror Match: the same army on both sides, told apart by colour and look.',
    hill: 'King of the Hill: the army with more troops on the hill in the middle takes it and hits 25% harder while it holds it.' };
  const GENRE = { modern: 'modern warfare ', fantasy: 'fantasy ', mixed: 'old vs new ', scifi: 'sci-fi ', pirate: 'pirate ', horror: 'zombie ', samurai: 'samurai ', wild: 'mixed-genre ' };
  // custom teams get their own names in the title ("Storm Mages vs Dragon Bones"); army types stay in the description otherwise
  const showNames = era === 'wild';
  const sk = i => (skinNames && skinNames[i] ? `${skinNames[i].toLowerCase()} look, ` : '');
  const who = i => `${showNames ? armyName(i) : `${ns[i]} ${armyName(i)}`} (${showNames ? `${C.describeSide(game.doc[i])}, ` : ''}${mode === 'heroes' && heroTeam === i ? 'heroes, ' : ''}${sk(i)}`;
  // the tribes, in plain words, and the story (it's made up, and the description says so)
  const tcName = n => n.split(' ').map(w => (['OF', 'THE'].includes(w) ? w.toLowerCase() : w.charAt(0) + w.slice(1).toLowerCase())).join(' ').replace(/^the /, 'the ');
  const storyText = tf && tf.story ? (() => {
    let txt = tf.story.text.toLowerCase().replace(/(^|\. )([a-z])/g, (m0, a, b) => a + b.toUpperCase());
    for (const tb of tf.tribes) txt = txt.split(tb.name.toLowerCase()).join(tcName(tb.name).replace(/^the /, ''));
    return txt.split(tf.stake.toLowerCase()).join(tcName(tf.stake));
  })() : '';
  const tribeLine = tf ? `Tribes: ${ids.map(i => `${tf.tribes.filter(x => x.team === i).map(x => tcName(x.name).replace(/^the /, 'the ').replace(/^./, c => c.toUpperCase())).join(' and ')} (${ns[i]})`).join(' vs ')}. Story (made up for fun): ${storyText} During the battle each tribe earns gold and iron, trades with its sister tribe and forges better weapons and armour.` : '';
  const heavyIn = k => game.doc.some(d => d[k] || (d.heavy || []).includes(k));
  const unique = (list) => [...new Set(list)];
  const meta = {
    seed,
    seconds: +DUR.toFixed(2),
    title,
    description: [
      `${ids.map(i => `${EMOJI[pair[i]] || ''} ${who(i)}${three ? '' : `${formations[i]} formation, `}${game.start[i]} units)`).join(' vs ')}. Who wins? Pick your side and tell us in the comments before the end.`,
      '',
      `A ${Math.round(DUR)}-second ${three ? 'three-way (1v1v1) ' : ''}${GENRE[era] || ''}battle simulation on the ${MAP_NAME[map] || map} map${showNames ? `, ${ns.join(' vs ')}` : ''}. The outcome comes from the game's rules and chance, not real footage.${game.mode && MODE_LINE[game.mode] ? ' ' + MODE_LINE[game.mode] : ''}`,
      ...(tribeLine ? ['', tribeLine] : []),
      '',
      'Subscribe for a new battle every day.',
      '',
      `#shorts #${ns.map(n => n.toLowerCase().replace(/ /g, '')).join('vs')} #battlesimulation${three ? ' #1v1v1' : ''}`,
    ].slice(0, clickbait ? (tribeLine ? 7 : 5) : (tribeLine ? 9 : 7)).join('\n'),
    tags: clickbait ? [] : unique([ns.map(n => n.toLowerCase()).join(' vs '), 'army battle', 'battle simulation', 'army simulation', 'who wins', 'army clash', ids.map(i => (showNames ? armyName(i) : `${ns[i]} ${armyName(i)}`).toLowerCase()).join(' vs '), 'shorts']
      .concat(three ? ['1v1v1', 'three way battle'] : [])
      .concat(tf ? ['tribes', 'war economy'] : [])
      .concat({ king: ['protect the king'], duel: ['champion duel', '1v1 duel'], heroes: ['last stand', 'heroes vs army'], mirror: ['mirror match'], hill: ['king of the hill'] }[game.mode] || [])
      .concat({ modern: ['modern warfare'], fantasy: ['fantasy battle', 'dragon'], mixed: ['old vs new', 'swords vs guns'], scifi: ['sci fi battle', 'robots', 'lasers'], pirate: ['pirate battle', 'pirates'],
        horror: ['zombie battle', 'zombies'], samurai: ['samurai battle', 'ninja'], wild: wild || custom || three ? ['dream team', 'crazy matchup'] : ['crossover battle', 'crazy matchup'] }[era] || [])
      .concat(heavyIn('tank') ? ['tank battle'] : []).concat(heavyIn('dragon') ? ['dragon'] : []).concat(heavyIn('mech') ? ['mech'] : [])),
    teams: pair,
    troops,
    units: unitsAtStart,
    era,
    map,
    formations,
    armies: game.doc.map(d => d.name),
    sides: doctrines,
    wild: wild || (three && invent3) || undefined,
    three: three || undefined,
    titleKind,
    balance: wild || (three && invent3) || (combat && three) ? wildMul : tuned !== null && mu ? Math.round((balOf(mu) ?? 1) * tuned * 1000) / 1000 : mu ? balOf(mu) : undefined,
    mode: game.mode || undefined,
    heroes: mode === 'heroes' ? heroTeam : undefined,
    skins: skinNames && skinNames.some(Boolean) ? skinNames : undefined,
    combat: combat ? true : undefined,
    balKey: balKey || undefined,
    tuned: tuned ?? undefined,
    winTeam: game.winner,
    tribes: tf ? tf.tribes.map(x => ({ name: x.name, team: x.team, kills: x.kills, wt: x.wt, at: x.at })) : undefined,
    story: tf && tf.story ? tf.story.kind : undefined,
    storyText: storyText || undefined,
    chron: tf ? tf.chron : undefined,
    economy: tf ? { forges: tf.forges, trades: tf.trades, merchant: tf.merchant ? tf.merchant.name : undefined } : undefined,
    cinematic,
    hook,
    clickbait: clickbait || undefined,
    slot,
    winner: game.headline,
    // for the trophy room (TROPHIES.md): the best fighter, how fast it was over, titles and mutations earned
    trophy: (() => {
      const m = game.best && game.best[game.winner], x = game.xf || {};
      return { mvp: m && m.kills ? { unit: RVB.labelOf(m.type), kills: m.kills, name: m.champ || undefined, title: m.title || undefined } : undefined, fight: +game.fightT.toFixed(1), wipeout: game.retreat === undefined || game.retreat === -1 ? true : undefined,
        left: game.alive[game.winner] + game.reserve[game.winner], titles: x.titles && x.titles.length ? x.titles : undefined, mutations: x.muts && x.muts.length ? [...new Set(x.muts)] : undefined,
        moments: ['possess', 'fusion', 'godEater', 'portal', 'extinct', 'sudden', 'copied'].filter(k => x[k]).map(k => `${k}${typeof x[k] === 'string' ? ':' + x[k] : ''}`) };
    })(),
  };
  fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify(meta, null, 2));
  // the thumbnail: out/thumb.jpg (upload.js sets it on the video when YouTube allows it)
  if (TH.on && thumbLists) {
    const tc = createCanvas(W, H), tctx = tc.getContext('2d');
    const sides = ids.map(i => ({ team: i, list: thumbLists[i] || [], label: RVB.docLabel(game.doc[i]), name: ns[i].toUpperCase(), count: game.start[i] }));
    const tag = three ? '1 v 1 v 1' : game.mode && RVB.MODE_HOOK[game.mode] ? RVB.MODE_HOOK[game.mode].replace(/!$/, '') : '';
    game.drawThumb(tctx, thumbBg || canvas, sides, { tag });
    fs.writeFileSync(path.join(OUT, 'thumb.jpg'), tc.toBuffer('image/jpeg', { quality: 0.9 }));
  }
  const mb = (fs.statSync(final).size / 1048576).toFixed(1);
  console.log(`Done in ${((Date.now() - t0) / 1000).toFixed(0)} s: ${final} (${mb} MB, ${DUR.toFixed(1)} s long, battle ended at ${game.fightT.toFixed(1)} s) | ${meta.title} | ${game.headline}, ${game.detail}`);
  if (director) console.log(`Camera: ${director.shots.map(x => `${x.kind}@${x.t}`).join(' ')}`);
}

main().catch(err => { console.error(err); process.exit(1); });
