import "server-only";
import { getErlcApiKey } from "@/lib/settings";
import {
  ErlcApiError,
  type ErlcBans,
  type ErlcRateLimit,
  type ErlcServerSnapshot,
  type ErlcServerStatus,
} from "./types";

/**
 * Server-side wrapper around the ER:LC Private Server API.
 *
 *  - Base URL is https://api.erlc.gg (the old policeroleplay.community domain is dead).
 *  - Every request needs the `server-key` header. The key is read from Settings
 *    (database) or ERLC_API_KEY in .env.local.
 *  - The API is rate limited, so successful snapshots are cached in memory for
 *    a few seconds. Many dashboard widgets can share one request.
 */
const BASE = "https://api.erlc.gg";
const SNAPSHOT_TTL_MS = 8_000;

let snapshotCache: { at: number; data: ErlcServerSnapshot; rate: ErlcRateLimit } | null = null;
let inflight: Promise<{ data: ErlcServerSnapshot; rate: ErlcRateLimit }> | null = null;

function readRateLimit(headers: Headers): ErlcRateLimit {
  const num = (h: string) => (headers.get(h) ? Number(headers.get(h)) : null);
  return {
    bucket: headers.get("X-RateLimit-Bucket"),
    limit: num("X-RateLimit-Limit"),
    remaining: num("X-RateLimit-Remaining"),
    resetAt: num("X-RateLimit-Reset"),
  };
}

async function erlcFetch<T>(path: string, init?: RequestInit): Promise<{ data: T; rate: ErlcRateLimit }> {
  const key = await getErlcApiKey();
  if (!key) throw new ErlcApiError("No ER:LC API key configured. Add it under Settings.", 0);

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "server-key": key,
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const rate = readRateLimit(res.headers);

  if (!res.ok) {
    let message = `ER:LC API error ${res.status}`;
    let code: number | undefined;
    try {
      const body = (await res.json()) as { message?: string; error?: string; code?: number };
      message = body.message ?? body.error ?? message;
      code = body.code;
    } catch {
      /* non-JSON body */
    }
    if (res.status === 403) message = "ER:LC rejected the API key. Check it under Settings.";
    if (res.status === 429) message = "ER:LC rate limit hit — try again in a few seconds.";
    throw new ErlcApiError(message, res.status, code);
  }

  return { data: (await res.json()) as T, rate };
}

/**
 * One call that returns server status + players + staff + every log type.
 * Cached for SNAPSHOT_TTL_MS so the dashboard can refresh freely.
 */
export async function getServerSnapshot(opts: { force?: boolean } = {}) {
  if (!opts.force && snapshotCache && Date.now() - snapshotCache.at < SNAPSHOT_TTL_MS) {
    return { data: snapshotCache.data, rate: snapshotCache.rate, cached: true };
  }
  if (inflight) return { ...(await inflight), cached: true };

  const query = new URLSearchParams({
    Players: "true",
    Staff: "true",
    JoinLogs: "true",
    KillLogs: "true",
    CommandLogs: "true",
    ModCalls: "true",
    Queue: "true",
    Vehicles: "true",
  });

  inflight = erlcFetch<ErlcServerSnapshot>(`/v2/server?${query}`);
  try {
    const result = await inflight;
    snapshotCache = { at: Date.now(), ...result };
    return { ...result, cached: false };
  } finally {
    inflight = null;
  }
}

/** Lightweight status only (name, player count, join code). */
export async function getServerStatus() {
  return erlcFetch<ErlcServerStatus>("/v1/server");
}

export async function getBans() {
  return erlcFetch<ErlcBans>("/v1/server/bans");
}

/**
 * Run an in-game command as "virtual server management".
 * Example commands: ":h Hello everyone", ":kick PlayerName", ":ban PlayerName",
 * ":pm PlayerName message", ":weather rain", ":time 12".
 * Rate limited to roughly one command every few seconds.
 */
export async function runCommand(command: string) {
  const trimmed = command.trim();
  if (!trimmed.startsWith(":")) throw new ErlcApiError("Commands must start with ':' (e.g. ':h Hello')", 400);
  return erlcFetch<{ message: string; commandId?: string }>("/v2/server/command", {
    method: "POST",
    body: JSON.stringify({ command: trimmed }),
  });
}

/** Map an ER:LC team name to a colour used in the UI. */
export function teamColor(team: string) {
  switch (team.toLowerCase()) {
    case "police":
      return "#3987e5";
    case "sheriff":
      return "#9085e9";
    case "fire":
      return "#e66767";
    case "dot":
      return "#c98500";
    case "jail":
      return "#8a8a8a";
    default:
      return "#199e70"; // civilian
  }
}
