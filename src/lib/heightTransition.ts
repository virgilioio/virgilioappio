import { useCallback, useEffect, useRef } from "react"

/**
 * Block B §13: when a dialog's content changes (an error, more options, the next
 * step), the dialog resizes from its old height to its new one over --dur-resize
 * with --ease-in-out. The content itself swaps instantly. The first measurement
 * (opening) never animates, and reduced motion snaps.
 */
export function useHeightTransition<T extends HTMLElement>() {
  const cleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanup.current?.(), []);
  // A callback ref: dialog content mounts and unmounts with every open/close.
  return useCallback((el: T | null) => {
    cleanup.current?.();
    cleanup.current = null;
    if (!el || typeof ResizeObserver === "undefined") return;
    let last: number | null = null;
    let running: Animation | null = null;
    const observer = new ResizeObserver(() => {
      if (running) return;
      const next = el.offsetHeight;
      if (last !== null && Math.abs(next - last) > 1 && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
        const style = getComputedStyle(el);
        const raw = style.getPropertyValue("--dur-resize").trim();
        const duration = Number.parseFloat(raw) * (raw.endsWith("ms") ? 1 : 1000) || 220;
        const overflow = el.style.overflow;
        el.style.overflow = "hidden";
        const animation = el.animate([{ height: `${last}px` }, { height: `${next}px` }], {
          duration,
          easing: style.getPropertyValue("--ease-in-out").trim() || "ease-in-out",
        });
        running = animation;
        const done = () => {
          if (running !== animation) return;
          running = null;
          el.style.overflow = overflow;
          last = el.offsetHeight;
        };
        animation.onfinish = done;
        animation.oncancel = done;
      }
      last = next;
    });
    observer.observe(el);
    cleanup.current = () => {
      observer.disconnect();
      running?.cancel();
    };
  }, []);
}

/** Combine a forwarded ref with a local one. */
export function mergeRefs<T>(...refs: (React.Ref<T> | undefined)[]) {
  return (node: T | null) => {
    for (const ref of refs) {
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as React.MutableRefObject<T | null>).current = node;
    }
  };
}
