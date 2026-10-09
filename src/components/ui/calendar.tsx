import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { useMonthSlide } from "@/lib/motion";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

/**
 * Gio Foundation v1.0 §5 — Date picker grid.
 * Mirrors `DatePickerVirgilio` so every consumer of the shadcn `<Calendar>`
 * automatically picks up the new menu chrome.
 *  - 32px square cells, radius 8, Inter 12.5px
 *  - Selected → bg-virgilio-purple text-white
 *  - Today (unselected) → ring-1 ring-virgilio-purple/30
 *  - Hover → bg-[hsl(var(--menu-hover))]
 *  - Header → text-menu-group uppercase #8B8F9E
 */
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  fixedWeeks = true,
  onMonthChange,
  ...props
}: CalendarProps) {
  // §7: six fixed weeks, and the day grid slides 12px toward the month you moved to.
  const wrap = React.useRef<HTMLDivElement>(null);
  const [shown, setShown] = React.useState(() => {
    const p = props as { month?: Date; defaultMonth?: Date; selected?: unknown };
    const sel = p.selected instanceof Date ? p.selected : (p.selected as { from?: Date } | undefined)?.from;
    const start = p.month ?? p.defaultMonth ?? sel ?? new Date();
    return start.getFullYear() * 12 + start.getMonth();
  });
  useMonthSlide(wrap, shown, "table");
  return (
    <div ref={wrap} className="contents">
    <DayPicker
      showOutsideDays={showOutsideDays}
      fixedWeeks={fixedWeeks}
      onMonthChange={(month) => {
        setShown(month.getFullYear() * 12 + month.getMonth());
        onMonthChange?.(month);
      }}
      className={cn("p-3 pointer-events-auto", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-3",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-h4 text-virgilio-text",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-7 w-7 p-0 rounded-lg"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell:
          "w-8 py-1 text-menu-group font-inter uppercase text-[hsl(var(--menu-group-color))]",
        row: "flex w-full mt-1",
        cell: "h-8 w-8 text-center p-0 relative focus-within:relative focus-within:z-20",
        day: cn(
          "h-8 w-8 p-0 rounded-lg text-[12.5px] font-medium transition-colors duration-150",
          "text-virgilio-text hover:bg-[hsl(var(--menu-hover))] cursor-pointer",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-virgilio-purple/30",
          "aria-selected:opacity-100"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-virgilio-purple text-white hover:bg-virgilio-purple hover:text-white focus:bg-virgilio-purple focus:text-white",
        day_today: "ring-1 ring-virgilio-purple/30",
        day_outside:
          "day-outside text-virgilio-border opacity-60 aria-selected:bg-[hsl(var(--menu-selected))] aria-selected:text-foreground",
        day_disabled: "opacity-45 cursor-not-allowed",
        day_range_middle:
          "aria-selected:bg-[hsl(var(--menu-selected))] aria-selected:text-foreground rounded-none",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ..._props }) => <ChevronLeft className="h-4 w-4 text-virgilio-text" />,
        IconRight: ({ ..._props }) => <ChevronRight className="h-4 w-4 text-virgilio-text" />,
      }}
      {...props}
    />
    </div>
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
