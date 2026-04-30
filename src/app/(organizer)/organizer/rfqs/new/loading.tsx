import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function Loading() {
  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-72" />
      </header>
      <div className="flex flex-wrap gap-2 rounded-xl border bg-card p-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 flex-1 rounded-lg" />
        ))}
      </div>
      <Card>
        <CardContent className="flex flex-col gap-5 p-6">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          ))}
        </CardContent>
      </Card>
      <footer className="flex items-center justify-between border-t pt-5">
        <Skeleton className="h-10 w-28 rounded-md" />
        <Skeleton className="h-10 w-32 rounded-md" />
      </footer>
    </section>
  );
}
