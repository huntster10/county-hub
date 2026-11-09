import { Skeleton } from "@/components/ui/skeleton";

/** Shown instantly while a page's data loads. */
export default function Loading() {
  return (
    <div className="space-y-4 p-4 md:p-6">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-80" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}
