import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="font-mono text-6xl font-bold text-muted-foreground/40">404</p>
      <h1 className="text-xl font-semibold">That page doesn&apos;t exist</h1>
      <p className="max-w-sm text-sm text-muted-foreground">It may have been deleted, or you might not have permission to see it.</p>
      <Button asChild><Link href="/dashboard">Back to dashboard</Link></Button>
    </main>
  );
}
