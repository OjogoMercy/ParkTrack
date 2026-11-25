/** Journey time as the designs write it: 90 → "1h 30m", 540 → "9h", 45 → "45m". */
export function formatJourney(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** "Ibadan · Iwo Road Park" (city first, as S01 and S03 list destinations). */
export function destinationLabel(park: { city: string; name: string }): string {
  return park.name.toLowerCase().startsWith(park.city.toLowerCase())
    ? park.name
    : `${park.city} · ${park.name}`;
}
