import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Forms (Foundations): 44px controls, labels above, hints below.
 * `Field` wires label, hint and error to the control through ids.
 */

const controlBase =
  "flex h-11 w-full items-center gap-2 rounded-control border border-line-strong bg-panel px-3 text-[15px] text-fg shadow-1 outline-none placeholder:text-fg-3 focus-within:border-fg focus-within:shadow-focus aria-invalid:border-red-fg disabled:bg-sunken disabled:text-fg-3";

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  className?: string;
  children: (ids: {
    id: string;
    "aria-describedby"?: string;
    "aria-invalid"?: true;
  }) => React.ReactNode;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? (
        <label htmlFor={id} className="text-small font-medium text-fg-2">
          {label}
        </label>
      ) : null}
      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
      })}
      {error ? (
        <p id={errorId} className="text-caption font-normal text-red-fg">
          {error}
        </p>
      ) : null}
      {hint ? (
        <p id={hintId} className="text-caption font-normal text-fg-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      className={cn(controlBase, className)}
      {...props}
    />
  );
}

/** Input with a fixed prefix such as "+234" or "₦". */
export function PrefixInput({
  prefix,
  className,
  ...props
}: React.ComponentProps<"input"> & { prefix: React.ReactNode }) {
  return (
    <div
      className={cn(controlBase, "has-[input:disabled]:bg-sunken", className)}
      aria-invalid={props["aria-invalid"]}
    >
      <span className="flex h-6 items-center border-r border-line pr-2.5 text-fg-3 num">
        {prefix}
      </span>
      <input
        className="h-full min-w-0 flex-1 border-none bg-transparent p-0 text-inherit outline-none placeholder:text-fg-3"
        {...props}
      />
    </div>
  );
}

/** Nigerian phone number: "+234" prefix, numeric keypad, national digits only. */
export function PhoneInput(
  props: Omit<React.ComponentProps<"input">, "type" | "inputMode">,
) {
  return (
    <PrefixInput
      prefix="+234"
      type="tel"
      inputMode="tel"
      autoComplete="tel-national"
      placeholder="803 555 4471"
      {...props}
    />
  );
}

/** Naira amount input. The value stays in naira here; convert to kobo on submit. */
export function MoneyInput(
  props: Omit<React.ComponentProps<"input">, "type" | "inputMode">,
) {
  return <PrefixInput prefix="₦" type="text" inputMode="numeric" {...props} />;
}

/**
 * Native select styled as a control. Native on purpose: best on low-cost
 * phones, accessible, and no JavaScript.
 */
export function Select({
  className,
  children,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <div className={cn("relative", className)}>
      <select
        data-slot="select"
        className={cn(controlBase, "cursor-pointer appearance-none pr-9")}
        {...props}
      >
        {children}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-fg-3"
      >
        <path
          d="M4 6l4 4 4-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export function Textarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(controlBase, "h-auto min-h-24 py-2.5", className)}
      {...props}
    />
  );
}
