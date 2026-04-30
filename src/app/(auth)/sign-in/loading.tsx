import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function Loading() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-6 py-12">
      <div className="w-full max-w-md">
        <Skeleton className="mb-6 h-4 w-24" />
        <Card className="border-border bg-card shadow-brand">
          <CardHeader className="flex flex-col items-start gap-4 pb-2">
            <Skeleton className="h-7 w-32" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="mx-auto h-4 w-48" />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
