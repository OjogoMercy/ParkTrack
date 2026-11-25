"use client";

import { Share2 } from "lucide-react";
import { useState } from "react";
import { IconButton } from "@/components/ui/button";

/**
 * S07 share: the parcel code and drop-off deadline as text (e.g. to send
 * to someone dropping it off for you). Never the QR or its ID: the QR is
 * what checks the parcel in.
 */
export function ShareBooking({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <IconButton
      aria-label={copied ? "Copied" : "Share booking details"}
      onClick={async () => {
        try {
          if (navigator.share) {
            await navigator.share({ title: "ParkTrack booking", text });
            return;
          }
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Share sheet closed, or no clipboard: nothing to do.
        }
      }}
    >
      <Share2 className="size-5" />
    </IconButton>
  );
}
