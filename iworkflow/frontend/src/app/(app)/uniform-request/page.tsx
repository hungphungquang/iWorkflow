"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, BarChart3, Check, CheckCheck, ChevronLeft, ChevronRight, Clock3, Database, Download, FileText, FlaskConical, History, Hourglass, Inbox, Loader2, LockKeyhole, PackageCheck, Paperclip, Plus, RefreshCw, RotateCcw, Search, Send, Users, X } from "lucide-react";
import { Badge, PageHeader, buttonClass, inputClass } from "@/components/ui";
import { fileKind } from "@/lib/file-types";
import {
  applyUniformAction, createUniformRequest, isUniformOverdue, isUniformStale, UNIFORM_DEMO_SECTIONS, UNIFORM_GA_GROUP, UNIFORM_LEGACY_STAGES, UNIFORM_OPEN_STAGES,
  UNIFORM_REQUEST_TYPES, uniformCanAct, uniformInputFrom, uniformItemRows, uniformNeedsSupervisor, uniformPath, uniformQty, uniformReachedIndex, uniformStatus,
  type UniformAction, type UniformItem, type UniformLine, type UniformOpenStage, type UniformPerson, type UniformRequest, type UniformRequestInput, type UniformStatus,
} from "@/lib/uniform-request";
import { fmtDate, fmtDateTime, fmtNum, useLocale, useMessages } from "@/lib/i18n";
import { uniformErrorText, uniformRequestMessages } from "@/lib/i18n-uniform-request";
import { uniformDemoStore as demoStore, useUniformRequestData } from "@/lib/uniform-request-store";

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
const pageSize = 20;
const statusTone = { open: "amber", completed: "green", rejected: "red", cancelled: "gray" } as const;
const APPROVAL_STAGES: UniformOpenStage[] = ["supervisor", "manager", "gaStaff", "gaManager"];
type Notice = UniformAction["type"] | "create" | "";
type Tab = "request" | "history" | "attachments";

const today = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export default function UniformRequestPage() {
  const params = useSearchParams();
  return <UniformRequestWorkspace key={params.toString()} />;
}

