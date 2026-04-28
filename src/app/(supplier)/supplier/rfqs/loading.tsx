import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function Loading() {
  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-9 w-32 rounded-md" />
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
