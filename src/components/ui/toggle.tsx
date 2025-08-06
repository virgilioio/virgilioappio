import * as React from "react"
import * as TogglePrimitive from "@radix-ui/react-toggle"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const toggleVariants = cva(
  "inline-flex items-center justify-center rounded-brand text-sm font-medium ring-offset-background transition-all duration-200 ease-out hover:bg-surface-secondary hover:text-text-primary hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground data-[state=on]:shadow-[var(--shadow-button)] data-[state=on]:border data-[state=on]:border-border/30 active:scale-95",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline:
          "border border-border/20 bg-transparent hover:bg-accent hover:text-accent-foreground hover:border-border/40",
      },
      size: {
        default: "h-10 px-3 min-h-[40px] md:min-h-0",
        sm: "h-9 px-2.5 min-h-[40px] md:min-h-0",
        lg: "h-11 px-5 min-h-[40px] md:min-h-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Toggle = React.forwardRef<
  React.ElementRef<typeof TogglePrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root> &
    VariantProps<typeof toggleVariants>
>(({ className, variant, size, ...props }, ref) => (
  <TogglePrimitive.Root
    ref={ref}
    className={cn(toggleVariants({ variant, size, className }))}
    {...props}
  />
))

Toggle.displayName = TogglePrimitive.Root.displayName

export { Toggle, toggleVariants }
