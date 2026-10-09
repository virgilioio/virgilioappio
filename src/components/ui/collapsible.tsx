import * as React from "react"
import * as CollapsiblePrimitive from "@radix-ui/react-collapsible"

const Collapsible = CollapsiblePrimitive.Root

const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger

/**
 * Motion & Feel §2 (CLAUDE.md): the panel's height animates to its real size over
 * --dur-expand on --ease-in-out and the content fades in a beat later. The caller's
 * className styles an inner wrapper, so padding and spacing never fight the height.
 * `forceMount` and `asChild` keep the plain Radix behaviour.
 */
const CollapsibleContent = React.forwardRef<
  React.ElementRef<typeof CollapsiblePrimitive.CollapsibleContent>,
  React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.CollapsibleContent>
>(({ className, children, asChild, ...props }, ref) =>
  asChild ? (
    <CollapsiblePrimitive.CollapsibleContent ref={ref} asChild className={className} {...props}>
      {children}
    </CollapsiblePrimitive.CollapsibleContent>
  ) : (
    <CollapsiblePrimitive.CollapsibleContent ref={ref} className="gio-accordion-content" {...props}>
      <div data-disclosure-inner className={className}>
        {children}
      </div>
    </CollapsiblePrimitive.CollapsibleContent>
  )
)
CollapsibleContent.displayName = CollapsiblePrimitive.CollapsibleContent.displayName

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
