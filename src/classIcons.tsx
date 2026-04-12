import React from 'react';
import type { EQClass } from './eqClasses';
import {
  Sword, Scissors, HandFist, Target, ShieldPlus, Swords,
  Music, Cross, Leaf, Sparkles, Zap, Flame, Skull, Eye,
  CircleHelp, Bug,
} from 'lucide-react';

const S = 18;

const ICON_MAP: Record<EQClass, React.FC<{ size: number; color: string; strokeWidth: number }>> = {
  'Warrior': Sword,
  'Rogue': Scissors,
  'Monk': HandFist,
  'Ranger': Target,
  'Paladin': ShieldPlus,
  'Shadow Knight': Swords,
  'Bard': Music,
  'Cleric': Cross,
  'Druid': Leaf,
  'Shaman': Sparkles,
  'Wizard': Zap,
  'Magician': Flame,
  'Necromancer': Skull,
  'Enchanter': Eye,
};

export function ClassIcon({ eqClass, color, isNpc }: { eqClass: EQClass | null; color: string; isNpc?: boolean }) {
  if (eqClass && ICON_MAP[eqClass]) {
    const Comp = ICON_MAP[eqClass];
    return <Comp size={S} color={color} strokeWidth={2} />;
  }
  if (isNpc) return <Bug size={S} color={color} strokeWidth={2} />;
  return <CircleHelp size={S} color={color} strokeWidth={2} />;
}
