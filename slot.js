// Upload times (rules.schedule): decides whether a scheduled run should post now.
// Rellz (2026-11-07): "only upload 2 videos a day ... always at 10am and 10pm" (London time, summer time handled).
// GitHub's timer runs in UTC and can be late, so the workflow wakes every 10 minutes around each slot and this script says
// "go" only for the first run inside a slot hour that hasn't posted yet. Prints go or skip (and why) for the workflow.
'use strict';
const fs = require('fs'), path = require('path');
const rules = require('./rules.json');
const S = rules.schedule || {}, tz = S.timeZone || 'Europe/London', hours = S.hours || [10, 22];

// the date and hour in London for a moment
function local(d) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
    .formatToParts(d).map(x => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
}

function decide(now = new Date()) {
  const n = local(now);
  if (!hours.includes(n.hour)) return { go: false, why: `${n.hour}:00 in ${tz} is not an upload hour (${hours.join(', ')})` };
  // the last post (videos.jsonl dates are UTC "YYYY-MM-DD HH:MM")
  let last = null;
  try {
    const lines = fs.readFileSync(path.join(__dirname, 'videos.jsonl'), 'utf8').trim().split('\n');
    const row = JSON.parse(lines[lines.length - 1]);
    last = new Date(row.date.replace(' ', 'T') + ':00Z');
  } catch (e) { /* nothing posted yet */ }
  if (last) {
    const l = local(last);
    if (l.day === n.day && l.hour === n.hour) return { go: false, why: `already posted in the ${n.hour}:00 slot today` };
  }
  return { go: true, why: `${n.day} ${n.hour}:00 ${tz} slot` };
}

if (require.main === module) {
  const d = decide();
  console.log(`${d.go ? 'go' : 'skip'}: ${d.why}`);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `go=${d.go ? 'yes' : 'no'}\n`);
}
module.exports = { decide, local };
