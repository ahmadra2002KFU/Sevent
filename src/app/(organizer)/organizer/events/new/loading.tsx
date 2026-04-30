import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function Loading() {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Skeleton className="h-8 w-28" />
      <div className="flex flex-col gap-2 border-b pb-5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-2/3" />
      </div>
      <Card>
        <CardContent className="flex flex-col gap-5 p-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          ))}
          <div className="flex justify-end pt-2">
            <Skeleton className="h-10 w-32 rounded-md" />
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
