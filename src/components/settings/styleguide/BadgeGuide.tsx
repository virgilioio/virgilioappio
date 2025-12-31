import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function BadgeGuide() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Badges</CardTitle>
        <CardDescription>
          All badge variants for labels, tags, and status indicators
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Standard Variants */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Standard Variants</h4>
          <div className="flex flex-wrap gap-3">
            <div className="space-y-2 text-center">
              <Badge variant="default">Default</Badge>
              <p className="text-xs text-muted-foreground">default</p>
            </div>
            <div className="space-y-2 text-center">
              <Badge variant="secondary">Secondary</Badge>
              <p className="text-xs text-muted-foreground">secondary</p>
            </div>
            <div className="space-y-2 text-center">
              <Badge variant="outline">Outline</Badge>
              <p className="text-xs text-muted-foreground">outline</p>
            </div>
          </div>
        </div>

        {/* Semantic Variants */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Semantic Variants</h4>
          <div className="flex flex-wrap gap-3">
            <div className="space-y-2 text-center">
              <Badge variant="success">Success</Badge>
              <p className="text-xs text-muted-foreground">success</p>
            </div>
            <div className="space-y-2 text-center">
              <Badge variant="warning">Warning</Badge>
              <p className="text-xs text-muted-foreground">warning</p>
            </div>
            <div className="space-y-2 text-center">
              <Badge variant="info">Info</Badge>
              <p className="text-xs text-muted-foreground">info</p>
            </div>
            <div className="space-y-2 text-center">
              <Badge variant="destructive">Destructive</Badge>
              <p className="text-xs text-muted-foreground">destructive</p>
            </div>
          </div>
        </div>

        {/* Pastel Variants */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Pastel Variants</h4>
          <div className="flex flex-wrap gap-3">
            <div className="space-y-2 text-center">
              <Badge variant="pastel-blue">Pastel Blue</Badge>
              <p className="text-xs text-muted-foreground">pastel-blue</p>
            </div>
            <div className="space-y-2 text-center">
              <Badge variant="pastel-purple">Pastel Purple</Badge>
              <p className="text-xs text-muted-foreground">pastel-purple</p>
            </div>
            <div className="space-y-2 text-center">
              <Badge variant="pastel-green">Pastel Green</Badge>
              <p className="text-xs text-muted-foreground">pastel-green</p>
            </div>
            <div className="space-y-2 text-center">
              <Badge variant="pastel-pink">Pastel Pink</Badge>
              <p className="text-xs text-muted-foreground">pastel-pink</p>
            </div>
            <div className="space-y-2 text-center">
              <Badge variant="pastel-yellow">Pastel Yellow</Badge>
              <p className="text-xs text-muted-foreground">pastel-yellow</p>
            </div>
            <div className="space-y-2 text-center">
              <Badge variant="pastel-orange">Pastel Orange</Badge>
              <p className="text-xs text-muted-foreground">pastel-orange</p>
            </div>
          </div>
        </div>

        {/* Interactive Badge */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Interactive</h4>
          <div className="flex flex-wrap gap-3">
            <div className="space-y-2 text-center">
              <Badge interactive>Clickable</Badge>
              <p className="text-xs text-muted-foreground">interactive=true</p>
            </div>
            <div className="space-y-2 text-center">
              <Badge variant="pastel-purple" interactive>Clickable Pastel</Badge>
              <p className="text-xs text-muted-foreground">with hover effect</p>
            </div>
          </div>
        </div>

        {/* Usage Examples */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Common Usage</h4>
          <div className="p-4 rounded-lg border bg-card space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-sm">Status:</span>
              <Badge variant="success">Active</Badge>
              <Badge variant="warning">Pending</Badge>
              <Badge variant="destructive">Rejected</Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">Skills:</span>
              <Badge variant="pastel-blue">React</Badge>
              <Badge variant="pastel-purple">TypeScript</Badge>
              <Badge variant="pastel-green">Node.js</Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">Count:</span>
              <Badge variant="secondary">5 items</Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
