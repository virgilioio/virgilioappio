import { Toaster as Sonner, toast } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

/**
 * The one toast surface (CLAUDE.md §2 Toast, Allan 2026-10-09). Bottom-left, one at a
 * time, 6s, pause on hover and while the tab is hidden (Sonner does both), transitions
 * rather than keyframes. The look lives in src/index.css under [data-sonner-toaster]:
 * ink surface, opal text, a ghost action button for Undo. Dark mode isn't live, so the
 * theme is fixed to light instead of following the OS.
 */
const Toaster = (props: ToasterProps) => (
  <Sonner
    theme="light"
    position="bottom-left"
    visibleToasts={1}
    duration={6000}
    offset={24}
    gap={8}
    className="toaster gio-toaster"
    {...props}
  />
)

export { Toaster, toast }
