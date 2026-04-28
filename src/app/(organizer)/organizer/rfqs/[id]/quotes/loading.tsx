import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function Loading() {
  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-7 w-64" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, col) => (
          <Card key={col}>
            <CardHeader className="flex flex-row items-center gap-3 border-b pb-4">
              <Skeleton className="size-10 rounded-md" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 p-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
              <Skeleton className="mt-2 h-9 w-full rounded-md" />
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
