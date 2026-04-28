import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function Loading() {
  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-32 rounded-md" />
      </div>
      <Card>
        <CardContent className="flex flex-col divide-y p-0">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
