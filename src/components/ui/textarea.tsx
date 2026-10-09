import * as React from "react"

import { cn } from "@/lib/utils"

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
  success?: boolean
  /**
   * Motion & Feel §12: grow instantly with the content, up to 160px (or the field's own
   * max-height), then scroll; no scrollbar before that. On by default. Fields whose
   * resting size is already 160px or taller (editors) keep their size and scroll.
   */
  autoGrow?: boolean
}

const AUTO_GROW_MAX = 160

function fitToContent(el: HTMLTextAreaElement) {
  // Once someone drags the resize handle, their height wins.
  if (el.dataset.userResized) return
  const cs = getComputedStyle(el)
  const declaredMax = parseFloat(cs.maxHeight)
  const max = Number.isFinite(declaredMax) ? declaredMax : AUTO_GROW_MAX
  // The resting size (min-height, rows) is what the field is when it isn't grown.
  el.style.height = ""
  const resting = el.offsetHeight // layout size: unaffected by a dialog scaling in
  if (resting >= max) {
    el.style.overflowY = ""
    return
  }
  const borders = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth)
  const content = el.scrollHeight + borders
  el.style.height = `${Math.min(max, Math.max(resting, content))}px`
  el.style.overflowY = content > max ? "auto" : "hidden"
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, success, autoGrow = true, onInput, ...props }, ref) => {
    const inner = React.useRef<HTMLTextAreaElement | null>(null)
    const setRef = React.useCallback(
      (el: HTMLTextAreaElement | null) => {
        inner.current = el
        if (typeof ref === "function") ref(el)
        else if (ref) ref.current = el
      },
      [ref]
    )
    // Controlled values set from outside (reset, prefill) refit too.
    React.useLayoutEffect(() => {
      if (autoGrow && inner.current) fitToContent(inner.current)
    }, [autoGrow, props.value])
    // A drag on the resize handle changes the inline height between pointer down and up.
    React.useEffect(() => {
      const el = inner.current
      if (!autoGrow || !el) return
      let before = ""
      const down = () => { before = el.style.height }
      const up = () => { if (el.style.height !== before) el.dataset.userResized = "1" }
      el.addEventListener("pointerdown", down)
      window.addEventListener("pointerup", up)
      return () => {
        el.removeEventListener("pointerdown", down)
        window.removeEventListener("pointerup", up)
      }
    }, [autoGrow])
    // Width changes rewrap the text.
    React.useEffect(() => {
      const el = inner.current
      if (!autoGrow || !el || typeof ResizeObserver === "undefined") return
      let width = el.clientWidth
      const observer = new ResizeObserver(() => {
        if (el.clientWidth !== width) {
          width = el.clientWidth
          fitToContent(el)
        }
      })
      observer.observe(el)
      return () => observer.disconnect()
    }, [autoGrow])
    return (
      <textarea
        className={cn(
          "flex min-h-[96px] w-full rounded-lg border bg-surface-primary px-3 py-2 text-sm ring-offset-background placeholder:text-text-tertiary gio-field shadow-[var(--shadow-xs)]",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-transparent focus-visible:border-[var(--input-border-focus)] focus-visible:shadow-input hover:shadow-[var(--shadow-button)]",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface-secondary",
          error && "border-destructive shadow-[0_0_0_1px_hsl(var(--destructive))] focus-visible:border-destructive focus-visible:shadow-[0_0_0_1px_hsl(var(--destructive)),var(--input-ring)]",
          success && "border-success shadow-[0_0_0_1px_hsl(var(--success))] focus-visible:border-success",
          !error && !success && "border-virgilio-border hover:border-virgilio-purple/50 aria-[invalid=true]:border-destructive aria-[invalid=true]:hover:border-destructive",
          className
        )}
        ref={setRef}
        onInput={(event) => {
          if (autoGrow) fitToContent(event.currentTarget)
          onInput?.(event)
        }}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
