"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import { Card } from "@/components/ui/surface";
import { ParkInitials } from "./logo";

export type ParkListItem = {
  slug: string;
  displayName: string;
  city: string;
  hostLabel: string;
  url: string;
};

/** S13 park list with "Search parks by city". */
export function ParkSearchList({ parks }: { parks: ParkListItem[] }) {
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return parks;
    return parks.filter(
      (p) =>
        p.city.toLowerCase().includes(q) ||
        p.displayName.toLowerCase().includes(q) ||
        p.slug.includes(q),
    );
  }, [parks, query]);

  return (
    <div className="flex flex-col gap-4">
      <label className="flex h-11 w-full items-center gap-2 rounded-control border border-line-strong bg-panel px-3 shadow-1 focus-within:border-fg focus-within:shadow-focus">
        <Search className="size-[17px] text-fg-3" aria-hidden />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search parks by city"
          aria-label="Search parks"
          className="h-full min-w-0 flex-1 border-none bg-transparent text-[15px] outline-none placeholder:text-fg-3"
        />
      </label>
      {shown.length > 0 ? (
        <Card>
          <ul className="flex flex-col">
            {shown.map((p) => (
              <li
                key={p.slug}
                className="border-t border-line first:border-t-0"
              >
                <a
                  href={p.url}
                  className="flex items-center gap-3 px-4 py-3 no-underline hover:bg-bg"
                >
                  <ParkInitials name={p.slug} />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sub font-medium">
                      {p.displayName}
                    </span>
                    <span className="truncate text-small text-fg-3">
                      {p.hostLabel}
                    </span>
                  </span>
                  <ChevronRight
                    className="size-[18px] text-fg-disabled"
                    aria-hidden
                  />
                </a>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <p className="px-1 text-small text-fg-3">
          No park matches “{query}” yet.
        </p>
      )}
    </div>
  );
}
