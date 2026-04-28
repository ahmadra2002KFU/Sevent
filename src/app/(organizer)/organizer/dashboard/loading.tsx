import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function Loading() {
  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
              <Skeleton className="mt-2 h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Card>
          <CardHeader className="border-b pb-4">
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent className="flex flex-col gap-4 p-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="border-b pb-4">
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent className="flex flex-col gap-3 p-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-10 rounded-lg" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
