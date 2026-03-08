export type EQClass =
  | 'Warrior' | 'Rogue' | 'Monk' | 'Ranger' | 'Paladin'
  | 'Shadow Knight' | 'Bard' | 'Cleric' | 'Druid' | 'Shaman'
  | 'Wizard' | 'Magician' | 'Necromancer' | 'Enchanter';

// EQ class → WoW class color mapping
export const CLASS_COLORS: Record<EQClass, string> = {
  'Warrior':       '#C69B6D',
  'Rogue':         '#FFF468',
  'Monk':          '#00FF98',
  'Ranger':        '#AAD372',
  'Paladin':       '#F48CBA',
  'Shadow Knight': '#C41E3A',
  'Bard':          '#E268A8',
  'Cleric':        '#FFFFFF',
  'Druid':         '#FF7C0A',
  'Shaman':        '#0070DD',
  'Wizard':        '#3FC7EB',
  'Magician':      '#8788EE',
  'Necromancer':   '#A330C9',
  'Enchanter':     '#33937F',
};

export const UNKNOWN_COLOR = '#607080';

// ── Spell name → class mapping (for "You begin casting X.") ──
// ONLY class-exclusive spells belong here. Shared spells are tracked separately.

const SPELL_CLASS_MAP: Record<string, EQClass> = {};
const SHARED_SPELL_CLASSES: Record<string, Set<EQClass>> = {};

function addSpells(cls: EQClass, spells: string[]) {
  for (const s of spells) {
    const key = s.toLowerCase();
    if (SPELL_CLASS_MAP[key] && SPELL_CLASS_MAP[key] !== cls) {
      const prevCls = SPELL_CLASS_MAP[key];
      delete SPELL_CLASS_MAP[key];
      SHARED_SPELL_CLASSES[key] = new Set([prevCls, cls]);
    } else if (SHARED_SPELL_CLASSES[key]) {
      SHARED_SPELL_CLASSES[key].add(cls);
    } else {
      SPELL_CLASS_MAP[key] = cls;
    }
  }
}

// ── Comprehensive spell database ──
// Sourced from https://wiki.project1999.com/ class pages.
// Only class-EXCLUSIVE spells are listed. Shared spells (e.g. Gate, Root, Cancel Magic)
// are automatically excluded by the addSpells() dedup logic above.

addSpells('Cleric', [
  'Abolish Poison', 'Abundant Drink', 'Abundant Food', 'Aegis',
  'Aegolism', 'Antidote', 'Armor of Protection', 'Atone',
  'Bravery', 'Bulwark of Faith', 'Celestial Elixir', 'Celestial Healing',
  'Complete Healing', 'Death Pact', 'Divine Barrier', 'Divine Intervention',
  'Divine Light', 'Enforced Reverence', 'Fortitude', 'Furor',
  'Hammer of Requital', 'Heroic Bond', 'Heroism', 'Imbue Black Pearl',
  'Imbue Black Sapphire', 'Imbue Diamond', 'Imbue Opal', 'Imbue Peridot',
  'Imbue Rose Quartz', 'Imbue Ruby', 'Imbue Topaz', 'Inspire Fear',
  'Mark of Karn', 'Naltron\'s Mark', 'Reckoning', 'Remedy',
  'Resuscitate', 'Retribution', 'Reviviscence', 'Smite',
  'Sound of Force', 'Strike', 'Stun Command', 'Sunskin',
  'Symbol of Marzin', 'The Unspoken Word', 'Turning of the Unnatural', 'Unswerving Hammer',
  'Wave of Fear', 'Word Divine', 'Word of Healing', 'Word of Health',
  'Word of Pain', 'Word of Redemption', 'Word of Restoration', 'Word of Vigor',
  'Wrath',
]);

