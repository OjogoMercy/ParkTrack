"use client";

import { useEffect, useId, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Bottom sheet (Foundations: 16px top corners, handle, scrim), e.g. "Mark as
 * missed?". Built on the native <dialog> element: focus trapping, Escape to
 * close and the inert background come from the browser.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={() => onOpenChange(false)}
      onClick={(e) => {
        // Clicking the scrim (the dialog box itself, outside the panel) closes it.
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
      aria-labelledby={titleId}
      className={cn(
        "m-0 mt-auto w-full max-w-none bg-transparent p-0 backdrop:bg-[rgba(9,9,11,0.42)] sm:mx-auto sm:max-w-[430px]",
        className,
      )}
    >
      <div className="flex flex-col gap-4 rounded-t-sheet bg-panel px-4 pt-2 pb-5 shadow-2">
        <span
          aria-hidden
          className="h-1 w-9 self-center rounded-full bg-line-strong"
        />
        <div className="flex flex-col gap-1">
          <h2 id={titleId} className="text-heading">
            {title}
          </h2>
          {description ? (
            <p className="text-sub text-fg-2">{description}</p>
          ) : null}
        </div>
        {children}
      </div>
    </dialog>
  );
}
