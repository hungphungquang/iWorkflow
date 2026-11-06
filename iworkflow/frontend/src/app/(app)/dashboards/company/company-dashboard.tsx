"use client";

import { ColumnChart, Donut, HBarChart } from "@/components/charts";
import { Card, LinkButton, PageHeader, StatCard, WireNote } from "@/components/ui";
import type { FourMStepId } from "@/lib/fourm";
import { caseState, dueStatus, openTasks, PROCESS_KEY } from "@/lib/fourm-case";
import { common, fmtNum, intlTag, stepNames, useLocale, useMessages, type Locale } from "@/lib/i18n";
import { departments, legacyDrain, monthlyTrend, processes } from "@/lib/mock";
import { useDb } from "@/lib/store";
import { CardLink, stateColor, stateOrder } from "../dash-ui";

type DrainCode = "A" | "B" | "C" | "D";

const vi = {
  title: "Tổng quan công ty",
  description: "Khối lượng quy trình 12 tháng (khảo sát iw_prod) và tình trạng 4M trực tiếp trên hệ mới.",
  detail4m: "Theo dõi 4M chi tiết",
  kpiStarted: "Hồ sơ mới 12 tháng",
  kpiStartedHint: (n: string) => `${n} quy trình đang dùng`,
  kpiFinished: "Hoàn tất 12 tháng",
  kpiFinishedHint: (pct: string) => `${pct}% số hồ sơ mới`,
  kpiOpen: "Đang mở (mọi quy trình)",
  kpiOpenHint: "kể cả hồ sơ tồn đọng hệ cũ",
  kpiAvg: "Thời gian xử lý TB",
  kpiAvgHint: "mỗi hồ sơ, TB các quy trình đang dùng",
  days: (d: string) => `${d} ngày`,
  kpi4m: "4M đang chạy",
  kpi4mHint: (n: string) => `${n} việc đang mở`,
  kpi4mOverdue: "4M có việc quá hạn",
  kpi4mOverdueHint: (n: string) => `${n} việc quá hạn`,
  trend: "Hồ sơ mới vs hoàn tất theo tháng",
  started: "Tạo mới",
  finished: "Hoàn tất",
  top: "Top 10 quy trình theo số hồ sơ mới (12 tháng)",
  sla: "Tỷ lệ xử lý đúng hạn theo bộ phận (30 ngày)",
  live4m: "4M trực tiếp – hồ sơ đang chạy theo bước",
  noRunning: "Không có hồ sơ 4M đang chạy.",
  states4m: "Hồ sơ 4M theo trạng thái",
  drain: "Tồn đọng hệ cũ cần xử lý trước chuyển đổi",
  drainOpen: "Đang mở trên hệ cũ",
  drainTouched: "Có hoạt động 90 ngày",
  drainAbandoned: "Bỏ dở",
  drainAction: "Hướng xử lý",
  migration: "Kế hoạch chuyển đổi",
  drainLabel: { A: "Nháp chưa gửi", B: "Chờ xác nhận cuối", C: "Trạng thái lỗi", D: "Dừng giữa quy trình" } as Record<DrainCode, string>,
  drainDo: { A: "Hủy", B: "Đóng hoàn tất", C: "Kỹ thuật kiểm tra", D: "Trưởng BP quyết định" } as Record<DrainCode, string>,
};

const M = {
  vi,
  en: {
    title: "Company overview",
    description: "12-month process volumes (iw_prod survey) and live 4M status on the new system.",
    detail4m: "4M tracking detail",
    kpiStarted: "Started (12 months)",
    kpiStartedHint: (n) => `${n} processes in use`,
    kpiFinished: "Finished (12 months)",
    kpiFinishedHint: (pct) => `${pct}% of started`,
    kpiOpen: "Open (all processes)",
    kpiOpenHint: "incl. legacy backlog",
    kpiAvg: "Average lead time",
    kpiAvgHint: "per case, mean of active processes",
    days: (d) => `${d} days`,
    kpi4m: "4M running",
    kpi4mHint: (n) => `${n} open tasks`,
    kpi4mOverdue: "4M with overdue tasks",
    kpi4mOverdueHint: (n) => `${n} overdue tasks`,
    trend: "Started vs finished by month",
    started: "Started",
    finished: "Finished",
    top: "Top 10 processes by cases started (12 months)",
    sla: "On-time rate by department (30 days)",
    live4m: "Live 4M – running cases by step",
    noRunning: "No running 4M cases.",
    states4m: "4M cases by state",
    drain: "Legacy backlog to clear before migration",
    drainOpen: "Open on legacy",
    drainTouched: "Active in last 90 days",
    drainAbandoned: "Abandoned",
    drainAction: "Resolution",
    migration: "Migration plan",
    drainLabel: { A: "Draft never submitted", B: "Awaiting final confirmation", C: "Error state", D: "Stopped mid-process" },
    drainDo: { A: "Cancel", B: "Close as completed", C: "Technical check", D: "Unit head decides" },
  },
} satisfies Record<Locale, typeof vi>;

const stepOrder: FourMStepId[] = ["create", "mgr", "gm", "relsec", "gd", "result", "rmgr", "rgm", "rrelsec", "rgd", "review"];
const drainColor: Record<DrainCode, string> = { A: "#94a3b8", B: "#10b981", C: "#ef4444", D: "#f59e0b" };

