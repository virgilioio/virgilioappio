
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  className?: string;
  compact?: boolean;
}

export function PageHeader({ 
  title, 
  subtitle, 
  children, 
  className, 
  compact = false 
}: PageHeaderProps) {
  return (
    <div className={cn(
      compact ? "pb-md" : "pb-lg",
      className
    )}>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-text-primary">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-text-secondary mt-xs">
              {subtitle}
            </p>
          )}
        </div>
        {children && (
          <div className="ml-md flex-shrink-0">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
