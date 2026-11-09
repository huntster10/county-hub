"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Settings2, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { deleteApplicationForm, saveApplicationForm } from "@/server/actions/community";
import type { ApplicationForm, Department, FormQuestion } from "@/lib/types/database";

const newQuestion = (): FormQuestion => ({ id: Math.random().toString(36).slice(2, 8), label: "", type: "short", required: true });

export function FormBuilderDialog({ departments, isAdmin, meId, existing }: { departments: Pick<Department, "id" | "name" | "color" | "leader_id">[]; isAdmin: boolean; meId: string; existing?: ApplicationForm }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [departmentId, setDepartmentId] = useState(existing?.department_id ?? "none");
  const [isOpen, setIsOpen] = useState(existing?.is_open ?? true);
  const [questions, setQuestions] = useState<FormQuestion[]>(existing?.questions?.length ? existing.questions : [newQuestion()]);

  // Leaders may only create forms for departments they lead.
  const deptOptions = isAdmin ? departments : departments.filter((d) => d.leader_id === meId);

  const update = (i: number, patch: Partial<FormQuestion>) => setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));

  const save = () =>
    start(async () => {
      const r = await saveApplicationForm(
        { title, description, departmentId: departmentId === "none" ? null : departmentId, isOpen, questions: questions.filter((q) => q.label.trim()) },
        existing?.id,
      );
      if (!r.ok) { toast.error(r.error); return; }
      toast.success(existing ? "Form saved" : "Form created");
      setOpen(false);
      router.push(`/applications/${r.data}`);
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {existing ? <Button variant="outline" size="sm"><Settings2 className="size-3.5" /> Edit form</Button> : <Button size="sm"><Plus className="size-3.5" /> New form</Button>}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit application form" : "Create application form"}</DialogTitle>
          <DialogDescription>Applicants answer these questions; reviewers accept or deny. Accepting a department form adds them to the roster.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Police Department Application" /></div>
          <div className="grid gap-1.5"><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[60px]" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Department (optional)</Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {isAdmin && <SelectItem value="none">General / staff</SelectItem>}
                  {deptOptions.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center justify-between rounded-md border px-3 text-sm"><span>Accepting applications</span><Switch checked={isOpen} onCheckedChange={setIsOpen} /></label>
          </div>

          <div className="space-y-2">
            <Label>Questions</Label>
            {questions.map((q, i) => (
              <div key={q.id} className="flex items-start gap-2 rounded-md border p-2">
                <GripVertical className="mt-2.5 size-4 text-muted-foreground" />
                <div className="grid flex-1 gap-2">
                  <Input value={q.label} onChange={(e) => update(i, { label: e.target.value })} placeholder={`Question ${i + 1}`} />
                  <div className="flex flex-wrap items-center gap-2">
                    <Select value={q.type} onValueChange={(v) => update(i, { type: v as FormQuestion["type"] })}>
                      <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="short">Short answer</SelectItem>
                        <SelectItem value="long">Paragraph</SelectItem>
                        <SelectItem value="select">Multiple choice</SelectItem>
                        <SelectItem value="yesno">Yes / No</SelectItem>
                      </SelectContent>
                    </Select>
                    {q.type === "select" && <Input className="h-8 flex-1" placeholder="Options, comma separated" value={(q.options ?? []).join(", ")} onChange={(e) => update(i, { options: e.target.value.split(",").map((s) => s.trim()) })} />}
                    <label className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground"><Switch checked={q.required} onCheckedChange={(v) => update(i, { required: v })} /> Required</label>
                  </div>
                </div>
                <Button variant="ghost" size="icon-sm" className="text-destructive" onClick={() => setQuestions((qs) => qs.filter((_, idx) => idx !== i))} disabled={questions.length === 1}><Trash2 className="size-3.5" /></Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setQuestions((qs) => [...qs, newQuestion()])}><Plus className="size-3.5" /> Add question</Button>
          </div>
        </div>
        <DialogFooter className="sm:justify-between">
          {existing ? (
            <Button variant="ghost" className="text-destructive" disabled={pending} onClick={() => confirm("Delete this form and all its applications?") && start(async () => { const r = await deleteApplicationForm(existing.id); if (r.ok) { toast.success("Form deleted"); router.push("/applications"); router.refresh(); } else toast.error(r.error); })}>Delete form</Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={pending || title.trim().length < 2 || !questions.some((q) => q.label.trim())}>{existing ? "Save" : "Create"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
