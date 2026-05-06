import dns from "node:dns/promises";
import net from "node:net";
import { URL } from "node:url";
import { createLogger } from "~/lib/logger";

const log = createLogger("link-validator");

const REQUEST_TIMEOUT = 5000;
const MAX_REDIRECTS = 5;
const USER_AGENT = "Mozilla/5.0 (compatible; LinkChecker/1.0)";

interface LinkValidationResult {
  error?: string;
  isValid: boolean;
  statusCode?: number;
}

/**
 * IPv4 ranges that must never be reachable from the server.
 * Includes RFC1918, loopback, link-local, CGNAT, broadcast, multicast,
 * benchmarking, documentation, and reserved blocks.
 */
const PRIVATE_IPV4_CIDRS: Array<[bigint, number]> = [
  [ipv4ToBigInt("0.0.0.0"), 8], // "this network"
  [ipv4ToBigInt("10.0.0.0"), 8], // RFC1918
  [ipv4ToBigInt("100.64.0.0"), 10], // CGNAT
  [ipv4ToBigInt("127.0.0.0"), 8], // loopback
  [ipv4ToBigInt("169.254.0.0"), 16], // link-local + AWS/GCP IMDS
  [ipv4ToBigInt("172.16.0.0"), 12], // RFC1918
  [ipv4ToBigInt("192.0.0.0"), 24], // IETF Protocol assignments
  [ipv4ToBigInt("192.0.2.0"), 24], // TEST-NET-1
  [ipv4ToBigInt("192.168.0.0"), 16], // RFC1918
  [ipv4ToBigInt("198.18.0.0"), 15], // benchmarking
  [ipv4ToBigInt("198.51.100.0"), 24], // TEST-NET-2
  [ipv4ToBigInt("203.0.113.0"), 24], // TEST-NET-3
  [ipv4ToBigInt("224.0.0.0"), 4], // multicast
  [ipv4ToBigInt("240.0.0.0"), 4], // reserved
  [ipv4ToBigInt("255.255.255.255"), 32], // broadcast
];

function ipv4ToBigInt(ip: string): bigint {
  const parts = ip.split(".").map((p) => BigInt(Number.parseInt(p, 10)));
  return (parts[0]! << 24n) | (parts[1]! << 16n) | (parts[2]! << 8n) | parts[3]!;
}

function inCidr(addr: bigint, base: bigint, prefix: number, bits: number) {
  const mask = prefix === 0 ? 0n : ((1n << BigInt(bits)) - 1n) ^ ((1n << BigInt(bits - prefix)) - 1n);
  return (addr & mask) === (base & mask);
}

function isPrivateIPv4(ip: string): boolean {
  if (net.isIPv4(ip) === false) {
    return false;
  }
  const addr = ipv4ToBigInt(ip);
  return PRIVATE_IPV4_CIDRS.some(([base, prefix]) =>
    inCidr(addr, base, prefix, 32)
  );
}

function isPrivateIPv6(ip: string): boolean {
  if (net.isIPv6(ip) === false) {
    return false;
  }
  const lower = ip.toLowerCase();

  // Loopback ::1
  if (lower === "::1") {
    return true;
  }
  // Unspecified
  if (lower === "::") {
    return true;
  }
  // Unique local fc00::/7
  if (/^f[cd][0-9a-f]{2}:/.test(lower)) {
    return true;
  }
  // Link-local fe80::/10
  if (/^fe[89ab][0-9a-f]:/.test(lower)) {
    return true;
  }
  // Multicast ff00::/8
  if (lower.startsWith("ff")) {
    return true;
  }
  // IPv4-mapped ::ffff:a.b.c.d
  const mapped = lower.match(/^::ffff:([0-9.]+)$/);
  if (mapped?.[1] && net.isIPv4(mapped[1])) {
    return isPrivateIPv4(mapped[1]);
  }
  // IPv4-mapped hex form ::ffff:xxxx:xxxx
  const hexMapped = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hexMapped) {
    const a = Number.parseInt(hexMapped[1]!, 16);
    const b = Number.parseInt(hexMapped[2]!, 16);
    const ipv4 = `${(a >> 8) & 0xff}.${a & 0xff}.${(b >> 8) & 0xff}.${b & 0xff}`;
    return isPrivateIPv4(ipv4);
  }
  return false;
}

function isPrivateIP(ip: string): boolean {
  return isPrivateIPv4(ip) || isPrivateIPv6(ip);
}

