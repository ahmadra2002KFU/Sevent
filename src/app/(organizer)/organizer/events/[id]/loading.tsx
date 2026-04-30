import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function Loading() {
  return (
    <section className="flex flex-col gap-6">
      <Skeleton className="h-8 w-28" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-7 w-72" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-32 rounded-full" />
        ))}
      </div>
      <Card>
        <CardHeader className="border-b pb-4">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="grid gap-x-8 gap-y-4 p-6 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="border-b pb-4">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="flex flex-col divide-y p-0">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-3 px-6 py-4">
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
