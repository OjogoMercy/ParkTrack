"use client";

import { useEffect } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { StatusScreen } from "./_components/status-screen";

/**
 * Any page that fails while rendering (database or a service unreachable,
 * an unexpected bug) lands here instead of the framework's error screen.
 * "Try again" re-fetches the failed part; the reference matches the
 * server log entry (error.digest), never the error text.
 */
export default function ErrorPage({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  const digest =
    error instanceof Error && "digest" in error
      ? String((error as Error & { digest?: string }).digest ?? "")
      : "";

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusScreen
      icon={<TriangleAlert />}
      title="Something went wrong"
      actions={
        <>
          <Button size="lg" block onClick={() => retry()}>
            <RefreshCw />
            Try again
          </Button>
          <Link
            href="/"
            className={buttonVariants({
              variant: "secondary",
              size: "lg",
              block: true,
            })}
          >
            Go to the start
          </Link>
        </>
      }
    >
      <p>
        It&apos;s not you. Check your data connection and try again; if it keeps
        happening, tell the park counter.
      </p>
      {digest ? (
        <p className="pt-2 font-mono text-caption text-fg-3">
          Reference {digest}
        </p>
      ) : null}
    </StatusScreen>
  );
}
