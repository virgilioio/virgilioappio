import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

type Indicator = "pill" | "underline" | "none"

/**
 * Motion & Feel §2 Tabs (CLAUDE.md): one active layer moves between tabs at
 * --dur-tabs on --ease-in-out; tabs never crossfade one by one. The list measures
 * its active trigger and writes its box into CSS variables; `.gio-tab-indicator`
 * (src/index.css) follows with clip-path (pill) or translate + scaleX (underline).
 * The first measurement and resizes jump; only a change of tab animates.
 */
// Keyboard-driven changes never animate (CLAUDE.md §2 / checklist); remember how the
// user last interacted so an arrow-key tab change jumps instead of sliding.
let lastInput: "pointer" | "key" = "pointer"
if (typeof window !== "undefined") {
  window.addEventListener("keydown", () => { lastInput = "key" }, true)
  window.addEventListener("pointerdown", () => { lastInput = "pointer" }, true)
}

function useTabIndicator(listRef: React.RefObject<HTMLElement>, indicator: Indicator) {
  React.useLayoutEffect(() => {
    const list = listRef.current
    if (!list || indicator === "none") return
    let ready = false
    let frame = 0
    let slidingUntil = 0
    const measure = (animate: boolean) => {
      const tabs = Array.from(list.querySelectorAll<HTMLElement>('[role="tab"]')).filter(
        (t) => t.closest('[role="tablist"]') === list
      )
      const active = tabs.find((t) => t.dataset.state === "active")
      if (!active) {
        list.removeAttribute("data-indicator-ready")
        return
      }
      const el = list.querySelector<HTMLElement>(":scope > .gio-tab-indicator")
      // A resize during a slide (the new tab turning semibold) retargets it, never cuts it.
      const slide = ready && (animate || performance.now() < slidingUntil)
      if (animate && ready) slidingUntil = performance.now() + 300
      // A jump: no transition for this change, restored on the next frame.
      if (el && !slide) el.style.transition = "none"
      const lb = list.getBoundingClientRect()
      const ab = active.getBoundingClientRect()
      const x = ab.left - lb.left - list.clientLeft
      const y = ab.top - lb.top - list.clientTop
      list.style.setProperty("--tab-x", `${x}px`)
      list.style.setProperty("--tab-y", `${y}px`)
      list.style.setProperty("--tab-w", `${ab.width}`)
      list.style.setProperty("--tab-h", `${ab.height}`)
      list.style.setProperty("--tab-right", `${list.clientWidth - x - ab.width}px`)
      list.style.setProperty("--tab-bottom", `${list.clientHeight - y - ab.height}px`)
      list.style.setProperty("--tab-radius", getComputedStyle(active).borderRadius)
      list.setAttribute("data-indicator-ready", "")
      ready = true
      if (el && !slide) {
        void el.offsetWidth // apply the jump before the transition comes back
        cancelAnimationFrame(frame)
        frame = requestAnimationFrame(() => {
          el.style.transition = ""
        })
      }
    }
    measure(false)
    const resize = new ResizeObserver(() => measure(false))
    resize.observe(list)
    list.querySelectorAll('[role="tab"]').forEach((t) => resize.observe(t))
    const mutation = new MutationObserver((records) => {
      const tabChanged = records.some((r) => r.type === "attributes" && r.attributeName === "data-state")
      if (records.some((r) => r.type === "childList")) {
        list.querySelectorAll('[role="tab"]').forEach((t) => resize.observe(t))
      }
      measure(tabChanged && lastInput === "pointer")
    })
    mutation.observe(list, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-state"] })
    document.fonts?.ready.then(() => measure(false))
    return () => {
      resize.disconnect()
      mutation.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [listRef, indicator])
}

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & {
    /** How the active tab is marked: a sliding lilac pill (default), a sliding 2px underline, or nothing. */
    indicator?: Indicator
  }
>(({ className, children, indicator = "pill", ...props }, ref) => {
  const listRef = React.useRef<HTMLDivElement>(null)
  React.useImperativeHandle(ref, () => listRef.current as HTMLDivElement)
  useTabIndicator(listRef, indicator)
  return (
    <TabsPrimitive.List
      ref={listRef}
      data-indicator={indicator}
      className={cn(
        "inline-flex h-auto items-center justify-center rounded-xl p-1.5 text-text-secondary shadow-[var(--shadow-xs)] border border-virgilio-border/20",
        "bg-[#fffcf9] dark:bg-surface-secondary/50",
        "gio-tablist",
        className
      )}
      {...props}
    >
      {children}
      {indicator !== "none" && <span aria-hidden="true" className="gio-tab-indicator" />}
    </TabsPrimitive.List>
  )
})
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-lg border border-transparent px-4 py-2.5 text-sm font-poppins font-medium tracking-tight ring-offset-background transition-colors duration-hover",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-virgilio-purple focus-visible:ring-offset-2",
      "disabled:pointer-events-none disabled:opacity-50",
      "text-virgilio-muted hover:bg-virgilio-purple/5 hover:text-virgilio-text",
      // The lilac fill is drawn by TabsList's moving indicator, not by each tab.
      "data-[state=active]:text-[#0d0d09] data-[state=active]:font-semibold",
      "min-h-[40px] md:min-h-0",
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
