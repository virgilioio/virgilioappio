
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LucideIcon } from "lucide-react";

interface StatusCardProps {
  title: string;
  icon: LucideIcon;
  status: "connected" | "disconnected" | "pending" | "development";
  description: string;
  details?: string;
}

export function StatusCard({ title, icon: Icon, status, description, details }: StatusCardProps) {
  const statusConfig = {
    connected: {
      badge: "default",
      text: "Connected",
      className: "border-success/50 bg-success/10 dark:border-success/30 dark:bg-success/5"
    },
    disconnected: {
      badge: "destructive",
      text: "Disconnected", 
      className: "border-destructive/50 bg-destructive/10 dark:border-destructive/30 dark:bg-destructive/5"
    },
    pending: {
      badge: "secondary",
      text: "Pending",
      className: "border-warning/50 bg-warning/10 dark:border-warning/30 dark:bg-warning/5"
    },
    development: {
      badge: "outline",
      text: "Development",
      className: "border-info/50 bg-info/10 dark:border-info/30 dark:bg-info/5"
    }
  } as const;

  const config = statusConfig[status];

  return (
    <Card className={cn("card-brand", config.className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 py-md">
        <CardTitle className="text-sm font-medium flex items-center gap-sm">
          <Icon className="h-4 w-4" />
          {title}
        </CardTitle>
        <Badge variant={config.badge as any} className="text-xs">
          {config.text}
        </Badge>
      </CardHeader>
      <CardContent className="py-sm">
        <p className="caption-text">{description}</p>
        {details && (
          <p className="text-xs text-tertiary mt-xs font-mono bg-muted px-sm py-xs rounded-sm">
            {details}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
