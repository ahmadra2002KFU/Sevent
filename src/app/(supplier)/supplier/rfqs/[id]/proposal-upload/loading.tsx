import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function Loading() {
  return (
    <section className="flex flex-col gap-6">
      <Skeleton className="h-8 w-28" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Card>
        <CardHeader className="border-b pb-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-2 h-4 w-2/3" />
        </CardHeader>
        <CardContent className="flex flex-col gap-5 p-6">
          <Skeleton className="h-32 w-full rounded-md" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-24 w-full rounded-md" />
          </div>
          <div className="flex justify-end gap-2">
            <Skeleton className="h-10 w-28 rounded-md" />
            <Skeleton className="h-10 w-36 rounded-md" />
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
