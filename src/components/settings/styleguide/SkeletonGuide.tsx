import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton, TableSkeleton, CardSkeleton, ListRowSkeleton } from '@/components/ui/skeleton'

export function SkeletonGuide() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Skeleton Loaders</CardTitle>
        <CardDescription>
          Loading placeholder components used while content is being fetched.
          All skeletons use a thin border container (<code>rounded-lg border bg-card</code>) for visual structure.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Bordered Skeleton Pattern */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Bordered Skeleton Pattern (Standard)</h4>
          <div className="p-4 rounded-lg border bg-muted/30">
            <p className="text-sm text-muted-foreground mb-3">
              <strong>Every skeleton group must be wrapped in a bordered container.</strong> This provides visual structure
              during loading and prevents skeletons from looking like floating blobs.
            </p>
            <pre className="text-xs text-muted-foreground overflow-x-auto">
{`// ✅ Correct — bordered container
<div className="rounded-lg border bg-card p-4 space-y-3">
  <Skeleton className="h-4 w-3/4" />
  <Skeleton className="h-4 w-1/2" />
</div>

// ❌ Wrong — bare skeletons without container
<div className="space-y-3">
  <Skeleton className="h-4 w-3/4" />
  <Skeleton className="h-4 w-1/2" />
</div>`}
            </pre>
          </div>
        </div>

        {/* Base Skeleton */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Base Skeleton</h4>
          <div className="rounded-lg border bg-card p-4 space-y-3">
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
          <h4 className="text-sm font-medium text-muted-foreground">List Row Skeleton</h4>
          <div className="p-4 rounded-lg border bg-muted/30">
            <ListRowSkeleton rows={3} />
            <p className="text-xs text-muted-foreground mt-4">
              <code>ListRowSkeleton</code> accepts a <code>rows</code> prop (default: 3).
              Each row has a bordered container with avatar + text pattern.
            </p>
            <pre className="text-xs text-muted-foreground mt-2">
{`import { ListRowSkeleton } from '@/components/ui/skeleton'

<ListRowSkeleton rows={3} />`}
            </pre>
          </div>
        </div>

        {/* Card Skeleton */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Card Skeleton</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CardSkeleton />
            <div className="p-4 rounded-lg border bg-muted/30">
              <p className="text-sm font-medium mb-2">Usage:</p>
              <pre className="text-xs text-muted-foreground">
{`import { CardSkeleton } from '@/components/ui/skeleton'

<CardSkeleton />`}
              </pre>
            </div>
          </div>
        </div>

        {/* Table Skeleton */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Table Skeleton</h4>
          <div className="p-4 rounded-lg border bg-muted/30">
            <TableSkeleton rows={3} />
            <p className="text-xs text-muted-foreground mt-4">
              <code>TableSkeleton</code> accepts a <code>rows</code> prop (default: 5).
              Each row is wrapped in a bordered container.
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
{`// Loading state — always wrap in bordered container
if (isLoading) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>My Card</CardTitle>
      </CardHeader>
      <CardContent>
        <ListRowSkeleton rows={3} />
      </CardContent>
    </Card>
  )
}

// Or use inline bordered skeleton groups:
<div className="rounded-lg border bg-card p-4 space-y-3">
  <Skeleton className="h-5 w-32" />
  <Skeleton className="h-4 w-full" />
  <Skeleton className="h-4 w-3/4" />
</div>`}
            </pre>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
