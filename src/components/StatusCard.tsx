
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
      className: "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950"
    },
    disconnected: {
      badge: "destructive",
      text: "Disconnected", 
      className: "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950"
    },
    pending: {
      badge: "secondary",
      text: "Pending",
      className: "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950"
    },
    development: {
      badge: "outline",
      text: "Development",
      className: "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950"
    }
  } as const;

  const config = statusConfig[status];

  return (
    <Card className={`transition-all duration-200 hover:shadow-md ${config.className}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 py-token-md">
        <CardTitle className="text-sm font-medium flex items-center gap-token-sm">
          <Icon className="h-4 w-4" />
          {title}
        </CardTitle>
        <Badge variant={config.badge as any} className="text-xs">
          {config.text}
        </Badge>
      </CardHeader>
      <CardContent className="py-token-sm">
        <p className="text-sm text-muted-foreground">{description}</p>
        {details && (
          <p className="text-xs text-muted-foreground mt-token-xs font-mono bg-muted px-token-sm py-token-xs rounded">
            {details}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
