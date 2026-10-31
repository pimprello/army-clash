// Runs quick test battles (no drawing) for creative.js: gets { id, opts, seeds }, answers { id, top } = battles the top army won.
'use strict';
const { parentPort } = require('worker_threads');
const RVB = require('./engine.js');
if (parentPort) RVB.makeCanvas = null; // test battles never draw

function topWins(opts, seeds) {
  const keep = RVB.makeCanvas; RVB.makeCanvas = null;
  let top = 0;
  for (const s of seeds) {
    const g = new RVB.Army(s, opts);
    for (let i = 0; i < 3600 && g.phase === 'fight'; i++) { g.frame(1 / 60); g.sfx.length = 0; }
    if (g.winner === 0) top++;
  }
  RVB.makeCanvas = keep;
  return top;
}
if (parentPort) parentPort.on('message', ({ id, opts, seeds }) => parentPort.postMessage({ id, top: topWins(opts, seeds) }));
module.exports = { topWins };
