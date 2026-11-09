"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ErlcCommandLog, ErlcJoinLog, ErlcKillLog, ErlcModCall, ErlcPlayer, ErlcRateLimit, ErlcStaff, ErlcVehicle } from "@/lib/erlc/types";

export interface ErlcStatusPayload {
  configured: boolean;
  error?: string;
  fetchedAt?: string;
  rate?: ErlcRateLimit;
  server?: {
    Name: string;
    CurrentPlayers: number;
    MaxPlayers: number;
    JoinKey: string | null;
    TeamBalance: boolean;
    AccVerifiedReq: string;
    OwnerId: number;
  };
  players?: ErlcPlayer[];
  queue?: number[];
  staff?: ErlcStaff | null;
  vehicles?: ErlcVehicle[];
  logs?: {
    joins: ErlcJoinLog[];
    kills: ErlcKillLog[];
    commands: ErlcCommandLog[];
    modCalls: ErlcModCall[];
  } | null;
}

interface Ctx {
  data: ErlcStatusPayload | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const ErlcStatusContext = createContext<Ctx | null>(null);

/**
 * Polls /api/erlc/status on an interval and shares the result with every
 * widget underneath it, so the page makes ONE request no matter how many
 * widgets show live data.
 */
export function ErlcStatusProvider({ children, intervalMs = 15_000 }: { children: React.ReactNode; intervalMs?: number }) {
  const [data, setData] = useState<ErlcStatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async (force = false) => {
    try {
      const res = await fetch(`/api/erlc/status${force ? "?force=1" : ""}`, { cache: "no-store" });
      const json = (await res.json()) as ErlcStatusPayload;
      setData(json);
    } catch {
      setData({ configured: true, error: "Network error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch + polling. State is only set after the network reply arrives.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    timer.current = setInterval(() => {
      // Don't poll while the tab is hidden — saves API quota.
      if (document.visibilityState === "visible") void refresh();
    }, intervalMs);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [refresh, intervalMs]);

  return (
    <ErlcStatusContext.Provider value={{ data, loading, refresh: () => refresh(true) }}>{children}</ErlcStatusContext.Provider>
  );
}

export function useErlcStatus() {
  const ctx = useContext(ErlcStatusContext);
  if (!ctx) throw new Error("useErlcStatus must be used inside <ErlcStatusProvider>");
  return ctx;
}
