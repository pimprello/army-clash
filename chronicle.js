// The tribes' chronicle, from videos.jsonl: every tribe's record (wins, losses, kills, streak), who met whom and who won.
// render.js reads history() so a battle's story can say what really happened before ("Last time the Iron Boar Clan beat the Coven of Ash").
// trophies.js adds section() to TROPHIES.md after every upload.
'use strict';

function history(rows) {
  const t = {}, m = {};
  rows.forEach((r, i) => {
    if (!r || !Array.isArray(r.tribes) || r.winTeam === undefined) return;
    for (const tb of r.tribes) {
      const e = t[tb.name] || (t[tb.name] = { w: 0, l: 0, s: 0, k: 0, n: 0, best: 0 });
      e.n++; e.k += tb.kills || 0;
      if (r.winTeam === tb.team) { e.w++; e.s = e.s > 0 ? e.s + 1 : 1; e.best = Math.max(e.best, e.s); }
      else if (r.winTeam >= 0) { e.l++; e.s = e.s < 0 ? e.s - 1 : -1; }
    }
    // every pair of tribes that fought on opposite sides
    for (const a of r.tribes) for (const b of r.tribes) {
      if (a.team >= b.team) continue;
      const key = [a.name, b.name].sort().join('|'), e = m[key] || (m[key] = { n: 0 });
      e.n++; e.at = i; e.w = r.winTeam === a.team ? a.name : r.winTeam === b.team ? b.name : null;
    }
  });
  return { t, m };
}

const tc = s => s.split(' ').map(w => (['OF', 'THE'].includes(w) ? w.toLowerCase() : w.charAt(0) + w.slice(1).toLowerCase())).join(' ').replace(/^the /, 'The ');

function section(rows) {
  const { t, m } = history(rows);
  const out = ['', "## The tribes' chronicle", ''];
  const list = Object.entries(t);
  if (!list.length) { out.push('No tribe battles yet.'); return out.join('\n') + '\n'; }
  out.push(`${list.length} tribes have fought so far. The same tribes come back video after video, and their stories build on what really happened.`, '');
  out.push('| Tribe | Battles | Wins | Losses | Kills | Streak | Best streak |', '|---|---|---|---|---|---|---|');
  for (const [name, e] of list.sort((a, b) => b[1].w - a[1].w || b[1].k - a[1].k).slice(0, 20)) {
    out.push(`| ${tc(name)} | ${e.n} | ${e.w} | ${e.l} | ${e.k} | ${e.s > 0 ? `${e.s} won` : e.s < 0 ? `${-e.s} lost` : '-'} | ${e.best || '-'} |`);
  }
  const riv = Object.entries(m).filter(([, e]) => e.n >= 2).sort((a, b) => b[1].n - a[1].n).slice(0, 8);
  out.push('', '### Great rivalries', '');
  if (!riv.length) out.push('No two tribes have met twice yet.');
  for (const [k, e] of riv) out.push(`- **${k.split('|').map(tc).join(' vs ')}**: met ${e.n} times${e.w ? `, last won by ${tc(e.w)}` : ''}`);
  const legends = rows.filter(r => r && r.chron && r.chron.length).slice(-10).reverse();
  out.push('', '### Latest from the battlefield', '');
  for (const r of legends) out.push(`- ${r.date || ''}: ${tc(r.chron[0])} (${r.chron[1].toLowerCase()})`);
  return out.join('\n') + '\n';
}

module.exports = { history, section };
