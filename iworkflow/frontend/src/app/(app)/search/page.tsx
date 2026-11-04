import { Suspense } from "react";
import { SearchPage } from "./search-page";

export default function FullTextSearchPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Đang tải…</p>}>
      <SearchPage />
    </Suspense>
  );
}
