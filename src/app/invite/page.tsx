import { Suspense } from "react";
import InvitePage from "./invite-content";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-full items-center justify-center bg-[var(--bg)] text-[var(--text-muted)]">
          Loading...
        </div>
      }
    >
      <InvitePage />
    </Suspense>
  );
}
