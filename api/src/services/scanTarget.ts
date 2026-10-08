import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import ipaddr from "ipaddr.js";

export class UnsafeScanTargetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeScanTargetError";
  }
}

export type HostResolver = (
  hostname: string,
) => Promise<{ address: string; family: number }[]>;
export type AllowedScanHosts = string[];

const resolveHost: HostResolver = (hostname) =>
  lookup(hostname, { all: true, verbatim: true });

function isPublicAddress(address: string) {
  try {
    return ipaddr.process(address).range() === "unicast";
  } catch {
    return false;
  }
}

export async function normalizeAndValidateScanUrl(
  input: string,
  resolver: HostResolver = resolveHost,
  configuredHosts: AllowedScanHosts = (process.env.SCAN_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase().replace(/^\[|\]$/g, ""))
    .filter(Boolean),
) {
  if (input.length > 2048) {
    throw new UnsafeScanTargetError("The target URL is too long.");
  }

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new UnsafeScanTargetError("Enter a valid HTTP or HTTPS URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeScanTargetError("Only HTTP and HTTPS URLs can be scanned.");
  }
  if (url.username || url.password) {
    throw new UnsafeScanTargetError("URLs containing credentials cannot be scanned.");
  }
  if (url.port && url.port !== (url.protocol === "https:" ? "443" : "80")) {
    throw new UnsafeScanTargetError("Only the standard HTTP and HTTPS ports can be scanned.");
  }

  const hostname = url.hostname
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "")
    .toLowerCase();
  if (!configuredHosts.length) {
    throw new UnsafeScanTargetError("Scanning is disabled until SCAN_ALLOWED_HOSTS is configured.");
  }
  const allowed = configuredHosts.some((allowedHost) =>
    hostname === allowedHost || hostname.endsWith(`.${allowedHost}`),
  );
  if (!allowed) {
    throw new UnsafeScanTargetError("This host is not on the configured scan allowlist.");
  }
  if (
    !hostname ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".test") ||
    hostname.endsWith(".invalid")
  ) {
    throw new UnsafeScanTargetError("Local and reserved hostnames cannot be scanned.");
  }

  const ipVersion = isIP(hostname);
  if (ipVersion) {
    if (!isPublicAddress(hostname)) {
      throw new UnsafeScanTargetError("Private or reserved IP addresses cannot be scanned.");
    }
  } else {
    if (!hostname.includes(".")) {
      throw new UnsafeScanTargetError("Local hostnames cannot be scanned.");
    }
    let addresses: { address: string; family: number }[];
    try {
      addresses = await resolver(hostname);
    } catch {
      throw new UnsafeScanTargetError("The target host could not be safely verified.");
    }
    if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
      throw new UnsafeScanTargetError("The target host resolves to a private or reserved address.");
    }
  }

  url.hash = "";
  return url.toString();
}