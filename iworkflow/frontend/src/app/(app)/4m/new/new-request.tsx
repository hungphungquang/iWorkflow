"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { blankRequest, FourMRequestForm } from "@/components/fourm-request-form";
import { PageHeader, WireNote } from "@/components/ui";
import { common, useLocale, useMessages, type Locale } from "@/lib/i18n";
import { READ_ONLY, submitNew, useMe } from "@/lib/store";

const vi = {
  title: "Yêu cầu thay đổi 4M",
  submit: "Gửi yêu cầu",
};
const M = {
  vi,
  en: {
    title: "4M change request",
    submit: "Submit request",
  },
} satisfies Record<Locale, typeof vi>;

export function NewRequest() {
  const t = useMessages(M);
  const nav = common[useLocale()].nav;
  const router = useRouter();
  const me = useMe();
  if (READ_ONLY) {
    return (
      <>
        <Link href="/4m/cases" className="mb-3 inline-flex text-xs text-slate-500 hover:text-slate-800">
          ‹ {nav.cases4m}
        </Link>
        <PageHeader title={t.title} description="Before 4M Change · Process4MChange v12" />
        <WireNote>Bản xem trước đang đọc dữ liệu iw_prod ở chế độ chỉ đọc nên không tạo hồ sơ mới. Hãy tạo đề nghị 4M trên iWorkflow hiện tại.</WireNote>
      </>
    );
  }
  return (
    <>
      <Link href="/4m/cases" className="mb-3 inline-flex text-xs text-slate-500 hover:text-slate-800">
        ‹ {nav.cases4m}
      </Link>
      <PageHeader title={t.title} description="Before 4M Change · Process4MChange v12 · Man, Machine, Material, Method" />
      <FourMRequestForm
        key={me.id}
        initial={blankRequest()}
        section={me.section}
        requesterName={me.name}
        submitLabel={t.submit}
        onSubmit={(data, files) => {
          const code = submitNew(data, files);
          router.push(`/4m/cases/${code}`);
        }}
      />
      <div className="mt-4">
        <WireNote>
          Trường và bảng con giữ đúng biểu mẫu P4MForm_Request_BTMV trên prod. Người nhận tính từ HT_DONVI (người đại diện / lãnh đạo đại diện) của đơn vị người đang đăng nhập – đổi vai ở góc phải để tạo hồ sơ từ đơn vị khác.
        </WireNote>
      </div>
    </>
  );
}
