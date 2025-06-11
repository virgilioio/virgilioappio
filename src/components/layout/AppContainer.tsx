
import { cn } from "@/lib/utils";

interface AppContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function AppContainer({ children, className }: AppContainerProps) {
  return (
    <div className={cn(
      "mx-auto max-w-6xl px-3 sm:px-4 lg:px-4",
      className
    )}>
      {children}
    </div>
  );
}
