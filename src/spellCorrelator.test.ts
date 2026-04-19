import { describe, it, expect, beforeEach } from 'vitest';
import { SpellCorrelator } from './spellCorrelator';
import type { CombatEvent } from './logParser';

function makeEvent(overrides: Partial<CombatEvent> & { type: CombatEvent['type'] }): CombatEvent {
  return {
    timestamp: Date.now(),
    type: overrides.type,
    source: '',
    target: '',
    amount: 0,
    skill: '',
    ...overrides,
  };
}

describe('SpellCorrelator — player identification', () => {
  let corr: SpellCorrelator;

  beforeEach(() => {
    corr = new SpellCorrelator();
    corr.setPlayerName('Testplayer');
  });

  it('identifies the player as a known player', () => {
    expect(corr.isKnownPlayer('Testplayer')).toBe(true);
  });

  it('does not identify random names as known', () => {
    expect(corr.isKnownPlayer('Randomguy')).toBe(false);
  });

  it('identifies group members as known', () => {
    corr.addGroupMember('Groupmate');
    expect(corr.isKnownPlayer('Groupmate')).toBe(true);
  });

  it('removes group members correctly', () => {
    corr.addGroupMember('Groupmate');
    corr.removeGroupMember('Groupmate');
    expect(corr.isKnownPlayer('Groupmate')).toBe(false);
  });
});

describe('SpellCorrelator — cast recording', () => {
  let corr: SpellCorrelator;

  beforeEach(() => {
    corr = new SpellCorrelator();
    corr.setPlayerName('Testplayer');
  });

  it('records a cast_start and uses it for spell attribution', () => {
    const now = Date.now();
    corr.setSpellDb({
      'ice comet': { baseDmg: 800, maxDmg: 800, castMs: 5500, calc: 100, minLevel: 1 },
    });

    corr.recordCastStart(makeEvent({
      type: 'cast_start',
      source: 'You',
      skill: 'Ice Comet',
      timestamp: now,
    }));

    const result = corr.attributeSpellDamage(makeEvent({
      type: 'spell_damage',
      source: '',
      target: 'a gnoll',
      amount: 800,
      timestamp: now + 6000,
    }));

    expect(result.source).toBe('Testplayer');
    expect(result.spellName).toBeTruthy();
  });

  it('handles cast failure — does not attribute specific spell after interrupt', () => {
    const now = Date.now();
    corr.setSpellDb({
      'ice comet': { baseDmg: 800, maxDmg: 800, castMs: 5500, calc: 100, minLevel: 1 },
    });

    corr.recordCastStart(makeEvent({
      type: 'cast_start',
      source: 'You',
      skill: 'Ice Comet',
      timestamp: now,
    }));

    corr.recordCastFailure('Testplayer');

    const result = corr.attributeSpellDamage(makeEvent({
      type: 'spell_damage',
      source: '',
      target: 'a gnoll',
      amount: 800,
      timestamp: now + 6000,
    }));

    // Should NOT attribute the named spell since cast was interrupted
    expect(result.spellName).not.toBe('Ice Comet');
  });
});

