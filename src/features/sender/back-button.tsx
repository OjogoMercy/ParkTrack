"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { IconButton } from "@/components/ui/button";

/**
 * Back that keeps what the sender typed: history back when there is a page to go
 * back to, otherwise `fallback` (S04 opened in a fresh tab).
 */
export function BackButton({ fallback }: { fallback: string }) {
  const router = useRouter();
  return (
    <IconButton
      aria-label="Back"
      className="-ml-2"
      onClick={() => {
        // Opened in a fresh tab (e.g. a link in a message): nothing to go
        // back to, so go to the fallback instead of leaving the site.
        if (window.history.length > 1) router.back();
        else router.push(fallback);
      }}
    >
      <ChevronLeft className="size-5" />
    </IconButton>
  );
}
