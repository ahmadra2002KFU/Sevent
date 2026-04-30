import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function Loading() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-8 sm:py-12">
      <Skeleton className="h-4 w-64" />
      <Card>
        <CardContent className="flex flex-col gap-5 p-0">
          <Skeleton className="h-48 w-full rounded-t-md sm:h-64" />
          <div className="flex flex-col gap-3 p-6">
            <div className="flex items-center gap-4">
              <Skeleton className="size-16 rounded-full" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-7 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <div className="flex flex-wrap gap-2 pt-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-7 w-24 rounded-full" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-6 w-40" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
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
      </div>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-6 w-40" />
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full rounded-md" />
          ))}
        </div>
      </div>
    </main>
  );
}
