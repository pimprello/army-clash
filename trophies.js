// The trophy room (TROPHIES.md): records across every posted video, rebuilt from videos.jsonl after each upload.
// Strongest troop (most kills in one battle), fastest wipe-out, biggest win, champions, and the rarest titles and mutations.
'use strict';
const fs = require('fs');
const path = require('path');

function build(rows) {
  const t = rows.filter(r => r.trophy);
  const link = r => (r.id ? `[${r.title}](https://youtube.com/shorts/${r.id})` : r.title);
  const out = ['# Trophy room', '', `Records from ${t.length} battle${t.length === 1 ? '' : 's'} with trophies (videos from 1 November 2026 on). Rebuilt after every upload.`, ''];
  const top = (list, n) => list.slice(0, n);
  const mvps = t.filter(r => r.trophy.mvp).sort((a, b) => b.trophy.mvp.kills - a.trophy.mvp.kills);
  out.push('## Most kills by one troop', '');
  if (!mvps.length) out.push('Nothing yet.');
  for (const r of top(mvps, 10)) { const m = r.trophy.mvp; out.push(`- **${m.kills} kills**: ${m.name ? `${m.name} (${m.unit})` : m.unit}${m.title ? `, ${m.title}` : ''} · ${r.date} · ${link(r)}`); }
  const fast = t.filter(r => r.trophy.wipeout && r.trophy.fight > 5).sort((a, b) => a.trophy.fight - b.trophy.fight);
  out.push('', '## Fastest wipe-outs', '');
  if (!fast.length) out.push('Nothing yet.');
  for (const r of top(fast, 5)) out.push(`- **${r.trophy.fight} s**: ${r.winner ? r.winner.toLowerCase() : ''} · ${r.date} · ${link(r)}`);
  const big = t.filter(r => r.trophy.left).sort((a, b) => b.trophy.left - a.trophy.left);
  out.push('', '## Biggest wins (troops still standing)', '');
  if (!big.length) out.push('Nothing yet.');
  for (const r of top(big, 5)) out.push(`- **${r.trophy.left} left**: ${r.date} · ${link(r)}`);
  const champs = t.filter(r => r.trophy.mvp && r.trophy.mvp.name);
  out.push('', '## Hall of champions', '');
  if (!champs.length) out.push('Nothing yet.');
  for (const r of top(champs.slice().reverse(), 15)) out.push(`- **${r.trophy.mvp.name}** (${r.trophy.mvp.unit}), ${r.trophy.mvp.kills} kills · ${r.date}`);
  // rarest titles and mutations: the ones seen the fewest times
  const count = key => { const c = {}; for (const r of t) for (const v of r.trophy[key] || []) c[v] = (c[v] || 0) + 1; return Object.entries(c).sort((a, b) => a[1] - b[1]); };
  out.push('', '## Titles earned (rarest first)', '');
  const tt = count('titles'); if (!tt.length) out.push('Nothing yet.');
  for (const [k, n] of tt) out.push(`- ${k}: ${n}`);
  out.push('', '## Mutations (rarest first)', '');
  const mm = count('mutations'); if (!mm.length) out.push('Nothing yet.');
  for (const [k, n] of mm) out.push(`- ${k}: ${n}`);
  out.push('', '## Big moments', '');
  const mo = count('moments'); if (!mo.length) out.push('Nothing yet.');
  for (const [k, n] of mo) out.push(`- ${k.replace(':', ': ')}: ${n}`);
  // the tribes' chronicle (records, rivalries and the latest stories), kept here because the upload step already commits this file
  return out.join('\n') + '\n' + require('./chronicle.js').section(rows);
}

function write(dir) {
  const file = path.join(dir, 'videos.jsonl');
  const rows = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean) : [];
  fs.writeFileSync(path.join(dir, 'TROPHIES.md'), build(rows));
}

module.exports = { build, write };
if (require.main === module) write(__dirname);
