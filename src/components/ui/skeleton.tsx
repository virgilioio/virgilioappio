
import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-lg bg-virgilio-border/30", className)}
      {...props}
    />
  )
}

// Pre-built skeleton components for common use cases
function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center space-x-4 h-[52px]">
          <Skeleton className="h-10 w-[150px]" />
          <Skeleton className="h-10 w-[200px]" />
          <Skeleton className="h-10 w-[100px]" />
          <Skeleton className="h-10 w-[80px]" />
          <Skeleton className="h-10 w-[60px]" />
        </div>
      ))}
    </div>
  )
}

function CardSkeleton() {
  return (
    <div className="p-6 space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-6 w-[250px]" />
        <Skeleton className="h-4 w-[200px]" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-[300px]" />
        <Skeleton className="h-4 w-[150px]" />
      </div>
    </div>
  )
}

export { Skeleton, TableSkeleton, CardSkeleton }
