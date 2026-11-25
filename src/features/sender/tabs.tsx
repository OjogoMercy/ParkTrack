import { Package, User, Users } from "lucide-react";
import type { NavItem } from "@/components/ui/nav";

/** Bottom tabs on the sender's signed-in screens (S08, S12). */
export const SENDER_TABS: NavItem[] = [
  { href: "/parcels", label: "Parcels", icon: <Package aria-hidden /> },
  {
    href: "/account#recipients",
    label: "Recipients",
    icon: <Users aria-hidden />,
  },
  {
    href: "/account",
    label: "Account",
    icon: <User aria-hidden />,
    exact: true,
  },
];
