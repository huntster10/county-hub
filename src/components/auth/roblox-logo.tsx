/** Simple tilted-square mark used on the Roblox button (not the official logo). */
export function RobloxLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect x="5" y="5" width="14" height="14" rx="2" transform="rotate(-12 12 12)" stroke="currentColor" strokeWidth="2" />
      <rect x="10" y="10" width="4" height="4" transform="rotate(-12 12 12)" fill="currentColor" />
    </svg>
  );
}
