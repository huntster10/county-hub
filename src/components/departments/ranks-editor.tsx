"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { addRank, deleteRank, updateRank } from "@/server/actions/departments";
import type { DepartmentRank } from "@/lib/types/database";

/** Leaders manage the ladder of ranks. Higher level = more senior. */
export function RanksEditor({ departmentId, ranks }: { departmentId: string; ranks: DepartmentRank[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [level, setLevel] = useState("50");

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) { toast.error(r.error ?? "Failed"); return; }
      toast.success(msg);
      router.refresh();
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ranks</CardTitle>
        <CardDescription>The roster sorts by level (highest first). Click a name or level to edit it.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="divide-y divide-border/60 rounded-md border">
          {ranks.map((r) => (
            <li key={r.id} className="flex items-center gap-2 px-3 py-2">
              <Input
                defaultValue={r.name}
                className="h-8 flex-1"
                onBlur={(e) => e.target.value !== r.name && run(() => updateRank(r.id, { name: e.target.value }), "Rank renamed")}
              />
              <Input
                type="number"
                defaultValue={r.level}
                className="h-8 w-20"
                onBlur={(e) => Number(e.target.value) !== r.level && run(() => updateRank(r.id, { level: Number(e.target.value) }), "Level updated")}
              />
              <Button variant="ghost" size="icon-sm" className="text-destructive" disabled={pending} onClick={() => confirm(`Delete rank "${r.name}"? Members holding it will show no rank.`) && run(() => deleteRank(r.id), "Rank deleted")}>
                <Trash2 className="size-3.5" />
              </Button>
            </li>
          ))}
          {ranks.length === 0 && <li className="p-4 text-center text-xs text-muted-foreground">No ranks yet.</li>}
        </ul>
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <p className="text-xs text-muted-foreground">New rank name</p>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sergeant" className="h-8" />
          </div>
          <div className="w-24 space-y-1">
            <p className="text-xs text-muted-foreground">Level</p>
            <Input type="number" value={level} onChange={(e) => setLevel(e.target.value)} className="h-8" />
          </div>
          <Button size="sm" disabled={pending || name.trim().length < 2} onClick={() => { run(() => addRank(departmentId, name, Number(level)), "Rank added"); setName(""); }}>
            <Plus className="size-3.5" /> Add
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
