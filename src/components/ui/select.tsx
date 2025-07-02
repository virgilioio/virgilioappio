import * as React from "react"
import {
  Check,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

const Select = React.forwardRef<
  HTMLButtonElement,
  React.HTMLAttributes<HTMLButtonElement>
>(({ className, children, ...props }, ref) => {
  return (
    <Button
      variant="outline"
      role="combobox"
      aria-expanded="false"
      className={cn(
        "flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    >
      {children}
      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
    </Button>
  )
})
Select.displayName = "Select"

const SelectTrigger = Select

const SelectValue = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, children, ...props }, ref) => {
  return (
    <span
      className={cn(
        "flex items-center justify-between py-0.5",
        className
      )}
      ref={ref}
      {...props}
    >
      {children}
    </span>
  )
})
SelectValue.displayName = "SelectValue"

const SelectContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  return (
    <PopoverContent
      className={cn(
        "w-[var(--radix-select-trigger-width)] rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
        className
      )}
      {...props}
      ref={ref}
    >
      <Command>
        {children}
      </Command>
    </PopoverContent>
  )
})
SelectContent.displayName = "SelectContent"

const SelectItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    inset?: boolean
    closeOnSelect?: boolean
  }
>(({ className, children, inset, closeOnSelect = true, ...props }, ref) => {
  return (
    <CommandItem
      className={cn(
        "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        inset && "pl-8",
        className
      )}
      {...props}
      ref={ref}
    >
      {children}
      {/* <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
        <Check className="h-4 w-4 opacity-0 aria-selected:opacity-100" />
      </span> */}
    </CommandItem>
  )
})
SelectItem.displayName = "SelectItem"

const SelectLabel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    inset?: boolean
  }
>(({ className, inset, ...props }, ref) => (
  <CommandGroup.Label
    className={cn(
      "px-2 py-1.5 text-sm font-semibold",
      inset && "pl-8",
      className
    )}
    {...props}
    ref={ref}
  />
))
SelectLabel.displayName = "SelectLabel"

const SelectSeparator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <CommandGroup.Separator
    className={cn("-mx-1 my-1 h-px bg-border", className)}
    {...props}
    ref={ref}
  />
))
SelectSeparator.displayName = "SelectSeparator"

const SelectGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <CommandGroup className={cn("group", className)} {...props} ref={ref} />
))
SelectGroup.displayName = "SelectGroup"

const SelectScrollUp = React.forwardRef<
  HTMLButtonElement,
  React.HTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => (
  <SelectItem
    className={cn(
      "flex cursor-default select-none items-center justify-center rounded-sm px-2.5 py-1.5 text-sm font-medium outline-none focus:bg-secondary focus:text-secondary-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
    ref={ref}
  >
    <ChevronUp className="h-4 w-4" />
  </SelectItem>
))
SelectScrollUp.displayName = "SelectScrollUp"

const SelectScrollDown = React.forwardRef<
  HTMLButtonElement,
  React.HTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => (
  <SelectItem
    className={cn(
      "flex cursor-default select-none items-center justify-center rounded-sm px-2.5 py-1.5 text-sm font-medium outline-none focus:bg-secondary focus:text-secondary-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
    ref={ref}
  >
    <ChevronDown className="h-4 w-4" />
  </SelectItem>
))
SelectScrollDown.displayName = "SelectScrollDown"

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectScrollUp,
  SelectScrollDown,
}
