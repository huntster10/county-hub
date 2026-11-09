import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isServiceRoleConfigured } from "@/lib/env";
import type { ErlcServerSnapshot } from "./types";

/**
 * Copies the logs from an ER:LC snapshot into the game_events table so the
 * event feed has history beyond what the API returns, and charts have data.
 * Duplicates are ignored thanks to the unique (kind, occurred_at, payload) key.
 */
export async function syncGameEvents(snapshot: ErlcServerSnapshot) {
  if (!isServiceRoleConfigured()) return;
  const rows: { kind: string; payload: Record<string, unknown>; occurred_at: string }[] = [];
  const ts = (t: number) => new Date(t * 1000).toISOString();

  for (const j of snapshot.JoinLogs ?? []) rows.push({ kind: j.Join ? "join" : "leave", payload: { player: j.Player }, occurred_at: ts(j.Timestamp) });
  for (const k of snapshot.KillLogs ?? []) rows.push({ kind: "kill", payload: { killer: k.Killer, killed: k.Killed }, occurred_at: ts(k.Timestamp) });
  for (const c of snapshot.CommandLogs ?? []) rows.push({ kind: "command", payload: { player: c.Player, command: c.Command }, occurred_at: ts(c.Timestamp) });
  for (const m of snapshot.ModCalls ?? []) rows.push({ kind: "modcall", payload: { caller: m.Caller, moderator: m.Moderator }, occurred_at: ts(m.Timestamp) });

  if (rows.length === 0) return;
  try {
    const admin = createAdminClient();
    await admin.from("game_events").upsert(rows, { onConflict: "kind,occurred_at,payload", ignoreDuplicates: true });
  } catch (err) {
    console.warn("[erlc sync] failed to store events", err);
  }
}
