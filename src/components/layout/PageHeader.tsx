import { cn } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/card";

interface MetricCardProps {
  label: string;
  value: number;
}

interface PageHeaderProps {
  title: string;
  children?: React.ReactNode;
  className?: string;
  compact?: boolean;
  metrics?: MetricCardProps[];
}

/**
 * PageHeader: the visible page title is intentionally hidden — the active
 * section is already conveyed by the top navigation. The title remains as a
 * screen-reader-only <h1> for accessibility and document outline.
 *
 * When there are no actions (children) and no metrics, the header collapses
 * to nothing visual, reclaiming the full vertical band.
 */
export function PageHeader({
  title,
  children,
  className,
  compact = false,
  metrics,
}: PageHeaderProps) {
  const hasMetrics = !!(metrics && metrics.length > 0);
  const hasChildren = !!children && !hasMetrics;
  const hasVisibleContent = hasMetrics || hasChildren;

  // Always render the sr-only title for a11y, but skip the layout band when empty.
  if (!hasVisibleContent) {
    return <h1 className="sr-only">{title}</h1>;
  }

  return (
    <div className={cn(compact ? "pb-sm" : "pb-md", className)}>
      <h1 className="sr-only">{title}</h1>
      <div className="flex items-start justify-end gap-6">
        {hasMetrics && (
          <div className="flex gap-3">
            {metrics!.map((metric, idx) => (
              <Card key={idx} className="min-w-[140px]">
                <CardHeader className="py-3 px-4">
                  <div className="text-xs text-text-secondary font-medium mb-1">{metric.label}</div>
                  <div className="text-5xl font-semibold text-text-primary">{metric.value}</div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}

        {hasChildren && <div className="flex-shrink-0">{children}</div>}
      </div>
    </div>
  );
}
