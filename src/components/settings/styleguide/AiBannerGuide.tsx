import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import gioAiBannerIcon from '@/assets/gio-ai-banner-icon.png'

export function AiBannerGuide() {
  const [dismissedDismissable, setDismissedDismissable] = useState(false)

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Notification Banners</CardTitle>
        <CardDescription>
          A unified banner style for all AI-powered notifications. Uses the Gio AI icon, lilac background, and black text throughout.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Banner Icon */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">AI Banner Icon</h4>
          <div className="flex items-center gap-6 p-4 rounded-lg border bg-card">
            <img src={gioAiBannerIcon} alt="AI Banner Icon" className="h-14" />
            <div>
              <p className="text-sm font-medium">Gio AI Banner Icon</p>
              <p className="text-xs text-muted-foreground mt-1">
                Used in all AI notification banners. Combines sparkles with the Gio mascot.
              </p>
            </div>
          </div>
        </div>

        {/* Standard Banner */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Standard — Clickable</h4>
          <div className="rounded-lg bg-pastel-purple/30 border border-pastel-purple/50 cursor-pointer hover:bg-pastel-purple/40 transition-colors">
            <div className="p-3 flex items-center gap-3">
              <img src={gioAiBannerIcon} alt="Gio" className="h-10 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">AI Notes Analysis Available</p>
                <p className="text-xs text-muted-foreground">Click to review AI-generated insights</p>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            <code>bg-pastel-purple/30</code> · <code>border-pastel-purple/50</code> · Clickable, no dismiss. Used for AI analysis, scorecard drafts.
          </p>
        </div>

        {/* Dismissible Banner */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Dismissible</h4>
          {!dismissedDismissable ? (
            <div className="rounded-lg bg-pastel-purple/30 border border-pastel-purple/50 transition-colors animate-fade-in">
              <div className="p-3 flex items-center gap-3">
                <img src={gioAiBannerIcon} alt="Gio" className="h-10 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">AI enrichment ready</p>
                  <p className="text-xs text-muted-foreground">
                    Full profile summary &amp; skills will be generated after you save.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDismissedDismissable(true)}
                  className="flex-shrink-0 h-7 w-7 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setDismissedDismissable(false)}>
              Reset banner
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            Same style with a dismiss button. Used for enrichment notifications, transient AI updates.
          </p>
        </div>

        {/* Compact Banner */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Compact — Inline</h4>
          <div className="rounded-lg bg-pastel-purple/30 border border-pastel-purple/50 cursor-pointer hover:bg-pastel-purple/40 transition-colors">
            <div className="px-3 py-2 flex items-center gap-2">
              <img src={gioAiBannerIcon} alt="Gio" className="h-8 shrink-0" />
              <p className="text-sm font-semibold text-foreground">AI Suggested Rating</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Smaller padding, single-line. Used inside cards or tight layouts.
          </p>
        </div>

        {/* Structure Reference */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Banner Structure</h4>
          <div className="p-4 rounded-lg border bg-muted/30">
            <pre className="text-xs text-muted-foreground overflow-x-auto">
{`<div className="rounded-lg bg-pastel-purple/30 
  border border-pastel-purple/50 
  cursor-pointer hover:bg-pastel-purple/40 
  transition-colors">
  <div className="p-3 flex items-center gap-3">
    <img src={gioAiBannerIcon} className="h-10 shrink-0" />
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-foreground">
        Title
      </p>
      <p className="text-xs text-muted-foreground">
        Subtext
      </p>
    </div>
  </div>
</div>`}
            </pre>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
