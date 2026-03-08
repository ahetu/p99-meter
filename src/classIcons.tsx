import React from 'react';
import type { EQClass } from './eqClasses';

const S = 20;

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg width={S} height={S} viewBox="0 0 20 20" style={{ display: 'block', flexShrink: 0 }}>
      {children}
    </svg>
  );
}

function WarriorIcon({ color }: { color: string }) {
  return (
    <Icon>
      <path d="M9,1 h2 v11 h3 v2 h-3 v4 h-2 v-4 h-3 v-2 h3z" fill={color} />
    </Icon>
  );
}

function RogueIcon({ color }: { color: string }) {
  return (
    <Icon>
      <path d="M10,1 L14.5,7 L10,9.5 L5.5,7 Z" fill={color} />
      <rect x="4.5" y="9.5" width="11" height="2" rx="1" fill={color} />
      <rect x="8" y="12" width="4" height="6" rx="1" fill={color} opacity="0.7" />
    </Icon>
  );
}

function MonkIcon({ color }: { color: string }) {
  return (
    <Icon>
      <rect x="5" y="7" width="11" height="9" rx="2.5" fill={color} />
      <rect x="6" y="3" width="3.5" height="6" rx="1.5" fill={color} />
      <rect x="10.5" y="3" width="3.5" height="6" rx="1.5" fill={color} />
    </Icon>
  );
}

function RangerIcon({ color }: { color: string }) {
  return (
    <Icon>
      <path d="M6,3 Q2,10 6,17" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <line x1="6" y1="3" x2="6" y2="17" stroke={color} strokeWidth="0.8" />
      <line x1="6" y1="10" x2="16" y2="10" stroke={color} strokeWidth="1.8" />
      <polygon points="14.5,7.5 18,10 14.5,12.5" fill={color} />
    </Icon>
  );
}

function PaladinIcon({ color }: { color: string }) {
  return (
    <Icon>
      <path d="M4,4 L10,2 L16,4 L16,11 L10,17 L4,11 Z" fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
      <rect x="8.5" y="5" width="3" height="9" rx="0.5" fill={color} />
      <rect x="6" y="8" width="8" height="3" rx="0.5" fill={color} />
    </Icon>
  );
}

function ShadowKnightIcon({ color }: { color: string }) {
  return (
    <Icon>
      <ellipse cx="10" cy="8" rx="6" ry="5.5" fill={color} />
      <ellipse cx="7.5" cy="7.5" rx="1.8" ry="2" fill="rgba(0,0,0,0.65)" />
      <ellipse cx="12.5" cy="7.5" rx="1.8" ry="2" fill="rgba(0,0,0,0.65)" />
      <path d="M7,14 L8.5,12.5 L10,14 L11.5,12.5 L13,14" fill="none" stroke={color} strokeWidth="1.2" />
    </Icon>
  );
}

function BardIcon({ color }: { color: string }) {
  return (
    <Icon>
      <circle cx="7" cy="14.5" r="3" fill={color} />
      <rect x="9.5" y="3" width="2" height="12.5" fill={color} />
      <path d="M11.5,3 Q16,2 16.5,5.5 Q16,7.5 11.5,6.5" fill={color} />
    </Icon>
  );
}

function ClericIcon({ color }: { color: string }) {
  return (
    <Icon>
      <rect x="7.5" y="2" width="5" height="16" rx="1" fill={color} />
      <rect x="3" y="6.5" width="14" height="5" rx="1" fill={color} />
    </Icon>
  );
}

function DruidIcon({ color }: { color: string }) {
  return (
    <Icon>
      <path d="M10,2 Q16,6 15,12 Q13,10 10,18 Q7,10 5,12 Q4,6 10,2 Z" fill={color} />
    </Icon>
  );
}

