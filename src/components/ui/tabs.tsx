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
 *
 * Pill, as in the reference demo: the layer is the fill plus a copy of every label
 * in its active look (inert, aria-hidden), so the colour and weight change travel
 * with the clip. The real tabs underneath all keep their resting colour and weight
 * (read from a resting tab into --tab-idle-*), so no tab changes width or colour
 * ahead of the layer.
 */
// Keyboard-driven changes never animate (CLAUDE.md §2 / checklist); remember how the
// user last interacted so an arrow-key tab change jumps instead of sliding.
let lastInput: "pointer" | "key" = "pointer"
if (typeof window !== "undefined") {
  window.addEventListener("keydown", () => { lastInput = "key" }, true)
  window.addEventListener("pointerdown", () => { lastInput = "pointer" }, true)
}

function ownTabs(list: HTMLElement) {
  return Array.from(list.querySelectorAll<HTMLElement>('[role="tab"]')).filter(
    (t) => t.closest('[role="tablist"]') === list
  )
}

/** Copies every tab into the pill layer, each in its active look. */
function buildClones(list: HTMLElement, layer: HTMLElement | null) {
  if (!layer) return
  layer.setAttribute("inert", "")
  layer.replaceChildren(
    ...ownTabs(list).map((tab) => {
      const copy = tab.cloneNode(true) as HTMLElement
      for (const node of [copy, ...Array.from(copy.querySelectorAll<HTMLElement>("[id]"))]) node.removeAttribute("id")
      for (const name of ["role", "aria-selected", "aria-controls", "data-radix-collection-item", "data-orientation"]) {
        copy.removeAttribute(name)
      }
      copy.setAttribute("data-state", "active")
      copy.tabIndex = -1
      copy.classList.add("gio-tab-clone")
      return copy
    })
  )
  // A tab that draws its own active fill (a white chip, say) gives that fill to the
  // layer, so one fill slides instead of a row of chips; otherwise the lilac pill.
  const probe = layer.firstElementChild as HTMLElement | null
  if (!probe) return
  probe.classList.remove("gio-tab-clone")
  const fill = getComputedStyle(probe).backgroundColor
  probe.classList.add("gio-tab-clone")
  const clear = !fill || fill === "transparent" || /^rgba\(.*,\s*0\)$/.test(fill)
  if (clear) list.style.removeProperty("--tab-fill")
  else list.style.setProperty("--tab-fill", fill)
}

/** Lays each copy exactly over its tab and records the tabs' resting look. */
function placeClones(layer: HTMLElement, tabs: HTMLElement[], active: HTMLElement) {
  const copies = Array.from(layer.children) as HTMLElement[]
  tabs.forEach((tab, i) => {
    const copy = copies[i]
    if (!copy) return
    copy.style.left = `${tab.offsetLeft}px`
    copy.style.top = `${tab.offsetTop}px`
    copy.style.width = `${tab.offsetWidth}px`
    copy.style.height = `${tab.offsetHeight}px`
  })
  const list = layer.parentElement
  const resting = tabs.find((t) => t !== active && !t.matches(":hover") && !t.hasAttribute("disabled"))
  if (!list) return
  if (resting) {
    const cs = getComputedStyle(resting)
    list.style.setProperty("--tab-idle-color", cs.color)
    list.style.setProperty("--tab-idle-weight", cs.fontWeight)
    list.style.setProperty("--tab-idle-border", cs.borderColor)
    list.setAttribute("data-tab-idle", "")
  } else if (tabs.length < 2) {
    list.removeAttribute("data-tab-idle")
  }
}

