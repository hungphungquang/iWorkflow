"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, Bookmark, Download, FilePlus2, Search, X } from "lucide-react";
import { Badge, Card, PageHeader, WireNote, buttonClass, inputClass } from "@/components/ui";
import { Avatar, CaseStateBadge, DueBadge, Highlight, Stepper, VersionTag } from "@/components/fourm-ui";
import { classOptions, sections, steps, type FourMStepId } from "@/lib/fourm";
import {
  caseState,
  currentStepLabel,
  dueStatus,
  openTasks,
  participants,
  PHASE2_AGES,
  phase2AgeOf,
  phase2Days,
  phase2Status,
  PROCESS_KEY,
  PROCESS_NAME,
  searchCase,
  sectionShort,
  sharedWith,
  stepShort,
  taskKindLabel,
  type CaseState,
  type DueStatus,
  type FourMCase,
  type OpenTask,
  type Phase2Status,
  type SearchHit,
} from "@/lib/fourm-case";
import { fmtDate, fmtDateTime, useLocale } from "@/lib/i18n";
import { people, personName } from "@/lib/people";
import { deleteView, saveView, useDb } from "@/lib/store";

type View = "mine" | "running" | "finished" | "shared" | "all";
const views: { id: View; label: string; hint: string }[] = [
  { id: "mine", label: "Việc của tôi", hint: "Việc đang chờ bạn xử lý" },
  { id: "running", label: "Đang chạy", hint: "Hồ sơ bạn tham gia, chưa kết thúc (Running Items)" },
  { id: "finished", label: "Đã kết thúc", hint: "Hồ sơ bạn tham gia đã hoàn tất / từ chối / hủy (Finished Items)" },
  { id: "shared", label: "Chia sẻ & theo dõi", hint: "Hồ sơ được chia sẻ với bạn hoặc bạn đang theo dõi" },
  { id: "all", label: "Tất cả", hint: "Toàn bộ hồ sơ 4M (quyền quản lý)" },
];

type Row = { c: FourMCase; task?: OpenTask; due?: string; hits: SearchHit[] };
type SortKey = "due" | "updated" | "created" | "code";

const FILTER_KEYS = ["q", "step", "sec", "rsec", "assignee", "cls", "due", "state", "ver", "from", "to", "p2", "p2age"] as const;
const p2Text: Record<Phase2Status, string> = { todo: "Chưa thực hiện GĐ2", doing: "Đang thực hiện GĐ2" };
const dueText: Record<DueStatus, string> = { overdue: "Quá hạn", dueSoon: "Sắp đến hạn", normal: "Trong hạn" };
const stateText: Record<CaseState, string> = { running: "Đang xử lý", completed: "Hoàn tất", rejected: "Từ chối", cancelled: "Đã hủy" };

