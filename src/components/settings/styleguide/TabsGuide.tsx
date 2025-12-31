import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function TabsGuide() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tabs</CardTitle>
        <CardDescription>
          Tab navigation components for organizing content into sections
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Basic Tabs */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Basic Tabs</h4>
          <div className="p-4 rounded-lg border bg-card">
            <Tabs defaultValue="tab1">
              <TabsList>
                <TabsTrigger value="tab1">First Tab</TabsTrigger>
                <TabsTrigger value="tab2">Second Tab</TabsTrigger>
                <TabsTrigger value="tab3">Third Tab</TabsTrigger>
              </TabsList>
              <TabsContent value="tab1" className="mt-4">
                <p className="text-sm text-muted-foreground">Content for the first tab goes here.</p>
              </TabsContent>
              <TabsContent value="tab2" className="mt-4">
                <p className="text-sm text-muted-foreground">Content for the second tab.</p>
              </TabsContent>
              <TabsContent value="tab3" className="mt-4">
                <p className="text-sm text-muted-foreground">Content for the third tab.</p>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Full Width Tabs */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Full Width Grid</h4>
          <div className="p-4 rounded-lg border bg-card">
            <Tabs defaultValue="overview">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="analytics">Analytics</TabsTrigger>
                <TabsTrigger value="reports">Reports</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>
              <TabsContent value="overview" className="mt-4">
                <p className="text-sm text-muted-foreground">Overview content with grid-cols-4 layout.</p>
              </TabsContent>
              <TabsContent value="analytics" className="mt-4">
                <p className="text-sm text-muted-foreground">Analytics dashboard content.</p>
              </TabsContent>
              <TabsContent value="reports" className="mt-4">
                <p className="text-sm text-muted-foreground">Reports section content.</p>
              </TabsContent>
              <TabsContent value="settings" className="mt-4">
                <p className="text-sm text-muted-foreground">Settings panel content.</p>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Tab States */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Tab States</h4>
          <div className="p-4 rounded-lg border bg-muted/30 space-y-2">
            <p className="text-sm"><strong>Default:</strong> Muted background, normal text</p>
            <p className="text-sm"><strong>Hover:</strong> Slightly elevated background</p>
            <p className="text-sm"><strong>Active:</strong> White background with shadow, primary text</p>
            <p className="text-sm"><strong>Disabled:</strong> Reduced opacity, no interaction</p>
          </div>
        </div>

        {/* Usage Notes */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Usage Notes</h4>
          <div className="p-4 rounded-lg border bg-muted/30">
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Use <code>grid-cols-N</code> for equal-width tabs</li>
              <li>TabsList has rounded corners and subtle shadow</li>
              <li>TabsTrigger transitions smoothly between states</li>
              <li>TabsContent mounts lazily by default</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
