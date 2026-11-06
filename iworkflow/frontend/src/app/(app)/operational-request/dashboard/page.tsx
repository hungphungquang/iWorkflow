"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Activity, ArrowDown, ArrowRight, ArrowUp, ArrowUpDown, CheckCheck, Clock3, Database, FileText, FlaskConical, Inbox, ListChecks, Loader2, RefreshCw, TriangleAlert, XCircle } from "lucide-react";
import { ColumnChart, Donut, HBarChart } from "@/components/charts";
import { Badge, PageHeader, buttonClass, inputClass } from "@/components/ui";
import { sortOrfDepartments, summarizeOrf, type DepartmentSort, type DepartmentSortKey, type OrfBreakdownKey } from "@/lib/operational-request";
import { useOperationalRequestData } from "@/lib/operational-request-store";
import { fmtDate, fmtDateTime, fmtNum, intlTag, useLocale, useMessages } from "@/lib/i18n";
import { operationalRequestMessages } from "@/lib/i18n-operational-request";

const breakdownColors: Record<OrfBreakdownKey, string> = { completed: "#10b981", onTime: "#f59e0b", overdue: "#dc2626", rejected: "#7c3aed", cancelled: "#94a3b8" };

export default function OperationalRequestDashboard() {
  const locale = useLocale();
  const t = useMessages(operationalRequestMessages);
  const number = (value: number, decimals = 0) => fmtNum(value, locale, decimals);
  const date = (value: string, withTime = false) => withTime ? fmtDateTime(value, locale) : fmtDate(value, locale);
  const params = useSearchParams();
  const { mode, setMode, snapshot, loading, error, reload } = useOperationalRequestData(params.get("source"));
  const [months, setMonths] = useState<3 | 6 | 12>(12);
  const [department, setDepartment] = useState(params.get("department") || "");
  const [departmentSort, setDepartmentSort] = useState<DepartmentSort | null>(null);
  const summary = snapshot ? summarizeOrf(snapshot, months, department) : null;
  const departments = [...new Set(snapshot?.requests.map((request) => request.department) ?? [])].sort();
  const departmentName = (value: string) => value === "—" || !value ? t.common.unknown : value;
  const name = (id: string) => snapshot?.people.find((person) => person.id === id)?.name || id || t.common.unknown;
  const columns: { key: DepartmentSortKey; label: string }[] = (["name", "started", "completed", "onTime", "overdue", "closed", "backlog"] as const).map((key) => ({ key, label: t.dashboard.columns[key] }));
  const breakdownLabel: Record<OrfBreakdownKey, string> = { completed: t.statuses.completed, onTime: t.common.onTime, overdue: t.common.overdue, rejected: t.statuses.rejected, cancelled: t.statuses.cancelled };
  const sortedDepartments = sortOrfDepartments(summary?.departments ?? [], departmentSort);

  /** Workspace link; `since` defaults to the cohort start, pass "" for backlog views that span every period. */
  function queueLink(filters: Record<string, string> = {}) {
    const values: Record<string, string> = { source: mode, status: "all", since: summary?.since ?? "", department, ...filters };
    const query = new URLSearchParams(Object.entries(values).filter(([, value]) => value));
    return `/operational-request?${query}`;
  }

  return (
    <>
      <PageHeader title={t.common.title} description={t.dashboard.description} actions={
        <>
          <Link href={queueLink({ since: "" })} className={buttonClass("primary")}><ListChecks className="h-4 w-4" />{t.common.queue}</Link>
          <button type="button" title={t.common.refreshDashboard} aria-label={t.common.refreshDashboard} disabled={loading} onClick={reload} className={`${buttonClass()} disabled:opacity-50`}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button>
        </>
      } />

      <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-y border-slate-200 py-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block text-xs text-slate-500">{t.dashboard.period}<select aria-label={t.dashboard.periodLabel} value={months} onChange={(event) => setMonths(Number(event.target.value) as 3 | 6 | 12)} className={`${inputClass} mt-1 block w-40`}>{([3, 6, 12] as const).map((count) => <option key={count} value={count}>{t.dashboard.recentMonths(count)}</option>)}</select></label>
          <label className="block min-w-0 text-xs text-slate-500">{t.common.department}<select aria-label={t.dashboard.departmentLabel} value={department} onChange={(event) => setDepartment(event.target.value)} className={`${inputClass} mt-1 block max-w-full sm:w-56`}><option value="">{t.common.allDepartments}</option>{departments.map((unit) => <option key={unit} value={unit}>{departmentName(unit)}</option>)}</select></label>
        </div>
        <div className="flex rounded-md border border-slate-300 bg-white p-0.5" role="group" aria-label={t.dashboard.sourceLabel}>
          {([["iw_prod", t.common.production], ["demo", t.common.demo]] as const).map(([source, label]) => <button key={source} type="button" aria-pressed={mode === source} onClick={() => { setMode(source); setDepartment(""); }} className={`rounded px-3 py-1.5 text-xs font-medium ${mode === source ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{label}</button>)}
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">{mode === "iw_prod" ? <Database className="h-3.5 w-3.5 text-emerald-600" /> : <FlaskConical className="h-3.5 w-3.5 text-amber-600" />}{mode === "iw_prod" ? t.common.readOnly : t.common.demoData}</span>
        {snapshot && <span>{t.common.updated(date(snapshot.loadedAt, true))}</span>}
        {summary && snapshot && <span>{t.dashboard.createdRange(date(summary.since), date(snapshot.loadedAt))}</span>}
      </div>

      {loading ? <div role="status" className="flex items-center justify-center gap-2 py-24 text-sm text-slate-600"><Loader2 className="h-5 w-5 animate-spin" />{t.dashboard.loading}</div> : error ? <div role="alert" className="border-l-4 border-red-500 bg-red-50 p-5 text-sm text-red-800"><p>{t.common.loadError}</p><button type="button" className={`${buttonClass()} mt-3`} onClick={reload}><RefreshCw className="h-4 w-4" />{t.common.retry}</button></div> : summary && snapshot ? <>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {[
            { label: t.dashboard.started, value: number(summary.started), hint: t.dashboard.startedHint, icon: FileText, tone: "text-slate-900", href: queueLink() },
            { label: t.dashboard.completed, value: number(summary.completed), hint: t.dashboard.completedHint, icon: CheckCheck, tone: "text-emerald-700", href: queueLink({ status: "completed" }) },
            { label: t.dashboard.pending, value: number(summary.onTime), hint: t.dashboard.pendingHint, icon: Activity, tone: "text-amber-700", href: queueLink({ status: "onTime" }) },
            { label: t.dashboard.overdue, value: number(summary.overdue), hint: t.dashboard.overdueHint, icon: TriangleAlert, tone: summary.overdue ? "text-red-600" : "text-emerald-700", href: queueLink({ status: "overdue" }) },
            { label: t.dashboard.closed, value: number(summary.rejected + summary.cancelled), hint: t.dashboard.closedHint(number(summary.rejected), number(summary.cancelled)), icon: XCircle, tone: "text-slate-700", href: queueLink({ status: "closed" }) },
            { label: t.dashboard.average, value: summary.averageDays === null ? "-" : t.dashboard.days(number(summary.averageDays, 1)), hint: t.dashboard.averageHint, icon: Clock3, tone: "text-slate-900", href: queueLink({ status: "completed" }) },
          ].map(({ label, value, hint, icon: Icon, tone, href }) => <Link key={label} href={href} className="min-w-0 rounded-lg border border-slate-200 bg-white p-3 transition-colors hover:border-blue-300 focus-visible:outline-2 focus-visible:outline-blue-500"><span className="flex min-h-9 items-start gap-1.5 text-xs leading-4 text-slate-500"><Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />{label}</span><span className={`mt-2 block break-words text-2xl font-semibold ${tone}`}>{value}</span><span className="mt-2 block break-words text-[11px] leading-4 text-slate-500">{hint}</span></Link>)}
        </div>
        <p className="mt-2 text-xs text-slate-500">{t.dashboard.breakdown([summary.completed, summary.onTime, summary.overdue, summary.rejected + summary.cancelled].map((value) => number(value)), number(summary.started))}</p>

        <div className="grid gap-x-8 border-b border-slate-200 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <section aria-label={t.dashboard.statusTitle} className="min-w-0 py-5">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold text-slate-900">{t.dashboard.statusTitle}</h2><Badge>{t.dashboard.completionHint(number(summary.completed), number(summary.started))}</Badge></div>
            <p className="mb-5 text-xs leading-5 text-slate-500">{t.dashboard.statusScope}</p>
            <Donut locale={intlTag(locale)} centerLabel={t.common.queue.toLowerCase()} segments={summary.breakdown.map(({ key, value }) => ({
              label: `${breakdownLabel[key]} · ${summary.started ? `${number(value / summary.started * 100, 1)}%` : "-"}`, value, color: breakdownColors[key], href: queueLink({ status: key }),
            }))} />
            <p className="mt-4 text-xs text-slate-600">{t.dashboard.completion}: <strong>{summary.completionRate === null ? "-" : `${number(summary.completionRate, 1)}%`}</strong></p>
          </section>
          <section aria-label={t.dashboard.trend} className="min-w-0 py-5">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold text-slate-900">{t.dashboard.trend}</h2><Link href={queueLink()} className="inline-flex items-center gap-1 text-xs text-blue-700 hover:underline">{t.dashboard.viewList}<ArrowRight className="h-3 w-3" /></Link></div>
            <p className="mb-4 text-xs leading-5 text-slate-500">{t.dashboard.trendScope}</p>
            <div className="overflow-x-auto"><div className="min-w-[28rem]"><ColumnChart data={summary.monthly} primaryLabel={t.dashboard.startedSeries} secondaryLabel={t.dashboard.completedSeries} /></div></div>
          </section>
        </div>

        <div className="grid gap-x-8 border-b border-slate-200 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <section aria-label={t.dashboard.stagesTitle} className="min-w-0 py-5">
            <div className="mb-1 flex items-center justify-between gap-2"><h2 className="text-sm font-semibold text-slate-900">{t.dashboard.stagesTitle}</h2><Badge tone="amber">{number(summary.backlog)}</Badge></div>
            <p className="mb-5 text-xs leading-5 text-slate-500">{t.dashboard.backlogScope(number(summary.backlog))}</p>
            <HBarChart locale={intlTag(locale)} labelWidth="13rem" data={summary.backlogStages.filter(({ stage, value }) => value || stage !== "unknown").map(({ stage, value }) => ({
              label: t.stages[stage], value, href: queueLink({ status: "open", stage, since: "" }), tone: stage === "result" ? "red" : stage === "approval" || stage === "resultApproval" ? "violet" : "blue",
            }))} />
            {summary.backlogStale > 0 && <Link href={queueLink({ status: "stale", since: "" })} className="mt-4 flex items-start gap-2 text-xs leading-5 text-amber-800 hover:underline"><TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />{t.dashboard.staleHint(number(summary.backlogStale))}</Link>}
          </section>
          <section aria-label={t.dashboard.aging} className="min-w-0 py-5">
            <div className="mb-1 flex items-center justify-between gap-2"><h2 className="text-sm font-semibold text-slate-900">{t.dashboard.aging}</h2><Badge tone="red">{number(summary.backlogOverdue)} {t.common.overdue.toLowerCase()}</Badge></div>
            <p className="mb-5 text-xs leading-5 text-slate-500">{t.dashboard.agingScope}</p>
            <HBarChart locale={intlTag(locale)} labelWidth="7rem" data={summary.aging.map((group, index) => ({ label: t.aging[index], value: group.value, tone: index >= 3 ? "red" : index === 2 ? "amber" : "green" }))} />
          </section>
        </div>

        <div className="grid gap-x-8 border-b border-slate-200 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <section aria-label={t.dashboard.departments} className="min-w-0 py-5">
            <h2 className="text-sm font-semibold text-slate-900">{t.dashboard.departments}</h2>
            <p className="mb-2 mt-1 text-xs leading-5 text-slate-500">{t.dashboard.departmentHint}</p>
            <p className="mb-3 min-h-5 text-xs leading-5 text-slate-500">{departmentSort ? `${columns.find((column) => column.key === departmentSort.key)?.label} · ${departmentSort.direction === "asc" ? t.dashboard.ascending : t.dashboard.descending}` : t.dashboard.defaultPriority}</p>
            <div className="overflow-x-auto"><table className="w-full min-w-[40rem] text-left text-xs">
              <thead className="border-y border-slate-200 bg-slate-100/60 text-slate-500"><tr>{columns.map(({ key, label }) => {
                const active = departmentSort?.key === key;
                const nextDirection = active && departmentSort.direction === "asc" ? "desc" : "asc";
                const SortIcon = active ? departmentSort.direction === "asc" ? ArrowUp : ArrowDown : ArrowUpDown;
                const action = t.dashboard.sortAction(label, nextDirection === "asc");
                return <th key={key} scope="col" aria-sort={active ? departmentSort.direction === "asc" ? "ascending" : "descending" : "none"} className={`px-2 py-2 font-medium ${key === "name" ? "" : "text-right"}`}>
                  <button type="button" title={action} aria-label={action} onClick={() => setDepartmentSort({ key, direction: nextDirection })} className={`inline-flex min-h-10 w-full items-center gap-1 rounded text-inherit hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-500 ${key === "name" ? "justify-start text-left" : "justify-end text-right"} ${active ? "text-blue-700" : ""}`}><span>{label}</span><SortIcon aria-hidden className="h-3.5 w-3.5 shrink-0" /></button>
                </th>;
              })}</tr></thead>
              <tbody className="divide-y divide-slate-100">{sortedDepartments.map((unit) => <tr key={unit.name} className="hover:bg-white">
                <th scope="row" className="px-2 py-3 font-medium"><Link href={queueLink({ department: unit.name })} className="text-blue-700 hover:underline">{departmentName(unit.name)}</Link></th>
                <td className="px-2 py-3 text-right"><Link href={queueLink({ department: unit.name })} className="hover:text-blue-700 hover:underline">{number(unit.started)}</Link></td>
                <td className="px-2 py-3 text-right text-emerald-700"><Link href={queueLink({ department: unit.name, status: "completed" })} className="hover:underline">{number(unit.completed)}</Link></td>
                <td className="px-2 py-3 text-right font-medium text-amber-700"><Link href={queueLink({ department: unit.name, status: "onTime" })} className="hover:underline">{number(unit.onTime)}</Link></td>
                <td className={`px-2 py-3 text-right font-medium ${unit.overdue ? "text-red-600" : "text-slate-400"}`}><Link href={queueLink({ department: unit.name, status: "overdue" })} className="hover:underline">{number(unit.overdue)}</Link></td>
                <td className="px-2 py-3 text-right text-slate-600"><Link href={queueLink({ department: unit.name, status: "closed" })} className="hover:underline">{number(unit.closed)}</Link></td>
                <td className="px-2 py-3 text-right text-amber-700"><Link href={queueLink({ department: unit.name, status: "open", since: "" })} className="hover:underline">{number(unit.backlog)}</Link></td>
              </tr>)}</tbody>
            </table></div>
            {!summary.departments.length && <p className="py-8 text-center text-sm text-slate-500">{t.dashboard.noDepartments}</p>}
          </section>
          <section aria-label={t.dashboard.approvers} className="min-w-0 py-5">
            <h2 className="text-sm font-semibold text-slate-900">{t.dashboard.approvers}</h2>
            <p className="mb-5 mt-1 text-xs leading-5 text-slate-500">{t.dashboard.approversHint}</p>
            {summary.approvers.length ? <HBarChart locale={intlTag(locale)} labelWidth="10rem" data={summary.approvers.slice(0, 10).map((approver) => ({ label: name(approver.id), value: approver.pending, tone: approver.overdue ? "red" : "violet", href: queueLink({ status: "open", assignee: approver.id, since: "" }) }))} /> : <p className="py-8 text-center text-sm text-slate-500">{t.dashboard.noApprovers}</p>}
          </section>
        </div>

        <section aria-label={t.dashboard.attention} className="py-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900"><TriangleAlert className="h-4 w-4 text-amber-600" />{t.dashboard.attention}</h2><Link href={queueLink({ status: "overdue" })} className="inline-flex items-center gap-1 text-xs text-blue-700 hover:underline">{t.dashboard.allQueue} ({number(summary.overdue)})<ArrowRight className="h-3 w-3" /></Link></div>
          <ul className="divide-y divide-slate-200">{summary.attention.slice(0, 8).map((item) => {
            const age = Math.max(0, Math.floor((Date.parse(snapshot.loadedAt) - Date.parse(item.startedAt)) / 86400000));
            return <li key={item.id}><Link href={queueLink({ status: "all", request: item.id })} className="grid gap-3 py-3 hover:bg-white md:grid-cols-[minmax(0,1fr)_minmax(12rem,0.7fr)_9rem]">
              <span className="min-w-0"><span className="font-mono text-xs font-semibold text-blue-700">{item.code}</span><span className="mt-1 block break-words text-sm font-medium leading-5 text-slate-800">{item.title || item.productCode}</span><span className="mt-1 block text-xs text-slate-500">{date(item.startedAt)} · {name(item.requester)}</span></span>
              <span className="min-w-0"><Badge tone="amber">{t.stages[item.stage]}</Badge><span className="mt-2 block text-xs text-slate-600">{name(item.assignee)}</span></span>
              <span className="text-xs md:text-right"><span className="block font-medium text-red-600">{t.common.overdue} · {date(item.dueAt)}</span><span className="mt-2 block text-slate-500">{t.dashboard.openDays(number(age))}</span></span>
            </Link></li>;
          })}</ul>
          {!summary.attention.length && <div className="flex flex-col items-center gap-2 py-10 text-sm text-slate-500"><Inbox className="h-7 w-7 text-slate-300" />{t.dashboard.noOpen}</div>}
        </section>
      </> : null}
    </>
  );
}
