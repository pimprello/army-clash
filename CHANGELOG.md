# Changelog

Newest first. Each entry says what changed in the videos and why.

## 2026-10-31

- **Maps:** battles now rotate through five battlefields. `open`, `rocks` (boulders) and `ruins` (stone pillars and walls) can come up in any battle. `trenches` (sandbag lines and craters) and `city` (rooftops and crates) are for modern and old-vs-new battles. Obstacles block troops, bullets and arrows; grenades, shells and fireballs fly over them. Every map is the same for both sides.
- **Fantasy:** new troops (skeletons, orcs, elves, wizards with fireballs, and dragons that fly and breathe fire) and five new army types: Horde, Orcs, Elves, Mages, Dragon.
- **Old vs new:** line-ups can mix eras, for example Knights vs Infantry, Giant vs Tank and Dragon vs Armored. Titles use hooks like "Old vs New 🕰️".
- **Nations:** UK vs USA, UK vs France, Brazil vs Argentina, USA vs Canada, Germany vs Italy and Spain vs Portugal join the colour pairs. They use flag colours, flag emojis in titles, and an accent ring on every troop.
- **Bullets:** machine guns show a tracer on every third round, tracers are drawn in one pass, and a cap of 160 bullets in the air keeps busy firefights readable.
- **Stats:** every video's settings are logged to `videos.jsonl`, and view counts are fetched once a day into `stats/summary.md`. This needs a `YT_API_KEY` GitHub secret.
- **Autopilot:** a daily run follows `AUTOPILOT.md` to check health, learn from views, add one new thing a day, and log it here.
- **Testing:** test battles on every new map and era, plus nation teams. No stuck troops and no errors. The 12 new line-ups are marked "pending" and join the rotation once each is balanced.
