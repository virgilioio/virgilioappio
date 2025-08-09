
import { cn } from "@/lib/utils";
import { AppContainer } from "@/components/layout/AppContainer";

interface SectionProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "muted" | "tertiary" | "primary";
  banded?: boolean;
  container?: boolean;
}

export function Section({ children, className, variant = "default", banded = false, container = false }: SectionProps) {
  const variantClasses = {
    default: "bg-surface-primary",
    muted: "bg-surface-secondary", 
    tertiary: "bg-surface-tertiary",
    primary: "bg-primary/5"
  } as const;

  const content = container ? (
    <AppContainer>
      {children}
    </AppContainer>
  ) : (
    children
  )

  return (
    <section className={cn(
      "py-layout-md",
      variantClasses[variant],
      banded && "border-y border-border/60",
      className
    )}>
      {content}
    </section>
  );
}
