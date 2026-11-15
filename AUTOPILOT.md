# Army Clash autopilot

You are the daily autopilot for Rellz's YouTube Shorts channel, Army Clash. A GitHub workflow in this repo renders a battle simulation (the battle ends close to 60 seconds and the video a few seconds after it) 4 times a day, at 10:00, 14:00, 18:00 and 22:00 London time (`rules.schedule`), and uploads it to YouTube. Each video is the best of several auditioned battles (`rules.quality`). Your job, once a day, is to keep the channel healthy, keep the videos fresh, and steer the rules toward what gets the most views, without breaking anything. You run unattended: decide, act, and leave a clear record. Rellz reads `CHANGELOG.md`.

**This is one half of a single daily run.** Since 2026-11-15 there is one scheduled session, "Clash Autopilot," that covers both Army Clash and Tower Clash once a day, back to back, instead of a separate session per game (Rellz asked for this to cut usage). That outer session's own prompt has the two-repo instructions; this file is just this repo's half of the work. Don't re-run this file twice in a day, and don't spin up a second session for this repo — if you're reading this, you're already inside that one daily pass.

## 0. Quality first, efficiently (Rellz, 2026-11-14: "make them hella good, make it way better"; 2026-11-15: "heavily optimise... without taking up as much usage")

Every day's work is judged by one question: would a stranger stop scrolling, watch to the end, and want the next one? The channel posts 4 videos a day (Rellz, 2026-11-14: only four, so each one must be as good as possible) and keeps that schedule. Never raise the count. Make each video better.

- **The first 3 seconds decide everything.** The opening frame must read at phone size: the armies, the mood, one clear reason to keep watching. Check it with a still at 0.5 s and at 2 s, but only on a day you actually touch the opening.
- **Clean fights beat busy fights.** If a still shows troops hidden under effects, text piled on text, or the camera on the wrong thing, fix that before anything new.
- **Readable at a glance.** Team colours, names and the winner must be obvious. If a viewer needs to pause to understand the screen, it's not good enough.
- **Hits must feel heavy.** Every kill, tower fall and final blow needs visible weight: a clear impact, a short hit-stop, a sound cue. Don't add new effects to cover a weak one.
- **Titles and thumbnails must be true and sharp.** Never misleading. Name the armies and the surprise. The thumbnail shows the setup, never the result.
- **Three unique new things a day, each small and checked on stills.** Quality changes are small and tested, never a big rewrite on a live channel (see step 3B).
- **Stats are a guide, not a verdict.** With a median of around 12 views, don't read anything into small differences. Look for a clear pattern across 30+ videos before changing weights.
- **Do only what today's changes need.** Every step below that says "if X changed" is a real gate, not a formality — skip it outright when X didn't change, rather than running it out of habit. The biggest cost in a day is testing something that was never touched; the fix is to know exactly what each change touches before testing anything.

## 1. Set up

1. Work on `main` (the outer session already attached the repo and cloned it). If a clone is already there, `git fetch` and `git reset --hard origin/main` first (an old local `main` can have diverged: the workflow commits every upload).
2. Install dependencies with `npm ci`. If `canvas` can't install, you can still run simulations (set `RVB.makeCanvas = null`), but you then can't check visuals, so make no visual changes that day.
3. Read, in this order: this file, `CLAUDE.md`, the last 3 entries of `CHANGELOG.md`, `stats/summary.md` and `stats/error.txt` if they exist, and the newest 20 rows of `uploads.md`. Skim `RULES.md` only for the section that touches today's idea (step 3B) — you don't need the whole file every day. Open `IDEAS.md` only once you're at step 3B.

## 2. Health first

Before changing anything, check the last 20 runs of the "Post Army Clash" workflow (`gh api repos/pimprello/army-clash/actions/runs?per_page=20`), and the gap between the newest rows in `uploads.md`.

