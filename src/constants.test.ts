import { describe, it, expect } from 'vitest';
import { isLikelyNPC, normalizeSource, normalizeTarget, TIMESTAMP_RE } from './constants';

describe('isLikelyNPC', () => {
  it('identifies lowercase-starting names as NPCs', () => {
    expect(isLikelyNPC('a gnoll')).toBe(true);
    expect(isLikelyNPC('an orc centurion')).toBe(true);
    expect(isLikelyNPC('a fire beetle')).toBe(true);
  });

  it('identifies names with spaces as NPCs (named NPCs)', () => {
    expect(isLikelyNPC('Guard Blayle')).toBe(true);
    expect(isLikelyNPC('Lord Nagafen')).toBe(true);
    expect(isLikelyNPC('Lady Vox')).toBe(true);
  });

  it('identifies single uppercase names as players', () => {
    expect(isLikelyNPC('Soandso')).toBe(false);
    expect(isLikelyNPC('Floophy')).toBe(false);
    expect(isLikelyNPC('Xyzzy')).toBe(false);
  });

  it('treats empty string as NPC', () => {
    expect(isLikelyNPC('')).toBe(true);
  });
});

describe('normalizeSource', () => {
  it('replaces "You" with player name', () => {
    expect(normalizeSource('You', 'Mychar')).toBe('Mychar');
  });

  it('passes through other names unchanged', () => {
    expect(normalizeSource('Soandso', 'Mychar')).toBe('Soandso');
    expect(normalizeSource('a gnoll', 'Mychar')).toBe('a gnoll');
  });
});

describe('normalizeTarget', () => {
  it('replaces "You" with player name', () => {
    expect(normalizeTarget('You', 'Mychar')).toBe('Mychar');
  });

  it('passes through other names unchanged', () => {
    expect(normalizeTarget('a gnoll', 'Mychar')).toBe('a gnoll');
  });
});

describe('TIMESTAMP_RE', () => {
  it('matches EQ log timestamps', () => {
    const line = '[Mon Mar 03 21:30:00 2025] You hit a gnoll for 42 points of damage.';
    const m = TIMESTAMP_RE.exec(line);
    expect(m).toBeTruthy();
    expect(m![1]).toBe('Mon Mar 03 21:30:00 2025');
    expect(m![2]).toBe('You hit a gnoll for 42 points of damage.');
  });

  it('does not match lines without brackets', () => {
    expect(TIMESTAMP_RE.exec('No timestamp here')).toBeNull();
  });

  it('does not have global flag (safe for repeated exec calls)', () => {
    expect(TIMESTAMP_RE.global).toBe(false);
  });
});
