# Video rules

Every new video reads `rules.json` when it is made, so a change here applies to the next video and every one after it. Videos that are already posted don't change.

## What you can change in `rules.json`

- **`teamPairs`**: which colours fight. Each video picks one pair at random. `weight` makes a pair more or less common: weight 3 comes up three times as often as weight 1. Which colour gets the top half is random.
  Colours available: `RED`, `BLUE`, `GREEN`, `PURPLE`, `ORANGE`, `YELLOW`.
- **`swordsmen.chancePerVideo`**: how often a video includes swordsmen (0.4 = about 4 in 10 videos, 0 = never, 1 = always).
- **`swordsmen.shareOfArmy`**: in those videos, roughly what share of each army is swordsmen (0.15 = about 15%).

## Units

| Unit | Looks like | Notes |
| --- | --- | --- |
| Soldier | small circle | cheap, most common |
| Archer | triangle | shoots from range |
| Swordsman | circle with a sword | tougher than a soldier, only in some videos |
| Knight | big ringed circle | heavy armour |
| Giant | huge circle with a crown | one per army, "Giant" armies only |

## Changing anything else

Ask Claude in a session with this repository and describe the rule in plain words, such as "make knights rarer" or "add yellow vs orange". Claude edits the code or `rules.json`, tests it and pushes it, and the next video follows the new rule.
