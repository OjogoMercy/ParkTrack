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

/**
 * An address on the main domain: everything is served there, the staff
 * console under /console (decision Q45).
 */
export function siteUrl(rootDomain: string, path = "/"): string {
  return `${scheme(rootDomain)}://${rootDomain}${path}`;
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
  parcelCode,
  recipientToken,
}: {
  rootDomain: string;
  parcelCode: string;
  recipientToken: string | null;
}): MessageLinks {
  return {
    sender: siteUrl(rootDomain, `/parcels/${parcelCode}`),
    booking: siteUrl(rootDomain, `/parcels/booked/${parcelCode}`),
    recipient: recipientToken
      ? siteUrl(rootDomain, `/t/${recipientToken}`)
      : null,
    driver: siteUrl(rootDomain, "/console/driver"),
    originCounter: siteUrl(rootDomain, "/console/counter"),
    arrivals: siteUrl(rootDomain, "/console/arrivals"),
    parkAdmin: siteUrl(rootDomain, "/console/park"),
  };
}
