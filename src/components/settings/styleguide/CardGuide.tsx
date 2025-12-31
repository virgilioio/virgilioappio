import React from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function CardGuide() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cards</CardTitle>
        <CardDescription>
          Card components with various layouts and the signature CardTitle with purple period
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
