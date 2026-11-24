import { MobileShell, TopBar } from "@/components/ui/shells";
import { Tile } from "@/components/ui/surface";
import { ParkTrackLogo } from "@/features/identity/logo";

/**
 * Full-page message for states nobody planned a screen for: page not found,
 * something broke. Same layout as S13 (logo bar, icon tile, heading, text,
 * actions). Server- and client-safe (no hooks).
 */
export function StatusScreen({
  icon,
  title,
  children,
  actions,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <MobileShell
      topBar={<TopBar leading={<ParkTrackLogo />} />}
      className="gap-6 px-5 py-8"
    >
      <div className="flex flex-col gap-2">
        <Tile className="size-11 [&_svg]:size-5">{icon}</Tile>
        <h1 className="pt-2 text-title">{title}</h1>
        <div className="text-sub text-fg-2">{children}</div>
      </div>
      {actions ? <div className="flex flex-col gap-2.5">{actions}</div> : null}
    </MobileShell>
  );
}
