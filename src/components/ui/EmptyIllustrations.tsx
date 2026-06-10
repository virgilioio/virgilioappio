/**
 * Gio Empty State Illustrations — Build Spec §5
 * Render area 176×140, viewBox 0 0 190 150. Pure SVG, zero deps.
 */
import * as React from 'react'

const Blob = ({ fill }: { fill: string }) => (
  <path
    d="M95 16 C134 12 173 34 175 74 C177 110 147 136 104 136 C64 136 19 125 17 82 C15 42 56 20 95 16 Z"
    fill={fill}
  />
)

const SSvg = ({ children }: { children: React.ReactNode }) => (
  <svg
    width={176}
    height={140}
    viewBox="0 0 190 150"
    fill="none"
    style={{ display: 'block' }}
    aria-hidden
  >
    {children}
  </svg>
)

const Spark = ({ x, y, s = 6.5, c = '#6F3FF5' }: { x: number; y: number; s?: number; c?: string }) => {
  const k = s * 0.34
  return (
    <path
      d={`M${x} ${y - s} C ${x + k} ${y - k} ${x + k} ${y - k} ${x + s} ${y} C ${x + k} ${y + k} ${x + k} ${y + k} ${x} ${y + s} C ${x - k} ${y + k} ${x - k} ${y + k} ${x - s} ${y} C ${x - k} ${y - k} ${x - k} ${y - k} ${x} ${y - s} Z`}
      fill={c}
    />
  )
}

// 1 · Candidates
export const SoftPlane = () => (
  <SSvg>
    <Blob fill="#F0E9FF" />
    <path d="M50 116 Q66 78 98 92 Q130 106 124 66" stroke="#C4B0F5" strokeWidth="3" strokeLinecap="round" strokeDasharray="0.5 9" fill="none" />
    <ellipse cx="120" cy="78" rx="20" ry="5" fill="#000" opacity="0.05" />
    <g transform="rotate(-18 120 58)">
      <path d="M100 56 L146 44 L124 74 Z" fill="#8B6FE8" />
      <path d="M100 56 L124 74 L116 60 Z" fill="#6F3FF5" />
      <path d="M146 44 L116 60" stroke="#fff" strokeOpacity="0.5" strokeWidth="2" strokeLinecap="round" />
    </g>
    <circle cx="58" cy="50" r="3.5" fill="#D7C5FB" />
    <Spark x={142} y={96} s={7} />
  </SSvg>
)

// 2 · Jobs
export const SoftFlag = () => (
  <SSvg>
    <Blob fill="#E0F0D6" />
    <ellipse cx="95" cy="116" rx="26" ry="6" fill="#000" opacity="0.05" />
    <path d="M95 116 V52" stroke="#9A8FA8" strokeWidth="6" strokeLinecap="round" />
    <circle cx="95" cy="50" r="5" fill="#9A8FA8" />
    <path d="M98 52 Q116 56 132 50 Q120 64 132 78 Q116 72 98 78 Z" fill="#6F3FF5" />
    <circle cx="120" cy="40" r="3.5" fill="#BBE3A9" />
    <circle cx="70" cy="62" r="3" fill="#46B86A" opacity="0.7" />
    <Spark x={126} y={92} s={6.5} />
  </SSvg>
)

// 3 · Scorecards
export const SoftRosette = () => (
  <SSvg>
    <Blob fill="#F0E9FF" />
    <path d="M84 92 L80 116 L95 106 L110 116 L106 92 Z" fill="#B79BF0" />
    <ellipse cx="95" cy="100" rx="22" ry="5" fill="#000" opacity="0.04" />
    <circle cx="95" cy="66" r="30" fill="#D7C5FB" />
    <circle cx="95" cy="66" r="20" fill="#fff" />
    <path d="M95 54 l3.2 6.5 7.2 1 -5.2 5.1 1.2 7.2 -6.4 -3.4 -6.4 3.4 1.2 -7.2 -5.2 -5.1 7.2 -1 Z" fill="#6F3FF5" />
    <Spark x={128} y={98} s={6.5} />
  </SSvg>
)

// 4 · Search / filtered
export const SoftMagnifier = () => (
  <SSvg>
    <Blob fill="#DFF3F7" />
    <path d="M50 110 Q72 74 102 90 Q126 102 122 70" stroke="#9BD9E6" strokeWidth="3" strokeLinecap="round" strokeDasharray="0.5 9" fill="none" />
    <ellipse cx="120" cy="86" rx="18" ry="5" fill="#000" opacity="0.05" />
    <path d="M129 71 L142 84" stroke="#5FB6C8" strokeWidth="7" strokeLinecap="round" />
    <circle cx="118" cy="58" r="18" fill="#fff" stroke="#5FB6C8" strokeWidth="4.5" />
    <path d="M110 56 a8 8 0 0 1 8 -7" stroke="#9BD9E6" strokeWidth="3" strokeLinecap="round" fill="none" />
    <circle cx="58" cy="52" r="3.5" fill="#9BD9E6" />
    <Spark x={140} y={100} s={6.5} c="#5FB6C8" />
  </SSvg>
)