addSpells('Wizard', [
  'Abscond', 'Alter Plane: Hate', 'Alter Plane: Sky', 'Atol\'s Spectral Shackles',
  'Bonds of Force', 'Cast Force', 'Cazic Gate', 'Cazic Portal',
  'Circle of Force', 'Cobalt Scar Gate', 'Cobalt Scar Portal', 'Column of Frost',
  'Column of Lightning', 'Combine Gate', 'Combine Portal', 'Common Gate',
  'Common Portal', 'Concussion', 'Conflagration', 'Disintegrate',
  'Draught of Fire', 'Draught of Ice', 'Draught of Jiva', 'Energy Storm',
  'Enticement of Flame', 'Evacuate', 'Evacuate: Fay', 'Evacuate: Nek',
  'Evacuate: North', 'Evacuate: Ro', 'Evacuate: West', 'Fade',
  'Fay Gate', 'Fay Portal', 'Fingers of Fire', 'Fire Bolt',
  'Fire Spiral of Al\'Kabor', 'Firestorm', 'Flame Shock', 'Flaming Sword of Xuzl',
  'Force Shock', 'Force Spiral of Al\'Kabor', 'Force Strike', 'Frost Bolt',
  'Frost Shock', 'Frost Spiral of Al\'Kabor', 'Frost Storm', 'Gaze',
  'Great Divide Gate', 'Great Divide Portal', 'Harvest', 'Heat Sight',
  'Hsagra\'s Wrath', 'Ice Comet', 'Ice Shock', 'Ice Spear of Solist',
  'Iceclad Gate', 'Iceclad Portal', 'Icestrike', 'Imbue Fire Opal',
  'Inferno Shock', 'Inferno of Al\'Kabor', 'Invert Gravity', 'Invisibility to Undead',
  'Jyll\'s Static Pulse', 'Jyll\'s Wave of Heat', 'Jyll\'s Zephyr of Ice', 'Lava Storm',
  'Lightning Bolt', 'Lightning Shock', 'Lightning Storm', 'Lure of Flame',
  'Lure of Frost', 'Lure of Ice', 'Lure of Lightning', 'Magnify',
  'Manasink', 'Markar\'s Clash', 'Markar\'s Discord', 'Markar\'s Relocation',
  'Nek Gate', 'Nek Portal', 'North Gate', 'North Portal',
  'Numbing Cold', 'O\'Keils Flickering Flame', 'O\'Keils Radiation', 'Pillar of Fire',
  'Pillar of Flame', 'Pillar of Frost', 'Pillar of Lightning', 'Plainsight',
  'Porlos\' Fury', 'Project Lightning', 'Rend', 'Resistant Skin',
  'Retribution of Al\'Kabor', 'Ro Gate', 'Ro Portal', 'Shock Spiral of Al\'Kabor',
  'Shock of Fire', 'Shock of Frost', 'Shock of Ice', 'Shock of Lightning',
  'Sight', 'Sphere of Light', 'Sunstrike',
  'Supernova', 'Tears of Druzzil', 'Tears of Solusek', 'Thunder Strike',
  'Thunderbold', 'Thunderclap', 'Tishan\'s Clash', 'Tishan\'s Discord',
  'Tishan\'s Relocation', 'Tox Gate', 'Tox Portal', 'Translocate',
  'Translocate: Cazic', 'Translocate: Cobalt Scar', 'Translocate: Combine', 'Translocate: Common',
  'Translocate: Fay', 'Translocate: Great Divide', 'Translocate: Group', 'Translocate: Iceclad',
  'Translocate: Nek', 'Translocate: North', 'Translocate: Ro', 'Translocate: Tox',
  'Translocate: Wakening Lands', 'Translocate: West', 'Vengeance of Al\'Kabor', 'Voltaic Draught',
  'Wakening Lands Gate', 'Wakening Lands Portal', 'West Gate', 'West Portal',
  'Winds of Gelid', 'Wrath of Al\'Kabor', 'Yonder',
]);

addSpells('Necromancer', [
  'Allure of Death', 'Animate Dead', 'Arch Lich', 'Augment Death', 'Augmentation of Death',
  'Beguile Undead', 'Bond of Death', 'Bone Walk', 'Cajole Undead', 'Cackling Bones', 'Call of Bones',
  'Cavorting Bones', 'Cessation of Cor', 'Chill Bones', 'Chilling Embrace',
  'Coldlight', 'Conglaciation of Bone', 'Conjure Corpse', 'Convergence', 'Convoke Shadow',
  'Corporeal Empathy', 'Covetous Subversion', 'Dark Pact', 'Dead Man Floating',
  'Dead Men Floating', 'Deflux', 'Defoliation', 'Demi Lich',
  'Devouring Darkness', 'Dominate Undead', 'Emissary of Thule', 'Enslave Death',
  'Envenomed Bolt', 'Gangrenous Touch of Zum\'uul', 'Harmshield', 'Haunting Corpse', 'Hungry Earth',
  'Ignite Blood', 'Ignite Bones', 'Impart Strength', 'Incinerate Bones',
  'Infusion', 'Intensify Death', 'Invoke Death', 'Invoke Shadow',
  'Leach', 'Leering Corpse', 'Levant', 'Lich', 'Malignant Dead', 'Mend Bones',
  'Minion of Shadows', 'Pact of Shadow', 'Poison Bolt', 'Pyrocruor',
  'Quivering Veil of Xarn', 'Rapacious Subvention', 'Renew Bones', 'Restless Bones', 'Sacrifice',
  'Scent of Darkness', 'Scent of Dusk', 'Scent of Shadow', 'Scent of Terris',
  'Screaming Terror', 'Sedulous Subversion', 'Servant of Bones', 'Shadow Compact',
  'Shadowbond', 'Shock of Poison', 'Sight Graft', 'Skin of the Shadow',
  'Splurt', 'Summon Dead', 'Surge of Enfeeblement', 'Thrall of Bones', 'Torbas\' Acid Blast',
  'Touch of Night', 'Track Corpse', 'Trucidation', 'Vexing Mordinia',
  'Voice Graft',
]);