describe('SpellCorrelator — focus item damage tolerance', () => {
  let corr: SpellCorrelator;

  beforeEach(() => {
    corr = new SpellCorrelator();
    corr.setPlayerName('Testplayer');
    corr.setPlayerLevel(55);
    corr.setSpellDb({
      'exile undead': { baseDmg: 600, maxDmg: 600, castMs: 2750, calc: 100, minLevel: 44 },
      'ice comet': { baseDmg: 800, maxDmg: 800, castMs: 5500, calc: 100, minLevel: 1 },
    });
  });

  it('attributes damage boosted by focus items (cast-only, no landing)', () => {
    const now = Date.now();
    corr.recordCastStart(makeEvent({
      type: 'cast_start', source: 'You', skill: 'Exile Undead', timestamp: now,
    }));

    // 705 = ~17.5% above base 600 — typical focus item bonus
    const result = corr.attributeSpellDamage(makeEvent({
      type: 'spell_damage', source: '', target: 'a skeleton',
      amount: 705, timestamp: now + 3000,
    }));

    expect(result.source).toBe('Testplayer');
    expect(result.spellName).toBe('Exile Undead');
  });

  it('attributes damage boosted by focus items (with landing message)', () => {
    const now = Date.now();
    corr.setLandingMap({
      ' staggers.': [{
        spellName: 'Exile Undead', baseDmg: 600, maxDmg: 600,
        castMs: 2750, calc: 100, minLevel: 44,
      }],
    });

    corr.recordCastStart(makeEvent({
      type: 'cast_start', source: 'You', skill: 'Exile Undead', timestamp: now,
    }));
    corr.recordLanding(makeEvent({
      type: 'spell_land', source: '', target: 'a skeleton',
      skill: ' staggers.', timestamp: now + 3000,
    }));

    const result = corr.attributeSpellDamage(makeEvent({
      type: 'spell_damage', source: '', target: 'a skeleton',
      amount: 705, timestamp: now + 3000,
    }));

    expect(result.source).toBe('Testplayer');
    expect(result.spellName).toBe('Exile Undead');
    expect(result.confidence).toBe('high');
  });

  it('attributes up to +60% focus damage correctly', () => {
    const now = Date.now();
    corr.recordCastStart(makeEvent({
      type: 'cast_start', source: 'You', skill: 'Exile Undead', timestamp: now,
    }));

    // 900 = +50% above base 600 — high-end focus item
    const result = corr.attributeSpellDamage(makeEvent({
      type: 'spell_damage', source: '', target: 'a skeleton',
      amount: 900, timestamp: now + 3000,
    }));

    expect(result.source).toBe('Testplayer');
  });

  it('absurdly high damage does not get high-confidence attribution', () => {
    const now = Date.now();
    corr.recordCastStart(makeEvent({
      type: 'cast_start', source: 'You', skill: 'Exile Undead', timestamp: now,
    }));

    // 2000 = more than 3x base 600 — exceeds wide tolerance cap.
    // Step 4 rejects the spell match, Step 6 may still attribute as
    // fallback with 'low' confidence, which is acceptable.
    const result = corr.attributeSpellDamage(makeEvent({
      type: 'spell_damage', source: '', target: 'a skeleton',
      amount: 2000, timestamp: now + 3000,
    }));

    expect(result.confidence).not.toBe('high');
    expect(result.spellName).not.toBe('Exile Undead');
  });

  it('NPC casts do not interfere with player spell attribution', () => {
    const now = Date.now();

    // Player casts
    corr.recordCastStart(makeEvent({
      type: 'cast_start', source: 'You', skill: 'Exile Undead', timestamp: now,
    }));

    // NPC "a wanderer begins to cast a spell" — should be filtered by isLikelyNPC
    corr.recordCastStart(makeEvent({
      type: 'other_cast_start', source: 'a wanderer', skill: '', timestamp: now + 500,
    }));
    corr.recordCastStart(makeEvent({
      type: 'other_cast_start', source: 'a wanderer', skill: '', timestamp: now + 1000,
    }));

    const result = corr.attributeSpellDamage(makeEvent({
      type: 'spell_damage', source: '', target: 'a skeleton',
      amount: 705, timestamp: now + 3000,
    }));

    expect(result.source).toBe('Testplayer');
    expect(result.spellName).toBe('Exile Undead');
  });

  it('does NOT attribute when no casts recorded (regardless of solo/grouped)', () => {
    const now = Date.now();
    const result = corr.attributeSpellDamage(makeEvent({
      type: 'spell_damage', source: '', target: 'a gnoll',
      amount: 500, timestamp: now,
    }));

    expect(result.source).toBe('Others (Spells)');
  });
});

