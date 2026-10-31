// Adds the video that was just posted to uploads.md, newest first.
'use strict';
const fs = require('fs');
const path = require('path');

const info = JSON.parse(fs.readFileSync(path.join(__dirname, 'out', 'uploaded.json'), 'utf8'));
const file = path.join(__dirname, 'uploads.md');
const rule = '| --- | --- | --- | --- |\n';
const head = '# Posted videos\n\n| Date (UTC) | Title | Result | Link |\n' + rule;
let rows = '';
if (fs.existsSync(file)) {
  const old = fs.readFileSync(file, 'utf8');
  const at = old.indexOf(rule);
  if (at >= 0) rows = old.slice(at + rule.length);
}
const cell = s => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
const result = info.winner ? info.winner.charAt(0) + info.winner.slice(1).toLowerCase() : '';
fs.writeFileSync(file, head + `| ${cell(info.date)} | ${cell(info.title)} | ${cell(result)} | ${info.url} |\n` + rows);
// Also keep a machine-readable record of what each video was, so view counts can be matched to its settings.
let meta = {};
try { meta = JSON.parse(fs.readFileSync(path.join(__dirname, 'out', 'meta.json'), 'utf8')); } catch (e) { /* older render */ }
const record = { date: info.date, id: info.id, title: info.title, seed: meta.seed, slot: meta.slot, era: meta.era, map: meta.map,
  teams: meta.teams, armies: meta.armies, formations: meta.formations, troops: meta.troops, hook: meta.hook, winner: meta.winner };
fs.appendFileSync(path.join(__dirname, 'videos.jsonl'), JSON.stringify(record) + '\n');
console.log('uploads.md and videos.jsonl updated');
