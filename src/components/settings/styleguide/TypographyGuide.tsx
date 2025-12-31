import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function TypographyGuide() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Typography</CardTitle>
        <CardDescription>
          Font families, type scale, and heading styles with the signature purple period
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Font Families */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Font Families</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg border bg-card">
              <p className="font-heading text-2xl mb-2">Poppins</p>
              <p className="text-sm text-muted-foreground">Headings and display text</p>
              <code className="text-xs text-muted-foreground">font-heading</code>
            </div>
            <div className="p-4 rounded-lg border bg-card">
              <p className="font-sans text-2xl mb-2">Inter</p>
              <p className="text-sm text-muted-foreground">Body text and UI elements</p>
              <code className="text-xs text-muted-foreground">font-sans</code>
            </div>
          </div>
        </div>

        {/* Headings with Purple Period */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Headings (with Purple Period)</h4>
          <div className="space-y-4 p-4 rounded-lg border bg-card">
            <div>
              <h1 className="text-4xl font-heading font-semibold">
                Heading 1<span className="text-primary">.</span>
              </h1>
              <code className="text-xs text-muted-foreground">text-4xl font-heading font-semibold</code>
            </div>
            <div>
              <h2 className="text-3xl font-heading font-semibold">
                Heading 2<span className="text-primary">.</span>
              </h2>
              <code className="text-xs text-muted-foreground">text-3xl font-heading font-semibold</code>
            </div>
            <div>
              <h3 className="text-2xl font-heading font-semibold">
                Heading 3<span className="text-primary">.</span>
              </h3>
              <code className="text-xs text-muted-foreground">text-2xl font-heading font-semibold</code>
            </div>
            <div>
              <h4 className="text-xl font-heading font-medium">
                Heading 4<span className="text-primary">.</span>
              </h4>
              <code className="text-xs text-muted-foreground">text-xl font-heading font-medium</code>
            </div>
            <div>
              <h5 className="text-lg font-heading font-medium">
                Heading 5<span className="text-primary">.</span>
              </h5>
              <code className="text-xs text-muted-foreground">text-lg font-heading font-medium</code>
            </div>
          </div>
        </div>

        {/* Type Scale */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Type Scale</h4>
          <div className="space-y-3 p-4 rounded-lg border bg-card">
            {[
              { size: 'text-xs', label: 'Extra Small (12px)' },
              { size: 'text-sm', label: 'Small (14px)' },
              { size: 'text-base', label: 'Base (16px)' },
              { size: 'text-lg', label: 'Large (18px)' },
              { size: 'text-xl', label: 'Extra Large (20px)' },
              { size: 'text-2xl', label: '2XL (24px)' },
              { size: 'text-3xl', label: '3XL (30px)' },
              { size: 'text-4xl', label: '4XL (36px)' },
            ].map(({ size, label }) => (
              <div key={size} className="flex items-baseline gap-4">
                <code className="text-xs text-muted-foreground w-20">{size}</code>
                <p className={size}>The quick brown fox jumps over the lazy dog</p>
              </div>
            ))}
          </div>
        </div>

        {/* Text Colors */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Text Hierarchy</h4>
          <div className="space-y-2 p-4 rounded-lg border bg-card">
            <p className="text-foreground">Primary text - text-foreground</p>
            <p className="text-muted-foreground">Secondary text - text-muted-foreground</p>
            <p className="text-primary">Accent text - text-primary</p>
            <p className="text-success">Success text - text-success</p>
            <p className="text-warning">Warning text - text-warning</p>
            <p className="text-destructive">Destructive text - text-destructive</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
