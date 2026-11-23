import { Suspense } from "react";
import { getPark } from "@/server/parks";

/**
 * PLACEHOLDER park home, so routing can be checked before Scope 05 builds
 * the real one (S01). Scope 05 replaces this file.
 *
 * Pattern for park pages under Cache Components: the page itself renders
 * synchronously and reads `params` inside its own <Suspense>, so navigation
 * stays instant. Park data comes from the cached getPark().
 */
export default function ParkHomePlaceholder({
  params,
}: PageProps<"/sites/[park]">) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[430px] flex-col gap-2 p-5">
      <Suspense fallback={<p className="text-small text-fg-3">Loading…</p>}>
        <ParkSummary params={params} />
      </Suspense>
    </main>
  );
}

async function ParkSummary({ params }: { params: Promise<{ park: string }> }) {
  const { park } = await params;
  const data = await getPark(park);
  return (
    <>
      <p className="text-caption text-fg-3">{park}.parktrack.ng</p>
      <h1 className="text-title">{data?.name}</h1>
      <p className="text-small text-fg-3">
        {data?.routes.length} route{data?.routes.length === 1 ? "" : "s"} from
        this park. The park home (S01) arrives in Scope 05.
      </p>
    </>
  );
}
