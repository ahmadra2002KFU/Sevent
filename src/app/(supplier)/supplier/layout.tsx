import { TopNav } from "@/components/nav/TopNav";
import { FeedbackWidget } from "@/components/feedback/FeedbackWidget";

export default function SupplierLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <TopNav role="supplier" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        {children}
      </main>
      <FeedbackWidget />
    </div>
  );
}
