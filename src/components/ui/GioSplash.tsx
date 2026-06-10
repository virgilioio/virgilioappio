import { useEffect, useRef, useState } from 'react'

interface GioSplashProps {
  /** When true, the splash should stay; when false, plays exit and unmounts. */
  show: boolean
  /** Minimum total visible time (ms) before exit can begin. */
  minDurationMs?: number
}

const G_PATH =
  'M 9.4375 -17.34375 C 10.90625 -17.34375 12.191406 -17.019531 13.296875 -16.375 C 14.410156 -15.726562 15.238281 -14.914062 15.78125 -13.9375 L 15.78125 -17.0625 L 18.640625 -17.0625 L 18.640625 0.375 C 18.640625 1.925781 18.304688 3.304688 17.640625 4.515625 C 16.984375 5.734375 16.035156 6.6875 14.796875 7.375 C 13.566406 8.0625 12.128906 8.40625 10.484375 8.40625 C 8.242188 8.40625 6.375 7.875 4.875 6.8125 C 3.382812 5.757812 2.503906 4.316406 2.234375 2.484375 L 5.046875 2.484375 C 5.359375 3.523438 6 4.359375 6.96875 4.984375 C 7.945312 5.617188 9.117188 5.9375 10.484375 5.9375 C 12.046875 5.9375 13.316406 5.445312 14.296875 4.46875 C 15.285156 3.5 15.78125 2.132812 15.78125 0.375 L 15.78125 -3.203125 C 15.21875 -2.210938 14.382812 -1.382812 13.28125 -0.71875 C 12.1875 -0.0507812 10.90625 0.28125 9.4375 0.28125 C 7.914062 0.28125 6.535156 -0.0859375 5.296875 -0.828125 C 4.066406 -1.578125 3.097656 -2.625 2.390625 -3.96875 C 1.691406 -5.320312 1.34375 -6.863281 1.34375 -8.59375 C 1.34375 -10.332031 1.691406 -11.859375 2.390625 -13.171875 C 3.097656 -14.492188 4.066406 -15.519531 5.296875 -16.25 C 6.535156 -16.976562 7.914062 -17.34375 9.4375 -17.34375 Z M 15.78125 -8.5625 C 15.78125 -9.84375 15.519531 -10.960938 15 -11.921875 C 14.476562 -12.878906 13.773438 -13.609375 12.890625 -14.109375 C 12.015625 -14.617188 11.046875 -14.875 9.984375 -14.875 C 8.929688 -14.875 7.96875 -14.625 7.09375 -14.125 C 6.226562 -13.632812 5.535156 -12.910156 5.015625 -11.953125 C 4.492188 -10.992188 4.234375 -9.875 4.234375 -8.59375 C 4.234375 -7.28125 4.492188 -6.140625 5.015625 -5.171875 C 5.535156 -4.210938 6.226562 -3.476562 7.09375 -2.96875 C 7.96875 -2.457031 8.929688 -2.203125 9.984375 -2.203125 C 11.046875 -2.203125 12.015625 -2.457031 12.890625 -2.96875 C 13.773438 -3.476562 14.476562 -4.210938 15 -5.171875 C 15.519531 -6.140625 15.78125 -7.269531 15.78125 -8.5625 Z M 15.78125 -8.5625'

const I_PATH =
  'M 3.859375 -19.828125 C 3.316406 -19.828125 2.859375 -20.015625 2.484375 -20.390625 C 2.117188 -20.765625 1.9375 -21.21875 1.9375 -21.75 C 1.9375 -22.289062 2.117188 -22.75 2.484375 -23.125 C 2.859375 -23.5 3.316406 -23.6875 3.859375 -23.6875 C 4.378906 -23.6875 4.820312 -23.5 5.1875 -23.125 C 5.550781 -22.75 5.734375 -22.289062 5.734375 -21.75 C 5.734375 -21.21875 5.550781 -20.765625 5.1875 -20.390625 C 4.820312 -20.015625 4.378906 -19.828125 3.859375 -19.828125 Z M 5.234375 -17.0625 L 5.234375 0 L 2.390625 0 L 2.390625 -17.0625 Z M 5.234375 -17.0625'

