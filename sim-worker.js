// Runs quick test battles (no drawing) for creative.js: gets { id, opts, seeds }, answers { id, top } = battles the top army won.
'use strict';
const { parentPort } = require('worker_threads');
const RVB = require('./engine.js');
if (parentPort) RVB.makeCanvas = null; // test battles never draw

function topWins(opts, seeds) {
  const keep = RVB.makeCanvas; RVB.makeCanvas = null;
  let top = 0;
  const wins = [0, 0, 0], soft = [0, 0, 0];
  for (const s of seeds) {
    const g = new RVB.Army(s, opts);
    const three = g.N === 3, out = [null, null, null];
    if (!three) { g.startStr0 = g.strength(0); g.startStr1 = g.strength(1); }
    for (let i = 0; i < 3600 && g.phase === 'fight'; i++) {
      g.frame(1 / 60); g.sfx.length = 0;
      // three-way: note when each army is wiped out (for a smoother balance signal than wins alone)
      if (three && i % 6 === 0) { const tt = g.totals(); for (let t = 0; t < 3; t++) if (out[t] === null && tt[t] === 0) out[t] = g.fightT; }
    }
    if (g.winner === 0) top++;
    if (g.winner >= 0 && g.winner < 3) wins[g.winner]++;
    if (!three) {
      // two-army score: the top army's share of the fighting strength left at the end (0 to 1), plus half a point for the win
      const a = g.strength(0) / (g.startStr0 || 1), b = g.strength(1) / (g.startStr1 || 1);
      soft[0] += 0.5 * (a + b > 0 ? a / (a + b) : 0.5) + 0.5 * (g.winner === 0 ? 1 : 0);
    }
    if (three) {
      // each army's score: how long it lasted (share of the battle) plus its share of the troops still standing at the end
      const tt = g.totals(), sum = tt[0] + tt[1] + tt[2] || 1, T = g.fightT || 1, sc = [0, 1, 2].map(t => (out[t] === null ? 1 : out[t] / T) + tt[t] / sum);
      const tot = sc[0] + sc[1] + sc[2] || 1;
      for (let t = 0; t < 3; t++) soft[t] += sc[t] / tot;
    }
  }
  RVB.makeCanvas = keep;
  topWins.last = wins; topWins.soft = soft;
  return top;
}
if (parentPort) parentPort.on('message', ({ id, opts, seeds }) => { const top = topWins(opts, seeds); parentPort.postMessage({ id, top, wins: topWins.last, soft: topWins.soft }); });
module.exports = { topWins };
