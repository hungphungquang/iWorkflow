import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, actions, children, className = "" }: { title?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-lg border border-slate-200 bg-white ${className}`}>
      {title && (
        <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          {actions}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

const badgeTones = {
  gray: "bg-slate-100 text-slate-700",
  blue: "bg-blue-50 text-blue-700",
  green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-800",
  red: "bg-red-50 text-red-700",
  violet: "bg-violet-50 text-violet-700",
} as const;

export function Badge({ tone = "gray", children }: { tone?: keyof typeof badgeTones; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${badgeTones[tone]}`}>{children}</span>;
}

const buttonVariants = {
  primary: "bg-blue-600 text-white hover:bg-blue-700",
  secondary: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
  danger: "border border-red-300 bg-white text-red-700 hover:bg-red-50",
  ghost: "text-slate-600 hover:bg-slate-100",
} as const;

export function buttonClass(variant: keyof typeof buttonVariants = "secondary") {
  return `inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${buttonVariants[variant]}`;
}

export function LinkButton({ href, variant, children }: { href: string; variant?: keyof typeof buttonVariants; children: ReactNode }) {
  return (
    <Link href={href} className={buttonClass(variant)}>
      {children}
    </Link>
  );
}

export function StatCard({ label, value, hint, tone = "gray" }: { label: string; value: string; hint?: string; tone?: "gray" | "red" | "amber" | "green" }) {
  const accent = { gray: "text-slate-900", red: "text-red-600", amber: "text-amber-600", green: "text-emerald-600" }[tone];
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${accent}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

/** Reviewer annotation explaining intended behaviour; not part of the final UI. */
export function WireNote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-amber-400 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
      <span className="mr-1 font-semibold">Ghi chú wireframe:</span>
      {children}
    </div>
  );
}

export function Placeholder({ label, className = "h-48" }: { label: string; className?: string }) {
  return (
    <div className={`flex items-center justify-center rounded-md border-2 border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500 ${className}`}>
      {label}
    </div>
  );
}

export function SourceBadge({ source }: { source: "new" | "legacy" }) {
  return source === "legacy" ? <Badge tone="violet">Hệ cũ</Badge> : <Badge tone="blue">Hệ mới</Badge>;
}

export function StatusBadge({ status }: { status: "overdue" | "dueSoon" | "normal" }) {
  if (status === "overdue") return <Badge tone="red">Quá hạn</Badge>;
  if (status === "dueSoon") return <Badge tone="amber">Sắp đến hạn</Badge>;
  return <Badge tone="green">Trong hạn</Badge>;
}

export function Field({ label, children, span = 1, required }: { label: string; children: ReactNode; span?: 1 | 2 | 3 | 4; required?: boolean }) {
  const spans = { 1: "md:col-span-1", 2: "md:col-span-2", 3: "md:col-span-3", 4: "md:col-span-4" };
  return (
    <label className={`flex flex-col gap-1 ${spans[span]}`}>
      <span className="text-xs font-medium text-slate-600">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}

export const inputClass = "w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none";