const O_PATH =
  'M 9.828125 0.28125 C 8.234375 0.28125 6.785156 -0.0820312 5.484375 -0.8125 C 4.191406 -1.539062 3.175781 -2.570312 2.4375 -3.90625 C 1.707031 -5.238281 1.34375 -6.789062 1.34375 -8.5625 C 1.34375 -10.300781 1.71875 -11.835938 2.46875 -13.171875 C 3.226562 -14.515625 4.257812 -15.546875 5.5625 -16.265625 C 6.875 -16.984375 8.335938 -17.34375 9.953125 -17.34375 C 11.578125 -17.34375 13.039062 -16.984375 14.34375 -16.265625 C 15.65625 -15.546875 16.6875 -14.519531 17.4375 -13.1875 C 18.195312 -11.863281 18.578125 -10.320312 18.578125 -8.5625 C 18.578125 -6.789062 18.1875 -5.238281 17.40625 -3.90625 C 16.632812 -2.570312 15.582031 -1.539062 14.25 -0.8125 C 12.925781 -0.0820312 11.453125 0.28125 9.828125 0.28125 Z M 9.828125 -2.203125 C 10.847656 -2.203125 11.800781 -2.441406 12.6875 -2.921875 C 13.582031 -3.398438 14.304688 -4.113281 14.859375 -5.0625 C 15.410156 -6.019531 15.6875 -7.1875 15.6875 -8.5625 C 15.6875 -9.925781 15.414062 -11.085938 14.875 -12.046875 C 14.332031 -13.003906 13.625 -13.710938 12.75 -14.171875 C 11.882812 -14.640625 10.941406 -14.875 9.921875 -14.875 C 8.890625 -14.875 7.941406 -14.640625 7.078125 -14.171875 C 6.222656 -13.710938 5.535156 -13.003906 5.015625 -12.046875 C 4.492188 -11.085938 4.234375 -9.925781 4.234375 -8.5625 C 4.234375 -7.164062 4.488281 -5.988281 5 -5.03125 C 5.507812 -4.082031 6.1875 -3.375 7.03125 -2.90625 C 7.882812 -2.4375 8.816406 -2.203125 9.828125 -2.203125 Z M 9.828125 -2.203125'

export function GioSplash({ show, minDurationMs = 800 }: GioSplashProps) {
  const mountedAtRef = useRef<number>(Date.now())
  const [mounted, setMounted] = useState(true)
  const [leaving, setLeaving] = useState(false)
  const [settled, setSettled] = useState(false)

  // Begin exit when allowed (show=false AND minDuration elapsed)
  useEffect(() => {
    if (show || leaving || !mounted) return
    const elapsed = Date.now() - mountedAtRef.current
    const remaining = Math.max(0, minDurationMs - elapsed)
    const id = setTimeout(() => setLeaving(true), remaining)
    return () => clearTimeout(id)
  }, [show, leaving, mounted, minDurationMs])

  // Unmount after exit animation
  useEffect(() => {
    if (!leaving) return
    const id = setTimeout(() => setMounted(false), 850)
    return () => clearTimeout(id)
  }, [leaving])

  // Once intro animation has settled, release will-change so the browser
  // re-rasterizes the resting logo at full resolution (no fuzzy edges).
  useEffect(() => {
    const id = setTimeout(() => setSettled(true), 1400)
    return () => clearTimeout(id)
  }, [])

  if (!mounted) return null

  return (
    <>
      <style>{splashCss}</style>
      <div
        className={`gio-splash play${leaving ? ' leaving' : ''}${settled ? ' settled' : ''}`}
        aria-hidden="true"
        role="presentation"
      >
        <div className="logo-holder">
          <svg
            viewBox="0 0 82 71.25"
            width="300"
            height="auto"
            shapeRendering="geometricPrecision"
            style={{ overflow: 'visible' }}
            aria-label="gio"
          >
            <circle
              className="part dot"
              cx="10.195"
              cy="37.191"
              r="9.895"
              fill="#0d0d09"
            />
            <rect
              className="part pill"
              x="6.863"
              y="47.578"
              width="13.23"
              height="8.832"
              rx="4.416"
              fill="#0d0d09"
            />
            <g transform="translate(24.531, 45.728)">
              <g className="part gl gl-g">
                <path fill="#0d0d09" d={G_PATH} />
              </g>
            </g>
            <g transform="translate(41.964, 45.728)">
              <g className="part gl gl-i">
                <path fill="#0d0d09" d={I_PATH} />
              </g>
            </g>
            <g transform="translate(46.602, 45.728)">
              <g className="part gl gl-o">
                <path fill="#0d0d09" d={O_PATH} />
              </g>
            </g>
          </svg>
        </div>
      </div>
    </>
  )
}