addSpells('Magician', [
  'Aegis of Ro', 'Bandoleer of Luclin', 'Barrier of Combustion', 'Blaze',
  'Bolt of Flame', 'Boon of Immolation', 'Bristlebane\'s Bundle', 'Burn',
  'Burnout', 'Burnout II', 'Burnout III', 'Burnout IV',
  'Cadeau of Flame', 'Call of the Hero', 'Char', 'Cinder Bolt',
  'Column of Fire', 'Conjuration: Air', 'Conjuration: Earth', 'Conjuration: Fire',
  'Conjuration: Water', 'Cornucopia', 'Dagger of Symbols', 'Dimensional Hole',
  'Dimensional Pocket', 'Dyzil\'s Deafening Decoy', 'Elemental Maelstrom', 'Elemental: Air',
  'Elemental: Earth', 'Elemental: Fire', 'Elemental: Water', 'Elementaling: Air',
  'Elementaling: Earth', 'Elementaling: Fire', 'Elementaling: Water', 'Elementalkin: Air',
  'Elementalkin: Earth', 'Elementalkin: Fire', 'Elementalkin: Water', 'Everfount',
  'Expedience', 'Fire Flux', 'Flame Arc', 'Flame Bolt',
  'Flame Flux', 'Flare', 'Gift of Xev', 'Greater Conjuration: Air',
  'Greater Conjuration: Earth', 'Greater Conjuration: Fire', 'Greater Conjuration: Water', 'Greater Summoning: Air',
  'Greater Summoning: Earth', 'Greater Summoning: Fire', 'Greater Summoning: Water', 'Greater Vocaration: Air',
  'Greater Vocaration: Earth', 'Greater Vocaration: Fire', 'Greater Vocaration: Water', 'Inferno Shield',
  'Lava Bolt', 'Lesser Conjuration: Air', 'Lesser Conjuration: Earth', 'Lesser Conjuration: Fire',
  'Lesser Conjuration: Water', 'Lesser Summoning: Air', 'Lesser Summoning: Earth', 'Lesser Summoning: Fire',
  'Lesser Summoning: Water', 'Mala', 'Manastorm', 'Minor Conjuration: Air',
  'Minor Conjuration: Earth', 'Minor Conjuration: Fire', 'Minor Conjuration: Water', 'Minor Summoning: Air',
  'Minor Summoning: Earth', 'Minor Summoning: Fire', 'Minor Summoning: Water', 'Modulating Rod',
  'Monster Summoning I', 'Monster Summoning II', 'Monster Summoning III', 'Muzzle of Mardu',
  'Phantom Armor', 'Phantom Chain', 'Phantom Leather', 'Phantom Plate',
  'Pouch of Quellious', 'Quiver of Marr', 'Rage of Zomm', 'Rain of Blades',
  'Rain of Fire', 'Rain of Lava', 'Rain of Spikes', 'Rain of Swords',
  'Renew Elements', 'Renew Summoning', 'Scars of Sigil', 'Scintillation',
  'Seeking Flame of Seukor', 'Shield of Fire', 'Shield of Flame', 'Shield of Lava',
  'Shock of Blades', 'Shock of Flame', 'Shock of Spikes', 'Shock of Steel',
  'Shock of Swords', 'Sirocco', 'Spear of Warding', 'Staff of Runes',
  'Staff of Symbols', 'Staff of Tracing', 'Staff of Warding', 'Summon Arrows',
  'Summon Bandages', 'Summon Coldstone', 'Summon Dagger', 'Summon Fang',
  'Summon Heatstone', 'Summon Orb', 'Summon Ring of Flight', 'Summon Shard of the Core',
  'Summon Throwing Dagger', 'Summon Waterstone', 'Summon Wisp', 'Summoning: Air',
  'Summoning: Earth', 'Summoning: Fire', 'Summoning: Water', 'Sword of Runes',
  'Valiant Companion', 'Velocity', 'Vocarate: Air', 'Vocarate: Earth',
  'Vocarate: Fire', 'Vocarate: Water', 'Wrath of the Elements',
]);

