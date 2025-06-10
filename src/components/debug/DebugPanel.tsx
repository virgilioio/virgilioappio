
import { useState } from "react";
import { useLocation } from "react-router-dom";
import { ChevronDown, ChevronUp, Code2, Monitor, User, Globe } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAuth } from "@/contexts/AuthContext";

export function DebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const { user, isAuthenticated, isLoading } = useAuth();
  
  // Only show in development
  if (import.meta.env.PROD) {
    return null;
  }

  const debugInfo = {
    currentRoute: location.pathname,
    user: user?.email || null,
    authStatus: isLoading ? 'loading' : (isAuthenticated ? 'authenticated' : 'unauthenticated'),
    environment: import.meta.env.MODE,
    version: "1.0.0-alpha",
    buildTime: new Date().toLocaleString(),
    supabaseConnected: true
  };

  return (
    <div className="fixed top-4 right-4 z-50">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-token-sm bg-surface-primary border-2 shadow-lg"
          >
            <Code2 className="h-4 w-4" />
            Debug
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="mt-2">
          <Card className="w-80 bg-surface-primary border-2 shadow-xl">
            <CardHeader className="py-token-md">
              <CardTitle className="text-sm flex items-center gap-token-sm">
                <Monitor className="h-4 w-4" />
                Development Debug Panel
              </CardTitle>
            </CardHeader>
            
            <CardContent className="space-y-token-md py-token-md">
              {/* Current Route */}
              <div className="space-y-token-xs">
                <div className="flex items-center gap-token-sm text-xs font-medium text-muted-foreground">
                  <Globe className="h-3 w-3" />
                  Current Route
                </div>
                <Badge variant="secondary" className="font-mono text-xs">
                  {debugInfo.currentRoute}
                </Badge>
              </div>

              {/* User Status */}
              <div className="space-y-token-xs">
                <div className="flex items-center gap-token-sm text-xs font-medium text-muted-foreground">
                  <User className="h-3 w-3" />
                  Authentication
                </div>
                <div className="space-y-1">
                  <Badge 
                    variant={debugInfo.authStatus === 'authenticated' ? 'default' : 
                            debugInfo.authStatus === 'loading' ? 'secondary' : 'destructive'}
                    className="text-xs"
                  >
                    {debugInfo.authStatus}
                  </Badge>
                  {debugInfo.user && (
                    <div className="text-xs bg-muted px-token-sm py-token-xs rounded font-mono">
                      {debugInfo.user}
                    </div>
                  )}
                </div>
              </div>

              {/* Environment Info */}
              <div className="space-y-token-xs">
                <div className="text-xs font-medium text-muted-foreground">Environment</div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>Mode:</span>
                    <Badge variant={debugInfo.environment === 'development' ? 'default' : 'secondary'}>
                      {debugInfo.environment}
                    </Badge>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>Version:</span>
                    <code className="text-xs bg-muted px-1 rounded">{debugInfo.version}</code>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>Supabase:</span>
                    <Badge variant={debugInfo.supabaseConnected ? 'default' : 'destructive'}>
                      {debugInfo.supabaseConnected ? 'Connected' : 'Not configured'}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="space-y-token-xs pt-token-sm border-t">
                <div className="text-xs font-medium text-muted-foreground">Quick Actions</div>
                <div className="grid grid-cols-2 gap-token-sm">
                  <Button variant="outline" size="sm" className="text-xs h-8">
                    Clear Cache
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs h-8">
                    View Logs
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
