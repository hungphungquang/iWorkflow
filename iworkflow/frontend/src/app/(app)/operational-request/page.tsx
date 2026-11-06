"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, BarChart3, Check, CheckCheck, ChevronLeft, ChevronRight, Clock3, Database, Download, FileText, FlaskConical, History, Hourglass, Inbox, Loader2, LockKeyhole, PackageCheck, Paperclip, Plus, RefreshCw, RotateCcw, Search, Send, X } from "lucide-react";
import { Badge, PageHeader, buttonClass, inputClass } from "@/components/ui";
import {
  applyOrfAction, createOrfRequest, emptyOrfResult, isOrfOverdue, isOrfStale, ORF_OPEN_STAGES, orfInputFrom, orfReachedIndex, orfStatus,
  type OperationalRequest, type OrfAction, type OrfOpenStage, type OrfPeriod, type OrfPerson, type OrfRequestInput, type OrfResult, type OrfStatus,
} from "@/lib/operational-request";
import { fmtDate, fmtDateTime, fmtNum, useLocale, useMessages } from "@/lib/i18n";
import { operationalRequestMessages, orfErrorText } from "@/lib/i18n-operational-request";
import { orfDemoStore as demoStore, useOperationalRequestData } from "@/lib/operational-request-store";

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
const pageSize = 20;
const statusTone = { open: "amber", completed: "green", rejected: "red", cancelled: "gray" } as const;
const SHIFTS = ["A", "B", "C", "G", "HC"];
type Notice = OrfAction["type"] | "create" | "";
type Tab = "request" | "result" | "history" | "attachments";

export default function OperationalRequestPage() {
  const params = useSearchParams();
  return <OperationalRequestWorkspace key={params.toString()} />;
}