addSpells('Enchanter', [
  'Aanya\'s Animation', 'Aanya\'s Quickening', 'Adorning Grace', 'Alliance',
  'Allure', 'Anarchy', 'Asphyxiate', 'Augment',
  'Augmentation', 'Bedlam', 'Beguile', 'Benevolence',
  'Berserker Spirit', 'Berserker Strength', 'Blanket of Forgetfulness', 'Boltran\'s Agacerie',
  'Boltran\'s Animation', 'Boon of the Clear Mind', 'Boon of the Garou', 'Breeze',
  'Brilliance', 'Cajoling Whispers', 'Cast Sight', 'Chaos Flux',
  'Chaotic Feedback', 'Charm', 'Chase the Moon', 'Choke',
  'Clarify Mana', 'Clarity', 'Clarity II', 'Cloud',
  'Collaboration', 'Color Flux', 'Color Shift', 'Color Skew',
  'Color Slant', 'Crystallize Mana', 'Curse of the Simple Mind', 'Dazzle',
  'Dementia', 'Dictate', 'Discordant Mind', 'Distill Mana',
  'Dyn\'s Dizzying Draught', 'Ebbing Strength', 'Enchant Adamantite', 'Enchant Brellium',
  'Enchant Clay', 'Enchant Electrum', 'Enchant Gold', 'Enchant Mithril',
  'Enchant Platinum', 'Enchant Silver', 'Enchant Steel', 'Enchant Velium',
  'Enfeeblement', 'Enlightenment', 'Enthrall', 'Entrance',
  'Eye of Confusion', 'Fascination', 'Feckless Might', 'Feedback',
  'Forlorn Deeds', 'Gasping Embrace', 'Gift of Brilliance', 'Gift of Insight',
  'Gift of Magic', 'Gift of Pure Thought', 'Glamour of Kintaz', 'Group Resist Magic',
  'Haze', 'Illusion: Air Elemental', 'Illusion: Barbarian', 'Illusion: Dark Elf',
  'Illusion: Dry Bone', 'Illusion: Dwarf', 'Illusion: Earth Elemental', 'Illusion: Erudite',
  'Illusion: Fire Elemental', 'Illusion: Gnome', 'Illusion: Half-Elf', 'Illusion: Halfling',
  'Illusion: High Elf', 'Illusion: Human', 'Illusion: Iksar', 'Illusion: Ogre',
  'Illusion: Skeleton', 'Illusion: Spirit Wolf', 'Illusion: Tree', 'Illusion: Troll',
  'Illusion: Water Elemental', 'Illusion: Werewolf', 'Illusion: Wood Elf', 'Insight',
  'Insipid Weakness', 'Juli\'s Animation', 'Kilan\'s Animation', 'Kintaz\'s Animation',
  'Languid Pace', 'Largarn\'s Lamentation', 'Mana Sieve', 'Memory Blur',
  'Memory Flux', 'Mesmerization', 'Mesmerize', 'Mind Wipe',
  'Minor Illusion', 'Mircyl\'s Animation', 'Mist', 'Obscure',
  'Overwhelming Splendor', 'Pendril\'s Animation', 'Pillage Enchantment', 'Purify Mana',
  'Radiant Visage', 'Rampage', 'Rapture', 'Recant Magic',
  'Reoccurring Amnesia', 'Rune I', 'Rune II', 'Rune III',
  'Rune IV', 'Rune V', 'Sagar\'s Animation', 'Sanity Warp',
  'Sentinel', 'Shade', 'Shadow', 'Shalee\'s Animation',
  'Shallow Breath', 'Shiftless Deeds', 'Sisna\'s Animation', 'Strip Enchantment',
  'Suffocate', 'Suffocating Sphere', 'Swift Like The Wind', 'Sympathetic Aura',
  'Taper Enchantment', 'Tashan', 'Tashani', 'Tashania',
  'Tashanian', 'Tepid Deeds', 'Theft of Thought', 'Thicken Mana',
  'Torment of Argli', 'Uleen\'s Animation', 'Umbra', 'Visions of Grandeur',
  'Wandering Mind', 'Weaken', 'Weakness', 'Whirl Till You Hurl',
  'Wind of Tashani', 'Wind of Tishanian', 'Wonderous Rapidity', 'Yegoreff\'s Animation',
  'Zumaik\'s Animation',
]);