const splashCss = `
.gio-splash {
  position: fixed;
  inset: 0;
  background: #fffcf9;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  transform: translateZ(0);
  backface-visibility: hidden;
  --gio-ease-glide: cubic-bezier(.7, 0, .25, 1);
  --gio-ease-pop:   cubic-bezier(.3, 1.5, .5, 1);
  --gio-ease-bloom: cubic-bezier(.2, .9, .3, 1);
  --gio-dur-morph:  1050ms;
  --gio-dur-bloom:  450ms;
  --gio-dur-exit:   550ms;
}
/* SVG renders at 300px intrinsic, displayed at 150px → headroom for upscale
   during the dot's scale(1.55) peak. Keeps every animated frame downsampling
   from a higher-res raster instead of upscaling a cached bitmap. */
.gio-splash .logo-holder {
  transform: scale(0.5);
  transform-origin: center;
}
.gio-splash .part {
  transform-box: fill-box;
  transform-origin: center;
  opacity: 0;
  will-change: transform, opacity;
}
/* Release layer promotion after the intro so the resting logo re-rasterizes
   at full resolution (sharp edges, no compositor blur). */
.gio-splash.settled .part { will-change: auto; }

.gio-splash.play .dot  { animation: gio-dot 1.05s var(--gio-ease-glide) both; }
.gio-splash.play .pill { animation: gio-pill .4s var(--gio-ease-pop) both .78s; }
.gio-splash.play .gl   { animation: gio-letter .45s var(--gio-ease-bloom) both; }
.gio-splash.play .gl-g { animation-delay: .72s; }
.gio-splash.play .gl-i { animation-delay: .80s; }
.gio-splash.play .gl-o { animation-delay: .88s; }

@keyframes gio-dot {
  0%   { opacity: 0; transform: translate(26px, -5px) scale(.18); }
  18%  { opacity: 1; transform: translate(26px, -5px) scale(.22); }
  45%  { opacity: 1; transform: translate(26px, -5px) scale(1.55); }
  72%  { transform: translate(0, 0) scale(.92); }
  100% { opacity: 1; transform: none; }
}
@keyframes gio-pill   { 0% { opacity: 0; transform: translateY(-8px) scaleY(.4); } 100% { opacity: 1; transform: none; } }
@keyframes gio-letter { 0% { opacity: 0; transform: scale(.92); filter: blur(2px); } 100% { opacity: 1; transform: none; filter: blur(0); } }

.gio-splash.leaving              { animation: gio-overlay-out .55s cubic-bezier(.7, 0, .3, 1) both .25s; }
.gio-splash.leaving .logo-holder { animation: gio-logo-out    .55s cubic-bezier(.7, 0, .3, 1) both .25s; }
@keyframes gio-overlay-out { to { transform: translateY(-100%); } }
/* Base scale is 0.5; exit shrinks from there to 0.36 (same visual feel as 1 → .72). */
@keyframes gio-logo-out    { to { transform: translateY(28vh) scale(.36); opacity: 0; } }

@media (prefers-reduced-motion: reduce) {
  .gio-splash.play .part { opacity: 1 !important; animation: none !important; transform: none !important; filter: none !important; }
  .gio-splash.leaving,
  .gio-splash.leaving .logo-holder { animation: gio-fade-out .2s ease both !important; }
  @keyframes gio-fade-out { to { opacity: 0; } }
}
`