export function CaseList() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const locale = useLocale();
  const db = useDb();
  const me = db.me;
  const view = (sp.get("view") as View) || "mine";
  const get = (k: string) => sp.get(k) ?? "";
  const [q, setQ] = useState(get("q"));
  const [viewName, setViewName] = useState<string | null>(null);
  const sort = (get("sort") || "due") as SortKey;
  const dir = get("dir") === "desc" ? -1 : 1;

  function update(patch: Record<string, string | null>) {
    const next = new URLSearchParams(sp.toString());
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const all = useMemo(() => {
    const tasksOf = new Map(db.cases.map((c) => [c.code, openTasks(c)]));
    const inScope = (c: FourMCase, v: View) => {
      if (v === "all") return true;
      if (v === "shared") return sharedWith(c, me) || c.watchers.includes(me);
      if (v === "mine") return tasksOf.get(c.code)!.some((t) => t.assignee === me);
      const mineCase = participants(c).includes(me);
      return mineCase && (v === "running" ? caseState(c) === "running" : caseState(c) !== "running");
    };
    const counts = Object.fromEntries(
      views.map((v) => [v.id, v.id === "mine" ? db.cases.flatMap((c) => tasksOf.get(c.code)!).filter((t) => t.assignee === me).length : db.cases.filter((c) => inScope(c, v.id)).length]),
    ) as Record<View, number>;

    const f = Object.fromEntries(FILTER_KEYS.map((k) => [k, sp.get(k) ?? ""])) as Record<(typeof FILTER_KEYS)[number], string>;
    const rows: Row[] = [];
    for (const c of db.cases) {
      if (!inScope(c, view)) continue;
      const ts = tasksOf.get(c.code)!;
      if (f.sec && c.section !== f.sec) continue;
      if (f.rsec && !c.rows.some((r) => r.code === f.rsec)) continue;
      if (f.cls && !c.classes.includes(f.cls)) continue;
      if (f.state && caseState(c) !== (f.state as CaseState)) continue;
      if (f.ver && String(c.version) !== f.ver) continue;
      if (f.step && c.sim.step !== (f.step as FourMStepId)) continue;
      if (f.assignee && !ts.some((t) => t.assignee === f.assignee)) continue;
      if (f.from && c.createdAt.slice(0, 10) < f.from) continue;
      if (f.to && c.createdAt.slice(0, 10) > f.to) continue;
      if (f.p2 || f.p2age) {
        const p2 = phase2Status(c);
        if (!p2 || (f.p2 && f.p2 !== "all" && p2 !== f.p2)) continue;
        if (f.p2age && phase2AgeOf(phase2Days(c, db.now)) !== f.p2age) continue;
      }
      const hits = f.q ? searchCase(c, f.q) : [];
      if (hits === null) continue;
      const candidates = view === "mine" ? ts.filter((t) => t.assignee === me) : [undefined];
      for (const task of candidates) {
        const relevant = task ? [task] : ts.filter((t) => (!f.assignee || t.assignee === f.assignee) && (!f.rsec || !t.section || t.section === f.rsec));
        const due = relevant.map((t) => t.due).sort()[0];
        if (f.due && (!due || dueStatus(due, db.now) !== (f.due as DueStatus))) continue;
        rows.push({ c, task, due, hits });
      }
    }
    const key = (r: Row) => (sort === "due" ? (r.due ?? "9999") : sort === "updated" ? r.c.updatedAt : sort === "created" ? r.c.createdAt : r.c.code);
    rows.sort((a, b) => key(a).localeCompare(key(b)) * dir);
    return { rows, counts };
  }, [db, me, view, sp, sort, dir]);

  const activeFilters = FILTER_KEYS.filter((k) => k !== "q" && sp.get(k));
  const versions = [...new Set(db.cases.map((c) => c.version))].sort((a, b) => b - a);
  const myViews = db.views.filter((v) => v.owner === me);

  const filterLabel = (k: string, v: string) => {
    switch (k) {
      case "step":
        return `Bước: ${stepShort[v as FourMStepId] ?? v}`;
      case "sec":
        return `Đơn vị đề nghị: ${sectionShort(v)}`;
      case "rsec":
        return `Phòng liên quan: ${sectionShort(v)}`;
      case "assignee":
        return `Người xử lý: ${personName(v)}`;
      case "cls":
        return `Phân loại: ${v}`;
      case "due":
        return `SLA: ${dueText[v as DueStatus] ?? v}`;
      case "state":
        return `Trạng thái: ${stateText[v as CaseState] ?? v}`;
      case "ver":
        return `Phiên bản: v${v}`;
      case "from":
        return `Tạo từ ${v}`;
      case "to":
        return `Tạo đến ${v}`;
      case "p2":
        return p2Text[v as Phase2Status] ?? "Đã xong GĐ1, chưa xong GĐ2";
      case "p2age":
        return `Chờ từ khi xong GĐ1: ${PHASE2_AGES.find((b) => b.id === v)?.label ?? v}`;
    }
    return `${k}: ${v}`;
  };

  function exportCsv() {
    const head = ["Mã", "Tiêu đề", "Phiên bản", "Đơn vị", "Người đề nghị", "Phân loại", "Bước hiện tại", "Trạng thái", "Hạn gần nhất", "Ngày tạo", "Cập nhật"];
    const lines = all.rows.map(({ c, due }) =>
      [c.code, c.title, `v${c.version}`, c.section, personName(c.requester), c.classes.join("/"), currentStepLabel(c), stateText[caseState(c)], due ? fmtDateTime(due, locale) : "", fmtDate(c.createdAt, locale), fmtDate(c.updatedAt, locale)]
        .map((x) => `"${String(x).replaceAll('"', '""')}"`)
        .join(","),
    );
    const blob = new Blob(["\uFEFF" + [head.join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `4M-${view}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const sortHeader = (k: SortKey, label: string) => (
    <button className="inline-flex items-center gap-0.5 hover:text-slate-800" onClick={() => update({ sort: k, dir: sort === k && dir === 1 ? "desc" : null })}>
      {label}
      {sort === k && (dir === 1 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
    </button>
  );

  return (
    <>
      <PageHeader
        title="Hồ sơ & việc 4M"
        description={`${PROCESS_NAME} · ${PROCESS_KEY} – gộp mọi phiên bản (${versions.map((v) => `v${v}`).join(", ")})`}
        actions={
          <>
            <button className={buttonClass()} onClick={exportCsv}>
              <Download className="h-4 w-4" /> Xuất Excel (CSV)
            </button>
            <Link href="/4m/new" className={buttonClass("primary")}>
              <FilePlus2 className="h-4 w-4" /> Tạo yêu cầu 4M
            </Link>
          </>
        }
      />

      <div role="tablist" className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
        {views.map((v) => (
          <button
            key={v.id}
            role="tab"
            title={v.hint}
            aria-selected={view === v.id}
            onClick={() => update({ view: v.id === "mine" ? null : v.id, due: null, state: null })}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${view === v.id ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            {v.label}
            <span className={`ml-1.5 rounded px-1.5 text-xs ${v.id === "mine" && all.counts.mine ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"}`}>{all.counts[v.id]}</span>
          </button>
        ))}
      </div>

      <Card className="mb-4">
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            update({ q: q.trim() || null });
          }}
        >
          <label className="relative min-w-64 flex-1">
            <span className="sr-only">Tìm kiếm</span>
            <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-slate-400" />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                update({ q: e.target.value.trim() || null });
              }}
              className={`${inputClass} pl-8`}
              placeholder="Tìm trong mã, tiêu đề, mọi trường biểu mẫu, ý kiến, trao đổi, tên tệp… (không cần dấu)"
            />
          </label>
          <Select label="Bước hiện tại" value={get("step")} onChange={(v) => update({ step: v })} options={steps.map((s) => [s.id, stepShort[s.id]])} />
          <Select label="Đơn vị đề nghị" value={get("sec")} onChange={(v) => update({ sec: v })} options={sections.map((s) => [s.code, `${s.code} ${sectionShort(s.code)}`])} />
          <Select label="Phòng liên quan" value={get("rsec")} onChange={(v) => update({ rsec: v })} options={sections.map((s) => [s.code, `${s.code} ${sectionShort(s.code)}`])} />
          <Select label="Người xử lý" value={get("assignee")} onChange={(v) => update({ assignee: v })} options={people.map((p) => [p.id, p.name])} />
          <Select label="Phân loại" value={get("cls")} onChange={(v) => update({ cls: v })} options={classOptions.map((c) => [c.code, c.label])} />
          <Select label="SLA" value={get("due")} onChange={(v) => update({ due: v })} options={Object.entries(dueText)} />
          {view !== "mine" && <Select label="Trạng thái" value={get("state")} onChange={(v) => update({ state: v })} options={Object.entries(stateText)} />}
          <Select label="Phiên bản" value={get("ver")} onChange={(v) => update({ ver: v })} options={versions.map((v) => [String(v), `v${v}`])} />
          <label className="flex flex-col gap-1 text-xs text-slate-600">
            Tạo từ
            <input type="date" className={`${inputClass} w-36`} value={get("from")} onChange={(e) => update({ from: e.target.value || null })} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-600">
            đến
            <input type="date" className={`${inputClass} w-36`} value={get("to")} onChange={(e) => update({ to: e.target.value || null })} />
          </label>
        </form>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          {activeFilters.map((k) => (
            <button key={k} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-blue-800 hover:bg-blue-100" onClick={() => update({ [k]: null })}>
              {filterLabel(k, sp.get(k)!)} <X className="h-3 w-3" />
            </button>
          ))}
          {(activeFilters.length > 0 || get("q")) && (
            <button
              className="text-slate-500 underline hover:text-slate-800"
              onClick={() => {
                setQ("");
                update(Object.fromEntries(FILTER_KEYS.map((k) => [k, null])));
              }}
            >
              Xóa lọc
            </button>
          )}
          <span className="ml-auto flex flex-wrap items-center gap-1.5">
            <Bookmark className="h-3.5 w-3.5 text-slate-400" />
            {myViews.map((v) => (
              <span key={v.id} className="inline-flex items-center rounded-full border border-slate-200">
                <button
                  className="px-2 py-0.5 text-slate-700 hover:text-blue-700"
                  onClick={() => {
                    setQ(new URLSearchParams(v.query).get("q") ?? "");
                    router.replace(`${pathname}?${v.query}`, { scroll: false });
                  }}
                >
                  {v.name}
                </button>
                <button aria-label={`Xóa bộ lọc ${v.name}`} className="pr-1.5 text-slate-400 hover:text-red-600" onClick={() => deleteView(v.id)}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            {viewName === null ? (
              <button className="text-blue-600 hover:underline" onClick={() => setViewName("")}>
                + Lưu bộ lọc hiện tại
              </button>
            ) : (
              <form
                className="flex items-center gap-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (viewName.trim()) saveView(viewName.trim(), sp.toString());
                  setViewName(null);
                }}
              >
                <input autoFocus value={viewName} onChange={(e) => setViewName(e.target.value)} className="rounded border border-slate-300 px-1.5 py-0.5" placeholder="Tên bộ lọc" />
                <button className="text-blue-600">Lưu</button>
              </form>
            )}
          </span>
        </div>
      </Card>

      <Card>
        <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
          <Badge tone="blue">{PROCESS_NAME}</Badge>
          <span>
            {all.rows.length} {view === "mine" ? "việc" : "hồ sơ"} · gộp theo tên quy trình, không tách theo phiên bản triển khai
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs text-slate-500">
              <tr>
                <th className="px-2 py-2 font-medium">{sortHeader("code", "Mã")}</th>
                <th className="px-2 py-2 font-medium">Tiêu đề</th>
                <th className="px-2 py-2 font-medium">{view === "mine" ? "Việc của bạn" : "Bước hiện tại · người xử lý"}</th>
                <th className="px-2 py-2 font-medium">Người đề nghị</th>
                <th className="px-2 py-2 font-medium">Tiến độ</th>
                <th className="px-2 py-2 font-medium">{sortHeader("due", "Hạn")}</th>
                <th className="px-2 py-2 font-medium">{sortHeader("updated", "Cập nhật")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {all.rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-2 py-10 text-center text-sm text-slate-500">
                    Không có hồ sơ phù hợp.{" "}
                    {view !== "all" && (
                      <button className="text-blue-600 hover:underline" onClick={() => update({ view: "all" })}>
                        Tìm trong tất cả hồ sơ
                      </button>
                    )}
                  </td>
                </tr>
              )}
              {all.rows.map(({ c, task, due, hits }) => {
                const holders = [...new Set(openTasks(c).map((t) => t.assignee))];
                return (
                  <tr key={task?.id ?? c.code} className="cursor-pointer align-top hover:bg-slate-50" onClick={() => router.push(`/4m/cases/${c.code}`)}>
                    <td className="whitespace-nowrap px-2 py-2.5">
                      <Link href={`/4m/cases/${c.code}`} className="font-mono text-xs font-medium text-blue-700 hover:underline" onClick={(e) => e.stopPropagation()}>
                        {c.code}
                      </Link>
                      <span className="mt-1 flex items-center gap-1">
                        <VersionTag v={c.version} />
                        {c.classes.map((k) => (
                          <span key={k} className="rounded bg-slate-100 px-1 text-[10px] font-medium text-slate-600">
                            {k}
                          </span>
                        ))}
                      </span>
                    </td>
                    <td className="max-w-md px-2 py-2.5">
                      <span className="block font-medium text-slate-800">{c.title}</span>
                      {hits.slice(0, 2).map((h, i) => (
                        <Highlight key={i} hit={h} />
                      ))}
                      {hits.length > 2 && <span className="text-[11px] text-slate-400">+{hits.length - 2} chỗ khớp khác</span>}
                    </td>
                    <td className="px-2 py-2.5 text-xs">
                      {task ? (
                        <>
                          <span className="block font-medium text-slate-800">{stepShort[task.step]}</span>
                          {task.section && (
                            <span className="text-slate-500">
                              {taskKindLabel[task.kind]} · {sectionShort(task.section)}
                            </span>
                          )}
                        </>
                      ) : caseState(c) === "running" ? (
                        <>
                          <span className="block text-slate-800">{currentStepLabel(c)}</span>
                          <span className="mt-1 flex items-center gap-1">
                            {holders.slice(0, 4).map((p) => (
                              <Avatar key={p} id={p} />
                            ))}
                            {holders.length === 1 && <span className="text-slate-500">{personName(holders[0])}</span>}
                          </span>
                        </>
                      ) : (
                        <CaseStateBadge c={c} />
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-xs">
                      <span className="block text-slate-800">{personName(c.requester)}</span>
                      <span className="text-slate-500">
                        {c.section} {sectionShort(c.section)}
                      </span>
                    </td>
                    <td className="px-2 py-2.5">
                      <Stepper c={c} compact />
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-xs">
                      {due ? (
                        <>
                          <DueBadge due={due} now={db.now} />
                          <span className="mt-0.5 block text-slate-500">{fmtDate(due, locale)}</span>
                        </>
                      ) : c.endedAt ? (
                        <span className="text-slate-500">Kết thúc {fmtDate(c.endedAt, locale)}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-xs text-slate-500">{fmtDateTime(c.updatedAt, locale)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-4">
        <WireNote>
          Giải quyết phản hồi người dùng: (1) tìm được cả hồ sơ <b>đã kết thúc</b> theo tiêu đề / tên quy trình; (2) mọi phiên bản Process4MChange (v10–v12) <b>gộp chung</b> một danh sách, phiên bản chỉ là cột phụ và bộ lọc; (3) <b>bộ lọc</b> trên Running / Finished
          Items, lưu thành bộ lọc cá nhân, nằm trên URL nên gửi link là người nhận thấy đúng danh sách; (6) tìm <b>toàn văn</b> trong mọi trường biểu mẫu, ý kiến, trao đổi, tên tệp, không phân biệt dấu. Backend: Postgres full-text (unaccent + GIN) trên bảng
          chiếu <code>case_search</code>, cập nhật khi task hoàn thành.
        </WireNote>
      </div>
    </>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string | null) => void; options: [string, string][] }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-slate-600">
      {label}
      <select className={`${inputClass} w-40`} value={value} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">Tất cả</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
