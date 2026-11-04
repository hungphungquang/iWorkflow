import { Suspense } from "react";
import { CaseList } from "./case-list";

export default function FourMCasesPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Đang tải danh sách…</p>}>
      <CaseList />
    </Suspense>
  );
}