function useTabIndicator(listRef: React.RefObject<HTMLElement>, indicator: Indicator) {
  React.useLayoutEffect(() => {
    const list = listRef.current
    if (!list || indicator === "none") return
    let ready = false
    let frame = 0
    let slidingUntil = 0
    const measure = (animate: boolean, changed = animate) => {
      const tabs = ownTabs(list)
      const active = tabs.find((t) => t.dataset.state === "active")
      if (!active) {
        list.removeAttribute("data-indicator-ready")
        list.removeAttribute("data-tab-idle")
        return
      }
      const el = list.querySelector<HTMLElement>(":scope > .gio-tab-indicator")
      // A resize during a slide (the new tab turning semibold) retargets it, never cuts it.
      const slide = ready && (animate || performance.now() < slidingUntil)
      if (animate && ready) slidingUntil = performance.now() + 300
      // A jump: no transition for this change, restored on the next frame.
      if (el && !slide) el.style.transition = "none"
      // §10: a tab bar too wide for its space scrolls sideways (with a 28px fade on the
      // right edge until you reach the end); coordinates are in its scrolled content.
      const overflowing = list.scrollWidth > list.clientWidth + 1
      list.toggleAttribute("data-overflow", overflowing)
      const lb = list.getBoundingClientRect()
      const ab = active.getBoundingClientRect()
      const x = ab.left - lb.left - list.clientLeft + list.scrollLeft
      const y = ab.top - lb.top - list.clientTop
      const contentWidth = overflowing ? list.scrollWidth : list.clientWidth
      list.style.setProperty("--tab-x", `${x}px`)
      list.style.setProperty("--tab-y", `${y}px`)
      list.style.setProperty("--tab-w", `${ab.width}`)
      list.style.setProperty("--tab-h", `${ab.height}`)
      list.style.setProperty("--tab-scroll-w", `${contentWidth}px`)
      list.style.setProperty("--tab-right", `${contentWidth - x - ab.width}px`)
      // A new tab (by pointer or keyboard) scrolls fully into view, clear of the fade.
      if (overflowing && changed) {
        const left = active.offsetLeft
        const right = left + active.offsetWidth + 28
        if (left < list.scrollLeft) list.scrollLeft = left
        else if (right > list.scrollLeft + list.clientWidth) list.scrollLeft = right - list.clientWidth
      }
      list.toggleAttribute("data-scroll-end", list.scrollLeft + list.clientWidth >= list.scrollWidth - 1)
      list.style.setProperty("--tab-bottom", `${list.clientHeight - y - ab.height}px`)
      list.style.setProperty("--tab-radius", getComputedStyle(active).borderRadius)
      if (el && indicator === "pill") placeClones(el, tabs, active)
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
    const indicatorEl = () => list.querySelector<HTMLElement>(":scope > .gio-tab-indicator")
    if (indicator === "pill") buildClones(list, indicatorEl())
    measure(false)
    const resize = new ResizeObserver(() => measure(false))
    resize.observe(list)
    const onScroll = () => list.toggleAttribute("data-scroll-end", list.scrollLeft + list.clientWidth >= list.scrollWidth - 1)
    list.addEventListener("scroll", onScroll, { passive: true })
    list.querySelectorAll('[role="tab"]').forEach((t) => resize.observe(t))
    const mutation = new MutationObserver((all) => {
      // The label copies live inside the indicator; their own changes are ours.
      const layer = indicatorEl()
      const records = all.filter((r) => !layer || !layer.contains(r.target))
      if (!records.length) return
      const tabChanged = records.some((r) => r.type === "attributes" && r.attributeName === "data-state")
      if (records.some((r) => r.type === "childList")) {
        list.querySelectorAll('[role="tab"]').forEach((t) => resize.observe(t))
      }
      if (indicator === "pill" && records.some((r) => r.type === "childList" || r.type === "characterData")) {
        buildClones(list, layer)
      }
      measure(tabChanged && lastInput === "pointer", tabChanged)
    })
    mutation.observe(list, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["data-state"] })
    document.fonts?.ready.then(() => measure(false))
    return () => {
      resize.disconnect()
      list.removeEventListener("scroll", onScroll)
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
        "inline-flex h-auto max-w-full items-center justify-center rounded-xl p-1.5 text-text-secondary shadow-[var(--shadow-xs)] border border-virgilio-border/20",
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
      "inline-flex items-center justify-center whitespace-nowrap rounded-lg border-y border-transparent px-4 py-2.5 text-sm font-poppins font-medium tracking-tight transition-colors duration-hover",
      "disabled:pointer-events-none disabled:opacity-50",
      "text-virgilio-muted hover:text-virgilio-text",
      // The lilac fill and the active label are drawn by TabsList's moving layer
      // (pill), never by each tab; the underline keeps the active label on the tab.
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
