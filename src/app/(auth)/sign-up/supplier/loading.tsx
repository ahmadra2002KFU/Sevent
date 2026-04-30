import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="flex min-h-screen bg-neutral-50">
      <div className="hidden lg:flex lg:w-[44%] lg:flex-col lg:gap-6 lg:bg-brand-navy-900 lg:p-12">
        <Skeleton className="h-10 w-3/4 bg-white/10" />
        <Skeleton className="h-4 w-1/2 bg-white/10" />
        <div className="mt-6 flex flex-col gap-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-4 w-1/2 bg-white/10" />
              <Skeleton className="h-3 w-3/4 bg-white/10" />
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-1 justify-center overflow-y-auto px-6 py-10 sm:px-10 lg:py-20">
        <div className="w-full max-w-[420px]">
          <Skeleton className="mb-8 h-4 w-24" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-2 h-8 w-3/4" />
          <Skeleton className="mt-3 h-4 w-1/2" />
          <Skeleton className="mt-6 h-12 w-full rounded-md" />
          <div className="mt-8 flex flex-col gap-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
            ))}
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        </div>
      </div>
    </main>
  );
}
