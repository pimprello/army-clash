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
const sw = rules.swordsmen || {};
const swordsmen = pick.next() < (sw.chancePerVideo ?? 0) ? (sw.shareOfArmy ?? 0.15) : 0;
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

const titleCase = s => s.charAt(0) + s.slice(1).toLowerCase();

async function main() {
  const t0 = Date.now();
  const game = new RVB.Army(seed, { target: SECS, fixedLength: SECS, swordsmen });
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
    game.frame(1 / FPS);
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

  const [n0, n1] = RVB.TEAMS.map(t => titleCase(t.name));
  const red = `${n0} ${titleCase(game.doc[0].name)}`, blue = `${n1} ${titleCase(game.doc[1].name)}`;
  const hooks = ['Only One Army Survives', 'Who Wins This War?', 'Can You Guess the Winner?', 'Pick Your Side Before It Ends', 'Who Takes the Battlefield?'];
  const hook = hooks[seed % hooks.length];
  const meta = {
    seed,
    // Searchable keywords first ("army battle"), then a curiosity hook. Kept under 70 characters.
    title: `${red} vs ${blue} Army Battle | ${hook} #shorts`,
    description: [
      `${red} (${game.start[0]} units) vs ${blue} (${game.start[1]} units). Who wins? Pick your side and tell us in the comments before the end.`,
      '',
      'A 60-second battle simulation. The outcome comes from the game\'s rules and chance, not real footage.',
      '',
      'Subscribe for a new battle every day.',
      '',
      `#shorts #${n0.toLowerCase()}vs${n1.toLowerCase()} #battlesimulation`,
    ].join('\n'),
    tags: [`${n0.toLowerCase()} vs ${n1.toLowerCase()}`, 'army battle', 'battle simulation', 'army simulation', 'who wins', 'army clash', `${red.toLowerCase()} vs ${blue.toLowerCase()}`, 'shorts'],
    teams: pair,
    swordsmen: swordsmen > 0,
    winner: game.headline,
  };
  fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify(meta, null, 2));
  const mb = (fs.statSync(final).size / 1048576).toFixed(1);
  console.log(`Done in ${((Date.now() - t0) / 1000).toFixed(0)} s: ${final} (${mb} MB) | ${meta.title} | ${game.headline}, ${game.detail}`);
}

main().catch(err => { console.error(err); process.exit(1); });
