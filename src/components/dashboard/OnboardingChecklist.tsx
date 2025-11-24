import { useNavigate } from 'react-router-dom';
import { Rocket, X, Check, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { useOnboardingProgress } from '@/hooks/useOnboardingProgress';
import { cn } from '@/lib/utils';

export function OnboardingChecklist() {
  const navigate = useNavigate();
  const {
    tasks,
    completedCount,
    totalCount,
    isComplete,
    isDismissed,
    isLoading,
    markTaskComplete,
    dismissChecklist
  } = useOnboardingProgress();
  
  // Don't show if dismissed or loading
  if (isDismissed || isLoading) return null;
  
  const progressPercent = (completedCount / totalCount) * 100;
  
  return (
    <Card className="border-virgilio-purple/20 bg-gradient-to-br from-virgilio-purple/5 to-surface-primary">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <Rocket className="h-5 w-5 text-virgilio-purple" />
              Get Started with GoGio
            </CardTitle>
            <CardDescription className="mt-1">
              Complete these steps to unlock the full power of your recruiting platform
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={dismissChecklist}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Progress Bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-virgilio-text">
              {completedCount} of {totalCount} completed
            </span>
            <span className="text-sm text-text-secondary">
              {Math.round(progressPercent)}%
            </span>
          </div>
          <Progress 
            value={progressPercent} 
            className="h-2"
            indicatorClassName="bg-gradient-to-r from-virgilio-purple to-virgilio-purple/70"
          />
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-3">
          {tasks.map((task, index) => (
            <div
              key={task.id}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border border-virgilio-border transition-all cursor-pointer",
                "hover:border-virgilio-purple/40 hover:bg-virgilio-purple/5",
                task.completed && "opacity-60"
              )}
              onClick={() => navigate(task.route)}
            >
              {/* Checkbox */}
              <div className="flex-shrink-0">
                <Checkbox
                  checked={task.completed}
                  onCheckedChange={(checked) => {
                    markTaskComplete(task.id, checked as boolean);
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              
              {/* Task Number */}
              <div className={cn(
                "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                task.completed 
                  ? "bg-virgilio-purple text-white" 
                  : "bg-surface-secondary text-text-secondary"
              )}>
                {task.completed ? (
                  <Check className="h-4 w-4" />
                ) : (
                  index + 1
                )}
              </div>
              
              {/* Task Info */}
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm text-virgilio-text">{task.title}</h4>
                <p className="text-xs text-text-secondary mt-0.5">
                  {task.description}
                </p>
              </div>
              
              {/* Arrow */}
              <ChevronRight className="h-4 w-4 text-text-secondary flex-shrink-0" />
            </div>
          ))}
        </div>
        
        {/* Celebration when complete */}
        {isComplete && (
          <div className="mt-4 p-4 bg-virgilio-purple/10 border border-virgilio-purple/20 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="text-3xl">🎉</div>
              <div className="flex-1">
                <h4 className="font-semibold text-virgilio-purple">Congratulations!</h4>
                <p className="text-sm text-text-secondary">
                  You've completed all setup tasks. You're ready to hire amazing talent!
                </p>
              </div>
              <Button onClick={dismissChecklist} size="sm">
                Got it!
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
