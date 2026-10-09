import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "@/lib/utils"

/**
 * Motion & Feel §2 (CLAUDE.md): every tooltip opens after 400ms, and once one is
 * open its neighbours open instantly for 400ms. The timing is fixed here so the
 * nested providers around the app can't drift from it; their delay props are ignored.
 */
const TOOLTIP_DELAY = 400

const TooltipProvider = ({
  children,
  disableHoverableContent,
}: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Provider>) => (
  <TooltipPrimitive.Provider
    delayDuration={TOOLTIP_DELAY}
    skipDelayDuration={TOOLTIP_DELAY}
    disableHoverableContent={disableHoverableContent}
  >
    {children}
  </TooltipPrimitive.Provider>
)

const Tooltip = TooltipPrimitive.Root

const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      "z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md gio-tip",
      className
    )}
    {...props}
  />
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

/**
 * IconTip — the tooltip every icon-only control gets (its text matches the control's
 * aria-label). Never pair it with a native `title`.
 */
function IconTip({
  label,
  side = "bottom",
  children,
}: {
  label: React.ReactNode
  side?: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>["side"]
  children: React.ReactElement
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, IconTip }
