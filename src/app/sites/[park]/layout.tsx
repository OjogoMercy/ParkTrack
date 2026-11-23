import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getPark } from "@/server/parks";

/**
 * Every page on a park subdomain ({slug}.parktrack.ng → /sites/{slug}/…).
 *
 * The page renders straight away; the park check runs beside it in its own
 * <Suspense> (route params are request-time data under Cache Components, and
 * gating {children} on them would block instant navigation). An unknown or
 * non-live park calls notFound(), which src/app/sites/not-found.tsx turns
 * into "park not found" (S13).
 *
 * The park header (S01 top bar) is not rendered here: each page passes
 * <ParkHeader park={…} /> from @/features/identity/park-header as
 * <MobileShell topBar>, because the shell owns the sticky top bar and pages
 * need to swap the trailing "Sign in" for their own controls.
 */
export default function ParkLayout({
  children,
  params,
}: LayoutProps<"/sites/[park]">) {
  return (
    <>
      <Suspense fallback={null}>
        <ParkExists params={params} />
      </Suspense>
      {children}
    </>
  );
}

async function ParkExists({ params }: { params: Promise<{ park: string }> }) {
  const { park } = await params;
  if (!(await getPark(park))) notFound();
  return null;
}
