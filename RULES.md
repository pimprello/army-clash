# Video rules

Every new video reads `rules.json` when it is made, so a change here applies to the next video and every one after it. Videos that are already posted don't change.

## What you can change in `rules.json`

- **`teamPairs`**: which colours fight. Each video picks one pair at random. `weight` makes a pair more or less common: weight 3 comes up three times as often as weight 1. Which colour gets the top half is random.
- **`minColourGap`**: two teams must never look alike. Before a pair is used, the game measures how different the two colours look (and their darker shades, used on some troops) with the CIEDE2000 colour difference; a pair under this number (30) is skipped. Blue vs Purple was replaced for this reason, and Belgium's yellow was made lighter so it stands apart from the Netherlands' orange.
  Colours available: `RED`, `BLUE`, `GREEN`, `PURPLE`, `ORANGE`, `YELLOW`, `PINK`, `CYAN`, `WHITE`, `BROWN`, `LIME`, `TEAL`, `GOLD`, `SILVER`, `INDIGO`, `CORAL`.
  Nations (flag colours, flag emojis in titles, an accent ring on each troop, and the real flag drawn in the video: beside each score, on flag poles carried by about one troop in ten, in banners like "CANADA GRABS THE DROP", and above the winner's name at the end): `UK`, `USA`, `FRANCE`, `GERMANY`, `ITALY`, `BRAZIL`, `ARGENTINA`, `CANADA`, `SPAIN`, `PORTUGAL`, `AUSTRALIA`, `NEWZEALAND`, `NETHERLANDS`, `BELGIUM`, `SWEDEN`, `NORWAY`. Only friendly rivalries: never pair countries in an active or recent war, or with a painful wartime history.
- **`teamStyles`**: a colour can fight its own way. `ORANGE` armies are about 60% swordsmen (`swordsmenShare`), with a slightly smaller army (`budget` 0.96) so they still win about half their battles.
- **`matchups`**: the troop line-ups, used in order, then starting again from the top (56 at the moment). Each has a `top` and `bottom` side, optional `troops` (extra troop types to mix in, e.g. `["spearman", "healer"]`), and `balance`: the bottom army's size compared with the top, tuned by test battles so each line-up is close to 50/50.
  A side is either an army type or a custom team. Army types by genre:
  - Medieval: `SWARM`, `ARCHERS`, `KNIGHTS`, `BALANCED`, `GIANT` (has a giant)
  - Modern: `INFANTRY`, `ASSAULT`, `SNIPERS`, `ARMORED` (has a tank), `COMBINED`
  - Fantasy: `HORDE`, `ORCS`, `ELVES`, `MAGES`, `DRAGON` (has a dragon)
  - Sci-fi: `TROOPERS`, `ROBOTS`, `MECHS` (has a mech)
  - Pirates: `PIRATES`, `BUCCANEERS` (has a cannon)
  - Horror: `ZOMBIES`, `UNDEAD`, `VAMPIRES`
  - Samurai: `SAMURAI`, `NINJAS`
  Any two can meet: when they come from different genres the video is a mixed ("old vs new") battle.
  A custom team mixes any troops you like, from any genre, plus big units: `{ "name": "SPELLGUNS", "mix": { "wizard": 0.35, "rifleman": 0.45, "gunner": 0.2 }, "heavy": ["tank"] }`. `mix` is the share of each troop, `heavy` lists the big ones it brings (`tank`, `dragon`, `giant`, `mech`, `cannon`; repeat one to bring two). Keep the name to 13 letters or fewer so it fits the scoreboard. Custom-team videos get "dream team" titles that use the team names.
  `topTroops` / `bottomTroops` give one side its own extra troops, from any genre. `"pending": true` keeps a line-up out of the rotation until it has been balanced.
- **`creative`**: brand-new match-ups invented by the game. With `"every": 2`, every second video is a creative one: two custom teams made up on the spot from the video's seed (for example "Storm Mages: wizards and robots + a tank" vs "Dragon Bones: skeletons and zombies + a dragon"), each usually mixing genres and often bringing a big unit or two. Before rendering, the video runs `balanceBattles` quick test battles at each of `balanceSteps` army sizes (on the same map and formations) to make it about 50/50. Set `every` to 0 to switch them off. The other videos go through `matchups` in order.
- **`threeWay`**: three-way battles (1v1v1). With `"every": 4`, every fourth video is three armies at once; the other videos stay 1v1. The armies start at three points around the middle (top, bottom right, bottom left), each troop fights whichever enemy is closest, and the last army standing wins (at the time limit, the army with the most troops left). `teamTriples` lists the colour trios (any trio whose colours look too alike is skipped, like pairs), `maps` the battlefields it can use (`open`, and `canyon`: desert mesas). Half the three-way videos use the hand-made `lineups` (each a `three` list of three army types or custom teams, with a `balance` size for each army, and optional `maps` to limit where it's fought), the other half invent three custom teams on the spot and balance them with `balanceBattles` test battles over up to `balanceRounds` rounds. Three-way balancing steers by how long each army lasts and how many troops it keeps (three-way battles snowball, so wins alone are too jumpy), and halves each army's step whenever it swings past even. Set `every` to 0 to switch them off.
- **`cinematic`**: `true` turns on the director (see below). `false` gives the plain fixed camera.
- **`events`**: battle events that can happen. Remove a name to switch it off.
  - `airdrop`: two supply drops per battle, each a different kind. A plane (or a parachute in older eras) drops a crate on the middle line, or nearer the side that's behind if one is, troops race for it, and the first to reach it gets what's inside (the leader can still steal it). The crate's colour and icon show the kind: **squad** (wooden, gold band: a squad of that army's best troop), **med kit** (white, red cross: every troop on that side healed by half its health), **rage** (red, flame: that side hits 50% harder for 8 seconds, red-hot rings), **shield** (blue, shield: that side takes half damage for 8 seconds, blue bubbles), **speed** (yellow, lightning bolt: 35% faster for 8 seconds, speed lines), **big unit** (large steel crate with a gold star: a giant, tank, dragon, mech or cannon from that army's genre).
  - `airstrike`: in modern, sci-fi and mixed battles, the side that's behind calls in a jet (an orbital strike in sci-fi) on the thickest group of enemies.
  - Hazards that hit both sides: `meteors` (a meteor shower; a cannon barrage in pirate battles), `lightning` (a lightning storm), `tornado` (a twister crosses the field, flinging troops around), `blizzard` (snow sweeps the field and everyone slows down for 7 seconds) and `earthquake` (the ground cracks open along a line; troops on it get hurt and thrown aside, and the crack stays).
  About nine battles in ten get one big moment after the first drop: an airstrike (battles with planes) or one of the hazards.
- **`troopShares`**: in line-ups that include an extra troop, roughly what share of each army it makes up (0.15 = about 15%).
- **`formations`**: how each army lines up at the start. Each video takes the next formation for each side from this list (the two sides usually differ), shifting each time the line-up list starts over. Available: `line`, `wedge` (narrow tip at the front), `columns` (three columns), `crescent` (ends curve forward), `flanks` (two groups with a gap in the middle), `block` (narrow and deep).
- **`maps`**: the battlefields, rotating like the line-ups among those allowed for the battle's genre (`eras`; no list = every genre; `wild` = creative match-ups). `open` (no obstacles), `rocks` (boulders), `ruins` (stone pillars and walls), `trenches` (sandbag lines and craters), `city` (rooftops and crates), and three themed maps with their own ground colour: `forest` (dark green, trees and bushes), `bombed` (a bombed city: cracked asphalt, a road, ruined buildings, burnt-out cars and fires) and `enchanted` (a fantasy land: violet ground, a rune circle, crystals, giant toadstools and twinkling sparkles). The page around the arena keeps the same dark style on every map.
  Obstacles block movement, bullets and arrows; grenades, shells, fireballs, rockets and cannonballs fly over them, and dragons fly over everything. Troops find their way around obstacles to reach their target. Shooters with a target in range take cover beside or behind an obstacle when one is close, and move to get a clear shot when a wall is in the way. Every map is mirrored so both sides get the same ground.
- **`formationBudget`**: army size per formation, so no formation wins more often than a plain line. In test battles wedge and columns won more (58% vs 47%) and crescent and block won less (36%), so their armies are nudged by 0.5 to 1.5%.

## Titles

- **`clickbait`**: with `"every": 5`, every fifth video gets a short, funny teaser title instead of the usual one, with no team names, no hashtags and no tags, for example `Won With Only 2 Left 😱`, `The Biggest Comeback I've Ever Seen 😱`, `A Tornado Hit the Battlefield 🌪️` or `They Took Down a Dragon?! 🐉`. The teaser is always picked from what really happened in that battle (an underdog win, a near-tie, a comeback, a big unit falling, an airstrike or hazard), so it never misleads. The description still says it's a simulation.

Titles are written by `titles.js`, following research on what gets Shorts watched:
- **Short:** the hook fits in about the first 40 characters, where the mobile feed cuts titles off (4 to 6 words do best). Never more than 60.
- **One or two emojis**, picked for the content (🐉 for a dragon army, 🧟 for zombies, 🇬🇧 flags for nations, 😱 for a close finish), at the start to stop the scroll or right after the key word. Shorts with emojis averaged about 49% more views in a study of 128 million videos (a correlation, not a promise).
- **One or two words in CAPITALS** for emphasis (it works in gaming and entertainment), never the whole title.
- **Curiosity and an outcome hint** beat plain questions ("Who wins?" is weak in gaming); real numbers only when they are a real promise, like army sizes (`180 Zombies vs 90 Ninjas 🧟`).
- **No `#shorts` in the title** (most trending Shorts leave it out); the description has the hashtags.
- **Never "Red vs Blue" alone.** Titles name the armies (`150 Knights vs a DRAGON Army 🐉`, `🛡️ KNIGHTS vs Vampires`), the nations (`🇬🇧 UK vs USA 🇺🇸`), the custom team names in creative videos (`DREAM TEAM Battle: Storm Mages vs Dragon Bones`), or three-way hooks (`3 Armies, Only 1 SURVIVES 💀`).
- **Sometimes they lead with what happened** (`Won With Only 2 LEFT 😱`, `They Took Down a DRAGON? 🐉`, `One AIRSTRIKE Changed Everything ✈️`). Every such line comes from this battle, so titles never mislead, and the description always says it's a simulation.

## Cinematic director

With `cinematic` on, a director moves the camera and bends time, reacting to the battle:
- the video opens tight on the two front lines with film bars while "CHARGE!" plays;
- first blood is a slow-motion close-up;
- when a giant, tank, dragon, mech or cannon is about to fall, the camera gets there first and the fall plays in slow motion, with film bars and a deep thud;
- a blast that wipes out a group gets a quick slow-motion punch-in;
- a troop on a killing spree (6+ kills) gets followed for a moment with a kill counter over its head;
- airdrops, airstrikes and meteor showers each get their own shot (the airstrike lands in slow motion);
- FINAL PUSH and LAST STAND push in on the heaviest fighting, and the last troop of a losing army is followed in slow motion to the end;
- the outro slowly pushes in on the winners, or on the MVP (the winner's top fighter, who gets a gold crown).
Film bars in slow-motion moments are tall (about an eighth of the arena each) so those moments stand out. Kill streaks pop up over the troop that made them ("TRIPLE KILL", "RAMPAGE", "UNSTOPPABLE"), and the winner screen names the MVP with their kill count.
In between, it stays on the whole arena about half the time, sometimes drifting in on the busiest fighting. Time spent in slow motion is caught up gently (up to 1.3x) while the view is wide, so every video still ends at exactly 60 seconds. The battle itself plays out exactly as it would with a fixed camera: only the view and the pace change.

## Units

| Unit | Looks like | Notes |
| --- | --- | --- |
| Soldier | small circle | cheap, most common |
| Archer | triangle | shoots from range |
| Swordsman | circle with a sword | tougher than a soldier, only in some videos |
| Crossbowman | circle holding a crossbow | slow to reload, but fires fast, hard-hitting bolts that punch through armour; only in some videos |
| Spearman | circle with a long spear | stabs from the second rank, thrusts on each attack |
| Shieldbearer | dark circle behind a tower shield | slow wall; arrows barely hurt him and the shield blocks 40% of melee damage |
| Berserker | circle with an axe and war paint | very fast, hits hard, dies quickly |
| Healer | circle with a white cross | never attacks; stays back and heals the most hurt ally nearby (green beam and ring) |
| Knight | big ringed circle | heavy armour |
| *Modern:* Rifleman | circle with helmet and rifle | basic modern troop, single shots with yellow tracers |
| *Modern:* Machine gunner | darker circle, big gun, ammo box | rapid, spread-out bursts |
| *Modern:* Sniper | circle with long scoped rifle | very long range, one hard shot that cuts through armour |
| *Modern:* Grenadier | circle holding a grenade | lobs grenades in an arc that blow up groups |
| *Modern:* Tank | tracked hull with turret | one per ARMORED army; slow, armoured, fires explosive shells |
| *Modern:* Medic | circle with a white cross | the healer, in modern battles |
| *Fantasy:* Skeleton | bone-white circle with eye sockets | cheap and fast; arrows and bullets mostly pass through |
| *Fantasy:* Orc | circle with tusks and a club | tough brute |
| *Fantasy:* Elf | circle with a green hood and a bow | quick archer with long range |
| *Fantasy:* Wizard | star-shaped hat and a staff with a glowing orb | throws fireballs that burst over an area |
| *Fantasy:* Dragon | winged dragon with a shadow beneath | one per DRAGON army; flies over everything and breathes fire in a cone |
| Giant | huge circle with a crown | one per army, "Giant" armies only |
| *Sci-fi:* Laser trooper | white space helmet and a blaster | fast laser bolts glowing in the team colour |
| *Sci-fi:* Robot | round armoured chassis in the team colour, steel chest plate, domed head with one glowing eye, piston fists | metal brawler; arrows and bullets mostly glance off |
| *Sci-fi:* Mech | walking mech with a cockpit and rocket pods | one per MECHS army; fires salvos of three rockets |
| *Pirates:* Pirate | polka-dot bandana and a curved cutlass | quick melee fighter |
| *Pirates:* Musketeer | tricorn hat and a long musket | slow to reload, one big hit and a puff of smoke |
| *Pirates:* Cannon | wooden carriage and black barrel | one per BUCCANEERS army; lobs cannonballs from far away |
| *Horror:* Zombie | arms out, pale green head | slow and cheap; anyone living it kills gets back up as a zombie on its side |
| *Horror:* Vampire | pale face, slicked-back black hair, red eyes, a black cape and a team-colour collar | fast; every bite heals it by half the damage it deals (its eyes flare red); can't be turned by zombies |
| *Samurai:* Samurai | shoulder plates, gold-crested helmet, katana | armoured swordsman |
| *Samurai:* Ninja | black suit with a team-colour ring and headband | very fast, side-steps almost half of the arrows and bullets aimed at it |

## Changing anything else

Ask Claude in a session with this repository and describe the rule in plain words, such as "make knights rarer" or "add yellow vs orange". Claude edits the code or `rules.json`, tests it and pushes it, and the next video follows the new rule.

## Bullets

Machine guns show a tracer on every third round, like real tracer ammo, and all tracers are drawn together so busy firefights stay readable and fast. If more than 160 bullets are ever in the air at once, extra shots fold their damage into the next bullet instead of adding more.

## Stats and the autopilot

Every posted video's settings are logged to `videos.jsonl`. Once a day the post workflow fetches view counts into `stats/summary.md` (needs a `YT_API_KEY` GitHub secret). A daily autopilot run (see `AUTOPILOT.md`) reads those stats, adds new content and tunes these rules; every change is listed in `CHANGELOG.md`.
