"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** "Print or save as PDF" for the receipt (the browser's own dialog). */
export function PrintButton() {
  return (
    <Button
      variant="secondary"
      size="lg"
      block
      onClick={() => window.print()}
      className="print:hidden"
    >
      <Printer className="size-4" aria-hidden />
      Print or save as PDF
    </Button>
  );
}
