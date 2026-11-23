/**
 * Pass-through layout for park subdomains. It exists so that
 * src/app/sites/not-found.tsx becomes the "not found" boundary for every park
 * route, showing S13 instead of the generic 404.
 */
export default function SitesLayout({ children }: LayoutProps<"/sites">) {
  return children;
}
