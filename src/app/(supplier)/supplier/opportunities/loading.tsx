import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function Loading() {
  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Card>
        <CardContent className="flex flex-wrap gap-3 p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-32 rounded-md" />
          ))}
        </CardContent>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="mt-2 h-3 w-1/2" />
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="mt-2 h-9 w-full rounded-md" />
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
