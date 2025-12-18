
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        success:
          "border-transparent bg-success text-success-foreground hover:bg-success/80",
        warning:
          "border-transparent bg-warning text-warning-foreground hover:bg-warning/80",
        info:
          "border-transparent bg-info text-info-foreground hover:bg-info/80",
        outline: "text-foreground border-border hover:bg-accent hover:text-accent-foreground",
        "pastel-blue": "border-transparent bg-pastel-blue text-pastel-blue-foreground hover:bg-pastel-blue/80",
        "pastel-purple": "border-transparent bg-pastel-purple text-pastel-purple-foreground hover:bg-pastel-purple/80",
        "pastel-green": "border-transparent bg-pastel-green text-pastel-green-foreground hover:bg-pastel-green/80",
        "pastel-pink": "border-transparent bg-pastel-pink text-pastel-pink-foreground hover:bg-pastel-pink/80",
        "pastel-yellow": "border-transparent bg-pastel-yellow text-pastel-yellow-foreground hover:bg-pastel-yellow/80",
        "pastel-orange": "border-transparent bg-pastel-orange text-pastel-orange-foreground hover:bg-pastel-orange/80",
        "purple": "border-transparent bg-purple-100 text-purple-800 hover:bg-purple-100/80 dark:bg-purple-900/30 dark:text-purple-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  interactive?: boolean
}

function Badge({ className, variant, interactive = false, ...props }: BadgeProps) {
  return (
    <div 
      className={cn(
        badgeVariants({ variant }), 
        interactive && "cursor-pointer hover:scale-105",
        className
      )} 
      {...props} 
    />
  )
}

export { Badge, badgeVariants }
