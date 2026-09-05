import * as React from 'react'
import { Sparkles } from 'lucide-react'
import { suggestedRowStyle } from './suggestedGrid'

const inter = "'Inter', system-ui, sans-serif"
const poppins = "'Poppins', system-ui, sans-serif"

/** Shared shimmer primitive — two greys, one motion. */
function Shim({
  w,
  h,
  r = 4,
  style,
}: {
  w: number | string
  h: number
  r?: number
  style?: React.CSSProperties
}) {
  return (
    <span
      className="sug-shim"
      style={{ display: 'block', width: w, height: h, borderRadius: r, ...style }}
    />
  )
}

const shimCss = `
@keyframes sugShimmer { from { background-position: 100% 50% } to { background-position: -100% 50% } }
@keyframes sugPulse { 0%,100% { opacity: 1 } 50% { opacity: .45 } }
@keyframes sugSweep { from { transform: translateX(-100%) } to { transform: translateX(250%) } }
.sug-shim {
  background: linear-gradient(90deg,#F1F0EC 0%,#FAFAF7 50%,#F1F0EC 100%);
  background-size: 200% 100%;
  animation: sugShimmer 1.4s ease-in-out infinite;
}
.sug-pulse { animation: sugPulse 1.4s ease-in-out infinite; }
.sug-sweep { animation: sugSweep 1.6s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .sug-shim, .sug-pulse, .sug-sweep { animation: none !important; }
}
`

/** Progress banner + seven skeleton rows on the shared grid. */
export function SuggestedSkeleton({ criteria }: { criteria?: string | null }) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #E7E8EE',
        borderRadius: 12,
        overflow: 'hidden',
      }}
      aria-busy
    >
      <style>{shimCss}</style>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          background: 'linear-gradient(90deg,#FAF8FF,#fff 70%)',
          borderBottom: '1px solid #E7E8EE',
        }}
      >
        <span
          className="sug-pulse"
          style={{
            width: 26,
            height: 26,
            borderRadius: 8,
            background: '#6F3FF5',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Sparkles size={13} strokeWidth={2} color="#fffcf9" />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: poppins, fontSize: 13, fontWeight: 600, color: '#0d0d09' }}>
            Matching your database against this job…
          </div>
          {criteria && (
            <div
              style={{
                fontFamily: inter,
                fontSize: 11.5,
                color: '#5A6072',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {criteria}
            </div>
          )}
        </div>
        <span
          style={{
            width: 120,
            height: 4,
            borderRadius: 999,
            background: '#F1F0EC',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          <span
            className="sug-sweep"
            style={{ display: 'block', width: '40%', height: '100%', background: '#6F3FF5' }}
          />
        </span>
      </div>

      {Array.from({ length: 7 }).map((_, i) => (
        <div
          key={i}
          style={{
            ...suggestedRowStyle,
            opacity: 1 - i * 0.085,
            borderBottom: i === 6 ? 'none' : '1px solid #F1F0EC',
          }}
        >
          <Shim w={14} h={14} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <Shim w={34} h={34} r={999} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <Shim w="72%" h={11} />
              <Shim w="88%" h={9} style={{ marginTop: 5 }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <Shim w={86} h={18} r={6} />
            <Shim w={62} h={18} r={6} />
            <Shim w={44} h={18} r={6} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
            <Shim w={22} h={13} />
            <Shim w={44} h={3} r={999} />
          </div>
          <div>
            <Shim w="80%" h={10} />
            <Shim w={52} h={8} style={{ marginTop: 4 }} />
          </div>
          <Shim w={44} h={10} />
          <div>
            <Shim w="86%" h={10} />
            <Shim w="58%" h={8} style={{ marginTop: 4 }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
            <Shim w={54} h={26} r={8} />
            <Shim w={26} h={26} r={8} />
          </div>
        </div>
      ))}
    </div>
  )
}

export default SuggestedSkeleton
