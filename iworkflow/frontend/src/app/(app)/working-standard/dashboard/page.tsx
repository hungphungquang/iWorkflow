"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Activity, ArrowDown, ArrowRight, ArrowUp, ArrowUpDown, CheckCheck, Clock3, Database, FileText, FlaskConical, Inbox, ListChecks, Loader2, RefreshCw, TriangleAlert } from "lucide-react";
import { ColumnChart, Donut, HBarChart } from "@/components/charts";
import { Badge, PageHeader, buttonClass, inputClass } from "@/components/ui";
import { isCaseOverdue, sortReviewDepartments, summarizeReviewCases, type DepartmentSort, type DepartmentSortKey } from "@/lib/working-standard";
import { useWorkingStandardData } from "@/lib/working-standard-store";
import { fmtDate, fmtDateTime, fmtNum, intlTag, useLocale, useMessages } from "@/lib/i18n";
import { workingStandardMessages } from "@/lib/i18n-working-standard";

const statusColors = { running: "#f59e0b", completed: "#10b981" };

export default function WorkingStandardDashboard() {
  const locale = useLocale();
  const t = useMessages(workingStandardMessages);
  const number = (value: number, decimals = 0) => fmtNum(value, locale, decimals);
  const date = (value: string, withTime = false) => withTime ? fmtDateTime(value, locale) : fmtDate(value, locale);
  const departmentColumns: { key: DepartmentSortKey; label: string }[] = (["name", "started", "completed", "pending", "overdue"] as const).map((key) => ({ key, label: t.caseDashboard.columns[key] }));
  const params = useSearchParams();
  const { mode, setMode, snapshot, loading, error, reload } = useWorkingStandardData(params.get("source"));
  const [months, setMonths] = useState<3 | 6 | 12>(12);
  const [department, setDepartment] = useState("");
  const [departmentSort, setDepartmentSort] = useState<DepartmentSort | null>(null);
  const summary = snapshot ? summarizeReviewCases(snapshot, months, department) : null;
  const sortedDepartments = sortReviewDepartments(summary?.departments ?? [], departmentSort);
  const chartDepartments = sortReviewDepartments(summary?.departments ?? [], { key: "started", direction: "desc" });
  const departmentChartMax = Math.max(1, ...chartDepartments.map((unit) => unit.started));
  const departments = [...new Set(snapshot?.reviews.map((review) => review.department) ?? [])].sort();

  function queueLink(filters: Record<string, string> = {}) {
    const query = new URLSearchParams({ source: mode, status: "all", ...(summary ? { since: summary.since } : {}), ...(department ? { department } : {}), ...filters });
    return `/working-standard?${query}`;
  }

  return (
    <>
      <PageHeader title="Working Standard" description={t.caseDashboard.description} actions={
        <>
          <Link href={queueLink()} className={buttonClass("primary")}><ListChecks className="h-4 w-4" />{t.common.queue}</Link>
          <button type="button" title={t.common.refreshDashboard} aria-label={t.common.refreshDashboard} disabled={loading} onClick={reload} className={`${buttonClass()} disabled:opacity-50`}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button>
        </>
      } />

      <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-y border-slate-200 py-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block text-xs text-slate-500">{t.dashboard.period}<select aria-label={t.dashboard.periodLabel} value={months} onChange={(event) => setMonths(Number(event.target.value) as 3 | 6 | 12)} className={`${inputClass} mt-1 block w-36`}>{([3, 6, 12] as const).map((count) => <option key={count} value={count}>{t.dashboard.recentMonths(count)}</option>)}</select></label>
          <label className="block min-w-0 text-xs text-slate-500">{t.common.department}<select aria-label={t.dashboard.departmentLabel} value={department} onChange={(event) => setDepartment(event.target.value)} className={`${inputClass} mt-1 block max-w-full sm:w-64`}><option value="">{t.common.allDepartments}</option>{departments.map((unit) => <option key={unit}>{unit}</option>)}</select></label>
        </div>
        <div className="flex rounded-md border border-slate-300 bg-white p-0.5" role="group" aria-label={t.dashboard.sourceLabel}>
          {([ ["iw_prod", t.common.production], ["demo", t.common.demo] ] as const).map(([source, label]) => <button key={source} type="button" aria-pressed={mode === source} onClick={() => { setMode(source); setDepartment(""); }} className={`rounded px-3 py-1.5 text-xs font-medium ${mode === source ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{label}</button>)}
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">{mode === "iw_prod" ? <Database className="h-3.5 w-3.5 text-emerald-600" /> : <FlaskConical className="h-3.5 w-3.5 text-amber-600" />}{mode === "iw_prod" ? t.common.readOnly : t.common.demoData}</span>
        {snapshot && <span>{t.common.updated(date(snapshot.loadedAt, true))}</span>}
        {summary && snapshot && <span>{t.dashboard.createdRange(date(summary.since), date(snapshot.loadedAt))}</span>}
      </div>

      {loading ? <div role="status" className="flex items-center justify-center gap-2 py-24 text-sm text-slate-600"><Loader2 className="h-5 w-5 animate-spin" />{t.dashboard.loading}</div> : error ? <div role="alert" className="border-l-4 border-red-500 bg-red-50 p-5 text-sm text-red-800"><p>{t.common.loadError}</p><button className={`${buttonClass()} mt-3`} onClick={reload}><RefreshCw className="h-4 w-4" />{t.common.retry}</button></div> : summary && snapshot ? <>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
          {[
            { label: t.caseDashboard.total, value: number(summary.started), hint: t.caseDashboard.totalHint, icon: FileText, tone: "text-slate-900", href: queueLink() },
            { label: t.caseDashboard.completed, value: number(summary.completed), hint: t.queue.approvalRule, icon: CheckCheck, tone: "text-emerald-700", href: queueLink({ status: "completed" }) },
            { label: t.caseDashboard.pending, value: number(summary.pending), hint: t.queue.approvalStates.running, icon: Activity, tone: "text-amber-700", href: queueLink({ status: "open" }) },
            { label: t.caseDashboard.overdue, value: number(summary.overdue), hint: t.dashboard.overdueHint, icon: TriangleAlert, tone: summary.overdue ? "text-red-600" : "text-emerald-700", href: queueLink({ status: "overdue" }) },
            { label: t.caseDashboard.completion, value: summary.completionRate === null ? "-" : `${number(summary.completionRate, 1)}%`, hint: t.caseDashboard.completionHint(number(summary.completed), number(summary.started)), icon: CheckCheck, tone: "text-emerald-700", href: queueLink({ status: "completed" }) },
            { label: t.caseDashboard.average, value: summary.averageDays === null ? "-" : t.dashboard.days(number(summary.averageDays, 1)), hint: t.caseDashboard.averageHint, icon: Clock3, tone: "text-slate-900", href: queueLink({ status: "completed" }) },
          ].map(({ label, value, hint, icon: Icon, tone, href }) => <Link key={label} href={href} className="min-w-0 rounded-lg border border-slate-200 bg-white p-3 transition-colors hover:border-blue-300 focus-visible:outline-2 focus-visible:outline-blue-500"><div className="flex min-h-9 items-start gap-1.5 text-xs leading-4 text-slate-500"><Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />{label}</div><p className={`mt-2 break-words text-2xl font-semibold ${tone}`}>{value}</p><p className="mt-2 break-words text-[11px] leading-4 text-slate-500">{hint}</p></Link>)}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-4 text-xs text-slate-500"><span>{t.caseDashboard.reviews(number(summary.reviewCount))}</span><Link href={queueLink({ status: "open" })} className="hover:text-blue-700 hover:underline">{t.caseDashboard.blocked(number(summary.cases.filter((item) => !item.parent || item.parent.cancelledReviews > 0).length))}</Link></div>

        <section aria-label={t.caseDashboard.status} className="min-w-0 border-b border-slate-200 py-5">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold text-slate-900">{t.caseDashboard.status}</h2><Badge>{number(summary.started)} {t.common.parentCases.toLowerCase()}</Badge></div>
          <p className="mb-5 text-xs leading-5 text-slate-500">{t.caseDashboard.scope}</p>
          <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <div className="min-w-0">
              <Donut locale={intlTag(locale)} centerLabel={t.common.parentCases.toLowerCase()} segments={summary.statuses.map(({ state, value }) => ({
                label: `${t.queue.approvalStates[state]} · ${summary.started ? `${number(value / summary.started * 100, 1)}%` : "-"}`,
                value, color: statusColors[state], href: queueLink({ status: state === "running" ? "open" : "completed" }),
              }))} />
            </div>
            <div className="min-w-0 space-y-3 text-xs leading-5">
              <p className="text-slate-700">{t.caseDashboard.rule}</p>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                <Link href={queueLink({ status: "open" })} className="font-medium text-amber-700 hover:underline">{number(summary.pending)} {t.caseDashboard.pending.toLowerCase()}</Link>
                <Link href={queueLink({ status: "overdue" })} className="font-medium text-red-600 hover:underline">{number(summary.overdue)} {t.caseDashboard.overdue.toLowerCase()}</Link>
              </div>
              <p className="text-slate-500">{t.dashboard.overdueSubset}</p>
            </div>
          </div>
        </section>

        <div className="grid gap-x-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <section aria-label={t.dashboard.trendRegion} className="min-w-0 py-5">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold text-slate-900">{t.caseDashboard.trend}</h2><Link href={queueLink()} className="inline-flex items-center gap-1 text-xs text-blue-700 hover:underline">{t.dashboard.viewList}<ArrowRight className="h-3 w-3" /></Link></div>
            <p className="mb-4 text-xs leading-5 text-slate-500">{t.caseDashboard.scope}</p>
            <div className="overflow-x-auto"><div className="min-w-[28rem]"><ColumnChart data={summary.monthly} primaryLabel={t.dashboard.started} secondaryLabel={t.dashboard.completed} /></div></div>
          </section>
          <section aria-label={t.caseDashboard.aging} className="min-w-0 py-5">
            <div className="mb-1 flex items-center justify-between gap-2"><h2 className="text-sm font-semibold text-slate-900">{t.caseDashboard.aging}</h2><Badge tone="amber">{number(summary.pending)}</Badge></div>
            <p className="mb-6 text-xs leading-5 text-slate-500">{t.caseDashboard.scope}</p>
            <HBarChart locale={intlTag(locale)} labelWidth="8rem" data={summary.aging.map((group, index) => ({ ...group, label: t.aging[index], tone: index >= 2 ? "red" : index === 1 ? "amber" : "green" }))} />
          </section>
        </div>

        <section aria-label={t.caseDashboard.departmentChart} className="min-w-0 border-t border-slate-200 py-5">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold text-slate-900">{t.caseDashboard.departmentChart}</h2><span className="text-xs text-slate-500">{t.dashboard.departmentCount(number(chartDepartments.length))}</span></div>
          <p className="text-xs leading-5 text-slate-500">{t.caseDashboard.departmentChartHint}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{t.caseDashboard.departmentHint}</p>
          <div className="my-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />{t.queue.approvalStates.completed}</span>
            <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-amber-400" />{t.queue.approvalStates.running}</span>
          </div>
          <ul className="max-h-[28rem] space-y-3 overflow-y-auto pr-2">
            {chartDepartments.map((unit) => <li key={unit.name} className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)_3rem] items-center gap-x-3 gap-y-1.5 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_3.5rem]">
              <Link href={queueLink({ department: unit.name })} title={unit.name} className="break-words text-xs font-medium text-blue-700 hover:underline">{unit.name}</Link>
              <div className="flex h-5 overflow-hidden rounded bg-slate-100">
                {unit.completed > 0 && <Link href={queueLink({ department: unit.name, status: "completed" })} aria-label={t.caseDashboard.departmentSeries(unit.name, t.queue.approvalStates.completed, number(unit.completed))} title={t.caseDashboard.departmentSeries(unit.name, t.queue.approvalStates.completed, number(unit.completed))} style={{ width: `${unit.completed / departmentChartMax * 100}%` }} className="block h-5 shrink-0 bg-emerald-500 hover:bg-emerald-600 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-slate-900" />}
                {unit.pending > 0 && <Link href={queueLink({ department: unit.name, status: "open" })} aria-label={t.caseDashboard.departmentSeries(unit.name, t.queue.approvalStates.running, number(unit.pending))} title={t.caseDashboard.departmentSeries(unit.name, t.queue.approvalStates.running, number(unit.pending))} style={{ width: `${unit.pending / departmentChartMax * 100}%` }} className="block h-5 shrink-0 bg-amber-400 hover:bg-amber-500 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-slate-900" />}
              </div>
              <Link href={queueLink({ department: unit.name })} aria-label={`${unit.name}: ${number(unit.started)} ${t.common.parentCases.toLowerCase()}`} className="text-right text-xs font-semibold text-slate-800 hover:text-blue-700 hover:underline">{number(unit.started)}</Link>
              <div className="col-span-3 flex flex-wrap justify-end gap-x-4 gap-y-1 text-[11px] sm:col-start-2 sm:col-span-2">
                <Link href={queueLink({ department: unit.name, status: "completed" })} className="text-emerald-700 hover:underline">{t.queue.approvalStates.completed}: {number(unit.completed)}</Link>
                <Link href={queueLink({ department: unit.name, status: "open" })} className="text-amber-700 hover:underline">{t.queue.approvalStates.running}: {number(unit.pending)}</Link>
              </div>
            </li>)}
          </ul>
          {!chartDepartments.length && <p className="py-8 text-center text-sm text-slate-500">{t.dashboard.noDepartments}</p>}
        </section>

        <div className="grid gap-x-8 border-t border-slate-200 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <section aria-label={t.caseDashboard.departments} className="min-w-0 py-5">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold text-slate-900">{t.caseDashboard.departments}</h2><span className="text-xs text-slate-500">{t.dashboard.departmentCount(summary.departments.length > 10 ? `10 / ${number(summary.departments.length)}` : number(summary.departments.length))}</span></div>
            <p className="mb-3 text-xs leading-5 text-slate-500">{t.caseDashboard.departmentHint}</p>
            <p className="mb-3 min-h-5 text-xs leading-5 text-slate-500">{departmentSort ? `${departmentColumns.find((column) => column.key === departmentSort.key)?.label} · ${departmentSort.direction === "asc" ? t.dashboard.ascending : t.dashboard.descending}` : t.dashboard.defaultPriority}</p>
            <div className="overflow-x-auto"><table className="w-full min-w-[32rem] text-left text-xs">
              <thead className="border-y border-slate-200 bg-slate-100/60 text-slate-500"><tr>{departmentColumns.map(({ key, label }) => {
                const active = departmentSort?.key === key;
                const nextDirection = active && departmentSort.direction === "asc" ? "desc" : "asc";
                const SortIcon = active ? departmentSort.direction === "asc" ? ArrowUp : ArrowDown : ArrowUpDown;
                const action = t.dashboard.sortAction(label, nextDirection === "asc");
                return <th key={key} scope="col" aria-sort={active ? departmentSort.direction === "asc" ? "ascending" : "descending" : "none"} className={`px-2 py-2 font-medium ${key === "name" ? "" : "text-right"}`}>
                  <button type="button" title={action} aria-label={action} onClick={() => setDepartmentSort({ key, direction: nextDirection })} className={`inline-flex min-h-10 w-full items-center gap-1 rounded text-inherit hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-500 ${key === "name" ? "justify-start text-left" : "justify-end text-right"} ${active ? "text-blue-700" : ""}`}><span className="max-w-32">{label}</span><SortIcon aria-hidden className="h-3.5 w-3.5 shrink-0" /></button>
                </th>;
              })}</tr></thead>
              <tbody className="divide-y divide-slate-100">{sortedDepartments.slice(0, 10).map((unit) => <tr key={unit.name} className="hover:bg-white"><th scope="row" className="max-w-56 px-2 py-3 font-medium text-slate-700"><Link href={queueLink({ department: unit.name })} className="break-words text-blue-700 hover:underline">{unit.name}</Link></th><td className="px-2 py-3 text-right"><Link href={queueLink({ department: unit.name, status: "all", since: summary.since })} className="hover:text-blue-700 hover:underline">{number(unit.started)}</Link></td><td className="px-2 py-3 text-right text-emerald-700">{number(unit.completed)}</td><td className="px-2 py-3 text-right font-medium"><Link href={queueLink({ department: unit.name })} className="hover:text-blue-700 hover:underline">{number(unit.pending)}</Link></td><td className={`px-2 py-3 text-right font-medium ${unit.overdue ? "text-red-600" : "text-slate-400"}`}><Link href={queueLink({ department: unit.name, status: "overdue" })} className="hover:underline">{number(unit.overdue)}</Link></td></tr>)}</tbody>
            </table></div>
            {!summary.departments.length && <p className="py-8 text-center text-sm text-slate-500">{t.dashboard.noDepartments}</p>}
          </section>

          <section className="min-w-0 py-5">
            <h2 className="text-sm font-semibold text-slate-900">{t.caseDashboard.overdue}</h2>
            <div className="mt-4"><p className={`text-2xl font-semibold ${summary.overdue ? "text-red-600" : "text-emerald-700"}`}>{summary.pending ? `${number(summary.overdue / summary.pending * 100, 1)}%` : "-"}</p><p className="mt-1 text-xs text-slate-500">{t.caseDashboard.completionHint(number(summary.overdue), number(summary.pending))}</p><p className="mt-4 text-xs leading-5 text-slate-500">{t.caseDashboard.rule}</p></div>
          </section>
        </div>

        <section aria-label={t.caseDashboard.attention} className="border-t border-slate-200 py-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900"><TriangleAlert className="h-4 w-4 text-amber-600" />{t.caseDashboard.attention}</h2><Link href={queueLink({ status: "open" })} className="inline-flex items-center gap-1 text-xs text-blue-700 hover:underline">{t.dashboard.allQueue}<ArrowRight className="h-3 w-3" /></Link></div>
          <ul className="divide-y divide-slate-200">{summary.attention.slice(0, 6).map((item) => {
            const late = isCaseOverdue(item, snapshot.loadedAt, department);
            const age = Math.max(0, Math.floor((Date.parse(snapshot.loadedAt) - Date.parse(item.startedAt)) / 86400000));
            return <li key={item.id}><Link href={queueLink({ status: "all", parent: item.id })} className="grid gap-3 py-3 hover:bg-white md:grid-cols-[minmax(0,1fr)_minmax(10rem,0.65fr)_9rem]">
              <div className="min-w-0"><span className="font-mono text-xs font-semibold text-blue-700">{item.code}</span><p className="mt-1 break-words text-sm font-medium leading-5 text-slate-800">{item.title}</p><p className="mt-1 text-xs text-slate-500">{date(item.startedAt)}</p></div>
              <div className="min-w-0"><Badge tone="amber">{t.queue.approvalStates.running}</Badge><p className="mt-2 text-xs text-slate-600">{t.caseDashboard.progress(number(item.parent?.completedReviews ?? 0), number(item.parent?.totalReviews ?? item.reviews.length))}</p></div>
              <div className="text-xs md:text-right"><p className={late ? "font-medium text-red-600" : "text-slate-500"}>{late ? t.common.overdue : t.queue.parentPending(number(item.parent?.pendingReviews ?? 0))}</p><p className="mt-2 text-slate-500">{t.dashboard.openDays(number(age))}</p></div>
            </Link></li>;
          })}</ul>
          {!summary.attention.length && <div className="flex flex-col items-center gap-2 py-10 text-sm text-slate-500"><Inbox className="h-7 w-7 text-slate-300" />{t.dashboard.noOpen}</div>}
        </section>
      </> : null}
    </>
  );
}