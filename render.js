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
const pair = weighted(rules.teamPairs).teams.slice();
if (pick.next() < 0.5) pair.reverse();
RVB.setTeams(pair[0], pair[1]);
// Troop line-up: not random. Videos go through rules.matchups in order, one per video,
// using how many videos are already in uploads.md to know where we are in the list.
const posted = fs.existsSync(path.join(__dirname, 'uploads.md'))
  ? (fs.readFileSync(path.join(__dirname, 'uploads.md'), 'utf8').match(/^\| \d{4}-/gm) || []).length : 0;
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
const mu = wild ? C.invent(seed) : matchups.length ? matchups[listSlot % matchups.length] : null;
// era (genre) comes from the two sides: 'medieval', 'modern', 'fantasy', 'scifi', 'pirate', 'horror', 'samurai',
// 'mixed' when two army types come from different genres, 'wild' for teams that mix genres themselves
const eras = mu ? [RVB.eraOf(mu.top), RVB.eraOf(mu.bottom)] : ['medieval', 'medieval'];
const custom = !!mu && (typeof mu.top === 'object' || typeof mu.bottom === 'object');
// two genres from different times (knights vs tanks) are an "old vs new" battle; other mixes (zombies vs infantry) count as wild match-ups
const OLD = ['medieval', 'fantasy', 'samurai', 'pirate'], NEW = ['modern', 'scifi'];
const oldVsNew = (OLD.includes(eras[0]) && NEW.includes(eras[1])) || (OLD.includes(eras[1]) && NEW.includes(eras[0]));
const era = wild || (custom && !(eras[0] === eras[1] && eras[0] !== 'mixed')) ? 'wild' : eras[0] === eras[1] ? eras[0] : oldVsNew ? 'mixed' : 'wild';
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
const doctrines = mu ? [mu.top, mu.bottom] : undefined;
// balance: bottom army size relative to the top, tuned so each match-up is close to 50/50.
const budgetMul = mu ? [1, mu.balance ?? 1] : undefined;
// Maps rotate too, among the ones allowed for this era (see rules.maps).
const mapList = (rules.maps || [{ name: 'open' }]).filter(m => !m.eras || m.eras.includes(era));
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
  const style = (name, i) => (eras[i] === 'medieval' && !(doctrines && typeof doctrines[i] === 'object') ? styles[name] : null);
  const swordsmenByTeam = pair.map((name, i) => (style(name, i) && style(name, i).swordsmenShare !== undefined) ? style(name, i).swordsmenShare : swordsmen);
  // a style's budget scales that army's size so the style stays fair (tested over many battles)
  const bm = (budgetMul || [1, 1]).map((v, i) => v * ((style(pair[i], i) && style(pair[i], i).budget) || 1));
  // formationBudget: slightly smaller armies for formations that tested stronger than a line, bigger for weaker ones
  const fbud = rules.formationBudget || {};
  formations.forEach((f, i) => { bm[i] *= fbud[f] ?? 1; });
  // battle events (rules.events): supply drops, airstrikes, meteor showers
  const events = Array.isArray(rules.events) && rules.events.length ? rules.events : undefined;
  const optsFor = mul => ({ target: SECS, fixedLength: SECS, swordsmen, crossbowmen, map, doctrines, budgetMul: [bm[0], bm[1] * mul], swordsmenByTeam, extras, extrasByTeam, era, formations, events });
  // a creative match-up is new, so balance it now with quick test battles on this map and these formations
  let wildMul = 1, wildRate = null;
  if (wild) {
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
  const [n0, n1] = pair.map(k => NATION[k] || titleCase(k));
  const armyName = i => titleCase(game.doc[i].name);
  const red = `${n0} ${armyName(0)}`, blue = `${n1} ${armyName(1)}`;
  // Short titles: team emoji + colour names + a short hook with an emoji. Army types go in the description.
  const EMOJI = { RED: '🔴', BLUE: '🔵', GREEN: '🟢', PURPLE: '🟣', ORANGE: '🟠', YELLOW: '🟡', PINK: '🩷', CYAN: '🩵', WHITE: '⚪', BROWN: '🟤',
    LIME: '💚', TEAL: '🌊', GOLD: '🥇', SILVER: '🥈', INDIGO: '🫐', CORAL: '🪸',
    UK: '🇬🇧', USA: '🇺🇸', FRANCE: '🇫🇷', GERMANY: '🇩🇪', ITALY: '🇮🇹', BRAZIL: '🇧🇷', ARGENTINA: '🇦🇷', CANADA: '🇨🇦', SPAIN: '🇪🇸', PORTUGAL: '🇵🇹',
    AUSTRALIA: '🇦🇺', NEWZEALAND: '🇳🇿', NETHERLANDS: '🇳🇱', BELGIUM: '🇧🇪', SWEDEN: '🇸🇪', NORWAY: '🇳🇴' };
  const [e0, e1] = pair.map(k => EMOJI[k] || '⚔️');
  const hooks = era === 'wild'
    ? ['Dream Team Battle 🤯', 'Who Wins This? 🤔', 'Anything Goes 🎲', 'Craziest Matchup? 💥', 'Pick a Side! 👇', 'Only One Survives 💀']
    : era === 'scifi'
    ? ['Who Wins? 🚀', 'Lasers vs Steel ⚡', 'Pick a Side! 👇', 'Only One Survives 💀', 'Future War 🤖', 'Who Takes It? 🏆']
    : era === 'pirate'
    ? ['Who Rules the Seas? 🏴‍☠️', 'Pick a Crew! 👇', 'Only One Survives 💀', 'Cannons Ready 💣', 'Epic Battle 🔥', 'Who Takes It? 🏆']
    : era === 'horror'
    ? ['Can They Survive? 🧟', "Don't Get Bitten 🧟", 'The Dead Rise 💀', 'Pick a Side! 👇', 'Who Survives? 😱', 'Epic Battle 🔥']
    : era === 'samurai'
    ? ['Who Has Honor? ⚔️', 'Blade vs Blade 🗡️', 'Pick a Clan! 👇', 'Only One Survives 💀', 'Epic Battle 🔥', 'Who Takes It? 🏆']
    : era === 'fantasy'
    ? ['Who Rules? 👑', 'Pick a Faction! 🧙', 'Magic vs Might ✨', 'Only One Survives 💀', 'Epic Battle 🔥', 'Who Takes It? 🏆']
    : era === 'mixed'
    ? ['Old vs New 🕰️', 'Who Wins? 💥', 'Pick a Side! 👇', 'Only One Survives 💀', 'Can the Past Win? ⚔️', 'Who Takes It? 🏆']
    : era === 'modern'
    ? ['Who Wins? 💥', 'Pick a Side! 🎯', 'Only One Survives 💀', 'Modern War 🪖', 'Who Holds the Line? 🛡️', 'Who Takes It? 🏆']
    : ['Who Wins? ⚔️', 'Pick a Side! 👇', 'Only One Survives 💀', 'Guess the Winner 🤔', 'Epic Battle 🔥', 'Who Takes It? 🏆'];
  const hook = hooks[seed % hooks.length];
  const MAP_NAME = { open: 'open field', rocks: 'rocky field', ruins: 'ruins', trenches: 'trenches', city: 'city rooftops', forest: 'forest', bombed: 'bombed city', enchanted: 'fantasy land' };
  const GENRE = { modern: 'modern warfare ', fantasy: 'fantasy ', mixed: 'old vs new ', scifi: 'sci-fi ', pirate: 'pirate ', horror: 'zombie ', samurai: 'samurai ', wild: 'mixed-genre ' };
  // custom teams get their own names in the title ("Storm Mages vs Dragon Bones"); army types stay in the description otherwise
  const showNames = era === 'wild';
  const who = i => (showNames ? `${armyName(i)} (${C.describeSide(game.doc[i])}, ` : `${[red, blue][i]} (`);
  const heavyIn = k => game.doc.some(d => d[k] || (d.heavy || []).includes(k));
  const unique = (list) => [...new Set(list)];
  const meta = {
    seed,
    title: showNames ? `${e0} ${armyName(0)} vs ${armyName(1)} ${e1} | ${hook} #shorts` : `${e0} ${n0} vs ${n1} ${e1} | ${hook} #shorts`,
    description: [
      `${e0} ${who(0)}${formations[0]} formation, ${game.start[0]} units) vs ${who(1)}${formations[1]} formation, ${game.start[1]} units) ${e1}. Who wins? Pick your side and tell us in the comments before the end.`,
      '',
      `A 60-second ${GENRE[era] || ''}battle simulation on the ${MAP_NAME[map] || map} map${showNames ? `, ${n0} vs ${n1}` : ''}. The outcome comes from the game's rules and chance, not real footage.`,
      '',
      'Subscribe for a new battle every day.',
      '',
      `#shorts #${n0.toLowerCase().replace(/ /g, '')}vs${n1.toLowerCase().replace(/ /g, '')} #battlesimulation`,
    ].join('\n'),
    tags: unique([`${n0.toLowerCase()} vs ${n1.toLowerCase()}`, 'army battle', 'battle simulation', 'army simulation', 'who wins', 'army clash', `${(showNames ? armyName(0) : red).toLowerCase()} vs ${(showNames ? armyName(1) : blue).toLowerCase()}`, 'shorts']
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
    wild: wild || undefined,
    balance: wild ? wildMul : mu ? mu.balance : undefined,
    cinematic,
    hook,
    slot,
    winner: game.headline,
  };
  fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify(meta, null, 2));
  const mb = (fs.statSync(final).size / 1048576).toFixed(1);
  console.log(`Done in ${((Date.now() - t0) / 1000).toFixed(0)} s: ${final} (${mb} MB) | ${meta.title} | ${game.headline}, ${game.detail}`);
  if (director) console.log(`Camera: ${director.shots.map(x => `${x.kind}@${x.t}`).join(' ')}`);
}

main().catch(err => { console.error(err); process.exit(1); });
