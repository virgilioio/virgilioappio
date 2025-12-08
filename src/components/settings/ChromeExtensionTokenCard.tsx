import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Chrome, Copy, RefreshCw, Eye, EyeOff } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { copyToClipboard } from '@/utils/clipboard'
import { useAuth } from '@/contexts/AuthContext'

export function ChromeExtensionTokenCard() {
  const { user } = useAuth()
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showToken, setShowToken] = useState(false)

  // Only render for authenticated users
  if (!user) {
    return null
  }

  const handleGetToken = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const { data, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) {
        setError('Failed to get session. Please try again.')
        return
      }
      
      if (!data.session?.access_token) {
        setError('No active session found. Please sign in again.')
        return
      }
      
      setToken(data.session.access_token)
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopyToken = () => {
    if (token) {
      copyToClipboard(token, 'Token copied to clipboard')
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-1">GoGio Chrome Extension</h3>
        <p className="text-sm text-muted-foreground">
          Connect the GoGio Chrome extension to add candidates directly from LinkedIn.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Chrome className="h-5 w-5 text-virgilio-purple" />
            Chrome Extension Token
          </CardTitle>
          <CardDescription>
            Generate an access token to authenticate the Chrome extension with your GoGio account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-3">
            <Button
              onClick={handleGetToken}
              disabled={isLoading}
              variant={token ? 'outline' : 'default'}
              className="gap-2"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Getting token...
                </>
              ) : token ? (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Refresh Token
                </>
              ) : (
                <>
                  <Chrome className="h-4 w-4" />
                  Get Chrome Token
                </>
              )}
            </Button>

            {token && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showToken ? 'text' : 'password'}
                      value={token}
                      readOnly
                      className="pr-20 font-mono text-xs"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 px-2"
                      onClick={() => setShowToken(!showToken)}
                    >
                      {showToken ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                  <Button
                    onClick={handleCopyToken}
                    variant="secondary"
                    size="sm"
                    className="gap-1.5 flex-shrink-0"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </Button>
                </div>

                <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 p-3 rounded-md">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-amber-500" />
                  <span>
                    Keep this token secret. Paste it once in the Chrome extension. 
                    If it stops working, come back and refresh it.
                  </span>
                </div>

                <Badge variant="secondary" className="text-xs">
                  Token expires automatically — refresh when needed
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
