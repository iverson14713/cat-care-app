import type { ReactNode } from 'react';

const C = {
  stroke: '#C2410C',
  strokeSoft: '#EA580C',
  fillCream: '#FFF7ED',
  fillPeach: '#FFEDD5',
  fillOrange: '#FDBA74',
  fillAccent: '#FB923C',
  fillWhite: '#FFFFFF',
} as const;

function IllustrationFrame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div
      className="mx-auto mb-6 flex aspect-[5/4] w-full max-w-[220px] items-center justify-center rounded-2xl bg-gradient-to-b from-orange-50/90 to-amber-50/40 ring-1 ring-orange-100/60"
      aria-hidden
    >
      <svg viewBox="0 0 200 160" className="h-full w-full p-3" role="img" aria-label={label}>
        {children}
      </svg>
    </div>
  );
}

/** Slide 1: dog & cat sitting inside a heart outline */
export function IllustrationWelcome() {
  return (
    <IllustrationFrame label="Welcome pets">
      <path
        d="M100 28 C72 28 52 52 52 78 C52 108 100 138 100 138 C100 138 148 108 148 78 C148 52 128 28 100 28 Z"
        fill={C.fillPeach}
        stroke={C.strokeSoft}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <ellipse cx="78" cy="88" rx="22" ry="20" fill={C.fillCream} stroke={C.stroke} strokeWidth="2" />
      <path d="M66 72 L62 58 L72 66 M90 72 L94 58 L84 66" fill="none" stroke={C.stroke} strokeWidth="2" strokeLinecap="round" />
      <circle cx="72" cy="86" r="2" fill={C.stroke} />
      <circle cx="84" cy="86" r="2" fill={C.stroke} />
      <path d="M74 94 Q78 98 82 94" fill="none" stroke={C.stroke} strokeWidth="1.5" strokeLinecap="round" />
      <ellipse cx="122" cy="90" rx="24" ry="21" fill={C.fillOrange} stroke={C.stroke} strokeWidth="2" />
      <ellipse cx="122" cy="78" rx="14" ry="12" fill={C.fillOrange} stroke={C.stroke} strokeWidth="2" />
      <path d="M108 74 L104 60 L114 68 M136 74 L140 60 L130 68" fill="none" stroke={C.stroke} strokeWidth="2" strokeLinecap="round" />
      <circle cx="116" cy="88" r="2" fill={C.stroke} />
      <circle cx="128" cy="88" r="2" fill={C.stroke} />
      <path d="M118 96 Q122 100 126 96" fill="none" stroke={C.stroke} strokeWidth="1.5" strokeLinecap="round" />
    </IllustrationFrame>
  );
}

