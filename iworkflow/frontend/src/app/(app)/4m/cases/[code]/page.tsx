import { Suspense } from "react";
import { CaseDetail } from "./case-detail";

export default function FourMCasePage({ params }: { params: Promise<{ code: string }> }) {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Đang tải hồ sơ…</p>}>
      <CaseDetail params={params} />
    </Suspense>
  );
}
