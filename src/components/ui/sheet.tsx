import * as SheetPrimitive from "@radix-ui/react-dialog"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"
import * as React from "react"

import { cn } from "@/lib/utils"

const Sheet = SheetPrimitive.Root

const SheetTrigger = SheetPrimitive.Trigger

const SheetClose = SheetPrimitive.Close

const SheetPortal = SheetPrimitive.Portal

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {
  showOverlay?: boolean
}

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-black/80 gio-dialog-overlay",
      className
    )}
    {...props}
    ref={ref}
  />
))
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName

const sheetVariants = cva(
  "fixed z-50 gap-4 bg-background p-6 shadow-lg gio-drawer",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b",
        bottom:
          "inset-x-0 bottom-0 border-t",
        left: "inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm",
        right:
          "inset-y-0 right-0 h-full w-3/4  border-l sm:max-w-sm",
      },
    },
    defaultVariants: {
      side: "right",
    },
  }
)

/**
 * §9 Swipe-to-dismiss (touch only): drag a sheet toward its edge to close it. It
 * follows the finger (the independent `translate` property, so it composes with the
 * open animation); side sheets only. Past 60px or on a flick faster than 0.11px/ms it closes, otherwise
 * it settles back over --dur-swipe-settle on --ease-drawer. Dragging the other way
 * meets growing resistance (−√d·2). Inputs, horizontally scrollable areas and
 * [data-no-swipe] don't start a swipe.
 */
function useSheetSwipe(side: SheetSide, close: () => void) {
  const attached = React.useRef(new WeakSet<HTMLElement>())
  return React.useCallback(
    (node: HTMLElement | null) => {
      if (!node || (side !== "left" && side !== "right") || attached.current.has(node)) return
      attached.current.add(node)
      // Vertical scrolling stays native; horizontal moves reach us as pointer events.
      node.style.touchAction = "pan-y"
      const axis: "x" | "y" = "x"
      const sign = side === "left" ? -1 : 1
      let start: { x: number; y: number } | null = null
      let locked: boolean | null = null
      let last = { d: 0, t: 0 }
      let prev = { d: 0, t: 0 }
      const blocked = (target: EventTarget | null) => {
        for (let n = target as HTMLElement | null; n && n !== node; n = n.parentElement) {
          if (n.matches("input, textarea, select, [contenteditable='true'], [data-no-swipe]")) return true
          if (axis === "x" && n.scrollWidth > n.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(n).overflowX)) return true
        }
        return false
      }
      const onDown = (e: PointerEvent) => {
        if (e.pointerType !== "touch" || blocked(e.target)) return
        start = { x: e.clientX, y: e.clientY }
        locked = null
        last = prev = { d: 0, t: e.timeStamp }
      }
      const onMove = (e: PointerEvent) => {
        if (!start) return
        const dx = e.clientX - start.x
        const dy = e.clientY - start.y
        const along = (axis === "x" ? dx : dy) * sign
        const across = axis === "x" ? dy : dx
        if (locked === null) {
          if (Math.abs(along) < 8 && Math.abs(across) < 8) return
          locked = Math.abs(along) > Math.abs(across) && along > 0
          if (!locked) {
            start = null
            return
          }
          node.setPointerCapture(e.pointerId)
          node.style.transition = "none"
        }
        const d = along > 0 ? along : -Math.sqrt(-along) * 2
        prev = last
        last = { d, t: e.timeStamp }
        node.style.translate = axis === "x" ? `${d * sign}px 0` : `0 ${d}px`
      }
      const onUp = () => {
        if (!start || !locked) {
          start = null
          return
        }
        start = null
        const velocity = (last.d - prev.d) / Math.max(1, last.t - prev.t)
        node.style.transition = "translate var(--dur-swipe-settle, 300ms) var(--ease-drawer)"
        if (last.d > 60 || velocity > 0.11) {
          close()
          // The close animation carries on from where the finger left it.
          window.setTimeout(() => {
            node.style.translate = ""
            node.style.transition = ""
          }, 400)
        } else {
          node.style.translate = ""
        }
      }
      node.addEventListener("pointerdown", onDown)
      node.addEventListener("pointermove", onMove)
      node.addEventListener("pointerup", onUp)
      node.addEventListener("pointercancel", onUp)
    },
    [side, close]
  )
}

type SheetSide = "top" | "bottom" | "left" | "right"

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({ side = "right", className, children, showOverlay = true, ...props }, ref) => {
  const closeRef = React.useRef<HTMLButtonElement>(null)
  const close = React.useCallback(() => closeRef.current?.click(), [])
  const swipe = useSheetSwipe((side ?? "right") as SheetSide, close)
  return (
  <SheetPortal>
    {showOverlay && <SheetOverlay />}
    <SheetPrimitive.Content
      ref={(node) => {
        if (typeof ref === "function") ref(node)
        else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node
        swipe(node)
      }}
      data-side={side ?? "right"}
      className={cn(sheetVariants({ side }), className)}
      {...props}
    >
      {children}
      <SheetPrimitive.Close ref={closeRef} className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </SheetPrimitive.Close>
    </SheetPrimitive.Content>
  </SheetPortal>
  )
})
SheetContent.displayName = SheetPrimitive.Content.displayName

const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-2 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
SheetHeader.displayName = "SheetHeader"

const SheetFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
SheetFooter.displayName = "SheetFooter"

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold text-foreground", className)}
    {...props}
  />
))
SheetTitle.displayName = SheetPrimitive.Title.displayName

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
SheetDescription.displayName = SheetPrimitive.Description.displayName

export {
  Sheet, SheetClose,
  SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetOverlay, SheetPortal, SheetTitle, SheetTrigger
}