/**
 * Resolve a hostname to all of its A and AAAA records and ensure none of
 * them point at private/internal addresses.
 */
async function resolveAndCheckHost(hostname: string): Promise<{
  safe: boolean;
  reason?: string;
}> {
  // Normalize and reject obvious local names
  const lower = hostname.toLowerCase();
  if (lower === "localhost" || lower.endsWith(".localhost") || lower.endsWith(".internal")) {
    return { safe: false, reason: "blocked hostname" };
  }

  // If the hostname is itself an IP literal, validate it directly
  if (net.isIP(hostname)) {
    if (isPrivateIP(hostname)) {
      return { safe: false, reason: "private IP literal" };
    }
    return { safe: true };
  }

  const [v4, v6] = await Promise.all([
    dns.resolve4(hostname).catch(() => [] as string[]),
    dns.resolve6(hostname).catch(() => [] as string[]),
  ]);

  const all = [...v4, ...v6];
  if (all.length === 0) {
    return { safe: false, reason: "DNS resolution failed" };
  }
  if (all.some((ip) => isPrivateIP(ip))) {
    return { safe: false, reason: "resolves to private IP" };
  }
  return { safe: true };
}

function isValidUrlFormat(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Fetch a URL once, manually following redirects so we can re-validate the
 * target of every hop. This blocks redirect-based SSRF (e.g. a public URL
 * that 302s to http://169.254.169.254).
 */
async function safeFetch(
  initialUrl: string,
  method: "HEAD" | "GET"
): Promise<Response> {
  let currentUrl = initialUrl;
  let redirects = 0;

  while (true) {
    const parsed = new URL(currentUrl);
    const check = await resolveAndCheckHost(parsed.hostname);
    if (!check.safe) {
      throw new Error(`SSRF blocked (${check.reason}): ${parsed.hostname}`);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    let response: Response;
    try {
      response = await fetch(currentUrl, {
        method,
        signal: controller.signal,
        headers: { "User-Agent": USER_AGENT },
        redirect: "manual",
      });
    } finally {
      clearTimeout(timeoutId);
    }

    // 3xx with Location -> re-validate next hop
    if (
      response.status >= 300 &&
      response.status < 400 &&
      response.headers.has("location")
    ) {
      if (redirects >= MAX_REDIRECTS) {
        throw new Error("Too many redirects");
      }
      const next = new URL(response.headers.get("location")!, currentUrl).toString();
      currentUrl = next;
      redirects++;
      continue;
    }

    return response;
  }
}

/**
 * Check if a link is alive using HEAD request with fallback to GET.
 * SSRF-safe: every redirect hop is re-validated against the private IP list.
 */
export async function validateLink(url: string): Promise<LinkValidationResult> {
  log.debug(`Validating link: ${url}`);

  if (!isValidUrlFormat(url)) {
    log.warn(`Invalid URL format: ${url}`);
    return { isValid: false, error: "Invalid URL format" };
  }

  try {
    let response: Response;
    try {
      response = await safeFetch(url, "HEAD");
      if (response.status === 405 || response.status === 501) {
        log.debug(`HEAD not supported, falling back to GET: ${url}`);
        response = await safeFetch(url, "GET");
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("SSRF blocked")) {
        log.warn(error.message);
        return {
          isValid: false,
          error: "URL points to private/internal network",
        };
      }
      throw error;
    }

    if (response.ok) {
      log.info(`Link valid: ${url}`, { status: response.status });
      return { isValid: true, statusCode: response.status };
    }

    log.warn(`Link returned error: ${url}`, { status: response.status });
    return {
      isValid: false,
      statusCode: response.status,
      error: `HTTP ${response.status}`,
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        log.warn(`Link timeout: ${url}`);
        return { isValid: false, error: "Request timeout" };
      }
      log.error(`Link validation failed: ${url}`, { error: error.message });
      return { isValid: false, error: error.message };
    }
    return { isValid: false, error: "Unknown error" };
  }
}

/**
 * Batch validate multiple links
 */
export async function validateLinks(
  urls: string[]
): Promise<Map<string, LinkValidationResult>> {
  const results = new Map<string, LinkValidationResult>();
  const validations = await Promise.allSettled(
    urls.map(async (url) => ({
      url,
      result: await validateLink(url),
    }))
  );

  for (const validation of validations) {
    if (validation.status === "fulfilled") {
      results.set(validation.value.url, validation.value.result);
    }
  }

  return results;
}
