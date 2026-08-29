import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
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
  /** Renders the title visibly (26px Poppins 600, -0.045em) with a lilac "." */
  kicker?: boolean;
  /** Count chip on the title row. */
  count?: number;
  /** Meta row under the title — pass separate <span>s, gap 16. */
  meta?: ReactNode;
  /** Crumb trail above the title (visible title mode). Items with `to` render as links; the last crumb is always plain text (current page). */
  breadcrumb?: (string | { label: string; to: string })[];
  /** Right-aligned action cluster (visible title mode). */
  actions?: ReactNode;
  /** Replaces the h1 text with a custom node (e.g. an editable title input). */
  titleNode?: ReactNode;
}

/**
 * PageHeader.
 *
 * Default mode: the visible page title is intentionally hidden — the active
 * section is already conveyed by the top navigation.
 *
 * Visible mode: pass any of `kicker`, `count`, `meta`, `breadcrumb`, `actions`
 * or `titleNode` and the Gio page header renders — breadcrumb → title row
 * (h1 26px Poppins 600 / -0.045em + count chip) → meta row → children, with
 * actions right-aligned across from the block.
 */
export function PageHeader({
  title,
  children,
  className,
  compact = false,
  metrics,
  kicker,
  count,
  meta,
  breadcrumb,
  actions,
  titleNode,
}: PageHeaderProps) {
  const hasMetrics = !!(metrics && metrics.length > 0);
  const visible =
    !!kicker || count != null || !!meta || !!breadcrumb || !!actions || !!titleNode;

  if (visible) {
    return (
      <div
        className={cn("flex items-start justify-between gap-6", className)}
        style={{ marginBottom: 20 }}
      >
        <div className="min-w-0">
          {breadcrumb && breadcrumb.length > 0 && (
            <div
              className="flex items-center font-inter"
              style={{ marginBottom: 8, gap: 6, fontSize: 11.5, color: "#8B8F9E" }}
            >
              {breadcrumb.map((crumb, i) => {
                const last = i === breadcrumb.length - 1;
                return (
                  <span key={i} className="flex items-center" style={{ gap: 6 }}>
                    {i > 0 && (
                      <ChevronRight size={11} strokeWidth={2} style={{ color: "#D1D5DB" }} />
                    )}
                    <span
                      className="truncate"
                      style={last ? { color: "#1F2230", fontWeight: 500 } : undefined}
                    >
                      {crumb}
                    </span>
                  </span>
                );
              })}
            </div>
          )}

          <div className="flex items-center min-w-0" style={{ gap: 12 }}>
            {titleNode ?? (
              <h1
                className="font-poppins text-[#0d0d09] truncate"
                style={{
                  fontWeight: 600,
                  fontSize: 26,
                  letterSpacing: "-0.045em",
                  lineHeight: 1.15,
                  margin: 0,
                }}
              >
                {title}
                {kicker && <span style={{ color: "#D7C5FB" }}>.</span>}
              </h1>
            )}
            {count != null && (
              <span
                className="font-inter shrink-0"
                style={{
                  padding: "2px 8px",
                  background: "#F1F0EC",
                  color: "#5A6072",
                  borderRadius: 999,
                  fontSize: 11.5,
                  fontWeight: 500,
                }}
              >
                {count}
              </span>
            )}
          </div>

          {meta && (
            <div
              className="flex items-center flex-wrap font-inter"
              style={{ marginTop: 8, gap: 16, fontSize: 12, color: "#5A6072" }}
            >
              {meta}
            </div>
          )}

          {children}
        </div>

        {actions && (
          <div className="flex items-center shrink-0" style={{ gap: 8 }}>
            {actions}
          </div>
        )}
      </div>
    );
  }

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
