"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, BarChart3, Check, CheckCheck, ChevronLeft, ChevronRight, ClipboardCheck, Clock3, Database, Download, FileText, FlaskConical, History, Inbox, Layers3, Loader2, LockKeyhole, RefreshCw, Search, Send, Users } from "lucide-react";
import { Badge, PageHeader, buttonClass, inputClass } from "@/components/ui";
import { applyReview, groupReviewCases, isCaseOverdue, reviewAssignee, reviewStageTone as stageTone, type ReviewAction, type ReviewPerson, type StandardReview } from "@/lib/working-standard";
import { fmtDateTime, fmtNum, useLocale, useMessages } from "@/lib/i18n";
import { reviewErrorText, workingStandardMessages } from "@/lib/i18n-working-standard";
import { reviewDemoStore as demoStore, useWorkingStandardData } from "@/lib/working-standard-store";
const isOpen = (review: StandardReview) => !review.endedAt;
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
const pageSize = 20;
const parentStateTone = { running: "amber", completed: "green", cancelled: "gray", unknown: "gray" } as const;

export default function WorkingStandardPage() {
  const params = useSearchParams();
  return <WorkingStandardQueue key={params.toString()} />;
}

function WorkingStandardQueue() {
  const locale = useLocale();
  const t = useMessages(workingStandardMessages);
  const stageLabel = t.stages;
  const date = (value: string) => value ? fmtDateTime(value, locale) : t.common.notAvailable;
  const number = (value: number) => fmtNum(value, locale);
  const params = useSearchParams();
  const { mode, setMode, snapshot, loading, error, reload } = useWorkingStandardData(params.get("source"));
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(params.get("status") || "all");
  const [reviewStatus, setReviewStatus] = useState(params.get("reviewStatus") || "all");
  const [department, setDepartment] = useState(params.get("department") || "");
  const [since, setSince] = useState(params.get("since") || "");
  const [onlyMine, setOnlyMine] = useState(false);
  const [actor, setActor] = useState("ws-manager-qa");
  const [selectedId, setSelectedId] = useState(params.get("review") || "");
  const [selectedCaseId, setSelectedCaseId] = useState(params.get("parent") || "");
  const [tab, setTab] = useState<"document" | "departments" | "history">("departments");
  const [page, setPage] = useState(0);
  const [notice, setNotice] = useState<ReviewAction["type"] | "">("");
  const [mobileDetail, setMobileDetail] = useState(!!params.get("review") || !!params.get("parent"));
  const detailRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (mobileDetail && window.matchMedia("(max-width: 1023px)").matches) detailRef.current?.scrollIntoView({ block: "start" });
  }, [mobileDetail]);

  const reviews = snapshot?.reviews ?? [];
  const people = snapshot?.people ?? [];
  const now = snapshot?.loadedAt ?? "";
  const overdue = (review: StandardReview) => isOpen(review) && !!review.dueAt && review.dueAt < now;
  const name = (id: string) => people.find((person) => person.id === id)?.name || id || t.common.unknown;
  const cases = snapshot ? groupReviewCases(snapshot) : [];
  const matchingReviews = reviews.filter((review) => {
    if (reviewStatus === "overdue" ? !overdue(review) : reviewStatus === "open" ? !isOpen(review) : reviewStatus !== "all" && review.stage !== reviewStatus) return false;
    if (department && review.department !== department) return false;
    if (onlyMine && reviewAssignee(review) !== actor) return false;
    return normalize([review.code, review.id, review.title, review.standardNo, review.department, name(reviewAssignee(review))].join(" ")).includes(normalize(query.trim()));
  });
  const matchingParents = new Set(matchingReviews.map((review) => review.parentId));
  const filtered = cases.filter((item) => {
    if (!matchingParents.has(item.id)) return false;
    if (since && (Date.parse(item.startedAt) < Date.parse(since) || Date.parse(item.startedAt) > Date.parse(now))) return false;
    if (status === "completed") return item.approvalState === "completed";
    if (status === "open") return item.approvalState === "running";
    if (status === "overdue") return isCaseOverdue(item, now, department);
    return true;
  });
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages - 1);
  const visible = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const selectedCase = filtered.find((item) => item.id === selectedCaseId) ?? filtered.find((item) => item.reviews.some((review) => review.id === selectedId)) ?? visible[0];
  const siblings = selectedCase?.reviews ?? [];
  const activeReview = siblings.find((review) => review.id === selectedId);
  const selected = activeReview ?? siblings[0];
  const parent = selectedCase?.parent ?? null;
  const parentCount = cases.length;
  const history = siblings.flatMap((review) => review.history.map((event) => ({ ...event, department: review.department, reviewId: review.id }))).sort((left, right) => left.at.localeCompare(right.at));

  function resetSelection() {
    setSelectedCaseId("");
    setSelectedId("");
    setMobileDetail(false);
    setPage(0);
    setNotice("");
  }

  function changeMode(next: "demo" | "iw_prod") {
    setMode(next);
    resetSelection();
    setStatus("all");
    setReviewStatus("all");
    setDepartment("");
    setSince("");
    setOnlyMine(false);
    setNotice("");
    setPage(0);
  }

  function handleAction(review: StandardReview, action: ReviewAction) {
    if (mode !== "demo") return;
    demoStore.set((current) => ({
      ...current,
      reviews: current.reviews.map((item) => item.id === review.id ? applyReview(item, action, actor, new Date().toISOString(), current.people) : item),
    }));
    setSelectedId(review.id);
    setNotice(action.type);
  }

  return (
    <>
      <PageHeader title="Working Standard" description={t.queue.description} actions={
        <>
          <Link href={`/working-standard/dashboard?source=${mode}`} className={buttonClass()}><BarChart3 className="h-4 w-4" />{t.common.dashboard}</Link>
          <button type="button" title={t.common.refreshData} aria-label={t.common.refreshData} disabled={loading} className={`${buttonClass()} disabled:opacity-50`} onClick={() => { reload(); setNotice(""); }}>
          <RefreshCw className={`h-4 w-4 ${loading && mode === "iw_prod" ? "animate-spin" : ""}`} />{t.common.refresh}
        </button>
        </>
      } />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-y border-slate-200 py-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
          {mode === "iw_prod" ? <Database className="h-4 w-4 text-emerald-600" /> : <FlaskConical className="h-4 w-4 text-amber-600" />}
          <strong>{mode === "iw_prod" ? t.common.readOnly : t.common.demoLocal}</strong>
          {snapshot && <span>{t.common.updated(date(snapshot.loadedAt))}</span>}
        </div>
        <div className="flex rounded-md border border-slate-300 bg-white p-0.5" role="group" aria-label={t.common.source}>
          {([ ["iw_prod", t.common.production], ["demo", t.common.demo] ] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={mode === value} onClick={() => changeMode(value)} className={`rounded px-3 py-1 text-xs font-medium ${mode === value ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{label}</button>)}
        </div>
      </div>

      {mode === "iw_prod" && loading ? <div role="status" className="flex items-center justify-center gap-2 py-20 text-sm text-slate-600"><Loader2 className="h-5 w-5 animate-spin" />{t.queue.loading}</div> : mode === "iw_prod" && error ? (
        <div role="alert" className="border-l-4 border-red-500 bg-red-50 p-5 text-sm text-red-800"><p>{t.common.loadError}</p><button className={`${buttonClass()} mt-3`} onClick={reload}><RefreshCw className="h-4 w-4" />{t.common.retry}</button></div>
      ) : <>
        <div className="mb-6 grid grid-cols-2 divide-x divide-slate-200 border-b border-slate-200 pb-5 lg:grid-cols-4">
          {[
            { label: t.common.parentCases, value: parentCount, icon: FileText, color: "text-slate-900" },
            { label: t.queue.caseInProgress, value: cases.filter((item) => item.approvalState === "running").length, icon: ClipboardCheck, color: "text-amber-700" },
            { label: t.queue.caseCompleted, value: cases.filter((item) => item.approvalState === "completed").length, icon: CheckCheck, color: "text-emerald-700" },
            { label: t.queue.caseOverdue, value: cases.filter((item) => item.reviews.some(overdue)).length, icon: Clock3, color: "text-red-600" },
          ].map(({ label, value, icon: Icon, color }) => <div key={label} className="px-3 py-2 first:pl-0 md:px-5"><div className="flex items-center gap-2 text-xs text-slate-500"><Icon className="h-4 w-4" />{label}</div><p className={`mt-2 text-2xl font-semibold ${color}`}>{number(value)}</p></div>)}
        </div>
        <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-500">
          <span>{mode === "iw_prod" ? t.queue.scope : t.queue.demoScope}</span>
          <span>{t.queue.survey} <strong className="text-slate-700">{t.queue.surveyStarted(number(2246))}</strong> · {t.queue.surveyFinished(number(2235))}</span>
        </div>
        {notice && <div role="status" className="mb-4 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCheck className="h-4 w-4 shrink-0" />{t.queue.notice[notice]}</div>}
        {since && <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-blue-700"><span>{t.queue.startedSince(date(since))}</span><button type="button" className="underline" onClick={() => { setSince(""); setPage(0); }}>{t.queue.clearPeriod}</button></div>}
        {reviewStatus !== "all" && <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-blue-700"><span>{t.queue.reviewScope(reviewStatus === "open" ? t.common.inProgress : reviewStatus === "overdue" ? t.common.overdue : stageLabel[reviewStatus as keyof typeof stageLabel] || reviewStatus)}</span><button type="button" className="underline" onClick={() => { setReviewStatus("all"); resetSelection(); }}>{t.queue.clearReviewScope}</button></div>}

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(16rem,0.65fr)_minmax(0,1.65fr)]">
          <section aria-label={t.queue.caseList} className={`min-w-0 lg:sticky lg:top-0 ${mobileDetail ? "hidden lg:block" : ""}`}>
            <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold text-slate-900">{t.queue.caseHeading} <span className="ml-1 font-normal text-slate-500">({number(filtered.length)})</span></h2></div>
            <div className="relative mb-2"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input aria-label={t.queue.caseSearch} placeholder={t.queue.searchPlaceholder} className={`${inputClass} pl-9`} value={query} onChange={(event) => { setQuery(event.target.value); resetSelection(); }} /></div>
            <div className="mb-3 grid grid-cols-2 gap-2">
              <select aria-label={t.queue.approvalStatus} className={inputClass} value={status} onChange={(event) => { setStatus(event.target.value); resetSelection(); }}><option value="all">{t.common.allStatuses}</option><option value="open">{t.queue.approvalStates.running}</option><option value="completed">{t.queue.approvalStates.completed}</option><option value="overdue">{t.common.overdue}</option></select>
              <select aria-label={t.common.department} className={inputClass} value={department} onChange={(event) => { setDepartment(event.target.value); resetSelection(); }}><option value="">{t.common.allDepartments}</option>{[...new Set(reviews.map((review) => review.department))].sort().map((value) => <option key={value}>{value}</option>)}</select>
            </div>
            {mode === "demo" && <div className="mb-3 space-y-2 border-b border-slate-200 pb-3"><label className="block text-xs text-slate-500">{t.queue.actor}<select aria-label={t.queue.actor} className={`${inputClass} mt-1`} value={actor} onChange={(event) => { setActor(event.target.value); setNotice(""); setPage(0); }}>{people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label><label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={onlyMine} onChange={(event) => { setOnlyMine(event.target.checked); resetSelection(); }} />{t.queue.mineOnly}</label></div>}
            <div className="max-h-[34rem] divide-y divide-slate-200 overflow-y-auto border-y border-slate-200">
              {visible.map((item) => <button type="button" key={item.id} aria-pressed={selectedCase?.id === item.id} onClick={() => { setSelectedCaseId(item.id); setSelectedId(""); setTab("departments"); setMobileDetail(true); setNotice(""); }} className={`block w-full border-l-[3px] p-3 text-left transition-colors ${selectedCase?.id === item.id ? "border-l-blue-600 bg-blue-50/80" : "border-l-transparent hover:bg-white"}`}>
                <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-mono text-xs font-semibold text-blue-700">{item.code}</span><Badge tone={item.approvalState === "completed" ? "green" : "amber"}>{t.queue.approvalStates[item.approvalState]}</Badge></div>
                <p className="mt-2 break-words text-sm font-medium leading-5 text-slate-900">{item.title}</p>
              </button>)}
              {!visible.length && <div className="py-12 text-center text-sm text-slate-500"><Inbox className="mx-auto mb-2 h-7 w-7 text-slate-300" />{t.queue.caseEmpty}<button type="button" className="mx-auto mt-3 block text-blue-700 hover:underline" onClick={() => { setQuery(""); setStatus("all"); setReviewStatus("all"); setDepartment(""); setSince(""); setOnlyMine(false); resetSelection(); }}>{t.queue.clearFilters}</button></div>}
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500"><span>{t.queue.page(number(currentPage + 1), number(pages))}</span><div className="flex gap-1"><button aria-label={t.queue.previous} title={t.queue.previous} disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} className={`${buttonClass("ghost")} disabled:opacity-30`}><ChevronLeft className="h-4 w-4" /></button><button aria-label={t.queue.next} title={t.queue.next} disabled={currentPage >= pages - 1} onClick={() => setPage(currentPage + 1)} className={`${buttonClass("ghost")} disabled:opacity-30`}><ChevronRight className="h-4 w-4" /></button></div></div>
          </section>

          <section ref={detailRef} aria-label={t.queue.caseDetail} className={`min-w-0 ${mobileDetail ? "" : "hidden lg:block"}`}>
            <button type="button" className={`${buttonClass("ghost")} mb-3 lg:hidden`} onClick={() => setMobileDetail(false)}><ChevronLeft className="h-4 w-4" />{t.queue.caseHeading}</button>
            {!selected || !selectedCase ? <div className="flex min-h-64 flex-col items-center justify-center border border-dashed border-slate-300 text-sm text-slate-500"><FileText className="mb-3 h-9 w-9 text-slate-300" />{t.queue.noSelection}</div> : <>
              <div className="border-b border-slate-200 pb-4">
                <div role="group" aria-label={t.queue.parentCase} className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-medium text-slate-500">{t.queue.parentCase} · #{selected.parentId}</span><Badge tone={parentStateTone[selectedCase.approvalState]}>{t.queue.approvalStates[selectedCase.approvalState]}</Badge></div>
                <h2 className="mt-3 break-words text-lg font-semibold leading-7 text-slate-900">{selected.title}</h2>
                <button type="button" className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:underline" onClick={() => setTab("departments")}><Layers3 className="h-4 w-4" />{selected.code}<ArrowRight className="h-3 w-3" /></button>
                {parent ? <div role="group" aria-label={t.queue.parentProgressTitle} className="mt-4 space-y-2">
                  <p className="text-xs font-medium text-slate-700">{t.queue.parentProgress(number(parent.completedReviews), number(parent.totalReviews))}</p>
                  {parent.totalReviews > 0 && <progress aria-label={t.queue.parentProgressTitle} value={parent.completedReviews} max={parent.totalReviews} className="block h-1.5 w-full accent-blue-600" />}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500"><span>{t.queue.parentPending(number(parent.pendingReviews))}</span>{parent.cancelledReviews > 0 && <span>{t.queue.parentCancelled(number(parent.cancelledReviews))}</span>}</div>
                </div> : <p className="mt-3 text-xs text-slate-500">{t.queue.parentUnavailable}</p>}
                <p className="mt-3 text-xs leading-5 text-slate-500">{t.queue.approvalRule}</p>
              </div>
              <div className="flex gap-1 overflow-x-auto border-b border-slate-200" role="tablist" aria-label={t.queue.caseContent}>
                {([{ id: "departments", label: `${t.queue.approvals} (${number(siblings.length)})`, icon: Users }, { id: "document", label: t.queue.standard, icon: FileText }, { id: "history", label: t.queue.approvalHistory, icon: History }] as const).map(({ id, label, icon: Icon }) => <button key={id} role="tab" id={`tab-${id}`} aria-selected={tab === id} aria-controls={`panel-${id}`} onClick={() => setTab(id)} className={`inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-3 text-xs font-medium ${tab === id ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}><Icon className="h-4 w-4" />{label}</button>)}
              </div>
              <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="py-5">
                {tab === "document" && <>
                  <div className="border border-slate-200 bg-white p-5">
                    <div className="flex items-center gap-3 border-b-2 border-slate-800 pb-4"><div className="flex h-11 w-11 shrink-0 items-center justify-center border border-slate-300 bg-slate-50 text-xs font-bold text-slate-600">WS</div><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Working Standard</p><p className="mt-1 break-words text-sm font-semibold text-slate-900">{selected.standardNo || t.queue.noStandardNo}</p></div><span className="ml-auto shrink-0 text-xs text-slate-500">Rev. {selected.revision || "-"}</span></div>
                    <h3 className="mt-5 break-words text-sm font-semibold leading-6">{selected.title}</h3><p className="mt-3 text-xs font-medium text-slate-500">{t.queue.changeReason}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{selected.summary || t.queue.noContent}</p>
                  </div>
                  <div className="mt-4"><h3 className="mb-2 text-xs font-semibold text-slate-700">{t.queue.attachments} ({number(selected.attachments.length)})</h3>{selected.attachments.length ? <ul className="divide-y divide-slate-200">{selected.attachments.map((file) => <li key={file.id} className="flex items-center gap-2 py-2"><FileText className="h-4 w-4 shrink-0 text-slate-400" /><span className="min-w-0 flex-1 break-words text-xs text-slate-700">{file.name}</span>{file.url && <a href={file.url} target="_blank" rel="noopener noreferrer" title={t.queue.openDocument(file.name)} aria-label={t.queue.openDocument(file.name)} className={buttonClass("ghost")}><Download className="h-4 w-4" /></a>}</li>)}</ul> : <p className="text-xs text-slate-500">{t.queue.noAttachments}</p>}</div>
                </>}
                {tab === "departments" && <>
                  {parent && parent.totalReviews !== siblings.length && <p className="mb-3 text-xs text-slate-500">{t.queue.loadedSiblingScope(number(siblings.length), number(parent.totalReviews))}</p>}
                  <div className="overflow-x-auto"><table className="w-full min-w-[34rem] text-left text-xs"><caption className="sr-only">{t.queue.approvals}</caption><thead className="border-y border-slate-200 bg-slate-100/60 text-slate-500"><tr><th className="px-2 py-2 font-medium">{t.common.department}</th><th className="px-2 py-2 font-medium">{t.common.status}</th><th className="px-2 py-2 font-medium">{t.queue.assignee}</th><th className="px-2 py-2 text-right font-medium">{t.queue.dueOrCompleted}</th></tr></thead><tbody className="divide-y divide-slate-200">{siblings.map((review) => <tr key={review.id} className={activeReview?.id === review.id ? "bg-blue-50/70" : "hover:bg-white"}><th scope="row" className="px-2 py-3 font-medium"><button type="button" title={t.queue.openReview(review.department)} onClick={() => { setSelectedId(review.id); setNotice(""); }} className="text-left text-blue-700 hover:underline"><span className="block">{review.department}</span><span className="mt-1 block font-mono text-[10px] font-normal text-slate-400">#{review.id}</span></button></th><td className="px-2 py-3"><Badge tone={stageTone[review.stage]}>{stageLabel[review.stage]}</Badge></td><td className="px-2 py-3 text-slate-600">{name(isOpen(review) ? reviewAssignee(review) : review.manager)}</td><td className={`px-2 py-3 text-right ${overdue(review) ? "font-medium text-red-600" : "text-slate-500"}`}>{date(review.endedAt || review.dueAt)}</td></tr>)}</tbody></table></div>
                </>}
                {tab === "history" && <ol className="space-y-5 border-l border-slate-200 pl-5">{history.map((event, index) => <li key={`${event.reviewId}-${event.at}-${index}`} className="relative"><span className="absolute -left-[25px] top-1 h-2 w-2 rounded-full bg-blue-500" /><p className="text-xs text-slate-500">{date(event.at)} · {name(event.actor)} · {event.department}</p><p className="mt-1 break-words text-sm font-medium text-slate-800">{event.action}{event.status && ` · ${t.queue.taskStatuses[event.status]}`}</p>{event.comment && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-600">{event.comment}</p>}</li>)}{!history.length && <li className="text-sm text-slate-500">{t.queue.noHistory}</li>}</ol>}
              </div>
              {tab === "departments" && activeReview && <div role="group" aria-label={t.queue.departmentReview} className="mb-4 space-y-3 border-t border-slate-200 pt-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold text-slate-800">{selected.department}</h3><Badge tone={stageTone[selected.stage]}>{stageLabel[selected.stage]}</Badge></div><p className="font-mono text-xs text-slate-500">RelSecWS / {selected.id}</p><p className="text-xs text-slate-500">{t.queue.assignee}: {name(isOpen(selected) ? reviewAssignee(selected) : selected.manager)}</p>{selected.managerComment && <div><h4 className="text-xs font-semibold text-slate-600">{t.queue.managerComment}</h4><p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">{selected.managerComment}</p></div>}{selected.staffComment && <div><h4 className="text-xs font-semibold text-slate-600">{t.queue.staffComment}</h4><p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">{selected.staffComment}</p></div>}</div>}
              {mode === "iw_prod" ? <div className="flex items-start gap-2 border-t border-slate-200 py-4 text-xs leading-5 text-slate-500"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />{t.queue.readOnlyNote}</div> : tab === "departments" && activeReview && <ReviewForm key={`${selected.id}-${selected.stage}-${actor}`} review={selected} actor={actor} people={people} onAction={(action) => handleAction(selected, action)} />}
            </>}
          </section>
        </div>
      </>}
    </>
  );
}

function ReviewForm({ review, actor, people, onAction }: { review: StandardReview; actor: string; people: ReviewPerson[]; onAction: (action: ReviewAction) => void }) {
  const locale = useLocale();
  const t = useMessages(workingStandardMessages);
  const [comment, setComment] = useState("");
  const [staff, setStaff] = useState("");
  const [assign, setAssign] = useState(false);
  const [error, setError] = useState("");
  if (["completed", "cancelled", "unknown"].includes(review.stage)) return <p className="flex items-center gap-2 border-t border-slate-200 py-4 text-sm text-slate-600"><CheckCheck className="h-4 w-4" />{t.stages[review.stage]}</p>;
  if (reviewAssignee(review) !== actor) return <p className="flex items-center gap-2 border-t border-slate-200 py-4 text-xs text-slate-500"><LockKeyhole className="h-4 w-4 shrink-0" />{t.form.assignedTo(people.find((person) => person.id === reviewAssignee(review))?.name || reviewAssignee(review))}</p>;
  const isStaff = review.stage === "staff";
  return <form className="space-y-3 border-t border-slate-200 pt-4" onSubmit={(event) => {
    event.preventDefault();
    setError("");
    try { onAction(isStaff ? { type: "confirm", comment } : assign ? { type: "assign", comment, staff } : { type: "approve", comment }); } catch (failure) { setError(failure instanceof Error ? failure.message : t.form.failed); }
  }}>
    <h3 className="text-sm font-semibold text-slate-900">{isStaff ? t.form.staffTitle : t.form.managerTitle}</h3>
    {!isStaff && <div className="flex flex-wrap gap-4 text-xs text-slate-700"><label className="flex items-center gap-1.5"><input type="radio" name="decision" checked={!assign} onChange={() => setAssign(false)} />{t.form.approve}</label><label className="flex items-center gap-1.5"><input type="radio" name="decision" checked={assign} onChange={() => setAssign(true)} />{t.form.assign}</label></div>}
    {assign && !isStaff && <label className="block text-xs font-medium text-slate-600">{t.form.staff}<select aria-label={t.form.staff} required className={`${inputClass} mt-1`} value={staff} onChange={(event) => setStaff(event.target.value)}><option value="">{t.form.selectStaff}</option>{people.filter((person) => person.id !== actor && person.id.startsWith("ws-staff-")).map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>}
    <label className="block text-xs font-medium text-slate-600">{t.form.comment} <span className="text-red-500">*</span><textarea aria-label={t.form.comment} required maxLength={4000} rows={3} className={`${inputClass} mt-1 resize-y`} placeholder={assign ? t.form.assignmentPlaceholder : t.form.reviewPlaceholder} value={comment} onChange={(event) => setComment(event.target.value)} /></label>
    {error && <p role="alert" className="text-xs text-red-600">{reviewErrorText(error, locale)}</p>}
    <div className="flex justify-end"><button type="submit" className={buttonClass("primary")}>{isStaff || assign ? <Send className="h-4 w-4" /> : <Check className="h-4 w-4" />}{isStaff ? t.form.confirm : assign ? t.form.sendAssignment : t.form.approveDepartment}</button></div>
  </form>;
}