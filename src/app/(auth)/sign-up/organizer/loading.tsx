import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function Loading() {
  return (
    <main className="flex min-h-screen bg-neutral-50">
      <div className="hidden lg:flex lg:w-[44%] lg:flex-col lg:gap-6 lg:bg-brand-navy-900 lg:p-12">
        <Skeleton className="h-8 w-32 bg-white/10" />
        <Skeleton className="h-10 w-3/4 bg-white/10" />
        <Skeleton className="h-4 w-2/3 bg-white/10" />
        <div className="mt-6 flex flex-col gap-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="size-10 rounded-md bg-white/10" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-1/2 bg-white/10" />
                <Skeleton className="h-3 w-3/4 bg-white/10" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-1 justify-center overflow-y-auto px-6 py-12 lg:py-16">
        <div className="w-full max-w-md">
          <Skeleton className="mb-6 h-4 w-24" />
          <Card className="border-border bg-card shadow-brand">
            <CardHeader className="flex flex-col items-start gap-2 pb-2">
              <Skeleton className="h-7 w-56" />
              <Skeleton className="h-4 w-72" />
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <Skeleton className="h-12 w-full rounded-md" />
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full rounded-md" />
                </div>
              ))}
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="mx-auto h-4 w-48" />
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
