import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton, TableSkeleton, CardSkeleton } from '@/components/ui/skeleton'

export function SkeletonGuide() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Skeleton Loaders</CardTitle>
        <CardDescription>
          Loading placeholder components used while content is being fetched
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Base Skeleton */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Base Skeleton</h4>
          <div className="p-4 rounded-lg border bg-card space-y-3">
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Base skeleton with animate-pulse effect. Use varying widths for natural appearance.
            </p>
          </div>
        </div>

        {/* List Row Skeleton */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">List Row Skeleton (Dashboard Pattern)</h4>
          <div className="p-4 rounded-lg border bg-card">
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Used for dashboard card rows with avatar/icon + text pattern.
            </p>
          </div>
        </div>

        {/* Simple Row Skeleton */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Simple Row Skeleton</h4>
          <div className="p-4 rounded-lg border bg-card">
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Simple full-width bars for interview/event lists.
            </p>
          </div>
        </div>

        {/* Card Skeleton */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Card Skeleton</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardSkeleton />
            </Card>
            <div className="p-4 rounded-lg border bg-muted/30">
              <p className="text-sm font-medium mb-2">Usage:</p>
              <pre className="text-xs text-muted-foreground">
{`import { CardSkeleton } from '@/components/ui/skeleton'

<Card>
  <CardSkeleton />
</Card>`}
              </pre>
            </div>
          </div>
        </div>

        {/* Table Skeleton */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Table Skeleton</h4>
          <div className="p-4 rounded-lg border bg-card">
            <TableSkeleton rows={3} />
            <p className="text-xs text-muted-foreground mt-4">
              <code>TableSkeleton</code> accepts a <code>rows</code> prop (default: 5)
            </p>
          </div>
        </div>

        {/* Skeleton Shapes */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Skeleton Shapes</h4>
          <div className="p-4 rounded-lg border bg-card">
            <div className="flex flex-wrap items-center gap-4">
              <div className="text-center">
                <Skeleton className="h-12 w-12 rounded-full" />
                <p className="text-xs text-muted-foreground mt-2">Circle</p>
              </div>
              <div className="text-center">
                <Skeleton className="h-12 w-12 rounded-lg" />
                <p className="text-xs text-muted-foreground mt-2">Square</p>
              </div>
              <div className="text-center">
                <Skeleton className="h-4 w-24" />
                <p className="text-xs text-muted-foreground mt-2">Line</p>
              </div>
              <div className="text-center">
                <Skeleton className="h-24 w-32 rounded-lg" />
                <p className="text-xs text-muted-foreground mt-2">Rectangle</p>
              </div>
            </div>
          </div>
        </div>

        {/* Code Example */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Implementation Pattern</h4>
          <div className="p-4 rounded-lg border bg-muted/30">
            <pre className="text-xs text-muted-foreground overflow-x-auto">
{`// Loading state check
if (isLoading) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>My Card</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}`}
            </pre>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
