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
  VIKINGS: { n: 'Vikings', count: true, e: '🪓' },
  // the big troop batch: factions, monster armies and mythic rule-breakers
  EMPIRE: { n: 'Empire', e: '👑' }, CAVALRY: { n: 'Cavalry', e: '🐎' }, LONGBOWS: { n: 'Longbowmen', e: '🏹' }, ELEPHANTS: { n: 'War Elephants', big: 'ELEPHANT', e: '🐘' },
  FORTRESS: { n: 'Walking Fortress', big: 'FORTRESS', e: '🏰' }, FORBIDDEN: { n: 'Peasants', count: true, e: '🌾' }, WARBAND: { n: 'Orc Horde', e: '👹' }, SYLVAN: { n: 'Forest Elves', e: '🌳' },
  INFERNAL: { n: 'Demons', e: '😈' }, DWARVES: { n: 'Dwarves', e: '⛏️' }, CYCLOPS: { n: 'Cyclops Army', big: 'CYCLOPS', e: '👁️' }, GRIFFINS: { n: 'Griffin Riders', e: '🦅' },
  HYDRA: { n: 'Hydra Army', big: 'HYDRA', e: '🐍' }, TITAN: { n: 'Titan Army', big: 'TITAN', e: '🗿' }, PHOENIX: { n: 'Phoenix Army', big: 'PHOENIX', e: '🔥' }, GOLEMS: { n: 'Golems', big: 'GOLEM', e: '🪨' },
  ARCANE: { n: 'Arcane Army', e: '🔮' }, TURTLES: { n: 'Turtle Army', e: '🐢' }, THOUSANDMAN: { n: 'Thousand-Man', big: 'THOUSAND-MAN', e: '🧟' }, COPYCATS: { n: 'Copycats', e: '🎭' },
  IMMORTAL: { n: 'Immortal', big: 'IMMORTAL', e: '♾️' }, MIRRORKING: { n: 'Mirror King', big: 'MIRROR KING', e: '🪞' }, UNMAKER: { n: 'Unmaker', big: 'UNMAKER', e: '👁️' },
  TYCOON: { n: 'Billionaire', big: 'BILLIONAIRE', e: '💰' }, GRAVITY: { n: 'Gravity Tyrant', big: 'GRAVITY', e: '🌀' }, METEOR: { n: 'Meteor Army', big: 'METEOR', e: '☄️' },
  LEGION: { n: 'Undead Legion', e: '💀' }, DREADKNIGHT: { n: 'Dread Knight', big: 'DREAD KNIGHT', e: '💀' }, GLITCH: { n: 'Glitch Army', big: 'GLITCH', e: '👾' },
  // the second batch
  SIEGE: { n: 'Siege Army', big: 'CATAPULT', e: '🪨' }, MAMMOTHS: { n: 'Mammoth Army', big: 'MAMMOTH', e: '🦣' }, CATHEDRAL: { n: 'Walking Cathedral', big: 'CATHEDRAL', e: '⛪' , who: 'a Walking CATHEDRAL' },
  NEVERLOSE: { n: 'Undefeated General', big: 'UNDEFEATED', e: '⏪' , who: 'the UNDEFEATED General' }, PLAYER: { n: 'The Player', big: 'PLAYER', e: '🖐️' , who: 'THE PLAYER' }, UNIVERSE: { n: 'Universe Army', e: '🌌' },
  LIVINGFORT: { n: 'Living Fortress', big: 'LIVING CASTLE', e: '🏰' , who: 'a LIVING Castle' }, FROST: { n: 'Frost Witches', e: '❄️' }, TEMPEST: { n: 'Storm Callers', e: '⚡' }, SPIRITS: { n: 'Forest Spirits', e: '✨' },
  RHINOS: { n: 'War Rhinos', e: '🦏' }, OGRES: { n: 'Ogres', e: '👹' }, STAREATER: { n: 'Star Eater', big: 'STAR EATER', e: '🌑' , who: 'the STAR EATER' }, TIMELINE: { n: 'Timeline Executioner', big: 'TIME', e: '⏳' , who: 'the TIME Executioner' },
  STORMEMPEROR: { n: 'Storm Emperor', big: 'STORM EMPEROR', e: '🌩️' , who: 'the STORM EMPEROR' }, WORLDROOT: { n: 'Worldroot', big: 'WORLDROOT', e: '🌳' , who: 'the WORLDROOT' }, HOURGLASS: { n: 'Hourglass Titan', big: 'HOURGLASS', e: '⏳' , who: 'the HOURGLASS Titan' },
  MOONCALLER: { n: 'Moon Caller', big: 'MOON', e: '🌕' , who: 'the MOON Caller' }, GOBLINKING: { n: 'Goblin King', big: 'GOBLIN KING', e: '👑' , who: 'the GOBLIN KING' }, LICHES: { n: 'Liches', e: '💀' }, GARGOYLES: { n: 'Gargoyles', e: '🗿' },
  EMPTY: { n: 'Empty Army', e: '👻' }, DRONES: { n: 'Drone Swarm', e: '💥' }, AIRBORNE: { n: 'Helicopter Army', big: 'HELICOPTER', e: '🚁' }, SIRENS: { n: 'Sirens', e: '🧜‍♀️' },
  ASSASSINS: { n: 'Assassins', e: '🗡️' },
  // the fourth batch (rules.roster)
  SINGULARITY: { n: 'Singularity Sages', e: '🌀' }, ORBITERS: { n: 'Orbit Knights', e: '🪐' }, CRYSTALCOURT: { n: 'Crystal Court', e: '💎' }, BLINKBLADES: { n: 'Blink Blades', e: '🗡️' },
  GRAVITYCULT: { n: 'Gravity Cult', big: 'GRAVITY TYRANT', e: '🌀', who: 'the GRAVITY TYRANT' }, SUNKINGDOM: { n: 'Sun Kingdom', e: '☀️' },
  THRONE: { n: 'Throne Walker', big: 'THRONE WALKER', e: '👑', who: 'the THRONE WALKER' }, TRAPPERS: { n: 'Trapmasters', e: '🪤' }, WARMASTERS: { n: 'Warmasters', e: '🚩' },
  ZEROG: { n: 'Zero-G Rangers', e: '🛸' }, PULSARS: { n: 'Pulsars', e: '💫' }, BASTION: { n: 'Bastion Corps', e: '🛡️' },
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
  // new (2026-11-05): stronger versions of the same true outcomes
  if (f.start[w] < f.start[l] * 0.6) facts.push('Half the Size and Still WON 😳');
  if (f.left[w] >= 10 && lost[w] < (f.start[w] + (f.gained[w] || 0)) * 0.1) facts.push('They Barely Got SCRATCHED 😤');
  if (f.low && f.low[w] < 0.2) facts.push('They Were ALMOST Wiped Out... 😱');
  if (f.docs.some(d => /ZOMBIES|UNDEAD/.test(d.name)) && Math.max(...f.gained) >= 15) facts.push('The Zombies Got OUT OF CONTROL 🧟');
  if (f.falls.includes('dragon')) facts.push('They Took Down a DRAGON? 🐉');
  if (f.falls.includes('tank')) facts.push('Nobody Expected the TANK to Fall 💥');
  if (f.falls.includes('giant')) facts.push('The GIANT Never Saw It Coming 💀');
  if (f.falls.includes('mech')) facts.push('The MECH Went Down 🤖');
  // the big troop batch and the new systems: only things that really happened in this battle
  const x = f.xf || {}, L = k => (f.label ? f.label(k) : k.toUpperCase()).replace(/^THE /, '');
  const tc2 = s => s.split(' ').map(w => (w.length > 2 ? w.charAt(0) + w.slice(1).toLowerCase() : w.toLowerCase())).join(' ');
  for (const k of f.falls) if (!['dragon', 'tank', 'giant', 'mech', 'cannon'].includes(k)) { facts.push(`The ${tc2(L(k))} Went DOWN 💀`); break; }
  if (x.godEater) facts.push('A Peasant Became a GOD 😱', 'This PEASANT Ate a God 😳');
  if (x.possess) facts.push(`They STOLE the ${tc2(L(x.possess))} 😈`);
  if (x.fusion) facts.push('12 Skeletons FUSED Into a Giant 💀');
  if (x.bribes >= 3) facts.push('He BOUGHT Their Army 💰');
  if (x.sheep >= 3) facts.push('He Turned Them Into SHEEP 🐑');
  if (x.portal) facts.push('A PORTAL Opened Mid-Battle 🌀');
  if (x.extinct) facts.push('An ANCIENT Monster Woke Up 😱');
  if (x.sudden) facts.push({ ring: 'Then the Arena Started SHRINKING 😱', lava: 'Then the LAVA Rose 🌋', boss: 'A TITAN Crashed the Battle 🗿', meteors: 'A METEOR STORM Ended It ☄️' }[x.sudden]);
  if (x.copied) facts.push(`They COPIED the ${tc2(L(x.copied))} 🎭`);
  if (x.revives >= 3) facts.push('He Just WOULDN\'T Die 😳');
  if (x.falls >= 3) facts.push(`${x.falls} Troops Fell Off the MAP 😭`);
  if (x.walls >= 3) facts.push('They SMASHED Through the Walls 💥');
  if ((x.titles || []).some(t => /DRAGON SLAYER/.test(t))) facts.push('A DRAGON SLAYER Was Born ⚔️');
  if (x.eaten >= 3) facts.push('The Ogres ATE Their Own Army 😳');
  if (x.castle) facts.push('The CASTLE Was Alive 😱');
  if (x.blackhole) facts.push('He Opened a BLACK HOLE 🌑');
  if (x.rewound) facts.push('The General REWOUND the Battle ⏪');
  else if (x.rewinds >= 2) facts.push('He REWOUND Time Itself ⏪');
  if (x.aged >= 3) facts.push('He Aged Them Into SKELETONS ⏳');
  if (x.moon) facts.push('The MOON Pulled Them Down 🌕');
  if (x.defect >= 3) facts.push('They Joined the GOBLIN KING?! 👑');
  if (x.grabbed >= 3) facts.push('A Giant HAND Joined the Battle 🖐️');
  if (x.swallowed >= 3) facts.push('The Castle ATE Them 🏰');
  if (x.hollow >= 5) facts.push('The Empty Armour Kept FIGHTING 👻');
  if (x.universe) facts.push('A UNIVERSE Opened Inside Him 🌌');
  if (x.transform) facts.push('The Last One TRANSFORMED 😱');
  if (x.living) facts.push('The Weapons Came ALIVE 🗡️');
  if (f.mvp && f.mvp.kills >= 12) facts.push(`One ${tc2(L(f.mvp.type))} Got ${f.mvp.kills} KILLS 😳`);
  if (f.mvp && f.mvp.kills >= 20) facts.push('One Troop CARRIED the Whole Army 😳');
  if (f.drops.some(d => d.kind === 'heavy' && d.team === w)) facts.push('The Airdrop Had a SURPRISE Inside 📦');
  if (f.strike === w) facts.push('One AIRSTRIKE Changed Everything ✈️');
  const HAZ = { tornado: 'A TORNADO Hit Mid-Battle 🌪️', earthquake: 'Then the Ground SPLIT Open 😱', blizzard: 'A BLIZZARD Froze the Battle ❄️', meteors: 'METEORS Hit Mid-Battle ☄️', lightning: 'LIGHTNING Struck the Battlefield ⚡', cannonballs: 'Cannonballs RAINED Down 💣', stampede: 'A STAMPEDE Hit Mid-Battle 🦣', kraken: 'The KRAKEN Woke Up 🐙' };
  if (HAZ[f.hazard]) facts.push(HAZ[f.hazard]);
  // living tribes: only what really happened (the lead tribe is the winning army's tribe with the most kills)
  const tr = f.tribes && f.tribes.lead ? f.tribes : null;
  if (tr) {
    const L0 = tr.lead, nm = L0.name.replace(/^THE /, '').split(' ').map(x => (['OF', 'THE'].includes(x) ? x.toLowerCase() : x.charAt(0) + x.slice(1).toLowerCase())).join(' ');
    if (L0.revenge) facts.push(`The ${nm} Got REVENGE ⚔️`);
    if (L0.firstWin) facts.push(`FIRST Ever Win for the ${nm} 🏆`);
    else if (L0.streak >= 3) facts.push(`${L0.streak} Wins in a ROW for the ${nm} 🔥`);
    if (L0.weapon) { const [a, ...b] = L0.weapon.split(' '); facts.push(`They ${{ modern: 'Got', scifi: 'Built' }[L0.set] || 'Forged'} ${a} ${b.map(x => x.charAt(0) + x.slice(1).toLowerCase()).join(' ')} and WON 🔥`); }
    if (tr.merchant && tr.merchant.team === w) facts.push(`The Merchant Sold Them ${/S$/.test(tr.merchant.name) ? '' : 'a '}${tr.merchant.name.split(' ').map(x => (x === 'OF' ? 'of' : x.charAt(0) + x.slice(1).toLowerCase())).join(' ')} 💰`);
    if (L0.chiefLost) facts.push('They Lost Their CHIEF and Still Won 😳');
  }
  // battle modes: only what really happened
  if (f.mode === 'king' && x.kingTeam !== undefined && x.kingTeam !== w) facts.push('They Killed the KING 👑', 'The KING Fell and They RAN 👑');
  if (f.mode === 'duel' && x.duelTeam !== undefined) facts.push(x.duelTeam === w ? 'The DUEL Decided Everything ⚔️' : 'They LOST the Duel but WON the War ⚔️');
  if (f.mode === 'heroes') facts.push(f.heroes === w ? `${f.start[f.heroes]} HEROES Held the Line 🛡️` : 'The Last Stand FELL 💀');
  if (f.mode === 'hill' && x.hill >= 3) facts.push(`The HILL Changed Hands ${x.hill} TIMES 🚩`);
  else if (f.mode === 'hill' && x.hillTeam === w) facts.push('They Took the HILL and Won 🚩');
  if (f.clickbait) return { title: pick(facts.length ? facts : ['Wait for the ENDING... 😳', 'I Did NOT Expect This 😳', 'This Got WAY Too Intense 🔥', 'Nobody Saw This Coming 🤯', 'Watch Till the END 👀']), kind: 'clickbait' };

  // 2. the match-up itself, written to be specific and short
  const options = [];
  if (N === 3) {
    options.push(`${names.join(' vs ')} 🤯`, '3 Armies, Only 1 SURVIVES 💀', `${cap(names[0])} vs ${names[1]} vs ${names[2]} 🔥`, `Pick ONE: ${names.join(', ')} 👇`);
  } else if (f.nations) {
    // nation battles: the flags are the hook
    const [a, b] = f.teams;
    options.push(`${f.flags[a]} ${f.nations[a]} vs ${f.nations[b]} ${f.flags[b]}`, `${f.flags[a]} ${f.nations[a]} ${names[0]} vs ${f.nations[b]} ${names[1]}`, `${f.flags[a]} ${f.nations[a]} vs ${f.nations[b]}: WHO WINS?`);
  } else {
    const [A, B] = [nounOf(f.docs[0]), nounOf(f.docs[1])];
    if (!f.wild && A.count && B.count && names[0] !== names[1]) options.push(`${f.start[0]} ${names[0]} vs ${f.start[1]} ${names[1]} ${emo[0] || emo[1]}`);
    // one-of-a-kind bosses read better by name ("vs the STAR EATER") than as "a ... Army"
    const army = n => n.who || `${n.big} Army`, aArmy = n => n.who || `a ${n.big} Army`;
    if (!f.wild && A.big && B.big && A.big !== B.big) options.push(`${emo[0]} ${army(A)} vs ${army(B)}`, `${A.big} vs ${B.big} ${emo[1]}`);
    else if (!f.wild && (A.big || B.big)) {
      const bigSide = A.big ? 0 : 1, other = 1 - bigSide, bn = nounOf(f.docs[other]);
      options.push(`${bn.count ? f.start[other] + ' ' : ''}${names[other]} vs ${aArmy(bigSide ? B : A)} ${emo[bigSide]}`);
    }
    options.push(`${emo[0] || '🔥'} ${cap(names[0])} vs ${names[1]}`, `${names[0]} vs ${cap(names[1])} ${emo[1] || '🔥'}`);
    if (f.wild) options.push(`${names[0]} vs ${names[1]} 🤯`, `DREAM TEAM Battle: ${names[0]} vs ${names[1]}`);
    if (names[0] !== names[1]) options.push(`Can ${names[1]} Survive ${cap(names[0])}? ${emo[0] || '😳'}`);
  }
  // battle modes are the hook, so their titles come first; skins name the armies ("Neon Knights vs Shadow Knights")
  const nm = ids.map(t => (f.nations ? f.nations[f.teams[t]] : names[t]));
  const sk = ids.map(t => (f.skins && f.skins[t] ? tc(f.skins[t]) + ' ' : ''));
  const modeOpts = [];
  if (N === 2 && f.mode === 'king') modeOpts.push(`👑 Protect the KING: ${nm[0]} vs ${nm[1]}`, `Kill the KING to Win 👑 ${nm[0]} vs ${nm[1]}`);
  if (N === 2 && f.mode === 'duel') modeOpts.push(`⚔️ CHAMPION DUEL: ${nm[0]} vs ${nm[1]}`, `${nm[0]} vs ${nm[1]}, But Champions DUEL First ⚔️`);
  if (N === 2 && f.mode === 'heroes') {
    const h = f.heroes || 0, o = 1 - h, hn = nounOf(f.docs[h]), on = nounOf(f.docs[o]);
    modeOpts.push(`${f.start[h]} HEROES vs ${on.count && !f.wild ? f.start[o] + ' ' : ''}${names[o]} 🛡️`,
      `LAST STAND: ${f.start[h]} ${hn.count && !f.wild ? names[h] : 'Heroes'} vs ${on.count && !f.wild ? f.start[o] + ' ' : ''}${names[o]} 🛡️`);
  }
  if (N === 2 && f.mode === 'mirror') modeOpts.push(sk[0] && sk[1] ? `${sk[0]}${names[0]} vs ${sk[1]}${names[1]} 🪞` : `${names[0]} vs ${names[1]}: MIRROR MATCH 🪞`, `MIRROR MATCH: ${names[0]} vs ${cap(names[1])} 🪞`);
  if (N === 2 && f.mode === 'hill') modeOpts.push(`🚩 KING OF THE HILL: ${nm[0]} vs ${nm[1]}`, `Hold the HILL to Win? ${nm[0]} vs ${nm[1]} 🚩`);
  if (modeOpts.length) options.splice(0, options.length, ...modeOpts);
  else if (N === 2 && !f.nations && sk[0] && sk[1]) options.push(`${sk[0]}${names[0]} vs ${sk[1]}${names[1]} ${emo[0] || '🔥'}`);
  // sometimes lead with what happened instead (a strong, true outcome hint)
  if (facts.length && ((f.seed >>> 5) % 3 === 0)) options.push(...facts);
  let t = pick(options);
  if (t.length > 60) t = options.find(o => o.length <= 60) || t.slice(0, 60);
  return { title: t, kind: 'title' };
}

module.exports = { makeTitle, NOUN, nounOf };
