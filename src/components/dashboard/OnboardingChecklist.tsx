import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Check, ChevronRight } from 'lucide-react';
import gioAvatar from '@/assets/gio-avatar.png';
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
    dismissChecklist,
    refreshProgress
  } = useOnboardingProgress();

  // Recompute onboarding progress when checklist mounts
  useEffect(() => {
    refreshProgress();
  }, [refreshProgress]);
  
  // Don't show if dismissed or loading
  if (isDismissed || isLoading) return null;
  
  const progressPercent = (completedCount / totalCount) * 100;
  
  return (
    <Card className="border-virgilio-purple/20 bg-gradient-to-br from-virgilio-purple/5 to-surface-primary h-fit">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <img src={gioAvatar} alt="Gio" className="h-5 w-5 rounded-full" />
            Get Started
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={dismissChecklist}
            className="h-6 w-6 p-0"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
        
        {/* Progress Bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-virgilio-text">
              {completedCount}/{totalCount}
            </span>
            <span className="text-xs text-text-secondary">
              {Math.round(progressPercent)}%
            </span>
          </div>
          <Progress 
            value={progressPercent} 
            className="h-1.5"
            indicatorClassName="bg-gradient-to-r from-virgilio-purple to-virgilio-purple/70"
          />
        </div>
      </CardHeader>
      
      <CardContent className="pt-0 pb-3 px-3">
        <div className="space-y-1.5">
          {tasks.map((task, index) => (
            <div
              key={task.id}
              className={cn(
                "flex items-center gap-2 p-2 rounded-md border border-virgilio-border transition-all cursor-pointer",
                "hover:border-virgilio-purple/40 hover:bg-virgilio-purple/5",
                task.completed && "opacity-50"
              )}
              onClick={() => {
                const url = new URL(task.route, window.location.origin);
                url.searchParams.set('highlight', task.id);
                navigate(`${url.pathname}${url.search}`);
              }}
            >
              {/* Checkbox */}
              <div className="flex-shrink-0">
                <Checkbox
                  checked={task.completed}
                  onCheckedChange={(checked) => {
                    markTaskComplete(task.id, checked as boolean);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="h-3.5 w-3.5"
                />
              </div>
              
              {/* Task Number */}
              <div className={cn(
                "flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium",
                task.completed 
                  ? "bg-virgilio-purple text-white" 
                  : "bg-surface-secondary text-text-secondary"
              )}>
                {task.completed ? (
                  <Check className="h-3 w-3" />
                ) : (
                  index + 1
                )}
              </div>
              
              {/* Task Info */}
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-xs text-virgilio-text leading-tight">{task.title}</h4>
              </div>
              
              {/* Arrow */}
              <ChevronRight className="h-3 w-3 text-text-secondary flex-shrink-0" />
            </div>
          ))}
        </div>
        
        {/* Celebration when complete */}
        {isComplete && (
          <div className="mt-3 p-3 bg-virgilio-purple/10 border border-virgilio-purple/20 rounded-md">
            <div className="flex items-center gap-2">
              <div className="text-2xl">🎉</div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-virgilio-purple text-xs">All done!</h4>
                <p className="text-xs text-text-secondary">
                  You're ready to hire!
                </p>
              </div>
              <Button onClick={dismissChecklist} size="sm" className="h-7 text-xs">
                Got it
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
