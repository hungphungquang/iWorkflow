"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";
import { CaseStateBadge, Highlight, VersionTag } from "@/components/fourm-ui";
import { Badge, Card, PageHeader, SourceBadge, WireNote, inputClass } from "@/components/ui";
import { caseState, currentStepLabel, fold, PROCESS_KEY, PROCESS_NAME, searchCase, sectionShort, type SearchHit } from "@/lib/fourm-case";
import { fmtDate } from "@/lib/i18n";
import { processByKey, tasks } from "@/lib/mock";
import { personName } from "@/lib/people";
import { useDb } from "@/lib/store";

type Scope = "all" | "running" | "finished";
const scopes: [Scope, string][] = [
  ["all", "Tất cả"],
  ["running", "Đang chạy"],
  ["finished", "Đã kết thúc"],
];
const samples = ["con lăn", "than đen", "IATF", "Sato", "dau thuy luc", "RFID", "khuôn 17 inch"];

function markText(raw: string, q: string): SearchHit["parts"] {
  const text = raw.normalize("NFC");
  const terms = fold(q).split(/\s+/).filter(Boolean);
  const folded = fold(text);
  const mark = new Array(text.length).fill(false);
  terms.forEach((t) => {
    for (let i = folded.indexOf(t); i >= 0; i = folded.indexOf(t, i + 1)) for (let k = i; k < i + t.length; k++) mark[k] = true;
  });
  const parts: SearchHit["parts"] = [];
  for (let k = 0; k < text.length; k++) {
    const last = parts[parts.length - 1];
    if (last && last.hit === mark[k]) last.text += text[k];
    else parts.push({ text: text[k], hit: mark[k] });
  }
  return parts;
}

