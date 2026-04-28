import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function Loading() {
  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-72" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      {Array.from({ length: 3 }).map((_, sec) => (
        <Card key={sec}>
          <CardHeader className="border-b pb-4">
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="flex flex-col gap-3 p-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
