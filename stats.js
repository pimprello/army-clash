// Fetches view, like and comment counts for every posted video and summarises what performs best.
// Runs at most once every 20 hours (from the post workflow). Writes stats/views.json and stats/summary.md.
// Needs YT_API_KEY (a YouTube Data API key) or the upload OAuth secrets; quota cost is 1 unit per 50 videos.
'use strict';
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, 'stats');
const last = path.join(DIR, 'last-run.txt');
fs.mkdirSync(DIR, { recursive: true });
if (!process.env.FORCE && fs.existsSync(last) && Date.now() - Number(fs.readFileSync(last, 'utf8')) < 20 * 3600 * 1000) {
  console.log('Stats ran less than 20 hours ago; skipping.');
  process.exit(0);
}

// every video: settings from videos.jsonl where we have them, otherwise just the id from uploads.md
const videos = new Map();
const up = fs.existsSync('uploads.md') ? fs.readFileSync('uploads.md', 'utf8') : '';
for (const m of up.matchAll(/^\| ([^|]+) \| (.+?) \| [^|]* \| https:\/\/youtube\.com\/shorts\/([\w-]+) \|$/gm)) videos.set(m[3], { id: m[3], date: m[1].trim(), title: m[2].replace(/\\\|/g, '|') });
if (fs.existsSync('videos.jsonl')) for (const line of fs.readFileSync('videos.jsonl', 'utf8').split('\n')) {
  if (!line.trim()) continue;
  try { const v = JSON.parse(line); if (v.id) videos.set(v.id, { ...(videos.get(v.id) || {}), ...v }); } catch (e) { /* skip bad line */ }
}

async function auth() {
  if (process.env.YT_API_KEY) return { key: process.env.YT_API_KEY };
  if (!process.env.YT_REFRESH_TOKEN) throw new Error('No YT_API_KEY secret and no OAuth secrets.');
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.YT_CLIENT_ID, client_secret: process.env.YT_CLIENT_SECRET, refresh_token: process.env.YT_REFRESH_TOKEN, grant_type: 'refresh_token' }) });
  const j = await r.json();
  if (!r.ok) throw new Error('Google sign-in failed: ' + (j.error || r.status));
  return { token: j.access_token };
}

const median = a => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
function groupBy(list, keyFn) {
  const g = new Map();
  for (const v of list) { const k = keyFn(v); if (k === undefined || k === null || k === '') continue; if (!g.has(k)) g.set(k, []); g.get(k).push(v.views); }
  return [...g.entries()].map(([k, a]) => ({ k, n: a.length, median: median(a), avg: Math.round(a.reduce((x, y) => x + y, 0) / a.length) }))
    .filter(r => r.n >= 3).sort((a, b) => b.median - a.median);
}

(async () => {
  const a = await auth();
  const ids = [...videos.keys()];
  const out = [];
  for (let i = 0; i < ids.length; i += 50) {
    const q = new URLSearchParams({ part: 'statistics', id: ids.slice(i, i + 50).join(',') });
    if (a.key) q.set('key', a.key);
    const r = await fetch('https://www.googleapis.com/youtube/v3/videos?' + q, { headers: a.token ? { Authorization: 'Bearer ' + a.token } : {} });
    const j = await r.json();
    if (!r.ok) throw new Error(`YouTube refused the stats request (${r.status}): ${JSON.stringify(j.error && j.error.message)}. Add a YT_API_KEY secret.`);
    for (const it of j.items || []) {
      const v = videos.get(it.id), st = it.statistics || {};
      out.push({ ...v, views: Number(st.viewCount || 0), likes: Number(st.likeCount || 0), comments: Number(st.commentCount || 0) });
    }
  }
  // only judge videos at least a day old, so new uploads don't drag the numbers down
  const day = 24 * 3600 * 1000, now = Date.now();
  const mature = out.filter(v => v.date && now - Date.parse(v.date.replace(' ', 'T') + 'Z') > day);
  const nation = t => (t && t.some(x => ['UK', 'USA', 'FRANCE', 'GERMANY', 'ITALY', 'BRAZIL', 'ARGENTINA', 'CANADA', 'SPAIN', 'PORTUGAL', 'AUSTRALIA', 'NEWZEALAND', 'NETHERLANDS', 'BELGIUM', 'SWEDEN', 'NORWAY', 'DENMARK', 'FINLAND'].includes(x)) ? 'nations' : 'colours');
  const table = (title, rows) => [`### ${title}`, '', '| Group | Videos | Median views | Average views |', '| --- | --- | --- | --- |',
    ...rows.slice(0, 15).map(r => `| ${r.k} | ${r.n} | ${r.median} | ${r.avg} |`), ''].join('\n');
  const md = [
    '# View stats', '', `Updated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC. ${out.length} videos, ${mature.length} at least a day old (used below). Groups need 3+ videos.`, '',
    `Total views: ${out.reduce((s, v) => s + v.views, 0)}. Median views per video: ${median(mature.map(v => v.views))}.`, '',
    table('By era', groupBy(mature, v => v.era)),
    table('Creative (invented) vs list line-ups', groupBy(mature, v => (v.wild ? 'creative' : 'list'))),
    table('Cinematic camera', groupBy(mature, v => (v.cinematic ? 'on' : 'off'))),
    table('Clickbait title', groupBy(mature, v => (v.clickbait ? 'clickbait' : 'normal'))),
    table('By map', groupBy(mature, v => v.map)),
    table('By team type', groupBy(mature, v => v.teams && nation(v.teams))),
    table('By colour pair', groupBy(mature, v => v.teams && v.teams.slice().sort().join(' vs '))),
    table('By line-up', groupBy(mature, v => v.armies && v.armies.join(' vs '))),
    table('By hook', groupBy(mature, v => v.hook)),
    table('By formation (top side)', groupBy(mature, v => v.formations && v.formations[0])),
    '### Top 10 videos', '', '| Views | Likes | Title |', '| --- | --- | --- |',
    ...out.slice().sort((x, y) => y.views - x.views).slice(0, 10).map(v => `| ${v.views} | ${v.likes} | ${v.title} |`), '',
  ].join('\n');
  fs.writeFileSync(path.join(DIR, 'views.json'), JSON.stringify(out, null, 1));
  fs.writeFileSync(path.join(DIR, 'summary.md'), md);
  fs.writeFileSync(last, String(Date.now()));
  if (fs.existsSync(path.join(DIR, 'error.txt'))) fs.rmSync(path.join(DIR, 'error.txt'));
  console.log(`Stats saved for ${out.length} videos.`);
})().catch(e => {
  // record the problem (the autopilot reads it) and wait a day before trying again
  console.error(e.message);
  fs.writeFileSync(path.join(DIR, 'error.txt'), new Date().toISOString() + ' ' + e.message + '\n');
  fs.writeFileSync(last, String(Date.now()));
  process.exit(1);
});
