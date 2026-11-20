"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Single-choice controls (Foundations): SegmentedControl ("Collect at park /
 * Roadside drop"), ChipGroup (saved recipients), ChoiceCards (parcel size).
 * All are radio groups: one tab stop, arrow keys move the selection.
 */

export type Option<T extends string> = {
  value: T;
  label: React.ReactNode;
  description?: React.ReactNode;
  aside?: React.ReactNode;
  disabled?: boolean;
};

function useRovingKeys<T extends string>(
  options: Option<T>[],
  value: T,
  onChange: (v: T) => void,
) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const enabled = options.filter((o) => !o.disabled);
  const onKeyDown = (e: React.KeyboardEvent) => {
    const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
    const i = enabled.findIndex((o) => o.value === value);
    const next = enabled[(i + step + enabled.length) % enabled.length];
    onChange(next.value);
    refs.current[options.indexOf(next)]?.focus();
  };
  return { refs, onKeyDown };
}

type GroupProps<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  "aria-label": string;
  className?: string;
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  ...aria
}: GroupProps<T>) {
  const { refs, onKeyDown } = useRovingKeys(options, value, onChange);
  return (
    <div
      role="radiogroup"
      {...aria}
      onKeyDown={onKeyDown}
      className={cn(
        "grid auto-cols-fr grid-flow-col gap-0.5 rounded-control bg-sunken p-[3px]",
        className,
      )}
    >
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex h-[34px] cursor-pointer items-center justify-center gap-1.5 rounded-badge text-sub font-medium text-fg-2 outline-none focus-visible:ring-2 focus-visible:ring-fg disabled:cursor-default disabled:opacity-50",
              on && "bg-panel text-fg shadow-seg",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  className,
  ...aria
}: GroupProps<T>) {
  const { refs, onKeyDown } = useRovingKeys(options, value, onChange);
  return (
    <div
      role="radiogroup"
      {...aria}
      onKeyDown={onKeyDown}
      className={cn("flex flex-wrap gap-2", className)}
    >
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cn(chipClass, on && chipOnClass)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const chipClass =
  "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-control border border-line-strong bg-panel px-3 text-[13px] font-medium whitespace-nowrap text-fg outline-none focus-visible:ring-2 focus-visible:ring-fg disabled:cursor-default disabled:opacity-50";
const chipOnClass = "border-fg bg-fg text-white";

/** A standalone toggle chip (for filters). */
export function Chip({
  pressed,
  className,
  ...props
}: React.ComponentProps<"button"> & { pressed?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cn(chipClass, pressed && chipOnClass, className)}
      {...props}
    />
  );
}

/** Large selectable cards, e.g. parcel size "Medium · Travel bag size · ₦2,500". */
export function ChoiceCards<T extends string>({
  options,
  value,
  onChange,
  className,
  ...aria
}: GroupProps<T>) {
  const { refs, onKeyDown } = useRovingKeys(options, value, onChange);
  return (
    <div
      role="radiogroup"
      {...aria}
      onKeyDown={onKeyDown}
      className={cn("grid auto-cols-fr grid-flow-col gap-2", className)}
    >
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex cursor-pointer flex-col items-start gap-0.5 rounded-control border border-line-strong bg-panel p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-fg disabled:cursor-default disabled:opacity-50",
              on && "border-fg shadow-[0_0_0_1px_var(--pt-fg)]",
            )}
          >
            <span className="text-sub font-medium">{o.label}</span>
            {o.description ? (
              <span className="text-caption font-normal text-fg-3">
                {o.description}
              </span>
            ) : null}
            {o.aside ? (
              <span className="mt-1 text-sub font-medium num">{o.aside}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** On/off switch (40×24). */
export function Switch({
  checked,
  onCheckedChange,
  className,
  ...props
}: Omit<React.ComponentProps<"button">, "onChange"> & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative h-6 w-10 shrink-0 cursor-pointer rounded-full border-none bg-line-strong p-0 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-fg focus-visible:ring-offset-2 disabled:cursor-default disabled:opacity-50",
        checked && "bg-fg",
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          "absolute top-[3px] left-[3px] size-[18px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-[left]",
          checked && "left-[19px]",
        )}
      />
    </button>
  );
}

/** Checkbox (22px, ink when checked), e.g. "Written clearly with a marker". */
export function Checkbox({
  label,
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "type"> & { label: React.ReactNode }) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-3 text-sub font-medium",
        className,
      )}
    >
      <span className="relative size-[22px] shrink-0">
        <input
          type="checkbox"
          className="peer absolute inset-0 m-0 cursor-pointer appearance-none rounded-badge border-[1.5px] border-line-strong bg-panel outline-none checked:border-fg checked:bg-fg focus-visible:ring-2 focus-visible:ring-fg focus-visible:ring-offset-2"
          {...props}
        />
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          className="pointer-events-none absolute inset-0 p-[3px] text-white opacity-0 peer-checked:opacity-100"
        >
          <path
            d="M3.5 8.5l3 3 6-7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span>{label}</span>
    </label>
  );
}
