"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNowStrict } from "date-fns";
import { Check, X, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserAvatar } from "@/components/shared/user-avatar";
import { reviewApplication } from "@/server/actions/community";
import type { Application, FormQuestion } from "@/lib/types/database";

export type ReviewRow = Application & {
  applicant: { id: string; roblox_username: string; roblox_display_name: string | null; avatar_url: string | null };
  reviewer: { roblox_username: string } | null;
};

export function ReviewQueue({ rows, questions }: { rows: ReviewRow[]; questions: FormQuestion[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tab, setTab] = useState<"pending" | "accepted" | "denied">("pending");
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const list = rows.filter((r) => r.status === tab);

  const decide = (id: string, status: "accepted" | "denied") =>
    start(async () => {
      const r = await reviewApplication(id, status, note || undefined);
      if (!r.ok) { toast.error(r.error); return; }
      toast.success(status === "accepted" ? "Application accepted" : "Application denied");
      setNote(""); setOpen(null);
      router.refresh();
    });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div><CardTitle>Review queue</CardTitle><CardDescription className="mt-1">{rows.filter((r) => r.status === "pending").length} waiting</CardDescription></div>
        <Tabs value={tab} onValueChange={(v) => setTab(v as "pending")}>
          <TabsList><TabsTrigger value="pending">Pending</TabsTrigger><TabsTrigger value="accepted">Accepted</TabsTrigger><TabsTrigger value="denied">Denied</TabsTrigger></TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="space-y-2">
        {list.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Nothing here.</p>}
        {list.map((a) => (
          <div key={a.id} className="rounded-lg border bg-background/40">
            <button onClick={() => setOpen(open === a.id ? null : a.id)} className="flex w-full items-center gap-3 p-3 text-left">
              <UserAvatar username={a.applicant.roblox_username} avatarUrl={a.applicant.avatar_url} className="size-8" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{a.applicant.roblox_display_name ?? a.applicant.roblox_username} <span className="text-xs font-normal text-muted-foreground">@{a.applicant.roblox_username}</span></p>
                <p className="text-[11px] text-muted-foreground">{formatDistanceToNowStrict(new Date(a.created_at), { addSuffix: true })}{a.reviewer && ` · reviewed by ${a.reviewer.roblox_username}`}</p>
              </div>
              <Badge variant={a.status === "accepted" ? "success" : a.status === "denied" ? "destructive" : "warning"} className="uppercase">{a.status}</Badge>
              <ChevronDown className={`size-4 text-muted-foreground transition-transform ${open === a.id ? "rotate-180" : ""}`} />
            </button>
            {open === a.id && (
              <div className="space-y-3 border-t p-3">
                {questions.map((q) => (
                  <div key={q.id}><p className="text-xs font-medium text-muted-foreground">{q.label}</p><p className="whitespace-pre-wrap text-sm">{a.answers[q.id] || <span className="italic text-muted-foreground">no answer</span>}</p></div>
                ))}
                {a.review_note && <p className="rounded-md bg-muted/50 p-2 text-xs"><span className="font-medium">Reviewer note:</span> {a.review_note}</p>}
                {a.status === "pending" && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Input placeholder="Optional note to the applicant" value={note} onChange={(e) => setNote(e.target.value)} className="h-8 flex-1" />
                    <Button size="sm" variant="success" disabled={pending} onClick={() => decide(a.id, "accepted")}><Check className="size-3.5" /> Accept</Button>
                    <Button size="sm" variant="destructive" disabled={pending} onClick={() => decide(a.id, "denied")}><X className="size-3.5" /> Deny</Button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
