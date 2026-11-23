/**
 * app.parktrack.ng home. PLACEHOLDER until Scope 02 sl5, which signs staff
 * in and sends each role to its own console (counter, arrivals, driver,
 * park, platform).
 */
export default function ConsoleHome() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[430px] flex-col gap-2 p-5">
      <p className="text-caption text-fg-3">app.parktrack.ng</p>
      <h1 className="text-title">ParkTrack console</h1>
      <p className="text-small text-fg-3">
        Staff sign-in arrives in Scope 02 sl5.
      </p>
    </main>
  );
}
