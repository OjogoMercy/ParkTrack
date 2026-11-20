import { cn } from "@/lib/utils";

/**
 * Admin tables (Foundations): 13px body, grey 12px headers, row dividers,
 * right-aligned tabular numbers (`numeric`), selected row tint.
 * Wrap in <TableWrap> so wide tables scroll sideways on small screens.
 */

export function TableWrap({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div className={cn("overflow-x-auto", className)} {...props} />;
}

export function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <table
      className={cn("w-full border-collapse text-[13px]", className)}
      {...props}
    />
  );
}

export function Th({
  className,
  numeric,
  ...props
}: React.ComponentProps<"th"> & { numeric?: boolean }) {
  return (
    <th
      scope="col"
      className={cn(
        "border-b border-line bg-panel px-4 py-2.5 text-left text-[12px] font-medium whitespace-nowrap text-fg-3",
        numeric && "text-right",
        className,
      )}
      {...props}
    />
  );
}

export function Tr({
  className,
  selected,
  ...props
}: React.ComponentProps<"tr"> & { selected?: boolean }) {
  return (
    <tr
      aria-selected={selected || undefined}
      className={cn(
        "[&:last-child>td]:border-b-0",
        selected && "[&>td]:bg-[#f7f7f8]",
        className,
      )}
      {...props}
    />
  );
}

export function Td({
  className,
  numeric,
  ...props
}: React.ComponentProps<"td"> & { numeric?: boolean }) {
  return (
    <td
      className={cn(
        "border-b border-line px-4 py-3 align-middle whitespace-nowrap",
        numeric && "text-right num",
        className,
      )}
      {...props}
    />
  );
}
