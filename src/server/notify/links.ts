/**
 * Absolute URLs for messages. Local roots (localhost, *.localhost, with or
 * without a port) use http; everything else https.
 */
function scheme(rootDomain: string): "http" | "https" {
  const host = rootDomain.replace(/:\d+$/, "");
  return host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".localhost")
    ? "http"
    : "https";
}

export function siteUrl(
  rootDomain: string,
  subdomain: string | null,
  path = "/",
): string {
  const host = subdomain ? `${subdomain}.${rootDomain}` : rootDomain;
  return `${scheme(rootDomain)}://${host}${path}`;
}

export type MessageLinks = {
  sender: string;
  booking: string;
  recipient: string | null;
  driver: string;
  originCounter: string;
  arrivals: string;
  parkAdmin: string;
};

export function messageLinks({
  rootDomain,
  originSlug,
  parcelCode,
  recipientToken,
}: {
  rootDomain: string;
  originSlug: string;
  parcelCode: string;
  recipientToken: string | null;
}): MessageLinks {
  return {
    sender: siteUrl(rootDomain, originSlug, `/parcels/${parcelCode}`),
    booking: siteUrl(rootDomain, originSlug, `/parcels/booked/${parcelCode}`),
    recipient: recipientToken
      ? siteUrl(rootDomain, null, `/t/${recipientToken}`)
      : null,
    driver: siteUrl(rootDomain, "app", "/driver"),
    originCounter: siteUrl(rootDomain, "app", "/counter"),
    arrivals: siteUrl(rootDomain, "app", "/arrivals"),
    parkAdmin: siteUrl(rootDomain, "app", "/park"),
  };
}
