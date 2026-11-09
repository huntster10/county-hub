"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Send, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { submitApplication } from "@/server/actions/community";
import type { Application, ApplicationForm as FormType } from "@/lib/types/database";

export function ApplicationForm({ form, myApplications }: { form: FormType; myApplications: Application[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const latest = myApplications[0];
  const hasPending = latest?.status === "pending";

  const missing = form.questions.filter((q) => q.required && !answers[q.id]?.trim());

  const submit = () =>
    start(async () => {
      const r = await submitApplication(form.id, answers);
      if (!r.ok) { toast.error(r.error); return; }
      toast.success("Application submitted! You'll see the result here.");
      setAnswers({});
      router.refresh();
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{hasPending ? "Your application is being reviewed" : latest ? "Apply again" : "Apply"}</CardTitle>
        <CardDescription>{form.questions.length} question{form.questions.length === 1 ? "" : "s"} · answers are only visible to reviewers.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {myApplications.length > 0 && (
          <ul className="space-y-1.5">
            {myApplications.slice(0, 3).map((a) => (
              <li key={a.id} className="flex items-center gap-2 rounded-md border bg-background/40 px-3 py-2 text-xs">
                {a.status === "accepted" ? <CheckCircle2 className="size-3.5 text-success" /> : a.status === "denied" ? <XCircle className="size-3.5 text-destructive" /> : <Clock className="size-3.5 text-warning" />}
                <span className="text-muted-foreground">Submitted {format(new Date(a.created_at), "MMM d, yyyy")}</span>
                <Badge variant={a.status === "accepted" ? "success" : a.status === "denied" ? "destructive" : "warning"} className="ml-auto uppercase">{a.status}</Badge>
                {a.review_note && <span className="w-full pl-5 text-muted-foreground">Reviewer note: {a.review_note}</span>}
              </li>
            ))}
          </ul>
        )}

        {!form.is_open ? (
          <p className="rounded-md border bg-muted/40 p-4 text-center text-sm text-muted-foreground">This form is currently closed.</p>
        ) : hasPending ? null : (
          <>
            {form.questions.map((q, i) => (
              <div key={q.id} className="grid gap-1.5">
                <Label className="text-sm text-foreground">{i + 1}. {q.label} {q.required && <span className="text-destructive">*</span>}</Label>
                {q.type === "short" && <Input value={answers[q.id] ?? ""} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} />}
                {q.type === "long" && <Textarea value={answers[q.id] ?? ""} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} className="min-h-[100px]" />}
                {(q.type === "select" || q.type === "yesno") && (
                  <Select value={answers[q.id] ?? ""} onValueChange={(v) => setAnswers({ ...answers, [q.id]: v })}>
                    <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
                    <SelectContent>{(q.type === "yesno" ? ["Yes", "No"] : q.options ?? []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </div>
            ))}
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{missing.length ? `${missing.length} required question${missing.length === 1 ? "" : "s"} left` : "Ready to submit"}</p>
              <Button onClick={submit} disabled={pending || missing.length > 0}><Send className="size-4" /> Submit application</Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