function UniformRequestWorkspace() {
  const locale = useLocale();
  const t = useMessages(uniformRequestMessages);
  const params = useSearchParams();
  const date = (value: string) => value ? fmtDateTime(value, locale) : t.common.notAvailable;
  const number = (value: number) => fmtNum(value, locale);
  const { mode, setMode, snapshot, loading, error, reload } = useUniformRequestData(params.get("source"));
  const [query, setQuery] = useState(params.get("q") || "");
  const [status, setStatus] = useState(params.get("status") || "all");
  const [stage, setStage] = useState(params.get("stage") || "");
  const [department, setDepartment] = useState(params.get("department") || "");
  const [since, setSince] = useState(params.get("since") || "");
  const [assignee, setAssignee] = useState(params.get("assignee") || "");
  const [onlyMine, setOnlyMine] = useState(false);
  const [actor, setActor] = useState("uni-op-fi");
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
  const name = (id: string) => id === UNIFORM_GA_GROUP ? t.common.gaGroup : people.find((person) => person.id === id)?.name || id || t.common.unknown;
  const departmentName = (value: string) => value === "—" || !value ? t.common.unknown : value;
  const haystacks = useMemo(() => {
    const names = new Map(people.map((person) => [person.id, person.name]));
    return new Map(requests.map((request) => [request.id, normalize([
      request.code, request.id, request.title, request.reason, request.department, request.section, request.sectionName, request.gaConfirm, request.receiver,
      request.requester, request.supervisor, request.manager, request.assignee,
      names.get(request.requester) ?? "", names.get(request.supervisor) ?? "", names.get(request.manager) ?? "", names.get(request.assignee) ?? "",
    ].join(" "))]));
  }, [requests, people]);
  const needle = normalize(query.trim());
  const filtered = requests.filter((request) => {
    const state = uniformStatus(request);
    if (status === "overdue" ? !isUniformOverdue(request, now) : status === "stale" ? !isUniformStale(request, now) : status !== "all" && state !== status) return false;
    if (stage && request.stage !== stage) return false;
    if (department && request.department !== department) return false;
    if (since && (Date.parse(request.startedAt) < Date.parse(since) || Date.parse(request.startedAt) > Date.parse(now))) return false;
    if (assignee && (state !== "open" || request.assignee !== assignee)) return false;
    if (onlyMine && !uniformCanAct(request, actor, people)) return false;
    return !needle || (haystacks.get(request.id) ?? "").includes(needle);
  });
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages - 1);
  const visible = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const selected = filtered.find((request) => request.id === selectedId) ?? (creating ? undefined : visible[0]);
  const open = requests.filter((request) => uniformStatus(request) === "open");
  const departments = [...new Set(requests.map((request) => request.department))].sort();
  const stageOptions = [...UNIFORM_OPEN_STAGES, ...UNIFORM_LEGACY_STAGES.filter((value) => open.some((request) => request.stage === value)), "unknown" as const];

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

  function handleAction(request: UniformRequest, action: UniformAction) {
    if (mode !== "demo" || !snapshot) return;
    const next = applyUniformAction(request, action, actor, new Date().toISOString(), snapshot.people);
    demoStore.set((current) => ({ ...current, requests: current.requests.map((item) => item.id === next.id ? next : item) }));
    setSelectedId(next.id);
    setNotice(action.type);
  }

  function handleCreate(input: UniformRequestInput) {
    if (mode !== "demo" || !snapshot) return;
    const created = createUniformRequest(input, actor, new Date().toISOString(), snapshot);
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
    { key: "overdue", label: t.queue.overdue, value: open.filter((request) => isUniformOverdue(request, now)).length, icon: Clock3, color: "text-red-600", filter: { status: "overdue" } },
    { key: "confirm", label: t.queue.awaitingConfirm, value: open.filter((request) => request.stage === "confirm").length, icon: PackageCheck, color: "text-blue-700", filter: { status: "open", stage: "confirm" } },
    { key: "stale", label: t.queue.stale, value: open.filter((request) => isUniformStale(request, now)).length, icon: AlertTriangle, color: "text-slate-700", filter: { status: "stale" } },
  ];
  const awaitingConfirm = kpis[2].value;

  return (
    <>
      <PageHeader title={t.common.title} description={t.queue.description} actions={
        <>
          {mode === "demo" && <button type="button" className={buttonClass("primary")} onClick={() => { setCreating(true); setSelectedId(""); setMobileDetail(true); setNotice(""); }}><Plus className="h-4 w-4" />{t.queue.newRequest}</button>}
          <Link href={`/uniform-request/dashboard?source=${mode}`} className={buttonClass()}><BarChart3 className="h-4 w-4" />{t.common.dashboard}</Link>
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
          {awaitingConfirm > 0 && <button type="button" className="text-left text-blue-700 hover:underline" onClick={() => applyFilter({ status: "open", stage: "confirm" })}>{t.queue.backlogNote(number(awaitingConfirm))}</button>}
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
                {(["open", "completed", "rejected", "cancelled"] as UniformStatus[]).map((value) => <option key={value} value={value}>{t.statuses[value]}</option>)}
                <option value="overdue">{t.common.overdue}</option><option value="stale">{t.common.stale}</option>
              </select>
              <select aria-label={t.common.department} className={inputClass} value={department} onChange={(event) => { setDepartment(event.target.value); resetSelection(); }}><option value="">{t.common.allDepartments}</option>{departments.map((value) => <option key={value} value={value}>{departmentName(value)}</option>)}</select>
            </div>
            <select aria-label={t.common.stage} className={`${inputClass} mb-3`} value={stage} onChange={(event) => { setStage(event.target.value); resetSelection(); }}><option value="">{t.common.allStages}</option>{stageOptions.map((value) => <option key={value} value={value}>{t.stages[value]}</option>)}</select>
            {mode === "demo" && <div className="mb-3 space-y-2 border-b border-slate-200 pb-3"><label className="block text-xs text-slate-500">{t.queue.actor}<select aria-label={t.queue.actor} className={`${inputClass} mt-1`} value={actor} onChange={(event) => { setActor(event.target.value); setNotice(""); setPage(0); }}>{people.map((person) => <option key={person.id} value={person.id}>{person.name}{person.role ? ` (${t.roles[person.role]})` : ""}</option>)}</select></label><label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={onlyMine} onChange={(event) => { setOnlyMine(event.target.checked); resetSelection(); }} />{t.queue.mineOnly}</label></div>}
            <div className="max-h-[36rem] divide-y divide-slate-200 overflow-y-auto border-y border-slate-200">
              {visible.map((request) => {
                const state = uniformStatus(request);
                const late = isUniformOverdue(request, now);
                return <button type="button" key={request.id} aria-pressed={selected?.id === request.id} onClick={() => { setSelectedId(request.id); setCreating(false); setTab("request"); setMobileDetail(true); setNotice(""); }} className={`block w-full border-l-[3px] p-3 text-left transition-colors ${selected?.id === request.id ? "border-l-blue-600 bg-blue-50/80" : "border-l-transparent hover:bg-white"}`}>
                  <span className="flex flex-wrap items-center justify-between gap-2"><span className="font-mono text-xs font-semibold text-blue-700">{request.code}</span><Badge tone={late ? "red" : statusTone[state]}>{state === "open" ? (late ? t.common.overdue : t.statuses.open) : t.statuses[state]}</Badge></span>
                  <span className="mt-2 line-clamp-2 block break-words text-sm font-medium leading-5 text-slate-900">{request.title || (request.type && t.types[request.type]) || t.common.untitled}</span>
                  <span className="mt-1 block truncate text-xs text-slate-500">{state === "open" ? `${t.stages[request.stage]} · ${name(request.assignee)}` : `${fmtDate(request.endedAt || request.startedAt, locale)} · ${name(request.requester)}`}</span>
                </button>;
              })}
              {!visible.length && <div className="py-12 text-center text-sm text-slate-500"><Inbox className="mx-auto mb-2 h-7 w-7 text-slate-300" />{t.queue.empty}<button type="button" className="mx-auto mt-3 block text-blue-700 hover:underline" onClick={() => { clearFilters(); resetSelection(); }}>{t.queue.clearFilters}</button></div>}
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500"><span>{t.queue.page(number(currentPage + 1), number(pages))}</span><div className="flex gap-1"><button type="button" aria-label={t.queue.previous} title={t.queue.previous} disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} className={`${buttonClass("ghost")} disabled:opacity-30`}><ChevronLeft className="h-4 w-4" /></button><button type="button" aria-label={t.queue.next} title={t.queue.next} disabled={currentPage >= pages - 1} onClick={() => setPage(currentPage + 1)} className={`${buttonClass("ghost")} disabled:opacity-30`}><ChevronRight className="h-4 w-4" /></button></div></div>
          </section>

          <section ref={detailRef} aria-label={t.queue.detail} className={`min-w-0 ${mobileDetail ? "" : "hidden lg:block"}`}>
            <button type="button" className={`${buttonClass("ghost")} mb-3 lg:hidden`} onClick={() => { setMobileDetail(false); setCreating(false); }}><ChevronLeft className="h-4 w-4" />{t.queue.heading}</button>
            {creating && mode === "demo" && snapshot ? <RequestForm title={t.form.createTitle} submitLabel={t.form.submit} requester={actor} people={people} initial={blankInput(people, actor)} onSubmit={handleCreate} onCancel={() => { setCreating(false); setMobileDetail(false); }} />
              : !selected ? <div className="flex min-h-64 flex-col items-center justify-center border border-dashed border-slate-300 text-sm text-slate-500"><FileText className="mb-3 h-9 w-9 text-slate-300" />{t.queue.noSelection}</div>
              : <RequestDetail key={selected.id} request={selected} now={now} mode={mode} tab={tab} setTab={setTab} name={name} departmentName={departmentName} actor={actor} people={people} onAction={(action) => handleAction(selected, action)} />}
          </section>
        </div>
      </>}
    </>
  );
}

