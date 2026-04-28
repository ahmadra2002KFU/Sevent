import { TopNav } from "@/components/nav/TopNav";
import FeedbackWidgetLazy from "@/components/feedback/FeedbackWidgetLazy";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <TopNav role="admin" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        {children}
      </main>
      <FeedbackWidgetLazy />
    </div>
  );
}
