import type { Metadata } from "next";
import { ParkNotFound } from "@/features/identity/park-not-found";

// Reached through src/proxy.ts for unknown or reserved subdomains (S13).
export const metadata: Metadata = {
  title: "Park not found · ParkTrack",
  robots: { index: false },
};

export default function NotFoundParkPage() {
  return <ParkNotFound />;
}