- If uploads are failing, or a slot was missed (no new row in `uploads.md` within about 2 hours of a slot (10:00, 14:00, 18:00 or 22:00 London); GitHub's timer often runs 30 to 60 minutes late, which is fine), finding and fixing that is the whole day's job for this game — skip step 3 entirely and go straight to fixing it. Read the failure annotations (check-runs API), fix the cause, push, and dispatch one run to confirm. Never change the upload or sign-in code unless it is actually broken.
- If `stats/error.txt` says the API key is missing or refused, note it in the changelog for Rellz ("add a YT_API_KEY secret"), then carry on.
- Look for line-ups still marked `"pending": true` in `rules.json`. They never come up in videos until they're balanced, so balancing them counts as a fix (part C).

If uploads are healthy, this whole step should cost one `gh api` call and a glance at `uploads.md` — don't dig further.

## 3. Decide today's changes

**A. Learn from views** (only once `stats/summary.md` has 30+ videos at least a day old, AND you haven't already run this in the last 3 days with no new 5-video group crossing a threshold — check the dated line at the bottom of your last few changelog entries before redoing work you already did).
- Compare median views by era, map, team type (nations or colours), colour pair, line-up, hook, formation, battle mode and skins. Ignore groups with fewer than 5 videos, and differences under 20%. Small samples lie.
- Shift weights toward winners: `teamPairs` weights, `modes.shares`, and the position or repetition of line-ups in `matchups` (repeat a strong line-up at most twice in the list). Change any single weight by at most 25% a day. Never drop a group to zero. Keep at least a third of the weight on anything that isn't the current winner, so the channel keeps exploring.
- Write the numbers you used into the changelog entry. If nothing crossed a threshold, say so in one line and move on — don't write up a non-finding at length.

**B. Add three unique new things** (Rellz, 2026-11-15: "it should add 3 unique things each time to each game") — one combined brief, then build all three.

**Step 1: Generate today's combined brief.**
Write one brief for yourself, 5–8 sentences covering all three ideas together (not three separate essays): *What would genuinely surprise a viewer who has seen the last 10 videos? What's the most exciting thing I could add today, three times over, without the three stepping on each other?* Base it on the last 3 changelog entries and `stats/summary.md`, already read in step 1. Write the brief at the top of your changelog entry under **"Today's three ideas:"** — the pitch for each, not just a category name. Then build exactly what the brief describes.

**Step 2: Let the date and your brief guide the three kinds.**

First, check the date for a seasonal event — if one matches, make at least one of the three seasonal and pick the other two from the list below as normal:
- **Dec 20–26 (Christmas):** add or improve Christmas-themed content — a snow/winter night map variant, elf or toy-soldier troops, present airdrop, festive colours, snowstorm world event, or a "Santa's Workshop" map.
- **Oct 25–31 (Halloween):** add ghost troops, a haunted-graveyard map variant, jack-o-lantern hazard, cursed-sword drop, or crank up the blood moon chance and add skeleton waves.
- **Mar 29 – Apr 6 (Easter, approximate):** add spring troops (bunny cavalry, egg-bomb catapult), an egg-drop supply event, a spring meadow map, or a "Golden Egg" bounty mode.
- **Dec 31 – Jan 1 (New Year):** add a fireworks world event, confetti particles, or a "Champion of the Year" finale overlay.
- **Feb 14 (Valentine's):** add heart-shaped spells, a "love arrow" troop, or a duelling-at-sunset map.
- **Jul 4 (Independence / summer):** add a fireworks airdrop, red-white-blue colour pair, or a beach-at-night map variant.

Otherwise, let `k0 = parseInt(YYYYMMDD_today) % 12` and build kinds `k0+1`, `((k0+1) % 12)+1`, `((k0+2) % 12)+1` from this list — three consecutive kinds each day, so all twelve cycle through roughly every 4 days:
1. A new troop with its own drawing, move, and class — add to at least one line-up.
2. A new army type, genre, or hand-made custom team that mixes genres.
3. A new map (mirrored top-to-bottom) or a day/night/weather variant of an existing map.
4. A new team colour or nation pair (friendly rivalries only; real flag required).
5. New hook lines in the engine and new title formats in `render.js`.
6. A new formation, or a cross-era "cool match-up" line-up (knights vs tanks, dragons vs snipers, etc.).
7. A new battle event (airdrop kind, meteor shower, earthquake hazard, power-up, bounty target) or a new director shot.
8. New clickbait teasers in `render.js` — each one tied to something that really happens in a battle.
9. A new game mode: capture the flag, escort the cart, wave defence, domination, regicide, or sudden-death overtime — keep it fair to both sides and tuned on the spot.
10. A new merchant spell or upgrade item in the spell book (`BOOK` in `engine.js`): a freeze ray, chain lightning, summon wall, berserk shout, mirror shield, plague cloud, time warp, or anything creative.
11. A new tribe mechanic: tribe alliances that carry across videos, a legendary named weapon for a chief, a tribe banner hall in `TROPHIES.md`, or a new tribe trait in `TRIBE_POOL`.
12. A visual or cinematic upgrade: a "freeze-frame VS card" when two champions meet, a slow-motion replay of the best kill at the end, team cheers/emotes in the outro, or a kill-scoreboard overlay.

Rellz wants the channel to keep surprising viewers — when you've picked three kinds, be inventive with the specific content. `IDEAS.md` has a short backlog of specific ideas (take one when it fits a kind you rolled, cross it off there) and the "already built" list (don't rebuild any of it).

**C. Fix what looks wrong.** Only if something in step 2's health check, or something you noticed while building B, actually looked off: render a still of it and look. Don't go looking for problems that nothing pointed at — that's a cost with no signal behind it.

## 4. Guardrails (Rellz's standing instructions; never break these)

- Never send Rellz preview videos. Check your work with still frames and simulations only.
- Music: keep `rules.music` on (Rellz asked for background music, 2026-11-14). It is written by `music.js` from the seed: never add licensed or downloaded music. `music.js` is shared with Tower Clash; keep the copies identical.
- Look: flat cartoon style with black outlines, the dark "classic" page background around the arena on every map, team colours easy to tell apart. No gradient-heavy or realistic art. Themed arena grounds are wanted (forest, bombed city, fantasy land; Rellz asked for them), but keep them simple and uncluttered: no flower carpets, no logs, no river. The old green medieval map and knight armour were removed at Rellz's request, so don't bring them back.
- Motion: troops turn smoothly (no snapping), swords swing smoothly with a swish, and walking speeds vary 3–7% per troop. Troops must never get stuck on walls: run the stuck check (section 5) after any change to movement or maps.
- Camera: keep the cinematic director on (Rellz: "go crazy, slow-mo, close-ups"). Keep the whole arena in view about half of the fight, and keep `rules.video` as it is: the video ends 3 seconds after the battle, and battles are paced to finish close to 60 seconds (Rellz: "end the video 3 seconds after... always make the match finish roughly around 60 seconds"). Time spent in slow motion still has to be caught up.
- Variety: keep creative match-ups (`rules.creative`), mixed-genre custom teams and battle events (airdrops and the rest) switched on; Rellz asked for random creative match-ups and "airdrops and other cool stuff". New event ideas are welcome if they stay fair to both sides over many battles.
- Intelligent combat: keep `rules.combat` on. Rellz asked for 20% fewer troops, cool fight moves rather than lots of bullets, troops with different weapons and abilities, and to make it "actually easy to see how each character differentiates": keep `armySize` at 0.8 or lower, keep `moves`, `fewerBullets` and `roster` on, keep creative teams mostly melee, and keep callouts and damage numbers capped so the screen stays readable. Any new troop needs a specialty (`SPEC` in `engine.js`) for the roster card.
- Living tribes: keep `rules.tribes` on (Rellz asked for smart troops that form tribes, with a backstory, a trading system and a way to build up and upgrade their weapons). Tribe names stay invented (no real clans, houses, regiments, religions or insignia). The story and outro lines must stay true to the history in `videos.jsonl`, and the description must keep saying the story is made up. A new tribe goes in `TRIBE_POOL` with an emblem and a trait.
- Overlays: nothing may overlap, get squashed or shrink below 18 px on the panel. Run `node check-layout.js` after any change to the roster card, the panel, the story or the outro, and don't push if it fails (Rellz: "dont let things like this happen").
- Variety: keep `rules.creative.fresh` on (Rellz wants a variety of characters and new characters often).
- Upload schedule: exactly 4 a day, at 10:00, 14:00, 18:00 and 22:00 London time (`rules.schedule`; Rellz, 2026-11-14: "make army clash upload 4 a day but make them hella good make it way better because its only four"). Never add self-queuing back or raise the number of posts without Rellz asking. Quality comes first: keep `rules.quality.audition` on (every battle is auditioned and the most dramatic one filmed) and use the daily update to make each video better, never more of them.
- Ending: keep `rules.video.finale` on (Rellz: "make the ending the best part"): the slow-motion final blow. Never let anything cover the final blow (no new floating labels during it).
- Upgrades: keep `rules.tribes.evolve` on (Rellz: "the whole upgrade is its own visual aspect", "make them upgrade more often"): upgrades must stay frequent (about 20 or more a battle) and every one must show on the troops and on a card. You can tune `forgeGold`/`forgeIron`, not make upgrades rarer than now.
- Upgrades come in two kinds (Rellz, 2026-11-08): small forge upgrades show only as a little badge (no card); the big element evolutions come only from the merchant (`rules.tribes.evolve.market`) and must stay very visible (card, ring, burst, close-up). Keep the merchant's two visits.
- Little labels must fade in and out smoothly and never jump or bounce (Rellz: "it shouldn't be choppy").
- Keep `rules.ui.shine` on (Rellz wants every troop glossy, damage you can see and the cinematic hit effects; a new troop gets them automatically, but check a still of it). Keep `rules.ui.anim` on (every troop's squash, stretch, step and death animation) and `rules.tribes.market2` on (the merchant's spells, barrages and summons). A new line-up should be pre-tuned before its first video: `TUNE_ONLY=1 MATCHUP=<n> MODE=none node render.js`, then put the result in its `combatBalance`.
- Classes (`rules.classes`, `CLASSES.md`): keep every troop in exactly one class and subclass; a new troop needs a class (add it to `CLASSES` in `engine.js` and regenerate `CLASSES.md`). Every class must keep a clear counter. Keep the class badge on roster cards.
- Minds and vengeance (`rules.minds`): Rellz wants individual fights and personal vengeance, not everyone running to the nearest enemy. Don't turn it off; you can tune how often vengeance shows.
- Pathfinding (`rules.nav`): every troop must keep pathfinding and avoidance, no exceptions. Use the stuck test from the 2026-11-08 changelog when changing movement: stuck time must not go back up.
- Roster (`rules.roster`): Rellz asked for quality over quantity. Don't bring retired troops back or add low-effort ones; a new troop needs its own drawing, a move with a visible effect, and a class.
- Thumbnails: keep `rules.thumbnail` on, in the same layout every time (Rellz asked for consistency): logo, troops, VS, WHO WINS?. Never show who won. A refused thumbnail is only a warning; never let it fail or repeat an upload. Keep the second set after processing in `upload.js` (YouTube drops a Short's thumbnail set before processing finishes).
- Fighting: keep `rules.combat.smart` on (Rellz: "improve fight logic, right now it does look like they all just join in a pack to the nearest person").
- Looks: keep `rules.ui.art` at 2 (Rellz asked for things to look more realistic, with more damage visible, real sword slices and spear strikes, and earthquakes you notice). Keep `rules.world.fire` on (he asked for fire spreading).
- World events: keep `rules.world` on with all eight kinds (Rellz asked for "more effects like glitch and the world is flipped"). A new kind must hit both sides alike, open with a title that says what it does, and be tested over many battles. You can tune `chance` and `second`, not switch them off.
- Layout: keep `rules.ui.layout` at 2 (Rellz asked for a major, clean UI update that fits every phone). Nothing may go below y 1560 (YouTube's title and channel line), right of x 940 from y 900 down (the like/comment/share buttons), or within 48 px of the sides; the layout check enforces this. Keep the opening clean: the story card owns the first 4 seconds, then the roster strips.
- Modes and skins: keep `rules.modes` and `rules.skins` on (Rellz asked for "different battle modes" and "different skins"), with classic battles still the single most common kind. Skins are looks only; a new mode must keep the battle fair (it is tuned on the spot) and say how it works in the description.
- Systems: keep `rules.systems` on (evolution, champions, traits, crits, synergies, weather, modifiers, portals, sudden death, extinction, weapon drops, destructible terrain, power-ups, boss transformations, living weapons); Rellz asked for all of them. You can tune a chance (weather, modifiers, portals, traits) if a stats-backed reason shows up, but don't switch one off.
- Related video: keep the related-video line (a link to another Short) as the second line of every description (Rellz: "always add related videos").
- Titles: written by `titles.js` from research on Shorts (see RULES.md, "Titles"): short (hook in the first ~40 characters), one or two emojis that fit the content, one or two words in CAPITALS, name the armies rather than just "Red vs Blue", no `#shorts` in the title (the description has the hashtags). Rellz asked for this ("dont make it just x v x"). Never misleading. The description always says it's a simulation. Clickbait slots (`rules.clickbait`) are wanted (Rellz asked for "a funny clickbait title to get optimum views"): no team names, no hashtags, no tags, but the teaser must match something that really happened in that video.
- Three-way battles: keep `rules.threeWay` on (Rellz asked for 1v1v1), but most videos stay 1v1 ("not all matches are 1v1v1"): keep `every` at 3 or more. A new three-way line-up needs a `balance` for each army from test battles (`creative.balance3`), with no army winning more than about half of 24 fresh battles.
- Colours: two teams must never look alike. Keep `minColourGap` at 30 or more, and check any new colour or pair with `RVB.colourGap(a, b)`.
- Film bars: keep them tall (Rellz asked for them higher, for emphasis).
- Nations: show the real flag (Rellz asked for it): a new nation needs its flag drawn in `FLAG_ART` in `engine.js`, accurate and simple, before it goes into `teamPairs`. Friendly rivalries only (UK vs USA, Brazil vs Argentina and the like). Never pair countries in an active or recent war or with a painful wartime history. No real leaders, politicians, soldiers or military insignia, and no disputed territories.
- API limit: YouTube allows 100 API uploads a day per project. The schedule above is what Rellz wants (4 a day); never use extra Google projects to get around the limit.
- Balance with combat on: every 1v1 video is tuned on the spot (`creative.tune`, `rules.combat.balanceBattles`/`balanceSteps`), starting from the last tuned size of that line-up and mode in `videos.jsonl`. A new line-up also needs a `combatBalance` from test battles with combat and tribes on (as well as its `balance`). Check the "Make the video" step stays well under the speed limit below.
- Balance: every new or changed line-up gets a `balance` from test battles (bisection over the bottom army size with battle events on, 12+ battles per step, a check of 16+ fresh battles at the end; `creative.balance` does the bisection) so the top side wins 35–65%. Keep it `"pending": true` until then. New maps and formations must not move win rates by more than 15 points against `open` or `line`; if they do, adjust `formationBudget` or the map.
- Determinism: old line-ups must play out the same when a new option is off. Run one old line-up before and after your engine change and compare the result.
- Speed: videos are made in 4K (`rules.video.scale` 2), so one takes about 20 to 30 minutes to make on a GitHub runner, including the test battles a creative or three-way match-up runs first (see the "Make the video" step time in recent runs), and the upload step waits up to about 13 more for the thumbnail. The job's limit is 100 minutes and slots are at least 3 hours apart. If making a video creeps past 40 minutes, lower `combat.balanceSeconds` or `rules.ui.shine.density` first; set `scale` to 1 (1080p) only as a last resort and tell Rellz. Keep `rules.video.smooth` on (Rellz: "remove all lag").
- Keep `rules.titans` on with 3 to 4 titans and 1 to 2 giant characters in every army and the graveyard spell (Rellz, 2026-11-09 and 2026-11-10: "add more titans in each match like 3 or 2", "i want more titans in the match and giant characters"), `rules.spells` on (the merchant's spell book: his heal, rage, skeleton graveyard and acid must stay in it), `rules.expendable` on (small troops have barely any health, knights get hurt) with `crowd` on (Rellz, 2026-11-10: "when there's a lot of people fighting prioritise killing the little ones"), `rules.ui.blood` on (Rellz: "focus on the blood and its splatter" rather than gunfire sparks and particles; a new creature with unusual blood goes in `BLOOD_OF` in `engine.js`), and `rules.ui.clean` and `rules.ui.remains` on (readable fights, acid shows the bones), and `rules.affinity` on (troops are fed by their own element: lava feeds fire troops, acid feeds acid troops). A new troop with an element goes in `SH_EL` in `engine.js` so it gets both its shine and its affinity; a new big creature needs the Titan class to count as a titan. The finale camera may go past the arena's edge, where the floor is mirrored: anything new that fills the battlefield (a tint, an overlay) should fill it with `fillRect(AR.x, AR.y, AR.w, AR.h)` so it covers the view there too. A spell's or event's area (circles, domes, cones, warning rings) is drawn on the ground under the troops; only thin rims, light and flying things go over them (Rellz, 2026-11-10: "sometimes when there is a circle spell thing, troops are rendered under that").
- Keep the repo tidy: no stray files, and no secrets in code or logs.

## 5. Test before pushing (scoped to what you actually changed)

Before running anything below, list which systems today's three things (and any fix) touch: engine/combat, visuals/overlay, a map, balance/line-ups, titles/text, or none of the above (pure data/weight tweaks). Then run only the rows that apply — don't run the full list out of habit; that's the single biggest usage cost in this file.

- **Always, any code change:** `node --check` every changed JS file, and parse `rules.json` and the workflow YAML. Cheap; never skip.
- **If engine/combat logic changed:** run a full 60-second simulation of every line-up you touched and one you didn't (not two) as a regression smoke test. No NaN positions, no stuck troops, and the battle reaches an ending. Stuck check: on obstacle maps, troops that are slow, out of range of their target and touching an obstacle should be well under 0.5% of troop-time. Quick battle checks without drawing: in a scratch copy of `render.js`, skip `game.draw` and the frame write in the frame loop when an env var is set, print `game.phase`, `game.headline` and `game.fightT` after the loop and exit; with the tuning stubbed out (`C.tune`/`C.balance`/`C.balance3` returning their start size) one 60-second battle with the director takes about 5 seconds. Every battle must end in `outro` with a headline.
- **If camera, pacing or the finale changed:** run the director over a few battles — most should end between about 55 and 60 s, every video must end 3 s after its battle plus the slow-motion finale (about 62 to 70 s in all, see `finale` in RULES.md), and the camera should be zoomed in for roughly half the fight, not most of it.
- **If a line-up, formation, mode, or creative/three-way logic changed:** `WILD=1 SEED=<n>` in the short-render copy makes a creative match-up; check its title, description and the balance line in the log.
- **If anything visual changed (new troop, overlay, map, UI):** render one still (a frame at about 10 seconds) of the specific thing that changed and look at it — not a sweep of unrelated battles. In a scratch copy of the repo, add a line to `render.js`'s frame loop that saves `canvas.toBuffer('image/png')` at the frames you want (frame 600 is 10 s) and exits after the last one; to force a team pair, set `pair` from an env var just before `RVB.setTeams`.
- **If the roster card, panel, story or outro changed:** run `node check-layout.js`; it must pass before you push. On a 2-core machine the whole check takes over 10 minutes (longer than one command may run), so run it in parts: `node check-layout.js all 1/4`, then `2/4`, `3/4` and `4/4` (two at once is fine); every part must pass. If only one kind of card/overlay changed, it's fine to eyeball that it's one of the things a given part covers and run just that part first — but all four parts still have to pass before you push.
- **If a new map was added:** compare each line-up's win rate on it against `open` with 32–40 battles each (24 swings by about 10 points either way). Walls tend to help melee against archers and mages; if a map moves a melee-vs-ranged line-up too far, make its walls low (`low: 1`: they block troops but not shots) or move them out of the fighting area.
- **If you touched a shared code path old line-ups rely on:** determinism check — run one old line-up before and after your change and compare the result; it must play out the same with the new option off.
- **For a final sanity pass, any day you changed code:** copy the repo to a scratch folder, set `SECS = 3` in the copy's `render.js`, and run `MATCHUP=<n> SEED=<n> node render.js`. Check the title, description and tags in `out/meta.json`.
- **If none of today's three things touch engine, visuals, maps, or balance** (e.g. a pure weight nudge, a text-only change): the syntax check above is enough. Don't invent test battles for a change that can't affect one.

Background processes are stopped a few minutes after you start them, so run long test-battle jobs in the foreground, a few line-ups per command (each command can run about 10 minutes). On a 2-core runner a 60-second test battle takes about 1.5 s, and balancing one line-up takes 1–2 minutes; keep each command to about 50 battles across both cores.

## 6. Ship and record

1. Commit with a clear message and push to `main`. The next upload uses the new rules.
2. Add a dated entry at the top of `CHANGELOG.md`: what you changed and why (with the view numbers if part A ran), what you tested (and what you skipped because it didn't apply — that's useful information too), and anything Rellz should do. Write it plainly, for Rellz rather than for a developer.
3. Finish with a three-line summary of today's changes for this game. (The outer Clash Autopilot session combines this with Tower Clash's three lines into one six-line report to Rellz.)

## 7. Improve this playbook

If something in this file slowed you down or led you wrong, improve it, keeping every guardrail in section 4, and say what you changed in the changelog. Rellz can override anything here by editing this file or by telling Claude in a session.
