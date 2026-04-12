import { describe, it, expect } from 'vitest';
import { parseLine, tryMatchLanding, tryMatchCharmLanding, extractCharacterName } from './logParser';

const TS = '[Mon Mar 03 21:30:00 2025]';

function parse(msg: string) {
  return parseLine(`${TS} ${msg}`);
}

describe('logParser — melee damage', () => {
  it('parses first-person melee (You crush)', () => {
    const ev = parse('You crush a gnoll for 42 points of damage.');
    expect(ev).toBeTruthy();
    expect(ev!.type).toBe('melee_damage');
    expect(ev!.source).toBe('You');
    expect(ev!.target).toBe('a gnoll');
    expect(ev!.amount).toBe(42);
    expect(ev!.skill).toBe('crush');
  });

  it('parses first-person backstab', () => {
    const ev = parse('You backstab a fire beetle for 18 points of damage.');
    expect(ev!.type).toBe('melee_damage');
    expect(ev!.skill).toBe('backstab');
    expect(ev!.amount).toBe(18);
  });

  it('parses third-person melee (Soandso hits)', () => {
    const ev = parse('Soandso hits a rat for 10 points of damage.');
    expect(ev!.type).toBe('melee_damage');
    expect(ev!.source).toBe('Soandso');
    expect(ev!.target).toBe('a rat');
    expect(ev!.amount).toBe(10);
    expect(ev!.skill).toBe('hit');
  });

  it('parses NPC melee with multi-word name', () => {
    const ev = parse('Guard Blayle crushes Soandso for 150 points of damage.');
    expect(ev!.type).toBe('melee_damage');
    expect(ev!.source).toBe('Guard Blayle');
    expect(ev!.target).toBe('Soandso');
    expect(ev!.amount).toBe(150);
  });

  it('handles singular "point of damage"', () => {
    const ev = parse('You hit a rat for 1 point of damage.');
    expect(ev!.type).toBe('melee_damage');
    expect(ev!.amount).toBe(1);
  });
});

describe('logParser — pet melee', () => {
  it('parses pet melee with backtick', () => {
    const ev = parse('Soandso`s pet hits a gnoll for 25 points of damage.');
    expect(ev!.type).toBe('pet_melee');
    expect(ev!.source).toBe('Soandso');
    expect(ev!.target).toBe('a gnoll');
    expect(ev!.amount).toBe(25);
    expect(ev!.skill).toBe('hit');
  });

  it('parses warder melee', () => {
    const ev = parse("Soandso`s warder bites a bat for 12 points of damage.");
    expect(ev!.type).toBe('pet_melee');
    expect(ev!.source).toBe('Soandso');
    expect(ev!.amount).toBe(12);
  });
});

describe('logParser — spell damage', () => {
  it('parses non-melee damage', () => {
    const ev = parse('a gnoll was hit by non-melee for 200 points of damage.');
    expect(ev!.type).toBe('spell_damage');
    expect(ev!.source).toBe('');
    expect(ev!.target).toBe('a gnoll');
    expect(ev!.amount).toBe(200);
  });
});

describe('logParser — misses', () => {
  it('parses first-person miss', () => {
    const ev = parse('You try to slash a bat, but miss!');
    expect(ev!.type).toBe('miss');
    expect(ev!.source).toBe('You');
    expect(ev!.target).toBe('a bat');
    expect(ev!.skill).toBe('slash');
  });

  it('parses third-person miss', () => {
    const ev = parse('a gnoll tries to hit Soandso, but misses!');
    expect(ev!.type).toBe('miss');
    expect(ev!.source).toBe('a gnoll');
    expect(ev!.target).toBe('Soandso');
  });
});

describe('logParser — deaths', () => {
  it('parses "You have slain"', () => {
    const ev = parse('You have slain a rat!');
    expect(ev!.type).toBe('death');
    expect(ev!.source).toBe('You');
    expect(ev!.target).toBe('a rat');
  });

  it('parses "has been slain by"', () => {
    const ev = parse('a gnoll has been slain by Soandso!');
    expect(ev!.type).toBe('death');
    expect(ev!.source).toBe('Soandso');
    expect(ev!.target).toBe('a gnoll');
  });
});

describe('logParser — healing', () => {
  it('parses heal received', () => {
    const ev = parse('Soandso has healed you for 350 points of damage.');
    expect(ev!.type).toBe('heal');
    expect(ev!.source).toBe('Soandso');
    expect(ev!.target).toBe('You');
    expect(ev!.amount).toBe(350);
  });

  it('parses heal done', () => {
    const ev = parse('You have healed Soandso for 100 points of damage.');
    expect(ev!.type).toBe('heal');
    expect(ev!.source).toBe('You');
    expect(ev!.target).toBe('Soandso');
    expect(ev!.amount).toBe(100);
  });
});