describe('SpellCorrelator — damage shield detection', () => {
  let corr: SpellCorrelator;

  beforeEach(() => {
    corr = new SpellCorrelator();
    corr.setPlayerName('Testplayer');
  });

  it('detects damage shields from melee hit + immediate low non-melee on same source', () => {
    const now = Date.now();

    corr.recordMeleeHit(makeEvent({
      type: 'melee_damage',
      source: 'a gnoll',
      target: 'Testplayer',
      amount: 50,
      skill: 'hits',
      timestamp: now,
    }));

    const result = corr.attributeSpellDamage(makeEvent({
      type: 'spell_damage',
      source: '',
      target: 'a gnoll',
      amount: 10,
      timestamp: now + 100,
    }));

    expect(result.isDamageShield).toBe(true);
    expect(result.source).toBe('Testplayer');
  });
});

describe('SpellCorrelator — group tracking across reset', () => {
  let corr: SpellCorrelator;

  beforeEach(() => {
    corr = new SpellCorrelator();
    corr.setPlayerName('Testplayer');
  });

  it('preserves group members across soft reset (zone change)', () => {
    corr.addGroupMember('Groupmate');
    corr.reset();
    expect(corr.isKnownPlayer('Groupmate')).toBe(true);
  });

  it('clears group members on full reset', () => {
    corr.addGroupMember('Groupmate');
    corr.fullReset();
    expect(corr.isKnownPlayer('Groupmate')).toBe(false);
  });
});

describe('SpellCorrelator — charm tracking', () => {
  let corr: SpellCorrelator;

  beforeEach(() => {
    corr = new SpellCorrelator();
    corr.setPlayerName('Testplayer');
  });

  it('tracks charm cast → charm land → credits charm owner', () => {
    const now = Date.now();

    corr.recordCharmCast('Testplayer', now);
    corr.processCharmLanding('a gnoll', now + 3000);

    const owner = corr.getCharmOwner('a gnoll', now + 5000);
    expect(owner).toBe('Testplayer');
  });

  it('charm break clears the charmed mob', () => {
    const now = Date.now();

    corr.recordCharmCast('Testplayer', now);
    corr.processCharmLanding('a gnoll', now + 3000);
    corr.handleCharmBreak('Testplayer');

    const owner = corr.getCharmOwner('a gnoll', now + 5000);
    expect(owner).toBeNull();
  });
});

