// Renders one Army Clash Short (team colours from rules.json): 1080x1920 (or 2160x3840 with rules.video.scale 2), 60 fps, H.264 + AAC sound.
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
const CO = require('./coldopen.js');
const AR = RVB.AR;
const C = require('./creative.js');
const { makeTitle, nounOf } = require('./titles.js');
const { Cliff } = require('./cliffhanger.js');
// (rules.ui.notch, Rellz 2026-11-21: "nothing in the UI should be in the top 190 px": the phone's notch and YouTube's top bar)
const NOTCH = !!(require('./rules.json').ui || {}).notch;
const chronicle = require('./chronicle.js');
const Music = require('./music.js');
const Commentary = require('./commentary.js');
RVB.makeCanvas = (w, h) => createCanvas(w, h);

// rules.video.scale 2 = 4K: everything is laid out in 1080x1920 units and drawn at twice the size (not stretched up).
// 60 fps is YouTube's highest frame rate (anything faster is converted down on upload).
const FPS = 60, W = 1080, H = 1920, SR = 48000, RS = Math.max(1, Math.min(2, Number(process.env.SCALE || (JSON.parse(fs.readFileSync(path.join(__dirname, 'rules.json'), 'utf8')).video || {}).scale || 1)));
RVB.RS = RS;
// Video length (rules.video): with outroSeconds set, the battle is paced to finish close to fightSeconds and the video ends
// outroSeconds after the battle does (the safety net calls time 2 s before SECS, so a video is never longer than SECS + 1;
// with the finale, rules.video.finale, the slow-motion final blow adds about 6 s more and there is no safety net).
// Without it, every video is exactly 60 seconds as before. SECS=<n> in the environment makes a short test clip of n seconds.
const VID = JSON.parse(fs.readFileSync(path.join(__dirname, 'rules.json'), 'utf8')).video || {};
const OUTRO = process.env.SECS ? 0 : VID.outroSeconds || 0;
const SECS = process.env.SECS ? Number(process.env.SECS) : OUTRO ? (VID.fightSeconds || 60) + OUTRO : 60;
// (the finale's slow motion adds up to about 8 s after the battle: rules.video.finale)
const MAXFRAMES = FPS * (OUTRO ? SECS + 16 : SECS);
// the intro (rules.intro, Rellz 2026-11-15: "instead of the video starting right in the battle it should be a bit like the
// thumbnail and should be a few seconds giving context about who vs who"): a short title card before the battle
const INTRO = (() => { const r = JSON.parse(fs.readFileSync(path.join(__dirname, 'rules.json'), 'utf8')).intro || {}; return r.on && (!process.env.SECS || process.env.INTRO === '1') ? Math.max(1, Math.min(4, r.seconds || 2.4)) : 0; })();
const INTRO_F = Math.round(INTRO * FPS), IN_S = INTRO_F / FPS;
// the charge (rules.charge, Rellz 2026-11-15: "make it like they arent fighting then a nice charge animation pops up with a voice
// saying charge like in a war and then they start running to eachother"): a stand-off before the battle, with both armies still
// in their lines, then CHARGE! and a war cry; the battle is not stepped during it, so it plays out exactly as before
const CHARGE = (() => { const r = JSON.parse(fs.readFileSync(path.join(__dirname, 'rules.json'), 'utf8')).charge || {}; return r.on && (!process.env.SECS || process.env.CHARGE === '1') ? { len: Math.max(1.4, Math.min(4, r.seconds || 2.6)), at: Math.max(0.5, Math.min(2.5, r.shoutAt || 1.1)), voices: r.voices || 3 } : null; })();
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
// the roster (rules.roster): with it on, line-ups built around a retired troop leave the rotation
const roster = rules.roster && rules.roster.on ? rules.roster : null;
const retiredSide = d => !!roster && (typeof d === 'string' ? RVB.docRetired(d) : d && typeof d === 'object' && Object.keys(d.mix || {}).concat(d.heavy || []).some(k => RVB.RETIRED.includes(k)));
// line-ups marked "pending" are still being balanced and stay out of the rotation until then
const matchups = (rules.matchups || []).filter(m => !m.pending && !retiredSide(m.top) && !retiredSide(m.bottom));
// Creative slots: every Nth video (rules.creative.every) is a brand-new match-up invented from the seed, balanced on the spot.
// MATCHUP=<n> forces line-up n from the list; WILD=1 forces a creative one.
const creative = rules.creative || {};
const every = creative.every || 0;
const forced = process.env.MATCHUP !== undefined && process.env.MATCHUP !== '';
const slot = forced ? Number(process.env.MATCHUP) : posted;
const wild = process.env.WILD === '1' || (!forced && every > 1 && slot % every === every - 1);
const listSlot = forced || every < 2 ? slot : slot - Math.floor((slot + 1) / every);
// three-way: alternate between the hand-made three-way line-ups and invented ones
const lineups3 = (tw.lineups || []).filter(m => !m.pending && !(m.three || m.sides || []).some(retiredSide));
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
// Rellz's picks (rules.picks, 2026-11-16): 26 updates for all three games (new troops, spells, modes, weather, dusk, the MVP card,
// the commentator, the crowd and map music). PICKS=0 turns them off for a test; with them off every old seed plays as before.
const PK = rules.picks && rules.picks.on && process.env.PICKS !== '0' ? rules.picks : null;
const melee = Object.assign({}, combat && combat.creativeMelee ? { melee: combat.creativeMelee } : {}, fresh ? { fresh } : {}, roster ? { roster: true } : {}, PK && PK.troops !== false ? { picks: true } : {});
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
  const list = Object.entries(Object.assign({}, modeCfg.shares, PK && PK.modes ? PK.modes : {})), total = list.reduce((a, [, w]) => a + w, 0);
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
// holiday specials (holiday.js, Rellz 2026-11-16): on a holiday the map that suits it is used when the line-up allows it
const Holiday = require('./holiday.js'), HOL = Holiday.of();
// (rules.mapsFresh, Rellz 2026-11-21: the new fun-park maps) until the given date, every few videos is on one of the newest maps
const MF = rules.mapsFresh, freshList = MF && MF.on && !three && new Date() < new Date(MF.until) ? mapList.filter(m => m.fresh) : [];
const freshMap = freshList.length && slot % (MF.every || 2) === 0 ? freshList[Math.floor(slot / (MF.every || 2)) % freshList.length].name : null;
const map = process.env.MAP || Holiday.map(HOL, mapList.map(m => m.name)) || freshMap || (mapList.length ? mapList[(slot * 7 + 3 + shift) % mapList.length].name : 'open');
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
  const cmbOpts = combat ? { combat: { armySize: combat.armySize ?? 0.8, hp: combat.hp ?? 1, moves: combat.moves !== false, fewerBullets: combat.fewerBullets !== false, roster: combat.roster !== false, smart: !!combat.smart, buyIn: combat.buyIn, duelStart: combat.duelStart }, mode: mode || undefined, skins, heroes: mode === 'heroes' ? heroTeam : undefined } : {};
  // (rules.video.calmCam, Rellz 2026-11-23) close-ups in slow motion, no fast-forward, the camera on the busiest fighting (camera and pace only)
  const CALM = VID.calmCam && VID.calmCam.on ? { slow: VID.calmCam.slow ?? 0.5 } : null;
  const pacing = Object.assign(OUTRO ? { outroSecs: OUTRO, pace: VID.pace !== false } : {}, VID.smooth ? { smooth: true } : {}, CALM ? { calmCam: CALM } : {}, (JSON.parse(fs.readFileSync(path.join(__dirname, 'rules.json'), 'utf8')).ui || {}).inside ? { inside: true } : {});
  const UIL = (rules.ui && rules.ui.layout) || 1; // 2 = the Shorts-safe layout (scoreboard on top, tribes strip above YouTube's title)
  const optsFor = mul => ({ ...(CHARGE && rules.cinematic !== false && process.env.CINEMATIC !== '0' ? { charge: true } : {}), target: SECS, fixedLength: SECS, weaponSfx: !!(rules.sound && rules.sound.weapons), ...pacing, swordsmen, crossbowmen, map, doctrines, budgetMul: three ? mul : [bm[0], bm[1] * mul], swordsmenByTeam, extras, extrasByTeam, era, formations, events,
    teams: three ? 3 : 2, dream: !!(wild || custom || three), ...systems, ...cmbOpts, ...trbOpts, ...(UIL >= 2 ? { ui: UIL } : {}), ...(rules.ui && rules.ui.art >= 2 ? { art: rules.ui.art } : {}), ...(rules.ui && rules.ui.anim ? { anim: true } : {}), ...(rules.ui && rules.ui.shine && rules.ui.shine.on ? { shine: rules.ui.shine } : {}), ...(rules.world && rules.world.on ? { world: rules.world } : {}),
    // the roster, classes, minds and pathfinding (each off when its rule is off, which keeps old seeds playing out as before)
    ...(roster ? { roster } : {}), ...(rules.classes && rules.classes.on ? { classes: rules.classes } : {}), ...(rules.minds && rules.minds.on ? { minds: rules.minds } : {}),
    ...(rules.nav && rules.nav.on ? { nav: rules.nav } : {}),
    // two or three titans in every army and the graveyard spell (rules.titans), troops fed by their own element (rules.affinity)
    ...(rules.titans && rules.titans.on ? { titans: rules.titans } : {}), ...(rules.affinity && rules.affinity.on ? { affinity: rules.affinity } : {}),
    // the merchant's spell book (rules.spells), expendable small troops (rules.expendable), and the cleaner battlefield and remains (rules.ui)
    ...(rules.spells && rules.spells.on ? { spells: rules.spells } : {}), ...(rules.expendable && rules.expendable.on ? { expendable: rules.expendable } : {}),
    ...(rules.ui && rules.ui.clean ? { clean: true } : {}), ...(rules.ui && rules.ui.remains ? { remains: true } : {}),
    // screen notices never stack on top of each other (rules.ui.noStack; looks only)
    ...(rules.ui && rules.ui.noStack ? { noStack: true } : {}),
    // fewer words on screen at once (rules.ui.calm; looks only)
    ...(rules.ui && rules.ui.calm && rules.ui.calm.on ? { calm: { floats: rules.ui.calm.floats ?? 2, live: rules.ui.calm.live ?? 3 } } : {}),
    // blood first: splatter, pools and spattered fighters instead of sparks and smoke (rules.ui.blood; looks only)
    ...(rules.ui && rules.ui.blood && rules.ui.blood.on ? { blood: rules.ui.blood } : {}),
    // little people instead of circles and triangles (rules.ui.humans; looks only)
    ...(rules.ui && rules.ui.humans ? { humans: true } : {}), ...(rules.ui && rules.ui.cineClean ? { cineClean: true } : {}), ...(NOTCH ? { notch: true } : {}), ...(rules.ui && rules.ui.cineLook ? { cineLook: true } : {}), ...(rules.ui && rules.ui.noRings ? { noRings: true } : {}),
    // the picks, with the holiday (Christmas snow) and which side defends a siege or is the boss (the mode's own dice)
    ...(PK ? { picks: Object.assign({}, PK, { on: true, holiday: HOL ? HOL.key : null }), pkSide: sideRoll < 0.5 ? 0 : 1 } : {}),
    // real-life damage (rules.realism, Rellz 2026-11-21): deadly guns, black holes that erase, limping wounded (battle logic, no dice)
    ...(rules.realism && rules.realism.on && process.env.REALISM !== '0' ? { realism: rules.realism } : {}) });
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
    // (TUNE_ONLY=1: pre-tune a line-up with more test battles and no time limit, print the result and stop; used to give new
    // line-ups a good starting size in rules.json before their first video)
    const pre = process.env.TUNE_ONLY === '1';
    const b = await C.tune(optsFor, { sims: pre ? Number(process.env.PRE_SIMS || 16) : combat.balanceBattles || 16, steps: pre ? Number(process.env.PRE_STEPS || 6) : combat.balanceSteps ?? 5, seed, start, spread: combat.balanceSpread || (mode === 'heroes' ? 2.6 : 2),
      maxMs: pre ? Infinity : (combat.balanceSeconds || 90) * 1000, log: console.log });
    wildMul = b.balance; wildRate = b.rate; tuned = b.balance;
    console.log(`Tuned ${balKey || 'creative match-up'}: bottom x${wildMul} on top of its usual size, top won ${(b.rate * 100).toFixed(0)}% of test battles (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    if (pre) { console.log('TUNE_RESULT ' + JSON.stringify({ top: sideName(mu.top), bottom: sideName(mu.bottom), mode: mode || 'classic', start: balOf(mu) ?? 1, tuned: b.balance, rate: b.rate })); process.exit(0); }
  } else if (combat && three && !invent3) {
    const b = await C.balance3(optsFor, { sims: tw.balanceBattles || 12, rounds: combat.balanceRounds3 || 4, seed, start: wildMul, log: console.log, maxMs: (combat.balanceSeconds || 90) * 1000 });
    wildMul = b.balance; wildRate = b.rates;
    console.log(`Three-way line-up ${sides.map(sideName).join(' vs ')}: sizes ${wildMul.join('/')} with combat on (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  } else if (three && invent3) {
    const b = await C.balance3(optsFor, { sims: tw.balanceBattles || 12, rounds: tw.balanceRounds || 6, seed, log: console.log, maxMs: (combat ? combat.balanceSeconds || 90 : 120) * 1000 });
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
  // ----- the audition (rules.quality.audition): with only a few videos a day, every one has to be a great battle. The same
  // line-up, map and size is fought out headless with several sets of battle dice, each battle is scored for drama (a real
  // final blow near the end, a narrow win, the lead changing hands, a comeback, titans falling, spells and events), and the
  // best one is the one that gets filmed. Deterministic: the same seed always auditions and picks the same way. -----
  const AUD = (rules.quality || {}).audition || 0;
  const drama = (opts, bs) => {
    const g = new RVB.Army(bs, opts), dd = new RVB.Director(g, { seed: bs }); g.noLate = true;
    const n0 = [0, 1].map(t => Math.max(1, g.units.filter(u => u.team === t && !RVB.UNIT[u.type].uncounted).length));
    let lead = 0, changes = 0, worst = [0, 0], sec = 0;
    for (let k = 0; g.phase === 'fight' && k < MAXFRAMES * 3; k++) {
      dd.advance(1 / FPS); g.sfx.length = 0;
      if (g.fightT >= sec) { sec += 1; const f = [0, 1].map(t => g.units.filter(u => u.team === t && !u.dead && !RVB.UNIT[u.type].uncounted).length / n0[t]), d = f[0] - f[1];
        const L = d > 0.08 ? 1 : d < -0.08 ? -1 : 0; if (L && lead && L !== lead) changes++; if (L) lead = L; worst[0] = Math.max(worst[0], -d); worst[1] = Math.max(worst[1], d); }
    }
    const kill = g.endHow === 'kill', alive = [0, 1].map(t => g.units.filter(u => u.team === t && !u.dead && !RVB.UNIT[u.type].uncounted).length), w = alive[0] >= alive[1] ? 0 : 1;
    const titans = g.units.filter(u => u.dead && RVB.isTitan(u.type)).length, spells = g.sp3 ? (g.sp3.fx || []).filter(f => /heal|rage|yard|splash|grow|dome|tornado|quake/.test(f.kind)).length : 0;
    const score = (kill ? 3 : 0) + Math.min(changes, 4) * 0.5 + Math.min(worst[w], 0.5) * 4 + (1 - alive[w] / n0[w]) * 1.5 + Math.min(titans, 4) * 0.25 + Math.min(spells, 6) * 0.12 - Math.abs(g.fightT - (VID.fightSeconds || 60) + 2) * 0.15;
    return { score, kill, changes, comeback: worst[w], left: alive[w], titans, spells, end: g.fightT };
  };
  let bseed = seed;
  if (AUD > 1 && process.env.AUDITION !== '0') {
    const ta = Date.now(), opts = optsFor(wildMul); let best = null;
    for (let k = 0; k < AUD; k++) {
      const bs = k ? (Math.imul(seed ^ 0x0A0D17, k * 2654435761) ^ (k << 16)) >>> 0 : seed, r = drama(opts, bs);
      console.log(`  audition ${k + 1}/${AUD}: drama ${r.score.toFixed(2)} (${r.kill ? 'final blow' : 'time'} at ${r.end.toFixed(1)} s, ${r.changes} lead changes, comeback ${(r.comeback * 100).toFixed(0)}%, ${r.left} left, ${r.titans} titans fell, ${r.spells} spells)`);
      if (!best || r.score > best.score) best = { ...r, bs };
      if (Date.now() - ta > ((rules.quality || {}).auditionSeconds || 240) * 1000) break;
    }
    bseed = best.bs;
    console.log(`Audition: picked battle dice ${bseed} (drama ${best.score.toFixed(2)}) in ${((Date.now() - ta) / 1000).toFixed(0)} s`);
    if (process.env.AUDITION_ONLY === '1') process.exit(0);
  }
  // (rules.coldOpen) how much happens in every frame of the battle, for the cold open's moment: kills, titans falling, blasts,
  // big hits (the camera's shake), and how many each side has left (so the moment never shows who's winning)
  const CO_R = rules.coldOpen || {}, coldOn = CO_R.on !== false && !process.env.SECS;
  const coldHeat = coldOn ? { list: [], see(g) {
    const al = g.alive.reduce((a, b) => a + b, 0), kills = this.al === undefined ? 0 : Math.max(0, this.al - al); this.al = al;
    const ld = g.lastDeath, titan = ld && ld !== this.ld && RVB.isTitan(ld.type) ? 1 : 0; this.ld = ld;
    const nb = (g.booms || []).length, booms = Math.max(0, nb - (this.nb || 0)); this.nb = nb;
    if (g.phase === 'fight') this.list.push([g.fightT, kills * 2 + titan * 10 + booms * 1.5 + Math.min(20, g.shakeAmt || 0) * 0.08, [0, 1, 2].map(t => ((g.alive[t] || 0) + (g.reserve[t] || 0)) / Math.max(1, g.start[t] || 0))]);
  } } : null;
  if (cinematic && OUTRO && VID.finale !== false) {
    const tf = Date.now(), pre = new RVB.Army(bseed, optsFor(wildMul)), pd = new RVB.Director(pre, { seed: bseed });
    pre.noLate = true;
    for (let k = 0; pre.phase === 'fight' && k < MAXFRAMES * 3; k++) { pd.advance(1 / FPS); pre.sfx.length = 0; if (coldHeat) coldHeat.see(pre); }
    const d = pre.lastDeath || {}, kill = pre.endHow === 'kill';
    finale = { t: pre.fightT, how: kill ? 'kill' : 'time', uid: kill ? d.uid : 0, by: kill ? d.by : 0, x: d.x, y: d.y };
    if (coldHeat) { coldHeat.endT = pre.fightT; coldHeat.winner = pre.winner; }
    console.log(`Finale: the battle ends at ${pre.fightT.toFixed(2)} s by ${kill ? `the final blow on a ${d.type}${d.byType ? ` by a ${d.byType}` : ''}` : 'time'} (found in ${((Date.now() - tf) / 1000).toFixed(0)} s)`);
  }
  if (process.env.DUMP_OPTS) { fs.writeFileSync(process.env.DUMP_OPTS, JSON.stringify({ bseed, opts: optsFor(wildMul) })); process.exit(0); }
  const game = new RVB.Army(bseed, optsFor(wildMul));
  // every troop type in this battle (saved in videos.jsonl, so freshness can pick the troops seen least)
  const unitsAtStart = [...new Set(game.units.filter(u => !RVB.UNIT[u.type].uncounted).map(u => u.type).concat(...(game.waves || []).flat().map(w => w.list || [])))];
  const director = cinematic ? new RVB.Director(game, { seed: bseed, finale }) : null;
  const CH_F = CHARGE && director ? Math.round(CHARGE.len * FPS) : 0, CH_S = CH_F / FPS;
  const synth = new RVB.Synth(SR, MAXFRAMES / FPS + 4 + IN_S + CH_S + 6);
  synth.reset(bseed);
  synth.variety = (rules.sound && rules.sound.variety) || 0;   // rules.json: how much each sound's pitch and volume vary (0 = off)
  const canvas = createCanvas(W * RS, H * RS);
  const ctx = canvas.getContext('2d');

  const silent = path.join(OUT, 'video-only.mp4');
  const enc = ffmpeg([
    '-f', 'rawvideo', '-pix_fmt', 'bgra', '-s', `${W * RS}x${H * RS}`, '-r', String(FPS), '-i', '-',
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
    // (constant 60 fps, every frame kept; a keyframe every 2 s; the bitrate cap scales with the picture)
    '-c:v', 'libx264', '-preset', (rules.quality || {}).preset || 'veryfast', '-crf', String((rules.quality || {}).crf || (RS > 1 ? 19 : 18)), '-maxrate', RS > 1 ? '45M' : '12M', '-bufsize', RS > 1 ? '90M' : '24M',
    '-profile:v', 'high', '-level', RS > 1 ? '5.2' : '4.2', '-g', String(FPS * 2), '-fps_mode', 'cfr',
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
  // ----- music (rules.music, music.js): an original soundtrack written from the seed in this era's style, following the battle.
  // The camera punches in on the beat in the last seconds of the fight, and the outro fades into the opening frame so the
  // Short's replay loops seamlessly. (Looks and sound only: the battle is the same with or without it.)
  const MU = rules.music || {}, muOn = MU.on !== false;
  const muStyle = { ancient: 'ancient', medieval: 'ancient', fantasy: 'ancient', pirate: 'ancient', modern: 'modern', ww2: 'modern', scifi: 'scifi', future: 'scifi' }[era] || 'epic';
  // (rules.picks.mapMusic: the map's own sound on top of the era's style; festive at Christmas)
  const mp = muOn ? Music.plan(seed, muStyle, Object.assign(PK && PK.mapMusic !== false ? { map, festive: !!(HOL && HOL.key === 'christmas') } : {}, MU.human ? { human: true } : {})) : null, mtr = muOn ? Music.tracker() : null;
  let firstCv = null;
  const FIGHT_S = VID.fightSeconds || 60;
  // ----- the cold open (rules.coldOpen, coldopen.js: the same file in Army Clash, Tower Clash and Territory Clash; Rellz
  // 2026-11-17: "make an improved intro system for all 3 games"): the best few seconds of this very battle, full screen with no
  // scoreboard, cards or words, before the face-off. It punches in on the action, slows into the peak, lands it with an impact
  // frame, freezes, then rewinds back to the start and flashes into the face-off (see coldopen.js). Played on a copy of the
  // battle (looks only: the battle is the same with or without it). -----
  let CO_F = 0;
  if (coldHeat && cinematic) {
    const ct0 = Date.now();
    if (coldHeat.endT === undefined) { const pre = new RVB.Army(bseed, optsFor(wildMul)), pd = new RVB.Director(pre, { seed: bseed }); pre.noLate = true;
      for (let k = 0; pre.phase === 'fight' && k < MAXFRAMES * 3; k++) { pd.advance(1 / FPS); pre.sfx.length = 0; coldHeat.see(pre); } coldHeat.endT = pre.fightT; coldHeat.winner = pre.winner; }
    const H0 = coldHeat.list, win = coldHeat.winner ?? 0;
    // never a moment where the eventual winner is clearly ahead (the cold open mustn't hint at the result)
    const spoil = t => { const e = H0.find(q => q[0] >= t); if (!e) return true; const fr = e[2], mine = fr[win], best = Math.max(...fr.filter((_, k) => k !== win && k < game.N)); return mine > best + 0.35; };
    const peakT = CO.pick(H0, { endT: coldHeat.endT, minT: 8, tail: 4, spoil });
    if (peakT != null) {
      const CT = CO.make({ fps: FPS, seconds: CO_R.seconds || 3.4, rewind: CO_R.rewind !== false });
      const g3 = new RVB.Army(bseed, optsFor(wildMul)); g3.noLate = true; g3.fixedTicks = true; g3.tickAcc = 0; g3.camEv = [];
      const t0 = Math.max(4, peakT - CT.lead);
      let q = 0; while (g3.phase === 'fight' && g3.fightT < t0 && q < MAXFRAMES * 3) { g3.frame(1 / FPS); g3.sfx.length = 0; q++; }
      // where the action is at the peak (another copy run up to it), so the camera is already heading there
      const hot = g => RVB.Director.prototype.hotspot.call({ g, cx: AR.x + AR.w / 2, cy: AR.y + AR.h / 2 });
      let pk = null;
      { const g4 = new RVB.Army(bseed, optsFor(wildMul)); g4.noLate = true; g4.fixedTicks = true; g4.tickAcc = 0; g4.camEv = []; let k = 0;
        while (g4.phase === 'fight' && g4.fightT < peakT && k < MAXFRAMES * 3) { g4.frame(1 / FPS); g4.sfx.length = 0; k++; }
        if (g4.phase === 'fight') pk = hot(g4); }
      if (g3.phase === 'fight') {
        const KS = CO_R.sharp || 1.5, big = createCanvas(Math.round(W * RS * KS), Math.round(H * RS * KS)), bx = big.getContext('2d');
        const aim = f => { const a = hot(g3); if (!pk) return a; const w = Math.max(0, Math.min(1, 1 - Math.abs(f - CO.PEAK) / 0.5)) * 0.6 + 0.4; return { x: a.x + (pk.x - a.x) * w, y: a.y + (pk.y - a.y) * w }; };
        const a0 = aim(0); g3.cam = { x: a0.x, y: a0.y, z: 1.4 }; g3.noUi = true;
        const dy = (rules.ui && rules.ui.layout >= 2) ? -90 : 0, ins = 8, k2 = RS * KS;
        const crop = { sx: (AR.x + ins) * k2, sy: (AR.y + dy + ins) * k2, sw: (AR.w - ins * 2) * k2, sh: (AR.h - ins * 2) * k2 };
        const cold = new CO.ColdOpen(ctx, { fps: FPS, seconds: CT.seconds, rewind: CT.rewind, seed });
        for (let j = 0; j < CT.n; j++) {
          const f = j / CT.n;
          if (CT.live(j)) {
            const fc = aim(f); g3.cam.x += (fc.x - g3.cam.x) * 0.07; g3.cam.y += (fc.y - g3.cam.y) * 0.07; g3.cam.z = 1.4 + 0.45 * Math.min(1, f / 0.5) * (2 - Math.min(1, f / 0.5));
            g3.floats.length = 0; g3.banners.length = 0;
            bx.setTransform(k2, 0, 0, k2, 0, 0); g3.draw(bx);
            cold.frame(j, big, crop);
          } else cold.frame(j, null, null);
          if (j === 0 && muOn && MU.loop !== false) { firstCv = createCanvas(W * RS, H * RS); firstCv.getContext('2d').drawImage(canvas, 0, 0); }
          if (process.env.COLD_STILLS && [3, Math.round(CT.n * 0.25), CT.peakJ, CT.peakJ + 2, Math.round(CT.n * 0.5), Math.round(CT.n * 0.7), Math.round(CT.n * 0.9), CT.n - 3].includes(j)) fs.writeFileSync(path.join(OUT, `still-cold-${String(j).padStart(3, '0')}.png`), canvas.toBuffer('image/png'));
          const frame = canvas.toBuffer('raw'); if (!enc.p.stdin.write(frame)) await once(enc.p.stdin, 'drain');
          nFrames++;
          if (CT.live(j)) { const sp = CT.speed(f); if (sp > 0) g3.frame(sp / FPS); for (const ev of g3.sfx) synth.play(ev, (j + 1) / FPS); g3.sfx.length = 0; }
        }
        CO.sounds(synth, 0, CT);
        CO_F = CT.n;
        console.log(`Cold open: ${CT.seconds.toFixed(1)} s, peak ${peakT.toFixed(1)} s into the battle, made in ${((Date.now() - ct0) / 1000).toFixed(0)} s`);
        if (process.env.COLD_ONLY) process.exit(0);
      }
    }
  }
  const CO_S = CO_F / FPS;
  // ----- the intro (rules.intro): the thumbnail's layout (logo, both armies' troops and counts, VS, WHO WINS?) over the
  // blurred opening battlefield, easing in with a slam, then a flash into the battle's first frame. Looks only: the battle
  // starts exactly as before, everything after it (sound, music, beat punches) is just shifted by the intro's length.
  if (INTRO_F && thumbLists) {
    const ids0 = three ? [0, 1, 2] : [0, 1];
    ctx.setTransform(RS, 0, 0, RS, 0, 0); game.draw(ctx);
    const battle0 = createCanvas(W * RS, H * RS); battle0.getContext('2d').drawImage(canvas, 0, 0);
    const bg1 = createCanvas(W, H); bg1.getContext('2d').drawImage(canvas, 0, 0, W, H);
    const nm = k => (k === 'NEWZEALAND' ? 'NEW ZEALAND' : k);
    const sides0 = ids0.map(i => ({ team: i, list: thumbLists[i] || [], label: RVB.docLabel(game.doc[i]), name: nm(pair[i]), count: game.start[i] }));
    const tag0 = three ? '1 v 1 v 1' : game.mode && RVB.MODE_HOOK[game.mode] ? RVB.MODE_HOOK[game.mode].replace(/!$/, '') : '';
    const card = createCanvas(W * RS, H * RS), cc = card.getContext('2d'); cc.scale(RS, RS);
    game.drawThumb(cc, bg1, sides0, { tag: tag0 });
    const ease = x => 1 - Math.pow(1 - x, 3);
    // two armies: the electric face-off (faceoff.js, shared with Tower Clash; Rellz 2026-11-15 "a face off animated with
    // electricity"): each army's hero in a ring in its colour, a lightning seam between them, VS, then a flash into the battle
    const FO = sides0.length >= 2 ? require('./faceoff.js') : null;
    // the champions are drawn live every frame so they can square up and taunt each other (Rellz, 2026-11-15:
    // "the two main opponents are facing off/taunting each other for 3 seconds"): the hero's own attack animation,
    // driven by the pose faceoff.js hands back. The battle is not stepped during any of this.
    const foSides = FO ? sides0.map((sd, n) => {
      const hero = game.thumbPicks(sd.list).hero, U = hero && RVB.UNIT ? RVB.UNIT[hero] : null;
      const live = hero ? (c, r, pose) => {
        const ur = (U && U.r) || 14, sc = r * 0.7 / ur, flip = n % 2 === 1;
        const fake = { fake: true, type: hero, team: sd.team, r: ur, x: 0, y: 0, face: -Math.PI / 2 + 0.5, mface: -Math.PI / 2 + 0.5,
          vx: 0, vy: 0, gait: n * 2.3, lunge: pose.lunge || 0, swing: pose.swing || 0, hp: 1, max: 1, cd: 1,
          heads: (U && U.heads) || 0, bodies: [], souls: 0, decoyEnd: 99, look: 'illusion', lives: 1, muzzle: 0, flying: !!(U && U.flying) };
        c.save(); c.translate(0, r * 0.04); c.rotate(flip ? -pose.lean : pose.lean); c.scale(flip ? -sc : sc, sc);
        const t0 = game.t, f0 = game.fightT; game.t = pose.t; game.fightT = pose.t;
        try { game.drawBody(c, fake, 0, 0, RVB.TEAMS[sd.team], !!(U && U.sword)); } catch (e) { /* no portrait */ }
        game.t = t0; game.fightT = f0; c.restore();
      } : null;
      return { col: RVB.TEAMS[sd.team], name: sd.label, sub: sd.name, count: sd.count ? `×${sd.count}` : '', portrait: live };
    }) : null;
    const fo = FO ? { W, H, RS, seed, dur: IN_S, title: NOTCH ? null : 'ARMY CLASH', tag: tag0, question: 'WHO WINS?', sides: foSides, bg: bg1, battle0 } : null;
    if (FO) FO.faceoffSounds(synth, IN_S, CO_S);
    else { synth.play({ type: 'boom', gain: 0.8 }, CO_S + 0.02); synth.play({ type: 'whoosh' }, CO_S + Math.max(0, IN_S - 0.35)); }
    for (let k = 0; k < INTRO_F; k++) {
      if (FO) {
        FO.drawFaceoff(ctx, k / FPS, fo);
        if (k === 0 && muOn && MU.loop !== false && !firstCv) { firstCv = createCanvas(W * RS, H * RS); firstCv.getContext('2d').drawImage(canvas, 0, 0); }
        if (process.env.INTRO_STILLS && [12, 60, 100, INTRO_F - 10].includes(k)) fs.writeFileSync(path.join(__dirname, 'out', `intro-${k}.png`), canvas.toBuffer('image/png'));
        const frame = canvas.toBuffer('raw'); if (!enc.p.stdin.write(frame)) await once(enc.p.stdin, 'drain');
        nFrames++; continue;
      }
      const t = k / FPS, z = 1.04 - 0.04 * ease(Math.min(1, t / 0.5)) + 0.025 * Math.max(0, t - 0.5) / IN_S;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#05070D'; ctx.fillRect(0, 0, W * RS, H * RS);
      ctx.save(); ctx.translate(W * RS / 2, H * RS / 2); ctx.scale(z, z); ctx.drawImage(card, -W * RS / 2, -H * RS / 2); ctx.restore();
      // the last 0.35 s: a white flash that opens onto the battle's first frame
      const out = (t - (IN_S - 0.35)) / 0.35;
      if (out > 0) { ctx.globalAlpha = ease(Math.min(1, out)); ctx.drawImage(battle0, 0, 0); ctx.globalAlpha = Math.max(0, 0.55 * (1 - Math.abs(out - 0.35) / 0.35)); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W * RS, H * RS); ctx.globalAlpha = 1; }
      if (k === 0 && muOn && MU.loop !== false && !firstCv) { firstCv = createCanvas(W * RS, H * RS); firstCv.getContext('2d').drawImage(canvas, 0, 0); }
      const frame = canvas.toBuffer('raw');
      if (!enc.p.stdin.write(frame)) await once(enc.p.stdin, 'drain');
      nFrames++;
    }
    if (mtr) mtr.frame(CO_S + IN_S, game);
    console.log(`Intro: ${IN_S.toFixed(2)} s electric face-off`);
  }
  // ----- the charge (rules.charge): both armies hold their lines (breathing, under film bars, READY…) while the camera eases in,
  // then CHARGE! slams in with the commander's war cry, his army shouting it back and a roar; the troops hop on the spot, and the
  // battle starts as the word rushes at the camera. The battle is not stepped here; everything after is shifted by its length.
  const PRE = CO_S + (INTRO_F && thumbLists ? IN_S : 0);
  if (CH_F) {
    const at = CHARGE.at, len = CH_S, cam = game.cam, x0 = cam.x, y0 = cam.y;
    const sm = x => x * x * (3 - 2 * x);
    // sound: a war horn as the lines hold, a drum roll building to the shout, the shout (one of the war cries in sfx/, picked
    // by the seed), a big boom and a whoosh as the armies set off
    for (const [f, t, d] of [[98, 0.05, 0.75], [147, 0.42, 0.55]]) synth.voice(PRE + t, { dur: d + 0.5, gain: 0.11, attack: 0.09, partials: [1, 2, 3, 4, 5, 6].map(h => ({ f: f * h, f2: f * h * 1.012, a: 1 / h, decay: d * 0.9 })) });
    for (let tr = 0.15; tr < at - 0.02; tr += Math.max(0.035, 0.16 - tr * 0.11)) synth.voice(PRE + tr, { dur: 0.08, gain: 0.05 + 0.13 * (tr / at), noise: { a: 1, decay: 0.025, lp: 0.45, hp: true } });
    synth.play({ type: 'boom', gain: 1.1 }, PRE + at);
    synth.play({ type: 'whoosh' }, PRE + len - 0.3);
    try {
      const wav = fs.readFileSync(path.join(__dirname, 'sfx', `charge-${1 + (seed % CHARGE.voices)}.wav`));
      // a plain 16-bit PCM wav at the synth's own rate (sfx/make_charge.py writes them)
      let o = 12; while (o < wav.length - 8 && wav.toString('ascii', o, o + 4) !== 'data') o += 8 + wav.readUInt32LE(o + 4);
      const ch = wav.readUInt16LE(22), n = wav.readUInt32LE(o + 4) / 2 / ch, s0 = Math.round((PRE + at - 0.04) * SR), g = 0.95;
      for (let i = 0; i < n && s0 + i < synth.len; i++) { synth.L[s0 + i] += wav.readInt16LE(o + 8 + i * 2 * ch) / 32768 * g; synth.R[s0 + i] += wav.readInt16LE(o + 8 + (i * ch + ch - 1) * 2) / 32768 * g; }
    } catch (e) { console.log('Charge: no war cry (' + e.message + ')'); synth.play({ type: 'roar' }, PRE + at); }
    for (let k = 0; k < CH_F; k++) {
      const t = k / FPS, kk = t - at;
      // the camera: a slow push in on the two lines, a punch on the shout, a little shake with the roar
      const punch = kk > 0 ? 0.085 * Math.exp(-kk * 6) * Math.cos(kk * 14) + 0.03 * sm(Math.min(1, kk / 0.4)) : 0;
      cam.x = x0; cam.y = y0; cam.z = 1 + 0.05 * sm(Math.min(1, t / at)) + punch;
      const sh = kk > 0 ? 7 * Math.exp(-kk * 4) : 0; game.shakeX = Math.sin(t * 57) * sh; game.shakeY = Math.cos(t * 49) * sh;
      game.must = { t, at, len }; game.cine.bars = Math.min(1, t / at);
      ctx.setTransform(RS, 0, 0, RS, 0, 0); game.draw(ctx); game.drawCharge(ctx, game.must);
      if (process.env.CHARGE_STILLS && [10, Math.round(at * FPS) - 10, Math.round(at * FPS) + 4, Math.round(at * FPS) + 20, CH_F - 8].includes(k)) fs.writeFileSync(path.join(OUT, `charge-${k}.png`), canvas.toBuffer('image/png'));
      const frame = canvas.toBuffer('raw'); if (!enc.p.stdin.write(frame)) await once(enc.p.stdin, 'drain');
      nFrames++;
    }
    game.must = null; game.shakeX = 0; game.shakeY = 0; director.fromCam();
    if (mtr) mtr.frame(PRE + CH_S, game);
    console.log(`Charge: ${CH_S.toFixed(2)} s stand-off, CHARGE! at ${at.toFixed(2)} s`);
  }
  const OFF = PRE + CH_S;
  const pkCalls = [], pkCrowd = [];
  let pkEndAt = null;
  // the slow-motion replay of the final kill (rules.picks.replay): the last moments of the fight are kept at half size, and as the
  // battle ends they play again at half speed over the start of the outro, then fade back; the video is no longer for it
  const RP = PK && PK.replay !== false ? { n: Math.round((PK.replaySecs ?? 0.8) * FPS), ring: [], at: -1, k: 0 } : null;
  let cliffed = false;
  for (let i = 0; i < MAXFRAMES; i++) {
    ctx.setTransform(RS, 0, 0, RS, 0, 0);
    const z0 = game.cam && game.cam.z, punch = muOn && MU.pulse !== false && game.cam && game.phase === 'fight' && game.fightT > FIGHT_S - 6 ? Music.pulse(mp, i / FPS + OFF) : 0;
    if (punch) game.cam.z = z0 * (1 + punch);
    game.draw(ctx);
    // defensive reset: clear any leaked canvas state from draw() so overlays are never invisible
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    if (punch) game.cam.z = z0;
    if (muOn && MU.loop !== false) {
      if (i === 0 && !firstCv) { firstCv = createCanvas(W * RS, H * RS); firstCv.getContext('2d').drawImage(canvas, 0, 0); }
      const left = game.phase === 'outro' && game.outroLen ? game.outroLen - game.outroT : 9;
      if (firstCv && left < 0.45 && !game.holdOutro) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = Math.min(1, (0.45 - left) / 0.4); ctx.drawImage(firstCv, 0, 0); ctx.globalAlpha = 1; }
    }
    // between 30% and 60% of the fight, twice a second: lots of troops on both sides, and neither side clearly ahead
    if (TH.on && game.phase === 'fight' && i % 30 === 0 && game.fightT > thumbEnd * 0.3 && game.fightT < thumbEnd * 0.6) {
      const al = [...Array(game.N).keys()].map(t => game.alive[t]), lo = Math.min(...al), hi = Math.max(...al, 1);
      const sc = (lo / hi) * al.reduce((a, b) => a + b, 0);
      if (sc > thumbScore) { thumbScore = sc; thumbBg = thumbBg || createCanvas(W, H); thumbBg.getContext('2d').drawImage(canvas, 0, 0, W, H); }
    }
    if (RP) {
      if (game.phase === 'fight' && game.fightT > FIGHT_S * 0.5) {
        // keep the last few frames (half size; the oldest canvas is reused)
        const c = RP.ring.length >= RP.n ? RP.ring.shift() : createCanvas(W * RS / 2, H * RS / 2);
        c.getContext('2d').drawImage(canvas, 0, 0, W * RS / 2, H * RS / 2); RP.ring.push(c);
      } else if (game.phase === 'outro' && RP.ring.length >= 4) {
        if (RP.at < 0) RP.at = i;
        const k = i - RP.at, len = RP.ring.length * 2, fade = 8;
        if (k < len + fade) {
          // half speed (each kept frame twice), a slow push in, film bars and a REPLAY tag, then a fade back to the outro
          const f = RP.ring[Math.min(RP.ring.length - 1, k >> 1)], a = k < len ? 1 : 1 - (k - len) / fade, z = 1 + 0.06 * Math.min(1, k / len);
          ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = a;
          ctx.drawImage(f, (W * RS - W * RS * z) / 2, (H * RS - H * RS * z) / 2, W * RS * z, H * RS * z);
          ctx.fillStyle = 'rgba(40,20,10,0.14)'; ctx.fillRect(0, 0, W * RS, H * RS);
          if (!(rules.ui && rules.ui.cineLook)) { const bar = 120 * RS; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W * RS, bar); ctx.fillRect(0, H * RS - bar, W * RS, bar); }
          ctx.setTransform(RS, 0, 0, RS, 0, 0); ctx.font = `800 54px ${RVB.FONT || 'sans-serif'}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
          const tx = 70, ty = 66; ctx.fillStyle = '#E11D48'; ctx.beginPath(); ctx.arc(tx, ty, 13 * (0.75 + 0.25 * Math.cos(k * 0.35)), 0, Math.PI * 2); ctx.fill();
          ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(8,11,20,0.9)'; ctx.strokeText('REPLAY', tx + 30, ty); ctx.fillStyle = '#FFFFFF'; ctx.fillText('REPLAY', tx + 30, ty);
          ctx.globalAlpha = 1; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
          if (k === 0) synth.play({ type: 'whoosh' }, (i + 0.5) / FPS + OFF);
        } else if (RP.ring.length) RP.ring.length = 0;
      }
    }
    const frame = canvas.toBuffer('raw');
    if (!enc.p.stdin.write(frame)) await once(enc.p.stdin, 'drain');
    nFrames++;
    // ----- the cliffhanger ending (rules.cliffhanger, cliffhanger.js, the same in all three games; Rellz 2026-11-21: "instead of
    // fully ending and saying game over just end at the cliff hanger and say subscribe"): just before the final blow lands (the
    // finale already knows when), the picture freezes and the Short ends on WHO WINS?! and SUBSCRIBE TO SEE THE ENDING. The
    // battle is then played on to its end without drawing, so the titles, description and records still know what happened. -----
    const CLR = rules.cliffhanger || {};
    // (rules.video.calmCam: no fast-forward, so the Short may run out before the battle does; then it ends on the cliffhanger right there)
    const outOfTime = CALM && director && game.phase === 'fight' && director.t >= FIGHT_S;
    if (CLR.on !== false && game.phase === 'fight' && (outOfTime || (finale && game.fightT >= finale.t - (finale.how === 'kill' ? (CLR.lead ?? 0.5) : (CLR.leadTime ?? 1.5))))) {
      const still = createCanvas(W * RS, H * RS); still.getContext('2d').drawImage(canvas, 0, 0);
      const C = new Cliff({ W, H, RS, fps: FPS, seed: bseed, seconds: CLR.seconds || 3.4, question: game.N === 3 ? 'WHO SURVIVES?!' : 'WHO WINS?!', cta: ['SUBSCRIBE', 'TO SEE THE ENDING'] });
      C.sounds(synth, (i + 1) / FPS + OFF);
      for (let j = 0; j < C.n; j++) { C.frame(ctx, j, still); const fr = canvas.toBuffer('raw'); if (!enc.p.stdin.write(fr)) await once(enc.p.stdin, 'drain'); nFrames++; }
      cliffed = true;
      for (let k = 0; !game.finished && k < MAXFRAMES * 3; k++) { if (director) director.advance(1 / FPS); else game.frame(1 / FPS); game.sfx.length = 0; }
      console.log(`cliffhanger: froze ${(finale.t - (game.lastFightT ?? game.fightT)).toFixed(2)} s before the end (${game.headline || ''})`);
      break;
    }
    // the video ends when the outro does (outroSeconds after the battle), or at the fixed length
    if (OUTRO && game.finished) break;
    if (director) director.advance(1 / FPS); else game.frame(1 / FPS);
    const off = OFF;
    for (const ev of game.sfx) {
      // the commentator's cues and the crowd's swells are kept for the mix after the battle (commentary.js)
      if (ev.type === 'pk_call') { pkCalls.push({ t: (i + 1) / FPS + off, kind: ev.kind }); continue; }
      if (ev.type === 'pk_crowd') { pkCrowd.push({ t: (i + 1) / FPS + off, k: ev.k || 1 }); continue; }
      synth.play(ev, (i + 1) / FPS + off);
    }
    if (PK && game.phase !== 'fight' && pkEndAt == null && game.fightT > 1) { pkEndAt = (i + 1) / FPS + off; pkCalls.push({ t: pkEndAt, kind: 'end' }); }
    if (mtr) mtr.frame((i + 1) / FPS + off, game);
    game.sfx.length = 0;
    if ((i + 1) % (FPS * 6) === 0) console.log(`frame ${i + 1} (${((i + 1) / FPS).toFixed(0)} s of video) after ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
  const DUR = nFrames / FPS;
  enc.p.stdin.end();
  await enc.done;

  // Sound: the match's sound effects, soft-limited, exactly as long as the video.
  const frames = Math.round(SR * DUR);
  const gain = game.audioGain || 1;
  // the commentator and the crowd (rules.picks), into the effects before they're limited
  // (rules.picks.general, Rellz 2026-11-21: "make the voice sound like a war general and have a fade and blend in with the music")
  // the war general on a bus of its own, faded in and out, sent into a hall like the music's and landed on the beat; the music
  // dips smoothly under each line (music.js mix: voice, dips) instead of being chopped by the effects' ducking
  const GEN = PK && PK.general && PK.general.on ? PK.general : null, vBus = GEN ? { L: new Float32Array(synth.L.length), R: new Float32Array(synth.R.length) } : null, vDips = GEN ? [] : null;
  if (PK && (PK.commentator !== false || PK.crowd !== false)) {
    const said = Commentary.mix(synth.L, synth.R, { sr: SR, cues: PK.commentator !== false ? pkCalls : [], crowd: pkCrowd, seed, startAt: OFF + 1, endAt: Math.min(DUR, (pkEndAt ?? DUR) + 2.5),
      bed: PK.crowd !== false ? (PK.crowdBed ?? 0.075) : 0, voice: GEN ? (GEN.voice ?? 0.7) : PK.voice ?? 0.62, max: PK.maxCalls ?? 8, gap: PK.callGap ?? 6,
      ...(GEN ? { lines: 'general', bus: vBus, fade: GEN.fade || [0.04, 0.25], wet: GEN.wet ?? 0.22, soft: !!GEN.soft, beat: mp && GEN.onBeat !== false ? mp.beat : 0, dips: vDips } : {}) });
    console.log(`Commentator: ${said.length ? said.join(', ') : 'quiet'}; crowd ${PK.crowd !== false ? `on, ${pkCrowd.length} swells` : 'off'}`);
  }
  const L = new Float32Array(frames), R = new Float32Array(frames);
  const vIn = vBus && !muOn ? vBus : null;   // (no music: the general goes straight in with the effects)
  for (let i = 0; i < frames; i++) { L[i] = Math.tanh((synth.L[i] + (vIn ? vIn.L[i] : 0)) * gain); R[i] = Math.tanh((synth.R[i] + (vIn ? vIn.R[i] : 0)) * gain); }
  let mixed = { L, R };
  if (muOn) {
    const cues = mtr.cues(), mus = Music.render(mp, { sr: SR, dur: DUR, cues });
    mixed = Music.mix(L, R, mus, { sr: SR, volume: MU.volume ?? 0.45, duck: MU.duck ?? 0.45, levels: MU.levels || null,
      ...(vBus ? { voice: { L: vBus.L.map(v => v * gain), R: vBus.R.map(v => v * gain) }, dips: vDips, dipDb: GEN.dipDb ?? -6 } : {}) });
    // (the cliffhanger: the sound fades away over the last moments instead of being cut off)
    if (cliffed) { const fo = Math.round(SR * 0.9); for (let k = 0; k < fo; k++) { const f = frames - fo + k, g = 1 - k / fo; if (f >= 0) { mixed.L[f] *= g * g; mixed.R[f] *= g * g; } } }
    console.log(`Music: ${muStyle}${mp.theme ? ` (${mp.theme} theme)` : ''}${mp.human ? ', human' : ''}, ${mp.bpm} bpm, the drop at ${mus.drop.toFixed(1)} s, the final hit at ${mus.fin.toFixed(1)} s`);
  }
  const wav = path.join(OUT, 'sound.wav');
  writeWav(wav, mixed.L, mixed.R, frames);

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
    cliff: cliffed,
    teams: pair, nations: nationBattle ? NATION : null, flags: FLAG, docs: game.doc, start: game.start.slice(0, ids.length),
    left: ids.map(t => game.alive[t] + game.reserve[t]), gained: ids.map(t => (game.gained && game.gained[t]) || 0), winner: game.winner,
    low: Fx.low, falls: Fx.falls || [], drops: Fx.drops || [], strike: Fx.strike, hazard: Fx.hazard, wild: wild || custom || (three && invent3), three, clickbait, seed,
    xf: game.xf || {}, world: game.worldLog || [], label: RVB.labelOf, mvp: game.best && game.best[game.winner],
    mode: game.mode || undefined, heroes: mode === 'heroes' ? heroTeam : undefined, skins: skinNames, tribes: tf,
    recent: pastVideos.slice(-12).map(v => v.title), eras: three ? null : eras,
  });
  const hook = title;
  const MAP_NAME = { open: 'open field', rocks: 'rocky field', ruins: 'ruins', trenches: 'trenches', city: 'city rooftops', forest: 'forest', bombed: 'bombed city', enchanted: 'fantasy land', canyon: 'canyon',
    godboard: 'Godboard (a giant chessboard)', furnace: 'World Furnace (lava)', frozen: 'Frozen End (ice)', grave: "Titan's Grave", overgrown: 'Overgrown Kingdom', clockwork: 'Clockwork Colosseum', shattered: 'Shattered Sky (floating islands)', mirror: 'Mirror Dimension', castle: 'Castle Siege',
    beach: 'Pirate Beach', snow: 'Snowy Pass', dunes: 'Dune Sea', swamp: 'Murk Swamp', neon: 'Neon City', temple: 'Sky Temple', graveyard: 'Haunted Graveyard', moon: 'Moon Base',
    rainbow: 'Rainbow Skyway (a rainbow road in space)', pyramid: 'Pyramid Sands (quicksand and sandstorms)', cloud: 'Cloud Kingdom (islands in the sky)', candy: 'Candy Hills', jungle: 'Snapjaw Jungle', airship: 'Storm Galleon (a flying ship)', galaxy: 'Starfall Orbit (low gravity)' };
  // battle modes, said plainly in the description
  const MODE_LINE = { king: 'Protect the King: each army has a king at the back, behind a royal shield for the first part of the battle; an army whose king falls loses heart (weaker and slower) for the rest of the fight.',
    duel: 'Champion Duel: each army\'s best fighter duels in the middle first while both armies watch, then everyone charges.',
    heroes: `Last Stand: one army is a small band of heroes (far stronger fighters, gold rings) against a full army.`,
    mirror: 'Mirror Match: the same army on both sides, told apart by colour and look.',
    hill: `King of the Hill: the army with more troops on the hill in the middle takes it and hits 25% harder while it holds it${PK && PK.hillScore !== false ? `; the first army to hold it for ${PK.hillTarget ?? 25} seconds wins` : ''}.`,
    tug: 'Tug of War: a rope across the middle; every troop near it pushes the knot toward the enemy, and the army that gets it past the other\'s line wins.',
    siege: 'Siege: one army defends a castle wall with a gate in the middle; the other has to break the gate (or the wall) to get at them.',
    boss: 'Boss Fight: one army is a single giant boss champion with a small guard, against a whole crowd.' };
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
  // the standout troops of this battle and what they do (the costliest few), for viewers and search: "Watch for: ..."
  const standout = [...new Set(unitsAtStart)].filter(k => RVB.UNIT[k] && !RVB.UNIT[k].uncounted && RVB.specOf(k) && !['FIGHTS', 'SHOOTS'].includes(RVB.specOf(k)))
    .sort((a, b) => (RVB.UNIT[b].cost || 0) - (RVB.UNIT[a].cost || 0) || (a < b ? -1 : 1)).slice(0, 3);
  const watchFor = standout.length ? ` Watch for: ${standout.map(k => `the ${titleCase(RVB.labelOf(k).replace(/^THE /, ''))} (${RVB.specOf(k).toLowerCase()})`).join(', ')}.` : '';
  // the troop classes on each side (rules.classes), in plain words
  const classLine = rules.classes && rules.classes.on ? ' Troop classes: ' + ids.map(i => {
    const types = Object.keys(game.doc[i].mix || {}).concat(game.doc[i].heavy || []).filter(k => RVB.UNIT[k]);
    const cl = [...new Set(types.map(k => RVB.classOf(k)[0]))].map(c => titleCase(RVB.CLASSES[c].plural));
    return `${ns[i]}: ${cl.join(', ')}`;
  }).join(' · ') + '.' : '';
  const unique = (list) => [...new Set(list)];
  // a related video in every description (Rellz, 2026-11-10: "always add related videos"). YouTube's own "related video" link on
  // a Short can only be set in YouTube Studio, not through the upload API, so the description links one instead: one of the last
  // 36 videos, preferring one with a tribe or army from this battle ("their last battle"), then the most viewed (stats/views.json,
  // once the stats run), then the newest.
  const related = (() => {
    let views = {};
    try { for (const v of JSON.parse(fs.readFileSync(path.join(__dirname, 'stats', 'views.json'), 'utf8'))) if (v.id) views[v.id] = v.views || 0; } catch (e) { /* no stats yet */ }
    const mine = new Set([...(tf ? tf.tribes.map(x => x.name) : []), ...game.doc.map(d => d.name)]);
    const shares = v => (v.tribes || []).some(x => mine.has(x.name)) || (!v.wild && (v.armies || []).some(a => mine.has(a)));
    const list = pastVideos.slice(-36).map((v, i) => ({ v, i })).filter(({ v }) => v.id && /^[\w-]{6,}$/.test(v.id));
    if (!list.length) return null;
    list.sort((a, b) => (shares(b.v) - shares(a.v)) || ((views[b.v.id] || 0) - (views[a.v.id] || 0)) || (b.i - a.i));
    const best = list[0].v;
    return { id: best.id, title: best.title, kin: shares(best) && !!(tf && (best.tribes || []).some(x => mine.has(x.name))) };
  })();
  const relatedLine = related ? `▶ ${related.kin ? 'Their last battle' : 'Watch next'}: ${related.title} https://youtube.com/shorts/${related.id}` : null;
  const meta = {
    seed,
    seconds: +DUR.toFixed(2),
    title: Holiday.title(HOL, title),
    description: [
      `⚔️ ${ids.map(i => `${EMOJI[pair[i]] || ''}${who(i)}${three ? '' : `${formations[i]} formation, `}${game.start[i]} troops)`).join(' vs ')} ⚔️`,
      '',
      `💬 Who wins? Drop your pick in the comments BEFORE the battle ends!`,
      '',
      `${ids.map(i => `${EMOJI[pair[i]] || ''}${showNames ? armyName(i) : `${ns[i]} ${armyName(i)}`}`).join(' vs ')} — a ${Math.round(DUR)}-second ${three ? 'three-way ' : ''}${GENRE[era] || ''}army battle simulation on the ${MAP_NAME[map] || map} map. Pure strategy and chance — no real footage. Every troop has its own class, tactics and personality.${game.mode && MODE_LINE[game.mode] ? ' ' + MODE_LINE[game.mode] : ''}${classLine}`,
      ...(tribeLine ? ['', `🏴 ${tribeLine}`] : []),
      '',
      `🔔 New battle every day on Army Clash · Tower Clash · Territory Clash — subscribe and hit the bell!`,
      '',
      `#shorts #armyclash #battlesimulation #epicbattle #${ns.map(n => n.toLowerCase().replace(/ /g, '')).join('vs')}${three ? ' #1v1v1' : ''}${era !== 'mixed' ? ` #${era}battle` : ''} #whowins #strategy #clashuniverse`,
    ].join('\n'),
    tags: clickbait ? [] : unique([
      `${ns[0].toLowerCase()} vs ${ns[1] ? ns[1].toLowerCase() : ''}`,
      'army battle', 'battle simulation', 'army simulation', 'who wins', 'army clash', 'epic battle', 'strategy game',
      'battle royale', 'military simulation', 'army vs army', 'troop simulation', 'unit battle', 'troop battle',
      ids.map(i => (showNames ? armyName(i) : `${ns[i]} ${armyName(i)}`).toLowerCase()).join(' vs '),
      'shorts', 'short video', 'viral shorts', 'clash game', 'clash universe',
    ]
      .concat(HOL ? HOL.tags : [])
      .concat(three ? ['1v1v1', 'three way battle', '3 armies'] : [])
      .concat(tf ? ['tribes', 'tribal war', 'war economy'] : [])
      .concat({ king: ['protect the king', 'king battle'], duel: ['champion duel', '1v1 duel', 'hero battle'], heroes: ['last stand', 'heroes vs army', 'underdog battle'], mirror: ['mirror match', 'same army'], hill: ['king of the hill', 'hill battle'] }[game.mode] || [])
      .concat({ modern: ['modern warfare', 'modern army', 'guns vs tanks'], fantasy: ['fantasy battle', 'dragon', 'fantasy army', 'wizard battle'], mixed: ['old vs new', 'swords vs guns', 'ancient vs modern'], scifi: ['sci fi battle', 'robots vs soldiers', 'future war'], pirate: ['pirate battle', 'pirates', 'sea battle'],
        horror: ['zombie battle', 'zombies vs soldiers', 'undead army'], samurai: ['samurai battle', 'ninja', 'feudal japan battle'], wild: wild || custom || three ? ['dream team', 'crazy matchup', 'custom army'] : ['crossover battle', 'crazy matchup'] }[era] || [])
      .concat(heavyIn('tank') ? ['tank battle', 'tank vs infantry'] : []).concat(heavyIn('dragon') ? ['dragon battle', 'fantasy dragon'] : []).concat(heavyIn('mech') ? ['mech battle', 'giant robot'] : [])
      .concat(standout.map(k => RVB.labelOf(k).replace(/^THE /, '').toLowerCase()))
      .concat(rules.classes && rules.classes.on ? [...new Set(unitsAtStart.filter(k => RVB.UNIT[k] && !RVB.UNIT[k].uncounted).map(k => RVB.CLASSES[RVB.classOf(k)[0]].plural.toLowerCase()))].slice(0, 4) : [])
    ).slice(0, 30),
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
    related: related ? related.id : undefined,
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
  if (HOL) meta.description = `${HOL.emoji} ${HOL.line}\n\n${meta.description}`.slice(0, 4900);
  fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify(meta, null, 2));
  // the thumbnail: out/thumb.jpg (upload.js sets it on the video when YouTube allows it)
  if (TH.on && thumbLists) {
    const tc = createCanvas(W, H), tctx = tc.getContext('2d');
    const sides = ids.map(i => ({ team: i, list: thumbLists[i] || [], label: RVB.docLabel(game.doc[i]), name: ns[i].toUpperCase(), count: game.start[i] }));
    const tag = three ? '1 v 1 v 1' : game.mode && RVB.MODE_HOOK[game.mode] ? RVB.MODE_HOOK[game.mode].replace(/!$/, '') : '';
    if (!thumbBg) { thumbBg = createCanvas(W, H); thumbBg.getContext('2d').drawImage(canvas, 0, 0, W, H); }
    game.drawThumb(tctx, thumbBg, sides, { tag });
    fs.writeFileSync(path.join(OUT, 'thumb.jpg'), tc.toBuffer('image/jpeg', { quality: 0.9 }));
  }
  const mb = (fs.statSync(final).size / 1048576).toFixed(1);
  console.log(`Done in ${((Date.now() - t0) / 1000).toFixed(0)} s: ${final} (${mb} MB, ${DUR.toFixed(1)} s long, battle ended at ${game.fightT.toFixed(1)} s) | ${meta.title} | ${game.headline}, ${game.detail}`);
  if (director) console.log(`Camera: ${director.shots.map(x => `${x.kind}@${x.t}`).join(' ')}`);
}

main().catch(err => { console.error(err); process.exit(1); });
