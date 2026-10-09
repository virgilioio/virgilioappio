import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Motion & Feel §5 Avatars and logos (CLAUDE.md): the initials placeholder is exactly
 * the image's size and stays underneath; the image fades in over it (--dur-switch) once
 * it has loaded, then the placeholder hides. A broken image keeps the initials. Sizes
 * never swap. (Same API as the shadcn/Radix avatar it replaces.)
 */
type Status = "idle" | "loading" | "loaded" | "error"
const AvatarContext = React.createContext<{ status: Status; setStatus: (s: Status) => void } | null>(null)

const Avatar = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
  ({ className, ...props }, ref) => {
    const [status, setStatus] = React.useState<Status>("idle")
    return (
      <AvatarContext.Provider value={{ status, setStatus }}>
        <span
          ref={ref}
          data-status={status}
          className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className)}
          {...props}
        />
      </AvatarContext.Provider>
    )
  }
)
Avatar.displayName = "Avatar"

const AvatarImage = React.forwardRef<
  HTMLImageElement,
  React.ImgHTMLAttributes<HTMLImageElement> & { onLoadingStatusChange?: (s: Status) => void }
>(({ className, src, onLoad, onError, onLoadingStatusChange, ...props }, ref) => {
  const ctx = React.useContext(AvatarContext)
  const [status, setLocal] = React.useState<Status>(src ? "loading" : "error")
  const set = React.useCallback(
    (s: Status) => {
      setLocal(s)
      ctx?.setStatus(s)
      onLoadingStatusChange?.(s)
    },
    [ctx, onLoadingStatusChange]
  )
  React.useLayoutEffect(() => {
    set(src ? "loading" : "error")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src])
  React.useEffect(() => () => ctx?.setStatus("idle"), [ctx])
  if (!src || status === "error") return null
  return (
    <img
      ref={(node) => {
        if (typeof ref === "function") ref(node)
        else if (ref) ref.current = node
        // Already in the cache: no fade, it's simply there.
        if (node && node.complete && node.naturalWidth > 0 && status === "loading") set("loaded")
      }}
      src={src}
      data-loaded={status === "loaded" || undefined}
      onLoad={(e) => {
        set("loaded")
        onLoad?.(e)
      }}
      onError={(e) => {
        set("error")
        onError?.(e)
      }}
      className={cn("gio-avatar-img absolute inset-0 z-[1] aspect-square h-full w-full object-cover", className)}
      {...props}
    />
  )
})
AvatarImage.displayName = "AvatarImage"

const AvatarFallback = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
  ({ className, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "gio-avatar-fallback flex h-full w-full items-center justify-center rounded-full bg-muted",
        className
      )}
      {...props}
    />
  )
)
AvatarFallback.displayName = "AvatarFallback"

export { Avatar, AvatarImage, AvatarFallback }
