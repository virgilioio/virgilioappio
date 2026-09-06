import * as React from 'react'

/**
 * The one "Gio is working" motion in the product.
 * Shared by the Suggested tab match banner and the Profile summary card.
 */
export const gioSweepCss = `
@keyframes sugSweep { from { transform: translateX(-100%) } to { transform: translateX(250%) } }
.sug-sweep, .gio-sweep { animation: sugSweep 1.6s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .sug-sweep, .gio-sweep { animation: none !important; }
}
`

/** 4px indeterminate purple sweep on a lilac track. */
export function GioSweepBar({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={className}
      role="progressbar"
      aria-label="Gio is working"
      style={{
        height: 4,
        borderRadius: 999,
        background: '#EDE4FF',
        overflow: 'hidden',
        marginBottom: 14,
        ...style,
      }}
    >
      <style>{gioSweepCss}</style>
      <span
        className="gio-sweep"
        style={{
          display: 'block',
          height: '100%',
          width: '40%',
          borderRadius: 999,
          background: '#6F3FF5',
        }}
      />
    </div>
  )
}

export default GioSweepBar
