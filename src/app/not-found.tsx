import type { Metadata } from "next";
import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { StatusScreen } from "./_components/status-screen";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false },
};

/**
 * Any address that doesn't match a page (a mistyped link, or a screen that
 * isn't built yet). An unknown park address (/parks/{slug}) lists the parks
 * instead (src/app/parks/[slug]/page.tsx).
 */
export default function NotFound() {
  return (
    <StatusScreen
      icon={<FileQuestion />}
      title="This page isn't here"
      actions={
        <Link href="/" className={buttonVariants({ size: "lg", block: true })}>
          Go to the start
        </Link>
      }
    >
      <p>
        The link may be mistyped or out of date. Start again from the home page.
      </p>
    </StatusScreen>
  );
}
