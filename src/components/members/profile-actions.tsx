"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { startDm } from "@/server/actions/messages";
import { updateBio } from "@/server/actions/profile";
import type { Profile } from "@/lib/types/database";

export function ProfileActions({ profile, isMe }: { profile: Profile; isMe: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [bio, setBio] = useState(profile.bio ?? "");

  if (isMe) {
    return (
      <>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}><Pencil className="size-3.5" /> Edit bio</Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Edit your bio</DialogTitle></DialogHeader>
            <Textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={300} placeholder="A sentence or two about you…" />
            <p className="text-right text-[11px] text-muted-foreground">{bio.length}/300</p>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button disabled={pending} onClick={() => start(async () => { const r = await updateBio(bio); if (r.ok) { toast.success("Bio saved"); setOpen(false); router.refresh(); } else toast.error(r.error); })}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <Button size="sm" disabled={pending} onClick={() => start(async () => { const r = await startDm(profile.id); r.ok ? router.push(`/messages/${r.data}`) : toast.error(r.error); })}>
      <MessageSquare className="size-3.5" /> Message
    </Button>
  );
}
