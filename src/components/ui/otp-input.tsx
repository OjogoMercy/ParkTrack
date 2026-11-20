"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Six-box code input (sign-in OTP, collection code, roadside handover code).
 * One real <input> underneath, so paste, SMS autofill (autocomplete
 * "one-time-code") and screen readers all work; the boxes are visual only.
 */
export function OtpInput({
  value,
  onChange,
  length = 6,
  autoFocus,
  disabled,
  invalid,
  className,
  "aria-label": ariaLabel = "One-time code",
}: {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  autoFocus?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const digits = value.replace(/\D/g, "").slice(0, length);
  const active = Math.min(digits.length, length - 1);

  return (
    <div
      className={cn("relative", className)}
      onClick={() => inputRef.current?.focus()}
    >
      <input
        ref={inputRef}
        value={digits}
        onChange={(e) =>
          onChange(e.target.value.replace(/\D/g, "").slice(0, length))
        }
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={length}
        autoFocus={autoFocus}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        className="absolute inset-0 h-full w-full cursor-text opacity-0"
      />
      <div
        aria-hidden
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` }}
      >
        {Array.from({ length }, (_, i) => (
          <div
            key={i}
            className={cn(
              "grid h-14 place-items-center rounded-control border border-line-strong bg-panel font-mono text-[22px] font-medium shadow-1",
              focused && i === active && "border-fg shadow-focus",
              invalid && "border-red-fg",
              disabled && "bg-sunken text-fg-3",
            )}
          >
            {digits[i] ?? ""}
          </div>
        ))}
      </div>
    </div>
  );
}
