import type { Metadata } from "next";
import { ParkNotFound } from "@/features/identity/park-not-found";

// A well-formed park subdomain with no live park behind it (S13).
export const metadata: Metadata = {
  title: "Park not found · ParkTrack",
  robots: { index: false },
};

export default function SitesNotFound() {
  return <ParkNotFound />;
}
