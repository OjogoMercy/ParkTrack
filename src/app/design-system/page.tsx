import type { Metadata } from "next";
import { ComponentsSection } from "./components-section";

// Living reference for the ParkTrack UI v2 foundations. Compare with
// docs/design/ParkTrack UI Foundations.html. Scope 01 owns this page.
export const metadata: Metadata = {
  title: "Design system · ParkTrack",
  robots: { index: false },
};

const surfaces = [
  ["Ink", "fg", "#09090B"],
  ["Ink 2", "fg-2", "#52525B"],
  ["Ink 3", "fg-3", "#6B6B74"],
  ["Volt · brand", "volt", "#D4F86A"],
  ["Background", "bg", "#FAFAFA"],
  ["Panel", "panel", "#FFFFFF"],
  ["Sunken", "sunken", "#F4F4F5"],
  ["Line", "line", "#E8E8EB"],
  ["Line strong", "line-strong", "#D4D4D8"],
] as const;

const swatchClass: Record<(typeof surfaces)[number][1], string> = {
  fg: "bg-fg",
  "fg-2": "bg-fg-2",
  "fg-3": "bg-fg-3",
  volt: "bg-volt",
  bg: "bg-bg",
  panel: "bg-panel",
  sunken: "bg-sunken",
  line: "bg-line",
  "line-strong": "bg-line-strong",
};

const statusColours = [
  ["Blue · moving", "bg-blue-bg text-blue-fg", "bg-blue"],
  ["Amber · needs action", "bg-amber-bg text-amber-fg", "bg-amber"],
  ["Green · done", "bg-green-bg text-green-fg", "bg-green"],
  ["Red · problem", "bg-red-bg text-red-fg", "bg-red"],
] as const;

const typeScale = [
  ["Title", "text-title", "20 / 28 · 600 · −2%", "Send a parcel from Ogbomoso"],
  ["Heading", "text-heading", "17 / 24 · 600", "Where to"],
  [
    "Body",
    "text-body",
    "15 / 22 · 400",
    "Book and pay here, then drop it at the counter.",
  ],
  [
    "Secondary",
    "text-small text-fg-3",
    "13 / 18 · 400",
    "Drop off by Sat 22 Nov, 6:00 PM",
  ],
  [
    "Caption",
    "text-caption text-fg-3",
    "12 / 16 · 500",
    "Routes from this park",
  ],
  ["Amount", "text-amount num", "28 / 34 · 600 · tabular", "₦38,400"],
  ["Code", "text-code font-mono", "Geist Mono 15 · 600", "PT-7K3Q · 482 913"],
] as const;

const radii = [
  ["6px · badge", "rounded-badge"],
  ["8px · control", "rounded-control"],
  ["12px · card", "rounded-card"],
  ["16px · sheet", "rounded-sheet"],
] as const;

const spacing = [4, 8, 12, 16, 20, 24, 32] as const;

function Section({
  title,
  lead,
  children,
}: {
  title: string;
  lead: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 border-t border-line pt-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-heading">{title}</h2>
        <p className="text-small text-fg-3">{lead}</p>
      </div>
      {children}
    </section>
  );
}

export default function DesignSystemPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-10 sm:px-8">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-live shadow-[0_0_0_3px_rgba(101,163,13,0.2)]" />
          <span className="text-caption text-fg-3">
            ParkTrack UI v2 · foundations
          </span>
        </div>
        <h1 className="text-title">Design system</h1>
        <p className="max-w-2xl text-fg-2">
          Neutral surfaces, one brand accent, one radius family and Geist
          throughout, so a sender&apos;s booking page, a driver&apos;s phone and
          the park dashboard feel like the same product.
        </p>
      </header>

      <Section title="Colour" lead="Zinc neutrals with a single Volt accent.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {surfaces.map(([name, token, hex]) => (
            <div
              key={token}
              className="overflow-hidden rounded-card border border-line bg-panel"
            >
              <div
                className={`h-16 border-b border-line ${swatchClass[token]}`}
              />
              <div className="flex flex-col gap-0.5 p-3">
                <span className="text-sub font-medium">{name}</span>
                <span className="font-mono text-caption text-fg-3">
                  {token} · {hex}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {statusColours.map(([name, chip, solid]) => (
            <div
              key={name}
              className={`flex items-center gap-3 rounded-control p-3 ${chip}`}
            >
              <span className={`size-3 rounded-full ${solid}`} />
              <span className="text-small font-medium">{name}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Type"
        lead="Geist for everything, Geist Mono for codes. Tabular figures on all money."
      >
        <div className="flex flex-col overflow-hidden rounded-card border border-line bg-panel">
          {typeScale.map(([name, cls, spec, sample]) => (
            <div
              key={name}
              className="grid grid-cols-1 gap-1 border-t border-line p-4 first:border-t-0 sm:grid-cols-[160px_1fr] sm:items-baseline sm:gap-4"
            >
              <div className="flex flex-col">
                <span className="text-sub font-medium">{name}</span>
                <span className="text-caption text-fg-3">{spec}</span>
              </div>
              <span className={cls}>{sample}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Radius and spacing"
        lead="4px grid. Four radii, no exceptions."
      >
        <div className="flex flex-wrap gap-4">
          {radii.map(([label, cls]) => (
            <div key={cls} className="flex flex-col items-center gap-2">
              <div
                className={`size-20 border border-line-strong bg-sunken ${cls}`}
              />
              <span className="text-caption text-fg-3">{label}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-4">
          {spacing.map((px) => (
            <div key={px} className="flex flex-col items-center gap-2">
              <div
                className="rounded-badge bg-fg"
                style={{ width: px, height: px }}
              />
              <span className="text-caption text-fg-3 num">{px}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-4">
          <div className="rounded-card border border-line bg-panel p-4 text-small shadow-1">
            shadow-1 · cards, inputs
          </div>
          <div className="rounded-sheet bg-panel p-4 text-small shadow-2">
            shadow-2 · sheets, popovers
          </div>
        </div>
      </Section>

      <ComponentsSection />
    </main>
  );
}
