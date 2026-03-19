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

        {/* Role Badges */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Role Badges</h4>
          <p className="text-xs text-muted-foreground">Used in Team Members table to identify member roles</p>
          <div className="flex flex-wrap gap-3">
            <div className="space-y-2 text-center">
              <Badge variant="role-owner">Owner</Badge>
              <p className="text-xs text-muted-foreground">role-owner</p>
            </div>
            <div className="space-y-2 text-center">
              <Badge variant="role-admin">Admin</Badge>
              <p className="text-xs text-muted-foreground">role-admin</p>
            </div>
            <div className="space-y-2 text-center">
              <Badge variant="role-recruiter">Recruiter</Badge>
              <p className="text-xs text-muted-foreground">role-recruiter</p>
            </div>
            <div className="space-y-2 text-center">
              <Badge variant="role-hiring-manager">Hiring Manager</Badge>
              <p className="text-xs text-muted-foreground">role-hiring-manager</p>
            </div>
            <div className="space-y-2 text-center">
              <Badge variant="role-interviewer">Interviewer</Badge>
              <p className="text-xs text-muted-foreground">role-interviewer</p>
            </div>
          </div>
        </div>

        {/* Seat & Status Badges */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Seat & Status Badges</h4>
          <p className="text-xs text-muted-foreground">Used for billing seat types and member activity status</p>
          <div className="flex flex-wrap gap-3">
            <div className="space-y-2 text-center">
              <Badge variant="seat-paid">Paid Seat</Badge>
              <p className="text-xs text-muted-foreground">seat-paid</p>
            </div>
            <div className="space-y-2 text-center">
              <Badge variant="seat-free">Free Seat</Badge>
              <p className="text-xs text-muted-foreground">seat-free</p>
            </div>
            <div className="space-y-2 text-center">
              <Badge variant="status-active">Active</Badge>
              <p className="text-xs text-muted-foreground">status-active</p>
            </div>
            <div className="space-y-2 text-center">
              <Badge variant="status-invited">Invited</Badge>
              <p className="text-xs text-muted-foreground">status-invited</p>
            </div>
            <div className="space-y-2 text-center">
              <Badge variant="status-inactive">Inactive</Badge>
              <p className="text-xs text-muted-foreground">status-inactive</p>
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
              <span className="text-sm">Team Roles:</span>
              <Badge variant="role-owner">Owner</Badge>
              <Badge variant="role-admin">Admin</Badge>
              <Badge variant="role-recruiter">Recruiter</Badge>
              <Badge variant="role-hiring-manager">Hiring Manager</Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">Seats:</span>
              <Badge variant="seat-paid">Paid</Badge>
              <Badge variant="seat-free">Free</Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">Status:</span>
              <Badge variant="status-active">Active</Badge>
              <Badge variant="status-invited">Invited</Badge>
              <Badge variant="status-inactive">Inactive</Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">Skills:</span>
              <Badge variant="pastel-blue">React</Badge>
              <Badge variant="pastel-purple">TypeScript</Badge>
              <Badge variant="pastel-green">Node.js</Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