addSpells('Druid', [
  'Allure of the Wild', 'Avalanche', 'Beguile Animals', 'Beguile Plants',
  'Bladecoat', 'Blizzard', 'Bonds of Tunare', 'Breath of Karana',
  'Breath of Ro', 'Call of Karana', 'Cascade of Hail', 'Circle of Butcher',
  'Circle of Cobalt Scar', 'Circle of Commons', 'Circle of Feerrott', 'Circle of Great Divide',
  'Circle of Iceclad', 'Circle of Karana', 'Circle of Lavastorm', 'Circle of Misty',
  'Circle of Ro', 'Circle of Steamfont', 'Circle of Summer', 'Circle of Surefall Glade',
  'Circle of Toxxulia', 'Circle of Wakening Lands', 'Circle of Winter', 'Circle of the Combines',
  'Combust', 'Creeping Crud', 'Dizzying Wind', 'Drifting Death',
  'Egress', 'Engorging Roots', 'Engulfing Roots', 'Entrapping Roots',
  'Feral Spirit', 'Fire', 'Fist of Karana', 'Fixation of Ro',
  'Form of the Great Wolf', 'Form of the Howler', 'Form of the Hunter', 'Frost',
  'Fury of Air', 'Girdle of Karana', 'Glamour of Tunare', 'Ice',
  'Improved Superior Camouflage', 'Legacy of Spike', 'Legacy of Thorn', 'Lightning Blast',
  'Lightning Strike', 'Mask of the Hunter', 'Nature Walkers Behest', 'Nature\'s Touch',
  'Natureskin', 'Pack Chloroplast', 'Pack Regeneration', 'Pack Spirit',
  'Pogonip', 'Protection of the Glades', 'Regrowth of the Grove', 'Repulse Animal',
  'Ring of Butcher', 'Ring of Cobalt Scar', 'Ring of Commons', 'Ring of Feerrott',
  'Ring of Great Divide', 'Ring of Iceclad', 'Ring of Karana', 'Ring of Lavastorm',
  'Ring of Misty', 'Ring of Ro', 'Ring of Steamfont', 'Ring of Surefall Glade',
  'Ring of Toxxulia', 'Ring of Wakening Lands', 'Ring of the Combines', 'Ro\'s Fiery Sundering',
  'Savage Spirit', 'Scoriae', 'Share Wolf Form', 'Shield of Barbs',
  'Shield of Blades', 'Shield of Thorns', 'Spirit of Oak', 'Starfire',
  'Starshine', 'Strength of Stone', 'Succor', 'Succor: Butcher',
  'Succor: East', 'Succor: Lavastorm', 'Succor: North', 'Succor: Ro',
  'Sunbeam', 'Terrorize Animal', 'Treeform', 'Tunare\'s Request',
  'Wake of Karana', 'Whirling Wind', 'Wildfire', 'Wind of the North',
  'Wind of the South', 'Winged Death',
]);

addSpells('Shaman', [
  'Abolish Disease', 'Acumen', 'Affliction', 'Agility',
  'Alluring Aura', 'Assiduous Vision', 'Avatar', 'Bane of Nife',
  'Blast of Poison', 'Blizzard Blast', 'Burst of Strength', 'Cannibalize',
  'Cannibalize II', 'Cannibalize III', 'Cannibalize IV', 'Charisma',
  'Companion Spirit', 'Creeping Vision', 'Deftness', 'Deliriously Nimble',
  'Dexterity', 'Dexterous Aura', 'Drowsy', 'Envenomed Breath',
  'Fleeting Fury', 'Focus of Spirit', 'Form of the Great Bear', 'Frenzied Spirit',
  'Frenzy', 'Frost Rift', 'Frost Strike', 'Furious Strength',
  'Fury', 'Gale of Poison', 'Glamour', 'Guardian',
  'Guardian Spirit', 'Health', 'Ice Strike', 'Imbue Ivory',
  'Imbue Jade', 'Inner Fire', 'Insidious Decay', 'Insidious Fever',
  'Insidious Malady', 'Malo', 'Maniacal Strength', 'Mortal Deftness',
  'Nimble', 'Poison Storm', 'Pox of Bertoxxulous', 'Primal Avatar',
  'Protect', 'Rage', 'Raging Strength', 'Riotous Health',
  'Rising Dexterity', 'Scale Skin', 'Shifting Shield', 'Shock of the Tainted',
  'Shrink', 'Shroud of the Spirits', 'Sicken', 'Spirit Pouch',
  'Spirit Quickening', 'Spirit Sight', 'Spirit Strength', 'Spirit Strike',
  'Spirit of Bear', 'Spirit of Cat', 'Spirit of Monkey', 'Spirit of Ox',
  'Spirit of Snake', 'Spirit of the Howler', 'Stamina', 'Strength',
  'Tagar\'s Insects', 'Tainted Breath', 'Talisman of Altuna', 'Talisman of Jasinth',
  'Talisman of Kragg', 'Talisman of Shadoo', 'Talisman of Tnarg', 'Talisman of the Brute',
  'Talisman of the Cat', 'Talisman of the Raptor', 'Talisman of the Rhino', 'Talisman of the Serpent',
  'Tigir\'s Insects', 'Togor\'s Insects', 'Torpor', 'Torrent of Poison',
  'Tumultuous Strength', 'Turgur\'s Insects', 'Turtle Skin', 'Unfailing Reverence',
  'Vigilant Spirit', 'Vision', 'Voice of the Berserker', 'Walking Sleep',
  'Winter\'s Roar',
]);

