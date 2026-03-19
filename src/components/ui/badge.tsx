
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

        // Role badges
        "role-recruiter": "border-purple-200 bg-purple-100 text-purple-700 dark:border-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
        "role-admin": "border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
        "role-owner": "border-blue-300 bg-blue-200 text-blue-800 dark:border-blue-600 dark:bg-blue-900/40 dark:text-blue-200",
        "role-hiring-manager": "border-orange-200 bg-orange-100 text-orange-700 dark:border-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
        "role-interviewer": "border-cyan-200 bg-cyan-100 text-cyan-700 dark:border-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",

        // Seat badges
        "seat-paid": "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-700 dark:bg-purple-900/20 dark:text-purple-300",
        "seat-free": "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300",

        // Status badges
        "status-active": "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
        "status-invited": "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
        "status-inactive": "border-border bg-muted text-muted-foreground",
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
