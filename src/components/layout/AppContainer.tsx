
import { cn } from "@/lib/utils";

interface AppContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function AppContainer({ children, className }: AppContainerProps) {
  return (
    <div className={cn(
      "mx-auto max-w-7xl px-layout-sm sm:px-layout-md lg:px-layout-lg",
      className
    )}>
      {children}
    </div>
  );
}
