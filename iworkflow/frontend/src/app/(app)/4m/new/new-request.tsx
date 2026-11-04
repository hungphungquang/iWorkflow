"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { blankRequest, FourMRequestForm } from "@/components/fourm-request-form";
import { PageHeader, WireNote } from "@/components/ui";
import { submitNew, useMe } from "@/lib/store";

export function NewRequest() {
  const router = useRouter();
  const me = useMe();
  return (
    <>
      <Link href="/4m/cases" className="mb-3 inline-flex text-xs text-slate-500 hover:text-slate-800">
        ‹ Hồ sơ & việc 4M
      </Link>
      <PageHeader title="Yêu cầu thay đổi 4M" description="Before 4M Change · Process4MChange v12 · Man, Machine, Material, Method" />
      <FourMRequestForm
        key={me.id}
        initial={blankRequest()}
        section={me.section}
        requesterName={me.name}
        submitLabel="Gửi yêu cầu"
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
