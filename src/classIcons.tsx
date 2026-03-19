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
      <path d="M10,0.5 L11.3,2 L11,10.5 L9,10.5 L8.7,2 Z" fill={color} />
      <line x1="10" y1="1.5" x2="10" y2="10" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
      <path d="M4,10.5 Q5,10 6,10.5 L14,10.5 Q15,10 16,10.5 L16,12.5 Q15,13 14,12.5 L6,12.5 Q5,13 4,12.5 Z" fill={color} />
      <rect x="8.8" y="12.5" width="2.4" height="4" rx="0.4" fill={color} opacity="0.85" />
      <line x1="8.8" y1="13.5" x2="11.2" y2="13.5" stroke="rgba(0,0,0,0.2)" strokeWidth="0.4" />
      <line x1="8.8" y1="14.8" x2="11.2" y2="14.8" stroke="rgba(0,0,0,0.2)" strokeWidth="0.4" />
      <circle cx="10" cy="17.8" r="1.3" fill={color} opacity="0.75" />
    </Icon>
  );
}

function RogueIcon({ color }: { color: string }) {
  return (
    <Icon>
      <g transform="rotate(-45, 10, 10)">
        <path d="M10,0.5 Q12.5,5 12,10 L8,10 Q7.5,5 10,0.5 Z" fill={color} />
        <line x1="10" y1="2" x2="10" y2="9.5" stroke="rgba(255,255,255,0.15)" strokeWidth="0.6" />
        <path d="M5.5,10 L7.2,9.2 L8,10.2 L12,10.2 L12.8,9.2 L14.5,10 L12.8,10.8 L12,10.5 L8,10.5 L7.2,10.8 Z" fill={color} />
        <rect x="8.8" y="10.5" width="2.4" height="5.5" rx="0.5" fill={color} opacity="0.85" />
        <line x1="8.8" y1="11.7" x2="11.2" y2="11.7" stroke="rgba(0,0,0,0.25)" strokeWidth="0.5" />
        <line x1="8.8" y1="13" x2="11.2" y2="13" stroke="rgba(0,0,0,0.25)" strokeWidth="0.5" />
        <line x1="8.8" y1="14.3" x2="11.2" y2="14.3" stroke="rgba(0,0,0,0.25)" strokeWidth="0.5" />
        <ellipse cx="10" cy="17" rx="1.8" ry="1.2" fill={color} opacity="0.75" />
      </g>
    </Icon>
  );
}

function MonkIcon({ color }: { color: string }) {
  return (
    <Icon>
      <rect x="5" y="7" width="12" height="9" rx="2.5" fill={color} />
      <rect x="6" y="3" width="3.5" height="6" rx="1.5" fill={color} />
      <rect x="10.5" y="3" width="3.5" height="6" rx="1.5" fill={color} />
      <line x1="9.8" y1="3.5" x2="9.8" y2="8" stroke="rgba(0,0,0,0.3)" strokeWidth="0.6" />
      <path d="M6.5,4 Q7.8,2.8 9.2,4" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
      <path d="M11,4 Q12.3,2.8 13.6,4" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
      <ellipse cx="4.5" cy="11.5" rx="1.8" ry="2.8" fill={color} />
      <path d="M4.5,8.7 Q3,9.5 3,11.5 Q3,13.5 4.5,14.3" fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="0.5" />
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
      <g transform="rotate(-25, 10, 10)">
        <path d="M10,1 C14,3.5 14.5,7.5 13.5,11 C12,15 10.3,17 10,17.5 C9.7,17 8,15 6.5,11 C5.5,7.5 6,3.5 10,1 Z" fill={color} />
        <path d="M10,2 Q10.2,10 10,17" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="0.8" />
        <path d="M10,5.5 Q12.5,4 13.5,3" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="0.5" />
        <path d="M10,5.5 Q7.5,4 6.5,3" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="0.5" />
        <path d="M10,9 Q12.5,7.5 14,7" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="0.5" />
        <path d="M10,9 Q7.5,7.5 6,7" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="0.5" />
        <path d="M10,12.5 Q11.5,11.5 12.5,11" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="0.5" />
        <path d="M10,12.5 Q8.5,11.5 7.5,11" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="0.5" />
        <line x1="10" y1="17.5" x2="10" y2="19.5" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
      </g>
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
      <path d="M10,1 Q14,5 14,10 Q14,17 10,18 Q6,17 6,10 Q6,7 8,5 Q8.5,7 10,6 Q11.5,5 10,1 Z" fill={color} />
      <path d="M10,3 Q12,6 12,10" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.6" />
      <path d="M8.5,8 Q9,10 10,11 Q11,10 11,8" fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="0.5" />
      <circle cx="10" cy="14" r="1.2" fill="rgba(255,255,255,0.1)" />
    </Icon>
  );
}

function NecromancerIcon({ color }: { color: string }) {
  return (
    <Icon>
      <line x1="14" y1="19" x2="8" y2="3" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="11" y1="15.5" x2="14" y2="15.5" stroke="rgba(0,0,0,0.2)" strokeWidth="0.5" />
      <line x1="11.5" y1="12.5" x2="14.5" y2="12.5" stroke="rgba(0,0,0,0.2)" strokeWidth="0.5" />
      <path d="M8,3 Q3,1.5 2,5 Q1.5,8 7,10" fill={color} />
      <path d="M8,3 Q3,1.5 2,5" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
      <line x1="2" y1="5" x2="1" y2="3" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
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
