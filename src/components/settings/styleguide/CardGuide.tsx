import React from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronRight, Clock, Users, Briefcase } from 'lucide-react'
import { cn } from '@/lib/utils'

export function CardGuide() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cards</CardTitle>
        <CardDescription>
          Card components with various layouts, row patterns, and the signature CardTitle with purple period
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Basic Cards */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Card Layouts</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Basic Card */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Card</CardTitle>
                <CardDescription>With header and content</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  This is a basic card with a title that includes the purple period.
                </p>
              </CardContent>
            </Card>

            {/* Card with Footer */}
            <Card>
              <CardHeader>
                <CardTitle>Card with Footer</CardTitle>
                <CardDescription>Includes action buttons</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Cards can include a footer for actions.
                </p>
              </CardContent>
              <CardFooter className="flex justify-end gap-2">
                <Button variant="outline" size="sm">Cancel</Button>
                <Button size="sm">Save</Button>
              </CardFooter>
            </Card>

            {/* Interactive Card */}
            <Card hover interactive>
              <CardHeader>
                <CardTitle>Interactive Card</CardTitle>
                <CardDescription>With hover effect</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  This card has hover and focus states. Try hovering over it!
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Card Row Patterns */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Card Row Patterns (Dashboard Style)</h4>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Standard Row */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Standard Rows</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {/* Default Row */}
                <button className="w-full text-left p-3 rounded-lg border border-border bg-card hover:bg-accent hover:border-accent-foreground/20 transition-all">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium truncate block">Row Title</span>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>Subtitle text</span>
                        <span>•</span>
                        <span>Additional info</span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                  </div>
                </button>

                {/* Row with Icon */}
                <button className="w-full text-left p-3 rounded-lg border border-border bg-card hover:bg-accent hover:border-accent-foreground/20 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Briefcase className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium truncate block">Row with Icon</span>
                      <span className="text-xs text-muted-foreground">Supporting text</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </div>
                </button>

                {/* Row with Badge */}
                <button className="w-full text-left p-3 rounded-lg border border-border bg-card hover:bg-accent hover:border-accent-foreground/20 transition-all">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">Row with Badge</span>
                        <Badge variant="success" className="text-[10px]">Active</Badge>
                      </div>
                      <span className="text-xs text-muted-foreground mt-1 block">Description here</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                  </div>
                </button>
              </CardContent>
            </Card>

            {/* Urgency Row States */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Urgency States</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {/* Normal State */}
                <button className="w-full text-left p-3 rounded-lg border border-border bg-card transition-all">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium">Normal State</span>
                      <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>2 days ago</span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                  </div>
                </button>

                {/* Warning State */}
                <button className="w-full text-left p-3 rounded-lg border border-warning/50 bg-warning/5 transition-all">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium">Warning State</span>
                      <div className="flex items-center gap-1 mt-1.5 text-xs text-warning font-medium">
                        <Clock className="h-3 w-3" />
                        <span>7 days in stage</span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                  </div>
                </button>

                {/* Critical State */}
                <button className="w-full text-left p-3 rounded-lg border border-destructive/50 bg-destructive/5 transition-all">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium">Critical State</span>
                      <div className="flex items-center gap-1 mt-1.5 text-xs text-destructive font-medium">
                        <Clock className="h-3 w-3" />
                        <span>14+ days in stage</span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                  </div>
                </button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Row Pattern Code Reference */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Row Pattern Structure</h4>
          <div className="p-4 rounded-lg border bg-muted/30">
            <pre className="text-xs text-muted-foreground overflow-x-auto">
{`<button className="w-full text-left p-3 rounded-lg border 
  border-border bg-card hover:bg-accent 
  hover:border-accent-foreground/20 transition-all">
  <div className="flex items-start justify-between gap-2">
    <div className="flex-1 min-w-0">
      <span className="text-sm font-medium truncate">Title</span>
      <span className="text-xs text-muted-foreground">Subtitle</span>
    </div>
    <ChevronRight className="h-4 w-4 text-muted-foreground" />
  </div>
</button>`}
            </pre>
          </div>
        </div>

        {/* Card Title Variations */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">CardTitle with Period</h4>
          <div className="p-4 rounded-lg border bg-card space-y-4">
            <div>
              <CardTitle>Default CardTitle</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Uses withPeriod=true by default, adds purple period at end
              </p>
            </div>
            <div>
              <CardTitle withPeriod={false}>CardTitle without Period</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Set withPeriod=false to disable the period
              </p>
            </div>
          </div>
        </div>

        {/* Card Props */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Card Props</h4>
          <div className="p-4 rounded-lg border bg-muted/30">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="pb-2">Prop</th>
                  <th className="pb-2">Type</th>
                  <th className="pb-2">Description</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b">
                  <td className="py-2"><code>hover</code></td>
                  <td>boolean</td>
                  <td>Adds hover shadow effect</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2"><code>interactive</code></td>
                  <td>boolean</td>
                  <td>Adds cursor pointer and focus ring</td>
                </tr>
                <tr>
                  <td className="py-2"><code>withPeriod</code></td>
                  <td>boolean</td>
                  <td>CardTitle: adds purple period (default: true)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