addSpells('Ranger', [
  'Call of Earth', 'Call of Fire', 'Call of Flame', 'Call of Sky',
  'Call of the Predator', 'Careless Lightning', 'Cinder Jolt', 'Dance of the Fireflies',
  'Ensnaring Roots', 'Eyes of the Cat', 'Falcon Eye', 'Flame Lick',
  'Flaming Arrow', 'Force of Nature', 'Hawk Eye', 'Immolate',
  'Jolt', 'Nature\'s Precision', 'Strength of Nature',
  'Swarm of Pain', 'Ward of Naltron', 'Warder\'s Protection',
]);

addSpells('Paladin', [
  'Blessed Armor', 'Breath of Tunare', 'Celestial Cleansing', 'Courage',
  'Divine Favor', 'Divine Glory', 'Divine Might', 'Divine Purpose',
  'Divine Strength', 'Expulse Undead', 'Flame of Light',
  'Force of Akera', 'Guard of Druzzil', 'Holy Armor',
  'Holy Might', 'Instrument of Nife', 'Lay on Hands', 'Light of Nife',
  'Reckoning', 'Stun', 'Symbol of Transal', 'Ward Undead', 'Wave of Healing', 'Yaulp',
]);

addSpells('Shadow Knight', [
  'Animate Dead', 'Bobbing Corpse', 'Bone Walk', 'Clinging Darkness',
  'Convoke Shadow', 'Dark Empathy', 'Death Peace', 'Disease Cloud',
  'Dooming Darkness', 'Drain Soul', 'Engulfing Darkness',
  'Festering Darkness', 'Heart Flutter', 'Howl of the Damned',
  'Life Leech', 'Lifedraw', 'Lifespike', 'Lifetap',
  'Malignant Dead', 'Shroud of Death', 'Shroud of Hate',
  'Shroud of Pain', 'Shroud of Undeath', 'Siphon Strength',
  'Strengthen Death', 'Summon Dead', 'Word of Shadow',
]);

addSpells('Bard', [
  'Agilmente\'s Aria of Eagles', 'Alenia\'s Disenchanting Melody',
  'Angstlich\'s Appalling Screech', 'Angstlich\'s Assonance',
  'Anthem De Arms', 'Brusco\'s Boastful Bellow', 'Brusco\'s Bombastic Bellow',
  'Cantana of Soothing', 'Cantata of Replenishment',
  'Cassindra\'s Chant of Clarity', 'Cassindra\'s Chorus of Clarity', 'Cassindra\'s Elegy',
  'Cassindra\'s Insipid Ditty', 'Chant of Battle', 'Chords of Dissonance',
  'Cinda\'s Charismatic Carillon', 'Composition of Ervaj', 'Crission\'s Pixie Strike',
  'Denon\'s Bereavement', 'Denon\'s Desperate Dirge',
  'Denon\'s Disruptive Discord', 'Denon\'s Dissension',
  'Elemental Rhythms', 'Fufil\'s Curtailing Chant',
  'Guardian Rhythms', 'Hymn of Restoration',
  'Jaxan\'s Jig o\' Vigor', 'Jonthan\'s Inspiration',
  'Jonthan\'s Provocation', 'Jonthan\'s Whistling Warsong',
  'Kazumi\'s Note of Preservation', 'Kelin\'s Lucid Lullaby',
  'Kelin\'s Lugubrious Lament', 'Largo\'s Absonant Binding', 'Largo\'s Melodic Binding',
  'Lyssa\'s Cataloging Libretto', 'Lyssa\'s Locating Lyric',
  'Lyssa\'s Solidarity of Vision', 'Lyssa\'s Veracious Concord',
  'McVaxius\' Berserker Crescendo', 'McVaxius\' Rousing Rondo',
  'Melanie\'s Mellifluous Motion', 'Melody of Ervaj',
  'Nillipus\' March of the Wee', 'Niv\'s Harmonic', 'Niv\'s Melody of Preservation',
  'Occlusion of Sound', 'Psalm of Cooling', 'Psalm of Mystic Shielding',
  'Psalm of Purity', 'Psalm of Vitality', 'Psalm of Warmth',
  'Purifying Rhythms', 'Selo\'s Accelerando', 'Selo\'s Assonant Strane',
  'Selo\'s Chords of Cessation', 'Selo\'s Consonant Chain', 'Selo\'s Song of Travel',
  'Shauri\'s Sonorous Clouding', 'Shield of Song',
  'Solon\'s Bewitching Bravura', 'Solon\'s Charismatic Concord', 'Solon\'s Song of the Sirens',
  'Song of Dawn', 'Song of Highsun', 'Song of Midnight', 'Song of Twilight',
  'Syvelian\'s Anti-Magic Aria', 'Tarew\'s Aquatic Ayre',
  'Tuyen\'s Chant of Flame', 'Tuyen\'s Chant of Frost',
  'Verses of Victory', 'Vilia\'s Chorus of Celerity', 'Vilia\'s Verses of Celerity',
]);

