import { cn } from "@/lib/utils";

/**
 * Parcel timeline (Foundations): done steps are ink with an ink line, the
 * current step has a Volt node, upcoming steps are grey.
 */
export type TimelineState = "done" | "now" | "todo";

export type TimelineItem = {
  title: React.ReactNode;
  sub?: React.ReactNode;
  meta?: React.ReactNode;
  state: TimelineState;
};

export function Timeline({
  items,
  className,
}: {
  items: TimelineItem[];
  className?: string;
}) {
  return (
    <ol className={cn("flex flex-col", className)}>
      {items.map((item, i) => {
        const last = i === items.length - 1;
        return (
          <li
            key={i}
            aria-current={item.state === "now" ? "step" : undefined}
            className={cn(
              "relative grid grid-cols-[20px_minmax(0,1fr)_auto] gap-x-3",
              !last && "pb-4",
            )}
          >
            {!last ? (
              <span
                aria-hidden
                className={cn(
                  "absolute top-5 bottom-0 left-[9px] w-0.5",
                  item.state === "done" ? "bg-fg" : "bg-line",
                )}
              />
            ) : null}
            <span
              aria-hidden
              className={cn(
                "z-[1] grid size-5 place-items-center rounded-full border-2 border-line-strong bg-panel text-white",
                item.state === "done" && "border-fg bg-fg",
                item.state === "now" && "border-fg bg-volt",
              )}
            >
              {item.state === "done" ? (
                <svg viewBox="0 0 16 16" className="size-3">
                  <path
                    d="M3.5 8.5l3 3 6-7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : null}
            </span>
            <div className="flex min-w-0 flex-col">
              <span
                className={cn(
                  "text-sub font-medium",
                  item.state === "todo" && "font-normal text-fg-3",
                )}
              >
                {item.title}
              </span>
              {item.sub ? (
                <span className="text-small text-fg-3">{item.sub}</span>
              ) : null}
            </div>
            {item.meta ? (
              <span className="text-[12px] leading-5 text-fg-3 num">
                {item.meta}
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
