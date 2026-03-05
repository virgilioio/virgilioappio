import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Sparkles, X } from 'lucide-react'
import gioAiBannerIcon from '@/assets/gio-ai-banner-icon.png'
import gioAvatar from '@/assets/gio-avatar.png'

export function AiBannerGuide() {
  const [dismissedEnrichment, setDismissedEnrichment] = useState(false)

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Notification Banners</CardTitle>
        <CardDescription>
          Banners used to surface AI-powered features and insights. Uses the pastel palette to distinguish AI content from user-generated content.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Banner Icon */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">AI Banner Icon</h4>
          <div className="flex items-center gap-6 p-4 rounded-lg border bg-card">
            <img src={gioAiBannerIcon} alt="AI Banner Icon" className="h-12" />
            <div>
              <p className="text-sm font-medium">Gio AI Banner Icon</p>
              <p className="text-xs text-muted-foreground mt-1">
                Used in AI notification banners. Combines sparkles with the Gio mascot.
              </p>
            </div>
          </div>
        </div>

        {/* Lilac Banner — AI Analysis */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Lilac Banner — AI Analysis Available</h4>
          <div className="rounded-lg bg-pastel-purple/30 border border-pastel-purple/50 cursor-pointer hover:bg-pastel-purple/40 transition-colors">
            <div className="p-4 flex items-center gap-3">
              <img src={gioAvatar} alt="Gio" className="h-6 w-6 rounded-full shrink-0" />
              <span className="text-sm text-virgilio-purple font-semibold">AI Notes Analysis Available</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            <code>bg-pastel-purple/30</code> · <code>border-pastel-purple/50</code> · Used when AI draft scorecards are available for review.
          </p>
        </div>

        {/* Blue Banner — Background Enrichment */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Blue Banner — AI Enrichment</h4>
          {!dismissedEnrichment ? (
            <div className="bg-pastel-blue/20 border border-pastel-blue/40 rounded-lg p-3 flex items-center gap-3 animate-fade-in">
              <div className="flex-shrink-0">
                <Sparkles className="h-5 w-5 text-pastel-blue-foreground animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary">AI enrichment ready</p>
                <p className="text-xs text-text-secondary">
                  Full profile summary &amp; skills will be generated after you save.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDismissedEnrichment(true)}
                className="flex-shrink-0 h-7 w-7 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setDismissedEnrichment(false)}>
              Reset banner
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            <code>bg-pastel-blue/20</code> · <code>border-pastel-blue/40</code> · Dismissible. Used for background enrichment notifications.
          </p>
        </div>

        {/* Usage Guidelines */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Color Conventions</h4>
          <div className="p-4 rounded-lg border bg-muted/30">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="pb-2">Color</th>
                  <th className="pb-2">Token</th>
                  <th className="pb-2">Usage</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b">
                  <td className="py-2">
                    <span className="inline-block h-4 w-4 rounded bg-pastel-purple/30 border border-pastel-purple/50" />
                  </td>
                  <td><code>pastel-purple</code></td>
                  <td>AI analysis, suggested ratings, scorecard drafts</td>
                </tr>
                <tr>
                  <td className="py-2">
                    <span className="inline-block h-4 w-4 rounded bg-pastel-blue/20 border border-pastel-blue/40" />
                  </td>
                  <td><code>pastel-blue</code></td>
                  <td>AI enrichment, points to validate</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
