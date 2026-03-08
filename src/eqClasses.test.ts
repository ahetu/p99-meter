import { describe, it, expect } from 'vitest';
import {
  detectClassFromWho,
  detectClassFromSpell,
  detectClassFromMelee,
  getSpellCandidateClasses,
  MeleeSkillTracker,
  CLASS_COLORS,
  CLASS_SHORT,
} from './eqClasses';

describe('detectClassFromWho', () => {
  it('detects standard class names', () => {
    expect(detectClassFromWho('Wizard')).toBe('Wizard');
    expect(detectClassFromWho('Cleric')).toBe('Cleric');
    expect(detectClassFromWho('Shadow Knight')).toBe('Shadow Knight');
    expect(detectClassFromWho('Necromancer')).toBe('Necromancer');
    expect(detectClassFromWho('Enchanter')).toBe('Enchanter');
  });

  it('detects /who title aliases', () => {
    expect(detectClassFromWho('Grave Lord')).toBe('Shadow Knight');
    expect(detectClassFromWho('Phantasmist')).toBe('Enchanter');
    expect(detectClassFromWho('Grandmaster')).toBe('Monk');
    expect(detectClassFromWho('Arch Mage')).toBe('Magician');
    expect(detectClassFromWho('Sorcerer')).toBe('Wizard');
    expect(detectClassFromWho('Oracle')).toBe('Shaman');
    expect(detectClassFromWho('Virtuoso')).toBe('Bard');
    expect(detectClassFromWho('Assassin')).toBe('Rogue');
    expect(detectClassFromWho('Crusader')).toBe('Paladin');
    expect(detectClassFromWho('Warder')).toBe('Ranger');
    expect(detectClassFromWho('Hierophant')).toBe('Druid');
    expect(detectClassFromWho('Warlock')).toBe('Necromancer');
  });

  it('is case-insensitive', () => {
    expect(detectClassFromWho('wizard')).toBe('Wizard');
    expect(detectClassFromWho('CLERIC')).toBe('Cleric');
    expect(detectClassFromWho('grave lord')).toBe('Shadow Knight');
  });

  it('returns null for unknown classes', () => {
    expect(detectClassFromWho('Goblin')).toBeNull();
    expect(detectClassFromWho('')).toBeNull();
    expect(detectClassFromWho('ANONYMOUS')).toBeNull();
  });

  it('trims whitespace', () => {
    expect(detectClassFromWho('  Wizard  ')).toBe('Wizard');
  });

  it('detects Heretic as Necromancer', () => {
    expect(detectClassFromWho('Heretic')).toBe('Necromancer');
  });
});

describe('detectClassFromSpell', () => {
  it('detects class-exclusive spells', () => {
    expect(detectClassFromSpell('Complete Healing')).toBe('Cleric');
    expect(detectClassFromSpell('Ice Comet')).toBe('Wizard');
  });

  it('is case-insensitive', () => {
    expect(detectClassFromSpell('complete healing')).toBe('Cleric');
  });

  it('returns null for unknown spells', () => {
    expect(detectClassFromSpell('Totally Made Up Spell')).toBeNull();
  });
});

describe('getSpellCandidateClasses', () => {
  it('returns single-class array for exclusive spells', () => {
    const result = getSpellCandidateClasses('Complete Healing');
    expect(result).toEqual(['Cleric']);
  });

  it('returns null for unknown spells', () => {
    expect(getSpellCandidateClasses('Unknown Spell')).toBeNull();
  });
});

describe('detectClassFromMelee', () => {
  it('detects Rogue from backstab', () => {
    expect(detectClassFromMelee('backstab')).toBe('Rogue');
    expect(detectClassFromMelee('backstabs')).toBe('Rogue');
  });

  it('detects Monk from strike', () => {
    expect(detectClassFromMelee('strike')).toBe('Monk');
    expect(detectClassFromMelee('strikes')).toBe('Monk');
  });

  it('returns null for shared melee skills', () => {
    expect(detectClassFromMelee('crush')).toBeNull();
    expect(detectClassFromMelee('hit')).toBeNull();
    expect(detectClassFromMelee('slash')).toBeNull();
  });
});

describe('MeleeSkillTracker', () => {
  it('infers Rogue from backstab skill', () => {
    const tracker = new MeleeSkillTracker();
    tracker.recordSkill('TestPlayer', 'backstabs');
    expect(tracker.inferClass('TestPlayer')).toBe('Rogue');
  });

  it('infers Monk from flying kick', () => {
    const tracker = new MeleeSkillTracker();
    tracker.recordSkill('TestPlayer', 'flying kicks');
    expect(tracker.inferClass('TestPlayer')).toBe('Monk');
  });

  it('returns null with insufficient data', () => {
    const tracker = new MeleeSkillTracker();
    tracker.recordSkill('TestPlayer', 'hits');
    expect(tracker.inferClass('TestPlayer')).toBeNull();
  });

  it('narrows class from bash to tank classes', () => {
    const tracker = new MeleeSkillTracker();
    tracker.recordSkill('TestPlayer', 'bashes');
    const cls = tracker.inferClass('TestPlayer');
    if (cls) {
      expect(['Warrior', 'Paladin', 'Shadow Knight']).toContain(cls);
    }
  });

  it('resets tracked data', () => {
    const tracker = new MeleeSkillTracker();
    tracker.recordSkill('TestPlayer', 'backstabs');
    tracker.reset();
    expect(tracker.inferClass('TestPlayer')).toBeNull();
  });
});

describe('CLASS_COLORS', () => {
  it('has a color for every class', () => {
    const classes = [
      'Warrior', 'Rogue', 'Monk', 'Ranger', 'Paladin',
      'Shadow Knight', 'Bard', 'Cleric', 'Druid', 'Shaman',
      'Wizard', 'Magician', 'Necromancer', 'Enchanter',
    ] as const;
    for (const cls of classes) {
      expect(CLASS_COLORS[cls]).toBeTruthy();
      expect(CLASS_COLORS[cls]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

describe('CLASS_SHORT', () => {
  it('has a short name for every class', () => {
    const classes = [
      'Warrior', 'Rogue', 'Monk', 'Ranger', 'Paladin',
      'Shadow Knight', 'Bard', 'Cleric', 'Druid', 'Shaman',
      'Wizard', 'Magician', 'Necromancer', 'Enchanter',
    ] as const;
    for (const cls of classes) {
      expect(CLASS_SHORT[cls]).toBeTruthy();
      expect(CLASS_SHORT[cls].length).toBeLessThanOrEqual(4);
    }
  });
});
