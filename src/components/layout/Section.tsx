
import { cn } from "@/lib/utils";

interface SectionProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "muted" | "primary";
}

export function Section({ children, className, variant = "default" }: SectionProps) {
  const variantClasses = {
    default: "bg-surface-primary",
    muted: "bg-surface-secondary",
    primary: "bg-primary/5"
  };

  return (
    <section className={cn(
      "py-layout-lg",
      variantClasses[variant],
      className
    )}>
      {children}
    </section>
  );
}
