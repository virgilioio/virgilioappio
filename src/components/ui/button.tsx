
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-brand font-medium ring-offset-background transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-accent text-accent-foreground shadow-[var(--shadow-button)] hover:-translate-y-0.5 hover:bg-accent/90 hover:shadow-[var(--shadow-md)] active:translate-y-0 active:scale-95 active:shadow-[var(--shadow-xs)]",
        destructive: "bg-destructive text-destructive-foreground shadow-[var(--shadow-button)] hover:bg-destructive/90 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] active:scale-95 active:shadow-[var(--shadow-xs)]",
        outline: "border border-input bg-background shadow-[var(--shadow-xs)] hover:bg-accent hover:text-accent-foreground hover:-translate-y-0.5 hover:shadow-[var(--shadow-button)] active:scale-95",
        secondary: "bg-secondary text-secondary-foreground shadow-[var(--shadow-button)] hover:bg-secondary/80 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] active:scale-95 active:shadow-[var(--shadow-xs)]",
        ghost: "hover:bg-accent hover:text-accent-foreground hover:scale-105 active:scale-95",
        link: "text-primary underline-offset-4 hover:underline hover:scale-105 active:scale-95",
        success: "bg-success text-success-foreground shadow-[var(--shadow-button)] hover:bg-success/90 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] active:scale-95 active:shadow-[var(--shadow-xs)]",
        warning: "bg-warning text-warning-foreground shadow-[var(--shadow-button)] hover:bg-warning/90 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] active:scale-95 active:shadow-[var(--shadow-xs)]",
        info: "bg-info text-info-foreground shadow-[var(--shadow-button)] hover:bg-info/90 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] active:scale-95 active:shadow-[var(--shadow-xs)]"
      },
      size: {
        default: "h-button px-3 py-2 text-sm font-medium tracking-wide [&_svg]:size-3.5 min-h-[40px] md:min-h-0",
        sm: "h-button-sm px-2 py-1 text-xs font-medium tracking-wide [&_svg]:size-3 min-h-[40px] md:min-h-0",
        lg: "h-button-lg px-4 py-2 text-md font-medium tracking-wide [&_svg]:size-4 min-h-[40px] md:min-h-0",
        icon: "h-button w-button [&_svg]:size-3.5 min-h-[40px] min-w-[40px] md:min-h-0 md:min-w-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    const isDisabled = disabled || loading
    
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={isDisabled}
        {...props}
      >
        {loading && <Loader2 className="animate-spin" />}
        {children}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
