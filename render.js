// Renders one 60-second Army Clash Short (team colours from rules.json): 1080x1920, 60 fps, H.264 + AAC sound.
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
const { makeTitle } = require('./titles.js');
RVB.makeCanvas = (w, h) => createCanvas(w, h);

const FPS = 60, SECS = 60, TOTAL = FPS * SECS, W = 1080, H = 1920, SR = 48000;
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
const mu = three
  ? (invent3 ? C.invent3(seed) : lineups3[Math.floor(posted / Math.max(1, tw.every || 4) / 2) % lineups3.length])
  : wild ? C.invent(seed) : matchups.length ? matchups[listSlot % matchups.length] : null;
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
const budgetMul = !mu ? undefined : three ? (mu.balance || [1, 1, 1]) : [1, mu.balance ?? 1];
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
  const optsFor = mul => ({ target: SECS, fixedLength: SECS, swordsmen, crossbowmen, map, doctrines, budgetMul: three ? mul : [bm[0], bm[1] * mul], swordsmenByTeam, extras, extrasByTeam, era, formations, events,
    teams: three ? 3 : 2, ...systems });
  // a creative match-up is new, so balance it now with quick test battles on this map and these formations
  let wildMul = three ? bm.slice(0, 3) : 1, wildRate = null;
  if (three && invent3) {
    const b = await C.balance3(optsFor, { sims: tw.balanceBattles || 12, rounds: tw.balanceRounds || 6, seed, log: console.log });
    wildMul = b.balance; wildRate = b.rates;
    console.log(`Three-way creative match-up ${mu.three.map(x => x.name).join(' vs ')}: sizes ${wildMul.join('/')}, wins ${b.rates.map(x => (x * 100).toFixed(0) + '%').join('/')} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  } else if (wild && !three) {
    const b = await C.balance(optsFor, { sims: creative.balanceBattles || 8, steps: creative.balanceSteps || 6, seed, log: console.log });
    wildMul = b.balance; wildRate = b.rate;
    console.log(`Creative match-up ${mu.top.name} vs ${mu.bottom.name}: bottom army x${wildMul}, top won ${(b.rate * 100).toFixed(0)}% of test battles (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
  const game = new RVB.Army(seed, optsFor(wildMul));
  // the cinematic director: camera moves, close-ups and slow motion (rules.cinematic, on unless set to false)
  const cinematic = rules.cinematic !== false && process.env.CINEMATIC !== '0';
  const director = cinematic ? new RVB.Director(game, { seed }) : null;
  const synth = new RVB.Synth(SR, SECS + 4);
  synth.reset(seed);
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

  for (let i = 0; i < TOTAL; i++) {
    game.draw(ctx);
    const frame = canvas.toBuffer('raw');
    if (!enc.p.stdin.write(frame)) await once(enc.p.stdin, 'drain');
    if (director) director.advance(1 / FPS); else game.frame(1 / FPS);
    for (const ev of game.sfx) synth.play(ev, (i + 1) / FPS);
    game.sfx.length = 0;
    if ((i + 1) % (FPS * 6) === 0) console.log(`frame ${i + 1}/${TOTAL} (${(((i + 1) / TOTAL) * 100).toFixed(0)}%) after ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
  enc.p.stdin.end();
  await enc.done;

  // Sound: the match's sound effects, soft-limited, exactly 60 seconds.
  const frames = SR * SECS;
  const gain = game.audioGain || 1;
  const L = new Float32Array(frames), R = new Float32Array(frames);
  for (let i = 0; i < frames; i++) { L[i] = Math.tanh(synth.L[i] * gain); R[i] = Math.tanh(synth.R[i] * gain); }
  const wav = path.join(OUT, 'sound.wav');
  writeWav(wav, L, R, frames);

  const final = path.join(OUT, 'army-clash.mp4');
  await ffmpeg(['-i', silent, '-i', wav, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-t', String(SECS), '-movflags', '+faststart', final]).done;
  fs.rmSync(silent); fs.rmSync(wav);

  // nations keep their usual short names (UK, USA); colours are title-cased
  const NATION = { UK: 'UK', USA: 'USA', FRANCE: 'France', GERMANY: 'Germany', ITALY: 'Italy', BRAZIL: 'Brazil', ARGENTINA: 'Argentina', CANADA: 'Canada', SPAIN: 'Spain', PORTUGAL: 'Portugal',
    AUSTRALIA: 'Australia', NEWZEALAND: 'New Zealand', NETHERLANDS: 'Netherlands', BELGIUM: 'Belgium', SWEDEN: 'Sweden', NORWAY: 'Norway' };
  const FLAG = { UK: '🇬🇧', USA: '🇺🇸', FRANCE: '🇫🇷', GERMANY: '🇩🇪', ITALY: '🇮🇹', BRAZIL: '🇧🇷', ARGENTINA: '🇦🇷', CANADA: '🇨🇦', SPAIN: '🇪🇸', PORTUGAL: '🇵🇹',
    AUSTRALIA: '🇦🇺', NEWZEALAND: '🇳🇿', NETHERLANDS: '🇳🇱', BELGIUM: '🇧🇪', SWEDEN: '🇸🇪', NORWAY: '🇳🇴' };
  const EMOJI = { RED: '🔴', BLUE: '🔵', GREEN: '🟢', PURPLE: '🟣', ORANGE: '🟠', YELLOW: '🟡', PINK: '🩷', CYAN: '🩵', WHITE: '⚪', BROWN: '🟤',
    LIME: '💚', TEAL: '🌊', GOLD: '🥇', SILVER: '🥈', INDIGO: '🫐', CORAL: '🪸', ...FLAG };
  const teamName = k => NATION[k] || titleCase(k);
  const ns = pair.map(teamName), [n0, n1] = ns;
  const armyName = i => titleCase(game.doc[i].name);
  const red = `${n0} ${armyName(0)}`, blue = `${n1} ${armyName(1)}`;
  // Clickbait slots (rules.clickbait.every): a short teaser about something that really happened, with no team names, hashtags or tags.
  const cbEvery = (rules.clickbait && rules.clickbait.every) || 0;
  const clickbait = process.env.CLICKBAIT === '1' || (!forced && cbEvery > 1 && slot % cbEvery === Math.floor(cbEvery / 2));
  const ids = three ? [0, 1, 2] : [0, 1];
  const Fx = game.facts || {};
  const nationBattle = pair.every(k => NATION[k]);
  const { title, kind: titleKind } = makeTitle({
    teams: pair, nations: nationBattle ? NATION : null, flags: FLAG, docs: game.doc, start: game.start.slice(0, ids.length),
    left: ids.map(t => game.alive[t] + game.reserve[t]), gained: ids.map(t => (game.gained && game.gained[t]) || 0), winner: game.winner,
    low: Fx.low, falls: Fx.falls || [], drops: Fx.drops || [], strike: Fx.strike, hazard: Fx.hazard, wild: wild || custom || (three && invent3), three, clickbait, seed,
  });
  const hook = title;
  const MAP_NAME = { open: 'open field', rocks: 'rocky field', ruins: 'ruins', trenches: 'trenches', city: 'city rooftops', forest: 'forest', bombed: 'bombed city', enchanted: 'fantasy land' };
  const GENRE = { modern: 'modern warfare ', fantasy: 'fantasy ', mixed: 'old vs new ', scifi: 'sci-fi ', pirate: 'pirate ', horror: 'zombie ', samurai: 'samurai ', wild: 'mixed-genre ' };
  // custom teams get their own names in the title ("Storm Mages vs Dragon Bones"); army types stay in the description otherwise
  const showNames = era === 'wild';
  const who = i => `${showNames ? armyName(i) : `${ns[i]} ${armyName(i)}`} (${showNames ? `${C.describeSide(game.doc[i])}, ` : ''}`;
  const heavyIn = k => game.doc.some(d => d[k] || (d.heavy || []).includes(k));
  const unique = (list) => [...new Set(list)];
  const meta = {
    seed,
    title,
    description: [
      `${ids.map(i => `${EMOJI[pair[i]] || ''} ${who(i)}${three ? '' : `${formations[i]} formation, `}${game.start[i]} units)`).join(' vs ')}. Who wins? Pick your side and tell us in the comments before the end.`,
      '',
      `A 60-second ${three ? 'three-way (1v1v1) ' : ''}${GENRE[era] || ''}battle simulation on the ${MAP_NAME[map] || map} map${showNames ? `, ${ns.join(' vs ')}` : ''}. The outcome comes from the game's rules and chance, not real footage.`,
      '',
      'Subscribe for a new battle every day.',
      '',
      `#shorts #${ns.map(n => n.toLowerCase().replace(/ /g, '')).join('vs')} #battlesimulation${three ? ' #1v1v1' : ''}`,
    ].slice(0, clickbait ? 5 : 7).join('\n'),
    tags: clickbait ? [] : unique([ns.map(n => n.toLowerCase()).join(' vs '), 'army battle', 'battle simulation', 'army simulation', 'who wins', 'army clash', ids.map(i => (showNames ? armyName(i) : `${ns[i]} ${armyName(i)}`).toLowerCase()).join(' vs '), 'shorts']
      .concat(three ? ['1v1v1', 'three way battle'] : [])
      .concat({ modern: ['modern warfare'], fantasy: ['fantasy battle', 'dragon'], mixed: ['old vs new', 'swords vs guns'], scifi: ['sci fi battle', 'robots', 'lasers'], pirate: ['pirate battle', 'pirates'],
        horror: ['zombie battle', 'zombies'], samurai: ['samurai battle', 'ninja'], wild: ['dream team', 'crazy matchup'] }[era] || [])
      .concat(heavyIn('tank') ? ['tank battle'] : []).concat(heavyIn('dragon') ? ['dragon'] : []).concat(heavyIn('mech') ? ['mech'] : [])),
    teams: pair,
    troops,
    era,
    map,
    formations,
    armies: game.doc.map(d => d.name),
    sides: doctrines,
    wild: wild || (three && invent3) || undefined,
    three: three || undefined,
    titleKind,
    balance: wild || (three && invent3) ? wildMul : mu ? mu.balance : undefined,
    cinematic,
    hook,
    clickbait: clickbait || undefined,
    slot,
    winner: game.headline,
  };
  fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify(meta, null, 2));
  const mb = (fs.statSync(final).size / 1048576).toFixed(1);
  console.log(`Done in ${((Date.now() - t0) / 1000).toFixed(0)} s: ${final} (${mb} MB) | ${meta.title} | ${game.headline}, ${game.detail}`);
  if (director) console.log(`Camera: ${director.shots.map(x => `${x.kind}@${x.t}`).join(' ')}`);
}

main().catch(err => { console.error(err); process.exit(1); });
