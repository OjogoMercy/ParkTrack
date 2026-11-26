"use client";

import { Check, Share2 } from "lucide-react";
import { useState } from "react";
import { IconButton } from "@/components/ui/button";

/**
 * Shares this page's link (the recipient's tracking link) with the phone's
 * share sheet, or copies it where there isn't one.
 */
export function ShareLinkButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Closed the share sheet, or the clipboard is blocked: nothing to do.
    }
  }

  return (
    <IconButton
      aria-label={copied ? "Link copied" : "Share this link"}
      onClick={share}
    >
      {copied ? <Check aria-hidden /> : <Share2 aria-hidden />}
    </IconButton>
  );
}
