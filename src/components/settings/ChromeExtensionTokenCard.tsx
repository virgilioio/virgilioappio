import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { AlertTriangle, Chrome, Copy, RefreshCw, Eye, EyeOff, ExternalLink, ChevronDown, User, Briefcase, FileText } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { copyToClipboard } from '@/utils/clipboard'
import { useAuth } from '@/contexts/AuthContext'

const CHROME_STORE_URL = 'https://chromewebstore.google.com/detail/gogio-linkedin-extension/nhkooggcjgdckjlpbogeanhohjkndhcj'

export function ChromeExtensionTokenCard() {
  const { user } = useAuth()
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showToken, setShowToken] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

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

  const handleInstall = () => {
    window.open(CHROME_STORE_URL, '_blank')
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-1">GoGio Chrome Extension</h3>
        <p className="text-sm text-muted-foreground">
          Add candidates directly from LinkedIn with one click.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Chrome className="h-5 w-5 text-virgilio-purple" />
            Chrome Extension
          </CardTitle>
          <CardDescription>
            Install the extension to streamline your LinkedIn sourcing workflow.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Benefits List */}
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              The extension automatically captures:
            </p>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-virgilio-purple" />
                <span>Profile data (name, title, company, location)</span>
              </li>
              <li className="flex items-center gap-2 text-sm">
                <Briefcase className="h-4 w-4 text-virgilio-purple" />
                <span>Skills and experience</span>
              </li>
              <li className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-virgilio-purple" />
                <span>LinkedIn PDF resumes</span>
              </li>
            </ul>
          </div>

          {/* Primary Install Button */}
          <Button onClick={handleInstall} className="gap-2">
            <ExternalLink className="h-4 w-4" />
            Install from Chrome Web Store
          </Button>

          {/* Collapsible Fallback Section */}
          <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground hover:text-foreground">
                <span>Having trouble connecting?</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4 space-y-4">
              <p className="text-xs text-muted-foreground">
                If the extension doesn't connect automatically, you can manually copy your authentication token.
              </p>

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
                  variant={token ? 'outline' : 'secondary'}
                  size="sm"
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
                      Get Manual Token
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
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>
    </div>
  )
}
