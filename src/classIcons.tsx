import React from 'react';
import type { EQClass } from './eqClasses';
import {
  Sword, Scissors, Target, ShieldPlus, Swords,
  Music, Cross, Leaf, Sparkles, Zap, Flame, Skull, Eye,
  CircleHelp, Bug,
} from 'lucide-react';

const S = 18;

function PunchingFist({ size, color, strokeWidth }: { size: number; color: string; strokeWidth: number }) {
  const sw = strokeWidth * 0.85;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      {/* Fist outline — raised fist rotated to punch angle */}
      <path d="M7 21 L7 17 Q6 15 6 13 L6 11 Q6 9.5 7.5 9 L8 9 L8 5.5 Q8 4 9.5 4 L10.5 4 Q11.5 4 11.5 5 L11.5 5.5 Q11.5 4 13 4 L13.5 4 Q14.5 4 14.5 5.5 L14.5 6 Q14.5 4.5 16 4.5 Q17 4.5 17 6 L17 8.5 Q18.5 9 18.5 11 L18.5 13 Q18.5 16 16 18 L15 21" />
      {/* Finger separations */}
      <line x1="11.5" y1="4.5" x2="11.5" y2="9" />
      <line x1="14.5" y1="4.5" x2="14.5" y2="9" />
      {/* Thumb */}
      <path d="M8 9 L8 12.5 Q8 14 9.5 14" />
    </svg>
  );
}

const ICON_MAP: Record<EQClass, React.FC<{ size: number; color: string; strokeWidth: number }>> = {
  'Warrior': Sword,
  'Rogue': Scissors,
  'Monk': PunchingFist,
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
