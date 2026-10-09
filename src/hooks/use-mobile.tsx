import * as React from "react"

/**
 * The app shell switches to its phone layout (bottom nav, no left rail) below
 * Tailwind's `sm` (640px). Anything inside the app that asks "is this a phone?"
 * uses the same line, so a 700px window never mixes the desktop shell with
 * phone-only parts.
 *
 * Public pages with their own `md:` layout (the booking page) pass 768.
 */
export const SHELL_BREAKPOINT = 640

export function useIsMobile(breakpoint: number = SHELL_BREAKPOINT) {
  // Read the screen on the first render: starting at `false` made phones briefly (or,
  // for one-time choices like the job page's default view, permanently) take the
  // desktop path.
  const [isMobile, setIsMobile] = React.useState<boolean>(
    () => typeof window !== "undefined" && window.innerWidth < breakpoint
  )

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < breakpoint)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < breakpoint)
    return () => mql.removeEventListener("change", onChange)
  }, [breakpoint])

  return isMobile
}
