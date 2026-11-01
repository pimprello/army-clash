// Video titles, written to the research on what gets Shorts watched (see RULES.md, "Titles"):
// - short: the hook fits in the first ~40 characters (the mobile feed cuts titles off around there)
// - one or two emojis, chosen for the content, placed at the start (to stop the scroll) or right after the key word
// - one or two words in CAPITALS for emphasis (works in gaming/entertainment), never the whole title
// - curiosity and an outcome hint beat plain questions; real numbers only when they're a real promise (army sizes)
// - no "#shorts" in the title (the description has the hashtags)
// - never misleading: every claim comes from what happened in this battle
'use strict';

// How each army type is named in a title. count: true when "<number> <noun>" is accurate (the army is mostly that troop).
const NOUN = {
  SWARM: { n: 'Soldiers', count: true, e: '⚔️' }, ARCHERS: { n: 'Archers', count: true, e: '🏹' }, KNIGHTS: { n: 'Knights', count: true, e: '🛡️' },
  BALANCED: { n: 'Warriors', count: true, e: '⚔️' }, GIANT: { n: 'Giant Army', big: 'GIANT', e: '👹' },
  INFANTRY: { n: 'Soldiers', count: true, e: '🪖' }, ASSAULT: { n: 'Gunners', count: true, e: '💥' }, SNIPERS: { n: 'Snipers', count: true, e: '🎯' },
  ARMORED: { n: 'Tank Army', big: 'TANK', e: '💥' }, COMBINED: { n: 'Soldiers', count: true, e: '🪖' },
  HORDE: { n: 'Skeletons', count: true, e: '💀' }, ORCS: { n: 'Orcs', count: true, e: '👹' }, ELVES: { n: 'Elves', count: true, e: '🏹' },
  MAGES: { n: 'Wizards', count: true, e: '🧙' }, DRAGON: { n: 'Dragon Army', big: 'DRAGON', e: '🐉' },
  TROOPERS: { n: 'Troopers', count: true, e: '🔫' }, ROBOTS: { n: 'Robots', count: true, e: '🤖' }, MECHS: { n: 'Mech Army', big: 'MECH', e: '🤖' },
  PIRATES: { n: 'Pirates', count: true, e: '🏴‍☠️' }, BUCCANEERS: { n: 'Pirates', count: true, e: '🏴‍☠️' },
  ZOMBIES: { n: 'Zombies', count: true, e: '🧟' }, UNDEAD: { n: 'Undead', count: true, e: '🧟' }, VAMPIRES: { n: 'Vampires', count: true, e: '🧛' },
  SAMURAI: { n: 'Samurai', count: true, e: '⚔️' }, NINJAS: { n: 'Ninjas', count: true, e: '🥷' },
};
const nounOf = doc => NOUN[doc.name] || { n: doc.name.charAt(0) + doc.name.slice(1).toLowerCase(), count: false, e: '⚔️' };
const tc = s => s.split(' ').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
const cap = s => s.toUpperCase();