function ShamanIcon({ color }: { color: string }) {
  return (
    <Icon>
      <ellipse cx="10" cy="9" rx="6" ry="7" fill={color} opacity="0.85" />
      <rect x="6" y="6.5" width="3" height="3" rx="0.5" fill="rgba(0,0,0,0.6)" />
      <rect x="11" y="6.5" width="3" height="3" rx="0.5" fill="rgba(0,0,0,0.6)" />
      <rect x="8" y="12" width="4" height="2" rx="0.5" fill="rgba(0,0,0,0.5)" />
    </Icon>
  );
}

function WizardIcon({ color }: { color: string }) {
  return (
    <Icon>
      <path d="M12,1 L6,9 L9.5,9 L7,19 L15,10 L11,10 Z" fill={color} />
    </Icon>
  );
}

function MagicianIcon({ color }: { color: string }) {
  return (
    <Icon>
      <path d="M10,2 Q14,6 14,11 Q14,17 10,17 Q6,17 6,11 Q6,8 8,6 Q8.5,8 10,7 Q11.5,6 10,2 Z" fill={color} />
    </Icon>
  );
}

function NecromancerIcon({ color }: { color: string }) {
  return (
    <Icon>
      <rect x="9" y="3" width="2" height="16" rx="0.5" fill={color} />
      <path d="M3,3 Q3,9 9,9" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M3,3 L6,1" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Icon>
  );
}

function EnchanterIcon({ color }: { color: string }) {
  return (
    <Icon>
      <path d="M10,3 Q4,2 3,7 Q2,11 5,15 Q7,18 10,17 Q13,18 15,15 Q18,11 17,7 Q16,2 10,3 Z" fill={color} />
      <line x1="10" y1="3" x2="10" y2="17" stroke="rgba(0,0,0,0.4)" strokeWidth="1.2" />
      <path d="M4,8 Q7,9.5 10,8 Q13,6.5 16,8" fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="1" />
      <path d="M4.5,12 Q7,13.5 10,12 Q13,10.5 15.5,12" fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="1" />
    </Icon>
  );
}

function UnknownIcon({ color }: { color: string }) {
  return (
    <Icon>
      <text
        x="10" y="15.5"
        textAnchor="middle"
        fontSize="15"
        fontWeight="bold"
        fontFamily="Arial, sans-serif"
        fill={color}
        stroke="none"
        opacity="0.7"
      >?</text>
    </Icon>
  );
}

function NpcIcon({ color }: { color: string }) {
  return (
    <Icon>
      <ellipse cx="10" cy="10.5" rx="5.5" ry="5" fill={color} opacity="0.75" />
      <line x1="5" y1="9" x2="3" y2="3" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="15" y1="9" x2="17" y2="3" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="8" cy="10" rx="1.3" ry="1.5" fill="rgba(0,0,0,0.6)" />
      <ellipse cx="12" cy="10" rx="1.3" ry="1.5" fill="rgba(0,0,0,0.6)" />
    </Icon>
  );
}

const ICON_MAP: Record<EQClass, React.FC<{ color: string }>> = {
  'Warrior': WarriorIcon,
  'Rogue': RogueIcon,
  'Monk': MonkIcon,
  'Ranger': RangerIcon,
  'Paladin': PaladinIcon,
  'Shadow Knight': ShadowKnightIcon,
  'Bard': BardIcon,
  'Cleric': ClericIcon,
  'Druid': DruidIcon,
  'Shaman': ShamanIcon,
  'Wizard': WizardIcon,
  'Magician': MagicianIcon,
  'Necromancer': NecromancerIcon,
  'Enchanter': EnchanterIcon,
};

export function ClassIcon({ eqClass, color, isNpc }: { eqClass: EQClass | null; color: string; isNpc?: boolean }) {
  if (eqClass && ICON_MAP[eqClass]) {
    const Comp = ICON_MAP[eqClass];
    return <Comp color={color} />;
  }
  if (isNpc) return <NpcIcon color={color} />;
  return <UnknownIcon color={color} />;
}
