"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserAvatar } from "@/components/shared/user-avatar";
import { createCategory, createChannel, deleteChannel, startDm, updateChannel } from "@/server/actions/messages";
import type { Channel, Department, Profile } from "@/lib/types/database";
import type { ChannelTree } from "@/lib/data/messages";

type MemberLite = Pick<Profile, "id" | "roblox_username" | "roblox_display_name" | "avatar_url" | "role">;

const ROLE_OPTIONS = [
  { value: "member", label: "Everyone" },
  { value: "department_leader", label: "Department leaders +" },
  { value: "staff", label: "Staff +" },
  { value: "admin", label: "Admins only" },
];

export function NewChannelDialog({
  open,
  onOpenChange,
  categories,
  departments,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  categories: ChannelTree["categories"];
  departments: Pick<Department, "id" | "name" | "color">[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [type, setType] = useState<"text" | "announcement">("text");
  const [categoryId, setCategoryId] = useState<string>("none");
  const [departmentId, setDepartmentId] = useState<string>("none");
  const [minRole, setMinRole] = useState("member");
  const [isPrivate, setIsPrivate] = useState(false);
  const [newCategory, setNewCategory] = useState("");

  const submit = () =>
    start(async () => {
      if (newCategory.trim()) {
        const c = await createCategory(newCategory);
        if (!c.ok) { toast.error(c.error); return; }
      }
      const r = await createChannel({
        name,
        topic,
        type,
        categoryId: categoryId === "none" ? null : categoryId,
        departmentId: departmentId === "none" ? null : departmentId,
        minRole: minRole as "member",
        isPrivate,
      });
      if (!r.ok) { toast.error(r.error); return; }
      toast.success(`#${name} created`);
      onOpenChange(false);
      router.push(`/messages/${r.data}`);
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a channel</DialogTitle>
          <DialogDescription>Channels keep conversations organised. Names become lowercase with dashes.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. patrol-chat" />
          </div>
          <div className="grid gap-1.5">
            <Label>Topic (optional)</Label>
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="What is this channel for?" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as "text")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text — everyone can post</SelectItem>
                  <SelectItem value="announcement">Announcement — staff post only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Who can see it</Label>
              <Select value={minRole} onValueChange={setMinRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No category</SelectItem>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Or new category</Label>
              <Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="e.g. Events" />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Department (members only)</Label>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not department-specific</SelectItem>
                {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Private channel</p>
              <p className="text-xs text-muted-foreground">Only people you invite can see it.</p>
            </div>
            <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={pending || name.trim().length < 2}>Create channel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EditChannelDialog({
  channel,
  open,
  onOpenChange,
  canDelete,
}: {
  channel: Channel;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState(channel.name);
  const [topic, setTopic] = useState(channel.topic ?? "");
  const [type, setType] = useState<"text" | "announcement">(channel.type === "announcement" ? "announcement" : "text");
  const [minRole, setMinRole] = useState<string>(channel.min_role ?? "member");

  const save = () =>
    start(async () => {
      const r = await updateChannel(channel.id, { name, topic, type, minRole: minRole as "member" });
      if (!r.ok) { toast.error(r.error); return; }
      toast.success("Channel updated");
      onOpenChange(false);
      router.refresh();
    });

  const remove = () =>
    start(async () => {
      if (!confirm(`Delete #${channel.name} and every message in it? This cannot be undone.`)) return;
      const r = await deleteChannel(channel.id);
      if (!r.ok) { toast.error(r.error); return; }
      toast.success("Channel deleted");
      router.push("/messages");
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Channel settings</DialogTitle>
          <DialogDescription>#{channel.name}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="grid gap-1.5"><Label>Topic</Label><Input value={topic} onChange={(e) => setTopic(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as "text")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="announcement">Announcement</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Who can see it</Label>
              <Select value={minRole} onValueChange={setMinRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ROLE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter className="sm:justify-between">
          {canDelete ? (
            <Button variant="ghost" className="text-destructive" onClick={remove} disabled={pending}>Delete channel</Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={save} disabled={pending}>Save</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function NewDmDialog({
  open,
  onOpenChange,
  members,
  meId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  members: MemberLite[];
  meId: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [pending, start] = useTransition();
  const list = members
    .filter((m) => m.id !== meId)
    .filter((m) => !q || m.roblox_username.toLowerCase().includes(q.toLowerCase()) || (m.roblox_display_name ?? "").toLowerCase().includes(q.toLowerCase()))
    .slice(0, 30);

  const pick = (id: string) =>
    start(async () => {
      const r = await startDm(id);
      if (!r.ok) { toast.error(r.error); return; }
      onOpenChange(false);
      router.push(`/messages/${r.data}`);
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New direct message</DialogTitle>
          <DialogDescription>Pick someone to chat with privately.</DialogDescription>
        </DialogHeader>
        <Input autoFocus placeholder="Search members…" value={q} onChange={(e) => setQ(e.target.value)} />
        <ul className="max-h-72 space-y-0.5 overflow-y-auto">
          {list.map((m) => (
            <li key={m.id}>
              <button
                disabled={pending}
                onClick={() => pick(m.id)}
                className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-accent disabled:opacity-50"
              >
                <UserAvatar username={m.roblox_username} avatarUrl={m.avatar_url} className="size-7" />
                <div className="min-w-0">
                  <p className="truncate text-sm">{m.roblox_display_name ?? m.roblox_username}</p>
                  <p className="truncate text-[11px] text-muted-foreground">@{m.roblox_username}</p>
                </div>
              </button>
            </li>
          ))}
          {list.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">No one matches.</li>}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