function supervisorsOf(people: UniformPerson[], section: string, requester: string) {
  return people.filter((person) => person.role === "supervisor" && person.section === section && person.id !== requester);
}

function blankInput(people: UniformPerson[], requester: string): UniformRequestInput {
  const own = people.find((person) => person.id === requester)?.section;
  const section = UNIFORM_DEMO_SECTIONS.some((entry) => entry.code === own) ? own! : UNIFORM_DEMO_SECTIONS[0].code;
  return {
    type: "", title: "", section, supervisor: uniformNeedsSupervisor(section) ? supervisorsOf(people, section, requester)[0]?.id ?? "" : "",
    requestDate: today(), reason: "", items: uniformItemRows(),
  };
}

type DetailProps = {
  request: UniformRequest; now: string; mode: "demo" | "iw_prod"; tab: Tab; setTab: (tab: Tab) => void;
  name: (id: string) => string; departmentName: (value: string) => string;
  actor: string; people: UniformPerson[]; onAction: (action: UniformAction) => void;
};

function RequestDetail({ request, now, mode, tab, setTab, name, departmentName, actor, people, onAction }: DetailProps) {
  const locale = useLocale();
  const t = useMessages(uniformRequestMessages);
  const date = (value: string) => value ? fmtDateTime(value, locale) : t.common.notAvailable;
  const number = (value: number) => fmtNum(value, locale);
  const state = uniformStatus(request);
  const late = isUniformOverdue(request, now);
  const stale = isUniformStale(request, now);
  const idleDays = Math.floor((Date.parse(now) - Date.parse(request.lastActivityAt || request.startedAt)) / 86400000);
  const tabs: { id: Tab; label: string; icon: typeof FileText }[] = [
    { id: "request", label: t.queue.tabs.request, icon: FileText },
    { id: "history", label: `${t.queue.tabs.history} (${number(request.history.length)})`, icon: History },
    { id: "attachments", label: `${t.queue.tabs.attachments} (${number(request.attachments.length)})`, icon: Paperclip },
  ];
  const section = [request.section, request.sectionName && request.sectionName !== request.section ? request.sectionName : ""].filter(Boolean).join(" · ");
  const meta: [string, string, boolean?][] = [
    [t.common.department, section ? `${departmentName(request.department)} (${section})` : departmentName(request.department)],
    [t.queue.fields.type, t.types[request.type]], [t.queue.requester, name(request.requester)],
    ...(request.supervisor ? [[t.queue.supervisor, name(request.supervisor)]] as [string, string][] : []),
    [t.queue.manager, request.manager ? name(request.manager) : t.common.notAvailable],
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
      <h2 className="mt-3 break-words text-lg font-semibold leading-7 text-slate-900">{request.title || (request.type && t.types[request.type]) || t.common.untitled}</h2>
      <dl className="mt-3 grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2 xl:grid-cols-3">
        {meta.map(([label, value, alert]) => <div key={label} className="min-w-0"><dt className="text-slate-500">{label}</dt><dd className={`mt-0.5 break-words font-medium ${alert ? "text-red-600" : "text-slate-800"}`}>{value}</dd></div>)}
      </dl>
      {stale && <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-slate-600"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />{t.queue.lastActivity(number(idleDays))}. {t.queue.staleNote}</p>}
      {state === "open" && request.assignee === UNIFORM_GA_GROUP && <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-slate-600"><Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600" />{t.queue.gaGroupNote}</p>}
      <Stepper request={request} />
    </div>

    <div className="flex gap-1 overflow-x-auto border-b border-slate-200" role="tablist" aria-label={t.queue.detail}>
      {tabs.map(({ id, label, icon: Icon }) => <button type="button" key={id} role="tab" id={`uni-tab-${id}`} aria-selected={tab === id} aria-controls={`uni-panel-${id}`} onClick={() => setTab(id)} className={`inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-3 text-xs font-medium ${tab === id ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}><Icon className="h-4 w-4" />{label}</button>)}
    </div>
    <div role="tabpanel" id={`uni-panel-${tab}`} aria-labelledby={`uni-tab-${tab}`} className="py-5">
      {tab === "request" && <RequestSheet request={request} name={name} />}
      {tab === "history" && <ol className="space-y-5 border-l border-slate-200 pl-5">{request.history.map((event, index) => <li key={`${event.at}-${index}`} className="relative">
        <span className={`absolute -left-[25px] top-1 h-2 w-2 rounded-full ${event.status === "pending" ? "bg-amber-500" : event.status === "stopped" || event.decision === "reject" ? "bg-red-500" : event.decision === "revise" ? "bg-violet-500" : "bg-blue-500"}`} />
        <p className="text-xs text-slate-500">{date(event.at)} · {name(event.actor)}</p>
        <p className="mt-1 break-words text-sm font-medium text-slate-800">{t.steps[event.stage]} · {event.status === "completed" ? t.decisions[event.decision] : t.taskStatuses[event.status]}</p>
        {event.comment && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-600">{event.comment}</p>}
      </li>)}{!request.history.length && <li className="text-sm text-slate-500">{t.queue.noHistory}</li>}</ol>}
      {tab === "attachments" && <Attachments files={request.attachments} />}
    </div>
    {mode === "iw_prod" ? <div className="flex items-start gap-2 border-t border-slate-200 py-4 text-xs leading-5 text-slate-500"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />{t.queue.readOnlyNote}</div>
      : <ActionPanel key={`${request.id}-${request.stage}-${request.history.length}-${actor}`} request={request} actor={actor} people={people} name={name} onAction={onAction} />}
  </>;
}

function Stepper({ request }: { request: UniformRequest }) {
  const t = useMessages(uniformRequestMessages);
  const path = uniformPath(request);
  const reached = uniformReachedIndex(request);
  const state = uniformStatus(request);
  return <ol aria-label={t.queue.progress} className={`mt-4 grid grid-cols-3 gap-1 ${path.length > 5 ? "sm:grid-cols-6" : "sm:grid-cols-5"}`}>
    {path.map((step, index) => {
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

function RequestSheet({ request, name }: { request: UniformRequest; name: (id: string) => string }) {
  const locale = useLocale();
  const t = useMessages(uniformRequestMessages);
  const f = t.queue.fields;
  const day = (value: string) => value ? fmtDate(`${value}T00:00:00+07:00`, locale) : t.queue.blank;
  const total = (side: "returned" | "issued") => request.items.reduce((sum, item) => sum + uniformQty(item[side].qty), 0);
  const cell = (line: UniformLine) => <><td className="border-l border-slate-200 px-2 py-1.5 text-center">{line.size || ""}</td><td className="px-2 py-1.5 text-center tabular-nums">{line.qty || ""}</td></>;
  return <div className="border border-slate-200 bg-white p-5">
    <div className="border-b-2 border-slate-800 pb-3 text-center"><p className="text-sm font-bold tracking-wide text-slate-900">{t.queue.formTitle}</p><p className="text-[11px] font-semibold tracking-widest text-slate-500">{t.queue.formSubtitle}</p></div>
    <dl className="mt-2 grid gap-x-6 sm:grid-cols-2">
      <Field label={f.type}>{t.types[request.type]}</Field>
      <Field label={f.requestDate}>{day(request.requestDate)}</Field>
      <Field label={f.requester}>{name(request.requester)}</Field>
      <Field label={f.section}>{[request.section, request.sectionName !== request.section ? request.sectionName : ""].filter(Boolean).join(" · ") || t.queue.blank}</Field>
      {request.supervisor && <Field label={f.supervisor}>{name(request.supervisor)}</Field>}
      <Field label={f.title} wide>{request.title || t.queue.blank}</Field>
    </dl>
    <div className="mt-4 overflow-x-auto">
      {request.items.length ? <table className="w-full min-w-[30rem] border border-slate-200 text-xs">
        <thead className="bg-slate-50 text-slate-600">
          <tr><th rowSpan={2} className="px-2 py-1.5 text-left font-medium">{f.item}</th><th colSpan={2} className="border-l border-slate-200 px-2 py-1.5 font-medium">{f.returned}</th><th colSpan={2} className="border-l border-slate-200 px-2 py-1.5 font-medium">{f.issued}</th></tr>
          <tr className="border-t border-slate-200">{[f.size, f.qty, f.size, f.qty].map((label, index) => <th key={index} className={`px-2 py-1 font-medium ${index % 2 ? "" : "border-l border-slate-200"}`}>{label}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-200 text-slate-800">
          {request.items.map((item) => <tr key={item.key}><td className="px-2 py-1.5">{t.items[item.key]}</td>{cell(item.returned)}{cell(item.issued)}</tr>)}
          <tr className="bg-slate-50 font-semibold"><td className="px-2 py-1.5">{f.total}</td><td className="border-l border-slate-200" /><td className="px-2 py-1.5 text-center tabular-nums">{fmtNum(total("returned"), locale)}</td><td className="border-l border-slate-200" /><td className="px-2 py-1.5 text-center tabular-nums">{fmtNum(total("issued"), locale)}</td></tr>
        </tbody>
      </table> : <p className="text-sm text-slate-500">{t.queue.noItems}</p>}
    </div>
    <dl className="mt-2 grid gap-x-6 sm:grid-cols-2">
      <Field label={f.reason} wide>{request.reason || t.queue.blank}</Field>
      <Field label={f.gaConfirm} wide>{request.gaConfirm || t.queue.blank}</Field>
      <Field label={`${f.receipt} · ${f.receiver}`}>{request.receiver || t.queue.blank}</Field>
      <Field label={f.receivedDate}>{day(request.receivedDate)}</Field>
    </dl>
  </div>;
}

function Attachments({ files }: { files: UniformRequest["attachments"] }) {
  const t = useMessages(uniformRequestMessages);
  if (!files.length) return <p className="text-sm text-slate-500">{t.queue.noAttachments}</p>;
  const images = files.filter((file) => file.url && fileKind(file.name) === "image");
  const others = files.filter((file) => !images.includes(file));
  return <div className="space-y-4">
    {images.length > 0 && <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">{images.map((file) => <li key={file.id} className="min-w-0">
      <a href={file.url} target="_blank" rel="noopener noreferrer" title={t.queue.openDocument(file.name)} className="block overflow-hidden rounded border border-slate-200 bg-slate-50 hover:border-blue-400">
        {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary user files served by our API */}
        <img src={file.url} alt={file.name} loading="lazy" className="aspect-[4/3] w-full object-cover" />
      </a>
      <span className="mt-1 block truncate text-[11px] text-slate-600">{file.name}</span>
    </li>)}</ul>}
    {others.length > 0 && <ul className="divide-y divide-slate-200">{others.map((file) => <li key={file.id} className="flex items-center gap-2 py-2"><FileText className="h-4 w-4 shrink-0 text-slate-400" /><span className="min-w-0 flex-1 break-words text-xs text-slate-700">{file.name}</span>{file.url && <a href={`${file.url}?download=1`} title={t.queue.openDocument(file.name)} aria-label={t.queue.openDocument(file.name)} className={buttonClass("ghost")}><Download className="h-4 w-4" /></a>}</li>)}</ul>}
  </div>;
}

function ActionPanel({ request, actor, people, name, onAction }: { request: UniformRequest; actor: string; people: UniformPerson[]; name: (id: string) => string; onAction: (action: UniformAction) => void }) {
  const locale = useLocale();
  const t = useMessages(uniformRequestMessages);
  const [comment, setComment] = useState("");
  const [decision, setDecision] = useState<"approve" | "revise" | "reject">("approve");
  const [gaConfirm, setGaConfirm] = useState(request.gaConfirm);
  const [receiver, setReceiver] = useState(() => (people.find((person) => person.id === request.requester)?.name ?? "").split(" · ")[0]);
  const [receivedDate, setReceivedDate] = useState(today);
  const [error, setError] = useState("");
  if (uniformStatus(request) !== "open" || !(UNIFORM_OPEN_STAGES as readonly string[]).includes(request.stage)) return null;
  if (!uniformCanAct(request, actor, people)) return <p className="flex items-center gap-2 border-t border-slate-200 py-4 text-xs text-slate-500"><LockKeyhole className="h-4 w-4 shrink-0" />{t.form.assignedTo(name(request.assignee))}</p>;
  const stage = request.stage as UniformOpenStage;
  if (stage === "request") return <div className="border-t border-slate-200 pt-4"><RequestForm title={t.form.titles.request} submitLabel={t.form.resubmit} requester={request.requester} people={people} initial={uniformInputFrom(request)} onSubmit={(input) => onAction({ type: "submit", input })} /></div>;
  const run = (action: UniformAction) => {
    setError("");
    try { onAction(action); } catch (failure) { setError(failure instanceof Error ? failure.message : t.form.failed); }
  };
  const approval = APPROVAL_STAGES.includes(stage);
  const needsGaConfirm = stage === "gaStaff" && decision === "approve";
  const f = t.queue.fields;
  return <form className="space-y-3 border-t border-slate-200 pt-4" onSubmit={(event) => {
    event.preventDefault();
    if (approval) run({ type: decision, comment, ...(stage === "gaStaff" ? { gaConfirm } : {}) });
    else run({ type: "confirm", comment, receiver, receivedDate });
  }}>
    <h3 className="text-sm font-semibold text-slate-900">{t.form.titles[stage]}</h3>
    {approval && <div className="flex flex-wrap gap-4 text-xs text-slate-700" role="radiogroup" aria-label={t.form.titles[stage]}>{(["approve", "revise", "reject"] as const).map((value) => <label key={value} className="flex items-center gap-1.5"><input type="radio" name="uni-decision" checked={decision === value} onChange={() => setDecision(value)} />{t.form[value]}</label>)}</div>}
    {stage === "gaStaff" && <label className="block text-xs font-medium text-slate-600">{f.gaConfirm}{needsGaConfirm && <span className="text-red-500"> *</span>}<textarea required={needsGaConfirm} maxLength={4000} rows={3} className={`${inputClass} mt-1 resize-y`} placeholder={t.form.gaConfirmPlaceholder} value={gaConfirm} onChange={(event) => setGaConfirm(event.target.value)} /></label>}
    {stage === "confirm" && <div className="grid gap-3 sm:grid-cols-2">
      <label className="block text-xs font-medium text-slate-600">{f.receiver} <span className="text-red-500">*</span><input required maxLength={200} className={`${inputClass} mt-1`} value={receiver} onChange={(event) => setReceiver(event.target.value)} /></label>
      <label className="block text-xs font-medium text-slate-600">{f.receivedDate} <span className="text-red-500">*</span><input required type="date" className={`${inputClass} mt-1`} value={receivedDate} onChange={(event) => setReceivedDate(event.target.value)} /></label>
    </div>}
    <label className="block text-xs font-medium text-slate-600">{t.form.comment}{approval && decision !== "approve" && <span className="text-red-500"> *</span>}<textarea required={approval && decision !== "approve"} maxLength={4000} rows={2} className={`${inputClass} mt-1 resize-y`} placeholder={approval ? t.form.commentHint : t.form.commentPlaceholder} value={comment} onChange={(event) => setComment(event.target.value)} /></label>
    {error && <p role="alert" className="text-xs text-red-600">{uniformErrorText(error, locale)}</p>}
    <div className="flex justify-end"><button type="submit" className={buttonClass(approval && decision === "reject" ? "danger" : "primary")}>
      {approval ? (decision === "approve" ? <Check className="h-4 w-4" /> : decision === "revise" ? <RotateCcw className="h-4 w-4" /> : <X className="h-4 w-4" />) : <PackageCheck className="h-4 w-4" />}
      {approval ? t.form[decision] : t.form.confirm}
    </button></div>
  </form>;
}

function RequestForm({ title, submitLabel, requester, people, initial, onSubmit, onCancel }: {
  title: string; submitLabel: string; requester: string; people: UniformPerson[]; initial: UniformRequestInput;
  onSubmit: (input: UniformRequestInput) => void; onCancel?: () => void;
}) {
  const locale = useLocale();
  const t = useMessages(uniformRequestMessages);
  const [input, setInput] = useState(() => ({ ...initial, items: uniformItemRows(initial.items) }));
  const [error, setError] = useState("");
  const f = t.queue.fields;
  const set = <K extends keyof UniformRequestInput>(key: K, value: UniformRequestInput[K]) => setInput((current) => ({ ...current, [key]: value }));
  const supervisors = supervisorsOf(people, input.section, requester);
  const needsSupervisor = uniformNeedsSupervisor(input.section);
  const sections = UNIFORM_DEMO_SECTIONS.some((entry) => entry.code === input.section) ? UNIFORM_DEMO_SECTIONS : [...UNIFORM_DEMO_SECTIONS, { code: input.section, name: input.section }];
  const setLine = (index: number, side: "returned" | "issued", key: keyof UniformLine, value: string) => setInput((current) => ({
    ...current, items: current.items.map((item, position): UniformItem => position === index ? { ...item, [side]: { ...item[side], [key]: value } } : item),
  }));
  const changeSection = (section: string) => setInput((current) => ({
    ...current, section, supervisor: uniformNeedsSupervisor(section) ? supervisorsOf(people, section, requester)[0]?.id ?? "" : "",
  }));
  const lineInputs = (item: UniformItem, index: number, side: "returned" | "issued") => <>
    <td className="border-l border-slate-200 p-1"><input aria-label={`${t.items[item.key]} · ${f[side]} · ${f.size}`} maxLength={50} className={`${inputClass} h-8 px-2 text-xs`} value={item[side].size} onChange={(event) => setLine(index, side, "size", event.target.value)} /></td>
    <td className="p-1"><input aria-label={`${t.items[item.key]} · ${f[side]} · ${f.qty}`} inputMode="numeric" maxLength={3} className={`${inputClass} h-8 w-16 px-2 text-center text-xs`} value={item[side].qty} onChange={(event) => setLine(index, side, "qty", event.target.value)} /></td>
  </>;
  return <form className="space-y-3" onSubmit={(event) => {
    event.preventDefault();
    setError("");
    try { onSubmit(input); } catch (failure) { setError(failure instanceof Error ? failure.message : t.form.failed); }
  }}>
    <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block text-xs font-medium text-slate-600">{f.type} <span className="text-red-500">*</span><select required className={`${inputClass} mt-1`} value={input.type} onChange={(event) => set("type", event.target.value as UniformRequestInput["type"])}><option value="">{t.form.selectType}</option>{UNIFORM_REQUEST_TYPES.map((value) => <option key={value} value={value}>{t.types[value]}</option>)}</select></label>
      <label className="block text-xs font-medium text-slate-600">{f.requestDate}<input type="date" className={`${inputClass} mt-1`} value={input.requestDate} onChange={(event) => set("requestDate", event.target.value)} /></label>
      <label className="block text-xs font-medium text-slate-600">{f.section} <span className="text-red-500">*</span><select required className={`${inputClass} mt-1`} value={input.section} onChange={(event) => changeSection(event.target.value)}><option value="">{t.form.selectSection}</option>{sections.map((entry) => <option key={entry.code} value={entry.code}>{entry.name} ({entry.code})</option>)}</select></label>
      {needsSupervisor && <label className="block text-xs font-medium text-slate-600">{f.supervisor} <span className="text-red-500">*</span><select required className={`${inputClass} mt-1`} value={input.supervisor} onChange={(event) => set("supervisor", event.target.value)}><option value="">{t.form.selectSupervisor}</option>{supervisors.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select><span className="mt-1 block font-normal text-slate-500">{t.form.supervisorHint}</span></label>}
    </div>
    <label className="block text-xs font-medium text-slate-600">{f.title} <span className="text-red-500">*</span><input required maxLength={500} className={`${inputClass} mt-1`} value={input.title} onChange={(event) => set("title", event.target.value)} /></label>
    <fieldset className="min-w-0">
      <legend className="text-xs font-medium text-slate-600">{f.item} <span className="font-normal text-slate-500">— {t.form.itemsHint}</span></legend>
      <div className="mt-1 overflow-x-auto">
        <table className="w-full min-w-[34rem] border border-slate-200 text-xs">
          <thead className="bg-slate-50 text-slate-600">
            <tr><th rowSpan={2} className="px-2 py-1.5 text-left font-medium">{f.item}</th><th colSpan={2} className="border-l border-slate-200 px-2 py-1.5 font-medium">{f.returned}</th><th colSpan={2} className="border-l border-slate-200 px-2 py-1.5 font-medium">{f.issued}</th></tr>
            <tr className="border-t border-slate-200">{[f.size, f.qty, f.size, f.qty].map((label, index) => <th key={index} className={`px-2 py-1 font-medium ${index % 2 ? "" : "border-l border-slate-200"}`}>{label}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-200">{input.items.map((item, index) => <tr key={item.key}><td className="px-2 py-1 text-slate-700">{t.items[item.key]}</td>{lineInputs(item, index, "returned")}{lineInputs(item, index, "issued")}</tr>)}</tbody>
        </table>
      </div>
    </fieldset>
    <label className="block text-xs font-medium text-slate-600">{f.reason} <span className="text-red-500">*</span><textarea required maxLength={4000} rows={2} className={`${inputClass} mt-1 resize-y`} value={input.reason} onChange={(event) => set("reason", event.target.value)} /></label>
    {error && <p role="alert" className="text-xs text-red-600">{uniformErrorText(error, locale)}</p>}
    <div className="flex justify-end gap-2">{onCancel && <button type="button" className={buttonClass()} onClick={onCancel}>{t.form.cancel}</button>}<button type="submit" className={buttonClass("primary")}><Send className="h-4 w-4" />{submitLabel}</button></div>
  </form>;
}
