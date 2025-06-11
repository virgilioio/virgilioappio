
import { cn } from "@/lib/utils";

interface SectionProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "muted" | "tertiary" | "primary";
}

export function Section({ children, className, variant = "default" }: SectionProps) {
  const variantClasses = {
    default: "bg-surface-primary",
    muted: "bg-surface-secondary", 
    tertiary: "bg-surface-tertiary",
    primary: "bg-primary/5"
  };

  return (
    <section className={cn(
      "py-layout-md",
      variantClasses[variant],
      className
    )}>
      {children}
    </section>
  );
}