describe('SpellCorrelator — NPC cast suppression', () => {
  let corr: SpellCorrelator;

  beforeEach(() => {
    corr = new SpellCorrelator();
    corr.setPlayerName('Testplayer');
    corr.setPlayerLevel(55);
    corr.setSpellDb({
      'exile undead': { baseDmg: 600, maxDmg: 600, castMs: 2750, calc: 100, minLevel: 44 },
    });
    corr.setLandingMap({
      ' staggers.': [{
        spellName: 'Exile Undead', baseDmg: 600, maxDmg: 600,
        castMs: 2750, calc: 100, minLevel: 44,
      }],
    });
  });

  it('suppresses attributeLandingDirect when NPC was casting recently', () => {
    const now = Date.now();
    corr.addGroupMember('Finaleena');

    // Group member begins to cast
    corr.recordCastStart(makeEvent({
      type: 'other_cast_start', source: 'Finaleena', skill: '', timestamp: now,
    }));
    // NPC also begins to cast
    corr.recordCastStart(makeEvent({
      type: 'other_cast_start', source: 'The Head Usher', skill: '', timestamp: now + 500,
    }));

    // Landing message arrives — could be from the NPC or the player
    const landingEv = makeEvent({
      type: 'spell_land', source: '', target: 'a skeleton',
      skill: ' staggers.', timestamp: now + 3000,
    });

    const result = corr.attributeLandingDirect(landingEv, { Finaleena: 55 });
    expect(result).toBeNull();
  });

  it('suppresses attributeWithLanding for non-player casts when NPC was casting', () => {
    const now = Date.now();
    corr.addGroupMember('Finaleena');

    // Group member begins to cast
    corr.recordCastStart(makeEvent({
      type: 'other_cast_start', source: 'Finaleena', skill: '', timestamp: now,
    }));
    // NPC also begins to cast
    corr.recordCastStart(makeEvent({
      type: 'other_cast_start', source: 'The Head Usher', skill: '', timestamp: now + 500,
    }));

    // Landing message
    corr.recordLanding(makeEvent({
      type: 'spell_land', source: '', target: 'a skeleton',
      skill: ' staggers.', timestamp: now + 3000,
    }));

    // Non-melee damage on the target
    const result = corr.attributeSpellDamage(makeEvent({
      type: 'spell_damage', source: '', target: 'a skeleton',
      amount: 600, timestamp: now + 3000,
    }));

    // Should NOT be attributed to Finaleena
    expect(result.source).not.toBe('Finaleena');
  });

  it('still attributes to player when NPC is also casting (player has verified spell name)', () => {
    const now = Date.now();

    // Player casts a known spell
    corr.recordCastStart(makeEvent({
      type: 'cast_start', source: 'You', skill: 'Exile Undead', timestamp: now,
    }));
    // NPC also begins to cast
    corr.recordCastStart(makeEvent({
      type: 'other_cast_start', source: 'The Head Usher', skill: '', timestamp: now + 500,
    }));

    // Landing + damage
    corr.recordLanding(makeEvent({
      type: 'spell_land', source: '', target: 'a skeleton',
      skill: ' staggers.', timestamp: now + 3000,
    }));

    const result = corr.attributeSpellDamage(makeEvent({
      type: 'spell_damage', source: '', target: 'a skeleton',
      amount: 600, timestamp: now + 3000,
    }));

    // Player's own verified spell should still be attributed
    expect(result.source).toBe('Testplayer');
    expect(result.spellName).toBe('Exile Undead');
  });

  it('hasRecentNpcCast returns false after NPC casts expire', () => {
    const now = Date.now();

    corr.recordCastStart(makeEvent({
      type: 'other_cast_start', source: 'The Head Usher', skill: '', timestamp: now,
    }));

    expect(corr.hasRecentNpcCast(now + 5000)).toBe(true);
    expect(corr.hasRecentNpcCast(now + 13000)).toBe(false);
  });

  it('non-melee damage on a known player is never attributed to a player', () => {
    const now = Date.now();
    corr.addGroupMember('Finaleena');

    corr.recordCastStart(makeEvent({
      type: 'other_cast_start', source: 'Finaleena', skill: '', timestamp: now,
    }));

    // Non-melee damage hits Finaleena (a group member) — must be NPC spell
    const result = corr.attributeSpellDamage(makeEvent({
      type: 'spell_damage', source: '', target: 'Finaleena',
      amount: 500, timestamp: now + 3000,
    }));

    expect(result.source).toBe('Others (Spells)');
    expect(result.confidence).toBe('high');
  });

  it('non-melee damage on the player is never attributed to a player cast', () => {
    const now = Date.now();

    corr.recordCastStart(makeEvent({
      type: 'cast_start', source: 'You', skill: 'Exile Undead', timestamp: now,
    }));

    // Non-melee damage hits the player — must be NPC spell, don't consume player's cast
    const result = corr.attributeSpellDamage(makeEvent({
      type: 'spell_damage', source: '', target: 'Testplayer',
      amount: 600, timestamp: now + 3000,
    }));

    expect(result.source).toBe('Others (Spells)');
  });

  it('clears NPC cast tracking on reset', () => {
    const now = Date.now();

    corr.recordCastStart(makeEvent({
      type: 'other_cast_start', source: 'The Head Usher', skill: '', timestamp: now,
    }));

    corr.reset();
    expect(corr.hasRecentNpcCast(now + 2000)).toBe(false);
  });
});

describe('SpellCorrelator — pet tracking', () => {
  let corr: SpellCorrelator;

  beforeEach(() => {
    corr = new SpellCorrelator();
    corr.setPlayerName('Testplayer');
  });

  it('registerPet links a pet to an owner', () => {
    corr.registerPet('Xibab', 'Testplayer');
    const owner = corr.getConfirmedPetOwner('Xibab', Date.now());
    expect(owner).toBe('Testplayer');
  });

  it('returns null for unregistered pets', () => {
    expect(corr.getConfirmedPetOwner('UnknownPet', Date.now())).toBeNull();
  });
});