// ── /who class name → EQClass mapping ──
// Includes base class names AND all P99 level titles (51-60)

const WHO_CLASS_MAP: Record<string, EQClass> = {};
function addWhoAliases(cls: EQClass, names: string[]) {
  for (const n of names) WHO_CLASS_MAP[n.toLowerCase()] = cls;
}

// Base names + abbreviations
addWhoAliases('Warrior', ['Warrior', 'War']);
addWhoAliases('Rogue', ['Rogue', 'Rog']);
addWhoAliases('Monk', ['Monk', 'Mnk']);
addWhoAliases('Ranger', ['Ranger', 'Rng']);
addWhoAliases('Paladin', ['Paladin', 'Pal']);
addWhoAliases('Shadow Knight', ['Shadow Knight', 'Shadowknight', 'Shd Knt', 'ShdKnt', 'Shd']);
addWhoAliases('Bard', ['Bard', 'Brd']);
addWhoAliases('Cleric', ['Cleric', 'Clr']);
addWhoAliases('Druid', ['Druid', 'Dru']);
addWhoAliases('Shaman', ['Shaman', 'Shm']);
addWhoAliases('Wizard', ['Wizard', 'Wiz']);
addWhoAliases('Magician', ['Magician', 'Mag']);
addWhoAliases('Necromancer', ['Necromancer', 'Nec']);
addWhoAliases('Enchanter', ['Enchanter', 'Enc']);

// Level 51-54 titles
addWhoAliases('Warrior', ['Champion']);
addWhoAliases('Cleric', ['Vicar']);
addWhoAliases('Paladin', ['Cavalier']);
addWhoAliases('Ranger', ['Pathfinder']);
addWhoAliases('Shadow Knight', ['Reaver']);
addWhoAliases('Druid', ['Wanderer']);
addWhoAliases('Monk', ['Disciple']);
addWhoAliases('Bard', ['Minstrel']);
addWhoAliases('Rogue', ['Rake']);
addWhoAliases('Shaman', ['Mystic']);
addWhoAliases('Necromancer', ['Heretic']);
addWhoAliases('Wizard', ['Channeler']);
addWhoAliases('Magician', ['Elementalist']);
addWhoAliases('Enchanter', ['Illusionist']);

// Level 55-59 titles
addWhoAliases('Warrior', ['Myrmidon']);
addWhoAliases('Cleric', ['Templar']);
addWhoAliases('Paladin', ['Knight']);
addWhoAliases('Ranger', ['Outrider']);
addWhoAliases('Shadow Knight', ['Revenant']);
addWhoAliases('Druid', ['Preserver']);
addWhoAliases('Monk', ['Master']);
addWhoAliases('Bard', ['Troubadour']);
addWhoAliases('Rogue', ['Blackguard']);
addWhoAliases('Shaman', ['Luminary']);
addWhoAliases('Necromancer', ['Defiler']);
addWhoAliases('Wizard', ['Evoker']);
addWhoAliases('Magician', ['Conjurer']);
addWhoAliases('Enchanter', ['Beguiler']);

// Level 60 titles
addWhoAliases('Warrior', ['Warlord']);
addWhoAliases('Cleric', ['High Priest']);
addWhoAliases('Paladin', ['Crusader']);
addWhoAliases('Ranger', ['Warder']);
addWhoAliases('Shadow Knight', ['Grave Lord']);
addWhoAliases('Druid', ['Hierophant']);
addWhoAliases('Monk', ['Grandmaster']);
addWhoAliases('Bard', ['Virtuoso']);
addWhoAliases('Rogue', ['Assassin']);
addWhoAliases('Shaman', ['Oracle']);
addWhoAliases('Necromancer', ['Warlock']);
addWhoAliases('Wizard', ['Sorcerer']);
addWhoAliases('Magician', ['Arch Mage']);
addWhoAliases('Enchanter', ['Phantasmist']);

export function detectClassFromWho(className: string): EQClass | null {
  return WHO_CLASS_MAP[className.toLowerCase().trim()] || null;
}

// ── Single-skill detection ──