// 5 · All caught up
export const SoftCaughtUp = () => (
  <SSvg>
    <Blob fill="#E0F0D6" />
    <ellipse cx="92" cy="108" rx="30" ry="6" fill="#000" opacity="0.05" />
    <rect x="62" y="56" width="64" height="46" rx="9" fill="#D7C5FB" />
    <path d="M62 64 L94 86 L126 64" stroke="#fff" strokeOpacity="0.7" strokeWidth="3" fill="none" strokeLinejoin="round" />
    <path d="M62 65 L62 60 a4 4 0 0 1 4 -4 h56 a4 4 0 0 1 4 4 L94 86 Z" fill="#B79BF0" />
    <circle cx="126" cy="56" r="13" fill="#46B86A" />
    <path d="M120 56 l4 4 l8 -9" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <Spark x={62} y={62} s={6.5} />
  </SSvg>
)

// 6 · Notes / comments
export const SoftBubble = () => (
  <SSvg>
    <Blob fill="#F0E9FF" />
    <path d="M58 118 q14 -4 22 -12" stroke="#C4B0F5" strokeWidth="3" strokeLinecap="round" strokeDasharray="0.5 9" fill="none" />
    <ellipse cx="100" cy="104" rx="30" ry="6" fill="#000" opacity="0.04" />
    <path d="M74 48 h44 a16 16 0 0 1 16 16 v20 a16 16 0 0 1 -16 16 H96 l-14 14 v-14 h-8 a16 16 0 0 1 -16 -16 V64 a16 16 0 0 1 16 -16 Z" fill="#D7C5FB" />
    <path d="M95 62 v22 M84 73 h22" stroke="#6F3FF5" strokeWidth="5" strokeLinecap="round" />
    <circle cx="128" cy="44" r="3.5" fill="#B79BF0" />
    <Spark x={64} y={66} s={6.5} />
  </SSvg>
)

// 7 · Analytics
export const SoftChart = () => (
  <SSvg>
    <Blob fill="#F0E9FF" />
    <ellipse cx="95" cy="115" rx="40" ry="5" fill="#000" opacity="0.04" />
    <path d="M62 112 H128" stroke="#C9C2D8" strokeWidth="3" strokeLinecap="round" />
    <rect x="66" y="86" width="14" height="24" rx="5" fill="#D7C5FB" />
    <rect x="88" y="68" width="14" height="42" rx="5" fill="#9BD9E6" />
    <rect x="110" y="54" width="14" height="56" rx="5" fill="#BBE3A9" />
    <circle cx="117" cy="48" r="3.5" fill="#46B86A" />
    <Spark x={134} y={62} s={6.5} />
  </SSvg>
)

// 8 · People / orgs
export const SoftPeople = () => (
  <SSvg>
    <Blob fill="#DFF3F7" />
    <ellipse cx="95" cy="114" rx="38" ry="5" fill="#000" opacity="0.05" />
    <g>
      <circle cx="71" cy="72" r="12" fill="#9BD9E6" />
      <path d="M55 101 a16 15 0 0 1 32 0 Z" fill="#9BD9E6" />
    </g>
    <g>
      <circle cx="119" cy="72" r="12" fill="#BBE3A9" />
      <path d="M103 101 a16 15 0 0 1 32 0 Z" fill="#BBE3A9" />
    </g>
    <g>
      <circle cx="95" cy="64" r="16" fill="#B79BF0" />
      <path d="M74 102 a21 18 0 0 1 42 0 Z" fill="#B79BF0" />
    </g>
    <Spark x={133} y={54} s={6.5} />
  </SSvg>
)

// 9 · Archived
export const SoftArchive = () => (
  <SSvg>
    <Blob fill="#F0E9FF" />
    <ellipse cx="95" cy="113" rx="32" ry="5" fill="#000" opacity="0.05" />
    <rect x="64" y="66" width="62" height="46" rx="8" fill="#D7C5FB" />
    <rect x="58" y="52" width="74" height="20" rx="8" fill="#B79BF0" />
    <path d="M86 62 h18" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeOpacity="0.85" />
    <Spark x={126} y={92} s={6.5} />
  </SSvg>
)