export function CompanyDashboard() {
  const db = useDb();
  const locale = useLocale();
  const t = useMessages(M);
  const c = common[locale];
  const tag = intlTag(locale);
  const n = (x: number, d = 0) => fmtNum(x, locale, d);

  const active = processes.filter((p) => p.started12m > 0);
  const started = processes.reduce((s, p) => s + p.started12m, 0);
  const finished = processes.reduce((s, p) => s + p.finished12m, 0);
  const open = processes.reduce((s, p) => s + p.open, 0);
  const avgDays = active.reduce((s, p) => s + p.avgDays, 0) / Math.max(active.length, 1);

  const running = db.cases.filter((x) => caseState(x) === "running");
  const tasks4m = running.flatMap(openTasks);
  const overdueTasks = tasks4m.filter((x) => dueStatus(x.due, db.now) === "overdue");
  const overdueCases = new Set(overdueTasks.map((x) => x.code)).size;

  const top = [...processes]
    .sort((a, b) => b.started12m - a.started12m)
    .slice(0, 10)
    .map((p) => ({ label: p.name, value: p.started12m, href: p.key === PROCESS_KEY ? "/4m" : p.key === "RelSecWS" ? "/working-standard/dashboard" : undefined, tone: p.key === PROCESS_KEY ? ("violet" as const) : ("blue" as const) }));

  const byStep = stepOrder
    .map((step) => {
      const list = running.filter((x) => x.sim.step === step);
      const late = list.some((x) => openTasks(x).some((k) => dueStatus(k.due, db.now) === "overdue"));
      return { label: stepNames[locale][step], value: list.length, href: `/4m/cases?view=all&state=running&step=${step}`, tone: late ? ("red" as const) : ("blue" as const) };
    })
    .filter((x) => x.value > 0);

  const stateSegments = stateOrder.map((s) => ({
    label: c.state[s],
    value: db.cases.filter((x) => caseState(x) === s).length,
    color: stateColor[s],
    href: `/4m/cases?view=all&state=${s}`,
  }));

  const drain = legacyDrain.categories.map((x) => ({ ...x, code: x.code as DrainCode }));

  return (
    <>
      <PageHeader title={t.title} description={t.description} actions={<LinkButton href="/4m">{t.detail4m}</LinkButton>} />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label={t.kpiStarted} value={n(started)} hint={t.kpiStartedHint(n(active.length))} />
        <StatCard label={t.kpiFinished} value={n(finished)} hint={t.kpiFinishedHint(n(started ? (finished / started) * 100 : 0))} tone="green" />
        <StatCard label={t.kpiOpen} value={n(open)} hint={t.kpiOpenHint} tone="amber" />
        <StatCard label={t.kpiAvg} value={t.days(n(avgDays, 1))} hint={t.kpiAvgHint} />
        <StatCard label={t.kpi4m} value={n(running.length)} hint={t.kpi4mHint(n(tasks4m.length))} tone="amber" />
        <StatCard label={t.kpi4mOverdue} value={n(overdueCases)} hint={t.kpi4mOverdueHint(n(overdueTasks.length))} tone="red" />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <Card title={t.trend} className="xl:col-span-2">
          <ColumnChart data={monthlyTrend.map((x) => ({ label: x.m, value: x.started, secondary: x.finished }))} primaryLabel={t.started} secondaryLabel={t.finished} />
        </Card>

        <Card title={t.sla}>
          <HBarChart
            data={departments.map((d) => ({ label: `${d.code} · ${d.name}`, value: d.sla, tone: d.sla < 80 ? ("red" as const) : ("green" as const) }))}
            unit="%"
            locale={tag}
            labelWidth="10rem"
          />
        </Card>

        <Card title={t.top} className="xl:col-span-2">
          <HBarChart data={top} locale={tag} labelWidth="18rem" />
        </Card>

        <Card title={t.states4m} actions={<CardLink href="/4m">{t.detail4m}</CardLink>}>
          <Donut segments={stateSegments} centerLabel={c.cases} locale={tag} />
        </Card>

        <Card title={t.live4m} className="xl:col-span-2" actions={<CardLink href="/4m/cases?view=all&state=running">{c.viewAll}</CardLink>}>
          {byStep.length ? <HBarChart data={byStep} locale={tag} labelWidth="14rem" /> : <p className="py-6 text-center text-sm text-slate-400">{t.noRunning}</p>}
        </Card>

        <Card title={t.drain} actions={<CardLink href="/migration">{t.migration}</CardLink>}>
          <dl className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: t.drainOpen, value: legacyDrain.openTotal, cls: "text-slate-900" },
              { label: t.drainTouched, value: legacyDrain.touched90d, cls: "text-emerald-600" },
              { label: t.drainAbandoned, value: legacyDrain.abandoned, cls: "text-red-600" },
            ].map((x) => (
              <div key={x.label} className="rounded-md bg-slate-50 p-2">
                <dt className="text-[10px] uppercase tracking-wide text-slate-500">{x.label}</dt>
                <dd className={`mt-1 text-lg font-semibold ${x.cls}`}>{n(x.value)}</dd>
              </div>
            ))}
          </dl>
          <ul className="mt-4 divide-y divide-slate-100 text-xs">
            {drain.map((x) => (
              <li key={x.code} className="flex items-center gap-2 py-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: drainColor[x.code] }} />
                <span className="font-mono text-slate-400">{x.code}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-slate-700">{t.drainLabel[x.code] ?? x.label}</span>
                  <span className="block truncate text-slate-500">
                    {t.drainAction}: {t.drainDo[x.code] ?? x.action}
                  </span>
                </span>
                <span className="font-semibold text-slate-800">{n(x.count)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-6">
        <WireNote>
          KPI quy trình, xu hướng tháng, top quy trình và SLA bộ phận là số liệu khảo sát iw_prod (dữ liệu mẫu tĩnh). Khối “4M trực tiếp” tính từ dữ liệu demo đang chạy – bấm cột để mở danh sách hồ sơ 4M đã lọc. Màu đỏ: bộ phận SLA &lt; 80% / bước có việc quá hạn.
        </WireNote>
      </div>
    </>
  );
}