function Marked({ text, q }: { text: string; q: string }) {
  return (
    <>
      {markText(text, q).map((p, i) =>
        p.hit ? (
          <mark key={i} className="rounded bg-yellow-200 px-0.5 text-slate-900">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

export function SearchPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const q = sp.get("q") ?? "";
  const scope = (sp.get("scope") as Scope) || "all";
  const [text, setText] = useState(q);
  const [prevQ, setPrevQ] = useState(q);
  const { cases } = useDb();

  if (q !== prevQ) {
    setPrevQ(q);
    setText(q);
  }

  const go = (next: { q?: string; scope?: Scope }) => {
    const p = new URLSearchParams(sp.toString());
    if (next.q !== undefined) {
      if (next.q) p.set("q", next.q);
      else p.delete("q");
    }
    if (next.scope) {
      if (next.scope === "all") p.delete("scope");
      else p.set("scope", next.scope);
    }
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  };

  const inScope = (running: boolean) => scope === "all" || (scope === "running") === running;
  const fourm = q.trim()
    ? cases
        .map((c) => ({ c, hits: searchCase(c, q) }))
        .filter((x): x is { c: (typeof cases)[number]; hits: SearchHit[] } => x.hits !== null && inScope(caseState(x.c) === "running"))
        .sort((a, b) => b.hits.length - a.hits.length || b.c.updatedAt.localeCompare(a.c.updatedAt))
    : [];
  const terms = fold(q).split(/\s+/).filter(Boolean);
  const other = terms.length
    ? tasks.filter((t) => {
        if (t.processKey === PROCESS_KEY || !inScope(true)) return false;
        const hay = fold([t.code, t.title, t.step, t.requester, t.processKey, processByKey(t.processKey)?.name ?? ""].join(" "));
        return terms.every((x) => hay.includes(x));
      })
    : [];

  return (
    <>
      <PageHeader title="Tìm kiếm toàn văn" description="Tìm trong mọi trường của biểu mẫu, ý kiến xử lý, trao đổi và tên tệp – không phân biệt dấu, gộp mọi phiên bản quy trình." />

      <form
        className="mb-4 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          go({ q: text.trim() });
        }}
      >
        <div className="relative min-w-[18rem] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-slate-400" />
          <input autoFocus value={text} onChange={(e) => setText(e.target.value)} className={`${inputClass} pl-8`} placeholder="Ví dụ: con lăn, IATF, tên người, tên tệp…" aria-label="Từ khóa" />
        </div>
        <div className="inline-flex overflow-hidden rounded-md border border-slate-300 text-sm">
          {scopes.map(([id, label]) => (
            <button key={id} type="button" aria-pressed={scope === id} onClick={() => go({ scope: id })} className={`px-3 py-1.5 ${scope === id ? "bg-slate-800 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
              {label}
            </button>
          ))}
        </div>
        <button type="submit" className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
          Tìm
        </button>
      </form>

      {!q.trim() ? (
        <Card>
          <p className="text-sm text-slate-600">Gõ từ khóa rồi Enter. Có thể tìm theo nội dung mô tả, ý kiến thẩm định, tên người, mã phòng ban, tên tệp đính kèm.</p>
          <p className="mt-3 flex flex-wrap gap-2 text-xs">
            {samples.map((s) => (
              <button key={s} type="button" onClick={() => go({ q: s })} className="rounded-full border border-slate-300 px-2.5 py-0.5 text-slate-600 hover:border-blue-400 hover:text-blue-700">
                {s}
              </button>
            ))}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card
            title={`${PROCESS_NAME} · ${fourm.length} hồ sơ`}
            actions={
              <Link href={`/4m/cases?view=${scope === "all" ? "all" : scope}&q=${encodeURIComponent(q)}`} className="text-xs font-medium text-blue-600 hover:underline">
                Mở trong danh sách để lọc tiếp ›
              </Link>
            }
          >
            {fourm.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">Không có hồ sơ 4M khớp “{q}”.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {fourm.map(({ c, hits }) => (
                  <li key={c.code} className="py-3">
                    <Link href={`/4m/cases/${c.code}`} className="group block">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-slate-500">
                          <Marked text={c.code} q={q} />
                        </span>
                        <span className="font-medium text-slate-900 group-hover:text-blue-700">
                          <Marked text={c.title} q={q} />
                        </span>
                        <VersionTag v={c.version} />
                        <CaseStateBadge c={c} />
                        {caseState(c) === "running" && <Badge tone="blue">{currentStepLabel(c)}</Badge>}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {personName(c.requester)} · {sectionShort(c.section)} · cập nhật {fmtDate(c.updatedAt, "vi")} · khớp {hits.length} trường
                      </p>
                      <div className="mt-1.5 space-y-0.5 border-l-2 border-yellow-300 pl-2">
                        {hits
                          .filter((h) => h.field !== "Mã hồ sơ" && h.field !== "Tiêu đề")
                          .slice(0, 4)
                          .map((h, i) => (
                            <Highlight key={i} hit={h} />
                          ))}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={`Quy trình khác · ${other.length} việc`}>
            {other.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">Không có việc nào khớp theo mã, tiêu đề hoặc tên quy trình.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {other.map((t) => (
                  <li key={t.id} className="py-2.5">
                    <Link href={`/tasks/${t.id}`} className="group block">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-slate-500">
                          <Marked text={t.code} q={q} />
                        </span>
                        <span className="font-medium text-slate-900 group-hover:text-blue-700">
                          <Marked text={t.title} q={q} />
                        </span>
                        <SourceBadge source={t.source} />
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        <Marked text={processByKey(t.processKey)?.name ?? t.processKey} q={q} /> · <Marked text={t.step} q={q} /> · {t.requester}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      <div className="mt-4">
        <WireNote>
          Phản hồi #1 và #6: kết quả gộp hồ sơ đang chạy lẫn đã kết thúc, mọi phiên bản quy trình, quét toàn bộ trường biểu mẫu, ý kiến và tên tệp. Production dùng chỉ mục toàn văn (PostgreSQL tsvector + unaccent, hoặc OpenSearch) được cập nhật mỗi khi lưu biểu mẫu và mỗi khi ra quyết định; quy trình khác ở bản demo mới khớp theo mã, tiêu đề, tên quy trình và bước.
        </WireNote>
      </div>
    </>
  );
}
