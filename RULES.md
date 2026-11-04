# Video rules

Every new video reads `rules.json` when it is made, so a change here applies to the next video and every one after it. Videos that are already posted don't change.

## What you can change in `rules.json`

- **`teamPairs`**: which colours fight. Each video picks one pair at random. `weight` makes a pair more or less common: weight 3 comes up three times as often as weight 1. Which colour gets the top half is random.
- **`minColourGap`**: two teams must never look alike. Before a pair is used, the game measures how different the two colours look (and their darker shades, used on some troops) with the CIEDE2000 colour difference; a pair under this number (30) is skipped. Blue vs Purple was replaced for this reason, and Belgium's yellow was made lighter so it stands apart from the Netherlands' orange.
  Colours available: `RED`, `BLUE`, `GREEN`, `PURPLE`, `ORANGE`, `YELLOW`, `PINK`, `CYAN`, `WHITE`, `BROWN`, `LIME`, `TEAL`, `GOLD`, `SILVER`, `INDIGO`, `CORAL`, `MAGENTA`, `SKY`, `MINT`, `AMBER`, `CRIMSON`, `NAVY`, `LAVENDER`, `OLIVE`, `ROSE`, `SAND`.
  Nations (flag colours, flag emojis in titles, an accent ring on each troop, and the real flag drawn in the video: beside each score, on flag poles carried by about one troop in ten, in banners like "CANADA GRABS THE DROP", and above the winner's name at the end): `UK`, `USA`, `FRANCE`, `GERMANY`, `ITALY`, `BRAZIL`, `ARGENTINA`, `CANADA`, `SPAIN`, `PORTUGAL`, `AUSTRALIA`, `NEWZEALAND`, `NETHERLANDS`, `BELGIUM`, `SWEDEN`, `NORWAY`, `DENMARK`, `FINLAND`. Only friendly rivalries: never pair countries in an active or recent war, or with a painful wartime history.
- **`teamStyles`**: a colour can fight its own way. `ORANGE` armies are about 60% swordsmen (`swordsmenShare`), with a slightly smaller army (`budget` 0.96) so they still win about half their battles.
- **`matchups`**: the troop line-ups, used in order, then starting again from the top (113 at the moment). Each has a `top` and `bottom` side, optional `troops` (extra troop types to mix in, e.g. `["spearman", "healer"]`), and `balance`: the bottom army's size compared with the top, tuned by test battles so each line-up is close to 50/50. `combatBalance` is the same with intelligent combat on (see `combat`), because the melee moves and fewer bullets change which side is stronger.
  A side is either an army type or a custom team. Army types by genre:
  - Medieval: `SWARM`, `ARCHERS`, `KNIGHTS`, `BALANCED`, `GIANT` (has a giant), `VIKINGS` (berserkers behind a shield wall, spearmen and a few archers)
  - Modern: `INFANTRY`, `ASSAULT`, `SNIPERS`, `ARMORED` (has a tank), `COMBINED`
  - Fantasy: `HORDE`, `ORCS`, `ELVES`, `MAGES`, `DRAGON` (has a dragon)
  - Sci-fi: `TROOPERS`, `ROBOTS`, `MECHS` (has a mech)
  - Pirates: `PIRATES`, `BUCCANEERS` (has a cannon)
  - Horror: `ZOMBIES`, `UNDEAD`, `VAMPIRES`
  - Samurai: `SAMURAI`, `NINJAS`
  - Empire (medieval): `EMPIRE` (pikes, swords, archers, lancers, standard bearer, drummer, led by a general), `CAVALRY`, `LONGBOWS`, `ELEPHANTS` (two war elephants), `FORTRESS` (a walking fortress), `FORBIDDEN` (only peasants, who evolve)
  - Realms (fantasy): `WARBAND` (orc horde with wolf and boar riders and trolls), `SYLVAN` (elves, treants, druids, illusionists), `INFERNAL` (imps, demons, hellhounds, warlocks), `DWARVES` (dwarves, goblin engineers, a cannon), `CYCLOPS`, `GRIFFINS`, `HYDRA`, `TITAN`, `PHOENIX`, `GOLEMS`, `ARCANE` (mirror knights, phase reapers, false soldiers, alchemists, gravity monks, soul smiths), `TURTLES`
  - Mythic (fantasy): `THOUSANDMAN`, `COPYCATS`, `IMMORTAL`, `MIRRORKING`, `UNMAKER`, `TYCOON` (the Billionaire), `GRAVITY`, `METEOR`
  - Undead (horror): `LEGION` (skeletons and necromancers; 12 skeletons can fuse into a bone colossus), `DREADKNIGHT`
  - Sci-fi: `GLITCH`
  - Second batch, medieval: `SIEGE` (siege gunners and two catapults), `MAMMOTHS` (berserkers with two war mammoths), `CATHEDRAL` (the Walking Cathedral), `NEVERLOSE` (the Undefeated General), `PLAYER` (the Player's hand), `UNIVERSE` (soldiers, some of them the Universe), `LIVINGFORT` (the Living Fortress)
  - Second batch, fantasy: `FROST` (frost witches and dwarves with a mammoth), `TEMPEST` (storm callers), `SPIRITS` (forest spirits, druids, treants), `RHINOS` (orcs on war rhinos and boars), `OGRES`, `STAREATER`, `TIMELINE` (the Timeline Executioner), `STORMEMPEROR`, `WORLDROOT`, `HOURGLASS` (the Hourglass Titan), `MOONCALLER`, `GOBLINKING` (the Unqualified King)
  - Second batch, other genres: `LICHES`, `GARGOYLES`, `EMPTY` (the Empty Army) for horror; `DRONES`, `AIRBORNE` (an attack helicopter) for modern; `SIRENS` for pirates; `ASSASSINS` for samurai
  Any two can meet: when they come from different genres the video is a mixed ("old vs new") battle.
  A custom team mixes any troops you like, from any genre, plus big units: `{ "name": "SPELLGUNS", "mix": { "wizard": 0.35, "rifleman": 0.45, "gunner": 0.2 }, "heavy": ["tank"] }`. `mix` is the share of each troop, `heavy` lists the big ones it brings (`tank`, `dragon`, `giant`, `mech`, `cannon`; repeat one to bring two). Keep the name to 13 letters or fewer so it fits the scoreboard. Custom-team videos get "dream team" titles that use the team names.
  `topTroops` / `bottomTroops` give one side its own extra troops, from any genre. `"pending": true` keeps a line-up out of the rotation until it has been balanced.
- **`creative`**: brand-new match-ups invented by the game. With `"every": 2`, every second video is a creative one: two custom teams made up on the spot from the video's seed (for example "Storm Mages: wizards and robots + a tank" vs "Dragon Bones: skeletons and zombies + a dragon"), each usually mixing genres and often bringing a big unit or two. Before rendering, the video runs `balanceBattles` quick test battles at each of `balanceSteps` army sizes (on the same map and formations) to make it about 50/50. Set `every` to 0 to switch them off. The other videos go through `matchups` in order.
- **`threeWay`**: three-way battles (1v1v1). With `"every": 4`, every fourth video is three armies at once; the other videos stay 1v1. The armies start at three points around the middle (top, bottom right, bottom left), each troop fights whichever enemy is closest, and the last army standing wins (at the time limit, the army with the most troops left). `teamTriples` lists the colour trios (any trio whose colours look too alike is skipped, like pairs), `maps` the battlefields it can use (`open`, and `canyon`: desert mesas). Half the three-way videos use the hand-made `lineups` (each a `three` list of three army types or custom teams, with a `balance` size for each army, and optional `maps` to limit where it's fought), the other half invent three custom teams on the spot and balance them with `balanceBattles` test battles over up to `balanceRounds` rounds. Three-way balancing steers by how long each army lasts and how many troops it keeps (three-way battles snowball, so wins alone are too jumpy), and halves each army's step whenever it swings past even. Set `every` to 0 to switch them off.
- **`systems`**: the battle systems. Each can be switched off on its own (`false` or `0`); battles with all of them off play exactly as before they existed.
  - `evolution`: troops that keep killing evolve in three visible stages: VETERAN at 4 kills (one gold chevron, a bit bigger and stronger), ELITE at 8 (two chevrons, a gold ring and a mutation). The mutation depends on what it killed: troops that killed fliers grow WINGS (and fly), those that killed mages get a SPELL WARD (half damage from blasts), those that killed vampires turn VAMPIRIC; otherwise SPIKES (melee attackers get hurt back), REGEN, VENOM or SWIFT. A troop that brings down a giant, tank, dragon or boss earns a slayer title ("DRAGON SLAYER"). In the Forbidden Army it's faster and bigger: peasants become FIGHTERS at 2 kills and CHAMPIONS at 5, a peasant that kills a big unit becomes a slayer, a slayer that kills another becomes a GOD EATER, and a God Eater that touches a pocket singularity becomes a COSMIC ENTITY.
  - `champions`: the first troop on a side to reach 10 kills becomes that side's champion, with a made-up name (call signs like VIPER-6 for modern and sci-fi troops), a glowing aura and a kill counter over its head.
  - `traits`: this share of troops get a random trait, shown by a tiny icon: cowardly (runs when badly hurt), explosive (blows up when it dies), vampiric (heals when it hits) or undying (survives one killing blow).
  - `crits`: 7% of hits are critical (double damage, a knock back, an orange number); a crit that finishes a big unit gets a split-second freeze-frame. Damage numbers also show on big units and bosses (at most about seven a second).
  - `synergies`: armies with the right mix of troops get a bonus, announced at the start: SHIELD WALL (shields plus archers: archers +15%), PACK HUNT (wolf riders or hellhounds: faster), DARK RITUAL (necromancers plus skeletons: more raised), WAR DRUMS (a drummer plus orcs or berserkers: faster attacks), HELLFIRE (demons: hotter fire), CLOCKWORK (engineers plus dwarves: tougher turrets), NATURE'S CALL (druids plus treants: trees heal), SPELLBLADES (blades plus wizards), GUNS AND STEEL (gunners plus armour: tougher gunners), NINJA CLAN (ninjas plus samurai: faster ninjas).
  - `weather`: the chance (0.3) of weather for the whole battle: fog (shorter range for shooters), rain (fire is weaker), sandstorm (shots go wide), an eclipse (the dead and demons hit 25% harder) or a blood moon (every kill heals the killer by 30%).
  - `modifiers`: the chance (0.1) of a battle rule: low gravity (knockbacks fly much further), double speed, permanent night (shorter range) or reversed healing (healing hurts).
  - Bosses (the titan, hydra, fortress, dread knight, Mirror King, Gravity Tyrant) change at 75%, 50% and 25% health: a shockwave, harder hits, more speed, and at 25% a few troops come to help. Their name shows over their health bar.
  - Morale: if a general falls, its whole army panics for 3 seconds (slower, weaker, a "!" over each troop); a fallen standard bearer makes the troops around it panic briefly. A king's crown makes troops immune to panic.
  - `portals`: the chance (0.15) that a portal opens in the middle of the battle and neutral monsters come out (trolls and imps, a cyclops, wolf riders, a golem, demons and hellhounds, or a hydra) that attack whoever is closest. They're olive-green with a dashed ring and fade away at the end.
  - `suddenDeath`: if nobody is close to losing when about 60% of the battle has gone, one of: the arena shrinks inside a ring of fire, lava rises from both sides, a meteor storm, or a neutral titan crashes in.
  - `extinction`: if one army is crushing everyone else (still most of its army, the others under 30% and four times weaker), an ancient hunter (a titan) wakes up and goes after that army only.
  - `weaponDrops`: fallen troops sometimes drop their weapon; the next troop to walk over it hits 25% harder.
  - `destructible`: walls, rocks, pillars, trees and other cover can be broken by blasts and titans (trees catch fire), leaving rubble; big blasts leave craters in the ground.
  - `bossTransform`: when a general (or the Undefeated General) is one of the last two troops of its army, it transforms into a monster: huge, three times the damage, stomping.
  - `livingWeapons`: weapons nobody picked up can come alive later in the battle as flying living blades that attack everyone (at most four a battle).
  - `powerups`: ten more supply-drop kinds (each crate shows its own icon), **clone ray** (copies six of that side's troops) and **ghost army** (the last 10 fallen troops come back as ghosts for 14 s), plus: **time freeze** (every enemy frozen for 3 s), **portal** (a squad steps out behind the enemy lines), **phoenix heart** (the last 8 fallen troops come back at half health), **chain lightning** (a bolt jumps between 10 enemies), **chaos dice** (giant size, tiny enemies, speed, confusion, full heal or a shockwave), **evolution crystal** (the best troop jumps to ELITE with a mutation), **pocket singularity** (pulls enemies together, then blows them apart) and **king's crown** (the strongest troop leads: troops near it hit 30% harder for 10 s).
- **`combat`**: intelligent combat, so the beauty of the fighting is easy to follow (`"on": false` switches all of it off and battles play exactly as before it existed).
  - `armySize` (0.8): both armies are 20% smaller.
  - `hp` (1.3): every troop is 30% tougher, so fights last long enough to see the moves (smaller armies with deadlier moves otherwise end too soon).
  - `moves`: melee troops fight with visible moves that depend on their weapon, each with a short trail and a callout (at most three on screen a second): blades **PARRY** a frontal blow and **RIPOSTE**; shields **BLOCK** most of a hit and every third swing is a **SHIELD BASH** (knock back); axes and clubs **CLEAVE** everyone in an arc; spears, pikes and lances **PIERCE** through to the troop behind; maces and hammers can **STUN** (stars over the head); agile troops (ninjas, duelists, assassins, elves) **DODGE**. Basic soldiers and skeletons carry different weapons (sword, sword and shield, axe, spear, mace), knights carry a war hammer and giants a club, so you can tell troops apart at a glance.
  - `fewerBullets`: rapid-fire guns (machine guns and the like) fire half as many rounds, each doing double damage: the same firepower, far fewer bullets on screen.
  - `roster`: for the first four seconds a card over the scoreboard shows each army's three main troops: a portrait, the name, what it's good at (PARRIES, CLEAVES, ANTI-CAVALRY, BULLET-PROOF...) and how many there are. Close-up name tags show the specialty too.
  - `creativeMelee` (0.75): in creative match-ups, the main troop of each made-up team fights hand to hand three times in four.
  - Balance: combat changes who is strong, so every 1v1 video is tuned on the spot before it's rendered: `balanceBattles` quick test battles at each of up to `balanceSteps` sizes for the bottom army, between the line-up's size divided and multiplied by `balanceSpread`, stopping early once it's close to even or after `balanceSeconds` (so a video is never held up). It starts from the size the same line-up and mode ended up with last time (saved in `videos.jsonl`), so each line-up gets closer to 50/50 every time it comes round. Hand-made three-way line-ups are re-tuned the same way over `balanceRounds3` rounds. Damage numbers are capped at three a second.
- **`tribes`**: living tribes (`"on": false` switches all of it off; battles then play exactly as before it existed).
  - **Who they are:** every army is two tribes (in three-way battles each army is one tribe). They come from a fixed pool of 16 invented tribes per genre (`TRIBE_POOL` in `engine.js`: *Iron Boar Clan*, *Coven of Ash*, *Viper Company*, *Helix Cohort*, *Saltfang Crew*, *House of the Red Crane* and so on), each with an emblem and a trait: **smiths** (forge 20% cheaper), **traders** (better trade prices), **hunters** (25% more loot), **miners** (60% more iron), **zealots** (8% harder hits while their chief lives) or **stoneskin** (8% less damage). The same tribes come back video after video. If an army has a clear second role, its tribes follow it (fighters and shooters, or riders and foot soldiers); otherwise they're its left and right wing.
  - **Chiefs:** each tribe's best regular troop is its chief: 60% tougher, a little bigger, carrying the tribe's banner. When a chief falls, "CHIEF OF ... FALLS!" and the tribe panics for a moment.
  - **Feud:** one tribe on each side can have a blood feud (10% harder hits against each other, "BLOOD FEUD!" the first time they clash): always when they met in an earlier video, otherwise with `feudChance`.
  - **Story:** two short lines typed out under the battle timer for the first six seconds, the most dramatic one that's true: revenge (they met before and the other tribe won), a winning streak, a tribe that has never won, a raid on a forge (the feud), an oath between two tribes, a first battle, or both armies wanting the same prize. Every battle is fought for something on its map (the mountain pass, the treasure cove, the sky-temple relic...). The outro says who took it ("THE IRON BOAR CLAN TAKE THE MOUNTAIN PASS · REVENGE! · 31 KILLS"). The description has the story too, marked "made up for fun".
  - **Economy (`economy`):** a kill pays the killer's tribe `killGold` × the fallen troop's cost in gold; losses pay `lossGold` × cost (a war chest, so a tribe that's behind can still catch up); each camp digs one iron every `ironEvery` seconds. Each tribe's camp is drawn behind its lines (an anvil, a fire and its banner).
  - **The forge:** every 2 seconds each tribe's quartermaster buys the next upgrade if it can: the k-th costs `forgeGold` × k gold and `forgeIron` × k iron. Weapons (+10% damage per tier) when it's winning its fights, armour (−8% damage per tier) when it's taking more than it deals; three tiers each, named for the genre (IRON, STEEL, RUNIC blades; HOLLOW-POINT, ARMOUR-PIERCING, INCENDIARY rounds; MK II, MK III, PLASMA weapons; KEVLAR, CERAMIC, TITANIUM armour...). Troops show it: a glint at the weapon in the tier's colour (the top tier glows), a metal arc on the shoulders for armour, and forge sparks when they upgrade.
  - **Trading (`trading`):** when one tribe is short of iron or gold and its sister tribe has some to spare, they trade at `ironPrice` gold for one iron (traders get 20% better), at most once every `tradeGap` seconds per army. A little cart carries the goods along the back line, and they only change hands when it arrives.
  - **The merchant (`merchant`):** about 40% of the way through, a merchant's wagon comes in at one side for 8 seconds. Each army's richest tribe can buy one thing: the **Rune of Fury** (its weapons jump to the top tier, 45 gold), **Sellswords** (four hired swordsmen in grey cloaks join it; *mercenaries* with rifles or blasters in modern and sci-fi battles; 40 gold) or the **War Horn** (30% faster and harder for 6 seconds, 30 gold). The army that's behind gets 30% off.
  - **Tactics (`tactics`):** every 1.5 seconds each tribe picks a tactic from what it is and what's happening, shown as a tag with its emblem over the tribe and on the panel: **SHIELD WALL** (fighters under heavy fire keep together and advance steadily, taking 15% less from shots), **FLANK** (riders swing wide and go for shooters and healers), **FOCUS FIRE** (shooters pick one target together, marked with a reticle), **HOLD THE LINE** (shooters back off from charging enemies while they keep shooting), **PROTECT THE CHIEF**, **SURROUND** (fighters spread round a giant, tank or other big enemy), **CHARGE** (when the enemy is broken) and **REGROUP** (badly hurt troops fall back to a healer or their chief for a few seconds, once).
  - **The war council panel:** under the battle timer, one row per tribe: its emblem and name, its tactic, gold, iron, weapon and armour tiers and its trait, and under the rows the last two things that happened (a forge, a trade, a feud, a fallen chief, the merchant).
  - **The chronicle:** every video records which tribes fought, their kills and who won (`videos.jsonl`). The next stories are built from that, and `TROPHIES.md` gets a tribes' chronicle: standings, great rivalries and the latest results.
- **`modes`**: battle modes for 1v1 videos (they roll their own dice, so the line-up, map and formation rotation is unchanged). `shares` sets how often each comes up (`classic` is a normal battle):
  - `king` (**Protect the King**): each army has a king (purple cape, gold crown, sceptre, a glowing gold ring) waiting at the back. A royal shield (a gold bubble) protects him for the first 40% of the battle (he takes a quarter of the damage), then "THE ROYAL SHIELDS ARE DOWN!". When a king falls, his army loses heart for the rest of the battle: weaker, slower, a "!" over every troop.
  - `duel` (**Champion Duel**): each army's best fighter steps into the middle and they duel (three times the health) while both armies hold the line and watch; when one falls (or after 11 seconds), everyone charges.
  - `heroes` (**Last Stand**): one army is a small band of heroes (30% of its troops, each with 2.2 times the health and 1.6 times the damage, a gold ring) against a full army. Only for armies that are a crowd of one kind (not one-of-a-kind bosses).
  - `mirror` (**Mirror Match**): the same army on both sides (one of the two from the line-up), told apart by colour and by skin. Only for crowd armies.
  - `hill` (**King of the Hill**): a hill in the middle with a flag; the army with more troops on it slowly takes it (a ring fills with its colour), and while it holds the hill its whole army hits 25% harder.
  Each mode has its own hook under the logo, its own titles (`👑 Protect the KING: Knights vs Orcs`, `25 HEROES vs 80 Zombies 🛡️`, `Neon Samurai vs Shadow Samurai 🪞`) and a line in the description saying how it works. `heroStart` is where the last-stand tuning starts.
- **`skins`**: army looks (they never change how troops fight). Each army gets a skin with this `chance` (both armies in a mirror match always do, and never the same one): `royal` (gold trim), `neon` (glow and bright rings), `shadow` (dark smoke, violet rings), `frost` (icy glow and frost sparkles), `lava` (orange glow and embers), `ghost` (pale glow, dashed rings), `toxic` (green glow and bubbles) and `gold` (golden). The skin's name goes in front of the army's name on the scoreboard and roster card ("NEON KNIGHTS").
- **`cinematic`**: `true` turns on the director (see below). `false` gives the plain fixed camera.
- **`events`**: battle events that can happen. Remove a name to switch it off.
  - `airdrop`: two supply drops per battle, each a different kind. A plane (or a parachute in older eras) drops a crate on the middle line, or nearer the side that's behind if one is, troops race for it, and the first to reach it gets what's inside (the leader can still steal it). The crate's colour and icon show the kind: **squad** (wooden, gold band: a squad of that army's best troop), **med kit** (white, red cross: every troop on that side healed by half its health), **rage** (red, flame: that side hits 50% harder for 8 seconds, red-hot rings), **shield** (blue, shield: that side takes half damage for 8 seconds, blue bubbles), **speed** (yellow, lightning bolt: 35% faster for 8 seconds, speed lines), **big unit** (large steel crate with a gold star: a giant, tank, dragon, mech or cannon from that army's genre).
  - `airstrike`: in modern, sci-fi and mixed battles, the side that's behind calls in a jet (an orbital strike in sci-fi) on the thickest group of enemies.
  - Hazards that hit both sides: `meteors` (a meteor shower; a cannon barrage in pirate battles), `lightning` (a lightning storm), `tornado` (a twister crosses the field, flinging troops around), `blizzard` (snow sweeps the field and everyone slows down for 7 seconds), `earthquake` (the ground cracks open along a line; troops on it get hurt and thrown aside, and the crack stays), `stampede` (wild mammoths and rhinos charge across both halves at once; not in modern or sci-fi battles) and `kraken` (pirate battles only: six tentacles rise out of the ground, sweep round and squeeze whoever they catch).
  About nine battles in ten get one big moment after the first drop: an airstrike (battles with planes) or one of the hazards.
- **`troopShares`**: in line-ups that include an extra troop, roughly what share of each army it makes up (0.15 = about 15%).
- **`formations`**: how each army lines up at the start. Each video takes the next formation for each side from this list (the two sides usually differ), shifting each time the line-up list starts over. Available: `line`, `wedge` (narrow tip at the front), `columns` (three columns), `crescent` (ends curve forward), `flanks` (two groups with a gap in the middle), `block` (narrow and deep).
- **`maps`**: the battlefields, rotating like the line-ups among those allowed for the battle's genre (`eras`; no list = every genre; `wild` = creative match-ups). `open` (no obstacles), `rocks` (boulders), `ruins` (stone pillars and walls), `trenches` (sandbag lines and craters), `city` (rooftops and crates), and three themed maps with their own ground colour: `forest` (dark green, trees and bushes), `bombed` (a bombed city: cracked asphalt, a road, ruined buildings, burnt-out cars and fires) and `enchanted` (a fantasy land: violet ground, a rune circle, crystals, giant toadstools and twinkling sparkles). `castle` (Castle Siege: each army starts in front of its own castle wall, with a main gate between round towers and open flanks, flagstone courtyards behind and catapult craters in the middle; troops have to go round the walls, but arrows, bullets and spells fly over them, as if shot from the battlements. Medieval, fantasy, samurai, horror, old-vs-new and creative battles.) The page around the arena keeps the same dark style on every map.
  Eight more themed maps, each with its own ground and cover: `beach` (Pirate Beach: sand, palm trees, rocks and cargo crates, with surf along both sides), `snow` (Snowy Pass: snowy pines and snow-capped boulders), `dunes` (Dune Sea: rippled sand, barrel cactus and mesas), `swamp` (Murk Swamp: dead trees, reeds and puddles of black water), `neon` (Neon City: dark blocks with glowing neon edges on a street grid), `temple` (Sky Temple: stone tiles, rows of pillars, guardian statues and a crystal altar), `graveyard` (Haunted Graveyard: rows of tombstones and dead trees) and `moon` (Moon Base: grey dust, craters and base modules). Each is listed for the genres it suits.
  Maps whose ground does something (the same for both sides, mirrored top to bottom): `godboard` (a giant chessboard; every few seconds squares light up, red ones strike with lightning and gold ones make troops 30% stronger), `furnace` (the World Furnace: lava rivers pour across the field and move every 10 seconds; fireproof troops don't care), `frozen` (the Frozen End: troops slide on the ice and shoot a little shorter in the cold; big units crack the ice until it breaks into icy water), `grave` (the Titan's Grave: a giant skeleton across the field; its ribs are cover and a pair collapses every few seconds), `overgrown` (the Overgrown Kingdom: vines slow troops, thickets hide them from archers further than a short distance away, statues wake up and strike), `clockwork` (the Clockwork Colosseum: round platforms turn and carry troops round, giant gears, and the gears reverse a third of the way in), `shattered` (the Shattered Sky: floating islands joined by three bridges; shots fly over the void, but troops knocked off fall) and `mirror` (the Mirror Dimension: every 12 seconds the whole battle flips left to right and mirror images of a few troops appear).
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
- **Battle modes lead the title** (`⚔️ CHAMPION DUEL: Samurai vs Ninjas`, `🚩 KING OF THE HILL: UK vs France`), and their outcome lines only appear when they really happened (`They Killed the KING 👑`, `The DUEL Decided Everything ⚔️`, `25 HEROES Held the Line 🛡️`, `The HILL Changed Hands 4 TIMES 🚩`). When both armies have a skin, a title can use them (`Frost Knights vs Lava Orcs`).
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
| *Empire:* Pikeman | steel helmet and a very long pike | stabs from far back; triple damage against cavalry and big units |
| *Empire:* Duelist | red bandana and two swords | very fast attacks |
| *Empire:* Royal guard | gold-ringed armour, red plume, halberd | elite defender; blocks a quarter of every blade |
| *Empire:* Lancer | rider with a long lance and team pennant on a brown horse | a run-up turns the next hit into a charge (triple damage, throws the target back), then it wheels away to charge again |
| *Empire:* Horse archer | rider with a fur cap and a bow on a tan horse | rides circles round its target while shooting |
| *Empire:* Longbowman | brown hood and a tall bow | the longest range of any archer |
| *Empire:* Fire archer | red hood, flaming arrow | arrows set troops alight (damage over 3 s) |
| *Empire:* Poison hunter | dark green hood, blowpipe | poison darts (damage over 4 s, a little slower) |
| *Empire:* Standard bearer | big banner in the team colour (the flag in nation battles) | allies near it take 20% less damage; troops near it panic for a moment if it falls |
| *Empire:* Drummer | drum and two sticks | allies near it attack 25% faster |
| *Empire:* General | gold helmet and team-colour cape on a white horse | allies near it hit 20% harder; the whole army panics for 3 s when the general falls (one per EMPIRE army) |
| *Empire:* Peasant | straw hat and a pitchfork | cheap; the Forbidden Army is all peasants (see evolution) |
| *Empire:* War elephant | grey elephant with ears, trunk, tusks and a team howdah | tramples whatever it walks through and throws troops aside |
| *Empire:* Walking fortress | a stone castle on four legs, team banners on its towers | archers on its walls shoot three targets, a gate cannon fires every few seconds, and its garrison pours out when it falls |
| *Undead:* Necromancer | dark robe, staff with a glowing skull | green soul bolts; raises fallen troops nearby as skeletons (at most 40 a battle) |
| *Undead:* Bone colossus | a huge skeleton with a rib cage and burning eyes | what 12 skeletons of an Undead Legion fuse into |
| *Undead:* Dread knight | black armour, glowing sword, nightmare horse with red eyes | boss; hunts generals and big units and grows stronger with each |
| *Orcs:* Wolf rider | orc on a grey wolf | the fastest troop; goes for archers, gunners and healers |
| *Orcs:* Boar rider | rider with a spear on a tusked boar | charges, and every hit knocks the target back |
| *Orcs:* Troll | big green brute with tusks and a club | heals itself all the time (fire stops it) |
| *Orcs:* Cyclops | one-eyed giant holding a boulder | throws boulders into groups |
| *Sylvan:* Druid | antler hood, leafy staff | a healing pulse for everyone near it, plus bark skin (25% less damage for 3 s) |
| *Sylvan:* Treant | walking tree with leafy crown | its hits root troops in place; fire hurts it more |
| *Sylvan:* Illusionist | white mask, floating orbs | makes fake troops that enemies go for first |
| *Infernal:* Imp | small red flier with bat wings | spits fire bolts |
| *Infernal:* Demon | dark red, curved horns, claws | stronger the more troops have died in the battle (glows) |
| *Infernal:* Hellhound | black dog with a fiery mane | fast; its bite sets troops alight |
| *Infernal:* Warlock | horned hood, staff with a fire orb | hellfire that leaves the ground burning; once a battle its army takes over the enemy's biggest unit |
| *Dwarves:* Dwarf | orange beard, horned helmet, axe | sturdy and well armoured |
| *Dwarves:* Goblin engineer | green goblin with goggles and a wrench | builds up to two crossbow turrets (turrets aren't counted as troops) |
| *Dwarves:* Stone golem | blocky stone body with a glowing rune | can't be knocked back or pushed |
| *Monsters:* Hydra | scaly body with three heads on long necks | each head bites a different troop; five heads once it's badly hurt |
| *Monsters:* Ancient titan | stone giant with team pauldrons and glowing eyes | stomps groups, throws troops aside and smashes walls |
| *Monsters:* Phoenix | firebird with flaming wings | flies and breathes fire; rises once from its ashes, and leaves a firestorm when it falls for good |
| *Monsters:* Griffin rider | rider on a winged griffin | flying cavalry that dives at its target |
| *Arcane:* Mirror knight | polished silver knight with a mirror shield | turns into a copy of the last enemy troop that hits it |
| *Arcane:* Phase reaper | hooded wraith with a scythe | vanishes, passes through the enemy lines and reappears behind its target for a huge hit |
| *Arcane:* Plague alchemist | goggles, apron, green flask | flasks leave poison clouds that slow and poison |
| *Arcane:* Gravity monk | orange robe, orbiting stones | pulls nearby enemies together into a clump |
| *Arcane:* Soul smith | apron, hammer, orbiting soul lights | collects souls of the fallen and forges armour and blades for nearby allies |
| *Arcane:* False soldier | looks exactly like an ordinary soldier | when an enemy gets close it bursts into spikes and leaves scarecrow decoys |
| *Arcane:* Fortress turtle | a big shell of hexagon plates | plants itself near enemies; its shell then soaks up shots meant for the troops behind |
| *Mythic:* Thousand-Man | a mass of fused bodies with arms everywhere | every troop it kills joins its body; it keeps growing and starts stomping |
| *Mythic:* Copycat | purple shapeshifter with a white mask | an army of them copies the biggest enemy unit every few seconds |
| *Mythic:* Immortal Fraud | gold armour, smug mask, fake halo | comes back four times, stronger but with a new weakness each time; the last time as a boss |
| *Mythic:* Mirror King | silver king with a crown and orbiting mirror shards | troops that hit it can spawn mirrored copies of themselves on its side |
| *Mythic:* Eye of the Unmaker | a floating eye with tentacles | turns troops into sheep, armour into flesh, and fliers fall out of the sky |
| *Mythic:* Billionaire | gold suit, top hat, money bag | never fights; bribes enemy troops to switch sides |
| *Mythic:* Gravity Tyrant | dark armour, glowing core, orbiting debris | drags every enemy around it in, then slams the ground |
| *Mythic:* Meteor Shepherd | starry hood, star banner, a little meteor | calls meteors down on the thickest groups; bigger the longer it lives |
| *Mythic:* The Glitch | flickering red/blue double image | changes the rules every few seconds: swaps troops around, turbo speed, zero gravity, clones itself |
| *Magic:* Frost witch | ice-blue hat, staff with a spinning ice crystal | frost bolts slow everyone they splash and sometimes freeze troops solid for a moment |
| *Magic:* Lich | skull with green eyes under a gold circlet, orbiting souls | every few seconds drains life from the three nearest enemies and gives it to its army |
| *Magic:* Storm caller | dark hood, staff crackling with lightning | calls lightning down on its target |
| *Magic:* Forest spirit | small glowing wisp with a trail | fast flier; heals the allies around it when it fades |
| *Magic:* Gargoyle | stone bat wings, horns, red eyes | flier; when badly hurt it turns to stone for a moment and can't be damaged |
| *Magic:* Siren | flowing teal hair and a pink shell | her song charms up to six enemies: they stop fighting and walk towards her (pink hearts) |
| Assassin | black hood, team sash, two daggers | invisible until it strikes (four times the damage), goes for generals and big units, then fades out again |
| Siege gunner | brass helmet, short fat mortar | shells clustered troops from very far away |
| Catapult | wooden frame on wheels, throwing arm | hurls boulders across the field |
| War mammoth | shaggy brown mammoth with curling tusks and a team howdah | tramples and throws troops aside |
| War rhino | grey rhino with a team armour plate | charges with its horn (triple damage), backs off and charges again |
| Ogre | big olive brute with a club | eats a wounded ally every few seconds to heal and grow |
| Kamikaze drone | quadcopter with a blinking light | flies straight at its target and blows up |
| Attack helicopter | team-colour gunship with a spinning rotor and rocket pods | machine gun, plus two rockets every few seconds |
| Empty armour | a floating suit of armour with nothing inside | every troop the Empty Army kills gets back up as an empty copy of itself on its side (at most 40) |
| Living blade | a spinning sword with an eye on the hilt | a weapon that came alive (living weapons); attacks everyone |
| *Mythic:* Star Eater | a void full of stars, tentacles, a toothy maw, six eyes | swallows the sun: the field darkens, enemies see less and slowly wither, then it opens a black hole |
| *Mythic:* Timeline Executioner | black hood, clock on its back, a broad axe, a ring of clock marks | sends the enemies around it a few seconds back in time and executes two of them while they reset |
| *Mythic:* Walking Cathedral | a cathedral on stone feet, rose window, bell tower | archers in its windows; its bell raises the dead around it as skeletons and heals its army |
| *Mythic:* Storm Emperor | a storm dragon with lightning in its wings and a crown of horns | lightning hunts the strongest enemy, wing gusts throw troops back, and when it dies the storm stays for the rest of the battle (lightning in mirrored pairs) |
| *Mythic:* The Worldroot | a giant tree with glowing fruit | plants itself, then its roots spread over the field (slowing and draining enemies) and new treants and spirits grow |
| *Mythic:* Hourglass Titan | a stone titan with an hourglass in its chest | ages wounded enemies into skeletons that fight for it, turns back time on its own troops' wounds, rusts machines |
| *Mythic:* Moon Caller | silver hood, crescent moon staff | pulls the moon closer: enemies get heavier, fliers fall out of the sky, and the tide rises on both edges |
| *Mythic:* Unqualified King | a tiny goblin in a huge crown and cape | can't fight at all; enemy troops near him defect to his army ("ALL HAIL!") |
| *Mythic:* Undefeated General | gold armour and laurels on a golden horse | when its army is about to lose (or it's about to fall), the whole battle rewinds about 12 seconds once, and its army hits a quarter harder |
| *Mythic:* The Player | a giant white cartoon glove with a team cuff | picks troops up (even tanks) and throws them into the thickest enemy group |
| *Mythic:* The Universe | looks like an ordinary soldier, with stars in its helmet | when it dies a universe opens and a whole squad of a random army pours out |
| *Mythic:* Living Fortress | an ordinary castle (labelled CASTLE) | wakes up when enemies come close: legs, arms, glowing eyes, and a gate full of teeth that swallows troops whole |

## Layout check

`node check-layout.js` draws the roster card, the tribes' story, the war council panel and the outro line for every line-up, the three-way line-ups and some invented match-ups, and fails if any two texts or portraits overlap, if a text had to be squashed to fit, is smaller than allowed (18 px on the panel) or leaves its area. Run it after any change to the overlays (it takes a few minutes; `node check-layout.js 20` checks the first 20 line-ups).

## Changing anything else

Ask Claude in a session with this repository and describe the rule in plain words, such as "make knights rarer" or "add yellow vs orange". Claude edits the code or `rules.json`, tests it and pushes it, and the next video follows the new rule.

## Bullets

Machine guns show a tracer on every third round, like real tracer ammo, and all tracers are drawn together so busy firefights stay readable and fast. If more than 160 bullets are ever in the air at once, extra shots fold their damage into the next bullet instead of adding more.

## Stats and the autopilot

Every posted video's settings are logged to `videos.jsonl`. Once a day the post workflow fetches view counts into `stats/summary.md` (needs a `YT_API_KEY` GitHub secret). A daily autopilot run (see `AUTOPILOT.md`) reads those stats, adds new content and tunes these rules; every change is listed in `CHANGELOG.md`.
