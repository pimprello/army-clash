# Army Clash troop classes

Every troop belongs to one class and one subclass (`rules.classes`). Each class has a passive that changes how it fights, a place in the counter table, and its own look (a badge on the roster cards and an effect on the battlefield). Twelve classes came from Rellz's list; seven (marked ★) are ours.

Counter numbers are damage multipliers (`rules.classes.counter` scales them: 0 turns the table off, 1 is as written).

## Titans

- **Role:** Massive, high-impact units
- **Passive:** Colossal: tramples small troops in its way; arrows and bullets do 20% less
- **Beaten by:** Assassins (+30%), Engineers (+35%), Swarms (+25%) and Gravitons pinning it down
- **Subclasses:** Colossus (Giant, Ancient Titan, Golem, Bone Colossus, Cyclops, Magma Colossus, Glacier Behemoth, Storm Colossus, Siege Golem); Behemoth (War Elephant, War Mammoth, Hydra, Living Fortress, Acid Leviathan, Ironhorn, Spider Queen); Skyborne (Dragon, Phoenix); Mythic (Star Eater, The Worldroot); Walking fortress (Walking Fortress, Walking Cathedral)

## Kings

- **Role:** Leaders whose aura makes everyone near them fight harder
- **Passive:** Royal Aura: friends within 170 px hit 12% harder
- **Beaten by:** Assassins (+30%) and Strategists marking them; a king beats another king (+20%)
- **Subclasses:** Warlord (General, King); Dread king (Dread Knight); Sun king (Sun King)

## Queens

- **Role:** Royal control: slows, charms and freezes
- **Passive:** Royal Decree: every 7 s, enemies within 160 px are slowed for 2 s
- **Beaten by:** Assassins (+30%) and Marksmen (+15%) who shoot from outside her decree
- **Subclasses:** Siren (Siren); Gorgon (Gorgon); Moon queen (Moon Caller); Frost queen (Frost Witch); Crystal queen (Crystal Queen)

## Builders

- **Role:** Build towers, totems and traps
- **Passive:** Cover: friends within 100 px take 10% less from shots
- **Beaten by:** Titans (+30%) smash what they build; Assassins slip past
- **Subclasses:** Fortifier (Builder, Watchtower); Trapper (Trapmaster); Totemist (Totem Shaman, War Totem); Soulsmith (Soul Smith)

## Assassins

- **Role:** Fast, deadly, fragile
- **Passive:** Backstab: the first hit on each new target does 80% more; hunts shooters, casters, healers and royals
- **Beaten by:** Guardians (take 25% less, and taunt them), Tricksters (their first hit misses)
- **Subclasses:** Shadow (Ninja, Shadow Ninja, Assassin); Reaper (Phase Reaper); Stalker (Dark Goblin, Vampire, Chain Hook); Blink (Blink Blade)

## Guardians

- **Role:** Tanks that protect everyone around them
- **Passive:** Bodyguard: friends within 90 px take 15% less; Taunt: enemy fighters nearby must fight the guardian
- **Beaten by:** Elementalists (+20%) and Gravitons (+20%) who pull them out of line
- **Subclasses:** Shieldwall (Shield Bearer, Phalanx, Fortress Turtle); Holy guard (Royal Guard, Paladin); Unbreakable (Juggernaut, Gargoyle, Sumo)

## Summoners

- **Role:** Raise minions and swarms
- **Passive:** Bond: minions near their summoner hit 20% harder, and crumble when it falls
- **Beaten by:** Kill the summoner: Assassins (+30%), Marksmen (+15%), Elementalists (+20%)
- **Subclasses:** Necromancer (Necromancer, Grave Witch, Lich); Beastcaller (Beekeeper)

## Elementalists

- **Role:** Fire, storm, earth and plague magic over an area
- **Passive:** Area mastery: +35% against Swarms, Tricksters and minions, +20% against Guardians
- **Beaten by:** Assassins (+30%), Beasts (+20%) and Marksmen (+15%)
- **Subclasses:** Pyromancer (Wizard, Warlock, Flamethrower, Fire Archer, Imp); Stormcaller (Storm Caller, Tesla Gunner); Earthshaper (Treant); Astromancer (Meteor Shepherd); Plague (Plague Alchemist)

## Beasts

- **Role:** Aggressive melee bruisers
- **Passive:** Frenzy: under half health they attack 30% faster and run 15% faster
- **Beaten by:** Spear walls (+35%), Queens (+20%) slowing them; Guardians take 20% less from them
- **Subclasses:** Pack hunter (Hellhound, Wolf Rider); Brute (Troll, Ogre, Yeti, Werewolf, Demon); Charger (War Rhino, Boar Rider, Minotaur)

## Strategists

- **Role:** Buffs, debuffs and battlefield control
- **Passive:** Battle Orders: every 6 s marks the strongest enemy nearby; friends hit it 25% harder
- **Beaten by:** Assassins (+30%) dive them; marked enemies can't dodge
- **Subclasses:** Tactician (Oracle, Warmaster); Herald (Standard Bearer, Drummer, Bard); Saboteur (Sandman, Jester)

## Engineers

