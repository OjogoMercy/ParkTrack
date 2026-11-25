"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { Quote } from "@/contracts/dto";
import { SIZE_LABELS, type SizeClass } from "@/contracts/enums";
import { buttonVariants } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/choice";
import { Field, Select } from "@/components/ui/field";
import { Card, Divider } from "@/components/ui/surface";
import { formatNaira } from "@/lib/money";

const SIZES: SizeClass[] = ["S", "M", "L"];

/**
 * S01 quick quote: destination + size → estimated total. Every total is
 * worked out on the server (quote(), the same as booking), so switching
 * is instant and the number matches what S03/S04 will charge.
 */
export function QuickQuote({
  routes,
  estimates,
}: {
  routes: { id: string; label: string }[];
  estimates: Record<string, Record<SizeClass, Quote>>;
}) {
  const [routeId, setRouteId] = useState(routes[0].id);
  const [size, setSize] = useState<SizeClass>("M");
  const q = estimates[routeId]?.[size];

  return (
    <Card
      className="flex flex-col gap-3.5 p-4"
      role="region"
      aria-label="Quick quote"
    >
      <Field label="Sending to">
        {(ids) => (
          <Select
            {...ids}
            value={routeId}
            onChange={(e) => setRouteId(e.target.value)}
          >
            {routes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <div className="flex flex-col gap-1.5">
        <span className="text-small font-medium text-fg-2">Parcel size</span>
        <SegmentedControl
          aria-label="Parcel size"
          options={SIZES.map((s) => ({ value: s, label: SIZE_LABELS[s].name }))}
          value={size}
          onChange={setSize}
        />
      </div>
      <Divider />
      {q ? (
        <div
          className="flex items-end justify-between gap-4"
          aria-live="polite"
        >
          <div className="flex flex-col">
            <span className="text-caption text-fg-3">Estimated total</span>
            <span className="text-[22px] leading-7 font-semibold tracking-[-0.02em] num">
              {formatNaira(q.totalKobo)}
            </span>
          </div>
          <span className="text-right text-caption text-fg-3">
            {formatNaira(q.fareKobo)} fare
            <br />+ {formatNaira(q.platformFeeKobo)} service fee
          </span>
        </div>
      ) : null}
      <Link
        href={`/send?route=${encodeURIComponent(routeId)}&size=${size}`}
        className={buttonVariants({ block: true })}
      >
        Book this parcel
        <ArrowRight className="size-4" aria-hidden />
      </Link>
    </Card>
  );
}