const ROGUE_MELEE_SKILLS = new Set(['backstab', 'backstabs']);
const MONK_MELEE_SKILLS = new Set(['strike', 'strikes']);

function normalizeSpellKey(name: string): string {
  return name.toLowerCase().replace(/`/g, "'");
}

export function detectClassFromSpell(spellName: string): EQClass | null {
  return SPELL_CLASS_MAP[normalizeSpellKey(spellName)] || null;
}

/** Returns candidate classes for a spell: [singleClass] if exclusive,
 *  [class1, class2, ...] if shared, null if completely unknown. */
export function getSpellCandidateClasses(spellName: string): EQClass[] | null {
  const key = normalizeSpellKey(spellName);
  const exclusive = SPELL_CLASS_MAP[key];
  if (exclusive) return [exclusive];
  const shared = SHARED_SPELL_CLASSES[key];
  if (shared) return [...shared];
  return null;
}

export function detectClassFromMelee(skill: string): EQClass | null {
  const s = skill.toLowerCase();
  if (ROGUE_MELEE_SKILLS.has(s)) return 'Rogue';
  if (MONK_MELEE_SKILLS.has(s)) return 'Monk';
  return null;
}

// ── Melee skill combination tracker ──

const SKILL_CLASS_EXCLUSIVE: Record<string, EQClass> = {
  'backstab': 'Rogue', 'backstabs': 'Rogue',
  'flying kick': 'Monk', 'flying kicks': 'Monk',
  'round kick': 'Monk', 'round kicks': 'Monk',
  'eagle strike': 'Monk', 'eagle strikes': 'Monk',
  'tiger claw': 'Monk', 'tiger claws': 'Monk',
  'dragon punch': 'Monk', 'dragon punches': 'Monk',
  'frenzy': 'Warrior', 'frenzies': 'Warrior',
};

type ClassGroup = EQClass[];
const SKILL_CLASS_GROUPS: Record<string, ClassGroup> = {
  'bash': ['Warrior', 'Paladin', 'Shadow Knight'],
  'bashes': ['Warrior', 'Paladin', 'Shadow Knight'],
  'slam': ['Warrior', 'Paladin', 'Shadow Knight'],
  'slams': ['Warrior', 'Paladin', 'Shadow Knight'],
  'kick': ['Warrior', 'Ranger', 'Monk', 'Rogue', 'Bard', 'Paladin', 'Shadow Knight'],
  'kicks': ['Warrior', 'Ranger', 'Monk', 'Rogue', 'Bard', 'Paladin', 'Shadow Knight'],
  'strike': ['Monk'],
  'strikes': ['Monk'],
};

export class MeleeSkillTracker {
  private entitySkills: Record<string, Set<string>> = {};

  recordSkill(entityName: string, skill: string) {
    if (!this.entitySkills[entityName]) {
      this.entitySkills[entityName] = new Set();
    }
    this.entitySkills[entityName].add(skill.toLowerCase());
  }

  inferClass(entityName: string): EQClass | null {
    const skills = this.entitySkills[entityName];
    if (!skills) return null;

    for (const s of skills) {
      if (SKILL_CLASS_EXCLUSIVE[s]) return SKILL_CLASS_EXCLUSIVE[s];
    }

    let candidates: Set<EQClass> | null = null;
    for (const s of skills) {
      const group = SKILL_CLASS_GROUPS[s];
      if (group) {
        if (candidates === null) {
          candidates = new Set(group);
        } else {
          const next = new Set<EQClass>();
          for (const c of group) {
            if (candidates.has(c)) next.add(c);
          }
          candidates = next;
        }
      }
    }

    if (candidates && candidates.size === 1) {
      return [...candidates][0];
    }

    return null;
  }

  reset() {
    this.entitySkills = {};
  }
}

export const CLASS_SHORT: Record<EQClass, string> = {
  'Warrior':       'WAR',
  'Rogue':         'ROG',
  'Monk':          'MNK',
  'Ranger':        'RNG',
  'Paladin':       'PAL',
  'Shadow Knight': 'SHD',
  'Bard':          'BRD',
  'Cleric':        'CLR',
  'Druid':         'DRU',
  'Shaman':        'SHM',
  'Wizard':        'WIZ',
  'Magician':      'MAG',
  'Necromancer':   'NEC',
  'Enchanter':     'ENC',
};

export type DetectionSource = 'melee_infer' | 'buff_land' | 'spell_cast' | 'discipline' | 'who_result';

export const DETECTION_CONFIDENCE: Record<DetectionSource, number> = {
  'melee_infer':  1,
  'buff_land':    2,
  'spell_cast':   3,
  'discipline':   4,
  'who_result':   5,
};
