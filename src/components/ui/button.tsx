import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Buttons (Foundations): primary is ink, Volt is reserved for the scanner and
 * brand moments, 44px tall by default. Use `buttonVariants` to style a <Link>.
 */
export const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-control border border-transparent font-medium tracking-[-0.01em] whitespace-nowrap no-underline transition-colors outline-none select-none focus-visible:shadow-focus focus-visible:ring-2 focus-visible:ring-fg disabled:cursor-default disabled:border-transparent disabled:bg-sunken disabled:text-fg-disabled disabled:shadow-none aria-disabled:pointer-events-none aria-disabled:bg-sunken aria-disabled:text-fg-disabled [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary: "bg-fg text-white hover:bg-[#27272a]",
        secondary:
          "border-line-strong bg-panel text-fg shadow-1 hover:bg-sunken",
        ghost: "bg-transparent text-fg hover:bg-sunken",
        volt: "bg-volt text-volt-ink hover:bg-volt-hover",
        danger: "border-line-strong bg-panel text-red-fg hover:bg-red-bg",
      },
      size: {
        sm: "h-8 px-3 text-[13px]",
        md: "h-11 px-4 text-[15px]",
        lg: "h-13 px-4 text-[16px]",
        icon: "size-9 border-transparent",
      },
      block: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "primary", size: "md", block: false },
  },
);

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants>;

export function Button({
  className,
  variant,
  size,
  block,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      data-slot="button"
      className={cn(buttonVariants({ variant, size, block }), className)}
      {...props}
    />
  );
}

/** Square icon button (36px). Pass an aria-label. */
export function IconButton({
  className,
  bordered,
  ...props
}: React.ComponentProps<"button"> & { bordered?: boolean }) {
  return (
    <Button
      variant={bordered ? "secondary" : "ghost"}
      size="icon"
      className={cn(bordered && "border-line-strong", className)}
      {...props}
    />
  );
}
