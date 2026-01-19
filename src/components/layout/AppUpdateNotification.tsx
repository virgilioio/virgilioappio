import { createPortal } from 'react-dom';
import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppVersionCheck } from '@/hooks/useAppVersionCheck';

export function AppUpdateNotification() {
  const { updateAvailable, refresh, dismiss } = useAppVersionCheck();

  if (!updateAvailable) return null;

  return createPortal(
    <div className="fixed bottom-4 right-4 z-[9999] pointer-events-none animate-in slide-in-from-bottom-5 fade-in duration-300">
      <div className="pointer-events-auto flex items-center gap-3 bg-background border border-border rounded-lg shadow-lg p-4 max-w-sm">
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">
            Update available
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            A new version of GoGio ATS is ready.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={dismiss}
          >
            <X className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            onClick={refresh}
            className="gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
