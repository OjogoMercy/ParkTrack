"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Signs out on every subdomain (POST /api/auth/signout), then reloads. */
export function SignOutButton({ label = "Sign out" }: { label?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/auth/signout", { method: "POST" }).catch(() => {});
        window.location.reload();
      }}
    >
      {busy ? "Signing out…" : label}
    </Button>
  );
}
