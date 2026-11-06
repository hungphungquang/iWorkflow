"use client";

import { useEffect, useState } from "react";
import { createPersistentStore, READ_ONLY } from "./store";
import { buildReviewDemo, type ReviewSnapshot } from "./working-standard";

export const reviewDemoStore = createPersistentStore("iw.working-standard.v1", buildReviewDemo);

export function useWorkingStandardData(source?: string | null) {
  const demo = reviewDemoStore.use();
  const initialMode = source === "demo" ? "demo" : source === "iw_prod" || READ_ONLY ? "iw_prod" : "demo";
  const [mode, setMode] = useState<"demo" | "iw_prod">(initialMode);
  const [remote, setRemote] = useState<ReviewSnapshot | null>(null);
  const [loading, setLoading] = useState(initialMode === "iw_prod");
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (mode !== "iw_prod") return;
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/working-standard/snapshot", { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Không tải được dữ liệu.");
        if (!controller.signal.aborted) setRemote(data as ReviewSnapshot);
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Không tải được dữ liệu.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [mode, refresh]);

  function reload() {
    if (mode === "demo") reviewDemoStore.set((current) => ({ ...current, loadedAt: new Date().toISOString() }));
    else setRefresh((value) => value + 1);
  }

  return { mode, setMode, snapshot: mode === "demo" ? demo : remote, loading: mode === "iw_prod" && loading, error: mode === "iw_prod" ? error : "", reload };
}