"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DEPT_ICONS, DeptIcon } from "@/components/shared/dept-icon";
import { createDepartment, deleteDepartment, updateDepartment } from "@/server/actions/departments";
import type { Department, Profile } from "@/lib/types/database";

type MemberLite = Pick<Profile, "id" | "roblox_username" | "roblox_display_name" | "avatar_url" | "role">;

const PRESET_COLORS = ["#3987e5", "#e66767", "#c98500", "#199e70", "#9085e9", "#d55181", "#d95926", "#008300"];

/** Create (no `department` prop) or edit (with `department`) a department. */
export function DepartmentDialog({ members, department, canDelete }: { members: MemberLite[]; department?: Department; canDelete?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [name, setName] = useState(department?.name ?? "");
  const [description, setDescription] = useState(department?.description ?? "");
  const [color, setColor] = useState(department?.color ?? PRESET_COLORS[0]);
  const [icon, setIcon] = useState(department?.icon ?? "shield");
  const [leaderId, setLeaderId] = useState(department?.leader_id ?? "none");
  const [quotaHours, setQuotaHours] = useState(String((department?.quota_minutes ?? 0) / 60));

  const submit = () =>
    start(async () => {
      const input = {
        name,
        description,
        color,
        icon,
        leaderId: leaderId === "none" ? null : leaderId,
        quotaMinutes: Math.round(Number(quotaHours || 0) * 60),
      };
      const r = department ? await updateDepartment(department.id, input) : await createDepartment(input);
      if (!r.ok) { toast.error(r.error); return; }
      toast.success(department ? "Department updated" : "Department created");
      setOpen(false);
      if (!department && "data" in r && r.data) router.push(`/departments/${r.data}`);
      router.refresh();
    });

  const remove = () =>
    start(async () => {
      if (!department || !confirm(`Delete ${department.name}? Its roster, ranks and channels will be removed.`)) return;
      const r = await deleteDepartment(department.id);
      if (!r.ok) { toast.error(r.error); return; }
      toast.success("Department deleted");
      setOpen(false);
      router.push("/departments");
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {department ? (
          <Button variant="outline" size="sm"><Settings2 className="size-3.5" /> Manage</Button>
        ) : (
          <Button size="sm"><Plus className="size-3.5" /> New department</Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{department ? "Department settings" : "Create a department"}</DialogTitle>
          <DialogDescription>{department ? "Changes apply immediately." : "A chat channel, announcements channel and starter ranks are created automatically."}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sheriff's Office" /></div>
          <div className="grid gap-1.5"><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[60px]" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Colour</Label>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setColor(c)} className={`size-6 rounded-md border-2 ${color === c ? "border-foreground" : "border-transparent"}`} style={{ background: c }} aria-label={c} />
                ))}
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Icon</Label>
              <div className="flex flex-wrap gap-1.5">
                {Object.keys(DEPT_ICONS).map((k) => (
                  <button key={k} type="button" onClick={() => setIcon(k)} className={`flex size-7 items-center justify-center rounded-md border ${icon === k ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent"}`} aria-label={k}>
                    <DeptIcon name={k} className="size-4" />
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Leader</Label>
              <Select value={leaderId} onValueChange={setLeaderId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No leader</SelectItem>
                  {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.roblox_username}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Weekly quota (hours)</Label>
              <Input type="number" min={0} step={0.5} value={quotaHours} onChange={(e) => setQuotaHours(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter className="sm:justify-between">
          {department && canDelete ? <Button variant="ghost" className="text-destructive" onClick={remove} disabled={pending}>Delete</Button> : <span />}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={pending || name.trim().length < 2}>{department ? "Save" : "Create"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
