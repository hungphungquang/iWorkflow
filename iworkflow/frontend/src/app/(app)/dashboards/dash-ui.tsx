"use client";

// Small localized building blocks shared by the three dashboards (home, unit, company).

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui";
import { dueStatus, hoursBetween, stateTone, type CaseState, type DueStatus } from "@/lib/fourm-case";
import { common, fmtHours, useLocale, type Locale } from "@/lib/i18n";

export const dueColor: Record<DueStatus, string> = { overdue: "#ef4444", dueSoon: "#f59e0b", normal: "#10b981" };
export const stateColor: Record<CaseState, string> = { running: "#3b82f6", completed: "#10b981", rejected: "#ef4444", cancelled: "#94a3b8" };
export const dueOrder: DueStatus[] = ["overdue", "dueSoon", "normal"];
export const stateOrder: CaseState[] = ["running", "completed", "rejected", "cancelled"];
export const dueRank: Record<DueStatus, number> = { overdue: 0, dueSoon: 1, normal: 2 };

const dueTone: Record<DueStatus, "red" | "amber" | "green"> = { overdue: "red", dueSoon: "amber", normal: "green" };
const left: Record<Locale, (h: string) => string> = { vi: (h) => `Còn ${h}`, en: (h) => `${h} left` };

/** Localized due badge (overdue by / time left / on track) against the demo clock. */
export function DueTag({ due, now }: { due: string; now: string }) {
  const locale = useLocale();
  const st = dueStatus(due, now);
  const h = fmtHours(hoursBetween(now, due), locale);
  const text = st === "overdue" ? `${common[locale].due.overdue} ${h}` : st === "dueSoon" ? left[locale](h) : common[locale].due.normal;
  return <Badge tone={dueTone[st]}>{text}</Badge>;
}

export function StateTag({ state }: { state: CaseState }) {
  const locale = useLocale();
  return <Badge tone={stateTone[state]}>{common[locale].state[state]}</Badge>;
}

export function CardLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline">
      {children} <ArrowRight className="h-3 w-3" />
    </Link>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-slate-400">{children}</p>;
}

export { caseStepLabel, taskStepLabel } from "@/lib/i18n-4m";

export function median(values: number[]) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
