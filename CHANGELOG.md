# Changelog

Newest first. Each entry says what changed in the videos and why.

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