// 10 · Deals
export const SoftDeal = () => (
  <SSvg>
    <Blob fill="#E0F0D6" />
    <ellipse cx="92" cy="112" rx="30" ry="5" fill="#000" opacity="0.05" />
    <path d="M70 50 h34 l16 16 v42 a4 4 0 0 1 -4 4 H70 a4 4 0 0 1 -4 -4 V54 a4 4 0 0 1 4 -4 Z" fill="#fff" stroke="#D7C5FB" strokeWidth="3" strokeLinejoin="round" />
    <path d="M104 50 v16 h16" fill="none" stroke="#D7C5FB" strokeWidth="3" strokeLinejoin="round" />
    <path d="M76 74 h24 M76 84 h32" stroke="#E2DAF0" strokeWidth="3" strokeLinecap="round" />
    <circle cx="112" cy="94" r="14" fill="#46B86A" />
    <path d="M112 87 v14 M108 90 h6 a2.6 2.6 0 0 1 0 5 h-5 a2.6 2.6 0 0 0 0 5 h6" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <Spark x={62} y={60} s={6} />
  </SSvg>
)

// 11 · Scheduling / activity
export const SoftCalendar = () => (
  <SSvg>
    <Blob fill="#DFF3F7" />
    <ellipse cx="95" cy="114" rx="32" ry="5" fill="#000" opacity="0.05" />
    <rect x="60" y="56" width="70" height="58" rx="11" fill="#fff" stroke="#9BD9E6" strokeWidth="3.5" />
    <path d="M60 71 H130" stroke="#9BD9E6" strokeWidth="3.5" />
    <path d="M76 50 v12 M114 50 v12" stroke="#5FB6C8" strokeWidth="5" strokeLinecap="round" />
    <rect x="84" y="82" width="22" height="20" rx="6" fill="#6F3FF5" />
    <circle cx="73" cy="92" r="2.6" fill="#C4B0F5" />
    <circle cx="117" cy="92" r="2.6" fill="#C4B0F5" />
    <Spark x={128} y={54} s={6} />
  </SSvg>
)

// 12 · Documents / attachments
export const SoftPaper = () => (
  <SSvg>
    <Blob fill="#F0E9FF" />
    <ellipse cx="95" cy="114" rx="30" ry="5" fill="#000" opacity="0.05" />
    <path d="M74 48 h30 l18 18 v44 a5 5 0 0 1 -5 5 H74 a5 5 0 0 1 -5 -5 V53 a5 5 0 0 1 5 -5 Z" fill="#fff" stroke="#D7C5FB" strokeWidth="3.2" strokeLinejoin="round" />
    <path d="M104 48 v18 h18" fill="none" stroke="#D7C5FB" strokeWidth="3.2" strokeLinejoin="round" />
    <path d="M80 80 h28 M80 92 h32 M80 104 h20" stroke="#C9B8F0" strokeWidth="3.2" strokeLinecap="round" />
    <Spark x={126} y={62} s={6} />
  </SSvg>
)

// 13 · Organizations
export const SoftBuilding = () => (
  <SSvg>
    <Blob fill="#F0E9FF" />
    <ellipse cx="95" cy="114" rx="38" ry="5" fill="#000" opacity="0.05" />
    <rect x="56" y="70" width="28" height="42" rx="5" fill="#9BD9E6" />
    <rect x="63" y="80" width="7" height="7" rx="2" fill="#fff" />
    <rect x="63" y="94" width="7" height="7" rx="2" fill="#fff" />
    <rect x="82" y="46" width="44" height="66" rx="6" fill="#D7C5FB" />
    <g fill="#fff">
      <rect x="90" y="56" width="9" height="9" rx="2" />
      <rect x="109" y="56" width="9" height="9" rx="2" />
      <rect x="90" y="72" width="9" height="9" rx="2" />
      <rect x="109" y="72" width="9" height="9" rx="2" />
      <rect x="90" y="88" width="9" height="9" rx="2" />
      <rect x="109" y="88" width="9" height="9" rx="2" />
    </g>
    <rect x="98" y="100" width="12" height="12" rx="3" fill="#B79BF0" />
    <Spark x={132} y={56} s={6.5} />
  </SSvg>
)

// 14 · Find — AI search hero
export const SoftFind = () => (
  <SSvg>
    <defs>
      <radialGradient id="gioOrb" cx="40%" cy="34%" r="72%">
        <stop offset="0" stopColor="#9B7BF5" />
        <stop offset="1" stopColor="#6A39E8" />
      </radialGradient>
    </defs>
    <Blob fill="#F0E9FF" />
    <ellipse cx="95" cy="72" rx="56" ry="34" stroke="#C4B0F5" strokeWidth="2.4" strokeDasharray="0.5 8" fill="none" transform="rotate(-12 95 72)" />
    <circle cx="42" cy="56" r="5.5" fill="#9BD9E6" />
    <circle cx="146" cy="58" r="6.5" fill="#BBE3A9" />
    <circle cx="140" cy="100" r="4.5" fill="#D7C5FB" />
    <circle cx="95" cy="70" r="28" fill="url(#gioOrb)" />
    <Spark x={95} y={70} s={14} c="#fff" />
    <circle cx="116" cy="89" r="7.5" fill="#fff" />
    <circle cx="116" cy="89" r="5" fill="#46B86A" />
  </SSvg>
)
