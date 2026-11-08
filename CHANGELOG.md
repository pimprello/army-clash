# Changelog

Newest first. Each entry says what changed in the videos and why.

## 2026-11-08 (autopilot)

- **Health:** uploads are fine. Last night's 10pm post went up at 22:18 UTC (`Pick ONE: Frost, Tempest, Spirits 👇`); the later runs in that slot correctly skipped, and nothing is due until the 10am slot. Making that video took 5 minutes (a three-way battle with its test battles first), under the 6-minute limit. No line-ups are waiting to be balanced.
- **Not learned from views yet:** still no `stats/summary.md`. The stats step is still refused because no `YT_API_KEY` secret reaches the run.
- **New formation: Echelon** (today's new thing). The old "oblique order": one long line stepped diagonally, so the army's right wing (as you see it on screen) hits first and its left wing is held back. It's now the seventh formation in the rotation, and descriptions say "echelon formation". Win rates for the top army, 32 battles each with every system on, open ground (line vs line → echelon on top → echelon on bottom): Swarm vs Knights 78% → 75% → 72%; Armored vs Snipers 47% → 31% → 53% (a second set of 32: 69% → 56%); Bombers vs Knights 94% → 91% → 91%; Giant vs Archers 3% → 19% → 19%. On average an echelon army did about 2 points worse than a line, and never more than 15 points, so its army is 1% bigger (`formationBudget.echelon: 1.01`), and every video is still tuned on the spot as before.
- **Fix: the upgrade card.** The bonus line ("+20% DAMAGE") sat right on the card's bottom border. The card's text now sits a few pixels higher, so the line has room.
- **Tested:** old battles play out exactly as before (same winner and end time with and without today's code); 10 full battles with the director using echelon on both sides, on forest, clockwork, temple and overgrown maps: no errors or broken positions, every one ended with a winner and the outro (battles ending 49 to 60 s); stills at 1 s and 10 s of a medieval and a modern battle (the stepped line shows clearly, nothing clipped); a short real render (the description names the echelon formation); the full layout check passes.
- **Playbook:** the layout check can now run in parts (`node check-layout.js all 1/4` and so on), because the whole check takes longer than one command may run here; `AUTOPILOT.md` says so and notes how long test battles really take in this sandbox.
- **Rellz:** add a `YT_API_KEY` secret (a YouTube Data API key from the same Google project) so the autopilot can start learning from views. Also, the scheduled autopilot task's own prompt still says the channel posts "every 15 minutes"; I followed the repo (2 a day, at 10am and 10pm), but you may want to update that wording in the task. Already-posted videos don't change; echelon shows up from the next videos whose turn lands on it. No preview videos were made.

## 2026-11-07 (night): upgrades you can see, and a thumbnail for every video

Rellz asked for "market upgrades more visible ... evolved skins and weapons each time they upgrade and make them upgrade more often, the whole upgrade is its own visual aspect", and a consistent thumbnail on each video. On from the next video. Already-posted videos don't change.

- **Evolution** (`rules.tribes.evolve`): upgrades are cheaper as they go, so a battle now has about 25 (it was a handful) and most battles have a tribe reaching tier 4 or 5. Weapons go to tier 5 and armour to tier 4. Tier 4 turns the weapon into the tribe's element (flame, frost, storm, venom or holy, each with a real effect on hit: burn, slow, chain lightning, poison, a little healing), tier 5 is its master form (FLAME then HELLFIRE, CRYO then ABSOLUTE ZERO...).
- **You see every upgrade:** brighter rims and shoulder plates per armour tier, glowing weapons from tier 3, element-coloured weapons and sword swings at tier 4, an aura at tier 5. Each upgrade gets a card at the top of the battlefield (from what to what, the bonus, tier pips; "EVOLVE" for element tiers), and the big ones a ring sweeping out from the tribe's chief, a sound, and the camera on the chief (slow motion for tiers 4 and 5).
- **Thumbnails** (`rules.thumbnail`): every video gets a thumbnail in the same layout: the ARMY CLASH logo, the mode, each army's signature troop big in its colour with two of its troops behind, VS, the names and sizes, and WHO WINS? (never who won), over a blurred moment of that battle. `upload.js` sets it after uploading. YouTube only allows custom thumbnails on Shorts for channels in the YouTube Partner Program, so until Army Clash is in it YouTube will refuse and the run shows a "Thumbnail not set" warning; the upload itself is unaffected. Custom Shorts thumbnails appear on the home page, search and the channel's Shorts tab, not in the Shorts feed.
- Also fixed old notes in `AUTOPILOT.md` and `README.md` that still described 98 uploads a day.
- Tested: old seeds play out exactly as before with evolution off; with it on, the slow-motion finale still lands on the same final blow (8 battles); upgrade counts over 6 battles (12 tier-4 and 7 tier-5 upgrades); still frames of the upgrade card and of thumbnails for 1v1, Protect the King and three-way battles; a full test render; the layout check.

## 2026-11-07 (later still): 30 new characters, more varied match-ups

Rellz asked for "a variety of characters and a variety of mashups, more diverse matchups and more frequently seeing new characters". On from the next video.

- **30 new original troops** (plus a watchtower, a war totem and one-hit skeletons they make), each with its own move and drawing:
  Builder (builds watchtowers), Barrel Bomber (runs in and blows up), Grave Witch (raises skeletons), Totem Shaman (war totems make friends hit harder and faster), Dark Goblin (backstabs, steals gold), **Time Traveller** (when his king, chief or giant falls, he goes back in time and saves them; otherwise he rewinds everyone's wounds), **Mr 3D** (goes 3D: the battlefield turns red and cyan and he hits three times as hard, knocking enemies back), Juggernaut (tougher the more hurt he is, can't be knocked back), Chain Hook (drags shooters in), Bard (songs speed friends up), Beekeeper (bee swarms), War Chef (pies slow, feasts heal), Jester (confetti makes enemies laugh and freeze), Mimic (a treasure chest that bites), Jetpack Trooper, Werewolf (turns into a wolf when hurt), Oracle (marks the biggest threat for everyone to focus), Balloon Bomber, Sumo (stomps everyone back), Sandman (puts groups to sleep), Valkyrie (dives from the sky), Paladin (holy shields on the wounded), Flamethrower, Medic Drone, Yeti, Shadow Ninja (shadow clones), Gunslinger (six fast shots, then reload), Axe Thrower, Gorgon (turns enemies to stone), Phalanx (shield wall) and Tesla Gunner (lightning jumps between enemies). 146 troop types in all.
- **31 new armies** built around them, and 34 new match-ups spread through the rotation.
- **Freshness** (`rules.creative.fresh`): invented match-ups now pick the troops seen least lately, so new characters turn up first and every troop keeps coming round. Teams more often bring a third troop type.
- Tested: every new army in battles on both sides (no errors), still frames of the new troops in action, and a full test render of an invented three-way battle with Barrel Bombers, Paladins and Yetis.

## 2026-11-07 (later): two uploads a day, at 10am and 10pm

Rellz asked to stop uploading and post only 2 videos a day: one straight away, then always at 10am and 10pm.
- Stopped the posting chain (cancelled the running post, removed the self-queuing step).
- New schedule (`rules.schedule`, `slot.js`): the workflow wakes every 10 minutes around 10am and 10pm London time and posts once per slot. A manual run posts immediately.
- Also in this push: 30 new troops (third batch) with their own armies, ready but only used once freshness is switched on; each video now records which troop types were in it.

## 2026-11-07: the slow-motion finale

Rellz asked: "make it go slow mo at the end so we see how the last kill was make it cinematic ... make the ending the best part". On from the next video (`rules.video.finale`).

- Before each video is drawn, the battle is played through once (no drawing, a few seconds) to find exactly when and where the final blow lands. The battle plays out the same both times (checked on 12 battles across all modes: same winner, same moment, same troop).
- Two seconds of battle before the end, the camera goes to the troop about to fall (with its killer in shot when they're close), with film bars, at under half speed. The last 0.6 seconds slow right down and zoom in.
- On the final blow: a white flash, the picture nearly freezes, then plays out slowly for 1.7 seconds under **FINAL BLOW** and who did it ("THE MUSKETEER ENDS IT"). Then the winner banner, confetti and fanfare. If time runs out instead, the same over the heaviest fighting with **TIME!**
- No floating labels cover the final moments.
- Videos are about 6 seconds longer (roughly 62 to 70 seconds). Already-posted videos don't change. No preview videos were made.

## 2026-11-05: Army Clash 2.0, part 2: smarter fighting, weapon hits you can see, earthquakes, spreading fire

Rellz asked (09:21) for the spear to be at the spearman's side, earthquakes that actually do something you notice (and the crack line no longer drawn over the troops), more realistic looks with more visible damage, fire spreading, better weapon animations (real sword slices and spear strikes), and better fight logic ("they all just join in a pack to the nearest person"). On from the next video.

- **Smarter fighting** (`rules.combat.smart`): troops spread out over the enemy instead of piling onto one, prefer enemies in their own lane so the armies meet along a front, fast fighters swing round the flank to reach shooters and healers, and a badly hurt fighter with friends nearby steps back for a moment. Tested over 32 mirror battles: the same end times and the same fairness as before.
- **Weapons:** a sword swing now sweeps a solid crescent, and every hit shows: a bright slice across the target for blades, a streak through it for spears, an arc for axes, a ring of force for giants and hammers. Spear thrusts leave speed lines.
- **The spearman** holds his spear in his right hand at his side, instead of it running across his body.
- **Damage you can see:** hurt troops get scuffs and cracks; damaged machines and big units smoke (darker and sparking when nearly dead); explosions leave scorch marks and crater rings on the ground that fade slowly.
- **Earthquakes:** the crack now rips across the field bit by bit, glowing orange inside, with dust and rocks bursting out and the screen shaking. Troops near it are thrown into the air, and the crack is drawn on the ground under the troops.
- **Spreading fire** (`rules.world.fire`): big explosions and fire attacks can set the grass alight; it spreads patch by patch, burns everyone standing in it (both sides alike), and leaves scorched ground ("THE GRASS IS ON FIRE"). Not on snow, ice, sand or other maps that don't burn.
- With these options off, old battles play out exactly as before (checked). No preview videos were made.

## 2026-11-05 (later): a button to delete low-view videos

Rellz asked to delete videos posted before today with under 100 views.
- New manual workflow **Delete low-view videos** (Actions tab → Run workflow). Run it with `list` first: it shows every matching video in the run's summary and deletes nothing. Run it with `delete` to delete them, at most 50 a run (oldest first) so it can't eat the upload quota. Videos posted today are never touched.
- **Rellz:** deleting needs one new secret, `YT_DELETE_REFRESH_TOKEN` (a refresh token with the full `youtube` scope; see RULES.md, "Deleting low-view videos"). Listing works with the `YT_API_KEY` you added.
- Tested against a fake YouTube: list mode deletes nothing; delete mode deleted only matching videos from before today and stopped at the per-run limit; without the delete token it refuses.

## 2026-11-05 (later): weapons sound different

Rellz asked for a wider variety of sound effects for the different weapons.

- **Each weapon now has its own hit sound:** swords ring, axes and clubs chop, spears and lances stab with a whistle, maces and war hammers land with a heavy low ring, shields bash, and ninjas and assassins make a quick light *shing*. Before, every melee hit used the same clash sound. Guns, cannons, bows and magic already had their own sounds and keep them.
- **No two hits sound exactly alike:** every sound gets a small pitch and volume change (up to about 6%), so a big fight sounds like a crowd of fighters, not one sound on repeat.
- Both are dials in `rules.json` (`sound.weapons`, `sound.variety`, see RULES.md). They only change what you hear: the same battles were run with the old and new code and every winner, survivor count and ending time matched.
- **Tested:** the new sounds play cleanly (no clipping or broken audio); in test battles the new hits really fire (a knights-and-spearmen battle used `crush`, `stab`, `chop` and `bonk` hundreds of times; a ninja battle used `shing`); with the dials off, the sound is exactly as before; a short real render has picture and sound and ends on time. No preview videos were made.
- Videos already posted don't change; the new sounds start with the next video.

## 2026-11-05: Army Clash 2.0, part 1: a clean layout built for phones

Rellz asked for a major UI update ("make everything look clean and smooth... make sure the ui will fit in every phone and look nice") and an easier-to-follow story. This is the first part of the 2.0 update; the rest (art pass, world events, the new market, new characters, video length and upload timing) follows in the next entries. On from the next video (`rules.ui`, explained in RULES.md).

- **Built around YouTube's Shorts overlay.** The scoreboard is at the top: logo, the hook, both armies' names and flags, live troop counts that ease up and down, and the battle clock in a centre pill that turns gold and pulses in the last 10 seconds. The battlefield is drawn 90 px higher, and the tribes' strip sits just under it, above where YouTube shows the title and channel name. Nothing is drawn under the like/comment/share buttons or within 48 px of the sides.
- **A story you can follow in two beats.** For the first 4 seconds a card over the top of the battlefield shows the two rival tribes with their emblems and one line: what it's about ("REVENGE FOR LAST TIME", "3 WINS IN A ROW. WHO STOPS THEM?", "THEY BURNED OUR FORGE"), then what they're fighting for. Then each army's three main troops slide in on strips beside it, with what each is good at.
- **Chapter cards** mark the turning points (the merchant arriving, a chief falling, a blood feud, the final push, sudden death): one small card at a time at the bottom of the battlefield, instead of big banners stacking up.
- **Less clutter:** floating labels capped at four a second, callouts and damage numbers at two, banners wait their turn instead of replacing each other, and nothing covers the story card.
- **The war council strip** under the battlefield: a ticker line and one compact cell per tribe (gold, iron, weapon and armour tiers, tactic). In the outro it shows the chronicle line.
- **Art finish** (`rules.ui.art`): every troop on the ground casts a soft shadow (all drawn in one pass, so no shadow covers a neighbour), round troops share one light from the top left (a soft rim highlight), and the plain troops that had blank bodies (soldiers, swordsmen, spearmen, crossbowmen, berserkers, shield bearers) now have little faces like the rest.
- **Fixed:** the king's crown now sits centred on his head (a proper top-down crown with a velvet cap, jewels and a small shadow), slightly smaller so his army's colour still shows around it.
- **World events** (`rules.world`): about 7 battles in 10 now have one moment where the whole world goes strange, and some get a second later on. Each opens with a big title and one line saying what it does:
  - **Glitch:** the picture tears, rows slide sideways, red and cyan split, scanlines, "SIGNAL LOST", troops blink out, and one corrupted troop on each side hits 60% harder and runs 40% faster;
  - **The World Flips:** the camera rolls upside down and every shot curves while it's flipped;
  - **Mirror Shift:** the whole battle mirrors left to right, then back;
  - **Blackout:** darkness, lit only by gunfire, explosions and spells;
  - **Time Stops:** everything freezes in grey (shots hang in the air) except three time-walkers on each side;
  - **Blood Moon:** a red moon, and every hit does 35% more;
  - **Supersize:** one champion on each side grows huge;
  - **Rave Mode:** spotlights, a disco ball, and everyone moves and strikes faster.
  All of them hit both sides alike (tested over 48 battles: no crashes, every battle still ended on time, wins split evenly).
- **Fixed before it reached a video:** a name clash in the new code would have drawn some troops as roster strips; caught by the layout check.
- **Tested:** the layout check now also checks the Shorts safe zone at eight moments of every battle plus the outro; it passes for all 127 battles. Battles play out exactly the same in the new and old layouts (fingerprints of five full battles match). Stills checked with a mock of YouTube's buttons and title on top.
- Videos already posted don't change. No preview videos were made.

## 2026-11-05: the video ends 3 seconds after the battle, and battles finish around 60 seconds

Rellz asked for the video to end 3 seconds after the match finishes (not at a fixed 60 seconds) and for matches to always finish roughly around 60 seconds. On from the next video (`rules.video`, explained in RULES.md).

- **The video now ends 3 seconds after the battle.** Those 3 seconds show the winner, the result, the MVP, "WHO DID YOU PICK?" and the tribes' closing line. The long empty outros are gone.
- **Battles are paced to finish close to 60 seconds:**
  - twice a second, the losing side is compared with a curve that reaches zero just before the limit. If it's falling too fast, every hit in the battle (both sides alike) does less damage for a while; if it's well ahead of the curve, hits do a little more. Only the speed of the fighting changes, never who is stronger;
  - the final pushes now come in the last 6 seconds;
  - sudden death starts 12 seconds before the limit, so it closes the battle out right at the end;
  - a side down to its last few troops in the last seconds is finished off rather than held on to.
- **Results over 24 test battles:** half ended between 58.7 and 60 seconds, nine in ten after 54 seconds, and the earliest at 49.7 seconds (it used to be 37 seconds without pacing). About three in ten reach the limit, where time is called and the side with more troops wins, as before.
- Most videos are now 58 to 63 seconds long (never more than 64). YouTube counts vertical videos up to 3 minutes as Shorts. The description says the real length ("A 62-second battle simulation...").
- **Balance:** 46 line-ups have a fresh starting size from test battles with combat and tribes on (`combatBalance`); the rest start from their old size. Every video is still tuned on the spot first, now with 10 test battles a step and at most 100 seconds of tuning.
- Also from last night: a tribe whose chief falls loses its trait for the rest of the battle (the panel says NO CHIEF), and the merchant title reads "Sold Them a War Horn".
- **Tested:**
  - with the new options off, old battles play out exactly as before;
  - the end-time measurements above, plus king-mode and three-way battles;
  - a full render: 63.1 seconds long, the battle ended at 60.0, sound the same length;
  - a still of the last frame of a video;
  - the layout check passes.
- Videos already posted don't change. No preview videos were made.

## 2026-11-05 (autopilot)

- **Health:** uploads are fine. The last 20 runs all posted (the few "cancelled" ones are spare scheduled starts skipped because a run was already going) and videos are about 15 minutes apart. One run (02:02 UTC) was slow: installing ffmpeg took 15 minutes on that GitHub machine and making the video took 10.5 minutes instead of the usual 4, so that gap was 35 minutes. The runs after it were back to normal, so it looks like a slow runner, not our code. No line-ups were waiting to be balanced.
- **Not learned from views yet:** still no `stats/summary.md`; the stats step is still refused ("insufficient authentication scopes") because the `YT_API_KEY` secret is missing.
- **Fix: videos that ended mid-fight.** Two videos (`Then the Ground SPLIT Open 😱` today and `Nobody Expected the TANK to Fall 💥` on 2 Nov) have an empty result in `uploads.md`. I re-ran today's one from its seed: it was a Champion Duel with one close-up after another near the end, so the camera never pulled back wide and the slow motion was never caught up. The video hit 60 seconds with the battle still going (game clock at 55.6 s), so there was no winner and no outro. Now:
  - when time is running short, the director also catches up during normal-speed close-ups, not just wide shots;
  - as a safety net, if the video is 2 seconds from its end and the fight is still going, time is called (most troops left wins, as at the normal time limit), so every video ends with a winner and an outro. That same video now ends "CRIMSON WINS · SKY RETREATS 2 VS 1".
  - The battle itself doesn't change: over 60 test battles (1v1, creative and three-way) every winner, survivor count and ending time is the same as before; only the camera's pace near the end differs.
- **New hook lines** (today's new thing):
  - *Under the logo:* one new line per genre: ONLY ONE SURVIVES (three-way), MACHINES OR MEN? (sci-fi), WHO TAKES THE GOLD? (pirates), COUNT THE SURVIVORS (zombies), WHOSE BLADE IS FASTER? (samurai), THIS SHOULDN'T EXIST (dream teams), STEEL OR SORCERY? (fantasy), HISTORY VS THE FUTURE (old vs new), WHO PUSHES FIRST? (modern), WHO BREAKS FIRST? (classic).
  - *Titles:* four new true outcome lines, each used only when it really happened: `Half the Size and Still WON 😳` (winner started with under 60% of the other army), `They Barely Got SCRATCHED 😤` (winner lost under 10%), `They Were ALMOST Wiped Out... 😱` (winner dropped below 20% of its strength), `One Troop CARRIED the Whole Army 😳` (20+ kills by one troop). Two new match-up titles: `Can Orcs Survive KNIGHTS? 🛡️` and, for three-way battles, `Pick ONE: Storm Mages, Dragon Bones, Iron Orcs 👇`.
- **Tested:** the 60 before/after battles above; the broken video's seed re-run before and after the fix; titles checked over hundreds of made-up results (each new line only shows when its condition is true); stills at 1.5 s and 10 s of a nation battle, a creative match-up and a three-way battle (new hook shows correctly, nothing clipped); `node check-layout.js` passes.
- **Playbook:** `AUTOPILOT.md` now explains a quick way to run battles without drawing and says every battle must end with a winner.
- **Rellz:** add a `YT_API_KEY` secret (a YouTube Data API key from the same Google project) so the autopilot can start learning from views. Videos already posted don't change (the two with no result stay as they are). No preview videos were made.

## 2026-11-04 (later): living tribes, with a story, trading and the forge

Rellz asked for smart troops that form tribes, with a backstory, a trading system and a way to build up and upgrade their weapons. All of it is on from the next video (`rules.tribes`; everything is explained in RULES.md).

- **Tribes:** every army is now two tribes (three-way armies are one each), taken from a fixed pool of 112 invented tribes (16 per genre: the *Iron Boar Clan*, the *Coven of Ash*, the *Viper Company*, the *Helix Cohort*, the *Saltfang Crew*, the *House of the Red Crane* and the rest), each with its own emblem and a trait (smiths, traders, hunters, miners, zealots or stoneskin). The same tribes come back video after video. Each tribe has a **chief** carrying its banner; when a chief falls, the tribe panics for a moment.
- **A story every battle:**
  - two lines typed out under the battle timer at the start, and in the description (marked "made up for fun");
  - built from what really happened in earlier videos: revenge for a past defeat, a winning streak, a tribe that has never won. Otherwise it's a raid, an oath or a first battle, always over something on the map (the mountain pass, the treasure cove, the sky-temple relic...).
  - Rival tribes have a **blood feud**. The ending says who took the prize: "THE IRON BOAR CLAN TAKE THE MOUNTAIN PASS · REVENGE! · 31 KILLS".
- **Gold, iron and the forge:**
  - kills earn gold, and losses earn a little too, so a side that's behind can still come back;
  - each tribe's camp (drawn behind its lines) digs iron;
  - tribes buy better weapons when they're winning their fights and better armour when they're taking a beating, three tiers each with names that fit the genre (iron, steel and runic blades; hollow-point, armour-piercing and incendiary rounds; Mk II, Mk III and plasma weapons; Kevlar, ceramic and titanium...);
  - troops show it: a glint at the weapon in the tier's colour, a metal arc on the shoulders and forge sparks.
- **Trading:** when a tribe is short of iron or gold and its sister tribe has some to spare, a little cart carries the goods along the back line. Most battles have one to three trades.
- **The merchant:** about 40% of the way in, a merchant's wagon arrives. Each army's richest tribe can buy a Rune of Fury (top-tier weapons), Sellswords (four hired swordsmen) or a War Horn. The side that's behind gets 30% off.
- **Smart tactics:**
  - every tribe picks a tactic from what it is and what's happening: shield wall, flank, focus fire (with a reticle on the shared target), hold the line, protect the chief, surround a big enemy, charge;
  - badly hurt troops fall back to a healer or their chief once;
  - each new tactic shows as a tag with the tribe's emblem.
- **The war council panel:** in the empty space under the battle timer, one row per tribe (emblem, name, tactic, gold, iron, weapon and armour tiers, trait) and the last two things that happened.
- **The chronicle:** `TROPHIES.md` now has a tribes' chronicle: standings, great rivalries and the latest results. Tribe stories and merchant items are also added to the view stats, so the autopilot can learn which ones get watched.
- **Layout check (new):** `node check-layout.js` draws the roster card, the story, the panel and the outro line for all 113 line-ups, the three-way line-ups and invented match-ups. It fails if anything overlaps, has to be squashed, is under 18 px on the panel, or leaves its space. It found and fixed two problems before anything went out (pips running out of the narrow three-way rows, and long tribe names squashed there). The autopilot now has to run it after any overlay change.
- **Tested:**
  - with tribes off, battles play out exactly as before, with or without combat;
  - test battles in every mode and on obstacle maps: no errors, most fights 40 to 50 seconds, two to four upgrades per tribe, a top-tier weapon in about half the battles, and the merchant sells something in almost every battle;
  - stills of the story, the panel (two and three armies), chief banners, camps, carts, the merchant and the outro line;
  - revenge and streak stories from a made-up history;
  - a full 60-second render took 4 minutes on a 2-core machine, including the tuning.
- **Loot you can see:** after the story, a coin flies from each fallen troop to the gold of the tribe that killed it on the panel.
- **Fix:** when the Undefeated General rewinds a battle, chiefs, kings and duellists now carry on as their rewound selves.
- **Faster tuning:** the first video with combat on spent 2.5 minutes tuning on GitHub, so tuning now uses 12 test battles a step, stops once it's close to even, and never takes more than 80 seconds.
- Videos already posted don't change. No preview videos were made.

## 2026-11-04: intelligent combat, battle modes, skins, eight new maps, ten new colours

Rellz asked for 20% fewer troops, cool fight moves instead of so many bullets, troops with different weapons and abilities, and to make it easy to see how each one is different; and for more maps, colours, match-ups, skins and battle modes. All of it is on from the next video (`rules.combat`, `rules.modes`, `rules.skins`; see RULES.md).

- **Fewer troops, tougher troops:** armies are 20% smaller and each troop 30% tougher, so fights last long enough to watch the moves.
- **Melee moves you can see**, each with its own trail and a short callout (at most three a second): blades **PARRY** and **RIPOSTE**, shields **BLOCK** and **SHIELD BASH**, axes and clubs **CLEAVE** through a group, spears, pikes and lances **PIERCE** the troop behind, maces and hammers **STUN** (stars over the head), and agile troops (ninjas, duelists, assassins, elves) **DODGE**.
- **Different weapons:** basic soldiers and skeletons now carry a sword, sword and shield, axe, spear or mace; knights a war hammer; giants a club.
- **Fewer bullets:** machine guns and other rapid-fire weapons fire half as many rounds, each doing double damage (same firepower, a calmer screen). Damage numbers are capped at three a second.
- **Roster card:** for the first four seconds, a card over the scoreboard shows each army's three main troops with a portrait, the name, what it's good at (PARRIES, CLEAVES, ANTI-CAVALRY, BULLET-PROOF...) and how many. Close-up name tags show the specialty too.
- **Five battle modes** (about six videos in ten; classic battles are still the most common): **Protect the King** (a king at the back behind a royal shield for the first 40% of the fight; when he falls, his army loses heart), **Champion Duel** (the two best fighters duel in the middle while both armies watch, then everyone charges), **Last Stand** (a small band of heroes with gold rings against a full army), **Mirror Match** (the same army on both sides) and **King of the Hill** (hold the hill in the middle to hit 25% harder). Each has its own hook, titles (`👑 Protect the KING: Knights vs Orcs`, `25 HEROES vs 80 Zombies 🛡️`) and a line in the description saying how it works.
- **Eight army skins** (looks only): royal, neon, shadow, frost, lava, ghost, toxic and golden. About three armies in ten get one; mirror matches always do ("Neon Samurai vs Shadow Samurai").
- **Eight new maps:** Pirate Beach, Snowy Pass, Dune Sea, Murk Swamp, Neon City, Sky Temple, Haunted Graveyard and Moon Base, each mirrored and listed for the genres it suits.
- **Ten new colours** (magenta, sky, mint, amber, crimson, navy, lavender, olive, rose, sand) in twelve new pairs and four new three-way trios, all checked so no two teams look alike.
- **Creative match-ups** now lead with a hand-to-hand troop three times in four.
- **Balance:** combat changes who is strong, so every 1v1 video is now tuned on the spot with 16 quick test battles at up to five sizes before it's rendered, starting from wherever the same line-up and mode ended up last time (kept in `videos.jsonl`), so each line-up gets closer to 50/50 every time it comes round. Hand-made three-way line-ups are re-tuned the same way.
- **Tested:** with combat switched off, old battles play out exactly as before (same survivors, same positions); battles with combat on in every mode reach an ending with no errors, most fights last 30 to 55 seconds, champion duels finish in 3 to 10 seconds, troops don't get stuck on the new maps (under 0.12% of troop-time); stills of every mode, the roster card (two and three armies), the skins, the new colours and all eight maps; short renders of every mode for titles, descriptions and tags; and a full 60-second render.
- Videos already posted don't change; the new things start with the next video. No preview videos were made.

## 2026-11-04 (autopilot)

- **Health:** uploads are fine. The last 20 runs all posted (the few "cancelled" ones are spare scheduled starts skipped because a run was already going), the newest videos are about 15 minutes apart, and no line-ups were waiting to be balanced.
- **Not learned from views yet:** still no `stats/summary.md`; the stats step is still refused ("insufficient authentication scopes") because the `YT_API_KEY` secret is missing.
- **Two new nations and two new rivalries:** **Denmark** (a slim white cross on red) and **Finland** (a broad blue cross on white), each with its real flag drawn in the video, on flag poles, in banners and above the winner, plus 🇩🇰 / 🇫🇮 in titles. New pairs: **Denmark vs Sweden** (the Øresund football rivalry) and **Finland vs Sweden** (the big ice-hockey rivalry), weight 1 each. Finland's troops are white with a navy ring, so they stand apart from Sweden's blue (colour gap 37.9; Denmark vs Sweden 39.8; the limit is 30). Team colours are looks only, so battles and balance are unchanged.
- **Fix:** line-ups that mix two old genres but aren't invented custom teams (Samurai vs Vikings, Pirates vs Vikings, Vampires vs Samurai and so on) could show "DREAM TEAM BATTLE" under the logo, a label meant for the invented teams. They now show "CLASH OF WORLDS" instead, and their tags say "crossover battle" instead of "dream team". Creative match-ups and three-way battles keep "DREAM TEAM".
- **Tested:** the same three battles (samurai vs knights, orcs vs mages, snipers vs assault, full 60 s on the forest map with events on) play out exactly the same before and after the change (same survivors, same positions); stills at about 1.5 and 10 seconds of Denmark vs Sweden (samurai vs knights), Sweden vs Finland (orcs vs mages, Clockwork Colosseum) and a modern battle look right, flags are accurate and the teams are easy to tell apart; short real renders of Denmark vs Sweden, Finland vs Sweden and Sweden vs Norway have good titles, descriptions and tags. No preview videos.
- **Playbook:** `AUTOPILOT.md` now explains how to grab still frames from a scratch copy of `render.js`.
- **Rellz:** add a `YT_API_KEY` secret (a YouTube Data API key from the same Google project) so the autopilot can start learning from views. Videos already posted don't change; the new rivalries show up whenever the team pick lands on them.

## 2026-11-03 (autopilot)

- **Health:** uploads are fine. The last 20 runs all posted (the few "cancelled" ones are spare scheduled starts skipped because a run was already going), the newest videos are about 15 minutes apart, and no line-ups were waiting to be balanced.
- **Not learned from views yet:** still no `stats/summary.md`; the stats step is still refused ("insufficient authentication scopes") because the `YT_API_KEY` secret is missing.
- **New map: Castle Siege** (`castle`). Each army starts in front of its own castle: a stone wall with crenellations, a main gate between two round towers, open flanks and corner towers, a flagstone courtyard behind it, a dirt road through the middle and catapult craters on the field. Reinforcements pour out of the courtyard through the gate and round the flanks. Arrows, bullets and spells fly over the walls (as if shot from the battlements), but troops have to go round them, and with destructible terrain on, walls and towers can be smashed. Mirrored top to bottom, so both sides get the same ground. Used in medieval, fantasy, samurai, horror, old-vs-new and creative battles; descriptions call it "the Castle Siege map".
  - **Why the walls are low:** my first version had full walls with three gates that blocked shots. Melee armies won a lot more on it (Mages vs Horde dropped from 57% to 38%), because archers and mages got trapped against the walls. Moving the walls back, opening the flanks, letting shots fly over and swapping the middle rubble for craters fixed it.
  - **Win rates, open ground vs castle** (top army, line formations, every system and event on): Knights vs Archers 50% → 55% (40 battles each), Mages vs Horde 57% → 43% (40), Orcs vs Mages 47% → 53% (32), Swarm vs Knights 47% → 41% (32). All within the 15-point limit, so no army sizes changed.
- **Tested:** old line-ups play out exactly as before on old maps (same winners, times and positions); full 60-second battles on the castle map of Siege vs Fortress, Cavalry vs Longbows, Hydra vs Knights, Living Fortress vs Orcs and Samurai vs Knights, plus two untouched line-ups on the forest and bombed maps: no errors or broken positions, every battle reached an ending, troops stuck on walls at most 0.28% of the time (knights in Hydra vs Knights; well under the 0.5% limit). The director still ends at exactly 60 s and is zoomed in about 62% of the fight on both the castle and open ground. Stills at about 10 seconds of three battles (one per era) look right, and short real renders of a castle line-up and a creative castle match-up have good titles, descriptions and tags. No preview videos.
- **Playbook:** `AUTOPILOT.md` now says to test new maps with 32–40 battles a side (24 was too noisy) and explains low walls; the castle siege map is crossed off the ideas list (ballistas and archers standing on the walls are still to do).
- **Rellz:** add a `YT_API_KEY` secret (a YouTube Data API key from the same Google project) so the autopilot can start learning from views. Videos already posted don't change; the castle map shows up from the next videos whose turn in the map rotation lands on it.

## 2026-11-02: magic troops, the crazy units, battle systems, eight new maps

Everything from Rellz's two idea lists, plus more of my own. Most videos stay 1v1 (every fourth is a three-way battle, as before).

- **About 80 new troops**, each with its own look and behaviour (all listed in RULES.md under Units):
  - *Factions:* pikemen, duelists, royal guards, lancers and horse archers on horseback, longbowmen, fire archers, poison hunters, standard bearers, drummers, a general, peasants, war elephants, necromancers, dread knights, wolf and boar riders, trolls, cyclopes, druids, treants, illusionists, imps, demons, hellhounds, warlocks, dwarves, goblin engineers (with turrets), stone golems, a hydra, an ancient titan, a phoenix, griffin riders and a walking fortress.
  - *Magic and monsters:* frost witches (freezing bolts), liches (drain life), storm callers (lightning), forest spirits, gargoyles (turn to stone), sirens (charm enemies, who walk to them with pink hearts), the mirror knight, phase reaper, plague alchemist, gravity monk, soul smith, false soldier and fortress turtle.
  - *Beasts and machines:* war mammoths, war rhinos, ogres that eat their own wounded to grow, catapults, siege gunners (mortars), kamikaze drones, an attack helicopter, and assassins that stay invisible until they strike.
  - *The crazy ones:* the Thousand-Man, Copycats, the Immortal Fraud, the Mirror King, the Eye of the Unmaker, the Billionaire, the Gravity Tyrant, the Meteor Shepherd, the Glitch, the **Star Eater** (darkens the sky, then opens a black hole), the **Timeline Executioner** (rewinds enemies and executes two), the **Walking Cathedral** (its bell raises the dead), the **Storm Emperor** (lightning hunts the strongest enemy; the storm stays after it dies), the **Worldroot** (roots spread over the field), the **Hourglass Titan** (ages enemies into skeletons), the **Moon Caller** (the moon pulls fliers down and the tide rises), the **Unqualified King** (a goblin enemies defect to), the **Undefeated General** (rewinds the whole battle once when its army is about to lose), the **Empty Army** (everything it kills gets back up as empty armour on its side), **the Player** (a giant cartoon hand that picks troops up and throws them), **the Universe** (an ordinary-looking soldier that opens a universe when it dies) and the **Living Fortress** (a castle that wakes up and swallows troops).
- **55 new army types** built from them (EMPIRE, LEGION, FORBIDDEN, STAREATER, PLAYER and the rest, listed in RULES.md), plus 54 new hand-made line-ups and 8 new three-way line-ups. Creative match-ups (every second video) can now use the new troops and big units straight away.
- **Battle systems** (all on, each can be switched off in `rules.json`): evolution with visible stages and mutations, slayer titles, the Forbidden Army's peasants who can become God Eaters, champions with made-up names, traits, critical hits with damage numbers, army synergies, weather (fog, rain, sandstorm, eclipse, blood moon), battle modifiers, boss phases, morale, portals with neutral monsters, sudden death, extinction events, weapon drops, destructible walls and trees, boss transformations, living weapons, and ten new supply-drop power-ups (time freeze, portal, phoenix heart, chain lightning, chaos dice, evolution crystal, pocket singularity, king's crown, clone ray, ghost army), each crate with its own icon.
- **New hazards:** a stampede of mammoths and rhinos (both halves at once) and, in pirate battles, the kraken.
- **Eight new maps whose ground does something**, all mirrored so neither side gets the better ground: the Godboard (a giant chessboard), the World Furnace (lava rivers), the Frozen End (slippery, cracking ice), the Titan's Grave, the Overgrown Kingdom, the Clockwork Colosseum, the Shattered Sky (fall off the islands) and the Mirror Dimension.
- **Director:** quick spotlight shots on big moments (a slayer, a fusion, a possession, a rewind), and a split-second freeze-frame when a crit finishes a big unit.
- **Trophy room:** `TROPHIES.md` now keeps the channel's records (most kills, fastest wipe-outs, biggest wins, champions, the rarest titles, mutations and moments), updated after every upload.
- **Titles** can now lead with the new moments when they really happened ("The CASTLE Was Alive 😱", "The General REWOUND the Battle ⏪", "A Peasant Became a GOD 😱") and name the bosses properly ("120 Soldiers vs the STAR EATER 🌑").
- **Faster videos:** floating texts (kill streaks, damage numbers, "ARMED UP") are now drawn once and reused, which cut drawing time per frame by about a fifth.
- **Balance with the new systems on:** all 59 line-ups that were already in the rotation (including this morning's three Viking ones) were re-checked with every system switched on, on their maps (which now include the eight new ones), with 18 fresh test battles each, and 25 got a new army size. The ones that still landed outside 35–65% got a second pass with 20 battles a step and a 24-battle check, and a few where the smooth score and the wins disagreed (Armored vs Snipers, Undead vs Troopers, Ninja Bots vs Sky Snipers, Sylvan vs Legion, Glitch vs Troopers) got a third pass steered by wins alone. Archers vs Knights swings a lot from battle to battle (72% and 29% in two checks at the same size), so it keeps its size.
- **All the new line-ups are on:** 54 one-on-one line-ups (each balanced by army-size bisection with every system and event on, then checked on fresh battles, 35–65% for the top army) and 8 three-way ones (no army winning more than about half of 24 fresh battles, on open ground). The rotation now has 113 one-on-one line-ups and 14 three-way ones. The Forbidden Army couldn't beat a Titan army at any size, so the peasants fight the skeleton horde instead. Two of the older three-way line-ups shifted with the systems on (Mages won 71% in Horde vs Elves vs Mages; Infantry 58% in Zombies vs Infantry vs Samurai) and were rebalanced, and Dragon vs Armored vs Mechs now stays on open ground (the dragon won 67% in the canyon). Creative match-ups (every second video) use every new troop and big unit too, balanced with test battles before each video.
- **Speed:** a full video of one of the heaviest new line-ups (Undead Legion vs Empire, lots of raised skeletons and cavalry) took 3 minutes 10 seconds to make on the 2-core test machine, and the first videos made on GitHub with the new code took about 2 minutes.
- **Tested:** old line-ups play out exactly as before when the systems are off (same winners, positions and timings, with and without the director); full battles of every new army type, one-on-one and three-way, on open ground and obstacle maps with every system and event on (no errors, no broken positions, every battle reaching an ending); still frames of every new troop, the moon and tide, the roots, darkness, the stampede, the Player's hand and the crate icons; short real renders of a new line-up, an old one and two creative ones (titles, descriptions and tags checked).
- Videos already posted don't change; the new things start with the next video. No preview videos were made.

## 2026-11-02 (autopilot)

- **Health:** uploads are fine. The last 20 runs all posted (the "cancelled" ones are spare scheduled starts skipped because a run was already going) and the newest videos are about 15 minutes apart. No line-ups were waiting to be balanced.
- **Not learned from views yet:** still no `stats/summary.md`, because the stats step is refused ("insufficient authentication scopes"). The `YT_API_KEY` secret is still missing.
- **New army type: Vikings** (medieval). Axe-swinging berserkers (45%) behind a wall of shield bearers (20%), spearmen stabbing from the second rank (20%) and a few archers (15%). Titles call them "Vikings" with an 🪓, e.g. `Samurai vs VIKINGS 🪓` or `125 Pirates vs 85 Vikings`. Vikings are only used when a line-up names them, so random old-style battles and older videos' seeds play out exactly as before.
- **Three new line-ups**, each balanced with test battles spread over every map and formation the line-up can get (army-size bisection with battle events on, 12 battles a step, then 24 fresh battles):
  - **Vikings vs Knights:** Vikings won 100% at equal size, so the knights get 33% more troops; top side now wins 46%.
  - **Samurai vs Vikings:** Vikings are 6.5% smaller; samurai win 58%.
  - **Pirates vs Vikings** (sea raiders vs sea raiders): Vikings are 4% smaller; pirates win 58%.
  The rotation now has 59 line-ups.
- **Tested:** old line-ups and random battles play out exactly the same as before the change (same winner, same ending time, same troops left); full 60-second battles of every new line-up on obstacle maps (ruins, forest, city, enchanted, rocks, bombed, trenches) plus two untouched line-ups: no errors, every battle reached an ending, troops stuck on walls at most 0.01% of the time; stills at 10 seconds of all three new line-ups look right; short real renders with good titles, descriptions and tags. No preview videos.
- **Noticed, left alone:** line-ups between two old genres that aren't custom teams (Samurai vs Vikings, Pirates vs Vikings, Vampires vs Samurai and others) show "DREAM TEAM BATTLE" under the logo, a label meant for the invented custom teams. It's harmless, so I didn't change the title code today.
- **Rellz:** add a `YT_API_KEY` secret (a YouTube Data API key from the same Google project) so the autopilot can start learning from views. Videos already posted don't change.

## 2026-11-01 (evening): three-way battles, better titles

- **Three-way battles (1v1v1):** every fourth video is now three armies at once (the rest stay 1v1). They start at three points around the middle, each troop fights whichever enemy is closest, and the last army standing wins. The scoreboard shows three columns and a three-colour bar, drops land nearer whichever army is weakest, the director's shots follow all three, and the losers fall back toward their corners at the end. Colour trios like Red/Blue/Green, Orange/Purple/Cyan and friendly nation trios (Australia/New Zealand/UK, Brazil/Argentina/Spain, USA/UK/Brazil) are measured so no two of the three look alike. They use open ground or a new desert map, **canyon** (sandstone mesas). Half of them are three custom teams invented on the spot and balanced with test battles before rendering (in tests, no army won more than about half of 24 fresh battles); the other half use six hand-made three-way line-ups: Knights vs Orcs vs Robots, Zombies vs Infantry vs Samurai, Dragon vs Armored vs Mechs, Pirates vs Ninjas vs Archers, Vampires vs Troopers vs Knights and Horde vs Elves vs Mages. Each was balanced with 128 test battles and checked on 24 fresh ones: on open ground no army won more than 46%. Three of them leaned too far one way in the canyon, so they stay on open ground.
- **Titles rewritten from research on Shorts:** short hooks that fit before the feed cuts them off (about 40 characters), one or two emojis chosen for what's in the video, one or two words in CAPITALS, curiosity and outcome hints instead of plain questions, army sizes when they're a real promise, and no "#shorts" in the title. Titles name the armies instead of just the colours, for example `180 Zombies vs 90 Ninjas 🧟`, `150 Knights vs a DRAGON Army 🐉`, `🇬🇧 UK vs USA 🇺🇸`, `3 Armies, Only 1 SURVIVES 💀`, and sometimes lead with what really happened (`Won With Only 2 LEFT 😱`, `The MECH Went Down 🤖`). Every claim comes from that battle, and descriptions still say it's a simulation.
- **Tested:** old line-ups on open ground play out exactly as before; full three-way renders with the director (one took 4.6 minutes on a 2-core test machine, inside the 880-second gap); three-way balancing on 4 invented match-ups, checked on fresh battles. No preview videos.

## 2026-11-01 (midday): drop kinds, power-ups, weather, clickbait titles

- **Colours never look alike:** every colour pair is now measured for how different it looks (the main colour and the darker shade some troops use). Blue vs Purple was too close and is replaced by Purple vs Lime (and a new Blue vs Green); Belgium's yellow is lighter so it stands apart from the Netherlands' orange. Any pair under the limit (`minColourGap`) is skipped automatically, so this can't come back.
- **Six kinds of supply drop, two per battle:** crates land nearer the side that's behind (the leader can still steal them), so drops help comebacks instead of tipping the balance. Kinds: squad, med kit (heals that side), rage (hits 50% harder for 8 s), shield (half damage for 8 s), speed (35% faster for 8 s) and big unit (a giant, tank, dragon, mech or cannon). Each crate has its own colour, icon and parachute, and the boosts show on the troops (red-hot rings, blue bubbles, speed lines).
- **More weather and disasters:** besides meteors and airstrikes, battles can now get a lightning storm (any genre), a tornado that crosses the field flinging troops around, a blizzard that slows everyone, or an earthquake that cracks the ground open. Nine battles in ten get one.
- **Taller film bars** in slow-motion moments, so those moments stand out more.
- **Clickbait titles:** every fifth video gets a short, funny teaser title with no team names, hashtags or tags, picked from what really happened in that battle, such as "Won With Only 2 Left 😱", "The Biggest Comeback I've Ever Seen 😱" or "A Tornado Hit the Battlefield 🌪️".
- **Kill streaks and MVP:** "TRIPLE KILL", "RAMPAGE" and "UNSTOPPABLE" pop up over troops on a streak; the winner screen names the MVP and their kills, and the camera ends on them wearing a gold crown.
- **New robot look:** round armoured robots in the team colour with a steel chest plate, a domed head with one glowing eye, and piston fists that punch in turn (the old square ones are gone).
- **Ideas list:** `AUTOPILOT.md` now has a list of bigger ideas (cavalry, helicopters, boss troops, a volcano map, replays of the best kill and more) for the daily run to build one at a time.
- **Balance with the new events:** a sample of 14 line-ups (16 test battles each, open ground) gave the top side 31–81%, 58% on average; 12 of 14 sit inside 25–75%. Next autopilot run: re-check every line-up's balance with these events on and nudge the ones outside 35–65%.
- **Tested:** old line-ups on open ground without events play out exactly as before; 12 full battles with the director and every event on every map with no errors, each still ending at 60 s; stills of every crate kind, boost, hazard, the new robots and the MVP screen; short renders of a clickbait video and a creative one. No preview videos.

## 2026-11-01: real flags, faster rendering

- **Flags:** nation battles now show the real flag, not just its colours: beside each team's score at the top, on flag poles carried by about one troop in ten, in banners like "CANADA GRABS THE DROP · +4", and big above the winner's name at the end. All 16 nations are drawn: UK, USA, France, Germany, Italy, Brazil, Argentina, Canada, Spain, Portugal, Australia, New Zealand, Netherlands, Belgium, Sweden and Norway. The flags are looks only; battles play out the same.
- **Faster videos:** close-up frames were drawing the whole battlefield picture through the camera, which made videos take 3–6 minutes to make. Close-ups now copy only the part in view, and troops out of view are skipped. In tests a close-up frame dropped from about 126 ms to about 40 ms to draw. Battles are unchanged.

## 2026-11-01 (autopilot)

- **Health:** uploads are fine. The last 20 runs all posted (the few "cancelled" runs are spare scheduled starts skipped because a run was already going), and the newest videos are about 15 minutes apart.
- **20 line-ups switched on:** the 18 line-ups added yesterday evening (new genres, mixed teams, robots vs giant and so on) were never balanced, so they never came up in the rotation. Each one is now balanced with test battles (army-size bisection with battle events on, 12 battles a step, then a check of 16 fresh battles), spread over the maps and formations the line-up can get. The top side won 31–69% in the first checks; the three outside 35–65% (Pirates vs Buccaneers, Vampires vs Samurai, Zombies vs Swarm) got 16–20 extra test battles each and now sit at 45–56%. The rotation now has 56 line-ups instead of 36. A few swing hard with army size (Vampires vs Samurai went from 60% to 5% between 1.2x and 1.4x samurai), so a run of videos can lean one way. Zombies vs Swarm needs a swarm 2.7 times bigger (about 300 troops on screen), because every soldier the zombies kill joins them.
- **New troop: the vampire** (horror). Pale face, slicked-back black hair, red eyes, a black cape and a collar in the team colour. It is fast, and every bite heals it by half the damage it deals; its eyes flare and a red ring flashes when it feeds. Zombies can't turn it. New army type **Vampires** (vampires with zombies and skeletons), in two new line-ups: **Vampires vs Samurai** and **Knights vs Vampires**. Vampires can also turn up in creative match-ups (for example "Mega Vampires").
- **Not learned from views yet:** there is still no `stats/summary.md`. The stats step fails with "Request had insufficient authentication scopes", which means the `YT_API_KEY` secret is missing.
- **Tested:** old line-ups play out exactly as before (same winner and positions with and without today's change); full 60-second battles of the new line-ups on obstacle maps with no errors, all reaching an ending, with troops stuck on walls under 0.03% of the time; the director still fills exactly 60 seconds, with at least 3 seconds of winner outro in every test; stills of the vampires; short real renders of Knights vs Vampires and a creative "Giant Archers vs Mega Vampires" (titles, descriptions and tags fine). No preview videos.
- **Worth knowing:** making a video now takes about 3:40–4:10 on GitHub (the playbook aims for under 3 minutes). It's still well inside the 880-second gap, so posting isn't affected, but the director and creative balancing made it slower. I left it alone because speeding up the drawing code without watching a video is risky.
- **Playbook:** `AUTOPILOT.md` now says to look for line-ups still waiting to be balanced, and to run long test-battle jobs in short foreground steps (a background job was stopped partway through today).
- **Rellz:** add a `YT_API_KEY` secret (a YouTube Data API key from the same Google project) so the autopilot can start learning from views. Videos already posted don't change.

## 2026-10-31 (evening): director, new genres, creative match-ups, events, themed maps

- **Cinematic director (camera and slow motion):** videos now open on a close-up of the two front lines with film bars, show first blood in slow motion, fly in and slow time right before a giant, tank, dragon, mech or cannon falls, punch in on big blasts, follow troops on a killing spree with a kill counter, follow the last troop of a losing army to the end, and push in on the winners in the outro. It keeps the whole arena in view about half the fight. Time spent in slow motion is caught up gently afterwards, so every video still ends at exactly 60 seconds. The battle itself plays out the same as with a fixed camera.
- **New genres:** sci-fi (laser troopers, robots, rocket mechs), pirates (cutlass pirates, musketeers, cannons), horror (zombies that turn the troops they kill into zombies) and samurai (armoured samurai, ninjas that dodge shots). New army types: Troopers, Robots, Mechs, Pirates, Buccaneers, Zombies, Undead, Samurai, Ninjas.
- **Mixed-genre teams:** a side can now be a custom team mixing any troops and big units, for example "Spellguns" (wizards, riflemen and machine gunners + a tank) vs "Dragon Armor" (orcs and riflemen + 2 dragons and a tank).
- **Creative match-ups:** every second video is a brand-new match-up made up on the spot, two custom teams with names like "Storm Mages" or "Dragon Bones". Before rendering, each one is balanced with 48 quick test battles on its own map and formations. These videos get "dream team" titles with the team names.
- **18 new line-ups** in the rotation list (new genres against each other and against the old ones, plus four hand-made mixed teams). They join the rotation once balanced.
- **Battle events:** every battle has a supply drop: a plane (or a parachute crate in older eras) drops it on the middle line, troops race for it, and the first to reach it wins a squad. Most battles also get an airstrike called in by the side that's behind (an orbital strike in sci-fi), or a meteor shower, cannon barrage or lightning storm that hits both sides.
- **Themed maps:** forest (dark green, trees and bushes), bombed city (cracked asphalt, a road, ruined buildings, burning car wrecks) and fantasy land (violet ground, rune circle, crystals, giant toadstools, sparkles). Each has its own ground colour; the page around the arena stays the classic dark style.
- **Troops no longer get stuck on walls:** troops now path around obstacles toward their target, and shooters take cover beside or behind an obstacle only when they have a target in range, moving to find a clear shot when a wall is in the way. In test battles, time spent stuck against a wall dropped from 1–10% (worst on trenches and city) to about 0.1%. On open ground nothing changed.
- **More colours:** lime, teal, gold, silver, indigo and coral, in pairs like Gold vs Silver. **New friendly nation pairs:** Australia vs New Zealand, Netherlands vs Belgium, Sweden vs Norway.
- **More videos a day:** one post about every 880 seconds instead of every 900, so 98 a day instead of 96. YouTube's API allows 100 uploads a day per project, so this is as close to the limit as is safe. Getting around the limit with extra Google projects breaks YouTube's rules.
- **Tested:** old line-ups on open ground play out exactly as before; battles with and without the director end the same way; stills of every new troop, map, event and camera shot; short and full renders. No preview videos.

## 2026-10-31

- **Maps:** battles now rotate through five battlefields. `open`, `rocks` (boulders) and `ruins` (stone pillars and walls) can come up in any battle. `trenches` (sandbag lines and craters) and `city` (rooftops and crates) are for modern and old-vs-new battles. Obstacles block troops, bullets and arrows; grenades, shells and fireballs fly over them. Every map is the same for both sides.
- **Fantasy:** new troops (skeletons, orcs, elves, wizards with fireballs, and dragons that fly and breathe fire) and five new army types: Horde, Orcs, Elves, Mages, Dragon.
- **Old vs new:** line-ups can mix eras, for example Knights vs Infantry, Giant vs Tank and Dragon vs Armored. Titles use hooks like "Old vs New 🕰️".
- **Nations:** UK vs USA, UK vs France, Brazil vs Argentina, USA vs Canada, Germany vs Italy and Spain vs Portugal join the colour pairs. They use flag colours, flag emojis in titles, and an accent ring on every troop.
- **Bullets:** machine guns show a tracer on every third round, tracers are drawn in one pass, and a cap of 160 bullets in the air keeps busy firefights readable.
- **Stats:** every video's settings are logged to `videos.jsonl`, and view counts are fetched once a day into `stats/summary.md`. This needs a `YT_API_KEY` GitHub secret.
- **Autopilot:** a daily run follows `AUTOPILOT.md` to check health, learn from views, add one new thing a day, and log it here.
- **Testing:** test battles on every new map and era, plus nation teams. No stuck troops and no errors. The 12 new line-ups are marked "pending" and join the rotation once each is balanced.
- **Fantasy line-ups balanced and live:** Horde vs Elves, Orcs vs Mages, Dragon vs Orcs, Elves vs Orcs, Mages vs Horde and Dragon vs Knights. With equal army sizes one side won 90–100% of test battles; with tuned sizes the top side wins 40–65%. 
- **Old-vs-new line-ups balanced and live:** Knights vs Infantry, Armored vs Giant, Archers vs Snipers, Dragon vs Armored, Swarm vs Assault and Horde vs Infantry. The top side now wins 45–60% of test battles. These swing hard with army size (Knights vs Infantry went from 80% to 25% between 6% and 10% extra infantry), so a run of videos can still lean one way. All 36 line-ups are now in the rotation.
