# Video rules

Every new video reads `rules.json` when it is made, so a change here applies to the next video and every one after it. Videos that are already posted don't change.

## What you can change in `rules.json`

- **`teamPairs`**: which colours fight. Each video picks one pair at random. `weight` makes a pair more or less common: weight 3 comes up three times as often as weight 1. Which colour gets the top half is random.
  Colours available: `RED`, `BLUE`, `GREEN`, `PURPLE`, `ORANGE`, `YELLOW`, `PINK`, `CYAN`, `WHITE`, `BROWN`.
- **`teamStyles`**: a colour can fight its own way. `ORANGE` armies are about 60% swordsmen (`swordsmenShare`), with a slightly smaller army (`budget` 0.96) so they still win about half their battles.
- **`matchups`**: the troop line-ups, used in order, one per video, then starting again from the top (24 at the moment). Each has a `top` and `bottom` army type, optional `troops` (extra troop types to mix in, e.g. `["spearman", "healer"]`), optional `"era": "modern"` for a modern-warfare battle (every fourth line-up), and `balance`: the bottom army's size compared with the top, tuned by test battles so each line-up is close to 50/50.
  Medieval army types: `SWARM`, `ARCHERS`, `KNIGHTS`, `BALANCED`, `GIANT`. Modern army types: `INFANTRY`, `ASSAULT`, `SNIPERS`, `ARMORED` (has a tank), `COMBINED`.
- **`troopShares`**: in line-ups that include an extra troop, roughly what share of each army it makes up (0.15 = about 15%).
- **`formations`**: how each army lines up at the start. Each video takes the next formation for each side from this list (the two sides usually differ), shifting each time the line-up list starts over. Available: `line`, `wedge` (narrow tip at the front), `columns` (three columns), `crescent` (ends curve forward), `flanks` (two groups with a gap in the middle), `block` (narrow and deep).
- **`formationBudget`**: army size per formation, so no formation wins more often than a plain line. In test battles wedge and columns won more (58% vs 47%) and crescent and block won less (36%), so their armies are nudged by 0.5 to 1.5%.

## Titles

Titles stay short: team emojis, the two colours and a short hook, for example `🟢 Green vs Purple 🟣 | Who Wins? ⚔️ #shorts`. The army types (Swarm, Knights and so on) go in the description. Hooks are listed in `render.js`.

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
| Giant | huge circle with a crown | one per army, "Giant" armies only |

## Changing anything else

Ask Claude in a session with this repository and describe the rule in plain words, such as "make knights rarer" or "add yellow vs orange". Claude edits the code or `rules.json`, tests it and pushes it, and the next video follows the new rule.