- **Role:** Gadgets, turrets, war machines and siege
- **Passive:** Anti-armour: +35% against Titans and machines
- **Beaten by:** Beasts (+25%) and Assassins (+25%) rushing them
- **Subclasses:** Gadgeteer (Goblin Engineer, Turret, Bastion Engineer); War machine (Tank, Mech, Robot, Helicopter); Siege (Cannon, Catapult, Siege Gunner, Balloon Bomber)

## Monarchs

- **Role:** Rulers that combine two roles
- **Passive:** Crown and Court: a smaller royal aura (+8%) and a decree every 10 s
- **Beaten by:** Assassins (+30%); a king beats a monarch (+20%)
- **Subclasses:** Tempest (Storm Emperor); Throne (Throne Walker); Mirror (Mirror King)

## ★ Gravitons

- **Role:** Bend gravity: pull, crush, lift and throw
- **Passive:** Mass control: +35% against anything that flies, +20% against Guardians
- **Beaten by:** Titans (too heavy: pulls barely move them) and Assassins diving them
- **Why it adds strategy:** They move the battle itself: pulling a shield wall apart, lifting a giant's escort off its feet, dragging a crowd into one blast. The answer is mass (Titans barely move) or getting to them first (Assassins).
- **Subclasses:** Monk (Gravity Monk); Tyrant (Gravity Tyrant); Singularity (Singularity Sage); Orbit guard (Orbit Knight); Repulsor (Pulsar); Zero-g (Zero-g Ranger)

## ★ Chronomancers

- **Role:** Rewind, age and stop time
- **Passive:** Time field: enemies within 110 px attack 15% slower, friends 10% faster
- **Beaten by:** Marksmen from outside the field, Assassins (+25%)
- **Why it adds strategy:** They bend tempo instead of dealing damage: everything near them is slower to strike and their friends faster, so a fight inside their field is lopsided. The answer is to fight them from outside it (Marksmen) or kill them fast.
- **Subclasses:** Rewinder (Time Traveller); Executioner (Timeline Executioner); Sands (Hourglass Titan)

## ★ Tricksters

- **Role:** Illusions, disguises and copies
- **Passive:** Misdirection: every 5 s the first hit on them misses
- **Beaten by:** Elementalists (+35%: area hits can't miss) and Strategists (marked tricksters can't dodge)
- **Why it adds strategy:** They waste the enemy's best shots: the first hit every few seconds misses, decoys soak attention and copies confuse targeting. Area damage (Elementalists) and Strategists' marks cut through the tricks.
- **Subclasses:** Illusionist (Illusionist, Decoy); Shapeshifter (Mimic, Mirror Knight); Prankster (Mr 3d); Reality bender (The Unmaker)

## ★ Menders

- **Role:** Healers
- **Passive:** Cleanse: every 2 s, friends close by are cured of fire, poison and slows
- **Beaten by:** Assassins (+30%) and anything that hits fast before the heals land
- **Why it adds strategy:** They turn a long fight into a win: healing and cleansing fire, poison and slows. They lose to burst and to divers (Assassins), so where you put them matters.
- **Subclasses:** Medic (Healer, Medic Drone); Nature (Druid, Forest Spirit)

## ★ Vanguard

- **Role:** The line: swords, spears and cavalry
- **Passive:** Shoulder to shoulder: with two friends beside it, takes 12% less damage
- **Beaten by:** Titans (+25%) and Elementalists; spear walls beat Beasts and cavalry (+35%)
- **Why it adds strategy:** The line that everything else is built around: stronger shoulder to shoulder, and spear walls punish Beasts and cavalry. Titans and area magic break lines.
- **Subclasses:** Line (Soldier, Swordsman, Knight, Samurai, Orc, Dwarf, Pirate); Spear wall (Spearman, Pikeman); Shock (Berserker, Goliath); Cavalry (Lancer, Griffin Rider, Valkyrie)

## ★ Marksmen

- **Role:** Bows, guns and throwing arms
- **Passive:** Steady aim: +15% when it has stood still for half a second
- **Beaten by:** Beasts (+25%) and Assassins (+25%) closing in; Guardians take 20% less
- **Why it adds strategy:** Damage from behind the line, best when standing still. Every melee rusher (Beasts, Assassins) wants to reach them, and Guardians make them waste shots.
- **Subclasses:** Bowmen (Archer, Crossbowman, Longbowman, Elf Archer, Horse Archer); Gunners (Rifleman, Machine Gunner, Musketeer, Laser Trooper, Gunslinger, Jetpack Trooper); Sharpshooter (Sniper); Thrower (Axe Thrower, Grenadier)

## ★ Swarms

- **Role:** Many cheap troops that overwhelm
- **Passive:** Overwhelm: +8% damage for every other swarm troop hitting the same enemy (up to +40%)
- **Beaten by:** Elementalists (+35%) and Titans (+30%) hitting many at once
- **Why it adds strategy:** Numbers as a weapon: every extra swarm troop on the same enemy hits harder, so they melt giants. One good area spell (Elementalists) or a Titan stomp undoes them.
- **Subclasses:** Undead horde (Skeleton, Zombie, Empty Armour, Skeleton, Living Blade); Kamikaze (Kamikaze Drone, Barrel Bomber); Brood (Spiderling)