/** Slide 2: checklist + food + water + heart */
export function IllustrationDailyCare() {
  return (
    <IllustrationFrame label="Daily care">
      <rect x="28" y="36" width="52" height="68" rx="8" fill={C.fillWhite} stroke={C.stroke} strokeWidth="2" />
      <rect x="44" y="30" width="20" height="12" rx="4" fill={C.fillPeach} stroke={C.stroke} strokeWidth="2" />
      <path d="M40 58 H68 M40 70 H64 M40 82 H60" stroke={C.strokeSoft} strokeWidth="2" strokeLinecap="round" />
      <path d="M40 58 L44 62 L52 52" fill="none" stroke={C.fillAccent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <ellipse cx="108" cy="108" rx="32" ry="10" fill={C.fillPeach} stroke={C.stroke} strokeWidth="2" />
      <path d="M76 108 Q108 88 140 108" fill={C.fillCream} stroke={C.stroke} strokeWidth="2" strokeLinejoin="round" />
      <ellipse cx="108" cy="98" rx="18" ry="6" fill={C.fillAccent} opacity="0.5" />
      <path
        d="M158 52 C158 52 148 68 148 78 C148 88 158 94 158 94 C158 94 168 88 168 78 C168 68 158 52 158 52 Z"
        fill={C.fillCream}
        stroke={C.stroke}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M172 108 C168 104 160 104 158 110 C156 104 148 104 144 108 C140 114 158 124 158 124 C158 124 176 114 172 108 Z"
        fill={C.fillAccent}
        stroke={C.stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </IllustrationFrame>
  );
}

/** Slide 3: AI card + weight trend + summary */
export function IllustrationAiAssistant() {
  return (
    <IllustrationFrame label="AI care assistant">
      <rect x="24" y="32" width="96" height="96" rx="14" fill={C.fillWhite} stroke={C.stroke} strokeWidth="2" />
      <circle cx="44" cy="52" r="10" fill={C.fillPeach} stroke={C.stroke} strokeWidth="1.5" />
      <path d="M40 52 H48 M44 48 V56" stroke={C.stroke} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M58 48 H98 M58 58 H88 M58 68 H78" stroke={C.strokeSoft} strokeWidth="2" strokeLinecap="round" opacity="0.7" />
      <rect x="36" y="78" width="72" height="8" rx="4" fill={C.fillPeach} />
      <rect x="36" y="92" width="56" height="8" rx="4" fill={C.fillCream} stroke={C.strokeSoft} strokeWidth="1" />
      <path d="M118 40 L120 46 L126 48 L120 50 L118 56 L116 50 L110 48 L116 46 Z" fill={C.fillAccent} />
      <path d="M132 68 L133 71 L136 72 L133 73 L132 76 L131 73 L128 72 L131 71 Z" fill={C.fillOrange} />
      <rect x="128" y="44" width="56" height="52" rx="10" fill={C.fillCream} stroke={C.stroke} strokeWidth="2" />
      <path
        d="M138 82 L148 70 L158 74 L168 58"
        fill="none"
        stroke={C.stroke}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="168" cy="58" r="3" fill={C.fillAccent} stroke={C.stroke} strokeWidth="1" />
      <rect x="128" y="108" width="56" height="28" rx="8" fill={C.fillWhite} stroke={C.stroke} strokeWidth="2" />
      <path d="M136 120 H176 M136 128 H164" stroke={C.strokeSoft} strokeWidth="2" strokeLinecap="round" />
    </IllustrationFrame>
  );
}

/** Slide 4: family shared care around a pet */
export function IllustrationSharedCare() {
  return (
    <IllustrationFrame label="Shared care">
      <circle cx="100" cy="82" r="44" fill={C.fillPeach} opacity="0.35" />
      <ellipse cx="100" cy="92" rx="26" ry="22" fill={C.fillOrange} stroke={C.stroke} strokeWidth="2" />
      <ellipse cx="100" cy="78" rx="16" ry="14" fill={C.fillOrange} stroke={C.stroke} strokeWidth="2" />
      <path d="M88 72 L84 60 L94 66 M112 72 L116 60 L106 66" fill="none" stroke={C.stroke} strokeWidth="2" strokeLinecap="round" />
      <circle cx="94" cy="90" r="2" fill={C.stroke} />
      <circle cx="106" cy="90" r="2" fill={C.stroke} />
      {[
        { x: 100, y: 28 },
        { x: 44, y: 72 },
        { x: 156, y: 72 },
      ].map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="14" fill={C.fillCream} stroke={C.stroke} strokeWidth="2" />
          <path
            d={`M${p.x - 10} ${p.y + 22} Q${p.x} ${p.y + 14} ${p.x + 10} ${p.y + 22}`}
            fill={C.fillWhite}
            stroke={C.stroke}
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </g>
      ))}
      <path
        d="M100 42 Q72 56 58 72 M100 42 Q128 56 142 72 M58 72 Q78 118 100 114 Q122 118 142 72"
        fill="none"
        stroke={C.strokeSoft}
        strokeWidth="1.5"
        strokeDasharray="4 4"
        opacity="0.5"
      />
    </IllustrationFrame>
  );
}

/** Slide 5: happy dog and cat */
export function IllustrationGetStarted() {
  return (
    <IllustrationFrame label="Get started">
      <path d="M48 48 L52 36 L56 48" fill={C.fillAccent} opacity="0.6" />
      <path d="M148 44 L152 32 L156 44" fill={C.fillAccent} opacity="0.6" />
      <circle cx="164" cy="56" r="3" fill={C.fillOrange} />
      <circle cx="36" cy="64" r="2" fill={C.fillOrange} />
      <ellipse cx="72" cy="98" rx="28" ry="24" fill={C.fillCream} stroke={C.stroke} strokeWidth="2" />
      <path d="M54 78 L48 58 L62 70 M90 78 L96 58 L82 70" fill="none" stroke={C.stroke} strokeWidth="2" strokeLinecap="round" />
      <path d="M58 88 C60 90 62 90 64 88 M80 88 C82 90 84 90 86 88" fill="none" stroke={C.stroke} strokeWidth="2" strokeLinecap="round" />
      <path d="M66 108 Q72 116 78 108" fill="none" stroke={C.stroke} strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="132" cy="100" rx="30" ry="26" fill={C.fillOrange} stroke={C.stroke} strokeWidth="2" />
      <ellipse cx="132" cy="82" rx="18" ry="15" fill={C.fillOrange} stroke={C.stroke} strokeWidth="2" />
      <path d="M112 76 L106 56 L120 66 M152 76 L158 56 L144 66" fill="none" stroke={C.stroke} strokeWidth="2" strokeLinecap="round" />
      <path d="M120 94 Q124 98 128 94 M136 94 Q140 98 144 94" fill="none" stroke={C.stroke} strokeWidth="2" strokeLinecap="round" />
      <path d="M124 112 Q132 122 140 112" fill="none" stroke={C.stroke} strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="100" cy="132" rx="70" ry="8" fill={C.fillPeach} opacity="0.6" />
    </IllustrationFrame>
  );
}

export const ONBOARDING_ILLUSTRATIONS = [
  IllustrationWelcome,
  IllustrationDailyCare,
  IllustrationAiAssistant,
  IllustrationSharedCare,
  IllustrationGetStarted,
] as const;
