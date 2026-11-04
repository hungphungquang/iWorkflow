import { Suspense } from "react";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex h-screen bg-slate-50">
      {/* usePathname suspends on routes with request-time params (e.g. /4m/cases/[code]) under cacheComponents. */}
      <Suspense fallback={<aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white md:block" />}>
        <Sidebar />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
