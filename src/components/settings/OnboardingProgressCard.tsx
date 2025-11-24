import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle } from "lucide-react";
import { useSaaSCustomerOnboarding } from "@/hooks/useSaaSCustomerOnboarding";
import { formatDistanceToNow } from "date-fns";

interface OnboardingProgressCardProps {
  tenantId: string;
}

export function OnboardingProgressCard({ tenantId }: OnboardingProgressCardProps) {
  const { tasks, completedCount, totalCount, isComplete, completedAt, isLoading } = useSaaSCustomerOnboarding(tenantId);
  
  if (isLoading) {
    return (
      <Card className="card-brand">
        <CardHeader>
          <CardTitle>Onboarding Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-2 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  const progressPercent = (completedCount / totalCount) * 100;
  
  const getStatusBadge = () => {
    if (isComplete) {
      return <Badge variant="default" className="bg-success text-success-foreground">Completed</Badge>;
    }
    if (completedCount === 0) {
      return <Badge variant="outline">Not Started</Badge>;
    }
    return <Badge variant="secondary">In Progress</Badge>;
  };
  
  return (
    <Card className="card-brand">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-base font-medium">Onboarding Progress</CardTitle>
        {getStatusBadge()}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-secondary-foreground font-medium">
              {completedCount} of {totalCount} tasks completed
            </span>
            <span className="text-tertiary">{Math.round(progressPercent)}%</span>
          </div>
          <Progress 
            value={progressPercent} 
            className="h-2"
            indicatorClassName="bg-primary"
          />
        </div>
        
        <div className="space-y-2">
          {tasks.map((task) => (
            <div 
              key={task.id} 
              className="flex items-center gap-2 text-sm"
            >
              {task.completed ? (
                <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              )}
              <span className={task.completed ? "text-foreground" : "text-muted-foreground"}>
                {task.title}
              </span>
            </div>
          ))}
        </div>
        
        {isComplete && completedAt && (
          <div className="pt-2 border-t border-border">
            <p className="text-xs text-tertiary">
              Completed {formatDistanceToNow(new Date(completedAt), { addSuffix: true })}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
