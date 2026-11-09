"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/** Catches unexpected errors so the user sees something friendlier than a blank page. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="max-w-md text-sm text-muted-foreground">{error.message || "An unexpected error occurred."}</p>
      {error.digest && <p className="font-mono text-[11px] text-muted-foreground">Error id: {error.digest}</p>}
      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" onClick={() => (window.location.href = "/dashboard")}>Go to dashboard</Button>
      </div>
    </main>
  );
}
