// Placeholder home for the root domain. Park pages live under
// src/app/sites/[park] (Scope 05) and staff consoles under src/app/console.
export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-3 px-6">
      <p className="text-sm font-medium text-neutral-500">ParkTrack</p>
      <h1 className="text-xl font-semibold tracking-tight">
        Tracked, paid and fair waybills between motor parks.
      </h1>
      <p className="text-[15px] leading-[22px] text-neutral-600">
        Book from your park&apos;s own page, drop off in seconds, and collect
        with a one-time code. Every naira goes through Interswitch.
      </p>
    </main>
  );
}
