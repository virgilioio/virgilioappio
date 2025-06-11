
import { cn } from "@/lib/utils";

interface AppContainerProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'sm' | 'lg';
}

export function AppContainer({ children, className, variant = 'default' }: AppContainerProps) {
  const getContainerClass = () => {
    switch (variant) {
      case 'sm':
        return 'layout-container-sm'
      case 'lg':
        return 'layout-container-lg'
      default:
        return 'layout-container'
    }
  }

  return (
    <div className={cn(getContainerClass(), className)}>
      {children}
    </div>
  );
}