function OperationalRequestWorkspace() {
  const locale = useLocale();
  const t = useMessages(operationalRequestMessages);
  const params = useSearchParams();
  const date = (value: string) => value ? fmtDateTime(value, locale) : t.common.notAvailable;
  const number = (value: number) => fmtNum(value, locale);
  const { mode, setMode, snapshot, loading, error, reload } = useOperationalRequestData(params.get("source"));
  const [query, setQuery] = useState(params.get("q") || "");
  const [status, setStatus] = useState(params.get("status") || "all");
  const [stage, setStage] = useState(params.get("stage") || "");
  const [department, setDepartment] = useState(params.get("department") || "");
  const [since, setSince] = useState(params.get("since") || "");
  const [assignee, setAssignee] = useState(params.get("assignee") || "");
  const [onlyMine, setOnlyMine] = useState(false);
  const [actor, setActor] = useState("orf-pic-fi");
  const [selectedId, setSelectedId] = useState(params.get("request") || "");
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState<Tab>("request");
  const [page, setPage] = useState(0);
  const [notice, setNotice] = useState<Notice>("");
  const [mobileDetail, setMobileDetail] = useState(!!params.get("request"));
  const detailRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (mobileDetail && window.matchMedia("(max-width: 1023px)").matches) detailRef.current?.scrollIntoView({ block: "start" });
  }, [mobileDetail]);

  const requests = useMemo(() => snapshot?.requests ?? [], [snapshot]);
  const people = useMemo(() => snapshot?.people ?? [], [snapshot]);
  const now = snapshot?.loadedAt ?? "";
  const name = (id: string) => people.find((person) => person.id === id)?.name || id || t.common.unknown;
  const departmentName = (value: string) => value === "—" || !value ? t.common.unknown : value;
  const haystacks = useMemo(() => {
    const names = new Map(people.map((person) => [person.id, person.name]));
    return new Map(requests.map((request) => [request.id, normalize([
      request.code, request.id, request.title, request.productCode, request.quantity, request.reason, request.department,
      request.requester, request.approver, names.get(request.requester) ?? "", names.get(request.approver) ?? "", names.get(request.assignee) ?? "", ...request.barcodes,
    ].join(" "))]));
  }, [requests, people]);
  const needle = normalize(query.trim());
  const filtered = requests.filter((request) => {
    const state = orfStatus(request);
    if (status === "overdue" ? !isOrfOverdue(request, now) : status === "onTime" ? state !== "open" || isOrfOverdue(request, now) : status === "closed" ? state !== "rejected" && state !== "cancelled" : status === "stale" ? !isOrfStale(request, now) : status !== "all" && state !== status) return false;
    if (stage && request.stage !== stage) return false;
    if (department && request.department !== department) return false;
    if (since && (Date.parse(request.startedAt) < Date.parse(since) || Date.parse(request.startedAt) > Date.parse(now))) return false;
    if (assignee && (state !== "open" || request.assignee !== assignee)) return false;
    if (onlyMine && (state !== "open" || request.assignee !== actor)) return false;
    return !needle || (haystacks.get(request.id) ?? "").includes(needle);
  });
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages - 1);
  const visible = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const selected = filtered.find((request) => request.id === selectedId) ?? (creating ? undefined : visible[0]);
  const open = requests.filter((request) => orfStatus(request) === "open");
  const departments = [...new Set(requests.map((request) => request.department))].sort();
  const knownDepartments = departments.filter((value) => value !== "—");

  function resetSelection() {
    setSelectedId("");
    setCreating(false);
    setMobileDetail(false);
    setPage(0);
    setNotice("");
  }

  function clearFilters() {
    setQuery("");
    setStatus("all");
    setStage("");
    setDepartment("");
    setSince("");
    setAssignee("");
    setOnlyMine(false);
  }

  function applyFilter(next: { status?: string; stage?: string }) {
    setStatus(next.status ?? "all");
    setStage(next.stage ?? "");
    resetSelection();
  }

  function changeMode(next: "demo" | "iw_prod") {
    setMode(next);
    clearFilters();
    resetSelection();
  }

  function handleAction(request: OperationalRequest, action: OrfAction) {
    if (mode !== "demo" || !snapshot) return;
    const next = applyOrfAction(request, action, actor, new Date().toISOString(), snapshot.people);
    demoStore.set((current) => ({ ...current, requests: current.requests.map((item) => item.id === next.id ? next : item) }));
    setSelectedId(next.id);
    setNotice(action.type);
  }

  function handleCreate(input: OrfRequestInput) {
    if (mode !== "demo" || !snapshot) return;
    const created = createOrfRequest(input, actor, new Date().toISOString(), snapshot);
    demoStore.set((current) => ({ ...current, requests: [created, ...current.requests] }));
    clearFilters();
    setPage(0);
    setCreating(false);
    setSelectedId(created.id);
    setTab("request");
    setNotice("create");
  }

  const kpis = [
    { key: "open", label: t.queue.open, value: open.length, icon: Hourglass, color: "text-amber-700", filter: { status: "open" } },
    { key: "overdue", label: t.queue.overdue, value: open.filter((request) => isOrfOverdue(request, now)).length, icon: Clock3, color: "text-red-600", filter: { status: "overdue" } },
    { key: "result", label: t.queue.awaitingResult, value: open.filter((request) => request.stage === "result").length, icon: PackageCheck, color: "text-blue-700", filter: { status: "open", stage: "result" } },
    { key: "stale", label: t.queue.stale, value: open.filter((request) => isOrfStale(request, now)).length, icon: AlertTriangle, color: "text-slate-700", filter: { status: "stale" } },
  ];
  const awaitingResult = kpis[2].value;

  return (
    <>
      <PageHeader title={t.common.title} description={t.queue.description} actions={
        <>
          {mode === "demo" && <button type="button" className={buttonClass("primary")} onClick={() => { setCreating(true); setSelectedId(""); setMobileDetail(true); setNotice(""); }}><Plus className="h-4 w-4" />{t.queue.newRequest}</button>}
          <Link href={`/operational-request/dashboard?source=${mode}`} className={buttonClass()}><BarChart3 className="h-4 w-4" />{t.common.dashboard}</Link>
          <button type="button" title={t.common.refreshData} aria-label={t.common.refreshData} disabled={loading} className={`${buttonClass()} disabled:opacity-50`} onClick={() => { reload(); setNotice(""); }}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />{t.common.refresh}
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
          {([["iw_prod", t.common.production], ["demo", t.common.demo]] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={mode === value} onClick={() => changeMode(value)} className={`rounded px-3 py-1 text-xs font-medium ${mode === value ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{label}</button>)}
        </div>
      </div>

      {loading ? <div role="status" className="flex items-center justify-center gap-2 py-20 text-sm text-slate-600"><Loader2 className="h-5 w-5 animate-spin" />{t.queue.loading}</div> : error ? (
        <div role="alert" className="border-l-4 border-red-500 bg-red-50 p-5 text-sm text-red-800"><p>{t.common.loadError}</p><button type="button" className={`${buttonClass()} mt-3`} onClick={reload}><RefreshCw className="h-4 w-4" />{t.common.retry}</button></div>
      ) : <>
        <div className="mb-4 grid grid-cols-2 divide-x divide-slate-200 border-b border-slate-200 pb-5 lg:grid-cols-4">
          {kpis.map(({ key, label, value, icon: Icon, color, filter }) => <button key={key} type="button" onClick={() => applyFilter(filter)} className="px-3 py-2 text-left first:pl-0 hover:bg-white md:px-5"><span className="flex items-center gap-2 text-xs text-slate-500"><Icon className="h-4 w-4" />{label}</span><span className={`mt-2 block text-2xl font-semibold ${color}`}>{number(value)}</span></button>)}
        </div>
        <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-500">
          <span>{mode === "iw_prod" ? t.queue.scope : t.queue.demoScope}</span>
          {awaitingResult > 0 && <button type="button" className="text-left text-blue-700 hover:underline" onClick={() => applyFilter({ status: "open", stage: "result" })}>{t.queue.backlogNote(number(awaitingResult))}</button>}
        </div>
        {notice && <div role="status" className="mb-4 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCheck className="h-4 w-4 shrink-0" />{t.queue.notice[notice]}</div>}
        {(since || assignee) && <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-blue-700">
          {since && <span className="inline-flex gap-2">{t.queue.startedSince(fmtDate(since, locale))}<button type="button" className="underline" onClick={() => { setSince(""); resetSelection(); }}>{t.queue.clearPeriod}</button></span>}
          {assignee && <span className="inline-flex gap-2">{t.queue.assigneeFilter(name(assignee))}<button type="button" className="underline" onClick={() => { setAssignee(""); resetSelection(); }}>{t.queue.clearAssignee}</button></span>}
        </div>}

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(17rem,0.7fr)_minmax(0,1.6fr)]">
          <section aria-label={t.queue.list} className={`min-w-0 lg:sticky lg:top-0 ${mobileDetail ? "hidden lg:block" : ""}`}>
            <h2 className="mb-3 text-sm font-semibold text-slate-900">{t.queue.heading} <span className="ml-1 font-normal text-slate-500">({number(filtered.length)})</span></h2>
            <div className="relative mb-2"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input aria-label={t.queue.search} placeholder={t.queue.searchPlaceholder} className={`${inputClass} pl-9`} value={query} onChange={(event) => { setQuery(event.target.value); resetSelection(); }} /></div>
            <div className="mb-2 grid grid-cols-2 gap-2">
              <select aria-label={t.common.status} className={inputClass} value={status} onChange={(event) => { setStatus(event.target.value); resetSelection(); }}>
                <option value="all">{t.common.allStatuses}</option>
                {(["open", "completed", "rejected", "cancelled"] as OrfStatus[]).map((value) => <option key={value} value={value}>{t.statuses[value]}</option>)}
                <option value="onTime">{t.common.onTime}</option><option value="overdue">{t.common.overdue}</option><option value="closed">{t.common.closed}</option><option value="stale">{t.common.stale}</option>
              </select>
              <select aria-label={t.common.department} className={inputClass} value={department} onChange={(event) => { setDepartment(event.target.value); resetSelection(); }}><option value="">{t.common.allDepartments}</option>{departments.map((value) => <option key={value} value={value}>{departmentName(value)}</option>)}</select>
            </div>
            <select aria-label={t.common.stage} className={`${inputClass} mb-3`} value={stage} onChange={(event) => { setStage(event.target.value); resetSelection(); }}><option value="">{t.common.allStages}</option>{[...ORF_OPEN_STAGES, "unknown" as const].map((value) => <option key={value} value={value}>{t.stages[value]}</option>)}</select>
            {mode === "demo" && <div className="mb-3 space-y-2 border-b border-slate-200 pb-3"><label className="block text-xs text-slate-500">{t.queue.actor}<select aria-label={t.queue.actor} className={`${inputClass} mt-1`} value={actor} onChange={(event) => { setActor(event.target.value); setNotice(""); setPage(0); }}>{people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label><label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={onlyMine} onChange={(event) => { setOnlyMine(event.target.checked); resetSelection(); }} />{t.queue.mineOnly}</label></div>}
            <div className="max-h-[36rem] divide-y divide-slate-200 overflow-y-auto border-y border-slate-200">
              {visible.map((request) => {
                const state = orfStatus(request);
                const late = isOrfOverdue(request, now);
                return <button type="button" key={request.id} aria-pressed={selected?.id === request.id} onClick={() => { setSelectedId(request.id); setCreating(false); setTab("request"); setMobileDetail(true); setNotice(""); }} className={`block w-full border-l-[3px] p-3 text-left transition-colors ${selected?.id === request.id ? "border-l-blue-600 bg-blue-50/80" : "border-l-transparent hover:bg-white"}`}>
                  <span className="flex flex-wrap items-center justify-between gap-2"><span className="font-mono text-xs font-semibold text-blue-700">{request.code}</span><Badge tone={late ? "red" : statusTone[state]}>{state === "open" ? (late ? t.common.overdue : t.statuses.open) : t.statuses[state]}</Badge></span>
                  <span className="mt-2 line-clamp-2 block break-words text-sm font-medium leading-5 text-slate-900">{request.title || request.productCode || t.common.notAvailable}</span>
                  <span className="mt-1 block truncate text-xs text-slate-500">{state === "open" ? `${t.stages[request.stage]} · ${name(request.assignee)}` : `${fmtDate(request.endedAt || request.startedAt, locale)} · ${name(request.requester)}`}</span>
                </button>;
              })}
              {!visible.length && <div className="py-12 text-center text-sm text-slate-500"><Inbox className="mx-auto mb-2 h-7 w-7 text-slate-300" />{t.queue.empty}<button type="button" className="mx-auto mt-3 block text-blue-700 hover:underline" onClick={() => { clearFilters(); resetSelection(); }}>{t.queue.clearFilters}</button></div>}
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500"><span>{t.queue.page(number(currentPage + 1), number(pages))}</span><div className="flex gap-1"><button type="button" aria-label={t.queue.previous} title={t.queue.previous} disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} className={`${buttonClass("ghost")} disabled:opacity-30`}><ChevronLeft className="h-4 w-4" /></button><button type="button" aria-label={t.queue.next} title={t.queue.next} disabled={currentPage >= pages - 1} onClick={() => setPage(currentPage + 1)} className={`${buttonClass("ghost")} disabled:opacity-30`}><ChevronRight className="h-4 w-4" /></button></div></div>
          </section>

          <section ref={detailRef} aria-label={t.queue.detail} className={`min-w-0 ${mobileDetail ? "" : "hidden lg:block"}`}>
            <button type="button" className={`${buttonClass("ghost")} mb-3 lg:hidden`} onClick={() => { setMobileDetail(false); setCreating(false); }}><ChevronLeft className="h-4 w-4" />{t.queue.heading}</button>
            {creating && mode === "demo" && snapshot ? <RequestForm title={t.form.createTitle} submitLabel={t.form.submit} requester={actor} people={people} departments={knownDepartments} initial={blankInput(people, actor)} onSubmit={handleCreate} onCancel={() => { setCreating(false); setMobileDetail(false); }} />
              : !selected ? <div className="flex min-h-64 flex-col items-center justify-center border border-dashed border-slate-300 text-sm text-slate-500"><FileText className="mb-3 h-9 w-9 text-slate-300" />{t.queue.noSelection}</div>
              : <RequestDetail key={selected.id} request={selected} now={now} mode={mode} tab={tab} setTab={setTab} name={name} departmentName={departmentName} actor={actor} people={people} departments={knownDepartments} onAction={(action) => handleAction(selected, action)} />}
          </section>
        </div>
      </>}
    </>
  );
}

function blankInput(people: OrfPerson[], requester: string): OrfRequestInput {
  const period = (shift: string): OrfPeriod => ({ shift, date: "" });
  return {
    department: requester === "orf-pic-qa" ? "QA" : "FI", title: "", productCode: "", quantity: "", barcodes: "", reason: "",
    lotFrom: period(""), lotTo: period(""), desiredFrom: period("HC"), desiredTo: period("HC"), plannedDate: "", plannedHandling: "",
    approver: people.find((person) => person.role === "approver" && person.id !== requester)?.id ?? "",
  };
}

type DetailProps = {
  request: OperationalRequest; now: string; mode: "demo" | "iw_prod"; tab: Tab; setTab: (tab: Tab) => void;
  name: (id: string) => string; departmentName: (value: string) => string;
  actor: string; people: OrfPerson[]; departments: string[]; onAction: (action: OrfAction) => void;
};

function RequestDetail({ request, now, mode, tab, setTab, name, departmentName, actor, people, departments, onAction }: DetailProps) {
  const locale = useLocale();
  const t = useMessages(operationalRequestMessages);
  const date = (value: string) => value ? fmtDateTime(value, locale) : t.common.notAvailable;
  const number = (value: number) => fmtNum(value, locale);
  const state = orfStatus(request);
  const late = isOrfOverdue(request, now);
  const stale = isOrfStale(request, now);
  const idleDays = Math.floor((Date.parse(now) - Date.parse(request.lastActivityAt || request.startedAt)) / 86400000);
  const hasResult = !!(request.result.total || request.result.ok || request.result.ng || request.result.reason);
  const tabs: { id: Tab; label: string; icon: typeof FileText }[] = [
    { id: "request", label: t.queue.tabs.request, icon: FileText },
    { id: "result", label: t.queue.tabs.result, icon: PackageCheck },
    { id: "history", label: `${t.queue.tabs.history} (${number(request.history.length)})`, icon: History },
    { id: "attachments", label: `${t.queue.tabs.attachments} (${number(request.attachments.length)})`, icon: Paperclip },
  ];
  const meta: [string, string, boolean?][] = [
    [t.common.department, departmentName(request.department)], [t.queue.requester, name(request.requester)], [t.queue.approver, name(request.approver)],
    [t.queue.started, date(request.startedAt)],
    ...(state === "open" ? [[t.queue.assignee, name(request.assignee)], [t.queue.taskDue, date(request.dueAt), late]] as [string, string, boolean?][] : [[t.queue.ended, date(request.endedAt)]] as [string, string][]),
    ...(request.endReason ? [[t.queue.endReason, request.endReason]] as [string, string][] : []),
  ];

  return <>
    <div className="border-b border-slate-200 pb-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-sm font-semibold text-blue-700">{request.code}<span className="ml-2 text-xs font-normal text-slate-400">#{request.id}</span></span>
        <div className="flex flex-wrap gap-1.5">{late && <Badge tone="red">{t.common.overdue}</Badge>}{stale && <Badge tone="gray">{t.common.stale}</Badge>}<Badge tone={statusTone[state]}>{state === "open" ? t.stages[request.stage] : t.statuses[state]}</Badge></div>
      </div>
      <h2 className="mt-3 break-words text-lg font-semibold leading-7 text-slate-900">{request.title || request.productCode || t.common.notAvailable}</h2>
      <dl className="mt-3 grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2 xl:grid-cols-3">
        {meta.map(([label, value, alert]) => <div key={label} className="min-w-0"><dt className="text-slate-500">{label}</dt><dd className={`mt-0.5 break-words font-medium ${alert ? "text-red-600" : "text-slate-800"}`}>{value}</dd></div>)}
      </dl>
      {stale && <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-slate-600"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />{t.queue.lastActivity(number(idleDays))}. {t.queue.staleNote}</p>}
      <Stepper request={request} />
    </div>

    <div className="flex gap-1 overflow-x-auto border-b border-slate-200" role="tablist" aria-label={t.queue.detail}>
      {tabs.map(({ id, label, icon: Icon }) => <button type="button" key={id} role="tab" id={`orf-tab-${id}`} aria-selected={tab === id} aria-controls={`orf-panel-${id}`} onClick={() => setTab(id)} className={`inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-3 text-xs font-medium ${tab === id ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}><Icon className="h-4 w-4" />{label}</button>)}
    </div>
    <div role="tabpanel" id={`orf-panel-${tab}`} aria-labelledby={`orf-tab-${tab}`} className="py-5">
      {tab === "request" && <RequestSheet request={request} mode={mode} />}
      {tab === "result" && (hasResult ? <ResultSheet result={request.result} /> : <p className="text-sm text-slate-500">{t.queue.noResult}</p>)}
      {tab === "history" && <ol className="space-y-5 border-l border-slate-200 pl-5">{request.history.map((event, index) => <li key={`${event.at}-${index}`} className="relative">
        <span className={`absolute -left-[25px] top-1 h-2 w-2 rounded-full ${event.status === "pending" ? "bg-amber-500" : event.status === "stopped" || event.decision === "reject" ? "bg-red-500" : event.decision === "revise" ? "bg-violet-500" : "bg-blue-500"}`} />
        <p className="text-xs text-slate-500">{date(event.at)} · {name(event.actor)}</p>
        <p className="mt-1 break-words text-sm font-medium text-slate-800">{t.steps[event.stage]} · {event.status === "completed" ? t.decisions[event.decision] : t.taskStatuses[event.status]}</p>
        {event.comment && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-600">{event.comment}</p>}
      </li>)}{!request.history.length && <li className="text-sm text-slate-500">{t.queue.noHistory}</li>}</ol>}
      {tab === "attachments" && (request.attachments.length ? <ul className="divide-y divide-slate-200">{request.attachments.map((file) => <li key={file.id} className="flex items-center gap-2 py-2"><FileText className="h-4 w-4 shrink-0 text-slate-400" /><span className="min-w-0 flex-1 break-words text-xs text-slate-700">{file.name}</span>{file.url && <a href={file.url} target="_blank" rel="noopener noreferrer" title={t.queue.openDocument(file.name)} aria-label={t.queue.openDocument(file.name)} className={buttonClass("ghost")}><Download className="h-4 w-4" /></a>}</li>)}</ul> : <p className="text-sm text-slate-500">{t.queue.noAttachments}</p>)}
    </div>
    {mode === "iw_prod" ? <div className="flex items-start gap-2 border-t border-slate-200 py-4 text-xs leading-5 text-slate-500"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />{t.queue.readOnlyNote}</div>
      : <ActionPanel key={`${request.id}-${request.stage}-${request.history.length}-${actor}`} request={request} actor={actor} people={people} departments={departments} name={name} onAction={onAction} />}
  </>;
}

function Stepper({ request }: { request: OperationalRequest }) {
  const t = useMessages(operationalRequestMessages);
  const reached = orfReachedIndex(request);
  const state = orfStatus(request);
  return <ol aria-label={t.queue.progress} className="mt-4 grid grid-cols-4 gap-1 sm:grid-cols-8">
    {ORF_OPEN_STAGES.map((step, index) => {
      const done = index < reached;
      const current = index === reached && state === "open";
      const stopped = index === reached && (state === "rejected" || state === "cancelled");
      return <li key={step} aria-current={current ? "step" : undefined} className="min-w-0">
        <span className={`block h-1.5 rounded-full ${done ? "bg-emerald-500" : current ? "bg-amber-400" : stopped ? (state === "rejected" ? "bg-red-500" : "bg-slate-400") : "bg-slate-200"}`} />
        <span className={`mt-1.5 block text-[10px] leading-3 ${current ? "font-semibold text-amber-800" : stopped ? "font-semibold text-red-700" : done ? "text-slate-700" : "text-slate-400"}`}>{t.steps[step]}</span>
      </li>;
    })}
  </ol>;
}

function Field({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return <div className={`min-w-0 border-b border-slate-100 py-2.5 ${wide ? "sm:col-span-2" : ""}`}><dt className="text-xs font-medium text-slate-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-800">{children}</dd></div>;
}

function RequestSheet({ request, mode }: { request: OperationalRequest; mode: "demo" | "iw_prod" }) {
  const locale = useLocale();
  const t = useMessages(operationalRequestMessages);
  const f = t.queue.fields;
  const day = (value: string) => value ? fmtDate(`${value}T00:00:00+07:00`, locale) : "";
  const side = (value: OrfPeriod) => [value.shift && `${f.shift} ${value.shift}`, day(value.date)].filter(Boolean).join(" · ");
  const period = (from: OrfPeriod, to: OrfPeriod) => side(from) || side(to) ? `${side(from) || t.queue.blank} ~ ${side(to) || t.queue.blank}` : t.queue.blank;
  return <div className="border border-slate-200 bg-white p-5">
    <div className="border-b-2 border-slate-800 pb-3 text-center"><p className="text-sm font-bold tracking-wide text-slate-900">{t.queue.formTitle}</p><p className="text-[11px] font-semibold tracking-widest text-slate-500">{t.queue.formSubtitle}</p></div>
    <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-600">{t.queue.sectionRequest}</h3>
    <dl className="mt-1 grid gap-x-6 sm:grid-cols-2">
      <Field label={f.title} wide>{request.title || t.queue.blank}</Field>
      <Field label={f.productCode}>{request.productCode || t.queue.blank}</Field>
      <Field label={f.quantity}>{request.quantity || t.queue.blank}</Field>
      <Field label={`${f.barcodes} · ${t.queue.barcodeCount(fmtNum(request.barcodeCount, locale))}`} wide><Barcodes request={request} mode={mode} /></Field>
      <Field label={f.reason} wide>{request.reason || t.queue.blank}</Field>
      <Field label={f.lotRange} wide>{period(request.lotFrom, request.lotTo)}</Field>
      <Field label={f.desired} wide>{period(request.desiredFrom, request.desiredTo)}</Field>
      <Field label={f.planned} wide>{[day(request.plannedDate), request.plannedHandling].filter(Boolean).join(" · ") || t.queue.blank}</Field>
      <Field label={f.warehouse} wide>{request.warehouseConfirm || t.queue.blank}</Field>
    </dl>
  </div>;
}

function Barcodes({ request, mode }: { request: OperationalRequest; mode: "demo" | "iw_prod" }) {
  const locale = useLocale();
  const t = useMessages(operationalRequestMessages);
  const [full, setFull] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const lines = full ?? request.barcodes;
  async function loadAll() {
    setLoading(true);
    setError(false);
    try {
      const response = await fetch(`/api/operational-request/barcodes/${encodeURIComponent(request.id)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setFull(data.barcodes as string[]);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }
  if (!lines.length) return <>{t.queue.blank}</>;
  return <>
    <span className="block max-h-56 overflow-y-auto rounded border border-slate-200 bg-slate-50 p-2 font-mono text-xs leading-5">{lines.map((line, index) => <span key={index} className="block">{line}</span>)}</span>
    {!full && mode === "iw_prod" && request.barcodeCount > request.barcodes.length && <button type="button" disabled={loading} onClick={loadAll} className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:underline disabled:opacity-50">{loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{loading ? t.queue.loadingBarcodes : t.queue.showAllBarcodes(fmtNum(request.barcodeCount, locale))}</button>}
    {error && <span role="alert" className="mt-1 block text-xs text-red-600">{t.queue.barcodeError}</span>}
  </>;
}

function ResultSheet({ result }: { result: OrfResult }) {
  const locale = useLocale();
  const t = useMessages(operationalRequestMessages);
  const f = t.queue.fields;
  const day = (value: string) => value ? fmtDate(`${value}T00:00:00+07:00`, locale) : t.queue.blank;
  return <div className="border border-slate-200 bg-white p-5">
    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">{t.queue.sectionResult}</h3>
    <dl className="mt-1 grid gap-x-6 sm:grid-cols-3">
      <Field label={f.total}>{result.total || t.queue.blank}</Field>
      <Field label={f.ok}>{result.ok || t.queue.blank}</Field>
      <Field label={f.ng}>{result.ng || t.queue.blank}</Field>
    </dl>
    <dl className="grid gap-x-6 sm:grid-cols-2">
      <Field label={f.resultReason} wide>{result.reason || t.queue.blank}</Field>
      <Field label={f.ngHandling}>{result.ngHandling ? `${t.queue.ngHandling[result.ngHandling]} · ${day(result.ngDate)}` : t.queue.blank}</Field>
      <Field label={f.okHandling}>{result.okRelease ? t.queue.okRelease : t.queue.okHold}</Field>
      <Field label={f.returnedAt}>{day(result.returnedAt)}</Field>
      <Field label={f.changePlace}>{result.changePlace || t.queue.blank}</Field>
    </dl>
  </div>;
}

function ActionPanel({ request, actor, people, departments, name, onAction }: { request: OperationalRequest; actor: string; people: OrfPerson[]; departments: string[]; name: (id: string) => string; onAction: (action: OrfAction) => void }) {
  const locale = useLocale();
  const t = useMessages(operationalRequestMessages);
  const [comment, setComment] = useState("");
  const [decision, setDecision] = useState<"approve" | "revise" | "reject">("approve");
  const [warehouseConfirm, setWarehouseConfirm] = useState(request.warehouseConfirm);
  const [result, setResult] = useState<OrfResult>(request.result.total || request.result.reason ? { ...request.result } : { ...emptyOrfResult(), okRelease: true });
  const [error, setError] = useState("");
  if (orfStatus(request) !== "open" || request.stage === "unknown") return null;
  if (request.assignee !== actor) return <p className="flex items-center gap-2 border-t border-slate-200 py-4 text-xs text-slate-500"><LockKeyhole className="h-4 w-4 shrink-0" />{t.form.assignedTo(name(request.assignee))}</p>;
  const stage = request.stage as OrfOpenStage;
  if (stage === "request") return <div className="border-t border-slate-200 pt-4"><RequestForm title={t.form.titles.request} submitLabel={t.form.resubmit} requester={request.requester} people={people} departments={departments} initial={orfInputFrom(request)} onSubmit={(input) => onAction({ type: "submit", input })} /></div>;
  const run = (action: OrfAction) => {
    setError("");
    try { onAction(action); } catch (failure) { setError(failure instanceof Error ? failure.message : t.form.failed); }
  };
  const approval = stage === "approval" || stage === "resultApproval";
  const setField = <K extends keyof OrfResult>(key: K, value: OrfResult[K]) => setResult((current) => ({ ...current, [key]: value }));
  const f = t.queue.fields;
  return <form className="space-y-3 border-t border-slate-200 pt-4" onSubmit={(event) => {
    event.preventDefault();
    if (approval) run({ type: decision, comment });
    else if (stage === "pic3312" || stage === "warehouse") run({ type: "receive", comment, warehouseConfirm });
    else if (stage === "result") run({ type: "result", result, comment });
    else run({ type: "confirm", comment });
  }}>
    <h3 className="text-sm font-semibold text-slate-900">{t.form.titles[stage]}</h3>
    {approval && <div className="flex flex-wrap gap-4 text-xs text-slate-700" role="radiogroup" aria-label={t.form.titles[stage]}>{(["approve", "revise", "reject"] as const).map((value) => <label key={value} className="flex items-center gap-1.5"><input type="radio" name="orf-decision" checked={decision === value} onChange={() => setDecision(value)} />{t.form[value]}</label>)}</div>}
    {stage === "warehouse" && <label className="block text-xs font-medium text-slate-600">{f.warehouse} <span className="text-red-500">*</span><textarea required maxLength={4000} rows={3} className={`${inputClass} mt-1 resize-y`} placeholder={t.form.warehouseHint} value={warehouseConfirm} onChange={(event) => setWarehouseConfirm(event.target.value)} /></label>}
    {stage === "result" && <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">{(["total", "ok", "ng"] as const).map((key) => <label key={key} className="block text-xs font-medium text-slate-600">{f[key]} <span className="text-red-500">*</span><input required maxLength={200} className={`${inputClass} mt-1`} value={result[key]} onChange={(event) => setField(key, event.target.value)} /></label>)}</div>
      <label className="block text-xs font-medium text-slate-600">{f.resultReason} <span className="text-red-500">*</span><textarea required maxLength={4000} rows={2} className={`${inputClass} mt-1 resize-y`} value={result.reason} onChange={(event) => setField("reason", event.target.value)} /></label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-slate-600">{f.ngHandling}<select className={`${inputClass} mt-1`} value={result.ngHandling} onChange={(event) => setField("ngHandling", event.target.value as OrfResult["ngHandling"])}>{(["", "return", "keep"] as const).map((value) => <option key={value} value={value}>{t.queue.ngHandling[value]}</option>)}</select></label>
        <label className="block text-xs font-medium text-slate-600">{f.ngDate}<input type="date" required={!!result.ngHandling} className={`${inputClass} mt-1`} value={result.ngDate} onChange={(event) => setField("ngDate", event.target.value)} /></label>
        <label className="block text-xs font-medium text-slate-600">{f.returnedAt}<input type="date" className={`${inputClass} mt-1`} value={result.returnedAt} onChange={(event) => setField("returnedAt", event.target.value)} /></label>
        <label className="flex items-center gap-2 self-end pb-2 text-xs font-medium text-slate-600"><input type="checkbox" checked={result.okRelease} onChange={(event) => setField("okRelease", event.target.checked)} />{f.okHandling}: {t.queue.okRelease}</label>
      </div>
      <label className="block text-xs font-medium text-slate-600">{f.changePlace}<input maxLength={1000} className={`${inputClass} mt-1`} value={result.changePlace} onChange={(event) => setField("changePlace", event.target.value)} /></label>
    </div>}
    <label className="block text-xs font-medium text-slate-600">{t.form.comment}{approval && decision !== "approve" && <span className="text-red-500"> *</span>}<textarea required={approval && decision !== "approve"} maxLength={4000} rows={2} className={`${inputClass} mt-1 resize-y`} placeholder={approval ? t.form.commentHint : t.form.commentPlaceholder} value={comment} onChange={(event) => setComment(event.target.value)} /></label>
    {error && <p role="alert" className="text-xs text-red-600">{orfErrorText(error, locale)}</p>}
    <div className="flex justify-end"><button type="submit" className={buttonClass(approval && decision === "reject" ? "danger" : "primary")}>
      {approval ? (decision === "approve" ? <Check className="h-4 w-4" /> : decision === "revise" ? <RotateCcw className="h-4 w-4" /> : <X className="h-4 w-4" />) : <Send className="h-4 w-4" />}
      {approval ? t.form[decision] : stage === "pic3312" || stage === "warehouse" ? t.form.receive : stage === "result" ? t.form.sendResult : t.form.confirm}
    </button></div>
  </form>;
}

function RequestForm({ title, submitLabel, requester, people, departments, initial, onSubmit, onCancel }: {
  title: string; submitLabel: string; requester: string; people: OrfPerson[]; departments: string[]; initial: OrfRequestInput;
  onSubmit: (input: OrfRequestInput) => void; onCancel?: () => void;
}) {
  const locale = useLocale();
  const t = useMessages(operationalRequestMessages);
  const [input, setInput] = useState(initial);
  const [error, setError] = useState("");
  const f = t.queue.fields;
  const set = <K extends keyof OrfRequestInput>(key: K, value: OrfRequestInput[K]) => setInput((current) => ({ ...current, [key]: value }));
  const approvers = people.filter((person) => person.role === "approver" && person.id !== requester);
  const periodInputs = (label: string, fromKey: "lotFrom" | "desiredFrom", toKey: "lotTo" | "desiredTo") => <fieldset className="min-w-0">
    <legend className="text-xs font-medium text-slate-600">{label}</legend>
    <div className="mt-1 grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[4.5rem_minmax(0,1fr)_auto_4.5rem_minmax(0,1fr)]">
      <input aria-label={`${label} · ${f.from} · ${f.shift}`} list="orf-shifts" maxLength={10} placeholder={f.shift} className={inputClass} value={input[fromKey].shift} onChange={(event) => set(fromKey, { ...input[fromKey], shift: event.target.value })} />
      <input aria-label={`${label} · ${f.from} · ${f.date}`} type="date" className={inputClass} value={input[fromKey].date} onChange={(event) => set(fromKey, { ...input[fromKey], date: event.target.value })} />
      <span className="hidden text-xs text-slate-400 sm:inline">~</span>
      <input aria-label={`${label} · ${f.to} · ${f.shift}`} list="orf-shifts" maxLength={10} placeholder={f.shift} className={inputClass} value={input[toKey].shift} onChange={(event) => set(toKey, { ...input[toKey], shift: event.target.value })} />
      <input aria-label={`${label} · ${f.to} · ${f.date}`} type="date" className={inputClass} value={input[toKey].date} onChange={(event) => set(toKey, { ...input[toKey], date: event.target.value })} />
    </div>
  </fieldset>;
  return <form className="space-y-3" onSubmit={(event) => {
    event.preventDefault();
    setError("");
    try { onSubmit(input); } catch (failure) { setError(failure instanceof Error ? failure.message : t.form.failed); }
  }}>
    <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
    <datalist id="orf-shifts">{SHIFTS.map((shift) => <option key={shift} value={shift} />)}</datalist>
    <datalist id="orf-departments">{departments.map((value) => <option key={value} value={value} />)}</datalist>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block text-xs font-medium text-slate-600">{t.common.department} <span className="text-red-500">*</span><input required list="orf-departments" maxLength={20} className={`${inputClass} mt-1`} value={input.department} onChange={(event) => set("department", event.target.value)} /></label>
      <label className="block text-xs font-medium text-slate-600">{t.queue.approver} <span className="text-red-500">*</span><select required className={`${inputClass} mt-1`} value={input.approver} onChange={(event) => set("approver", event.target.value)}><option value="">{t.form.selectApprover}</option>{approvers.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
    </div>
    <label className="block text-xs font-medium text-slate-600">{f.title} <span className="text-red-500">*</span><input required maxLength={500} className={`${inputClass} mt-1`} value={input.title} onChange={(event) => set("title", event.target.value)} /></label>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block text-xs font-medium text-slate-600">{f.productCode} <span className="text-red-500">*</span><input required maxLength={500} className={`${inputClass} mt-1`} value={input.productCode} onChange={(event) => set("productCode", event.target.value)} /></label>
      <label className="block text-xs font-medium text-slate-600">{f.quantity} <span className="text-red-500">*</span><input required maxLength={500} className={`${inputClass} mt-1`} value={input.quantity} onChange={(event) => set("quantity", event.target.value)} /></label>
    </div>
    <label className="block text-xs font-medium text-slate-600">{f.barcodes}<textarea rows={4} className={`${inputClass} mt-1 resize-y font-mono`} placeholder={t.form.barcodeHint} value={input.barcodes} onChange={(event) => set("barcodes", event.target.value)} /></label>
    <label className="block text-xs font-medium text-slate-600">{f.reason} <span className="text-red-500">*</span><textarea required maxLength={4000} rows={2} className={`${inputClass} mt-1 resize-y`} value={input.reason} onChange={(event) => set("reason", event.target.value)} /></label>
    {periodInputs(f.lotRange, "lotFrom", "lotTo")}
    {periodInputs(f.desired, "desiredFrom", "desiredTo")}
    <fieldset className="min-w-0">
      <legend className="text-xs font-medium text-slate-600">{f.planned}</legend>
      <div className="mt-1 grid gap-2 sm:grid-cols-[12rem_minmax(0,1fr)]">
        <input type="date" aria-label={`${f.planned} · ${f.date}`} className={inputClass} value={input.plannedDate} onChange={(event) => set("plannedDate", event.target.value)} />
        <input maxLength={1000} aria-label={f.planned} className={inputClass} value={input.plannedHandling} onChange={(event) => set("plannedHandling", event.target.value)} />
      </div>
    </fieldset>
    {error && <p role="alert" className="text-xs text-red-600">{orfErrorText(error, locale)}</p>}
    <div className="flex justify-end gap-2">{onCancel && <button type="button" className={buttonClass()} onClick={onCancel}>{t.form.cancel}</button>}<button type="submit" className={buttonClass("primary")}><Send className="h-4 w-4" />{submitLabel}</button></div>
  </form>;
}
