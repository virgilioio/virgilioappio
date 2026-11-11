/**
 * The on-screen keyboard's size (2026-11-11, from Gio Sales' phone phase 4): iOS opens
 * the keyboard over the page without shrinking the layout, so the full-screen phone
 * composer's Send and its formatting strip would sit behind it. `--gio-kb` is how much
 * of the window's bottom the keyboard covers and `--gio-vv-top` how far iOS has scrolled
 * the visible area down; `.gio-composer-phone` reads them (src/index.css). Touch screens
 * only; both stay 0px on a computer.
 */
export function installKeyboardSafe(): () => void {
  if (typeof window === 'undefined') return () => {}
  const viewport = window.visualViewport
  if (!viewport || !matchMedia('(pointer: coarse)').matches) return () => {}
  const root = document.documentElement.style
  let frame = 0
  const measure = () => {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => {
      const covered = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
      // Small differences are browser chrome sliding, not a keyboard.
      const open = covered > 80
      root.setProperty('--gio-kb', `${open ? Math.round(covered) : 0}px`)
      root.setProperty('--gio-vv-top', `${open ? Math.round(viewport.offsetTop) : 0}px`)
    })
  }
  viewport.addEventListener('resize', measure)
  viewport.addEventListener('scroll', measure)
  measure()
  return () => {
    cancelAnimationFrame(frame)
    viewport.removeEventListener('resize', measure)
    viewport.removeEventListener('scroll', measure)
  }
}
