import * as React from "react"
import * as HoverCardPrimitive from "@radix-ui/react-hover-card"

import { cn } from "@/lib/utils"

/**
 * Motion & Feel §10 Hover cards (CLAUDE.md): open after --delay-hovercard (500ms) and
 * grow from the trigger (scale 0.97 + opacity, --dur-hovercard); once one has been open,
 * the next opens at once with no animation; close after a --grace-hovercard (150ms)
 * grace so the pointer can travel into the card. Mouse only — Radix never opens a hover
 * card from touch, so a tap follows the link.
 */
const OPEN_DELAY = 500
const CLOSE_GRACE = 150
let lastClosedAt = 0
let openCount = 0

function HoverCard({ openDelay, closeDelay, onOpenChange, ...props }: React.ComponentPropsWithoutRef<typeof HoverCardPrimitive.Root>) {
  const [instant, setInstant] = React.useState(false)
  const isOpen = React.useRef(false)
  const neighbour = () => openCount > 0 || performance.now() - lastClosedAt < 400
  // A trigger that unmounts while its card is open (clicking the link) still closes it
  // for the "neighbours open instantly" bookkeeping.
  React.useEffect(
    () => () => {
      if (isOpen.current) {
        isOpen.current = false
        openCount = Math.max(0, openCount - 1)
        lastClosedAt = performance.now()
      }
    },
    []
  )
  return (
    <HoverCardContext.Provider value={instant}>
      <HoverCardPrimitive.Root
        openDelay={openDelay ?? OPEN_DELAY}
        closeDelay={closeDelay ?? CLOSE_GRACE}
        onOpenChange={(open) => {
          if (open && !isOpen.current) {
            setInstant(neighbour())
            openCount++
            isOpen.current = true
          } else if (!open && isOpen.current) {
            openCount = Math.max(0, openCount - 1)
            lastClosedAt = performance.now()
            isOpen.current = false
          }
          onOpenChange?.(open)
        }}
        {...props}
      />
    </HoverCardContext.Provider>
  )
}
const HoverCardContext = React.createContext(false)

const HoverCardTrigger = HoverCardPrimitive.Trigger

const HoverCardContent = React.forwardRef<
  React.ElementRef<typeof HoverCardPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof HoverCardPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => {
  const instant = React.useContext(HoverCardContext)
  // Portalled, so a card opened from inline text never inherits its paragraph's styles.
  return (
    <HoverCardPrimitive.Portal>
      <HoverCardPrimitive.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        data-instant={instant || undefined}
        className={cn(
          "z-50 w-64 rounded-md bg-popover p-4 text-popover-foreground shadow-pop outline-none gio-hovercard",
          className
        )}
        {...props}
      />
    </HoverCardPrimitive.Portal>
  )
})
HoverCardContent.displayName = HoverCardPrimitive.Content.displayName

export { HoverCard, HoverCardTrigger, HoverCardContent }