// facts: { teams: [palette keys], nations: { KEY: 'Name' }, flags: { KEY: '🇬🇧' }, docs: [doctrine objects], start: [...], left: [...],
//          winner, gained, low, falls, drops, strike, hazard, wild, three, clickbait, seed }
function makeTitle(f) {
  const N = f.docs.length, w = f.winner >= 0 ? f.winner : 0, ids = [...Array(N).keys()], losers = ids.filter(t => t !== w);
  const l = losers.reduce((a, b) => (f.start[b] > f.start[a] ? b : a), losers[0]);
  const lost = ids.map(t => Math.max(0, f.start[t] + (f.gained[t] || 0) - f.left[t]));
  const pick = list => list[(f.seed >>> 3) % list.length];
  const names = ids.map(t => (f.wild ? tc(f.docs[t].name) : nounOf(f.docs[t]).n));
  const emo = ids.map(t => (f.wild ? '' : nounOf(f.docs[t]).e));

  // 1. what really happened, as an outcome hint (no team names: "clickbait" slots always use these)
  const facts = [];
  if (f.start[w] < f.start[l] * 0.8) facts.push('The Smaller Army Did WHAT? 😳', 'They Were OUTNUMBERED... 😳');
  if (f.left[w] > 0 && f.left[w] <= 3) facts.push(`Won With Only ${f.left[w]} LEFT 😱`, 'This Ending Was WAY Too Close 😰');
  if (f.low && f.low[w] < 0.32) facts.push('The BIGGEST Comeback I\'ve Seen 😱', 'They Were LOSING Until This 😳');
  if (f.left[w] >= 25 && lost[w] < (f.start[w] + (f.gained[w] || 0)) * 0.3) facts.push('This Was a MASSACRE 💀', 'Total DOMINATION 😤');
  if (f.docs.some(d => /ZOMBIES|UNDEAD/.test(d.name)) && Math.max(...f.gained) >= 15) facts.push('The Zombies Got OUT OF CONTROL 🧟');
  if (f.falls.includes('dragon')) facts.push('They Took Down a DRAGON? 🐉');
  if (f.falls.includes('tank')) facts.push('Nobody Expected the TANK to Fall 💥');
  if (f.falls.includes('giant')) facts.push('The GIANT Never Saw It Coming 💀');
  if (f.falls.includes('mech')) facts.push('The MECH Went Down 🤖');
  if (f.drops.some(d => d.kind === 'heavy' && d.team === w)) facts.push('The Airdrop Had a SURPRISE Inside 📦');
  if (f.strike === w) facts.push('One AIRSTRIKE Changed Everything ✈️');
  const HAZ = { tornado: 'A TORNADO Hit Mid-Battle 🌪️', earthquake: 'Then the Ground SPLIT Open 😱', blizzard: 'A BLIZZARD Froze the Battle ❄️', meteors: 'METEORS Hit Mid-Battle ☄️', lightning: 'LIGHTNING Struck the Battlefield ⚡', cannonballs: 'Cannonballs RAINED Down 💣' };
  if (HAZ[f.hazard]) facts.push(HAZ[f.hazard]);
  if (f.clickbait) return { title: pick(facts.length ? facts : ['Wait for the ENDING... 😳', 'I Did NOT Expect This 😳', 'This Got WAY Too Intense 🔥', 'Nobody Saw This Coming 🤯', 'Watch Till the END 👀']), kind: 'clickbait' };

  // 2. the match-up itself, written to be specific and short
  const options = [];
  if (N === 3) {
    options.push(`${names.join(' vs ')} 🤯`, '3 Armies, Only 1 SURVIVES 💀', `${cap(names[0])} vs ${names[1]} vs ${names[2]} 🔥`);
  } else if (f.nations) {
    // nation battles: the flags are the hook
    const [a, b] = f.teams;
    options.push(`${f.flags[a]} ${f.nations[a]} vs ${f.nations[b]} ${f.flags[b]}`, `${f.flags[a]} ${f.nations[a]} ${names[0]} vs ${f.nations[b]} ${names[1]}`, `${f.flags[a]} ${f.nations[a]} vs ${f.nations[b]}: WHO WINS?`);
  } else {
    const [A, B] = [nounOf(f.docs[0]), nounOf(f.docs[1])];
    if (!f.wild && A.count && B.count && names[0] !== names[1]) options.push(`${f.start[0]} ${names[0]} vs ${f.start[1]} ${names[1]} ${emo[0] || emo[1]}`);
    if (!f.wild && A.big && B.big && A.big !== B.big) options.push(`${emo[0]} ${A.big} Army vs ${B.big} Army`, `${A.big} vs ${B.big} ${emo[1]}`);
    else if (!f.wild && (A.big || B.big)) {
      const bigSide = A.big ? 0 : 1, other = 1 - bigSide, bn = nounOf(f.docs[other]);
      options.push(`${bn.count ? f.start[other] + ' ' : ''}${names[other]} vs a ${(A.big || B.big)} Army ${emo[bigSide]}`);
    }
    options.push(`${emo[0] || '🔥'} ${cap(names[0])} vs ${names[1]}`, `${names[0]} vs ${cap(names[1])} ${emo[1] || '🔥'}`);
    if (f.wild) options.push(`${names[0]} vs ${names[1]} 🤯`, `DREAM TEAM Battle: ${names[0]} vs ${names[1]}`);
  }
  // sometimes lead with what happened instead (a strong, true outcome hint)
  if (facts.length && ((f.seed >>> 5) % 3 === 0)) options.push(...facts);
  let t = pick(options);
  if (t.length > 60) t = options.find(o => o.length <= 60) || t.slice(0, 60);
  return { title: t, kind: 'title' };
}

module.exports = { makeTitle, NOUN, nounOf };
