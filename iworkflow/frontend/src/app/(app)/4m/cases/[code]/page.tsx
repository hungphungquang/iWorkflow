import { Suspense } from "react";
import { CaseLoading } from "@/components/fourm-ui";
import { CaseDetail } from "./case-detail";

export default function FourMCasePage({ params }: { params: Promise<{ code: string }> }) {
  return (
    <Suspense fallback={<CaseLoading />}>
      <CaseDetail params={params} />
    </Suspense>
  );
}
