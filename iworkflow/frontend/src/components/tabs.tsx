"use client";

import { useState, type ReactNode } from "react";

export type TabItem = { id: string; label: string; count?: number; content: ReactNode };

export function Tabs({ items }: { items: TabItem[] }) {
  const [active, setActive] = useState(items[0]?.id);
  const current = items.find((i) => i.id === active) ?? items[0];
  return (
    <div>
      <div role="tablist" className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
        {items.map((item) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={item.id === current.id}
            onClick={() => setActive(item.id)}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${
              item.id === current.id ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {item.label}
            {item.count !== undefined && <span className="ml-1.5 rounded bg-slate-100 px-1.5 text-xs text-slate-600">{item.count}</span>}
          </button>
        ))}
      </div>
      <div role="tabpanel">{current.content}</div>
    </div>
  );
}