describe('logParser — casting', () => {
  it('parses own cast start', () => {
    const ev = parse('You begin casting Complete Healing.');
    expect(ev!.type).toBe('cast_start');
    expect(ev!.source).toBe('You');
    expect(ev!.skill).toBe('Complete Healing');
  });

  it('parses other cast start', () => {
    const ev = parse('Soandso begins to cast a spell.');
    expect(ev!.type).toBe('other_cast_start');
    expect(ev!.source).toBe('Soandso');
  });

  it('parses own interrupt', () => {
    const ev = parse('Your spell is interrupted.');
    expect(ev!.type).toBe('cast_interrupted');
    expect(ev!.source).toBe('You');
  });

  it('parses other interrupt', () => {
    const ev = parse("Soandso's casting is interrupted!");
    expect(ev!.type).toBe('cast_interrupted');
    expect(ev!.source).toBe('Soandso');
  });

  it('parses own fizzle', () => {
    const ev = parse('Your spell fizzles!');
    expect(ev!.type).toBe('cast_fizzle');
    expect(ev!.source).toBe('You');
  });

  it('parses other fizzle', () => {
    const ev = parse("Soandso's spell fizzles!");
    expect(ev!.type).toBe('cast_fizzle');
    expect(ev!.source).toBe('Soandso');
  });

  it('parses spell did not take hold (resist)', () => {
    const ev = parse('Your spell did not take hold.');
    expect(ev!.type).toBe('cast_resist');
  });

  it('parses concentration recovery', () => {
    const ev = parse('You regain your concentration and continue your casting.');
    expect(ev!.type).toBe('cast_recovered');
  });
});

describe('logParser — /who results', () => {
  it('parses standard /who line', () => {
    const ev = parse('[55 Wizard] Soandso (High Elf) <Uber Guild>');
    expect(ev!.type).toBe('who_result');
    expect(ev!.source).toBe('Soandso');
    expect(ev!.amount).toBe(55);
    expect(ev!.skill).toBe('Wizard');
  });

  it('parses /who with title (multi-word class)', () => {
    const ev = parse('[60 Grave Lord] Darkone (Dark Elf) <Evil Guild>');
    expect(ev!.type).toBe('who_result');
    expect(ev!.source).toBe('Darkone');
    expect(ev!.amount).toBe(60);
    expect(ev!.skill).toBe('Grave Lord');
  });

  it('parses anonymous /who', () => {
    const ev = parse('[ANONYMOUS] Hiddenone');
    expect(ev!.type).toBe('who_result');
    expect(ev!.source).toBe('Hiddenone');
    expect(ev!.skill).toBe('ANONYMOUS');
    expect(ev!.amount).toBe(0);
  });
});

describe('logParser — group tracking', () => {
  it('parses group join', () => {
    const ev = parse('Soandso has joined the group.');
    expect(ev!.type).toBe('group_join');
    expect(ev!.source).toBe('Soandso');
  });

  it('parses group leave', () => {
    const ev = parse('Soandso has left the group.');
    expect(ev!.type).toBe('group_leave');
    expect(ev!.source).toBe('Soandso');
  });

  it('parses group chat', () => {
    const ev = parse("Soandso tells the group, 'incoming!'");
    expect(ev!.type).toBe('group_chat');
    expect(ev!.source).toBe('Soandso');
  });
});

describe('logParser — zone change', () => {
  it('parses zone entry', () => {
    const ev = parse('You have entered East Commonlands.');
    expect(ev!.type).toBe('zone_change');
    expect(ev!.target).toBe('East Commonlands');
  });

  it('parses loading screen', () => {
    const ev = parse('LOADING, PLEASE WAIT...');
    expect(ev!.type).toBe('loading_screen');
  });
});

describe('logParser — charm', () => {
  it('parses charm break', () => {
    const ev = parse('Your charm spell has worn off.');
    expect(ev!.type).toBe('charm_break');
  });
});

describe('logParser — disciplines', () => {
  it('parses warrior aggressive discipline', () => {
    const ev = parse('Soandso assumes an aggressive posture.');
    expect(ev!.type).toBe('discipline');
    expect(ev!.source).toBe('Soandso');
    expect(ev!.skill).toBe('Warrior');
  });

  it('parses monk blinding speed', () => {
    const ev = parse('Soandso begins to move with blinding speed.');
    expect(ev!.type).toBe('discipline');
    expect(ev!.source).toBe('Soandso');
    expect(ev!.skill).toBe('Monk');
  });
});

describe('logParser — no match', () => {
  it('returns null for chat messages', () => {
    expect(parse('Soandso says, "Hello!"')).toBeNull();
  });

  it('returns null for empty message', () => {
    expect(parseLine('')).toBeNull();
  });

  it('returns null for line without timestamp', () => {
    expect(parseLine('No timestamp here')).toBeNull();
  });
});

describe('tryMatchLanding', () => {
  it('matches a spell landing suffix', () => {
    const suffixes = ["'s skin freezes.", ' staggers.'];
    const ev = tryMatchLanding("a gnoll staggers.", Date.now(), suffixes);
    expect(ev).toBeTruthy();
    expect(ev!.type).toBe('spell_land');
    expect(ev!.target).toBe('a gnoll');
    expect(ev!.skill).toBe(' staggers.');
  });

  it('returns null when no suffix matches', () => {
    const suffixes = [' staggers.'];
    expect(tryMatchLanding('a gnoll runs away.', Date.now(), suffixes)).toBeNull();
  });
});

describe('tryMatchCharmLanding', () => {
  it('matches a charm landing suffix', () => {
    const suffixes = [' blinks.', ' moans.'] as const;
    const ev = tryMatchCharmLanding('a gnoll blinks.', Date.now(), suffixes);
    expect(ev).toBeTruthy();
    expect(ev!.type).toBe('charm_land');
    expect(ev!.target).toBe('a gnoll');
  });
});

describe('extractCharacterName', () => {
  it('extracts name from log filename', () => {
    expect(extractCharacterName('eqlog_Soandso_pq.proj.txt')).toBe('Soandso');
  });

  it('returns Unknown for bad filename', () => {
    expect(extractCharacterName('random.txt')).toBe('Unknown');
  });
});
