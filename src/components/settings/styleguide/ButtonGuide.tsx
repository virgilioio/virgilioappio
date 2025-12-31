import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Mail, Loader2 } from 'lucide-react'

export function ButtonGuide() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Buttons</CardTitle>
        <CardDescription>
          All button variants, sizes, and states available in the design system
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Primary Variants */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Variants</h4>
          <div className="flex flex-wrap gap-3">
            <div className="space-y-2 text-center">
              <Button variant="default">Default</Button>
              <p className="text-xs text-muted-foreground">default</p>
            </div>
            <div className="space-y-2 text-center">
              <Button variant="secondary">Secondary</Button>
              <p className="text-xs text-muted-foreground">secondary</p>
            </div>
            <div className="space-y-2 text-center">
              <Button variant="outline">Outline</Button>
              <p className="text-xs text-muted-foreground">outline</p>
            </div>
            <div className="space-y-2 text-center">
              <Button variant="ghost">Ghost</Button>
              <p className="text-xs text-muted-foreground">ghost</p>
            </div>
            <div className="space-y-2 text-center">
              <Button variant="link">Link</Button>
              <p className="text-xs text-muted-foreground">link</p>
            </div>
          </div>
        </div>

        {/* Semantic Variants */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Semantic Variants</h4>
          <div className="flex flex-wrap gap-3">
            <div className="space-y-2 text-center">
              <Button variant="destructive">Destructive</Button>
              <p className="text-xs text-muted-foreground">destructive</p>
            </div>
            <div className="space-y-2 text-center">
              <Button variant="success">Success</Button>
              <p className="text-xs text-muted-foreground">success</p>
            </div>
            <div className="space-y-2 text-center">
              <Button variant="warning">Warning</Button>
              <p className="text-xs text-muted-foreground">warning</p>
            </div>
            <div className="space-y-2 text-center">
              <Button variant="info">Info</Button>
              <p className="text-xs text-muted-foreground">info</p>
            </div>
            <div className="space-y-2 text-center">
              <Button variant="virgilio">Virgilio</Button>
              <p className="text-xs text-muted-foreground">virgilio</p>
            </div>
          </div>
        </div>

        {/* Sizes */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Sizes</h4>
          <div className="flex flex-wrap items-center gap-3">
            <div className="space-y-2 text-center">
              <Button size="sm">Small</Button>
              <p className="text-xs text-muted-foreground">sm</p>
            </div>
            <div className="space-y-2 text-center">
              <Button size="default">Default</Button>
              <p className="text-xs text-muted-foreground">default</p>
            </div>
            <div className="space-y-2 text-center">
              <Button size="lg">Large</Button>
              <p className="text-xs text-muted-foreground">lg</p>
            </div>
            <div className="space-y-2 text-center">
              <Button size="icon"><Plus className="h-4 w-4" /></Button>
              <p className="text-xs text-muted-foreground">icon</p>
            </div>
          </div>
        </div>

        {/* With Icons */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">With Icons</h4>
          <div className="flex flex-wrap gap-3">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
            <Button variant="outline">
              <Mail className="h-4 w-4 mr-2" />
              Send Email
            </Button>
            <Button variant="secondary">
              Download
              <Plus className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>

        {/* States */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">States</h4>
          <div className="flex flex-wrap gap-3">
            <div className="space-y-2 text-center">
              <Button>Normal</Button>
              <p className="text-xs text-muted-foreground">normal</p>
            </div>
            <div className="space-y-2 text-center">
              <Button disabled>Disabled</Button>
              <p className="text-xs text-muted-foreground">disabled</p>
            </div>
            <div className="space-y-2 text-center">
              <Button loading>Loading</Button>
              <p className="text-xs text-muted-foreground">loading</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
