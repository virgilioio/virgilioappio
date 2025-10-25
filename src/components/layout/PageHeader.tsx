
import { cn } from "@/lib/utils";
import { StyledPageTitle } from "@/components/ui/styled-page-title";
import { Card, CardHeader } from "@/components/ui/card";

interface MetricCardProps {
  label: string;
  value: number;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  className?: string;
  compact?: boolean;
  metrics?: MetricCardProps[];
}

export function PageHeader({ 
  title, 
  subtitle, 
  children, 
  className, 
  compact = false,
  metrics
}: PageHeaderProps) {
  return (
    <div className={cn(
      compact ? "pb-md" : "pb-lg",
      className
    )}>
       <div className="flex items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <StyledPageTitle>
            {title}
          </StyledPageTitle>
          {subtitle && (
            <p className="text-sm text-text-secondary mt-xs">
              {subtitle}
            </p>
          )}
        </div>
        
        {metrics && metrics.length > 0 && (
          <div className="flex gap-3">
            {metrics.map((metric, idx) => (
              <Card key={idx} className="min-w-[140px]">
                <CardHeader className="py-3 px-4">
                  <div className="text-xs text-text-secondary font-medium mb-1">{metric.label}</div>
                  <div className="text-4xl font-semibold text-text-primary">{metric.value}</div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
        
        {children && !metrics && (
          <div className="ml-md flex-shrink-0">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
